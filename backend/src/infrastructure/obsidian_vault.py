"""
Obsidian Vault Storage Adapter.
Produces dual output (.md with YAML frontmatter + Dataview query & .json with Schema v2026.1).
Guarantees atomic writes and defends strictly against Path Traversal vulnerabilities.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from backend.src.domain.entities import AuditReport
from backend.src.domain.exceptions import PathTraversalSecurityError
from backend.src.domain.protocols import VaultStorageProtocol


class ObsidianVaultAdapter(VaultStorageProtocol):
    """Adapter for storing audits in an Obsidian Vault structure."""

    def __init__(self, vault_root: str = "ObsidianVault") -> None:
        self._vault_root = Path(vault_root).resolve()
        self._vault_root.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, filename: str) -> Path:
        """Resolves target path and enforces that it remains within vault_root boundary."""
        target = (self._vault_root / filename).resolve()
        try:
            target.relative_to(self._vault_root)
        except ValueError:
            raise PathTraversalSecurityError(filename)
        return target

    def _atomic_write(self, target_path: Path, content: str) -> None:
        """Writes content to a temporary file and atomically renames it to target_path."""
        target_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = target_path.with_name(f".tmp_{target_path.name}_{os.getpid()}")
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, target_path)
        except Exception:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise

    def save_dual_audit(self, report: AuditReport) -> Tuple[str, str]:
        # Path traversal guard on session_id
        safe_session = report.session_id.strip()
        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:
            raise PathTraversalSecurityError(report.session_id)

        md_filename = f"Audit_{safe_session}.md"
        json_filename = f"Audit_{safe_session}.json"

        md_path = self._resolve_safe_path(md_filename)
        json_path = self._resolve_safe_path(json_filename)

        # 1. Render Markdown with YAML frontmatter, wikilinks and Dataview block
        md_content = self._render_markdown(report)
        self._atomic_write(md_path, md_content)

        # 2. Render Machine JSON (Schema v2026.1)
        json_content = self._render_json(report)
        self._atomic_write(json_path, json_content)

        # 3. Update Obsidian Map of Content (MOC) for Graph View
        self._update_moc_index(report)

        # 4. Update Minimalist Locked Schema Logs (nhat_ky_in.json & nhat_ky_in.md)
        self._update_minimalist_logs(report)

        return (str(md_path), str(json_path))

    def get_audit_json(self, session_id: str) -> Optional[Dict[str, Any]]:
        safe_session = session_id.strip()
        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:
            raise PathTraversalSecurityError(session_id)

        json_path = self._resolve_safe_path(f"Audit_{safe_session}.json")
        if not json_path.exists():
            return None
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _render_markdown(self, report: AuditReport) -> str:
        material_tag = f"material/{report.material.lower()}"
        churn_tag = "churn/high-hesitation" if report.high_churn_parameters else "churn/normal"
        tags_yaml = "\n  - ".join(["printsim/audit", "corexy/telemetry", material_tag, churn_tag])

        # Build Table rows
        table_rows = []
        for m in report.metrics:
            history_str = " ➔ ".join(str(v) for v in m.change_history) if m.change_history else str(m.final_value)
            table_rows.append(
                f"| `{m.parameter_name}` | {m.mutation_count} | **{m.churn_severity}** | `{m.initial_value}` | `{m.final_value}` | {history_str} |"
            )
        metrics_table = "\n".join(table_rows) if table_rows else "| *Không có thông số* | - | - | - | - | - |"

        ai_section = ""
        if report.ai_insight:
            ai_section = f"""
---

## 🤖 Nhận Định Chuyên Gia AI (Gemini Diagnostics)
{report.ai_insight}
"""

        return f"""---
session_id: {report.session_id}
created_at: {report.created_at.isoformat()}
total_events: {report.total_events}
high_churn_count: {len(report.high_churn_parameters)}
material: {report.material}
tags:
  - {tags_yaml}
---

# 🖨️ Audit Report: [[Session_{report.session_id}]]

> **MOC:** [[000_PRINT_INDEX]]  
> **Tags:** #printsim/audit #corexy/telemetry #{material_tag} #{churn_tag}  
> **Thời gian tạo:** `{report.created_at.isoformat()}`  
> **Vật liệu in:** `{report.material}`  
> **Tổng số đột biến tham số:** `{report.total_events}`  
> **Tham số phân vân cao (>= 3 lần đổi):** `{", ".join(report.high_churn_parameters) if report.high_churn_parameters else "Không phát hiện"}`

---

## 📌 Tóm Tắt Phân Tích
{report.summary}
{ai_section}
---

## 📊 Truy Vấn Obsidian Dataview
```dataview
TABLE parameter_name, mutation_count, is_high_churn, initial_value, final_value
FROM #printsim/audit
WHERE session_id = "{report.session_id}"
SORT mutation_count DESC
```

---

## 🔬 Chi Tiết Biến Đổi Tham Số (Parameter Metrics)
| Tham số | Số lần đổi | Đánh giá | Ban đầu | Cuối cùng | Lịch sử biến đổi |
| :--- | :---: | :---: | :---: | :---: | :--- |
{metrics_table}
"""

    def _render_json(self, report: AuditReport) -> str:
        mutation_history: Dict[str, list] = {}
        metrics_data = []

        for m in report.metrics:
            mutation_history[m.parameter_name] = m.change_history
            metrics_data.append({
                "parameter_name": m.parameter_name,
                "mutation_count": m.mutation_count,
                "is_high_churn": m.is_high_churn,
                "churn_severity": m.churn_severity,
                "initial_value": m.initial_value,
                "final_value": m.final_value,
                "change_history": m.change_history,
            })

        data = {
            "schema_version": "v2026.1",
            "session_id": report.session_id,
            "created_at": report.created_at.isoformat(),
            "material": report.material,
            "total_events": report.total_events,
            "summary": report.summary,
            "diagnostics": {
                "high_churn_parameters": report.high_churn_parameters,
                "hesitation_detected": len(report.high_churn_parameters) > 0,
                "total_monitored_parameters": len(report.metrics),
                "ai_insight": report.ai_insight,
            },
            "mutation_history": mutation_history,
            "metrics": metrics_data,
        }
        return json.dumps(data, indent=2, ensure_ascii=False)

    def _update_moc_index(self, latest_report: AuditReport) -> None:
        """Maintains the 000_PRINT_INDEX.md Map of Content linking all sessions for Obsidian Graph View."""
        moc_path = self._resolve_safe_path("000_PRINT_INDEX.md")

        # Scan all existing audit markdown files in vault_root
        existing_audits = sorted(
            [f.stem.replace("Audit_", "") for f in self._vault_root.glob("Audit_*.md")],
            reverse=True,
        )
        if latest_report.session_id not in existing_audits:
            existing_audits.insert(0, latest_report.session_id)

        links_section = "\n".join(
            [f"- [[Audit_{sid}]] — Phiên in `{sid}`" for sid in existing_audits]
        )

        moc_content = f"""---
type: moc
tags:
  - printsim/index
  - corexy/vault
---

# 🧭 3D PrintSim Pro — Map of Content (MOC) & Graph Navigator

> **Obsidian Graph View Hub**: Tệp này liên kết toàn bộ các phiên in 3D và báo cáo kiểm định để trực quan hóa sơ đồ mạng nhện.

---

## 📈 Truy Vấn Obsidian Dataview Toàn Bộ Phiên In
```dataview
TABLE created_at as "Thời gian", material as "Vật liệu", total_events as "Sự kiện", high_churn_count as "Độ phân vân"
FROM #printsim/audit
SORT file.mtime DESC
```

---

## 🗂️ Danh Sách Báo Cáo Kiểm Định (Session Wikilinks)
{links_section}

---
*Tự động đồng bộ bởi 3D PrintSim Telemetry Engine.*
"""
        self._atomic_write(moc_path, moc_content)

    def _update_minimalist_logs(self, report: AuditReport) -> None:
        """Updates nhat_ky_in.json and nhat_ky_in.md conforming strictly to the user's locked schemas."""
        json_log_path = self._resolve_safe_path("nhat_ky_in.json")
        md_log_path = self._resolve_safe_path("nhat_ky_in.md")

        from backend.src.infrastructure.minimalist_formatter import (
            build_session_entry,
            render_markdown_log,
        )

        entries = []
        if json_log_path.exists():
            try:
                with open(json_log_path, "r", encoding="utf-8") as f:
                    entries = json.load(f)
            except Exception:
                entries = []

        phien_num = len(entries) + 1
        thu_lai = f"{len(entries):02d}" if len(entries) >= 1 else None

        has_warping_risk = any(
            (m.parameter_name == "brimEnabled" and not m.final_value)
            or (m.parameter_name == "bedTemp" and (m.final_value or 0) < 60)
            for m in report.metrics
        )
        has_heatcreep_risk = any(
            (m.parameter_name == "bedTemp" and (m.final_value or 0) >= 80)
            or (m.parameter_name == "printSpeed" and (m.final_value or 0) > 300)
            for m in report.metrics
        )
        loi_desc = (
            "Va chạm đầu in tại lớp 35 (Warping do thiếu vành bám)"
            if has_warping_risk
            else "Nghẹt nhựa đầu phun tại lớp 120 (Trào ngược nhiệt buồng in)"
            if has_heatcreep_risk
            else "Không phát hiện lỗi nghiêm trọng (In hoàn tất)"
        )

        new_entry = build_session_entry(
            phien_index=phien_num,
            metrics=report.metrics,
            nguoi_dung="Nguyễn Văn A",
            thoi_gian_str=f"{report.created_at.strftime('%Y-%m-%d %H:%M')} (7 phút)",
            hanh_dong="Mô phỏng (50x) -> Bắt đầu in" if phien_num == 1 else "Mô phỏng lại -> Bắt đầu in",
            loi=loi_desc,
            thu_lai_tu_phien=thu_lai,
        )

        entries.append(new_entry)

        # 1. Write nhat_ky_in.json (Locked Schema 1.1)
        self._atomic_write(json_log_path, json.dumps(entries, indent=2, ensure_ascii=False))

        # 2. Write nhat_ky_in.md (Locked Schema 1.2)
        md_log = render_markdown_log(entries)
        self._atomic_write(md_log_path, md_log)

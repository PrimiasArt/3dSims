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

    def __init__(
        self,
        vault_root: str = "ObsidianVault",
        json_root: str = "JsonLogs",
    ) -> None:
        self._vault_root = Path(vault_root).resolve()
        self._json_root = Path(json_root).resolve()
        self._vault_root.mkdir(parents=True, exist_ok=True)
        self._json_root.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_md_path(self, filename: str) -> Path:
        """Resolves target markdown path and enforces that it remains within vault_root boundary."""
        target = (self._vault_root / filename).resolve()
        try:
            target.relative_to(self._vault_root)
        except ValueError:
            raise PathTraversalSecurityError(filename)
        return target

    def _resolve_safe_json_path(self, filename: str) -> Path:
        """Resolves target JSON path and enforces that it remains within json_root boundary."""
        target = (self._json_root / filename).resolve()
        try:
            target.relative_to(self._json_root)
        except ValueError:
            raise PathTraversalSecurityError(filename)
        return target

    def _resolve_safe_path(self, filename: str) -> Path:
        """Routes files according to extension: .json -> json_root, .md -> vault_root."""
        if filename.lower().endswith(".json"):
            return self._resolve_safe_json_path(filename)
        return self._resolve_safe_md_path(filename)

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

        md_filename = f"01_BaoCao_KiemDinh/Audit_{safe_session}.md"
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
        from backend.src.infrastructure.minimalist_formatter import format_param_value

        material_tag = f"material/{report.material.lower()}"
        churn_tag = "churn/high-hesitation" if report.high_churn_parameters else "churn/normal"
        tags_yaml = "\n  - ".join(["printsim/audit", "corexy/telemetry", material_tag, churn_tag])

        # Gộp toàn bộ 30 tham số của 5 tab và đùn nhựa vào 1 BẢNG DUY NHẤT
        tab_icons = {
            "Cơ Bản": "🟢",
            "Vách & Vỏ": "🟡",
            "Support": "🌲",
            "Tốc Độ": "⚡",
            "Nhiệt Độ": "🔥",
            "Đùn Nhựa": "💧",
        }

        table_rows = []
        for m in report.metrics:
            tab = getattr(m, "tab_name", "Cơ Bản") or "Cơ Bản"
            icon = tab_icons.get(tab, "📌")
            p_label = getattr(m, "label", "") or m.parameter_name
            formatted_init = format_param_value(m.parameter_name, m.initial_value)
            formatted_final = format_param_value(m.parameter_name, m.final_value)
            hist_formatted = " ➔ ".join(format_param_value(m.parameter_name, v) for v in m.change_history) if m.change_history else formatted_final

            table_rows.append(
                f"| {icon} {tab} | `{m.parameter_name}` | {p_label} | {m.mutation_count} | **{m.churn_severity}** | `{formatted_init}` | `{formatted_final}` | {hist_formatted} |"
            )

        metrics_table = "\n".join(table_rows) if table_rows else "| - | *Không có thông số* | - | - | - | - | - | - |"

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
total_parameters: {len(report.metrics)}
high_churn_count: {len(report.high_churn_parameters)}
material: {report.material}
tags:
  - {tags_yaml}
---

# 🖨️ Audit Report: [[Session_{report.session_id}]]

> **MOC:** [[000_PRINT_INDEX]]  
> **Thư mục lưu:** `01_BaoCao_KiemDinh/`  
> **Tags:** #printsim/audit #corexy/telemetry #{material_tag} #{churn_tag}  
> **Thời gian tạo:** `{report.created_at.isoformat()}`  
> **Vật liệu in:** `{report.material}`  
> **Tổng số đột biến tham số:** `{report.total_events}`  
> **Tổng số tham số giám sát:** `{len(report.metrics)}`  
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

## 🔬 Bảng Tổng Hợp Chi Tiết Toàn Bộ 30 Tham Số Cắt Lớp (Unified Parameter Metrics)

| Nhóm / Tab | Tham số | Tên mô tả | Số lần đổi | Đánh giá | Ban đầu | Cuối cùng | Lịch sử biến đổi |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
{metrics_table}
"""

    def _render_json(self, report: AuditReport) -> str:
        from backend.src.infrastructure.minimalist_formatter import format_param_value

        mutation_history: Dict[str, list] = {}
        metrics_data = []

        for m in report.metrics:
            mutation_history[m.parameter_name] = m.change_history
            metrics_data.append({
                "tab_name": getattr(m, "tab_name", "Cơ Bản"),
                "parameter_name": m.parameter_name,
                "label": getattr(m, "label", m.parameter_name),
                "unit": getattr(m, "unit", ""),
                "mutation_count": m.mutation_count,
                "is_high_churn": m.is_high_churn,
                "churn_severity": m.churn_severity,
                "initial_value": m.initial_value,
                "final_value": m.final_value,
                "formatted_initial": format_param_value(m.parameter_name, m.initial_value),
                "formatted_final": format_param_value(m.parameter_name, m.final_value),
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

        # Scan all existing audit markdown files in 01_BaoCao_KiemDinh
        audit_folder = self._vault_root / "01_BaoCao_KiemDinh"
        audit_files = list(audit_folder.glob("Audit_*.md")) if audit_folder.exists() else []
        if not audit_files:
            audit_files = list(self._vault_root.glob("**/Audit_*.md"))
        existing_audits = sorted(
            [f.stem.replace("Audit_", "") for f in audit_files],
            reverse=True,
        )
        if latest_report.session_id not in existing_audits:
            existing_audits.insert(0, latest_report.session_id)

        session_table_rows = []
        for sid in existing_audits:
            audit_file = audit_folder / f"Audit_{sid}.md"
            created_str = "-"
            mat_str = "PLA"
            if audit_file.exists():
                try:
                    with open(audit_file, "r", encoding="utf-8") as f:
                        lines = [f.readline() for _ in range(12)]
                        for ln in lines:
                            if ln.startswith("created_at:"):
                                created_str = ln.replace("created_at:", "").strip()[:16].replace("T", " ")
                            elif ln.startswith("material:"):
                                mat_str = ln.replace("material:", "").strip()
                except Exception:
                    pass
            session_table_rows.append(
                f"| `{sid}` | [[Audit_{sid}|Báo Cáo Phiên {sid}]] | `{created_str}` | `{mat_str}` | `01_BaoCao_KiemDinh/` | `JsonLogs/` |"
            )
        session_table = "\n".join(session_table_rows)

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
FROM "01_BaoCao_KiemDinh" OR #printsim/audit
SORT file.mtime DESC
```

---

## 🗂️ Bảng Tổng Hợp Điều Hướng Các Phiên In (Sessions Matrix)

| Phiên in | Báo cáo kiểm định | Thời gian tạo | Vật liệu | Thư mục MD | Thư mục JSON |
| :---: | :--- | :---: | :---: | :--- | :--- |
{session_table}

---

## 📓 Nhật Ký In Khóa Chuẩn (02_NhatKy_In)
- [[nhat_ky_in|Nhật Ký In Tổng Hợp]] (`02_NhatKy_In/nhat_ky_in.md`)

---
*Tự động đồng bộ bởi 3D PrintSim Telemetry Engine.*
"""
        self._atomic_write(moc_path, moc_content)

    def _update_minimalist_logs(self, report: AuditReport) -> None:
        """Updates nhat_ky_in.json and nhat_ky_in.md conforming strictly to the user's locked schemas."""
        json_log_path = self._resolve_safe_path("nhat_ky_in.json")
        md_log_path = self._resolve_safe_path("02_NhatKy_In/nhat_ky_in.md")

        from backend.src.infrastructure.minimalist_formatter import (
            build_parameter_session_matrix,
            build_session_entry,
            render_markdown_log,
        )

        entries = []
        if json_log_path.exists():
            try:
                with open(json_log_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        entries = data
                    elif isinstance(data, dict):
                        entries = data.get("chi_tiet_tung_phien", [])
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

        # 1. Write nhat_ky_in.json (Consolidated Matrix JSON)
        session_cols, json_matrix_rows, _ = build_parameter_session_matrix(entries)
        matrix_payload = {
            "schema_version": "v2026.1",
            "kieu_trinh_bay": "bang_hop_nhat_phan_lop",
            "tong_so_phien": len(entries),
            "danh_sach_phien": session_cols,
            "bang_tong_hop": json_matrix_rows,
            "ma_tran_tham_so": json_matrix_rows,
            "chi_tiet_tung_phien": entries,
        }
        self._atomic_write(json_log_path, json.dumps(matrix_payload, indent=2, ensure_ascii=False))

        # 2. Write nhat_ky_in.md (Single Matrix Table Layout)
        md_log = render_markdown_log(entries)
        self._atomic_write(md_log_path, md_log)

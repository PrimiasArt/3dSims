"""
Vault JSON Store.
Specialized repository for structured JSON audit logs and nhat_ky_in.json matrix storage.
"""
import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.src.domain.entities import AuditReport
from backend.src.domain.exceptions import PathTraversalSecurityError
from backend.src.infrastructure.formatters import (
    format_param_value,
    build_parameter_session_matrix,
)


class VaultJsonStore:
    """Handles structured JSON storage and queries with path security and atomic writes."""

    def __init__(self, json_root: Path | str = "JsonLogs") -> None:
        self.json_root = Path(json_root).resolve()
        self.json_root.mkdir(parents=True, exist_ok=True)

    def resolve_safe_path(self, filename: str) -> Path:
        """Resolves target JSON path and enforces that it remains within json_root boundary."""
        target = (self.json_root / filename).resolve()
        try:
            target.relative_to(self.json_root)
        except ValueError:
            raise PathTraversalSecurityError(filename)
        return target

    def atomic_write(self, target_path: Path, content: str) -> None:
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

    def render_json(self, report: AuditReport) -> str:
        """Renders structured machine JSON audit (Schema v2026.1)."""
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

    def save_audit_json(self, report: AuditReport) -> Path:
        """Renders and atomically saves an AuditReport to JSON."""
        safe_session = report.session_id.strip()
        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:
            raise PathTraversalSecurityError(report.session_id)

        json_path = self.resolve_safe_path(f"Audit_{safe_session}.json")
        json_content = self.render_json(report)
        self.atomic_write(json_path, json_content)
        return json_path

    def get_audit_json(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves the structured machine JSON audit for a given session."""
        safe_session = session_id.strip()
        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:
            raise PathTraversalSecurityError(session_id)

        json_path = self.resolve_safe_path(f"Audit_{safe_session}.json")
        if not json_path.exists():
            return None
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def load_nhat_ky_entries(self) -> List[Dict[str, Any]]:
        """Reads entries from nhat_ky_in.json if it exists."""
        json_log_path = self.resolve_safe_path("nhat_ky_in.json")
        if not json_log_path.exists():
            return []
        try:
            with open(json_log_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    return data.get("sessions") or data.get("chi_tiet_tung_phien") or []
        except Exception:
            return []
        return []

    def save_nhat_ky_matrix(self, entries: List[Dict[str, Any]]) -> Tuple[List[str], List[Dict[str, Any]]]:
        """Saves consolidated parameter matrix into nhat_ky_in.json."""
        session_cols, json_matrix_rows, _ = build_parameter_session_matrix(entries)
        matrix_payload = {
            "schema_version": "v2026.1",
            "kieu_trinh_bay": "bang_hop_nhat_phan_lop",
            "tong_so_phien": len(entries),
            "danh_sach_phien": session_cols,
            "bang_tong_hop": json_matrix_rows,
            "ma_tran_tham_so": json_matrix_rows,
            "sessions": entries,
            "chi_tiet_tung_phien": entries,
        }
        json_log_path = self.resolve_safe_path("nhat_ky_in.json")
        self.atomic_write(json_log_path, json.dumps(matrix_payload, indent=2, ensure_ascii=False))
        return session_cols, json_matrix_rows

    def create_snapshot(self, tag: str = "auto") -> Optional[Path]:
        """Creates a timestamped snapshot of nhat_ky_in.json into JsonLogs/backups/."""
        source = self.resolve_safe_path("nhat_ky_in.json")
        if not source.exists():
            return None
        backups_dir = self.json_root / "backups"
        backups_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backups_dir / f"nhat_ky_in_{ts}_{tag}.json"
        shutil.copy2(source, backup_path)
        # Keep latest 20 backups
        all_backups = sorted(backups_dir.glob("nhat_ky_in_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in all_backups[20:]:
            try:
                old.unlink()
            except OSError:
                pass
        return backup_path

    def list_snapshots(self) -> List[Dict[str, Any]]:
        """Lists available JSON snapshots."""
        backups_dir = self.json_root / "backups"
        if not backups_dir.exists():
            return []
        items = []
        for p in sorted(backups_dir.glob("nhat_ky_in_*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            items.append({
                "filename": p.name,
                "size_bytes": p.stat().st_size,
                "created_at": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                "type": "json",
            })
        return items

    def restore_snapshot(self, filename: str) -> bool:
        """Restores a snapshot file back to nhat_ky_in.json."""
        if ".." in filename or "/" in filename or "\\" in filename:
            raise PathTraversalSecurityError(filename)
        backup_file = self.json_root / "backups" / filename
        if not backup_file.exists():
            return False
        target = self.resolve_safe_path("nhat_ky_in.json")
        content = backup_file.read_text(encoding="utf-8")
        self.atomic_write(target, content)
        return True

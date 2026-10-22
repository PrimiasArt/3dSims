"""
Obsidian Vault Storage Adapter (Façade Pattern).
Coordinates dual-output persistence across specialized stores:
- VaultMarkdownStore: Manages human-friendly Markdown notes, 3D Profiles, MOC Index, and thumbnails.
- VaultJsonStore: Manages machine-readable JSON logs and consolidated telemetry matrices.

Guarantees atomic writes and defends strictly against Path Traversal vulnerabilities.
"""
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.src.domain.entities import AuditReport, ParameterMetric
from backend.src.domain.exceptions import PathTraversalSecurityError
from backend.src.domain.protocols import VaultStorageProtocol
from backend.src.infrastructure.formatters import build_session_entry
from backend.src.infrastructure.vault.vault_json_store import VaultJsonStore
from backend.src.infrastructure.vault.vault_markdown_store import VaultMarkdownStore


class ObsidianVaultAdapter(VaultStorageProtocol):
    """
    Unified Storage Adapter implementing VaultStorageProtocol.
    Acts as a Façade delegating to VaultMarkdownStore and VaultJsonStore.
    """

    def __init__(
        self,
        vault_root: str = "ObsidianVault",
        json_root: str = "JsonLogs",
    ) -> None:
        self.markdown_store = VaultMarkdownStore(vault_root)
        self.json_store = VaultJsonStore(json_root)

        # Retain direct property access for backward compatibility
        self._vault_root: Path = self.markdown_store.vault_root
        self._json_root: Path = self.json_store.json_root
        self._profiles_dir: Path = self.markdown_store.profiles_dir
        self._audits_dir: Path = self.markdown_store.audits_dir
        self._logs_dir: Path = self.markdown_store.logs_dir

    def _resolve_safe_md_path(self, filename: str) -> Path:
        """Resolves target markdown path within vault_root boundary."""
        return self.markdown_store.resolve_safe_path(filename)

    def _resolve_safe_json_path(self, filename: str) -> Path:
        """Resolves target JSON path within json_root boundary."""
        return self.json_store.resolve_safe_path(filename)

    def _resolve_safe_path(self, filename: str) -> Path:
        """Routes files according to extension: .json -> json_root, .md -> vault_root."""
        if filename.lower().endswith(".json"):
            return self._resolve_safe_json_path(filename)
        return self._resolve_safe_md_path(filename)

    def _atomic_write(self, target_path: Path, content: str) -> None:
        """Writes content to a temporary file and atomically renames it to target_path."""
        self.markdown_store.atomic_write(target_path, content)

    def save_dual_audit(self, report: AuditReport) -> Tuple[str, str]:
        """
        Atomically write both Markdown (.md) and Structured JSON (.json) files,
        generating 3D profiles, updating MOC, and synchronizing minimalist logs.
        """
        safe_session = report.session_id.strip()
        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:
            raise PathTraversalSecurityError(report.session_id)

        md_filename = f"01_BaoCao_KiemDinh/Audit_{safe_session}.md"
        profile_filename = f"01_Profiles_In3D/Profile_In3D_{safe_session}.md"

        md_path = self._resolve_safe_path(md_filename)
        profile_path = self._resolve_safe_path(profile_filename)

        # 1. Render & Save Technical Audit Markdown (.md)
        md_content = self.markdown_store.render_markdown(report)
        self.markdown_store.atomic_write(md_path, md_content)

        # 2. Render & Save Executive 3D Print Profile (.md)
        profile_content = self.markdown_store.render_3d_profile(report)
        self.markdown_store.atomic_write(profile_path, profile_content)

        # 3. Render & Save Structured JSON (Schema v2026.1)
        json_path = self.json_store.save_audit_json(report)

        # 4. Update Obsidian Map of Content (MOC) for Graph View
        self.markdown_store.update_moc_index(report)

        # 5. Update Minimalist Locked Schema Logs (nhat_ky_in.json & nhat_ky_in.md)
        self._update_minimalist_logs(report)

        return (str(md_path), str(json_path))

    def get_audit_json(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves structured machine JSON audit for a given session."""
        return self.json_store.get_audit_json(session_id)

    def render_3d_profile_from_dict(self, s: dict) -> str:
        """Renders an executive 3D Print Profile from a session dictionary."""
        return self.markdown_store.render_3d_profile_from_dict(s)

    def get_3d_profile_md(self, session_id: str) -> Optional[str]:
        """Retrieves executive 3D print profile markdown for a given session."""
        return self.markdown_store.get_3d_profile_md(session_id)

    def save_session_thumbnail(self, session_id: str, image_bytes: bytes, ext: str = "png") -> Tuple[str, str]:
        """Saves a model thumbnail image and updates the corresponding Profile_In3D note."""
        return self.markdown_store.save_session_thumbnail(session_id, image_bytes, ext=ext)

    def get_session_thumbnail_path(self, session_id: str) -> Optional[Path]:
        """Returns the physical Path of a session thumbnail if it exists."""
        return self.markdown_store.get_session_thumbnail_path(session_id)

    def save_comparison_report(self, comparison_data: Dict[str, Any]) -> Tuple[str, str]:
        """Saves a session comparison report and updates the MOC."""
        return self.markdown_store.save_comparison_report(comparison_data)

    def _get_metric_val(self, metrics: List[ParameterMetric], name: str, default: Any = None) -> Any:
        return self.markdown_store._get_metric_val(metrics, name, default)

    def _render_3d_profile(self, report: AuditReport) -> str:
        return self.markdown_store.render_3d_profile(report)

    def _render_markdown(self, report: AuditReport) -> str:
        return self.markdown_store.render_markdown(report)

    def _render_json(self, report: AuditReport) -> str:
        return self.json_store.render_json(report)

    def _update_moc_index(self, latest_report: AuditReport) -> None:
        self.markdown_store.update_moc_index(latest_report)

    def _update_minimalist_logs(self, report: AuditReport) -> None:
        """Updates nhat_ky_in.json and nhat_ky_in.md strictly conforming to locked schemas."""
        entries = self.json_store.load_nhat_ky_entries()

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
            nguoi_dung="Kỹ sư vận hành",
            thoi_gian_str=f"{report.created_at.strftime('%Y-%m-%d %H:%M')} (7 phút)",
            hanh_dong="Mô phỏng (50x) -> Bắt đầu in" if phien_num == 1 else "Mô phỏng lại -> Bắt đầu in",
            loi=loi_desc,
            thu_lai_tu_phien=thu_lai,
        )

        entries.append(new_entry)

        # 1. Update consolidated JSON matrix
        self.json_store.save_nhat_ky_matrix(entries)

        # 2. Update consolidated Markdown log
        self.markdown_store.update_minimalist_markdown_log(entries)

    def create_snapshot(self, tag: str = "auto") -> Dict[str, Optional[str]]:
        """Creates timestamped backup snapshots for both JSON and Markdown log stores."""
        json_backup = self.json_store.create_snapshot(tag)
        md_backup = self.markdown_store.create_snapshot(tag)
        return {
            "json_backup": str(json_backup) if json_backup else None,
            "md_backup": str(md_backup) if md_backup else None,
        }

    def list_snapshots(self) -> Dict[str, List[Dict[str, Any]]]:
        """Lists snapshots from both stores."""
        return {
            "json_snapshots": self.json_store.list_snapshots(),
            "md_snapshots": self.markdown_store.list_snapshots(),
        }

    def restore_snapshot(self, filename: str) -> bool:
        """Restores a snapshot file (.json or .md) based on file extension."""
        if filename.endswith(".json"):
            return self.json_store.restore_snapshot(filename)
        elif filename.endswith(".md"):
            return self.markdown_store.restore_snapshot(filename)
        return False


__all__ = [
    "ObsidianVaultAdapter",
    "VaultMarkdownStore",
    "VaultJsonStore",
]
"""
Native 3MF Project Packaging Routers for Bambu Studio & OrcaSlicer.
Provides 1-click export of complete 3D models with embedded slice configs and plate thumbnails.
"""
import base64
import json
from typing import Optional
from fastapi import APIRouter, Depends, Path, Query, HTTPException, status, Response
from backend.src.domain.protocols import VaultStorageProtocol, TelemetryRepositoryProtocol
from backend.src.infrastructure.project_packager import ProjectPackager3MF
from backend.src.presentation.dependencies import get_vault, get_repo
from backend.src.presentation.schemas import Project3MFExportRequest

router = APIRouter(tags=["3MF Project Packager"])


@router.post(
    "/api/v1/projects/export-3mf",
    responses={
        200: {
            "description": "Tệp dự án .3mf hoặc .gcode.3mf hoàn chỉnh tải về",
            "content": {"application/vnd.ms-package.3dmanufacturing-3dmodel+xml": {}},
        }
    },
    status_code=status.HTTP_200_OK,
)
async def export_3mf_project(
    payload: Project3MFExportRequest,
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """
    Đóng gói mô hình 3D (vertices, triangles) + cấu hình Slicer + ảnh thumbnail
    thành tệp dự án .3mf chuẩn hoặc .gcode.3mf nạp trực tiếp thẻ nhớ SD cho máy in.
    """
    # Parse thumbnail if base64 provided
    thumb_bytes = None
    if payload.thumbnail_base64:
        b64 = payload.thumbnail_base64
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        try:
            thumb_bytes = base64.b64decode(b64)
        except Exception:
            thumb_bytes = None

    safe_name = payload.model_name.replace(" ", "_") or "Model_Project"
    ext = ".gcode.3mf" if payload.sd_card_mode else ".3mf"
    filename = f"{safe_name}{ext}"

    raw_bytes = ProjectPackager3MF.generate_3mf_bytes(
        model_name=payload.model_name,
        profile=payload.profile,
        vertices=payload.vertices,
        triangles=payload.triangles,
        thumbnail_bytes=thumb_bytes,
        sd_card_mode=payload.sd_card_mode,
        gcode_content=payload.gcode_content,
    )

    # Tự động sao lưu một bản vào ObsidianVault/01_Profiles_In3D/3MF_Projects/
    try:
        projects_dir = vault._vault_root / "01_Profiles_In3D" / "3MF_Projects"
        projects_dir.mkdir(parents=True, exist_ok=True)
        vault._atomic_write(projects_dir / filename, raw_bytes)
    except Exception:
        pass

    return Response(
        content=raw_bytes,
        media_type="application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/api/v1/sessions/{session_id:path}/export-3mf",
    responses={
        200: {
            "description": "Tệp .3mf hoặc .gcode.3mf dựng từ phiên in",
            "content": {"application/vnd.ms-package.3dmanufacturing-3dmodel+xml": {}},
        }
    },
    status_code=status.HTTP_200_OK,
)
async def export_session_3mf(
    session_id: str = Path(..., min_length=1),
    sd_card: bool = Query(False, description="Xuất định dạng .gcode.3mf nạp thẻ nhớ MicroSD cắm máy in"),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Xuất một phiên in bất kỳ thành tệp dự án .3mf hoặc .gcode.3mf có sẵn thông số cắt lớp."""
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        from backend.src.domain.exceptions import PathTraversalSecurityError
        raise PathTraversalSecurityError(session_id)

    json_path = vault._resolve_safe_path("nhat_ky_in.json")
    session_dict = None
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])
            session_dict = next((s for s in sessions if str(s.get("sessionId")) == session_id), None)

    if not session_dict:
        session_dict = {
            "sessionId": session_id,
            "material": "PLA",
            "layer_height_mm": 0.20,
            "infill_percent": 20,
            "speed_mms": 120,
            "bed_temp_c": 60,
            "nozzle_temp_c": 215,
        }

    # Load thumbnail if available in vault
    thumb_path = vault.get_session_thumbnail_path(session_id)
    thumb_bytes = None
    if thumb_path and thumb_path.exists():
        try:
            with open(thumb_path, "rb") as f:
                thumb_bytes = f.read()
        except Exception:
            thumb_bytes = None

    model_name = session_dict.get("metadata", {}).get("modelName") or f"Session_{session_id}"
    ext = ".gcode.3mf" if sd_card else ".3mf"
    filename = f"{model_name}_BambuProject{ext}"

    raw_bytes = ProjectPackager3MF.generate_3mf_bytes(
        model_name=model_name,
        profile=session_dict,
        thumbnail_bytes=thumb_bytes,
        sd_card_mode=sd_card,
    )

    return Response(
        content=raw_bytes,
        media_type="application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

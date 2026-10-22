"""
Slicer Profile Export (OrcaSlicer, Bambu Studio, PrusaSlicer) and Session Diff Comparison Routers.
"""
import json
from fastapi import APIRouter, Depends, Path, Query, HTTPException, status, Response
from fastapi.responses import JSONResponse, PlainTextResponse
from backend.src.domain.protocols import TelemetryRepositoryProtocol, VaultStorageProtocol
from backend.src.application.use_cases import CalculateParameterChurnUseCase
from backend.src.presentation.dependencies import get_repo, get_vault, get_churn_calculator
from backend.src.presentation.schemas import SlicerExportResponse, SessionComparisonResponse

router = APIRouter(tags=["Slicer Presets & Benchmarking"])


@router.get(
    "/api/v1/sessions/{session_id:path}/export-slicer",
    responses={
        200: {
            "description": "File preset đính kèm (download=True) hoặc JSON chi tiết (download=False)",
            "content": {
                "application/octet-stream": {},
                "application/json": {"schema": SlicerExportResponse.model_json_schema()},
            },
        }
    },
    status_code=status.HTTP_200_OK,
)
async def export_slicer(
    session_id: str = Path(..., min_length=1),
    format: str = Query("orcaslicer", description="Slicer format: orcaslicer, bambulab, or prusaslicer"),
    download: bool = Query(True, description="True for file attachment download, False for JSON content"),
    vault: VaultStorageProtocol = Depends(get_vault),
    repo: TelemetryRepositoryProtocol = Depends(get_repo),
    churn_calc: CalculateParameterChurnUseCase = Depends(get_churn_calculator),
):
    """Xuất cấu hình Slicer thật (OrcaSlicer, Bambu Studio, PrusaSlicer) từ thông số phiên in."""
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        from backend.src.domain.exceptions import PathTraversalSecurityError
        raise PathTraversalSecurityError(session_id)

    # 1. Tìm thông tin session từ nhat_ky_in.json
    json_path = vault._resolve_safe_path("nhat_ky_in.json")
    session_dict = None
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])
            session_dict = next((s for s in sessions if str(s.get("sessionId")) == session_id), None)

    if not session_dict:
        # Fallback to session report live extractor
        events = repo.get_events_by_session(session_id)
        metrics = churn_calc.execute(events) if events else []
        from backend.src.infrastructure.formatters import build_session_entry
        session_dict = build_session_entry(
            phien_index=1,
            metrics=metrics,
            nguoi_dung="Kỹ sư in 3D",
            hanh_dong="Xuất Slicer Preset",
        )
        session_dict["sessionId"] = session_id

    from backend.src.infrastructure.slicer_exporter import export_slicer_preset
    content, filename, mime = export_slicer_preset(session_dict, format)

    # Tự động lưu vào ObsidianVault/01_Profiles_In3D/SlicerPresets/
    try:
        presets_dir = vault._vault_root / "01_Profiles_In3D" / "SlicerPresets"
        presets_dir.mkdir(parents=True, exist_ok=True)
        vault._atomic_write(presets_dir / filename, content)
    except Exception:
        pass

    if download:
        return Response(
            content=content,
            media_type=mime,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return JSONResponse(
        content={
            "status": "success",
            "session_id": session_id,
            "format": format,
            "filename": filename,
            "content": content,
            "saved_preset_path": f"01_Profiles_In3D/SlicerPresets/{filename}",
        },
        status_code=status.HTTP_200_OK,
    )


@router.get(
    "/api/v1/sessions/compare",
    response_model=SessionComparisonResponse,
    status_code=status.HTTP_200_OK,
)
async def compare_two_sessions(
    base_id: str = Query(..., description="Mã phiên gốc ban đầu"),
    target_id: str = Query(..., description="Mã phiên mục tiêu đối chiếu"),
    save_report: bool = Query(True, description="Lưu báo cáo so sánh vào ObsidianVault/01_BaoCao_KiemDinh/"),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """So sánh đối chiếu toàn diện 2 phiên in (Session Diff & Benchmark Engine)."""
    json_path = vault._resolve_safe_path("nhat_ky_in.json")
    if not json_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có dữ liệu nhat_ky_in.json")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])

    base_s = next((s for s in sessions if str(s.get("sessionId")) == base_id), None)
    target_s = next((s for s in sessions if str(s.get("sessionId")) == target_id), None)

    if not base_s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy phiên gốc #{base_id}")
    if not target_s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy phiên mục tiêu #{target_id}")

    from backend.src.application.session_comparator import compare_sessions
    res = compare_sessions(base_s, target_s)

    if save_report:
        vault.save_comparison_report(res)

    return JSONResponse(content=res, status_code=status.HTTP_200_OK)


@router.get(
    "/api/v1/sessions/compare/markdown",
    status_code=status.HTTP_200_OK,
)
async def compare_two_sessions_markdown(
    base_id: str = Query(..., description="Mã phiên gốc ban đầu"),
    target_id: str = Query(..., description="Mã phiên mục tiêu đối chiếu"),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Trả về nội dung Markdown thuần của báo cáo đối chiếu giữa 2 phiên."""
    json_path = vault._resolve_safe_path("nhat_ky_in.json")
    if not json_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có dữ liệu nhat_ky_in.json")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])

    base_s = next((s for s in sessions if str(s.get("sessionId")) == base_id), None)
    target_s = next((s for s in sessions if str(s.get("sessionId")) == target_id), None)

    if not base_s or not target_s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy đủ 2 phiên để so sánh")

    from backend.src.application.session_comparator import compare_sessions
    res = compare_sessions(base_s, target_s)
    return PlainTextResponse(res["markdown"], media_type="text/markdown")


from pydantic import BaseModel, Field
from backend.src.domain.gcode_inspector import GCodeInspector, GCodeInspectionReport


class GCodeInspectRequest(BaseModel):
    gcode_content: str = Field(..., description="Nội dung G-code thô cần phân tích")
    material: str = Field(default="PLA", description="Loại vật liệu in (PLA, PETG, ABS, TPU)")
    filament_diameter: float = Field(default=1.75, description="Đường kính sợi nhựa tính theo mm")
    density_g_cm3: float = Field(default=1.24, description="Khối lượng riêng vật liệu g/cm3")


@router.post(
    "/api/v1/slicer/gcode/inspect",
    response_model=GCodeInspectionReport,
    status_code=status.HTTP_200_OK,
)
async def inspect_gcode(payload: GCodeInspectRequest):
    """
    Phân tích chuyên sâu tệp G-Code:
    - Bóc tách số lớp (Layers), chiều cao từng tầng, độ cao tổng thể mô hình.
    - Tính toán chính xác thời gian in thực tế theo gia tốc và quãng đường chạy.
    - Đo lường khối lượng nhựa tiêu hao thực tế (E length -> grams).
    - Cảnh báo các nguy cơ va quẹt (di chuyển không nhấc đầu Z-Hop) và xung đột nhiệt độ.
    """
    if not payload.gcode_content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nội dung mã lệnh G-code không được để trống.",
        )

    return GCodeInspector.inspect(
        gcode_content=payload.gcode_content,
        material=payload.material,
        filament_diameter=payload.filament_diameter,
        density_g_cm3=payload.density_g_cm3,
    )


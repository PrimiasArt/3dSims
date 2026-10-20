"""
Physics Sanity Engine, AI Defect Prediction, and Smart Auto-Tuner Routers.
"""
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from backend.src.application.physics_sanity_check import PhysicsSanityCheckUseCase
from backend.src.domain.defect_predictor import DefectPredictor
from backend.src.domain.auto_tuner import AutoTuner
from backend.src.presentation.dependencies import get_physics_use_case
from backend.src.presentation.schemas import (
    PhysicsSanityCheckRequest,
    PhysicsSanityCheckResponse,
    PhysicsIssueSchema,
    DefectPredictionRequest,
    AutoTuneRequest,
)

router = APIRouter(tags=["Physics & AI Defect Engine"])


@router.post(
    "/api/v1/physics/sanity-check",
    response_model=PhysicsSanityCheckResponse,
    status_code=status.HTTP_200_OK,
)
async def run_physics_sanity_check(
    payload: PhysicsSanityCheckRequest,
    physics_use_case: PhysicsSanityCheckUseCase = Depends(get_physics_use_case),
):
    """
    Kiểm tra tính hợp lý vật lý tiền in (Deterministic Physics Engine).
    Đánh giá giới hạn lưu lượng thể tích đùn, nguy cơ co ngót warping, làm nguội tách lớp,
    đổ sập góc nghiêng (overhang) và toàn vẹn cơ học.
    """
    result = physics_use_case.execute(profile=payload.profile, session_id=payload.session_id)
    return PhysicsSanityCheckResponse(
        qc_risk_score=result.qc_risk_score,
        qc_health_score=result.qc_health_score,
        status=result.status,
        status_label=result.status_label,
        material=result.material,
        max_volumetric_flow_rate=result.max_volumetric_flow_rate,
        estimated_volumetric_flow_rate=result.estimated_volumetric_flow_rate,
        flow_headroom_percent=result.flow_headroom_percent,
        issues=[PhysicsIssueSchema(**i.to_dict()) for i in result.issues],
        passed_checks=result.passed_checks,
        summary=result.summary,
    )


@router.post(
    "/api/v1/physics/defect-prediction",
    status_code=status.HTTP_200_OK,
)
async def predict_print_defects(payload: DefectPredictionRequest):
    """Dự đoán rủi ro lỗi in (Warping, Stringing, Layer Shift, Heat Creep) theo loại máy in và vật liệu."""
    report = DefectPredictor.predict(
        profile=payload.profile,
        printer_id=payload.printer_id,
    )
    return JSONResponse(
        content=report.model_dump(),
        status_code=status.HTTP_200_OK,
    )


@router.post(
    "/api/v1/physics/auto-tune",
    status_code=status.HTTP_200_OK,
)
async def auto_tune_parameters(payload: AutoTuneRequest):
    """Tự động tinh chỉnh và tối ưu hóa bộ thông số in (Auto-Tuner) để triệt tiêu nguy cơ lỗi."""
    result = AutoTuner.tune_profile(
        profile=payload.profile,
        printer_id=payload.printer_id,
    )
    return JSONResponse(
        content=result.model_dump(),
        status_code=status.HTTP_200_OK,
    )

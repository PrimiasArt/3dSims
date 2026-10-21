"""
QC Defect Analytics & Historical Benchmarks Routers.
Provides production KPIs, defect Pareto analysis, material success rates, and parameter churn trends.
"""
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from backend.src.domain.protocols import VaultStorageProtocol, TelemetryRepositoryProtocol
from backend.src.application.analytics_service import QCAnalyticsService
from backend.src.presentation.dependencies import get_vault, get_repo
from backend.src.presentation.schemas import AnalyticsOverviewResponse, AnalyticsTrendsResponse

router = APIRouter(tags=["QC Analytics & Benchmarking"])


@router.get(
    "/api/v1/analytics/overview",
    response_model=AnalyticsOverviewResponse,
    status_code=status.HTTP_200_OK,
)
async def get_analytics_overview(
    vault: VaultStorageProtocol = Depends(get_vault),
    repo: TelemetryRepositoryProtocol = Depends(get_repo),
):
    """
    Truy xuất chỉ số KPI tổng thể: tỷ lệ thành công, thống kê theo từng vật liệu,
    phân tích Pareto các nguyên nhân lỗi in, và danh sách các mốc thời gian in gần nhất.
    """
    res = QCAnalyticsService.get_overview(vault=vault, repo=repo)
    return JSONResponse(content=res, status_code=status.HTTP_200_OK)


@router.get(
    "/api/v1/analytics/trends",
    response_model=AnalyticsTrendsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_analytics_trends(
    vault: VaultStorageProtocol = Depends(get_vault),
    repo: TelemetryRepositoryProtocol = Depends(get_repo),
):
    """
    Truy xuất chuỗi thời gian biến động các thông số (QC score, tốc độ, nhiệt độ bàn, độ dày lớp)
    và bảng xếp hạng các thông số bị người vận hành do dự thay đổi nhiều nhất (Hesitation Churn).
    """
    res = QCAnalyticsService.get_trends(vault=vault, repo=repo)
    return JSONResponse(content=res, status_code=status.HTTP_200_OK)


@router.get(
    "/api/v1/analytics/defects",
    status_code=status.HTTP_200_OK,
)
async def get_defect_analysis(
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """
    Phân tích chuyên sâu tần suất xuất hiện các loại lỗi (Warping, Stringing, Layer Shift, Clog)
    kèm tỷ lệ phần trăm tích luỹ và hướng dẫn xử lý kỹ thuật tương ứng.
    """
    overview = QCAnalyticsService.get_overview(vault=vault)
    return JSONResponse(
        content={
            "status": "success",
            "total_defects_logged": overview.get("failed_count", 0),
            "defect_pareto": overview.get("defect_pareto", []),
            "materials_risk_matrix": overview.get("materials_matrix", {}),
        },
        status_code=status.HTTP_200_OK,
    )

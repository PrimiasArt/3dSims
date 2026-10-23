"""
Statistical Process Control (SPC) & Batch Quality Auditing Routers.
Exposes endpoints for multi-session batch verification, Shewhart control charts,
Process Capability (Cp/Cpk), and automated process anomaly detection.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from backend.src.domain.protocols import VaultStorageProtocol
from backend.src.application.batch_qc_service import BatchQCService
from backend.src.presentation.dependencies import get_vault
from backend.src.presentation.schemas import (
    BatchQCAuditRequest,
    BatchQCAuditResponse,
    SPCControlChartResponse,
    AnomalyDetectionResponse,
)

router = APIRouter(tags=["SPC & Batch Quality Control"])


@router.post(
    "/api/v1/analytics/batch-audit",
    response_model=BatchQCAuditResponse,
    status_code=status.HTTP_200_OK,
)
async def run_batch_qc_audit(
    payload: Optional[BatchQCAuditRequest] = None,
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """
    Thẩm định chất lượng hàng loạt (Batch QC Audit) cho danh sách phiên in.
    Nếu không truyền danh sách sessions, hệ thống sẽ tự động quét toàn bộ kho nhat_ky_in.json.
    """
    sessions = payload.sessions if (payload and payload.sessions) else BatchQCService.load_vault_sessions(vault)
    printer_id = payload.printer_id if payload else None

    report = BatchQCService.audit_batch(sessions=sessions, printer_id=printer_id)
    return JSONResponse(content=report.model_dump(), status_code=status.HTTP_200_OK)


@router.get(
    "/api/v1/analytics/spc-control-chart",
    response_model=SPCControlChartResponse,
    status_code=status.HTTP_200_OK,
)
async def get_spc_control_chart(
    metric: str = Query(default="qc_score", description="Thống kê: qc_score, nozzle_temp, bed_temp, volumetric_flow"),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """
    Sinh biểu đồ kiểm soát Shewhart (UCL, CL, LCL) và chuỗi dữ liệu lịch sử theo từng phiên in.
    """
    sessions = BatchQCService.load_vault_sessions(vault)
    data = BatchQCService.get_control_chart_timeseries(sessions=sessions, metric_key=metric)
    return JSONResponse(content=data, status_code=status.HTTP_200_OK)


@router.get(
    "/api/v1/analytics/anomalies",
    response_model=AnomalyDetectionResponse,
    status_code=status.HTTP_200_OK,
)
async def get_process_anomalies(
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """
    Phát hiện các ca in dị thường (Outliers vượt ngưỡng Z-Score > 2.5 hoặc dung sai vật lý).
    """
    sessions = BatchQCService.load_vault_sessions(vault)
    report = BatchQCService.audit_batch(sessions=sessions)
    anomalies = [a.model_dump() for a in report.detected_anomalies]
    return JSONResponse(
        content={
            "total_anomalies": len(anomalies),
            "anomalies": anomalies,
        },
        status_code=status.HTTP_200_OK,
    )
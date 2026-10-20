"""
Telemetry Ingestion, Parameter Inspection, and Realtime Telemetry Streaming Routers.
Supports WebSocket multiplexing with room subscriptions and SSE streams.
"""
import json
import asyncio
import random
from typing import Optional
from fastapi import APIRouter, Depends, Path, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import JSONResponse, StreamingResponse
from backend.src.application.dtos import RecordTelemetryEventInput
from backend.src.application.use_cases import RecordTelemetryEventUseCase, CalculateParameterChurnUseCase
from backend.src.application.physics_sanity_check import PhysicsSanityCheckUseCase
from backend.src.domain.protocols import TelemetryRepositoryProtocol, TimeProviderProtocol, VaultStorageProtocol
from backend.src.presentation.dependencies import (
    get_repo,
    get_vault,
    get_time_provider,
    get_churn_calculator,
    get_record_use_case,
    get_physics_use_case,
    get_stream_manager,
    TelemetryStreamManager,
)
from backend.src.presentation.schemas import TelemetryEventRequest, TelemetryEventResponse

router = APIRouter(tags=["Telemetry"])


@router.post(
    "/api/v1/telemetry",
    response_model=TelemetryEventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_telemetry(
    payload: TelemetryEventRequest,
    record_use_case: RecordTelemetryEventUseCase = Depends(get_record_use_case),
    stream_mgr: TelemetryStreamManager = Depends(get_stream_manager),
    time_provider: TimeProviderProtocol = Depends(get_time_provider),
):
    """Ghi nhận một sự kiện telemetry vào bộ đệm cơ sở dữ liệu SQLite."""
    input_dto = RecordTelemetryEventInput(
        session_id=payload.session_id,
        event_type=payload.event_type,
        parameter_name=payload.parameter_name,
        old_value=payload.old_value,
        new_value=payload.new_value,
        metadata=payload.metadata,
    )
    result = record_use_case.execute(input_dto)

    # Broadcast event to room subscribers
    room = f"session:{payload.session_id}"
    await stream_mgr.broadcast(
        message={
            "event": "TELEMETRY_RECORDED",
            "session_id": payload.session_id,
            "event_type": payload.event_type,
            "parameter_name": payload.parameter_name,
            "new_value": payload.new_value,
            "recorded_at": result.recorded_at.isoformat(),
        },
        room=room,
    )

    return TelemetryEventResponse(
        event_id=result.event_id,
        session_id=result.session_id,
        recorded_at=result.recorded_at.isoformat(),
    )


@router.get(
    "/api/v1/inspect-parameters",
    status_code=status.HTTP_200_OK,
    tags=["Parameter Inspection"],
)
async def inspect_parameters():
    """Truy xuất danh mục toàn bộ các tham số có thể thay đổi của app và bảng ánh xạ report."""
    from backend.src.infrastructure.minimalist_formatter import APP_CHANGEABLE_PARAMETERS
    return JSONResponse(
        content={
            "status": "success",
            "total_parameters": len(APP_CHANGEABLE_PARAMETERS),
            "parameters": APP_CHANGEABLE_PARAMETERS,
            "locked_report_targets": [p for p in APP_CHANGEABLE_PARAMETERS if p["is_report_target"]],
        },
        status_code=status.HTTP_200_OK,
    )


@router.get(
    "/api/v1/sessions/{session_id:path}/report-params",
    status_code=status.HTTP_200_OK,
    tags=["Parameter Inspection"],
)
async def get_session_report_params(
    session_id: str = Path(..., min_length=1),
    repo: TelemetryRepositoryProtocol = Depends(get_repo),
    vault: VaultStorageProtocol = Depends(get_vault),
    churn_calc: CalculateParameterChurnUseCase = Depends(get_churn_calculator),
    physics_use_case: PhysicsSanityCheckUseCase = Depends(get_physics_use_case),
):
    """Truy xuất chính xác các thông số cần report từ phiên in hiện tại (Live Query)."""
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        from backend.src.domain.exceptions import PathTraversalSecurityError
        raise PathTraversalSecurityError(session_id)

    events = repo.get_events_by_session(session_id)
    metrics = churn_calc.execute(events) if events else []

    from backend.src.infrastructure.minimalist_formatter import (
        build_session_entry,
        extract_session_report_parameters,
        render_markdown_log,
    )

    extracted = extract_session_report_parameters(metrics)
    preview_session = build_session_entry(
        phien_index=1,
        metrics=metrics,
        nguoi_dung="Nguyễn Văn A",
        hanh_dong="Mô phỏng (50x) -> Bắt đầu in",
    )
    preview_markdown = render_markdown_log([preview_session])

    physics_result = physics_use_case.execute(profile=extracted, session_id=session_id)
    profile_3d_md = vault.render_3d_profile_from_dict(preview_session)

    return JSONResponse(
        content={
            "session_id": session_id,
            "total_events": len(events),
            "extracted_report": extracted,
            "preview_entry_json": preview_session,
            "preview_markdown": preview_markdown,
            "profile_3d": {
                "profile_id": f"PROFILE_{session_id}",
                "model_name": preview_session.get("metadata", {}).get("modelName", "Mô hình 3D CoreXY"),
                "material": preview_session.get("metadata", {}).get("material", "PLA"),
                "status": preview_session.get("status", "COMPLETED"),
                "printability_score": preview_session.get("metadata", {}).get("printabilityScore", 95),
                "layer_height_mm": preview_session.get("slicer", {}).get("layerHeightMm", 0.20),
                "infill_percent": preview_session.get("slicer", {}).get("infillPercent", 20),
                "bed_temp_c": preview_session.get("hardware", {}).get("tempsE", {}).get("bedTempC", 60),
                "nozzle_temp_c": preview_session.get("hardware", {}).get("tempsE", {}).get("nozzleTempC", 210),
                "speed_mms": preview_session.get("hardware", {}).get("speedF", {}).get("defaultMmS", 60),
                "markdown_path": f"01_Profiles_In3D/Profile_In3D_{session_id}.md",
            },
            "profile_3d_markdown": profile_3d_md,
            "physics_sanity_check": physics_result.to_dict(),
        },
        status_code=status.HTTP_200_OK,
    )


@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    stream_mgr = get_stream_manager()
    time_provider = get_time_provider()
    """
    WebSocket endpoint hỗ trợ room multiplexing và lệnh 2 chiều (PAUSE, RESUME, SPEED, EMERGENCY_STOP).
    Clients có thể gửi tin nhắn dạng:
      {"action": "subscribe", "room": "session:PHIEU_01"}
      {"action": "command", "type": "PAUSE", "target": "session:PHIEU_01"}
      {"action": "ping"}
    """
    await stream_mgr.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            iso_now = time_provider.iso_utc_now()
            response = await stream_mgr.handle_client_message(websocket, data, iso_now)
            await websocket.send_json(response)
    except WebSocketDisconnect:
        stream_mgr.disconnect(websocket)
    except Exception:
        stream_mgr.disconnect(websocket)


@router.get(
    "/api/v1/telemetry/stream",
    tags=["Telemetry Stream"],
)
async def sse_telemetry_stream(
    session_id: Optional[str] = Query(default=None, description="Mã phiên in"),
    target_temp: float = Query(default=215.0, description="Nhiệt độ nozzle mục tiêu"),
    bed_temp: float = Query(default=60.0, description="Nhiệt độ bàn mục tiêu"),
    time_provider: TimeProviderProtocol = Depends(get_time_provider),
):
    """Server-Sent Events (SSE) stream dữ liệu cảm biến đầu in theo thời gian thực."""
    async def event_generator():
        layer = 1
        z_height = 0.2
        progress = 0.0
        while True:
            cur_nozzle = round(target_temp + random.uniform(-0.6, 0.6), 2)
            cur_bed = round(bed_temp + random.uniform(-0.3, 0.3), 2)
            cur_fan = random.randint(2450, 2550)
            cur_flow = round(12.5 + random.uniform(-1.2, 1.2), 2)
            progress = min(100.0, round(progress + 0.5, 1))
            if progress >= 100.0:
                progress = 0.0
                layer = 1
            elif random.random() < 0.15:
                layer += 1
                z_height = round(z_height + 0.2, 2)

            frame = {
                "session_id": session_id or "LIVE_SIM",
                "timestamp": time_provider.iso_utc_now(),
                "nozzle_temp": cur_nozzle,
                "target_nozzle_temp": target_temp,
                "bed_temp": cur_bed,
                "target_bed_temp": bed_temp,
                "fan_rpm": cur_fan,
                "flow_rate_mm3s": cur_flow,
                "current_layer": layer,
                "z_height_mm": z_height,
                "progress_percent": progress,
                "status": "PRINTING" if progress < 100 else "COMPLETED",
            }
            yield f"data: {json.dumps(frame)}\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

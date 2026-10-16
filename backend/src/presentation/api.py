"""
FastAPI Presentation Layer for Telemetry Ingestion & Audit Engine.
Uses Pydantic v2 schemas and RFC 9457 error handlers.
"""
from typing import Optional
from fastapi import FastAPI, Path, status
from fastapi.responses import JSONResponse

from backend.src.application.dtos import GenerateDualAuditInput, RecordTelemetryEventInput
from backend.src.application.use_cases import (
    CalculateParameterChurnUseCase,
    GenerateDualAuditUseCase,
    RecordTelemetryEventUseCase,
)
from backend.src.domain.exceptions import SessionNotFoundError
from backend.src.domain.protocols import (
    TelemetryRepositoryProtocol,
    TimeProviderProtocol,
    VaultStorageProtocol,
)
from backend.src.infrastructure.obsidian_vault import ObsidianVaultAdapter
from backend.src.infrastructure.sqlite_repo import SQLiteTelemetryRepository
from backend.src.infrastructure.time_provider import SystemTimeProvider
from backend.src.presentation.error_handlers import register_rfc9457_error_handlers
from fastapi.middleware.cors import CORSMiddleware
from backend.src.infrastructure.config import settings
from backend.src.infrastructure.gemini_ai import GeminiAIService
from backend.src.presentation.schemas import (
    AuditGenerateRequest,
    AuditGenerateResponse,
    TelemetryEventRequest,
    TelemetryEventResponse,
)


def create_app(
    repo: Optional[TelemetryRepositoryProtocol] = None,
    vault: Optional[VaultStorageProtocol] = None,
    time_provider: Optional[TimeProviderProtocol] = None,
    ai_service: Optional[object] = None,
) -> FastAPI:
    """Application factory for FastAPI Telemetry & Audit Service."""
    active_repo = repo or SQLiteTelemetryRepository(db_path=settings.db_path)
    active_vault = vault or ObsidianVaultAdapter(vault_root=settings.vault_root, json_root=settings.json_root)
    active_time = time_provider or SystemTimeProvider()
    active_ai = ai_service or GeminiAIService()
    churn_calc = CalculateParameterChurnUseCase()

    record_use_case = RecordTelemetryEventUseCase(repo=active_repo, time_provider=active_time)
    audit_use_case = GenerateDualAuditUseCase(
        repo=active_repo,
        vault=active_vault,
        time_provider=active_time,
        churn_calculator=churn_calc,
        ai_service=active_ai,
    )

    app = FastAPI(
        title="3D PrintSim Pro - Telemetry & Audit Engine",
        version="2026.1",
        description="Clean Architecture Telemetry Ingestion & Obsidian Vault Dual-Output Audit Service",
    )

    # CORS configuration for Frontend Web App (Vite port 3001 & EM 3D port 5173)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_rfc9457_error_handlers(app)

    @app.get("/health", tags=["System"])
    async def health_check():
        return {"status": "healthy", "service": "3D PrintSim Pro Telemetry Engine", "version": "2026.1"}

    @app.post(
        "/api/v1/telemetry",
        response_model=TelemetryEventResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Telemetry"],
    )
    async def record_telemetry(payload: TelemetryEventRequest):
        input_dto = RecordTelemetryEventInput(
            session_id=payload.session_id,
            event_type=payload.event_type,
            parameter_name=payload.parameter_name,
            old_value=payload.old_value,
            new_value=payload.new_value,
            metadata=payload.metadata,
        )
        result = record_use_case.execute(input_dto)
        return TelemetryEventResponse(
            event_id=result.event_id,
            session_id=result.session_id,
            recorded_at=result.recorded_at.isoformat(),
        )

    @app.post(
        "/api/v1/sessions/{session_id:path}/audit",
        response_model=AuditGenerateResponse,
        status_code=status.HTTP_200_OK,
        tags=["Audit"],
    )
    async def generate_audit(
        session_id: str = Path(..., min_length=1),
        payload: Optional[AuditGenerateRequest] = None,
    ):
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)
        input_dto = GenerateDualAuditInput(
            session_id=session_id,
            profile_snapshot=payload.profile if payload else None,
        )
        result = audit_use_case.execute(input_dto)
        return AuditGenerateResponse(
            session_id=result.session_id,
            markdown_path=result.markdown_path,
            json_path=result.json_path,
            high_churn_parameters=result.high_churn_parameters,
            total_events=result.total_events,
            created_at=result.created_at.isoformat(),
        )

    @app.get(
        "/api/v1/sessions/{session_id:path}/audit",
        status_code=status.HTTP_200_OK,
        tags=["Audit"],
    )
    async def get_audit(session_id: str = Path(..., min_length=1)):
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)
        audit_json = active_vault.get_audit_json(session_id)
        if not audit_json:
            raise SessionNotFoundError(session_id)
        return JSONResponse(content=audit_json, status_code=status.HTTP_200_OK)

    @app.get(
        "/api/v1/nhat-ky",
        status_code=status.HTTP_200_OK,
        tags=["Locked Schema Logs"],
    )
    async def get_nhat_ky_json():
        """Returns the minimalist nhat_ky_in.json array according to the locked schema contract."""
        json_path = active_vault._resolve_safe_path("nhat_ky_in.json")
        if not json_path.exists():
            return JSONResponse(content=[], status_code=status.HTTP_200_OK)
        import json
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return JSONResponse(content=data, status_code=status.HTTP_200_OK)

    @app.get(
        "/api/v1/nhat-ky/markdown",
        status_code=status.HTTP_200_OK,
        tags=["Locked Schema Logs"],
    )
    async def get_nhat_ky_markdown():
        """Returns the minimalist nhat_ky_in.md content according to the locked schema contract."""
        from fastapi.responses import PlainTextResponse
        md_path = active_vault._resolve_safe_path("02_NhatKy_In/nhat_ky_in.md")
        if not md_path.exists():
            md_path = active_vault._resolve_safe_path("nhat_ky_in.md")
        if not md_path.exists():
            return PlainTextResponse("", status_code=status.HTTP_200_OK)
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()
        return PlainTextResponse(content, status_code=status.HTTP_200_OK)

    @app.get(
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

    @app.get(
        "/api/v1/sessions/{session_id:path}/report-params",
        status_code=status.HTTP_200_OK,
        tags=["Parameter Inspection"],
    )
    async def get_session_report_params(session_id: str = Path(..., min_length=1)):
        """Truy xuất chính xác các thông số cần report từ phiên in hiện tại (Live Query)."""
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)

        events = active_repo.get_events_by_session(session_id)
        if not events:
            # Session exists or empty
            metrics = []
        else:
            metrics = churn_calc.execute(events)

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

        return JSONResponse(
            content={
                "session_id": session_id,
                "total_events": len(events),
                "extracted_report": extracted,
                "preview_entry_json": preview_session,
                "preview_markdown": preview_markdown,
            },
            status_code=status.HTTP_200_OK,
        )

    return app


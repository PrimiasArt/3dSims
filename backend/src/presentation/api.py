"""
FastAPI Presentation Layer for Telemetry Ingestion & Audit Engine.
Uses Modular APIRouters, Clean Architecture Dependency Injection,
FastAPI Lifespan management, Pydantic v2 schemas, and RFC 9457 error handlers.
"""
import logging
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.src.domain.protocols import (
    TelemetryRepositoryProtocol,
    TimeProviderProtocol,
    VaultStorageProtocol,
)
from backend.src.infrastructure.config import settings
from backend.src.presentation.dependencies import configure_container
from backend.src.presentation.error_handlers import register_rfc9457_error_handlers
from backend.src.presentation.routers import (
    system_router,
    telemetry_router,
    audit_router,
    slicer_router,
    physics_router,
    printers_router,
    supabase_hub_router,
    qc_certificate_router,
    projects_router,
    analytics_router,
    inventory_router,
)

logger = logging.getLogger("3d_sim.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan Context Manager.
    Handles startup resource initialization and graceful shutdown cleanup.
    """
    logger.info("3D PrintSim Pro Engine starting up...")
    logger.info(f"Target Vault Root: {settings.vault_root}")
    logger.info(f"SQLite DB Path: {settings.db_path}")

    # Startup hooks (e.g. check directories, verify connections)
    yield

    # Shutdown hooks
    logger.info("3D PrintSim Pro Engine shutting down cleanly.")


def create_app(
    repo: Optional[TelemetryRepositoryProtocol] = None,
    vault: Optional[VaultStorageProtocol] = None,
    time_provider: Optional[TimeProviderProtocol] = None,
    ai_service: Optional[object] = None,
) -> FastAPI:
    """
    Application factory for FastAPI Telemetry & Audit Service.
    Configures container dependencies and mounts modular APIRouters.
    """
    # 1. Configure container singletons if custom overrides passed
    configure_container(
        repo=repo,
        vault=vault,
        time_provider=time_provider,
        ai_service=ai_service,
    )

    # 2. Instantiate FastAPI app with metadata and lifespan
    app = FastAPI(
        title="3D PrintSim Pro - Telemetry & Audit Engine",
        version="2026.1",
        description="Clean Architecture Modular Telemetry Ingestion, Physics Sanity & Dual-Output Audit Service",
        lifespan=lifespan,
    )

    # 3. Configure CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 4. Register RFC 9457 Problem Details error handlers
    register_rfc9457_error_handlers(app)

    # 5. Include modular APIRouters
    app.include_router(system_router)
    app.include_router(telemetry_router)
    app.include_router(audit_router)
    app.include_router(slicer_router)
    app.include_router(physics_router)
    app.include_router(printers_router)
    app.include_router(supabase_hub_router)
    app.include_router(qc_certificate_router)
    app.include_router(projects_router)
    app.include_router(analytics_router)
    app.include_router(inventory_router)

    return app

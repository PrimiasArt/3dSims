"""
Package presenting modular APIRouters for Clean Architecture Presentation Layer.
"""
from backend.src.presentation.routers.system import router as system_router
from backend.src.presentation.routers.telemetry import router as telemetry_router
from backend.src.presentation.routers.audit import router as audit_router
from backend.src.presentation.routers.slicer import router as slicer_router
from backend.src.presentation.routers.physics import router as physics_router
from backend.src.presentation.routers.printers import router as printers_router
from backend.src.presentation.routers.supabase_hub import router as supabase_hub_router
from backend.src.presentation.routers.qc_certificate import router as qc_certificate_router
from backend.src.presentation.routers.projects import router as projects_router
from backend.src.presentation.routers.analytics import router as analytics_router

__all__ = [
    "system_router",
    "telemetry_router",
    "audit_router",
    "slicer_router",
    "physics_router",
    "printers_router",
    "supabase_hub_router",
    "qc_certificate_router",
    "projects_router",
    "analytics_router",
]

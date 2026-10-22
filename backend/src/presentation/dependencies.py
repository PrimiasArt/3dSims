"""
Dependency Injection Providers for FastAPI Presentation Layer.
Allows easy override for unit tests, mocked adapters, or custom storage.
"""
from typing import Optional
from backend.src.domain.protocols import (
    TelemetryRepositoryProtocol,
    TimeProviderProtocol,
    VaultStorageProtocol,
)
from backend.src.infrastructure.sqlite_repo import SQLiteTelemetryRepository
from backend.src.infrastructure.obsidian_vault import ObsidianVaultAdapter
from backend.src.infrastructure.time_provider import SystemTimeProvider
from backend.src.infrastructure.gemini_ai import GeminiAIService
from backend.src.infrastructure.config import settings
from backend.src.infrastructure.job_manager import job_manager, BackgroundJobManager
from backend.src.infrastructure.telemetry_stream_manager import telemetry_stream_mgr, TelemetryStreamManager
from backend.src.infrastructure.spool_repository import SpoolInventoryRepository
from backend.src.application.use_cases import (
    CalculateParameterChurnUseCase,
    GenerateDualAuditUseCase,
    RecordTelemetryEventUseCase,
)
from backend.src.application.physics_sanity_check import PhysicsSanityCheckUseCase


class Container:
    """Holds active singletons for presentation layer dependencies."""
    repo: TelemetryRepositoryProtocol = SQLiteTelemetryRepository(db_path=settings.db_path)
    vault: VaultStorageProtocol = ObsidianVaultAdapter(vault_root=settings.vault_root, json_root=settings.json_root)
    time_provider: TimeProviderProtocol = SystemTimeProvider()
    ai_service: object = GeminiAIService()
    churn_calc: CalculateParameterChurnUseCase = CalculateParameterChurnUseCase()
    job_mgr: BackgroundJobManager = job_manager
    stream_mgr: TelemetryStreamManager = telemetry_stream_mgr
    spool_repo: SpoolInventoryRepository = SpoolInventoryRepository(json_dir=settings.json_root)


def configure_container(
    repo: Optional[TelemetryRepositoryProtocol] = None,
    vault: Optional[VaultStorageProtocol] = None,
    time_provider: Optional[TimeProviderProtocol] = None,
    ai_service: Optional[object] = None,
) -> None:
    """Reconfigures active container dependencies."""
    if repo is not None:
        Container.repo = repo
    if vault is not None:
        Container.vault = vault
    if time_provider is not None:
        Container.time_provider = time_provider
    if ai_service is not None:
        Container.ai_service = ai_service


def get_repo() -> TelemetryRepositoryProtocol:
    return Container.repo


def get_vault() -> VaultStorageProtocol:
    return Container.vault


def get_time_provider() -> TimeProviderProtocol:
    return Container.time_provider


def get_ai_service() -> object:
    return Container.ai_service


def get_churn_calculator() -> CalculateParameterChurnUseCase:
    return Container.churn_calc


def get_record_use_case() -> RecordTelemetryEventUseCase:
    return RecordTelemetryEventUseCase(repo=Container.repo, time_provider=Container.time_provider)


def get_audit_use_case() -> GenerateDualAuditUseCase:
    return GenerateDualAuditUseCase(
        repo=Container.repo,
        vault=Container.vault,
        time_provider=Container.time_provider,
        churn_calculator=Container.churn_calc,
        ai_service=Container.ai_service,
    )


def get_physics_use_case() -> PhysicsSanityCheckUseCase:
    return PhysicsSanityCheckUseCase(repo=Container.repo, vault=Container.vault)


def get_job_manager() -> BackgroundJobManager:
    return Container.job_mgr


def get_stream_manager() -> TelemetryStreamManager:
    return Container.stream_mgr


def get_spool_repo() -> SpoolInventoryRepository:
    return Container.spool_repo

"""Domain layer package."""
from backend.src.domain.entities import (
    TelemetryEvent,
    ParameterMetric,
    AuditReport,
    Session,
)
from backend.src.domain.exceptions import (
    DomainException,
    SessionNotFoundError,
    PathTraversalSecurityError,
    InvalidTelemetryPayloadError,
)
from backend.src.domain.protocols import (
    TelemetryRepositoryProtocol,
    VaultStorageProtocol,
    TimeProviderProtocol,
    AIServiceProtocol,
)
from backend.src.domain.physics_engine import (
    PhysicsSanityEngine,
    PhysicsIssue,
    PhysicsSanityResult,
    PhysicsIssueSeverity,
    PhysicsIssueCategory,
)
from backend.src.domain.defect_predictor import DefectPredictor, DefectPredictionReport
from backend.src.domain.auto_tuner import AutoTuner, AutoTuningResult
from backend.src.domain.printer_profiles import (
    PrinterHardwareSpecs,
    PRINTER_PROFILES_DATABASE,
    get_printer_profile,
    get_all_printer_profiles,
)

from backend.src.domain.spool_inventory import FilamentSpool, SpoolVerificationResult
from backend.src.domain.gcode_inspector import GCodeInspector, GCodeInspectionReport, LayerInspectionStats
from backend.src.domain.spc_engine import (
    ControlLimits,
    ProcessCapability,
    AnomalyRecord,
    BatchQCReport,
    SPCEngine,
)

__all__ = [
    "TelemetryEvent",
    "ParameterMetric",
    "AuditReport",
    "Session",
    "DomainException",
    "SessionNotFoundError",
    "PathTraversalSecurityError",
    "InvalidTelemetryPayloadError",
    "TelemetryRepositoryProtocol",
    "VaultStorageProtocol",
    "TimeProviderProtocol",
    "AIServiceProtocol",
    "PhysicsSanityEngine",
    "PhysicsIssue",
    "PhysicsSanityResult",
    "PhysicsIssueSeverity",
    "PhysicsIssueCategory",
    "DefectPredictor",
    "DefectPredictionReport",
    "AutoTuner",
    "AutoTuningResult",
    "PrinterHardwareSpecs",
    "PRINTER_PROFILES_DATABASE",
    "get_printer_profile",
    "get_all_printer_profiles",
    "FilamentSpool",
    "SpoolVerificationResult",
    "GCodeInspector",
    "GCodeInspectionReport",
    "LayerInspectionStats",
    "ControlLimits",
    "ProcessCapability",
    "AnomalyRecord",
    "BatchQCReport",
    "SPCEngine",
]


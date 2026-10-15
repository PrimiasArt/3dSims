"""
Application Data Transfer Objects (DTOs).
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class RecordTelemetryEventInput:
    session_id: str
    event_type: str
    parameter_name: str
    old_value: Any
    new_value: Any
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RecordTelemetryEventOutput:
    event_id: str
    session_id: str
    recorded_at: datetime


@dataclass(frozen=True)
class GenerateDualAuditInput:
    session_id: str
    model_name: Optional[str] = None


@dataclass(frozen=True)
class GenerateDualAuditOutput:
    session_id: str
    markdown_path: str
    json_path: str
    high_churn_parameters: List[str]
    total_events: int
    created_at: datetime

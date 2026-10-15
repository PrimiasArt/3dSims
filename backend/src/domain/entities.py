"""
Domain Entities and Value Objects for 3D PrintSim Telemetry & Audit Engine.
Strictly decoupled from frameworks.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class TelemetryEvent:
    """Immutable event representing a telemetry change or user interaction in the 3D simulator."""
    event_id: str
    session_id: str
    timestamp: datetime
    event_type: str
    parameter_name: str
    old_value: Any
    new_value: Any
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParameterMetric:
    """Tracks churn rate and mutation history for a specific slicer/simulator parameter."""
    parameter_name: str
    mutation_count: int
    initial_value: Any
    final_value: Any
    change_history: List[Any] = field(default_factory=list)

    @property
    def is_high_churn(self) -> bool:
        """Hesitation Churn: Flagged when a parameter is modified 3 or more times."""
        return self.mutation_count >= 3

    @property
    def churn_severity(self) -> str:
        return "HIGH_HESITATION" if self.is_high_churn else "NORMAL"


@dataclass
class AuditReport:
    """Represents the complete dual-output audit for a simulation session."""
    session_id: str
    created_at: datetime
    total_events: int
    high_churn_parameters: List[str]
    metrics: List[ParameterMetric]
    summary: str
    material: str = "PLA"
    ai_insight: Optional[str] = None


@dataclass
class Session:
    """Represents a slicing simulation session."""
    session_id: str
    created_at: datetime
    model_name: Optional[str] = None
    status: str = "ACTIVE"

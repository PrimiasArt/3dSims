"""
Pydantic v2 Schemas for Telemetry & Audit Presentation Layer.
Strict validation and model_dump/model_validate usage.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TelemetryEventRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    session_id: str = Field(..., min_length=1, description="Unique simulation session ID")
    event_type: str = Field(default="PARAMETER_CHANGE", min_length=1, description="Event classification")
    parameter_name: str = Field(..., min_length=1, description="Name of modified slicer parameter")
    old_value: Any = Field(default=None, description="Previous parameter value")
    new_value: Any = Field(default=None, description="New parameter value")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Contextual telemetry payload")


class TelemetryEventResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event_id: str
    session_id: str
    recorded_at: str


class AuditGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    profile: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Full snapshot of the current 3D simulator profile covering all 5 tabs and extrusion",
    )


class AuditGenerateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    session_id: str
    markdown_path: str
    json_path: str
    high_churn_parameters: List[str]
    total_events: int
    created_at: str


class ProblemDetails(BaseModel):
    """RFC 9457 Problem Details schema."""
    model_config = ConfigDict(extra="allow")

    type: str = "about:blank"
    title: str
    status: int
    detail: str
    instance: Optional[str] = None

"""
Domain Repository and Service Protocols (Interfaces).
Implemented using typing.Protocol for compile-time and runtime validation.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Protocol, Tuple, runtime_checkable
from backend.src.domain.entities import AuditReport, TelemetryEvent


@runtime_checkable
class TelemetryRepositoryProtocol(Protocol):
    """Protocol for persisting and retrieving telemetry events (e.g. SQLite buffer)."""

    def save_event(self, event: TelemetryEvent) -> None:
        """Persist a single telemetry event."""
        ...

    def get_events_by_session(self, session_id: str) -> List[TelemetryEvent]:
        """Retrieve all events belonging to a given session."""
        ...


@runtime_checkable
class VaultStorageProtocol(Protocol):
    """Protocol for persisting dual-output audits to an Obsidian Vault."""

    def save_dual_audit(self, report: AuditReport) -> Tuple[str, str]:
        """
        Atomically write both Markdown (.md) and Structured JSON (.json) files.
        Returns a tuple of (markdown_file_path, json_file_path).
        """
        ...

    def get_audit_json(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve the structured machine JSON audit for a given session."""
        ...


@runtime_checkable
class TimeProviderProtocol(Protocol):
    """Protocol for decoupled time acquisition (facilitates reproducible testing)."""

    def now_utc(self) -> datetime:
        """Return the current datetime in UTC timezone."""
        ...


@runtime_checkable
class AIServiceProtocol(Protocol):
    """Protocol for generating AI-driven diagnostic insights for parameter churn."""

    def generate_insight(
        self,
        session_id: str,
        high_churn_params: List[str],
        metrics: List[Any],
        material: str = "PLA",
    ) -> Optional[str]:
        """Analyzes hesitation patterns and returns actionable recommendations."""
        ...


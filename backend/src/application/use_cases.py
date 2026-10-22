"""
Application Use Cases for Telemetry Ingestion & Audit Engine.
Follows Clean Architecture strictly.
"""
import uuid
from typing import Any, Dict, List, Optional, Tuple

from backend.src.application.dtos import (
    GenerateDualAuditInput,
    GenerateDualAuditOutput,
    RecordTelemetryEventInput,
    RecordTelemetryEventOutput,
)
from backend.src.domain.entities import AuditReport, ParameterMetric, TelemetryEvent
from backend.src.domain.exceptions import (
    InvalidTelemetryPayloadError,
    SessionNotFoundError,
)
from backend.src.domain.protocols import (
    TelemetryRepositoryProtocol,
    TimeProviderProtocol,
    VaultStorageProtocol,
)


class RecordTelemetryEventUseCase:
    """Use Case: Ingest and record a single telemetry mutation event."""

    def __init__(self, repo: TelemetryRepositoryProtocol, time_provider: TimeProviderProtocol) -> None:
        self._repo = repo
        self._time_provider = time_provider

    def execute(self, input_dto: RecordTelemetryEventInput) -> RecordTelemetryEventOutput:
        if not input_dto.session_id or not input_dto.session_id.strip():
            raise InvalidTelemetryPayloadError("session_id must not be empty.")
        if not input_dto.parameter_name or not input_dto.parameter_name.strip():
            raise InvalidTelemetryPayloadError("parameter_name must not be empty.")
        if not input_dto.event_type or not input_dto.event_type.strip():
            raise InvalidTelemetryPayloadError("event_type must not be empty.")

        event_id = f"evt_{uuid.uuid4().hex}"
        recorded_at = self._time_provider.now_utc()

        event = TelemetryEvent(
            event_id=event_id,
            session_id=input_dto.session_id.strip(),
            timestamp=recorded_at,
            event_type=input_dto.event_type.strip(),
            parameter_name=input_dto.parameter_name.strip(),
            old_value=input_dto.old_value,
            new_value=input_dto.new_value,
            metadata=dict(input_dto.metadata or {}),
        )

        self._repo.save_event(event)

        return RecordTelemetryEventOutput(
            event_id=event_id,
            session_id=event.session_id,
            recorded_at=recorded_at,
        )


class CalculateParameterChurnUseCase:
    """Use Case: Computes mutation count per parameter, covers all 5 tabs (+ extrusion), and detects hesitation churn."""

    def execute(
        self,
        events: List[TelemetryEvent],
        profile_snapshot: Optional[Dict[str, Any]] = None,
    ) -> List[ParameterMetric]:
        from backend.src.infrastructure.formatters import ALL_PARAM_SPECS

        grouped: Dict[str, List[TelemetryEvent]] = {}
        for ev in events:
            grouped.setdefault(ev.parameter_name, []).append(ev)

        metrics: List[ParameterMetric] = []
        processed_keys = set()

        # 1. Iterate through all predefined parameter specs in order (covers all 5 tabs + extrusion)
        for param_name, spec in ALL_PARAM_SPECS.items():
            processed_keys.add(param_name)
            tab_name = spec.get("tab_name", "Cơ Bản")
            label = spec.get("label", param_name)
            unit = spec.get("unit", "")
            default_val = spec.get("default")

            if param_name in grouped:
                # Chronological mutation history
                sorted_events = sorted(grouped[param_name], key=lambda e: e.timestamp)
                mutation_count = len(sorted_events)
                initial_value = sorted_events[0].old_value
                final_value = sorted_events[-1].new_value
                history = [sorted_events[0].old_value]
                for e in sorted_events:
                    history.append(e.new_value)

                metric = ParameterMetric(
                    parameter_name=param_name,
                    mutation_count=mutation_count,
                    initial_value=initial_value,
                    final_value=final_value,
                    change_history=history,
                    tab_name=tab_name,
                    label=label,
                    unit=unit,
                )
            else:
                # Parameter was not mutated in this session; retrieve from profile snapshot or default
                current_val = default_val
                if profile_snapshot and param_name in profile_snapshot:
                    current_val = profile_snapshot[param_name]
                elif param_name == "preset" and profile_snapshot and "id" in profile_snapshot:
                    current_val = profile_snapshot["id"]

                metric = ParameterMetric(
                    parameter_name=param_name,
                    mutation_count=0,
                    initial_value=current_val,
                    final_value=current_val,
                    change_history=[current_val] if current_val is not None else [],
                    tab_name=tab_name,
                    label=label,
                    unit=unit,
                )
            metrics.append(metric)

        # 2. Append any custom parameters that were recorded but not in ALL_PARAM_SPECS
        for param_name, param_events in grouped.items():
            if param_name in processed_keys:
                continue
            sorted_events = sorted(param_events, key=lambda e: e.timestamp)
            mutation_count = len(sorted_events)
            initial_value = sorted_events[0].old_value
            final_value = sorted_events[-1].new_value
            history = [sorted_events[0].old_value]
            for e in sorted_events:
                history.append(e.new_value)

            metric = ParameterMetric(
                parameter_name=param_name,
                mutation_count=mutation_count,
                initial_value=initial_value,
                final_value=final_value,
                change_history=history,
                tab_name="Khác",
                label=param_name,
                unit="",
            )
            metrics.append(metric)

        return metrics


class GenerateDualAuditUseCase:
    """Use Case: Aggregates session telemetry into an Audit Report and outputs Dual Files (Obsidian MD + JSON)."""

    def __init__(
        self,
        repo: TelemetryRepositoryProtocol,
        vault: VaultStorageProtocol,
        time_provider: TimeProviderProtocol,
        churn_calculator: CalculateParameterChurnUseCase,
        ai_service: Optional[object] = None,
    ) -> None:
        self._repo = repo
        self._vault = vault
        self._time_provider = time_provider
        self._churn_calculator = churn_calculator
        self._ai_service = ai_service

    def execute(self, input_dto: GenerateDualAuditInput) -> GenerateDualAuditOutput:
        session_id = input_dto.session_id.strip() if input_dto.session_id else ""
        if not session_id:
            raise SessionNotFoundError("Empty session_id provided.")

        events = self._repo.get_events_by_session(session_id)
        if not events:
            raise SessionNotFoundError(session_id)

        metrics = self._churn_calculator.execute(events, input_dto.profile_snapshot)
        high_churn_params = [m.parameter_name for m in metrics if m.is_high_churn]

        # Extract material from profile snapshot or event metadata
        material = "PLA"
        if input_dto.profile_snapshot and "material" in input_dto.profile_snapshot:
            material = str(input_dto.profile_snapshot["material"])
        else:
            for ev in events:
                if ev.metadata and "material" in ev.metadata:
                    material = str(ev.metadata["material"])
                    break

        ai_insight = None
        if self._ai_service and hasattr(self._ai_service, "generate_insight"):
            ai_insight = self._ai_service.generate_insight(
                session_id=session_id,
                high_churn_params=high_churn_params,
                metrics=metrics,
                material=material,
            )

        created_at = self._time_provider.now_utc()
        summary = (
            f"Phiên {session_id} ghi nhận tổng cộng {len(events)} sự kiện. "
            f"Phát hiện {len(high_churn_params)} thông số có tần suất phân vân cao (>= 3 lần đổi): "
            f"{', '.join(high_churn_params) if high_churn_params else 'Không có'}."
        )

        report = AuditReport(
            session_id=session_id,
            created_at=created_at,
            total_events=len(events),
            high_churn_parameters=high_churn_params,
            metrics=metrics,
            summary=summary,
            material=material,
            ai_insight=ai_insight,
        )

        md_path, json_path = self._vault.save_dual_audit(report)

        return GenerateDualAuditOutput(
            session_id=session_id,
            markdown_path=md_path,
            json_path=json_path,
            high_churn_parameters=high_churn_params,
            total_events=len(events),
            created_at=created_at,
        )

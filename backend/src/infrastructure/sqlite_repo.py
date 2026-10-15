"""
SQLite Telemetry Repository with WAL (Write-Ahead Logging) mode.
Buffers high-frequency slicer telemetry events safely.
"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List

from backend.src.domain.entities import TelemetryEvent
from backend.src.domain.protocols import TelemetryRepositoryProtocol


class SQLiteTelemetryRepository(TelemetryRepositoryProtocol):
    """SQLite implementation of TelemetryRepositoryProtocol with WAL mode enabled."""

    def __init__(self, db_path: str = "telemetry_buffer.db") -> None:
        self._db_path = Path(db_path).resolve()
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path))
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for high-throughput concurrency
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        return conn

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS telemetry_events (
                    event_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    parameter_name TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT,
                    metadata TEXT
                );
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events (session_id);"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_events (timestamp);"
            )
            conn.commit()

    def get_journal_mode(self) -> str:
        """Returns the current SQLite journal mode."""
        with self._get_connection() as conn:
            cursor = conn.execute("PRAGMA journal_mode;")
            row = cursor.fetchone()
            return str(row[0]) if row else "unknown"

    def save_event(self, event: TelemetryEvent) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO telemetry_events (
                    event_id, session_id, timestamp, event_type, parameter_name, old_value, new_value, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    event.event_id,
                    event.session_id,
                    event.timestamp.isoformat(),
                    event.event_type,
                    event.parameter_name,
                    json.dumps(event.old_value),
                    json.dumps(event.new_value),
                    json.dumps(event.metadata),
                ),
            )
            conn.commit()

    def get_events_by_session(self, session_id: str) -> List[TelemetryEvent]:
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT event_id, session_id, timestamp, event_type, parameter_name, old_value, new_value, metadata
                FROM telemetry_events
                WHERE session_id = ?
                ORDER BY timestamp ASC;
                """,
                (session_id,),
            )
            rows = cursor.fetchall()
            events: List[TelemetryEvent] = []
            for row in rows:
                events.append(
                    TelemetryEvent(
                        event_id=row["event_id"],
                        session_id=row["session_id"],
                        timestamp=datetime.fromisoformat(row["timestamp"]),
                        event_type=row["event_type"],
                        parameter_name=row["parameter_name"],
                        old_value=json.loads(row["old_value"]) if row["old_value"] is not None else None,
                        new_value=json.loads(row["new_value"]) if row["new_value"] is not None else None,
                        metadata=json.loads(row["metadata"]) if row["metadata"] is not None else {},
                    )
                )
            return events

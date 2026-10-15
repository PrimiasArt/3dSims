"""
System Time Provider implementation.
"""
from datetime import datetime, timezone
from backend.src.domain.protocols import TimeProviderProtocol


class SystemTimeProvider(TimeProviderProtocol):
    """Provides current real-world UTC time."""

    def now_utc(self) -> datetime:
        return datetime.now(timezone.utc)

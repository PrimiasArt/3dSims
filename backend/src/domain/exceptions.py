"""
Domain Exceptions - Independent of any web or persistence frameworks.
"""

class DomainException(Exception):
    """Base domain exception."""
    pass


class SessionNotFoundError(DomainException):
    """Raised when an operation references a session that does not exist."""
    def __init__(self, session_id: str) -> None:
        super().__init__(f"Session '{session_id}' not found.")
        self.session_id = session_id


class PathTraversalSecurityError(DomainException):
    """Raised when a file path escapes the configured root boundary."""
    def __init__(self, unsafe_path: str) -> None:
        super().__init__(f"Path traversal detected for unsafe path: '{unsafe_path}'.")
        self.unsafe_path = unsafe_path


class InvalidTelemetryPayloadError(DomainException):
    """Raised when a telemetry event has invalid domain data."""
    def __init__(self, message: str) -> None:
        super().__init__(message)

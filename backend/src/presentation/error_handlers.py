"""
RFC 9457 Problem Details Error Handlers for FastAPI.
Content-Type: application/problem+json
"""
import json
import logging
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.src.domain.exceptions import (
    DomainException,
    InvalidTelemetryPayloadError,
    PathTraversalSecurityError,
    SessionNotFoundError,
)

logger = logging.getLogger("telemetry.errors")


def register_rfc9457_error_handlers(app: FastAPI) -> None:
    """Registers global RFC 9457 exception handlers onto the FastAPI application."""

    @app.exception_handler(SessionNotFoundError)
    async def handle_session_not_found(request: Request, exc: SessionNotFoundError) -> JSONResponse:
        logger.warning(json.dumps({"error": "SessionNotFound", "session_id": exc.session_id, "path": request.url.path}))
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "type": "https://api.3dprintsim.pro/errors/session-not-found",
                "title": "Session Not Found",
                "status": 404,
                "detail": str(exc),
                "instance": request.url.path,
            },
            headers={"Content-Type": "application/problem+json"},
        )

    @app.exception_handler(PathTraversalSecurityError)
    async def handle_path_traversal(request: Request, exc: PathTraversalSecurityError) -> JSONResponse:
        logger.error(json.dumps({"error": "PathTraversalViolation", "unsafe_path": exc.unsafe_path, "path": request.url.path}))
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "type": "https://api.3dprintsim.pro/errors/security-violation",
                "title": "Path Traversal Security Violation",
                "status": 400,
                "detail": str(exc),
                "instance": request.url.path,
            },
            headers={"Content-Type": "application/problem+json"},
        )

    @app.exception_handler(InvalidTelemetryPayloadError)
    async def handle_invalid_telemetry(request: Request, exc: InvalidTelemetryPayloadError) -> JSONResponse:
        logger.warning(json.dumps({"error": "InvalidTelemetryPayload", "detail": str(exc), "path": request.url.path}))
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "type": "https://api.3dprintsim.pro/errors/invalid-payload",
                "title": "Invalid Telemetry Payload",
                "status": 422,
                "detail": str(exc),
                "instance": request.url.path,
            },
            headers={"Content-Type": "application/problem+json"},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning(json.dumps({"error": "ValidationError", "errors": exc.errors(), "path": request.url.path}))
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "type": "https://api.3dprintsim.pro/errors/validation-error",
                "title": "Unprocessable Entity",
                "status": 422,
                "detail": "Request body failed schema validation.",
                "instance": request.url.path,
                "errors": exc.errors(),
            },
            headers={"Content-Type": "application/problem+json"},
        )

    @app.exception_handler(DomainException)
    async def handle_generic_domain_error(request: Request, exc: DomainException) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "type": "https://api.3dprintsim.pro/errors/domain-error",
                "title": "Domain Rule Violation",
                "status": 400,
                "detail": str(exc),
                "instance": request.url.path,
            },
            headers={"Content-Type": "application/problem+json"},
        )

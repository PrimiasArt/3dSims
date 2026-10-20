"""
Asynchronous Job Manager for tracking background operations (Supabase batch sync, heavy renders, data extraction).
Provides thread-safe in-memory state tracking with progress reporting and error handling.
"""
import uuid
import time
from enum import Enum
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Job(BaseModel):
    id: str = Field(default_factory=lambda: f"job_{uuid.uuid4().hex[:12]}")
    name: str
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0  # 0.0 to 100.0
    message: str = "Đang chờ xử lý..."
    result: Optional[Any] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class BackgroundJobManager:
    """Manages asynchronous background jobs in memory."""

    def __init__(self, max_retained_jobs: int = 200) -> None:
        self._jobs: Dict[str, Job] = {}
        self._max_retained = max_retained_jobs

    def create_job(self, name: str, metadata: Optional[Dict[str, Any]] = None) -> Job:
        """Creates and registers a new pending job."""
        job = Job(name=name, metadata=metadata or {})
        # Prune older jobs if limit reached
        if len(self._jobs) >= self._max_retained:
            oldest_id = next(iter(self._jobs))
            self._jobs.pop(oldest_id, None)
        self._jobs[job.id] = job
        return job

    def start_job(self, job_id: str, message: str = "Đang xử lý tác vụ...") -> Optional[Job]:
        """Marks a job as actively running."""
        job = self._jobs.get(job_id)
        if job:
            job.status = JobStatus.RUNNING
            job.message = message
            job.updated_at = datetime.now(timezone.utc).isoformat()
        return job

    def update_progress(self, job_id: str, progress: float, message: Optional[str] = None) -> Optional[Job]:
        """Updates job progress and status message."""
        job = self._jobs.get(job_id)
        if job:
            job.progress = max(0.0, min(100.0, progress))
            if message:
                job.message = message
            job.updated_at = datetime.now(timezone.utc).isoformat()
        return job

    def complete_job(self, job_id: str, result: Any, message: str = "Tác vụ hoàn thành thành công.") -> Optional[Job]:
        """Marks a job as successfully completed."""
        job = self._jobs.get(job_id)
        if job:
            job.status = JobStatus.COMPLETED
            job.progress = 100.0
            job.result = result
            job.message = message
            job.updated_at = datetime.now(timezone.utc).isoformat()
        return job

    def fail_job(self, job_id: str, error: str, message: str = "Tác vụ thất bại.") -> Optional[Job]:
        """Marks a job as failed with error details."""
        job = self._jobs.get(job_id)
        if job:
            job.status = JobStatus.FAILED
            job.error = error
            job.message = message
            job.updated_at = datetime.now(timezone.utc).isoformat()
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        """Retrieves a job by its unique identifier."""
        return self._jobs.get(job_id)

    def list_jobs(self, limit: int = 50) -> List[Job]:
        """Lists recent background jobs ordered by creation time descending."""
        jobs = list(self._jobs.values())
        jobs.reverse()
        return jobs[:limit]


job_manager = BackgroundJobManager()

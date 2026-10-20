"""
System & Health Check Endpoints, including Background Job Tracking.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Path
from fastapi.responses import JSONResponse
from backend.src.presentation.dependencies import get_job_manager, BackgroundJobManager

router = APIRouter(tags=["System"])


@router.get("/health")
async def health_check():
    """Health check ping for monitoring service liveness."""
    return {
        "status": "healthy",
        "service": "3D PrintSim Pro Telemetry Engine",
        "version": "2026.1",
        "architecture": "Clean Architecture with Modular APIRouters",
    }


@router.get("/api/v1/jobs/{job_id}")
async def get_background_job_status(
    job_id: str = Path(..., description="Mã định danh job tác vụ ngầm"),
    job_mgr: BackgroundJobManager = Depends(get_job_manager),
):
    """Truy vấn tiến độ và kết quả của tác vụ nền (Supabase sync, nặng tính toán, v.v.)."""
    job = job_mgr.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tác vụ nền với mã '{job_id}'",
        )
    return JSONResponse(content=job.model_dump(), status_code=status.HTTP_200_OK)


@router.get("/api/v1/jobs")
async def list_background_jobs(
    job_mgr: BackgroundJobManager = Depends(get_job_manager),
):
    """Liệt kê danh sách các tác vụ nền gần đây."""
    jobs = job_mgr.list_jobs(limit=30)
    return JSONResponse(
        content=[j.model_dump() for j in jobs],
        status_code=status.HTTP_200_OK,
    )

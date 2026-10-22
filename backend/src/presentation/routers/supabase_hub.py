"""
Supabase Cloud Hub Routers: Configuration, Connection Test, Sync, and Background Batch Sync.
"""
from typing import Optional
from fastapi import APIRouter, Depends, BackgroundTasks, status
from fastapi.responses import JSONResponse, PlainTextResponse
from backend.src.domain.protocols import VaultStorageProtocol
from backend.src.infrastructure.supabase_sync_service import supabase_service
from backend.src.infrastructure.job_manager import BackgroundJobManager
from backend.src.presentation.dependencies import get_vault, get_job_manager
from backend.src.presentation.schemas import (
    SupabaseConfigRequest,
    SupabaseTestRequest,
    SupabaseTestResponse,
    SupabaseSyncResponse,
    SupabaseHubStatusResponse,
)

router = APIRouter(tags=["Supabase Cloud Hub"])


@router.get(
    "/api/v1/supabase/status",
    response_model=SupabaseHubStatusResponse,
)
async def get_supabase_hub_status(vault: VaultStorageProtocol = Depends(get_vault)):
    """Tra cứu trạng thái kết nối & số lượng dữ liệu sẵn sàng đồng bộ lên Supabase."""
    return JSONResponse(
        content=supabase_service.get_status(
            vault_root=vault._vault_root,
            json_root=vault._json_root,
        ),
        status_code=status.HTTP_200_OK,
    )


@router.post(
    "/api/v1/supabase/test",
    response_model=SupabaseTestResponse,
)
async def test_supabase_connection(payload: Optional[SupabaseTestRequest] = None):
    """Kiểm tra tính hợp lệ của Project URL và API Key đến Supabase."""
    url = payload.url if payload else None
    key = payload.key if payload else None
    res = await supabase_service.test_connection(url=url, key=key)
    return JSONResponse(content=res, status_code=status.HTTP_200_OK)


@router.post(
    "/api/v1/supabase/config",
    response_model=SupabaseHubStatusResponse,
)
async def update_supabase_config(
    payload: SupabaseConfigRequest,
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Cập nhật thông tin kết nối Supabase Cloud Hub."""
    supabase_service.update_config(
        url=payload.url,
        key=payload.key,
        auto_sync=payload.auto_sync,
    )
    return JSONResponse(
        content=supabase_service.get_status(
            vault_root=vault._vault_root,
            json_root=vault._json_root,
        ),
        status_code=status.HTTP_200_OK,
    )


@router.post(
    "/api/v1/supabase/sync",
    response_model=SupabaseSyncResponse,
)
async def trigger_supabase_sync(vault: VaultStorageProtocol = Depends(get_vault)):
    """Kích hoạt đồng bộ toàn phần 1-click (Sessions & Hồ sơ 3D) lên Supabase đồng bộ."""
    res = await supabase_service.sync_all(
        vault_root=vault._vault_root,
        json_root=vault._json_root,
    )
    return JSONResponse(content=res, status_code=status.HTTP_200_OK)


@router.post(
    "/api/v1/supabase/pull",
    status_code=status.HTTP_200_OK,
)
async def trigger_supabase_pull(vault: VaultStorageProtocol = Depends(get_vault)):
    """
    Đồng bộ kéo 2 chiều: Tải toàn bộ phiên in từ Supabase Cloud Database về Local.
    Hợp nhất vào nhat_ky_in.json, sinh lại file nhat_ky_in.md, PHIEU_*.md và MOC Obsidian.
    """
    res = await supabase_service.pull_sessions(
        vault_root=vault._vault_root,
        json_root=vault._json_root,
    )
    return JSONResponse(content=res, status_code=status.HTTP_200_OK if res.get("success") else status.HTTP_400_BAD_REQUEST)


async def _run_supabase_sync_task(job_id: str, vault_root, json_root, job_mgr: BackgroundJobManager):
    """Internal worker executed in BackgroundTasks."""
    job_mgr.start_job(job_id, message="Bắt đầu đồng bộ dữ liệu lên Supabase...")
    try:
        job_mgr.update_progress(job_id, progress=30.0, message="Đang kết nối và đồng bộ print_sessions...")
        res = await supabase_service.sync_all(vault_root=vault_root, json_root=json_root)
        if res.get("success"):
            job_mgr.complete_job(job_id, result=res, message=f"Đồng bộ thành công {res.get('total_synced', 0)} mục.")
        else:
            job_mgr.fail_job(job_id, error=str(res.get("error", "Unknown sync error")), message="Đồng bộ Supabase thất bại.")
    except Exception as e:
        job_mgr.fail_job(job_id, error=str(e), message="Có lỗi phát sinh trong quá trình đồng bộ nền.")


@router.post(
    "/api/v1/supabase/sync-async",
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_supabase_sync_async(
    background_tasks: BackgroundTasks,
    vault: VaultStorageProtocol = Depends(get_vault),
    job_mgr: BackgroundJobManager = Depends(get_job_manager),
):
    """
    Kích hoạt đồng bộ Supabase dưới dạng Background Task.
    Trả về ngay mã `job_id` để Frontend theo dõi qua `/api/v1/jobs/{job_id}`, không gây block HTTP.
    """
    job = job_mgr.create_job(name="supabase_full_sync", metadata={"vault_root": str(vault._vault_root)})
    background_tasks.add_task(
        _run_supabase_sync_task,
        job_id=job.id,
        vault_root=vault._vault_root,
        json_root=vault._json_root,
        job_mgr=job_mgr,
    )
    return JSONResponse(
        content={
            "status": "accepted",
            "message": "Đã xếp hàng tác vụ đồng bộ Supabase ngầm.",
            "job_id": job.id,
            "check_status_url": f"/api/v1/jobs/{job.id}",
        },
        status_code=status.HTTP_202_ACCEPTED,
    )


@router.get(
    "/api/v1/supabase/sql-schema",
)
async def get_supabase_sql_schema():
    """Cung cấp mã SQL migration hoàn chỉnh để khởi tạo bảng trên Supabase SQL Editor."""
    return PlainTextResponse(
        content=supabase_service.get_sql_migration_script(),
        status_code=status.HTTP_200_OK,
    )

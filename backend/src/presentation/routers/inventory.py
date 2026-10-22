"""
Filament Spool Inventory & RFID Smart Warning Routers.
Provides CRUD operations, RFID tracking, and real-time print sufficiency verification.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Path
from pydantic import BaseModel, Field

from backend.src.domain.spool_inventory import FilamentSpool, SpoolVerificationResult
from backend.src.infrastructure.spool_repository import SpoolInventoryRepository
from backend.src.presentation.dependencies import get_spool_repo

router = APIRouter(prefix="/api/v1/inventory/spools", tags=["Filament Inventory & RFID"])


class SpoolVerifyRequest(BaseModel):
    required_grams: float = Field(..., gt=0.0, description="Estimated model filament weight in grams")
    material: Optional[str] = Field(default=None, description="Model polymer type: PLA, PETG, ABS, etc.")
    safety_margin_g: float = Field(default=5.0, ge=0.0, description="Buffer weight for purge line and prime tower")


class SpoolDeductRequest(BaseModel):
    used_grams: float = Field(..., gt=0.0, description="Actual filament weight consumed by print job in grams")


@router.get("", response_model=List[FilamentSpool], status_code=status.HTTP_200_OK)
async def list_spools(repo: SpoolInventoryRepository = Depends(get_spool_repo)):
    """Liệt kê toàn bộ danh sách cuộn nhựa trong kho / các khay AMS."""
    return repo.list_all()


@router.get("/{spool_id}", response_model=FilamentSpool, status_code=status.HTTP_200_OK)
async def get_spool(
    spool_id: str = Path(..., description="Mã định danh cuộn nhựa"),
    repo: SpoolInventoryRepository = Depends(get_spool_repo),
):
    """Lấy chi tiết một cuộn nhựa theo spool_id hoặc mã RFID."""
    spool = repo.get_by_id(spool_id)
    if not spool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cuộn nhựa với mã '{spool_id}' không tồn tại.",
        )
    return spool


@router.post("", response_model=FilamentSpool, status_code=status.HTTP_201_CREATED)
async def create_spool(
    payload: FilamentSpool,
    repo: SpoolInventoryRepository = Depends(get_spool_repo),
):
    """Thêm một cuộn nhựa mới vào kho hoặc nạp cuộn mới qua RFID."""
    existing = repo.get_by_id(payload.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cuộn nhựa với mã '{payload.id}' đã tồn tại trong kho.",
        )
    return repo.save(payload)


@router.put("/{spool_id}", response_model=FilamentSpool, status_code=status.HTTP_200_OK)
async def update_spool(
    payload: FilamentSpool,
    spool_id: str = Path(..., description="Mã định danh cuộn nhựa"),
    repo: SpoolInventoryRepository = Depends(get_spool_repo),
):
    """Cập nhật thông số cuộn nhựa (vị trí khay AMS, khối lượng còn lại, màu sắc)."""
    payload.id = spool_id
    return repo.save(payload)


@router.delete("/{spool_id}", status_code=status.HTTP_200_OK)
async def delete_spool(
    spool_id: str = Path(..., description="Mã định danh cuộn nhựa"),
    repo: SpoolInventoryRepository = Depends(get_spool_repo),
):
    """Xóa cuộn nhựa khỏi kho (đã dùng hết hoặc hỏng)."""
    success = repo.delete(spool_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy cuộn nhựa '{spool_id}' để xóa.",
        )
    return {"status": "success", "message": f"Đã xóa cuộn nhựa '{spool_id}'."}


@router.post("/{spool_id}/verify", response_model=SpoolVerificationResult, status_code=status.HTTP_200_OK)
async def verify_spool_sufficiency(
    payload: SpoolVerifyRequest,
    spool_id: str = Path(..., description="Mã định danh cuộn nhựa"),
    repo: SpoolInventoryRepository = Depends(get_spool_repo),
):
    """
    Kiểm tra thông minh trước khi in:
    So sánh khối lượng mô hình cần in với lượng nhựa còn lại trên cuộn.
    Báo động đỏ nếu nguy cơ hết nhựa giữa chừng hoặc sai lệch chất liệu.
    """
    return repo.verify_sufficiency(
        spool_id=spool_id,
        required_grams=payload.required_grams,
        model_material=payload.material,
        safety_margin_g=payload.safety_margin_g,
    )


@router.post("/{spool_id}/deduct", response_model=FilamentSpool, status_code=status.HTTP_200_OK)
async def deduct_spool_weight(
    payload: SpoolDeductRequest,
    spool_id: str = Path(..., description="Mã định danh cuộn nhựa"),
    repo: SpoolInventoryRepository = Depends(get_spool_repo),
):
    """Tự động trừ khối lượng tiêu thụ sau khi bản in hoàn thành."""
    updated = repo.deduct_weight(spool_id, payload.used_grams)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy cuộn nhựa '{spool_id}' để trừ khối lượng.",
        )
    return updated

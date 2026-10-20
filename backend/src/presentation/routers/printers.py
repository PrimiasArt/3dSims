"""
Multi-Printer Hardware Profiles & Capability Matrix Routers.
"""
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from backend.src.domain.printer_profiles import get_all_printer_profiles, get_printer_profile

router = APIRouter(tags=["Printer Hardware Profiles"])


@router.get(
    "/api/v1/printers/profiles",
    status_code=status.HTTP_200_OK,
)
async def list_printer_profiles():
    """Liệt kê toàn bộ danh mục thông số phần cứng các dòng máy in 3D (Bambu Lab, Prusa, Voron, Creality, Elegoo)."""
    profiles = get_all_printer_profiles()
    return JSONResponse(
        content=[p.model_dump() for p in profiles],
        status_code=status.HTTP_200_OK,
    )


@router.get(
    "/api/v1/printers/profiles/{printer_id}",
    status_code=status.HTTP_200_OK,
)
async def get_single_printer_profile(printer_id: str):
    """Tra cứu chi tiết cấu hình phần cứng một dòng máy in theo printer_id."""
    profile = get_printer_profile(printer_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Printer profile '{printer_id}' không tồn tại.",
        )
    return JSONResponse(
        content=profile.model_dump(),
        status_code=status.HTTP_200_OK,
    )

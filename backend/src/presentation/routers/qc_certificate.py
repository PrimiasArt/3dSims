"""
Executive QC Certificate & Standalone HTML Report Routers.
"""
import base64
from typing import Optional
from fastapi import APIRouter, Depends, Query, status, Response
from fastapi.responses import HTMLResponse
from backend.src.domain.protocols import VaultStorageProtocol
from backend.src.infrastructure.qc_certificate_service import QCCertificateService
from backend.src.presentation.dependencies import get_vault
from backend.src.presentation.schemas import QCCertificateRequest

router = APIRouter(tags=["Quality Certificates"])


@router.get(
    "/api/v1/sessions/{session_id:path}/certificate",
    status_code=status.HTTP_200_OK,
)
async def get_qc_certificate_html(
    session_id: str,
    printer_id: Optional[str] = Query(default=None, description="Mã máy in mục tiêu"),
    download: bool = Query(default=False, description="Tải về file HTML thay vì xem trực tiếp"),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Xuất chứng chỉ QC độc lập định dạng HTML chuẩn in ấn công nghiệp từ phiên audit."""
    clean_id = session_id.replace("Audit_", "")
    audit_data = {}
    try:
        audit_data = vault.get_audit_json(clean_id) or vault.get_audit_json(session_id) or {}
    except Exception:
        audit_data = {}

    profile_data = audit_data.get("parameters") or audit_data.get("profile") or {}

    html_content = QCCertificateService.generate_html(
        session_id=session_id,
        profile=profile_data if isinstance(profile_data, dict) else {},
        audit_data=audit_data,
        printer_id=printer_id,
    )

    headers = {}
    if download:
        filename = f"QC_Certificate_{clean_id}.html"
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    return HTMLResponse(content=html_content, status_code=status.HTTP_200_OK, headers=headers)


@router.get(
    "/api/v1/sessions/{session_id:path}/certificate/download",
    status_code=status.HTTP_200_OK,
)
async def download_qc_certificate_html(
    session_id: str,
    printer_id: Optional[str] = Query(default=None, description="Mã máy in mục tiêu"),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Tải trực tiếp tệp chứng nhận QC Certificate định dạng HTML có thể mở offline hoặc in PDF."""
    return await get_qc_certificate_html(session_id=session_id, printer_id=printer_id, download=True, vault=vault)


@router.post(
    "/api/v1/sessions/{session_id:path}/certificate",
    status_code=status.HTTP_200_OK,
)
async def generate_qc_certificate_post(
    session_id: str,
    payload: QCCertificateRequest,
):
    """Tạo chứng chỉ QC theo payload động do client cung cấp."""
    html_content = QCCertificateService.generate_html(
        session_id=session_id,
        profile=payload.profile,
        audit_data=payload.audit_data,
        printer_id=payload.printer_id,
    )
    return HTMLResponse(content=html_content, status_code=status.HTTP_200_OK)

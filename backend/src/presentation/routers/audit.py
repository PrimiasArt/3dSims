"""
Audit Reports, Locked Schema Session Logs, and 3D Profiles Routers.
"""
import json
import base64
from typing import Optional
from fastapi import APIRouter, Depends, Path, HTTPException, status, Body
from fastapi.responses import JSONResponse, PlainTextResponse, FileResponse, Response
from backend.src.application.dtos import GenerateDualAuditInput
from backend.src.application.use_cases import GenerateDualAuditUseCase
from backend.src.domain.exceptions import SessionNotFoundError
from backend.src.domain.protocols import VaultStorageProtocol
from backend.src.presentation.dependencies import get_vault, get_audit_use_case
from backend.src.presentation.schemas import (
    AuditGenerateRequest,
    AuditGenerateResponse,
    SaveSessionLogRequest,
    Profile3DResponse,
    ThumbnailUploadRequest,
    ThumbnailUploadResponse,
)

router = APIRouter(tags=["Audit & Session Logs"])



@router.post(
    "/api/v1/sessions/{session_id:path}/audit",
    response_model=AuditGenerateResponse,
    status_code=status.HTTP_200_OK,
    tags=["Audit"],
)
async def generate_audit(
    session_id: str = Path(..., min_length=1),
    payload: Optional[AuditGenerateRequest] = None,
    audit_use_case: GenerateDualAuditUseCase = Depends(get_audit_use_case),
):
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        from backend.src.domain.exceptions import PathTraversalSecurityError
        raise PathTraversalSecurityError(session_id)
    input_dto = GenerateDualAuditInput(
        session_id=session_id,
        profile_snapshot=payload.profile if payload else None,
    )
    result = audit_use_case.execute(input_dto)
    return AuditGenerateResponse(
        session_id=result.session_id,
        markdown_path=result.markdown_path,
        json_path=result.json_path,
        high_churn_parameters=result.high_churn_parameters,
        total_events=result.total_events,
        created_at=result.created_at.isoformat(),
    )


@router.get(
    "/api/v1/sessions/{session_id:path}/audit",
    status_code=status.HTTP_200_OK,
    tags=["Audit"],
)
async def get_audit(
    session_id: str = Path(..., min_length=1),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        from backend.src.domain.exceptions import PathTraversalSecurityError
        raise PathTraversalSecurityError(session_id)
    audit_json = vault.get_audit_json(session_id)
    if not audit_json:
        raise SessionNotFoundError(session_id)
    return JSONResponse(content=audit_json, status_code=status.HTTP_200_OK)


@router.get(
    "/api/v1/nhat-ky",
    status_code=status.HTTP_200_OK,
    tags=["Locked Schema Logs"],
)
async def get_nhat_ky_json(vault: VaultStorageProtocol = Depends(get_vault)):
    """Returns the minimalist nhat_ky_in.json array according to the locked schema contract."""
    json_path = vault._resolve_safe_path("nhat_ky_in.json")
    if not json_path.exists():
        return JSONResponse(content=[], status_code=status.HTTP_200_OK)
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return JSONResponse(content=data, status_code=status.HTTP_200_OK)


@router.get(
    "/api/v1/nhat-ky/markdown",
    status_code=status.HTTP_200_OK,
    tags=["Locked Schema Logs"],
)
async def get_nhat_ky_markdown(vault: VaultStorageProtocol = Depends(get_vault)):
    """Returns the minimalist nhat_ky_in.md content according to the locked schema contract."""
    md_path = vault._resolve_safe_path("02_NhatKy_In/nhat_ky_in.md")
    if not md_path.exists():
        md_path = vault._resolve_safe_path("nhat_ky_in.md")
    if not md_path.exists():
        return PlainTextResponse("", status_code=status.HTTP_200_OK)
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()
    return PlainTextResponse(content, status_code=status.HTTP_200_OK)


@router.get(
    "/api/v1/nhat-ky/export/excel",
    status_code=status.HTTP_200_OK,
    tags=["Locked Schema Logs"],
)
async def export_nhat_ky_excel(vault: VaultStorageProtocol = Depends(get_vault)):
    """Xuất toàn bộ ma trận tham số và danh sách phiên in ra tệp bảng tính Microsoft Excel (.xlsx) chuẩn."""
    from backend.src.infrastructure.excel_exporter import generate_excel_report

    json_path = vault._resolve_safe_path("nhat_ky_in.json")
    sessions = []
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    sessions = data.get("sessions") or data.get("chi_tiet_tung_phien") or []
                elif isinstance(data, list):
                    sessions = data
        except Exception:
            sessions = []

    excel_bytes = generate_excel_report(sessions)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=Nhat_Ky_In_3D_Sim_QC.xlsx",
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    )


@router.get(
    "/api/v1/nhat-ky/export/csv",
    status_code=status.HTTP_200_OK,
    tags=["Locked Schema Logs"],
)
async def export_nhat_ky_csv(vault: VaultStorageProtocol = Depends(get_vault)):
    """Xuất toàn bộ ma trận tham số và nhật ký in ra tệp CSV (chuẩn UTF-8 with BOM cho Excel tiếng Việt)."""
    from backend.src.infrastructure.excel_exporter import generate_csv_report

    json_path = vault._resolve_safe_path("nhat_ky_in.json")
    sessions = []
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    sessions = data.get("sessions") or data.get("chi_tiet_tung_phien") or []
                elif isinstance(data, list):
                    sessions = data
        except Exception:
            sessions = []

    csv_text = generate_csv_report(sessions)
    return Response(
        content=csv_text.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=Nhat_Ky_In_3D_Sim_QC.csv",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


@router.post(
    "/api/v1/nhat-ky/save-session",
    status_code=status.HTTP_200_OK,
    tags=["Locked Schema Logs"],
)
async def save_session_log(
    payload: SaveSessionLogRequest,
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Lưu hoặc cập nhật thông số phiên in vào nhat_ky_in.json, nhat_ky_in.md và PHIEU_{sessionId}.md trong Obsidian Vault."""
    json_path = vault._resolve_safe_path("nhat_ky_in.json")
    md_path = vault._resolve_safe_path("02_NhatKy_In/nhat_ky_in.md")
    vault_notes_dir = vault._vault_root / "02_NhatKy_In"
    vault_notes_dir.mkdir(parents=True, exist_ok=True)

    session_entry = payload.session
    s_id = str(session_entry.get("sessionId", "01"))

    # 1. Load existing sessions
    sessions = []
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])
                elif isinstance(data, list):
                    sessions = data
        except Exception:
            sessions = []

    # Update if exists, otherwise append
    existing_idx = next((i for i, s in enumerate(sessions) if str(s.get("sessionId")) == s_id), -1)
    if existing_idx >= 0 and payload.append_mode:
        sessions[existing_idx] = session_entry
    else:
        sessions.append(session_entry)

    # 0. Automatic Backup Snapshot before updating
    backup_info = None
    if hasattr(vault, "create_snapshot"):
        try:
            backup_info = vault.create_snapshot(tag=f"session_{s_id}")
        except Exception:
            pass

    from backend.src.infrastructure.formatters import (
        build_parameter_session_matrix,
        render_markdown_log,
        render_phieu_markdown,
    )

    session_cols, json_matrix_rows, _ = build_parameter_session_matrix(sessions)
    payload_data = {
        "schema_version": "v2026.1",
        "kieu_trinh_bay": "bang_hop_nhat_phan_lop",
        "tong_so_phien": len(sessions),
        "danh_sach_phien": session_cols,
        "bang_tong_hop": json_matrix_rows,
        "ma_tran_tham_so": json_matrix_rows,
        "sessions": sessions,
        "chi_tiet_tung_phien": sessions,
    }
    vault._atomic_write(json_path, json.dumps(payload_data, indent=2, ensure_ascii=False))

    # 3. Generate and save nhat_ky_in.md (Obsidian master table)
    md_content = render_markdown_log(sessions)
    vault._atomic_write(md_path, md_content)

    # 4. Generate PHIEU_{s_id}.md for Obsidian (02_NhatKy_In)
    phieu_path = vault_notes_dir / f"PHIEU_{s_id}.md"
    phieu_md = render_phieu_markdown(session_entry)
    vault._atomic_write(phieu_path, phieu_md)

    # 5. Generate Profile_In3D_{s_id}.md for Obsidian (01_Profiles_In3D)
    profiles_dir = vault._vault_root / "01_Profiles_In3D"
    profiles_dir.mkdir(parents=True, exist_ok=True)
    profile_path = profiles_dir / f"Profile_In3D_{s_id}.md"
    profile_md = vault.render_3d_profile_from_dict(session_entry)
    vault._atomic_write(profile_path, profile_md)

    # 6. Update MOC (000_PRINT_INDEX.md)
    moc_path = vault._resolve_safe_path("000_PRINT_INDEX.md")
    session_table_rows = [
        f"| `{s.get('sessionId', f'{i+1:02d}')}` | [[Profile_In3D_{s.get('sessionId', f'{i+1:02d}')}|🎨 Profile In 3D #{s.get('sessionId', f'{i+1:02d}')}]] | [[PHIEU_{s.get('sessionId', f'{i+1:02d}')}|Phiếu #{s.get('sessionId', f'{i+1:02d}')}]] | `{s.get('startedAt', '-')}` | `{s.get('slicer', {}).get('layerHeightMm', 0.2)}mm` | `01_Profiles_In3D/` | `02_NhatKy_In/` |"
        for i, s in enumerate(sessions)
    ]
    session_table_str = "\n".join(session_table_rows)
    moc_content = f"""---
type: moc
tags:
  - printsim/index
  - corexy/vault
---

# 🧭 3D PrintSim Pro — Map of Content (MOC) & Graph Navigator

> **Obsidian Graph View Hub**: Tệp này liên kết toàn bộ các phiên in 3D và báo cáo kiểm định để trực quan hóa sơ đồ mạng nhện.

---

## 📈 Truy Vấn Obsidian Dataview Toàn Bộ Phiên In
```dataview
TABLE startedAt as "Thời gian", status as "Trạng thái", slicer.layerHeightMm as "Độ dày lớp", hardware.speedF.defaultMmS as "Tốc độ F"
FROM "02_NhatKy_In" OR #printsim/phieu-in
SORT file.mtime DESC
```

---

## 🗂️ Bảng Tổng Hợp Điều Hướng Các Phiên In (Sessions Matrix)

| Phiên in | Hồ Sơ In 3D (Executive) | Phiếu Chi Tiết | Thời Gian | Cấu Hình Lớp | Thư Mục Profile | Thư Mục Nhật Ký |
| :---: | :--- | :---: | :---: | :--- | :--- |
{session_table_str}

---

## 📓 Nhật Ký In Khóa Chuẩn (02_NhatKy_In)
- [[nhat_ky_in|Nhật Ký In Tổng Hợp]] (`02_NhatKy_In/nhat_ky_in.md`)

---
*Tự động đồng bộ bởi 3D PrintSim Telemetry Engine.*
"""
    vault._atomic_write(moc_path, moc_content)

    # 7. Spool Inventory Hook (Auto-deduction & runout alert)
    spool_deduction = None
    try:
        from backend.src.presentation.dependencies import get_spool_repo
        spool_repo = get_spool_repo()
        target_spool_id = payload.session.get("spoolId") or payload.session.get("spool_id")
        target_spool = None
        if target_spool_id:
            target_spool = spool_repo.get_by_id(target_spool_id)
        if not target_spool:
            mat = str(payload.session.get("material") or payload.session.get("slicer", {}).get("material") or "PLA").upper()
            all_spools = spool_repo.list_all()
            target_spool = next((sp for sp in all_spools if sp.is_active and sp.material.upper() == mat), None)
            if not target_spool and all_spools:
                target_spool = next((sp for sp in all_spools if sp.is_active), all_spools[0])

        if target_spool:
            used_grams = float(
                payload.session.get("filamentUsedG")
                or payload.session.get("filament_used_g")
                or payload.session.get("slicer", {}).get("filamentUsedG")
                or 14.5
            )
            updated_spool = spool_repo.deduct_weight(target_spool.id, used_grams)
            if updated_spool:
                is_low = updated_spool.remaining_weight_g < 50.0
                spool_deduction = {
                    "spool_id": updated_spool.id,
                    "spool_name": updated_spool.name,
                    "brand": updated_spool.brand,
                    "material": updated_spool.material,
                    "deducted_grams": used_grams,
                    "remaining_weight_g": updated_spool.remaining_weight_g,
                    "percentage_left": updated_spool.percentage_left,
                    "location": updated_spool.location,
                    "is_low": is_low,
                    "warning": (
                        f"⚠️ Cảnh báo: Cuộn '{updated_spool.name}' ({updated_spool.location}) chỉ còn {updated_spool.remaining_weight_g}g! Nguy cơ hết nhựa trong lần in tới."
                        if is_low
                        else None
                    ),
                }
    except Exception:
        pass

    return JSONResponse(
        content={
            "status": "success",
            "message": f"Đã lưu thành công Phiên #{s_id} vào .md và .json!",
            "session_id": s_id,
            "total_sessions": len(sessions),
            "json_path": str(json_path),
            "markdown_path": str(md_path),
            "phieu_path": str(phieu_path),
            "profile_path": str(profile_path),
            "backup_created": backup_info,
            "spool_deduction": spool_deduction,
        },
        status_code=status.HTTP_200_OK,
    )


@router.get(
    "/api/v1/vault/snapshots",
    status_code=status.HTTP_200_OK,
    tags=["Vault Snapshots & Backup"],
)
async def list_vault_snapshots(vault: VaultStorageProtocol = Depends(get_vault)):
    """Liệt kê toàn bộ các bản snapshot sao lưu của Vault Markdown và JSON Logs."""
    if hasattr(vault, "list_snapshots"):
        return JSONResponse(content=vault.list_snapshots(), status_code=status.HTTP_200_OK)
    return JSONResponse(content={"json_snapshots": [], "md_snapshots": []}, status_code=status.HTTP_200_OK)


@router.post(
    "/api/v1/vault/snapshots/create",
    status_code=status.HTTP_200_OK,
    tags=["Vault Snapshots & Backup"],
)
async def create_vault_snapshot(
    tag: str = "manual",
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Tạo bản snapshot dự phòng thủ công cho cả nhat_ky_in.json và nhat_ky_in.md."""
    if hasattr(vault, "create_snapshot"):
        res = vault.create_snapshot(tag=tag)
        return JSONResponse(
            content={
                "status": "success",
                "message": f"Đã tạo bản snapshot backup với nhãn '{tag}'.",
                "backups": res,
            },
            status_code=status.HTTP_200_OK,
        )
    return JSONResponse(content={"status": "error", "message": "Vault adapter does not support snapshots."}, status_code=status.HTTP_400_BAD_REQUEST)


@router.post(
    "/api/v1/vault/snapshots/restore/{filename}",
    status_code=status.HTTP_200_OK,
    tags=["Vault Snapshots & Backup"],
)
async def restore_vault_snapshot(
    filename: str = Path(..., description="Tên file snapshot cần khôi phục"),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Khôi phục dữ liệu từ bản snapshot dự phòng."""
    if hasattr(vault, "restore_snapshot"):
        success = vault.restore_snapshot(filename)
        if success:
            return JSONResponse(
                content={"status": "success", "message": f"Đã khôi phục thành công từ snapshot '{filename}'."},
                status_code=status.HTTP_200_OK,
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy file snapshot '{filename}' hoặc định dạng không hỗ trợ.",
        )
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vault does not support restore.")


@router.get(
    "/api/v1/sessions/{session_id:path}/profile-3d",
    response_model=Profile3DResponse,
    status_code=status.HTTP_200_OK,
    tags=["Locked Schema Logs"],
)
async def get_session_profile_3d(
    session_id: str = Path(..., min_length=1),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """
    Truy xuất Hồ Sơ In 3D (3D Print Profile) được tổng hợp riêng cho mọi vai trò ngoài dev
    (Designers, Workshop Operators, Quản lý sản xuất).
    """
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        from backend.src.domain.exceptions import PathTraversalSecurityError
        raise PathTraversalSecurityError(session_id)

    md_content = vault.get_3d_profile_md(session_id)
    if not md_content:
        json_path = vault._resolve_safe_path("nhat_ky_in.json")
        if json_path.exists():
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])
                s = next((item for item in sessions if str(item.get("sessionId")) == session_id), None)
                if s:
                    md_content = vault.render_3d_profile_from_dict(s)
                    prof_path = vault._vault_root / "01_Profiles_In3D" / f"Profile_In3D_{session_id}.md"
                    vault._atomic_write(prof_path, md_content)

    if not md_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy Profile In 3D cho phiên {session_id}",
        )

    return JSONResponse(
        content={
            "status": "success",
            "session_id": session_id,
            "profile_path": f"01_Profiles_In3D/Profile_In3D_{session_id}.md",
            "markdown": md_content,
        },
        status_code=status.HTTP_200_OK,
    )


@router.get(
    "/api/v1/sessions/{session_id:path}/profile-3d/markdown",
    status_code=status.HTTP_200_OK,
    tags=["Locked Schema Logs"],
)
async def get_session_profile_3d_markdown(
    session_id: str = Path(..., min_length=1),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Trả về nội dung Markdown thuần của Hồ Sơ In 3D cho Obsidian Preview."""
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        from backend.src.domain.exceptions import PathTraversalSecurityError
        raise PathTraversalSecurityError(session_id)

    md_content = vault.get_3d_profile_md(session_id)
    if not md_content:
        json_path = vault._resolve_safe_path("nhat_ky_in.json")
        if json_path.exists():
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])
                s = next((item for item in sessions if str(item.get("sessionId")) == session_id), None)
                if s:
                    md_content = vault.render_3d_profile_from_dict(s)
                    prof_path = vault._vault_root / "01_Profiles_In3D" / f"Profile_In3D_{session_id}.md"
                    vault._atomic_write(prof_path, md_content)

    if not md_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy Profile In 3D cho phiên {session_id}",
        )

    return PlainTextResponse(md_content, media_type="text/markdown", status_code=status.HTTP_200_OK)


@router.post(
    "/api/v1/sessions/{session_id:path}/thumbnail",
    response_model=ThumbnailUploadResponse,
    status_code=status.HTTP_200_OK,
    tags=["3D Thumbnails"],
)
async def upload_session_thumbnail(
    session_id: str = Path(..., min_length=1),
    payload: ThumbnailUploadRequest = Body(...),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Lưu ảnh thumbnail render 3D vào ObsidianVault/01_Profiles_In3D/Attachments/Thumb_{session_id}.png."""
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        from backend.src.domain.exceptions import PathTraversalSecurityError
        raise PathTraversalSecurityError(session_id)

    img_b64 = payload.image_base64 or payload.thumbnail
    if not img_b64:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Thiếu dữ liệu image_base64")

    ext = "png"
    if "," in img_b64:
        header, img_b64 = img_b64.split(",", 1)
        if "jpeg" in header or "jpg" in header:
            ext = "jpg"
        elif "webp" in header:
            ext = "webp"

    try:
        image_bytes = base64.b64decode(img_b64)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Dữ liệu base64 không hợp lệ: {e}")

    rel_path, abs_path = vault.save_session_thumbnail(session_id, image_bytes, ext=ext)

    return JSONResponse(
        content={
            "status": "success",
            "message": f"Đã lưu thumbnail cho phiên #{session_id}!",
            "session_id": session_id,
            "thumbnail_path": rel_path,
            "bytes_written": len(image_bytes),
        },
        status_code=status.HTTP_200_OK,
    )


@router.get(
    "/api/v1/sessions/{session_id:path}/thumbnail",
    tags=["3D Thumbnails"],
)
async def get_session_thumbnail(
    session_id: str = Path(..., min_length=1),
    vault: VaultStorageProtocol = Depends(get_vault),
):
    """Phục vụ ảnh thumbnail 3D của phiên in."""
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        from backend.src.domain.exceptions import PathTraversalSecurityError
        raise PathTraversalSecurityError(session_id)

    thumb_path = vault.get_session_thumbnail_path(session_id)
    if not thumb_path or not thumb_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thumbnail cho phiên in này")

    ext = thumb_path.suffix.lstrip(".").lower()
    mime = f"image/{ext}" if ext in ["png", "webp"] else "image/jpeg"
    return FileResponse(thumb_path, media_type=mime)

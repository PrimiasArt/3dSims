"""
FastAPI Presentation Layer for Telemetry Ingestion & Audit Engine.
Uses Pydantic v2 schemas and RFC 9457 error handlers.
"""
from typing import Optional
from fastapi import FastAPI, Path, status, Query, Body, HTTPException, Response
from fastapi.responses import JSONResponse, PlainTextResponse, FileResponse, Response

from backend.src.application.dtos import GenerateDualAuditInput, RecordTelemetryEventInput
from backend.src.application.use_cases import (
    CalculateParameterChurnUseCase,
    GenerateDualAuditUseCase,
    RecordTelemetryEventUseCase,
)
from backend.src.domain.exceptions import SessionNotFoundError
from backend.src.domain.protocols import (
    TelemetryRepositoryProtocol,
    TimeProviderProtocol,
    VaultStorageProtocol,
)
from backend.src.infrastructure.obsidian_vault import ObsidianVaultAdapter
from backend.src.infrastructure.sqlite_repo import SQLiteTelemetryRepository
from backend.src.infrastructure.time_provider import SystemTimeProvider
from backend.src.presentation.error_handlers import register_rfc9457_error_handlers
from fastapi.middleware.cors import CORSMiddleware
from backend.src.infrastructure.config import settings
from backend.src.infrastructure.gemini_ai import GeminiAIService
from backend.src.application.physics_sanity_check import PhysicsSanityCheckUseCase
from backend.src.presentation.schemas import (
    AuditGenerateRequest,
    AuditGenerateResponse,
    TelemetryEventRequest,
    TelemetryEventResponse,
    SaveSessionLogRequest,
    PhysicsIssueSchema,
    PhysicsSanityCheckRequest,
    PhysicsSanityCheckResponse,
    Profile3DSummarySchema,
    Profile3DResponse,
    SlicerExportResponse,
    ParameterDiffSchema,
    SessionComparisonResponse,
    ThumbnailUploadRequest,
    ThumbnailUploadResponse,
)


def _generate_phieu_markdown(s: dict) -> str:
    s_id = str(s.get("sessionId", "01"))
    op = s.get("operator", "Kỹ sư in 3D (CoreXY)")
    started = s.get("startedAt", "2026-10-17 10:00")
    dur = s.get("durationMinutes", 7)
    status = s.get("status", "COMPLETED")
    parent = s.get("parentSessionId")
    failure = s.get("failureDetail")

    slicer = s.get("slicer", {})
    lh = slicer.get("layerHeightMm", 0.2)
    inf = slicer.get("infillPercent", 20)
    inf_type = slicer.get("infillType", "Gyroid")
    wl = slicer.get("wallLoops", 2)
    tb = slicer.get("topBottomLayers", {"top": 4, "bottom": 3})
    sup = slicer.get("supportType", "None")
    ang = slicer.get("supportOverhangAngle", 45)

    hw = s.get("hardware", {})
    spd = hw.get("speedF", {})
    spd_def = spd.get("defaultMmS", 60)
    spd_wall = spd.get("wallMmS", 150)
    spd_inf = spd.get("infillMmS", 275)

    temps = hw.get("tempsE", {})
    bed_t = temps.get("bedTempC", 60)
    noz_t = temps.get("nozzleTempC", 210)
    fan = temps.get("fanSpeedPercent", 100)

    ext = hw.get("extrusion", {})
    flow = ext.get("flowRatio", 0.98)
    ret = ext.get("retractionMm", 0.8)
    zh = ext.get("zHopMm", 0.4)

    status_text = "Hoàn tất thành công" if status == "COMPLETED" else ("Lỗi Warping" if status == "WARPING" else "Thất bại")
    parent_md = f"[[PHIEU_{parent}|Phiên {parent}]]" if parent else "Không có (Phiên gốc ban đầu)"

    return f"""---
ma_phien: "{s_id}"
nguoi_thuc_hien: "{op}"
thoi_gian: "{started}"
thoi_luong: "{dur} phút"
trang_thai: "{status}"
phien_goc: "{parent or '-'}"
tags:
  - printsim/phieu-in
  - printsim/phien-{s_id}
---

# 🖨️ Phiếu In Chi Tiết: PHIEU_{s_id}

> **Điều hướng:** [[000_PRINT_INDEX|MOC Tổng]] | [[nhat_ky_in|📋 Bảng Nhật Ký Tổng Hợp]]  
> **Người thực hiện:** `{op}` | **Bắt đầu lúc:** `{started}` (`{dur} phút`)  
> **Trạng thái:** `{status_text}` | **Phiên gốc:** {parent_md}

---

## 📌 Kết Quả & Hiện Tượng In
- **Đánh giá tổng quan:** {status_text}
- **Chi tiết lỗi / Ghi chú:** {failure if failure else "Không phát hiện lỗi nghiêm trọng. Quá trình in diễn ra ổn định hoàn toàn."}

---

## ⚙️ Cấu Hình Slicer & Khối (Cấu Trúc Lớp)
| Thông số | Giá trị thiết lập | Ghi chú kỹ thuật |
| :--- | :--- | :--- |
| **Độ cao lớp (Layer Height)** | `{lh:.2f} mm` | Chiều cao từng lớp đùn |
| **Mật độ ruột (Infill)** | `{inf}% ({inf_type})` | Cấu trúc rỗng bên trong |
| **Số vòng thành vách (Wall Loops)** | `{wl} vòng` | Độ dày vỏ ngoài |
| **Lớp Nóc / Đáy (Top/Bottom)** | `{tb.get('top', 4)} / {tb.get('bottom', 3)}` | Số lớp kín mặt trên & mặt đáy |
| **Giá đỡ & Góc (Support)** | `{sup} ({ang}°)` | Kiểu giá đỡ và ngưỡng góc dốc |

---

## 🎛️ Thông Số Phần Cứng & Đùn Nhựa (Hardware & Telemetry)
| Thành phần | Thiết lập | Chi tiết |
| :--- | :--- | :--- |
| **Tốc độ in mặc định** | `{spd_def} mm/s` | Tốc độ đẩy đầu phun cơ sở |
| **Tốc độ Vách • Ruột** | `{spd_wall} mm/s • {spd_inf} mm/s` | Vách ngoài và ruột khối |
| **Nhiệt độ bàn in** | `{bed_t}°C` | Độ bám dính đáy chống warping |
| **Nhiệt độ đầu in & Quạt gió** | `{noz_t}°C • {fan}%` | Nhiệt độ nóng chảy & làm nguội |
| **Hệ số đùn • Rút • Z-Hop** | `Dòng {flow:.2f} | Rút {ret}mm | Hop {zh}mm` | Kiểm soát đùn và chống xước mặt |

---
*Tự động đồng bộ bởi 3D PrintSim Telemetry Engine.*
"""


def create_app(
    repo: Optional[TelemetryRepositoryProtocol] = None,
    vault: Optional[VaultStorageProtocol] = None,
    time_provider: Optional[TimeProviderProtocol] = None,
    ai_service: Optional[object] = None,
) -> FastAPI:
    """Application factory for FastAPI Telemetry & Audit Service."""
    active_repo = repo or SQLiteTelemetryRepository(db_path=settings.db_path)
    active_vault = vault or ObsidianVaultAdapter(vault_root=settings.vault_root, json_root=settings.json_root)
    active_time = time_provider or SystemTimeProvider()
    active_ai = ai_service or GeminiAIService()
    churn_calc = CalculateParameterChurnUseCase()

    record_use_case = RecordTelemetryEventUseCase(repo=active_repo, time_provider=active_time)
    audit_use_case = GenerateDualAuditUseCase(
        repo=active_repo,
        vault=active_vault,
        time_provider=active_time,
        churn_calculator=churn_calc,
        ai_service=active_ai,
    )
    physics_use_case = PhysicsSanityCheckUseCase(repo=active_repo, vault=active_vault)

    app = FastAPI(
        title="3D PrintSim Pro - Telemetry & Audit Engine",
        version="2026.1",
        description="Clean Architecture Telemetry Ingestion & Obsidian Vault Dual-Output Audit Service",
    )

    # CORS configuration for Frontend Web App (Vite port 3001 & EM 3D port 5173)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_rfc9457_error_handlers(app)

    @app.get("/health", tags=["System"])
    async def health_check():
        return {"status": "healthy", "service": "3D PrintSim Pro Telemetry Engine", "version": "2026.1"}

    @app.post(
        "/api/v1/telemetry",
        response_model=TelemetryEventResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Telemetry"],
    )
    async def record_telemetry(payload: TelemetryEventRequest):
        input_dto = RecordTelemetryEventInput(
            session_id=payload.session_id,
            event_type=payload.event_type,
            parameter_name=payload.parameter_name,
            old_value=payload.old_value,
            new_value=payload.new_value,
            metadata=payload.metadata,
        )
        result = record_use_case.execute(input_dto)
        return TelemetryEventResponse(
            event_id=result.event_id,
            session_id=result.session_id,
            recorded_at=result.recorded_at.isoformat(),
        )

    @app.post(
        "/api/v1/sessions/{session_id:path}/audit",
        response_model=AuditGenerateResponse,
        status_code=status.HTTP_200_OK,
        tags=["Audit"],
    )
    async def generate_audit(
        session_id: str = Path(..., min_length=1),
        payload: Optional[AuditGenerateRequest] = None,
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

    @app.get(
        "/api/v1/sessions/{session_id:path}/audit",
        status_code=status.HTTP_200_OK,
        tags=["Audit"],
    )
    async def get_audit(session_id: str = Path(..., min_length=1)):
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)
        audit_json = active_vault.get_audit_json(session_id)
        if not audit_json:
            raise SessionNotFoundError(session_id)
        return JSONResponse(content=audit_json, status_code=status.HTTP_200_OK)

    @app.get(
        "/api/v1/nhat-ky",
        status_code=status.HTTP_200_OK,
        tags=["Locked Schema Logs"],
    )
    async def get_nhat_ky_json():
        """Returns the minimalist nhat_ky_in.json array according to the locked schema contract."""
        json_path = active_vault._resolve_safe_path("nhat_ky_in.json")
        if not json_path.exists():
            return JSONResponse(content=[], status_code=status.HTTP_200_OK)
        import json
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return JSONResponse(content=data, status_code=status.HTTP_200_OK)

    @app.get(
        "/api/v1/nhat-ky/markdown",
        status_code=status.HTTP_200_OK,
        tags=["Locked Schema Logs"],
    )
    async def get_nhat_ky_markdown():
        """Returns the minimalist nhat_ky_in.md content according to the locked schema contract."""
        from fastapi.responses import PlainTextResponse
        md_path = active_vault._resolve_safe_path("02_NhatKy_In/nhat_ky_in.md")
        if not md_path.exists():
            md_path = active_vault._resolve_safe_path("nhat_ky_in.md")
        if not md_path.exists():
            return PlainTextResponse("", status_code=status.HTTP_200_OK)
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()
        return PlainTextResponse(content, status_code=status.HTTP_200_OK)

    @app.post(
        "/api/v1/nhat-ky/save-session",
        status_code=status.HTTP_200_OK,
        tags=["Locked Schema Logs"],
    )
    async def save_session_log(payload: SaveSessionLogRequest):
        """Lưu hoặc cập nhật thông số phiên in vào nhat_ky_in.json, nhat_ky_in.md và PHIEU_{sessionId}.md trong Obsidian Vault."""
        json_path = active_vault._resolve_safe_path("nhat_ky_in.json")
        md_path = active_vault._resolve_safe_path("02_NhatKy_In/nhat_ky_in.md")
        vault_notes_dir = active_vault._vault_root / "02_NhatKy_In"
        vault_notes_dir.mkdir(parents=True, exist_ok=True)

        session_entry = payload.session
        s_id = str(session_entry.get("sessionId", "01"))

        # 1. Load existing sessions
        sessions = []
        if json_path.exists():
            try:
                import json
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

        import json
        from backend.src.infrastructure.minimalist_formatter import (
            build_parameter_session_matrix,
            render_markdown_log,
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
        active_vault._atomic_write(json_path, json.dumps(payload_data, indent=2, ensure_ascii=False))

        # 3. Generate and save nhat_ky_in.md (Obsidian master table)
        md_content = render_markdown_log(sessions)
        active_vault._atomic_write(md_path, md_content)

        # 4. Generate PHIEU_{s_id}.md for Obsidian (02_NhatKy_In)
        phieu_path = vault_notes_dir / f"PHIEU_{s_id}.md"
        phieu_md = _generate_phieu_markdown(session_entry)
        active_vault._atomic_write(phieu_path, phieu_md)

        # 5. Generate Profile_In3D_{s_id}.md for Obsidian (01_Profiles_In3D)
        profiles_dir = active_vault._vault_root / "01_Profiles_In3D"
        profiles_dir.mkdir(parents=True, exist_ok=True)
        profile_path = profiles_dir / f"Profile_In3D_{s_id}.md"
        profile_md = active_vault.render_3d_profile_from_dict(session_entry)
        active_vault._atomic_write(profile_path, profile_md)

        # 5. Update MOC (000_PRINT_INDEX.md)
        moc_path = active_vault._resolve_safe_path("000_PRINT_INDEX.md")
        session_table_rows = [
            f"| `{s.get('sessionId', f'{i+1:02d}')}` | [[Profile_In3D_{s.get('sessionId', f'{i+1:02d}')}|🎨 Profile In 3D #{s.get('sessionId', f'{i+1:02d}')}]] | [[PHIEU_{s.get('sessionId', f'{i+1:02d}')}|Phiếu #{s.get('sessionId', f'{i+1:02d}')}]] | `{s.get('startedAt', '-')}` | `{s.get('slicer', {}).get('layerHeightMm', 0.2)}mm` | `01_Profiles_In3D/` | `02_NhatKy_In/` |"
            for i, s in enumerate(sessions)
        ]
        session_table_str = "\\n".join(session_table_rows)
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
        active_vault._atomic_write(moc_path, moc_content)

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
            },
            status_code=status.HTTP_200_OK,
        )

    @app.get(
        "/api/v1/inspect-parameters",
        status_code=status.HTTP_200_OK,
        tags=["Parameter Inspection"],
    )
    async def inspect_parameters():
        """Truy xuất danh mục toàn bộ các tham số có thể thay đổi của app và bảng ánh xạ report."""
        from backend.src.infrastructure.minimalist_formatter import APP_CHANGEABLE_PARAMETERS
        return JSONResponse(
            content={
                "status": "success",
                "total_parameters": len(APP_CHANGEABLE_PARAMETERS),
                "parameters": APP_CHANGEABLE_PARAMETERS,
                "locked_report_targets": [p for p in APP_CHANGEABLE_PARAMETERS if p["is_report_target"]],
            },
            status_code=status.HTTP_200_OK,
        )

    @app.get(
        "/api/v1/sessions/{session_id:path}/report-params",
        status_code=status.HTTP_200_OK,
        tags=["Parameter Inspection"],
    )
    async def get_session_report_params(session_id: str = Path(..., min_length=1)):
        """Truy xuất chính xác các thông số cần report từ phiên in hiện tại (Live Query)."""
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)

        events = active_repo.get_events_by_session(session_id)
        if not events:
            # Session exists or empty
            metrics = []
        else:
            metrics = churn_calc.execute(events)

        from backend.src.infrastructure.minimalist_formatter import (
            build_session_entry,
            extract_session_report_parameters,
            render_markdown_log,
        )

        extracted = extract_session_report_parameters(metrics)
        preview_session = build_session_entry(
            phien_index=1,
            metrics=metrics,
            nguoi_dung="Nguyễn Văn A",
            hanh_dong="Mô phỏng (50x) -> Bắt đầu in",
        )
        preview_markdown = render_markdown_log([preview_session])

        physics_result = physics_use_case.execute(profile=extracted, session_id=session_id)
        profile_3d_md = active_vault.render_3d_profile_from_dict(preview_session)

        return JSONResponse(
            content={
                "session_id": session_id,
                "total_events": len(events),
                "extracted_report": extracted,
                "preview_entry_json": preview_session,
                "preview_markdown": preview_markdown,
                "profile_3d": {
                    "profile_id": f"PROFILE_{session_id}",
                    "model_name": preview_session.get("metadata", {}).get("modelName", "Mô hình 3D CoreXY"),
                    "material": preview_session.get("metadata", {}).get("material", "PLA"),
                    "status": preview_session.get("status", "COMPLETED"),
                    "printability_score": preview_session.get("metadata", {}).get("printabilityScore", 95),
                    "layer_height_mm": preview_session.get("slicer", {}).get("layerHeightMm", 0.20),
                    "infill_percent": preview_session.get("slicer", {}).get("infillPercent", 20),
                    "bed_temp_c": preview_session.get("hardware", {}).get("tempsE", {}).get("bedTempC", 60),
                    "nozzle_temp_c": preview_session.get("hardware", {}).get("tempsE", {}).get("nozzleTempC", 210),
                    "speed_mms": preview_session.get("hardware", {}).get("speedF", {}).get("defaultMmS", 60),
                    "markdown_path": f"01_Profiles_In3D/Profile_In3D_{session_id}.md",
                },
                "profile_3d_markdown": profile_3d_md,
                "physics_sanity_check": physics_result.to_dict(),
            },
            status_code=status.HTTP_200_OK,
        )

    @app.post(
        "/api/v1/physics/sanity-check",
        response_model=PhysicsSanityCheckResponse,
        status_code=status.HTTP_200_OK,
        tags=["Physics Sanity Engine"],
    )
    async def run_physics_sanity_check(payload: PhysicsSanityCheckRequest):
        """
        Runs comprehensive deterministic physics sanity checks on slicer parameters.
        Evaluates melt zone volumetric flow limit, warping thermal risk, cooling delamination,
        overhang collapse, and mechanical integrity before printing.
        """
        result = physics_use_case.execute(profile=payload.profile, session_id=payload.session_id)
        return PhysicsSanityCheckResponse(
            qc_risk_score=result.qc_risk_score,
            qc_health_score=result.qc_health_score,
            status=result.status,
            status_label=result.status_label,
            material=result.material,
            max_volumetric_flow_rate=result.max_volumetric_flow_rate,
            estimated_volumetric_flow_rate=result.estimated_volumetric_flow_rate,
            flow_headroom_percent=result.flow_headroom_percent,
            issues=[PhysicsIssueSchema(**i.to_dict()) for i in result.issues],
            passed_checks=result.passed_checks,
            summary=result.summary,
        )


    @app.get(
        "/api/v1/sessions/{session_id:path}/profile-3d",
        response_model=Profile3DResponse,
        status_code=status.HTTP_200_OK,
        tags=["Locked Schema Logs"],
    )
    async def get_session_profile_3d(session_id: str = Path(..., min_length=1)):
        """
        Truy xuất Hồ Sơ In 3D (3D Print Profile) được tổng hợp riêng cho mọi vai trò ngoài dev
        (Designers, Workshop Operators, Quản lý sản xuất).
        """
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)

        md_content = active_vault.get_3d_profile_md(session_id)
        if not md_content:
            # Fallback to see if session exists in nhat_ky_in.json
            json_path = active_vault._resolve_safe_path("nhat_ky_in.json")
            if json_path.exists():
                import json
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])
                    s = next((item for item in sessions if str(item.get("sessionId")) == session_id), None)
                    if s:
                        md_content = active_vault.render_3d_profile_from_dict(s)
                        prof_path = active_vault._vault_root / "01_Profiles_In3D" / f"Profile_In3D_{session_id}.md"
                        active_vault._atomic_write(prof_path, md_content)

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

    @app.get(
        "/api/v1/sessions/{session_id:path}/profile-3d/markdown",
        status_code=status.HTTP_200_OK,
        tags=["Locked Schema Logs"],
    )
    async def get_session_profile_3d_markdown(session_id: str = Path(..., min_length=1)):
        """Trả về nội dung Markdown thuần của Hồ Sơ In 3D cho Obsidian Preview."""
        from fastapi.responses import PlainTextResponse
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)

        md_content = active_vault.get_3d_profile_md(session_id)
        if not md_content:
            json_path = active_vault._resolve_safe_path("nhat_ky_in.json")
            if json_path.exists():
                import json
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])
                    s = next((item for item in sessions if str(item.get("sessionId")) == session_id), None)
                    if s:
                        md_content = active_vault.render_3d_profile_from_dict(s)
                        prof_path = active_vault._vault_root / "01_Profiles_In3D" / f"Profile_In3D_{session_id}.md"
                        active_vault._atomic_write(prof_path, md_content)

        if not md_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy Profile In 3D cho phiên {session_id}",
            )

        return PlainTextResponse(md_content, media_type="text/markdown", status_code=status.HTTP_200_OK)


    @app.get(
        "/api/v1/sessions/{session_id:path}/export-slicer",
        responses={
            200: {
                "description": "File preset đính kèm (download=True) hoặc JSON chi tiết (download=False)",
                "content": {
                    "application/octet-stream": {},
                    "application/json": {"schema": SlicerExportResponse.model_json_schema()},
                },
            }
        },
        status_code=status.HTTP_200_OK,
        tags=["Slicer Presets"],
    )
    async def export_slicer(
        session_id: str = Path(..., min_length=1),
        format: str = Query("orcaslicer", description="Slicer format: orcaslicer, bambulab, or prusaslicer"),
        download: bool = Query(True, description="True for file attachment download, False for JSON content"),
    ):
        """Xuất cấu hình Slicer thật (OrcaSlicer, Bambu Studio, PrusaSlicer) từ thông số phiên in."""
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)

        # 1. Tìm thông tin session từ nhat_ky_in.json
        json_path = active_vault._resolve_safe_path("nhat_ky_in.json")
        session_dict = None
        if json_path.exists():
            import json
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])
                session_dict = next((s for s in sessions if str(s.get("sessionId")) == session_id), None)

        if not session_dict:
            # Fallback to session report live extractor
            events = active_repo.get_events_by_session(session_id)
            metrics = churn_calc.execute(events) if events else []
            from backend.src.infrastructure.minimalist_formatter import build_session_entry
            session_dict = build_session_entry(
                phien_index=1,
                metrics=metrics,
                nguoi_dung="Kỹ sư in 3D",
                hanh_dong="Xuất Slicer Preset",
            )
            session_dict["sessionId"] = session_id

        from backend.src.infrastructure.slicer_exporter import export_slicer_preset
        content, filename, mime = export_slicer_preset(session_dict, format)

        # Tự động lưu vào ObsidianVault/01_Profiles_In3D/SlicerPresets/
        try:
            presets_dir = active_vault._vault_root / "01_Profiles_In3D" / "SlicerPresets"
            presets_dir.mkdir(parents=True, exist_ok=True)
            active_vault._atomic_write(presets_dir / filename, content)
        except Exception:
            pass

        if download:
            return Response(
                content=content,
                media_type=mime,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

        return JSONResponse(
            content={
                "status": "success",
                "session_id": session_id,
                "format": format,
                "filename": filename,
                "content": content,
                "saved_preset_path": f"01_Profiles_In3D/SlicerPresets/{filename}",
            },
            status_code=status.HTTP_200_OK,
        )

    @app.get(
        "/api/v1/sessions/compare",
        response_model=SessionComparisonResponse,
        status_code=status.HTTP_200_OK,
        tags=["Session Benchmarking"],
    )
    async def compare_two_sessions(
        base_id: str = Query(..., description="Mã phiên gốc ban đầu"),
        target_id: str = Query(..., description="Mã phiên mục tiêu đối chiếu"),
        save_report: bool = Query(True, description="Lưu báo cáo so sánh vào ObsidianVault/01_BaoCao_KiemDinh/"),
    ):
        """So sánh đối chiếu toàn diện 2 phiên in (Session Diff & Benchmark Engine)."""
        json_path = active_vault._resolve_safe_path("nhat_ky_in.json")
        if not json_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có dữ liệu nhat_ky_in.json")

        import json
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])

        base_s = next((s for s in sessions if str(s.get("sessionId")) == base_id), None)
        target_s = next((s for s in sessions if str(s.get("sessionId")) == target_id), None)

        if not base_s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy phiên gốc #{base_id}")
        if not target_s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy phiên mục tiêu #{target_id}")

        from backend.src.application.session_comparator import compare_sessions
        res = compare_sessions(base_s, target_s)

        if save_report:
            active_vault.save_comparison_report(res)

        return JSONResponse(content=res, status_code=status.HTTP_200_OK)

    @app.get(
        "/api/v1/sessions/compare/markdown",
        status_code=status.HTTP_200_OK,
        tags=["Session Benchmarking"],
    )
    async def compare_two_sessions_markdown(
        base_id: str = Query(..., description="Mã phiên gốc ban đầu"),
        target_id: str = Query(..., description="Mã phiên mục tiêu đối chiếu"),
    ):
        """Trả về nội dung Markdown thuần của báo cáo đối chiếu giữa 2 phiên."""
        json_path = active_vault._resolve_safe_path("nhat_ky_in.json")
        if not json_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có dữ liệu nhat_ky_in.json")

        import json
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            sessions = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])

        base_s = next((s for s in sessions if str(s.get("sessionId")) == base_id), None)
        target_s = next((s for s in sessions if str(s.get("sessionId")) == target_id), None)

        if not base_s or not target_s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy đủ 2 phiên để so sánh")

        from backend.src.application.session_comparator import compare_sessions
        res = compare_sessions(base_s, target_s)
        return PlainTextResponse(res["markdown"], media_type="text/markdown")

    @app.post(
        "/api/v1/sessions/{session_id:path}/thumbnail",
        response_model=ThumbnailUploadResponse,
        status_code=status.HTTP_200_OK,
        tags=["3D Thumbnails"],
    )
    async def upload_session_thumbnail(
        session_id: str = Path(..., min_length=1),
        payload: ThumbnailUploadRequest = Body(...),
    ):
        """Lưu ảnh thumbnail render 3D vào ObsidianVault/01_Profiles_In3D/Attachments/Thumb_{session_id}.png."""
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)

        img_b64 = payload.image_base64 or payload.thumbnail
        if not img_b64:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Thiếu dữ liệu image_base64")

        import base64
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

        rel_path, abs_path = active_vault.save_session_thumbnail(session_id, image_bytes, ext=ext)

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

    @app.get(
        "/api/v1/sessions/{session_id:path}/thumbnail",
        tags=["3D Thumbnails"],
    )
    async def get_session_thumbnail(session_id: str = Path(..., min_length=1)):
        """Phục vụ ảnh thumbnail 3D của phiên in."""
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            from backend.src.domain.exceptions import PathTraversalSecurityError
            raise PathTraversalSecurityError(session_id)

        thumb_path = active_vault.get_session_thumbnail_path(session_id)
        if not thumb_path or not thumb_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thumbnail cho phiên in này")

        ext = thumb_path.suffix.lstrip(".").lower()
        mime = f"image/{ext}" if ext in ["png", "webp"] else "image/jpeg"
        return FileResponse(thumb_path, media_type=mime)


    # ==============================================================================
    # ⚡ SUPABASE CLOUD HUB ENDPOINTS
    # ==============================================================================
    from backend.src.infrastructure.supabase_sync_service import supabase_service
    from backend.src.presentation.schemas import (
        SupabaseConfigRequest,
        SupabaseTestRequest,
        SupabaseTestResponse,
        SupabaseSyncResponse,
        SupabaseHubStatusResponse,
    )

    @app.get(
        "/api/v1/supabase/status",
        response_model=SupabaseHubStatusResponse,
        tags=["Supabase Cloud Hub"],
    )
    async def get_supabase_hub_status():
        """Tra cứu trạng thái kết nối & số lượng dữ liệu sẵn sàng đồng bộ lên Supabase."""
        return JSONResponse(
            content=supabase_service.get_status(
                vault_root=active_vault._vault_root,
                json_root=active_vault._json_root,
            ),
            status_code=status.HTTP_200_OK,
        )

    @app.post(
        "/api/v1/supabase/test",
        response_model=SupabaseTestResponse,
        tags=["Supabase Cloud Hub"],
    )
    async def test_supabase_connection(payload: Optional[SupabaseTestRequest] = None):
        """Kiểm tra tính hợp lệ của Project URL và API Key đến Supabase."""
        url = payload.url if payload else None
        key = payload.key if payload else None
        res = await supabase_service.test_connection(url=url, key=key)
        return JSONResponse(content=res, status_code=status.HTTP_200_OK)

    @app.post(
        "/api/v1/supabase/config",
        response_model=SupabaseHubStatusResponse,
        tags=["Supabase Cloud Hub"],
    )
    async def update_supabase_config(payload: SupabaseConfigRequest):
        """Cập nhật thông tin kết nối Supabase Cloud Hub."""
        supabase_service.update_config(
            url=payload.url,
            key=payload.key,
            auto_sync=payload.auto_sync,
        )
        return JSONResponse(
            content=supabase_service.get_status(
                vault_root=active_vault._vault_root,
                json_root=active_vault._json_root,
            ),
            status_code=status.HTTP_200_OK,
        )

    @app.post(
        "/api/v1/supabase/sync",
        response_model=SupabaseSyncResponse,
        tags=["Supabase Cloud Hub"],
    )
    async def trigger_supabase_sync():
        """Kích hoạt đồng bộ toàn phần 1-click (Sessions & Hồ sơ 3D) lên Supabase."""
        res = await supabase_service.sync_all(
            vault_root=active_vault._vault_root,
            json_root=active_vault._json_root,
        )
        return JSONResponse(content=res, status_code=status.HTTP_200_OK)

    @app.get(
        "/api/v1/supabase/sql-schema",
        tags=["Supabase Cloud Hub"],
    )
    async def get_supabase_sql_schema():
        """Cung cấp mã SQL migration hoàn chỉnh để khởi tạo bảng trên Supabase SQL Editor."""
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(
            content=supabase_service.get_sql_migration_script(),
            status_code=status.HTTP_200_OK,
        )

    return app




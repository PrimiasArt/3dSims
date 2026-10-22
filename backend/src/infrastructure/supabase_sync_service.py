"""
Supabase Cloud Hub Integration Service.
Orchestrates bidirectional synchronization of 3D Print Sessions, Telemetry Logs,
and 3D Profiles & QC Audit Reports to Supabase PostgreSQL Database.
"""
import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

from backend.src.infrastructure.config import settings

logger = logging.getLogger(__name__)


def _mask_key(key: str) -> str:
    """Safely mask API key for presentation."""
    if not key:
        return ""
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"


class SupabaseSyncService:
    """Manages Supabase connection, schema verification, and batch sync operations."""

    def __init__(self) -> None:
        self.url: str = settings.supabase_url.strip()
        self.key: str = settings.supabase_key.strip()
        self.auto_sync: bool = settings.supabase_auto_sync
        self.last_synced_at: Optional[str] = None
        self.last_sync_result: Optional[Dict[str, Any]] = None
        self._client = None
        self._init_client()

    def _init_client(self) -> None:
        """Attempts to initialize official Supabase client if credentials exist."""
        if self.url and self.key:
            try:
                from supabase import create_client  # type: ignore
                self._client = create_client(self.url, self.key)
                logger.info(f"Supabase client initialized for {self.url}")
            except Exception as e:
                logger.warning(f"Failed to initialize Supabase Python client: {e}. Will fallback to REST HTTPX.")
                self._client = None
        else:
            self._client = None

    def update_config(self, url: str, key: str, auto_sync: bool = False) -> None:
        """Updates in-memory configuration and re-initializes client."""
        self.url = url.strip()
        self.key = key.strip()
        self.auto_sync = auto_sync
        self._init_client()

    def get_status(self, vault_root: Optional[Path] = None, json_root: Optional[Path] = None) -> Dict[str, Any]:
        """Returns the current connection and local synchronization status."""
        v_root = vault_root or Path(settings.vault_root)
        j_root = json_root or Path(settings.json_root)

        # Count local sessions
        local_sessions = 0
        nhat_ky_file = j_root / "nhat_ky_in.json"
        if not nhat_ky_file.exists():
            nhat_ky_file = v_root / "nhat_ky_in.json"
        if not nhat_ky_file.exists():
            nhat_ky_file = v_root / "02_NhatKy_In" / "nhat_ky_in.json"

        if nhat_ky_file.exists():
            try:
                with open(nhat_ky_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        local_sessions = data.get("total_sessions") or data.get("tong_so_phien") or len(data.get("sessions", [])) or len(data.get("chi_tiet_tung_phien", [])) or len(data.get("danh_sach_phien", []))
                    elif isinstance(data, list):
                        local_sessions = len(data)
            except Exception as e:
                logger.error(f"Error reading nhat_ky_in.json count: {e}")

        # Count local 3D profiles
        local_profiles = 0
        profiles_dir = v_root / "01_Profiles_In3D"
        if profiles_dir.exists():
            local_profiles = len(list(profiles_dir.glob("Profile_In3D_*.md")))

        return {
            "configured": bool(self.url and self.key),
            "url": self.url or "",
            "masked_key": _mask_key(self.key),
            "auto_sync": self.auto_sync,
            "last_synced_at": self.last_synced_at,
            "last_sync_result": self.last_sync_result,
            "local_sessions_count": local_sessions,
            "local_profiles_count": local_profiles,
        }

    async def test_connection(self, url: Optional[str] = None, key: Optional[str] = None) -> Dict[str, Any]:
        """Pings Supabase REST endpoint to verify project existence and API key validity."""
        test_url = (url or self.url or "").strip().rstrip("/")
        test_key = (key or self.key or "").strip()

        if not test_url or not test_key:
            return {
                "connected": False,
                "message": "Vui lòng nhập đầy đủ Supabase Project URL và API Key.",
                "url": test_url,
            }

        if not test_url.startswith(("http://", "https://")):
            return {
                "connected": False,
                "message": "Project URL không hợp lệ. URL phải bắt đầu bằng https://",
                "url": test_url,
            }

        headers = {
            "apikey": test_key,
            "Authorization": f"Bearer {test_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(f"{test_url}/rest/v1/", headers=headers)
                if res.status_code in (200, 204):
                    return {
                        "connected": True,
                        "message": "Kết nối thành công tới Supabase Project!",
                        "url": test_url,
                        "status_code": res.status_code,
                    }
                elif res.status_code in (401, 403):
                    return {
                        "connected": False,
                        "message": "API Key không hợp lệ hoặc không có quyền truy cập.",
                        "url": test_url,
                        "status_code": res.status_code,
                    }
                else:
                    return {
                        "connected": True,
                        "message": f"Máy chủ Supabase phản hồi với mã HTTP {res.status_code}.",
                        "url": test_url,
                        "status_code": res.status_code,
                    }
        except httpx.RequestError as e:
            return {
                "connected": False,
                "message": f"Không thể kết nối đến máy chủ Supabase: {str(e)}",
                "url": test_url,
            }

    async def sync_sessions(self, json_root: Optional[Path] = None, vault_root: Optional[Path] = None) -> Dict[str, Any]:
        """Extracts sessions from nhat_ky_in.json and upserts into Supabase 'print_sessions' table."""
        if not self.url or not self.key:
            return {"success": False, "count": 0, "error": "Chưa cấu hình Supabase URL và Key"}

        j_root = json_root or Path(settings.json_root)
        v_root = vault_root or Path(settings.vault_root)

        nhat_ky_file = j_root / "nhat_ky_in.json"
        if not nhat_ky_file.exists():
            nhat_ky_file = v_root / "nhat_ky_in.json"
        if not nhat_ky_file.exists():
            nhat_ky_file = v_root / "02_NhatKy_In" / "nhat_ky_in.json"

        if not nhat_ky_file.exists():
            return {"success": True, "count": 0, "message": "Không tìm thấy file nhat_ky_in.json"}

        with open(nhat_ky_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        raw_sessions: List[Dict[str, Any]] = []
        if isinstance(data, dict):
            raw_sessions = data.get("sessions") or data.get("chi_tiet_tung_phien") or data.get("bang_tong_hop", [])
        elif isinstance(data, list):
            raw_sessions = data

        if not raw_sessions:
            return {"success": True, "count": 0, "message": "Không có phiên in nào để đồng bộ"}

        rows: List[Dict[str, Any]] = []
        now_iso = datetime.now(timezone.utc).isoformat()

        for s in raw_sessions:
            sid = str(s.get("sessionId") or s.get("ma_phien") or "").strip()
            if not sid:
                continue

            slicer = s.get("slicer", {})
            hardware = s.get("hardware", {})
            speed_f = hardware.get("speedF", {})
            temp_c = hardware.get("temperatureC", {})
            ext = hardware.get("extrusion", {})
            locked = s.get("lockedContract", {})

            # Parse nozzle temp
            nozzle_val = 210.0
            raw_nozzle = temp_c.get("nozzleFanPercent") or temp_c.get("nozzle") or "210"
            try:
                nozzle_val = float(str(raw_nozzle).split()[0].replace("°C", "").strip())
            except Exception:
                pass

            row = {
                "id": sid,
                "session_code": f"PHIEU_{sid.zfill(2)}",
                "started_at": s.get("startedAt") or s.get("timestamp") or now_iso,
                "status": s.get("status", "COMPLETED"),
                "user_name": s.get("operator") or s.get("nguoi_thuc_hien") or "Kỹ sư in 3D",
                "model_name": s.get("modelName", "Benchy"),
                "material": s.get("material") or slicer.get("material") or "PLA",
                "layer_height": float(slicer.get("layerHeightMm") or locked.get("A_do_day_lop") or 0.2),
                "infill_density": float(slicer.get("infillPercent") or locked.get("C_do_rong") or 20),
                "print_speed": float(speed_f.get("defaultMmS") or locked.get("F_toc_do_day") or 60),
                "flow_ratio": float(ext.get("flowRatio") or 1.0),
                "retraction_mm": float(ext.get("retractionMm") or 0.8),
                "nozzle_temp": nozzle_val,
                "bed_temp": float(temp_c.get("bed") or locked.get("E_nhiet_ban_in") or 60),
                "score": float(s.get("score") or 100),
                "notes": s.get("failureDetail") or s.get("notes") or "",
                "telemetry_json": s,
                "synced_at": now_iso,
            }
            rows.append(row)

        # Upsert into Supabase via REST / Client
        return await self._upsert_table("print_sessions", rows)

    async def sync_profiles(self, vault_root: Optional[Path] = None, json_root: Optional[Path] = None) -> Dict[str, Any]:
        """Extracts 3D profiles and QC scores and upserts into Supabase 'profiles_3d' table."""
        if not self.url or not self.key:
            return {"success": False, "count": 0, "error": "Chưa cấu hình Supabase URL và Key"}

        v_root = vault_root or Path(settings.vault_root)
        j_root = json_root or Path(settings.json_root)
        profiles_dir = v_root / "01_Profiles_In3D"
        now_iso = datetime.now(timezone.utc).isoformat()

        if not profiles_dir.exists():
            return {"success": True, "count": 0, "message": "Không tìm thấy thư mục 01_Profiles_In3D"}

        profile_files = list(profiles_dir.glob("Profile_In3D_*.md"))
        if not profile_files:
            return {"success": True, "count": 0, "message": "Không có file hồ sơ 3D nào"}

        rows: List[Dict[str, Any]] = []

        for p_file in profile_files:
            pid = p_file.stem.replace("Profile_In3D_", "").strip()
            if not pid:
                continue

            try:
                md_content = p_file.read_text(encoding="utf-8")
            except Exception:
                md_content = ""

            # Try to read matching JSON audit log for precise QC score
            audit_json_file = j_root / f"Audit_{pid}.json"
            if not audit_json_file.exists():
                audit_json_file = j_root / f"Audit_{pid}_PROD.json"

            qc_score = 100.0
            material = "PLA"
            slicer_data = {}

            if audit_json_file.exists():
                try:
                    with open(audit_json_file, "r", encoding="utf-8") as f:
                        a_data = json.load(f)
                        qc_score = float(a_data.get("qc_score") or a_data.get("score") or 100)
                        material = a_data.get("material") or "PLA"
                        slicer_data = a_data
                except Exception:
                    pass

            row = {
                "id": f"Profile_In3D_{pid}",
                "profile_code": f"PROD_{pid}",
                "name": f"Hồ Sơ Cấu Hình In 3D #{pid}",
                "material": material,
                "qc_score": qc_score,
                "layer_height": 0.2,
                "infill_density": 20,
                "print_speed": 60,
                "nozzle_temp": 210,
                "bed_temp": 60,
                "locked_contract": {
                    "layerHeight": 0.2,
                    "infillDensity": 20,
                    "material": material,
                },
                "slicer_settings": slicer_data,
                "markdown_content": md_content,
                "updated_at": now_iso,
                "synced_at": now_iso,
            }
            rows.append(row)

        return await self._upsert_table("profiles_3d", rows)

    async def _upsert_table(self, table_name: str, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Batch upserts rows into the target Supabase table."""
        if not rows:
            return {"success": True, "count": 0}

        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        endpoint = f"{self.url.rstrip('/')}/rest/v1/{table_name}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(endpoint, headers=headers, json=rows)
                if res.status_code in (200, 201):
                    return {"success": True, "count": len(rows), "status_code": res.status_code}
                else:
                    return {
                        "success": False,
                        "count": 0,
                        "status_code": res.status_code,
                        "error": f"Supabase API error ({res.status_code}): {res.text}",
                    }
        except Exception as e:
            return {"success": False, "count": 0, "error": str(e)}

    async def sync_all(self, vault_root: Optional[Path] = None, json_root: Optional[Path] = None) -> Dict[str, Any]:
        """Performs 1-click comprehensive synchronization of Sessions and 3D Profiles."""
        start_time = datetime.now(timezone.utc)
        sessions_res = await self.sync_sessions(json_root=json_root, vault_root=vault_root)
        profiles_res = await self.sync_profiles(vault_root=vault_root, json_root=json_root)

        success = sessions_res.get("success", False) and profiles_res.get("success", False)
        duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        now_iso = start_time.isoformat()

        errors = []
        if not sessions_res.get("success"):
            errors.append(f"Sessions: {sessions_res.get('error')}")
        if not profiles_res.get("success"):
            errors.append(f"Profiles: {profiles_res.get('error')}")

        result = {
            "success": success,
            "sessions_synced": sessions_res.get("count", 0),
            "profiles_synced": profiles_res.get("count", 0),
            "duration_ms": duration_ms,
            "timestamp": now_iso,
            "message": "Đồng bộ thành công lên Supabase!" if success else "Đồng bộ có lỗi xảy ra.",
            "errors": errors,
        }

        self.last_synced_at = now_iso
        self.last_sync_result = result
        return result

    def get_sql_migration_script(self) -> str:
        """Returns ready-to-execute PostgreSQL DDL migration script for Supabase SQL Editor."""
        return """-- ==============================================================================
-- 🚀 SUPABASE CLOUD HUB: 3D PRINTSIM TELEMETRY & QC PROFILES SCHEMA
-- Hướng dẫn: Mở Supabase Studio -> SQL Editor -> Dán toàn bộ đoạn mã này và bấm Run.
-- ==============================================================================

-- 1. BẢNG NHẬT KÝ PHIÊN IN & TELEMETRY CẢM BIẾN (print_sessions)
CREATE TABLE IF NOT EXISTS public.print_sessions (
    id TEXT PRIMARY KEY,
    session_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TEXT,
    status TEXT DEFAULT 'COMPLETED',
    user_name TEXT,
    model_name TEXT,
    material TEXT,
    layer_height NUMERIC,
    infill_density NUMERIC,
    print_speed NUMERIC,
    flow_ratio NUMERIC,
    retraction_mm NUMERIC,
    nozzle_temp NUMERIC,
    bed_temp NUMERIC,
    score NUMERIC DEFAULT 100,
    notes TEXT,
    telemetry_json JSONB,
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- 2. BẢNG HỒ SƠ CẤU HÌNH IN 3D & KIỂM ĐỊNH QC (profiles_3d)
CREATE TABLE IF NOT EXISTS public.profiles_3d (
    id TEXT PRIMARY KEY,
    profile_code TEXT,
    name TEXT,
    material TEXT,
    qc_score NUMERIC DEFAULT 100,
    layer_height NUMERIC,
    infill_density NUMERIC,
    print_speed NUMERIC,
    nozzle_temp NUMERIC,
    bed_temp NUMERIC,
    locked_contract JSONB,
    slicer_settings JSONB,
    markdown_content TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CHÍNH SÁCH BẢO MẬT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.print_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_3d ENABLE ROW LEVEL SECURITY;

-- Cho phép cả Anon Key (Client) và Service Role Key đọc/ghi dữ liệu
DROP POLICY IF EXISTS "Public Full Access on print_sessions" ON public.print_sessions;
CREATE POLICY "Public Full Access on print_sessions" ON public.print_sessions
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access on profiles_3d" ON public.profiles_3d;
CREATE POLICY "Public Full Access on profiles_3d" ON public.profiles_3d
    FOR ALL USING (true) WITH CHECK (true);

-- 4. TẠO INDEX TĂNG TỐC ĐỘ TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_print_sessions_status ON public.print_sessions(status);
CREATE INDEX IF NOT EXISTS idx_print_sessions_synced_at ON public.print_sessions(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_3d_material ON public.profiles_3d(material);
CREATE INDEX IF NOT EXISTS idx_profiles_3d_qc_score ON public.profiles_3d(qc_score DESC);

-- Hoàn tất thiết lập bảng Supabase Cloud Hub!
"""

# Global singleton service
supabase_service = SupabaseSyncService()

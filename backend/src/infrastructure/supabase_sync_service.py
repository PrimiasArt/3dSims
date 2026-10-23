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


def _parse_frontmatter(md_text: str) -> Dict[str, Any]:
    """Extracts YAML frontmatter key-values from markdown file."""
    if not md_text.startswith("---"):
        return {}
    parts = md_text.split("---", 2)
    if len(parts) < 3:
        return {}
    fm_text = parts[1]
    data: Dict[str, Any] = {}
    for line in fm_text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        if ":" in line:
            k, v = line.split(":", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if v.lower() == "true":
                data[k] = True
            elif v.lower() == "false":
                data[k] = False
            else:
                try:
                    if "." in v:
                        data[k] = float(v)
                    else:
                        data[k] = int(v)
                except ValueError:
                    data[k] = v
    return data



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

            metadata = s.get("metadata", {}) if isinstance(s.get("metadata"), dict) else {}
            slicer = s.get("slicer", {}) if isinstance(s.get("slicer"), dict) else {}
            hardware = s.get("hardware", {}) if isinstance(s.get("hardware"), dict) else {}
            speed_f = hardware.get("speedF", {}) if isinstance(hardware.get("speedF"), dict) else {}
            temps_e = hardware.get("tempsE", {}) if isinstance(hardware.get("tempsE"), dict) else {}
            temp_c = hardware.get("temperatureC", {}) if isinstance(hardware.get("temperatureC"), dict) else {}
            ext = hardware.get("extrusion", {}) if isinstance(hardware.get("extrusion"), dict) else {}
            locked = s.get("lockedContract", {}) if isinstance(s.get("lockedContract"), dict) else {}

            # Parse nozzle temp (priority: hardware.tempsE -> hardware.temperatureC -> lockedContract -> default 210)
            nozzle_val = 210.0
            if temps_e.get("nozzleTempC") is not None:
                try:
                    nozzle_val = float(temps_e["nozzleTempC"])
                except Exception:
                    pass
            elif temp_c.get("nozzle") is not None or temp_c.get("nozzleFanPercent") is not None:
                raw_nozzle = temp_c.get("nozzleFanPercent") or temp_c.get("nozzle")
                try:
                    nozzle_val = float(str(raw_nozzle).split()[0].replace("°C", "").strip())
                except Exception:
                    pass
            elif locked.get("D_nhiet_dau_in") is not None:
                try:
                    nozzle_val = float(locked["D_nhiet_dau_in"])
                except Exception:
                    pass

            # Parse bed temp (priority: hardware.tempsE -> hardware.temperatureC -> lockedContract -> default 60)
            bed_val = 60.0
            if temps_e.get("bedTempC") is not None:
                try:
                    bed_val = float(temps_e["bedTempC"])
                except Exception:
                    pass
            elif temp_c.get("bed") is not None:
                try:
                    bed_val = float(temp_c["bed"])
                except Exception:
                    pass
            elif locked.get("E_nhiet_ban_in") is not None:
                try:
                    bed_val = float(locked["E_nhiet_ban_in"])
                except Exception:
                    pass

            # Parse speed
            speed_val = 60.0
            raw_spd = speed_f.get("defaultMmS") if speed_f.get("defaultMmS") is not None else locked.get("F_toc_do_day")
            if raw_spd is not None:
                try:
                    speed_val = float(raw_spd)
                except Exception:
                    pass

            # Parse layer height
            lh_val = 0.2
            raw_lh = slicer.get("layerHeightMm") if slicer.get("layerHeightMm") is not None else locked.get("A_do_day_lop")
            if raw_lh is not None:
                try:
                    lh_val = float(raw_lh)
                except Exception:
                    pass

            # Parse infill
            infill_val = 20.0
            raw_inf = slicer.get("infillPercent") if slicer.get("infillPercent") is not None else locked.get("C_do_rong")
            if raw_inf is not None:
                try:
                    infill_val = float(raw_inf)
                except Exception:
                    pass

            # Parse score
            score_val = 100.0
            raw_score = metadata.get("printabilityScore") if metadata.get("printabilityScore") is not None else s.get("score")
            if raw_score is not None:
                try:
                    score_val = float(raw_score)
                except Exception:
                    pass

            # Model and material
            model_name = metadata.get("modelName") or s.get("modelName") or "Benchy"
            material = metadata.get("material") or s.get("material") or slicer.get("material") or "PLA"

            row = {
                "id": sid,
                "session_code": f"PHIEU_{sid.zfill(2)}",
                "started_at": s.get("startedAt") or s.get("timestamp") or now_iso,
                "status": s.get("status", "COMPLETED"),
                "user_name": s.get("operator") or s.get("nguoi_thuc_hien") or "Kỹ sư in 3D",
                "model_name": model_name,
                "material": material,
                "layer_height": lh_val,
                "infill_density": infill_val,
                "print_speed": speed_val,
                "flow_ratio": float(ext.get("flowRatio") if ext.get("flowRatio") is not None else 1.0),
                "retraction_mm": float(ext.get("retractionMm") if ext.get("retractionMm") is not None else 0.8),
                "nozzle_temp": nozzle_val,
                "bed_temp": bed_val,
                "score": score_val,
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

        # Load local sessions for cross-referencing full parameters if available
        local_sessions_map: Dict[str, Dict[str, Any]] = {}
        nhat_ky_file = j_root / "nhat_ky_in.json"
        if not nhat_ky_file.exists():
            nhat_ky_file = v_root / "nhat_ky_in.json"
        if not nhat_ky_file.exists():
            nhat_ky_file = v_root / "02_NhatKy_In" / "nhat_ky_in.json"
        if nhat_ky_file.exists():
            try:
                with open(nhat_ky_file, "r", encoding="utf-8") as f:
                    nk_data = json.load(f)
                    sess_list = []
                    if isinstance(nk_data, dict):
                        sess_list = nk_data.get("sessions") or nk_data.get("chi_tiet_tung_phien") or nk_data.get("bang_tong_hop", [])
                    elif isinstance(nk_data, list):
                        sess_list = nk_data
                    for s in sess_list:
                        s_id = str(s.get("sessionId", "")).strip()
                        if s_id:
                            local_sessions_map[s_id] = s
                            local_sessions_map[s_id.lstrip("0")] = s
            except Exception:
                pass

        rows: List[Dict[str, Any]] = []

        for p_file in profile_files:
            pid = p_file.stem.replace("Profile_In3D_", "").strip()
            if not pid:
                continue

            try:
                md_content = p_file.read_text(encoding="utf-8")
            except Exception:
                md_content = ""

            fm = _parse_frontmatter(md_content)

            # Look up matching session from local_sessions_map
            matched_sess = (
                local_sessions_map.get(pid) or
                local_sessions_map.get(pid.lstrip("0")) or
                local_sessions_map.get(pid.replace("_PROD", ""))
            )

            # Try to read matching JSON audit log for precise QC score / metrics
            audit_json_file = j_root / f"Audit_{pid}.json"
            if not audit_json_file.exists():
                audit_json_file = j_root / f"Audit_{pid}_PROD.json"

            a_data: Dict[str, Any] = {}
            if audit_json_file.exists():
                try:
                    with open(audit_json_file, "r", encoding="utf-8") as f:
                        a_data = json.load(f)
                except Exception:
                    a_data = {}

            # Determine QC score
            qc_score = 100.0
            if a_data.get("qc_score") is not None:
                qc_score = float(a_data["qc_score"])
            elif a_data.get("score") is not None:
                qc_score = float(a_data["score"])
            elif fm.get("diem_chat_luong") is not None:
                qc_score = float(fm["diem_chat_luong"])
            elif matched_sess:
                meta = matched_sess.get("metadata", {})
                score_candidate = meta.get("printabilityScore") if meta.get("printabilityScore") is not None else matched_sess.get("score")
                if score_candidate is not None:
                    qc_score = float(score_candidate)

            # Determine material
            material = str(
                fm.get("vat_lieu") or fm.get("material") or
                a_data.get("material") or
                (matched_sess.get("metadata", {}).get("material") if matched_sess else None) or
                (matched_sess.get("material") if matched_sess else None) or
                "PLA"
            )

            # Determine model name
            model_name = str(
                fm.get("ten_mo_hinh") or fm.get("model_name") or
                (matched_sess.get("metadata", {}).get("modelName") if matched_sess else None) or
                f"Hồ Sơ Cấu Hình In 3D #{pid}"
            )

            # Layer height
            layer_height = 0.2
            if fm.get("do_day_lop_mm") is not None:
                layer_height = float(fm["do_day_lop_mm"])
            elif fm.get("layer_height_mm") is not None:
                layer_height = float(fm["layer_height_mm"])
            elif matched_sess and matched_sess.get("slicer", {}).get("layerHeightMm") is not None:
                layer_height = float(matched_sess["slicer"]["layerHeightMm"])

            # Infill density
            infill_density = 20.0
            if fm.get("infill_percent") is not None:
                infill_density = float(fm["infill_percent"])
            elif fm.get("mat_do_ruot") is not None:
                infill_density = float(fm["mat_do_ruot"])
            elif matched_sess and matched_sess.get("slicer", {}).get("infillPercent") is not None:
                infill_density = float(matched_sess["slicer"]["infillPercent"])

            # Print speed
            print_speed = 60.0
            if fm.get("toc_do_in_mms") is not None:
                print_speed = float(fm["toc_do_in_mms"])
            elif fm.get("print_speed_mms") is not None:
                print_speed = float(fm["print_speed_mms"])
            elif matched_sess and matched_sess.get("hardware", {}).get("speedF", {}).get("defaultMmS") is not None:
                print_speed = float(matched_sess["hardware"]["speedF"]["defaultMmS"])

            # Nozzle temp
            nozzle_temp = 210.0
            if fm.get("nhiet_do_dau_in_c") is not None:
                nozzle_temp = float(fm["nhiet_do_dau_in_c"])
            elif fm.get("nozzle_temp_c") is not None:
                nozzle_temp = float(fm["nozzle_temp_c"])
            elif matched_sess and matched_sess.get("hardware", {}).get("tempsE", {}).get("nozzleTempC") is not None:
                nozzle_temp = float(matched_sess["hardware"]["tempsE"]["nozzleTempC"])

            # Bed temp
            bed_temp = 60.0
            if fm.get("nhiet_do_ban_c") is not None:
                bed_temp = float(fm["nhiet_do_ban_c"])
            elif fm.get("bed_temp_c") is not None:
                bed_temp = float(fm["bed_temp_c"])
            elif matched_sess and matched_sess.get("hardware", {}).get("tempsE", {}).get("bedTempC") is not None:
                bed_temp = float(matched_sess["hardware"]["tempsE"]["bedTempC"])

            slicer_data = a_data if a_data else (matched_sess.get("slicer", {}) if matched_sess else {})

            row = {
                "id": f"Profile_In3D_{pid}",
                "profile_code": f"PROD_{pid}",
                "name": model_name,
                "material": material,
                "qc_score": qc_score,
                "layer_height": layer_height,
                "infill_density": infill_density,
                "print_speed": print_speed,
                "nozzle_temp": nozzle_temp,
                "bed_temp": bed_temp,
                "locked_contract": {
                    "layerHeight": layer_height,
                    "infillDensity": infill_density,
                    "material": material,
                    "nozzleTemp": nozzle_temp,
                    "bedTemp": bed_temp,
                    "printSpeed": print_speed,
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
            "total_synced": sessions_res.get("count", 0) + profiles_res.get("count", 0),
            "duration_ms": duration_ms,
            "timestamp": now_iso,
            "message": "Đồng bộ thành công lên Supabase!" if success else "Đồng bộ có lỗi xảy ra.",
            "errors": errors,
        }

        self.last_synced_at = now_iso
        self.last_sync_result = result
        return result

    async def pull_sessions(self, json_root: Optional[Path] = None, vault_root: Optional[Path] = None) -> Dict[str, Any]:
        """
        Pulls print sessions from Supabase cloud database and synchronizes into local storage:
        - Updates nhat_ky_in.json (preserves or updates existing, appends missing)
        - Re-generates 02_NhatKy_In/nhat_ky_in.md and individual PHIEU_*.md
        - Re-generates 000_PRINT_INDEX.md (MOC)
        """
        if not self.url or not self.key:
            return {"success": False, "count": 0, "error": "Chưa cấu hình Supabase URL và Key"}

        j_root = json_root or Path(settings.json_root)
        v_root = vault_root or Path(settings.vault_root)

        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        endpoint = f"{self.url.rstrip('/')}/rest/v1/print_sessions?select=*&order=id.asc"

        remote_rows: List[Dict[str, Any]] = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(endpoint, headers=headers)
                if res.status_code in (200, 204):
                    remote_rows = res.json() if res.text.strip() else []
                else:
                    return {
                        "success": False,
                        "count": 0,
                        "error": f"Lỗi truy vấn Supabase ({res.status_code}): {res.text}",
                    }
        except Exception as e:
            return {"success": False, "count": 0, "error": f"Không thể kết nối Supabase: {str(e)}"}

        if not remote_rows:
            return {"success": True, "count": 0, "message": "Không có phiên in nào trên Supabase Cloud để đồng bộ."}

        # 1. Read existing local sessions
        nhat_ky_file = j_root / "nhat_ky_in.json"
        local_sessions: List[Dict[str, Any]] = []
        if nhat_ky_file.exists():
            try:
                with open(nhat_ky_file, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    if isinstance(d, dict):
                        local_sessions = d.get("sessions") or d.get("chi_tiet_tung_phien") or []
                    elif isinstance(d, list):
                        local_sessions = d
            except Exception:
                local_sessions = []

        # 2. Merge remote sessions into local
        session_map = {str(s.get("sessionId")): s for s in local_sessions if s.get("sessionId")}

        from backend.src.infrastructure.formatters import (
            build_parameter_session_matrix,
            render_markdown_log,
            render_phieu_markdown,
        )

        for row in remote_rows:
            sid = str(row.get("id") or "").strip()
            if not sid:
                continue

            bed_val = float(row.get("bed_temp") if row.get("bed_temp") is not None else 60)
            noz_val = float(row.get("nozzle_temp") if row.get("nozzle_temp") is not None else 210)
            spd_val = float(row.get("print_speed") if row.get("print_speed") is not None else 60)
            lh_val = float(row.get("layer_height") if row.get("layer_height") is not None else 0.2)
            infill_val = float(row.get("infill_density") if row.get("infill_density") is not None else 20)
            mat_val = str(row.get("material") or "PLA")
            model_val = str(row.get("model_name") or "Mô hình 3D")
            score_val = float(row.get("score") if row.get("score") is not None else 100)

            telemetry = row.get("telemetry_json")
            if isinstance(telemetry, dict) and telemetry.get("sessionId"):
                session_entry = telemetry
            else:
                session_entry = {
                    "sessionId": sid,
                    "operator": row.get("user_name", "Kỹ sư in 3D"),
                    "startedAt": row.get("started_at", ""),
                    "status": row.get("status", "COMPLETED"),
                    "metadata": {
                        "modelName": model_val,
                        "material": mat_val,
                        "printabilityScore": score_val,
                    },
                    "modelName": model_val,
                    "material": mat_val,
                    "score": score_val,
                    "notes": row.get("notes", ""),
                    "slicer": {
                        "layerHeightMm": lh_val,
                        "infillPercent": infill_val,
                        "material": mat_val,
                    },
                    "hardware": {
                        "speedF": {"defaultMmS": spd_val},
                        "tempsE": {
                            "bedTempC": bed_val,
                            "nozzleTempC": noz_val,
                            "fanSpeedPercent": 100,
                        },
                        "temperatureC": {
                            "nozzleFanPercent": f"{noz_val}°C",
                            "bed": bed_val,
                        },
                        "extrusion": {
                            "flowRatio": float(row.get("flow_ratio") if row.get("flow_ratio") is not None else 1.0),
                            "retractionMm": float(row.get("retraction_mm") if row.get("retraction_mm") is not None else 0.8),
                        },
                    },
                }
            session_map[sid] = session_entry

        def _sort_key(item):
            s_id_str = str(item.get("sessionId", ""))
            try:
                return (0, int(s_id_str))
            except ValueError:
                return (1, s_id_str)

        merged_sessions = sorted(list(session_map.values()), key=_sort_key)

        # 3. Save to nhat_ky_in.json atomically
        session_cols, json_matrix_rows, _ = build_parameter_session_matrix(merged_sessions)
        payload_data = {
            "schema_version": "v2026.1",
            "kieu_trinh_bay": "bang_hop_nhat_phan_lop",
            "tong_so_phien": len(merged_sessions),
            "danh_sach_phien": session_cols,
            "bang_tong_hop": json_matrix_rows,
            "ma_tran_tham_so": json_matrix_rows,
            "sessions": merged_sessions,
            "chi_tiet_tung_phien": merged_sessions,
        }

        temp_path = nhat_ky_file.with_name(f".tmp_nhatky_{os.getpid()}")
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(payload_data, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, nhat_ky_file)
        except Exception:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass

        # 4. Save 02_NhatKy_In/nhat_ky_in.md and individual PHIEU_*.md
        vault_notes_dir = v_root / "02_NhatKy_In"
        vault_notes_dir.mkdir(parents=True, exist_ok=True)
        md_content = render_markdown_log(merged_sessions)
        md_path = vault_notes_dir / "nhat_ky_in.md"
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        for s in merged_sessions:
            s_id = str(s.get("sessionId", "01"))
            phieu_path = vault_notes_dir / f"PHIEU_{s_id}.md"
            phieu_md = render_phieu_markdown(s)
            with open(phieu_path, "w", encoding="utf-8") as f:
                f.write(phieu_md)

        # 5. Update MOC (000_PRINT_INDEX.md)
        moc_path = v_root / "000_PRINT_INDEX.md"
        session_table_rows = [
            f"| `{s.get('sessionId', f'{i+1:02d}')}` | [[Profile_In3D_{s.get('sessionId', f'{i+1:02d}')}|🎨 Profile In 3D #{s.get('sessionId', f'{i+1:02d}')}]] | [[PHIEU_{s.get('sessionId', f'{i+1:02d}')}|Phiếu #{s.get('sessionId', f'{i+1:02d}')}]] | `{s.get('startedAt', '-')}` | `{s.get('slicer', {}).get('layerHeightMm', 0.2)}mm` | `01_Profiles_In3D/` | `02_NhatKy_In/` |"
            for i, s in enumerate(merged_sessions)
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
        with open(moc_path, "w", encoding="utf-8") as f:
            f.write(moc_content)

        return {
            "success": True,
            "pulled_count": len(remote_rows),
            "merged_total_sessions": len(merged_sessions),
            "message": f"Đồng bộ kéo thành công {len(remote_rows)} phiên in từ Supabase về Local Vault.",
        }

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

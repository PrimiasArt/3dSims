"""
Repository & Service for Filament Spool Inventory Management.
Persists inventory into JsonLogs/spool_inventory.json with atomic writes.
"""
import json
import os
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional

from backend.src.domain.spool_inventory import FilamentSpool, SpoolVerificationResult

_DEFAULT_SPOOLS = [
    {
        "id": "spool-bambu-pla-orange",
        "name": "Bambu Lab Basic PLA Orange",
        "brand": "Bambu Lab",
        "material": "PLA",
        "color_name": "Bambu Orange",
        "color_hex": "#ea580c",
        "initial_weight_g": 1000.0,
        "remaining_weight_g": 850.0,
        "cost_vnd": 420000.0,
        "diameter_mm": 1.75,
        "density_g_cm3": 1.24,
        "temp_nozzle_recommended": 215,
        "temp_bed_recommended": 60,
        "rfid_tag": "BAMBU-RFID-A101",
        "location": "AMS Slot 1",
        "is_active": True,
    },
    {
        "id": "spool-esun-pla-plus-white",
        "name": "eSUN PLA+ Cold White",
        "brand": "eSUN",
        "material": "PLA",
        "color_name": "Cold White",
        "color_hex": "#f8fafc",
        "initial_weight_g": 1000.0,
        "remaining_weight_g": 320.0,
        "cost_vnd": 340000.0,
        "diameter_mm": 1.75,
        "density_g_cm3": 1.24,
        "temp_nozzle_recommended": 210,
        "temp_bed_recommended": 55,
        "rfid_tag": None,
        "location": "AMS Slot 2",
        "is_active": True,
    },
    {
        "id": "spool-bambu-petg-hf-black",
        "name": "Bambu Lab PETG-HF Galaxy Black",
        "brand": "Bambu Lab",
        "material": "PETG",
        "color_name": "Galaxy Black",
        "color_hex": "#1e293b",
        "initial_weight_g": 1000.0,
        "remaining_weight_g": 620.0,
        "cost_vnd": 450000.0,
        "diameter_mm": 1.75,
        "density_g_cm3": 1.27,
        "temp_nozzle_recommended": 245,
        "temp_bed_recommended": 75,
        "rfid_tag": "BAMBU-RFID-B202",
        "location": "AMS Slot 3",
        "is_active": True,
    },
    {
        "id": "spool-sunlu-abs-grey",
        "name": "Sunlu High-Temp ABS Grey",
        "brand": "Sunlu",
        "material": "ABS",
        "color_name": "Medium Grey",
        "color_hex": "#64748b",
        "initial_weight_g": 1000.0,
        "remaining_weight_g": 75.0,  # Low filament test case
        "cost_vnd": 310000.0,
        "diameter_mm": 1.75,
        "density_g_cm3": 1.04,
        "temp_nozzle_recommended": 255,
        "temp_bed_recommended": 100,
        "rfid_tag": None,
        "location": "Drybox Chamber A",
        "is_active": True,
    },
    {
        "id": "spool-eryone-tpu-translucent",
        "name": "Eryone TPU 95A Elastic Clear",
        "brand": "Eryone",
        "material": "TPU",
        "color_name": "Translucent Clear",
        "color_hex": "#38bdf8",
        "initial_weight_g": 500.0,
        "remaining_weight_g": 480.0,
        "cost_vnd": 290000.0,
        "diameter_mm": 1.75,
        "density_g_cm3": 1.21,
        "temp_nozzle_recommended": 225,
        "temp_bed_recommended": 40,
        "rfid_tag": None,
        "location": "External Spool Holder",
        "is_active": True,
    },
]


class SpoolInventoryRepository:
    """Manages physical and digital filament spool inventory with persistence."""

    def __init__(self, json_dir: Path | str = "JsonLogs") -> None:
        self._dir = Path(json_dir).resolve()
        self._dir.mkdir(parents=True, exist_ok=True)
        self._file = self._dir / "spool_inventory.json"
        self._lock = threading.Lock()
        self._ensure_initialized()

    def _ensure_initialized(self) -> None:
        if not self._file.exists():
            with open(self._file, "w", encoding="utf-8") as f:
                json.dump({"spools": _DEFAULT_SPOOLS}, f, indent=2, ensure_ascii=False)

    def _read_data(self) -> List[Dict[str, Any]]:
        try:
            with open(self._file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("spools", [])
        except Exception:
            return []

    def _write_data(self, spools_data: List[Dict[str, Any]]) -> None:
        temp_path = self._file.with_name(f".tmp_spool_{os.getpid()}")
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump({"spools": spools_data}, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, self._file)
        except Exception:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise

    def list_all(self) -> List[FilamentSpool]:
        """Returns all spools in inventory."""
        with self._lock:
            data = self._read_data()
            return [FilamentSpool(**item) for item in data]

    def get_by_id(self, spool_id: str) -> Optional[FilamentSpool]:
        """Finds a spool by ID."""
        with self._lock:
            data = self._read_data()
            item = next((s for s in data if s.get("id") == spool_id), None)
            return FilamentSpool(**item) if item else None

    def save(self, spool: FilamentSpool) -> FilamentSpool:
        """Inserts or updates a spool."""
        with self._lock:
            data = self._read_data()
            idx = next((i for i, s in enumerate(data) if s.get("id") == spool.id), None)
            d = spool.model_dump()
            if idx is not None:
                data[idx] = d
            else:
                data.append(d)
            self._write_data(data)
            return spool

    def delete(self, spool_id: str) -> bool:
        """Deletes a spool from inventory."""
        with self._lock:
            data = self._read_data()
            initial_len = len(data)
            data = [s for s in data if s.get("id") != spool_id]
            if len(data) < initial_len:
                self._write_data(data)
                return True
            return False

    def verify_sufficiency(
        self,
        spool_id: str,
        required_grams: float,
        model_material: Optional[str] = None,
        safety_margin_g: float = 5.0,
    ) -> SpoolVerificationResult:
        """
        Validates if the target spool has enough filament to complete the print.
        Accounts for safety buffer (purge lines, prime towers, retraction).
        """
        spool = self.get_by_id(spool_id)
        if not spool:
            return SpoolVerificationResult(
                can_complete=False,
                required_grams=required_grams,
                remaining_grams=0.0,
                safety_margin_g=safety_margin_g,
                deficit_grams=required_grams + safety_margin_g,
                material_matches=False,
                status_badge="SPOOL_NOT_FOUND",
                warning_message=f"Không tìm thấy cuộn nhựa có mã '{spool_id}' trong kho.",
                recommended_action="Chọn cuộn nhựa khác đang hoạt động trong danh mục.",
            )

        total_needed = required_grams + safety_margin_g
        remaining = spool.remaining_weight_g

        # Check material compatibility
        mat_match = True
        if model_material:
            mat_match = spool.material.upper() == model_material.upper()

        if not mat_match:
            return SpoolVerificationResult(
                can_complete=False,
                required_grams=required_grams,
                remaining_grams=remaining,
                safety_margin_g=safety_margin_g,
                deficit_grams=0.0,
                material_matches=False,
                status_badge="MATERIAL_MISMATCH",
                warning_message=f"Xung đột vật liệu: Mô hình yêu cầu '{model_material}', nhưng cuộn nhựa là '{spool.material}'.",
                recommended_action=f"Thay cuộn nhựa hoặc chọn đúng khe AMS chứa chất liệu '{model_material}'.",
            )

        if remaining < total_needed:
            deficit = round(total_needed - remaining, 1)
            return SpoolVerificationResult(
                can_complete=False,
                required_grams=required_grams,
                remaining_grams=remaining,
                safety_margin_g=safety_margin_g,
                deficit_grams=deficit,
                material_matches=True,
                status_badge="RUNOUT_HAZARD",
                warning_message=f"⚠️ Nguy cơ hết nhựa giữa chừng: Cần {required_grams}g (+ {safety_margin_g}g buffer = {total_needed}g), nhưng cuộn '{spool.name}' chỉ còn {remaining}g (Thiếu {deficit}g).",
                recommended_action="Thay cuộn nhựa mới trước khi bắt đầu in, hoặc kích hoạt chức năng 'Tự động đổi cuộn' (Bambu AMS Filament Backup).",
            )

        status_badge = "OPTIMAL" if remaining >= (total_needed * 1.5) else "SUFFICIENT"
        return SpoolVerificationResult(
            can_complete=True,
            required_grams=required_grams,
            remaining_grams=remaining,
            safety_margin_g=safety_margin_g,
            deficit_grams=0.0,
            material_matches=True,
            status_badge=status_badge,
            warning_message=None,
            recommended_action=f"Đủ nhựa để in hoàn tất. Dự kiến sau khi in cuộn còn lại {round(remaining - required_grams, 1)}g.",
        )

    def deduct_weight(self, spool_id: str, used_grams: float) -> Optional[FilamentSpool]:
        """Deducts printed weight from the spool upon successful print completion."""
        with self._lock:
            data = self._read_data()
            item = next((s for s in data if s.get("id") == spool_id), None)
            if not item:
                return None
            current_rem = float(item.get("remaining_weight_g", 0.0))
            new_rem = max(0.0, round(current_rem - used_grams, 1))
            item["remaining_weight_g"] = new_rem
            self._write_data(data)
            return FilamentSpool(**item)

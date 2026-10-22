"""
G-Code Deep Inspector & Kinematic Path Analysis Engine.
Inspects FDM G-Code line-by-line to extract layer boundaries, extrusion volume,
kinematic acceleration estimates, retraction counts, and travel collision hazards.
"""
import math
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class LayerInspectionStats(BaseModel):
    layer_index: int
    z_height_mm: float
    extrusion_length_mm: float
    travel_length_mm: float
    print_time_est_sec: float
    avg_speed_mms: float


class GCodeInspectionReport(BaseModel):
    total_lines: int
    total_layers: int
    model_height_mm: float
    first_layer_height_mm: float
    avg_layer_height_mm: float

    # Extrusion & Filament
    total_extrusion_mm: float
    estimated_filament_grams: float
    filament_diameter_mm: float = 1.75
    material_type: str = "PLA"

    # Kinematics & Timing
    estimated_print_time_sec: float
    formatted_print_time: str
    max_print_speed_mms: float
    max_travel_speed_mms: float
    retraction_count: int
    zhop_count: int

    # Thermal Settings
    initial_nozzle_temp_c: Optional[float] = None
    initial_bed_temp_c: Optional[float] = None

    # Quality & Risk Warnings
    hazards_detected: List[str] = Field(default_factory=list)
    speed_histogram: Dict[str, float] = Field(default_factory=dict)
    layers_preview: List[LayerInspectionStats] = Field(default_factory=list)


class GCodeInspector:
    """Parser and deterministic kinematic analyzer for FDM G-Code."""

    @classmethod
    def inspect(
        cls,
        gcode_content: str,
        material: str = "PLA",
        filament_diameter: float = 1.75,
        density_g_cm3: float = 1.24,
    ) -> GCodeInspectionReport:
        lines = gcode_content.splitlines()
        total_lines = len(lines)

        curr_x, curr_y, curr_z, curr_e = 0.0, 0.0, 0.0, 0.0
        prev_z = 0.0
        feedrate_mms = 60.0  # default mm/s

        is_relative_e = False
        is_relative_xyz = False

        total_extrude_mm = 0.0
        retraction_count = 0
        zhop_count = 0
        max_print_speed = 0.0
        max_travel_speed = 0.0

        nozzle_temp: Optional[float] = None
        bed_temp: Optional[float] = None

        total_move_time_sec = 0.0
        layers_dict: Dict[int, Dict[str, float]] = {}
        curr_layer = 0

        # Speed histogram bins (seconds spent in each range)
        speed_bins = {
            "First Layer / Slow (<=50 mm/s)": 0.0,
            "Perimeter / Fine (50-150 mm/s)": 0.0,
            "High-Speed / Infill (150-300 mm/s)": 0.0,
            "Turbo / Travel (>300 mm/s)": 0.0,
        }

        hazards: List[str] = []
        long_travel_without_hop = 0

        # Regex for G-Code coordinates
        val_re = re.compile(r"([XYZESF])([-+]?[0-9]*\.?[0-9]+)")

        for line in lines:
            line_str = line.split(";", 1)[0].strip().upper()
            comment = line.split(";", 1)[1].strip() if ";" in line else ""

            # Check layer markers in comments
            if "LAYER:" in comment or "BEFORE_LAYER_CHANGE" in comment or "LAYER_CHANGE" in comment:
                m_layer = re.search(r"LAYER:?(\d+)", comment)
                if m_layer:
                    curr_layer = int(m_layer.group(1)) + 1
                else:
                    curr_layer += 1

            if not line_str:
                continue

            parts = line_str.split()
            cmd = parts[0]

            # Coordinate Modes
            if cmd == "G90":
                is_relative_xyz = False
            elif cmd == "G91":
                is_relative_xyz = True
            elif cmd == "M82":
                is_relative_e = False
            elif cmd == "M83":
                is_relative_e = True
            elif cmd == "G92":
                for token in parts[1:]:
                    m = val_re.match(token)
                    if m and m.group(1) == "E":
                        curr_e = float(m.group(2))

            # Temperature
            elif cmd in ("M104", "M109"):
                for token in parts[1:]:
                    m = val_re.match(token)
                    if m and m.group(1) == "S" and nozzle_temp is None:
                        nozzle_temp = float(m.group(2))
            elif cmd in ("M140", "M190"):
                for token in parts[1:]:
                    m = val_re.match(token)
                    if m and m.group(1) == "S" and bed_temp is None:
                        bed_temp = float(m.group(2))

            # Motion (G0, G1)
            elif cmd in ("G0", "G1"):
                target_x, target_y, target_z, target_e = curr_x, curr_y, curr_z, curr_e
                has_x, has_y, has_z, has_e = False, False, False, False

                for token in parts[1:]:
                    m = val_re.match(token)
                    if not m:
                        continue
                    axis, val = m.group(1), float(m.group(2))
                    if axis == "F":
                        feedrate_mms = max(1.0, val / 60.0)  # G-code F is mm/min
                    elif axis == "X":
                        target_x = (curr_x + val) if is_relative_xyz else val
                        has_x = True
                    elif axis == "Y":
                        target_y = (curr_y + val) if is_relative_xyz else val
                        has_y = True
                    elif axis == "Z":
                        target_z = (curr_z + val) if is_relative_xyz else val
                        has_z = True
                    elif axis == "E":
                        target_e = (curr_e + val) if is_relative_e else val
                        has_e = True

                # Compute distance
                dist_xy = math.sqrt((target_x - curr_x) ** 2 + (target_y - curr_y) ** 2)
                dist_z = abs(target_z - curr_z)
                dist_3d = math.sqrt(dist_xy ** 2 + dist_z ** 2)

                # Z-Hop detection
                if has_z and target_z > curr_z and not has_e and dist_z <= 2.0:
                    zhop_count += 1

                # Extrusion delta
                delta_e = (target_e - curr_e) if not is_relative_e else (target_e - curr_e)
                if has_e and delta_e < -0.1:
                    retraction_count += 1
                elif has_e and delta_e > 0.0:
                    total_extrude_mm += delta_e
                    max_print_speed = max(max_print_speed, feedrate_mms)
                elif not has_e and dist_xy > 0.0:
                    max_travel_speed = max(max_travel_speed, feedrate_mms)
                    if dist_xy > 80.0 and dist_z < 0.1:
                        long_travel_without_hop += 1

                # Time computation with nominal acceleration factor
                accel_factor = 1.25  # Accounts for ramp up/down trapezoid
                move_sec = (dist_3d / feedrate_mms) * accel_factor if dist_3d > 0 else 0.0
                total_move_time_sec += move_sec

                # Bin speed
                if feedrate_mms <= 50:
                    speed_bins["First Layer / Slow (<=50 mm/s)"] += move_sec
                elif feedrate_mms <= 150:
                    speed_bins["Perimeter / Fine (50-150 mm/s)"] += move_sec
                elif feedrate_mms <= 300:
                    speed_bins["High-Speed / Infill (150-300 mm/s)"] += move_sec
                else:
                    speed_bins["Turbo / Travel (>300 mm/s)"] += move_sec

                # Layer stats
                if curr_layer not in layers_dict:
                    layers_dict[curr_layer] = {
                        "z": target_z,
                        "extrude": 0.0,
                        "travel": 0.0,
                        "time": 0.0,
                    }
                if has_e and delta_e > 0:
                    layers_dict[curr_layer]["extrude"] += delta_e
                elif dist_xy > 0:
                    layers_dict[curr_layer]["travel"] += dist_xy
                layers_dict[curr_layer]["time"] += move_sec

                curr_x, curr_y, curr_z, curr_e = target_x, target_y, target_z, target_e

        # Calculate filament weight: V = pi * r^2 * length
        radius_mm = filament_diameter / 2.0
        volume_mm3 = math.pi * (radius_mm ** 2) * total_extrude_mm
        volume_cm3 = volume_mm3 / 1000.0
        weight_grams = round(volume_cm3 * density_g_cm3, 1)

        # Layers analysis
        total_layers_detected = max(1, len(layers_dict), curr_layer)
        z_heights = [d["z"] for d in layers_dict.values() if d["z"] > 0]
        model_height = max(z_heights) if z_heights else curr_z
        first_layer_h = z_heights[0] if z_heights else 0.20
        avg_layer_h = round(model_height / max(1, total_layers_detected), 3) if total_layers_detected > 0 else 0.20

        # Format print time
        total_hours = int(total_move_time_sec // 3600)
        total_mins = int((total_move_time_sec % 3600) // 60)
        formatted_time = f"{total_hours}h {total_mins:02d}m" if total_hours > 0 else f"{total_mins} phút"

        # Quality & Safety Hazards
        if long_travel_without_hop > 5:
            hazards.append(f"⚠️ Phát hiện {long_travel_without_hop} đường di chuyển dài (>80mm) không nhấc đầu Z-Hop -> Nguy cơ va quẹt gãy mô hình.")
        if nozzle_temp and nozzle_temp > 260 and material.upper() == "PLA":
            hazards.append(f"⚠️ Nhiệt độ đầu đùn {nozzle_temp}°C quá cao đối với nhựa {material} -> Nguy cơ cháy nhựa và sùi bọt khí.")
        if bed_temp and bed_temp < 50 and material.upper() in ("PLA", "PETG"):
            hazards.append(f"⚠️ Nhiệt độ bàn in {bed_temp}°C có thể không đủ bám dính PEI -> Nguy cơ cong vênh (Warping).")
        if max_print_speed > 350.0:
            hazards.append(f"⚡ Tốc độ đùn lên tới {max_print_speed:.0f} mm/s -> Cần đảm bảo cụm gia nhiệt (Hotend) đạt lưu lượng >= 28 mm³/s.")

        # Preview first 15 layers
        preview_layers = []
        for l_idx in sorted(layers_dict.keys())[:15]:
            ld = layers_dict[l_idx]
            l_time = ld["time"]
            l_dist = ld["extrude"] + ld["travel"]
            avg_spd = round(l_dist / l_time, 1) if l_time > 0 else 60.0
            preview_layers.append(
                LayerInspectionStats(
                    layer_index=l_idx,
                    z_height_mm=round(ld["z"], 2),
                    extrusion_length_mm=round(ld["extrude"], 1),
                    travel_length_mm=round(ld["travel"], 1),
                    print_time_est_sec=round(l_time, 1),
                    avg_speed_mms=avg_spd,
                )
            )

        return GCodeInspectionReport(
            total_lines=total_lines,
            total_layers=total_layers_detected,
            model_height_mm=round(model_height, 2),
            first_layer_height_mm=round(first_layer_h, 2),
            avg_layer_height_mm=avg_layer_h,
            total_extrusion_mm=round(total_extrude_mm, 1),
            estimated_filament_grams=weight_grams,
            filament_diameter_mm=filament_diameter,
            material_type=material,
            estimated_print_time_sec=round(total_move_time_sec, 1),
            formatted_print_time=formatted_time,
            max_print_speed_mms=round(max_print_speed, 1),
            max_travel_speed_mms=round(max_travel_speed, 1),
            retraction_count=retraction_count,
            zhop_count=zhop_count,
            initial_nozzle_temp_c=nozzle_temp,
            initial_bed_temp_c=bed_temp,
            hazards_detected=hazards,
            speed_histogram={k: round(v, 1) for k, v in speed_bins.items()},
            layers_preview=preview_layers,
        )

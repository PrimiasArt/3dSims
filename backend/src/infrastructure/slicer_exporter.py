"""
3D PrintSim Pro - Slicer Preset Exporter Engine
Generates real-world production-grade configuration presets for:
- OrcaSlicer (.json process & filament preset)
- Bambu Studio (.json process & filament preset)
- PrusaSlicer / SuperSlicer (.ini configuration)
"""
import json
from typing import Dict, Any, Tuple


def _safe_get(d: Dict[str, Any], path: str, default: Any = None) -> Any:
    """Helper to safely traverse nested dictionary."""
    curr = d
    for key in path.split("."):
        if not isinstance(curr, dict) or key not in curr:
            return default
        curr = curr[key]
    return curr


def export_orcaslicer_profile(session: Dict[str, Any]) -> str:
    """
    Exports session telemetry parameters into OrcaSlicer process/machine preset JSON.
    Compatible with OrcaSlicer v1.9 - v2.2+.
    """
    s_id = str(session.get("sessionId", "01"))
    meta = session.get("metadata", {})
    slicer = session.get("slicer", {})
    hw = session.get("hardware", {})

    lh = float(slicer.get("layerHeightMm", 0.20))
    inf_pct = int(slicer.get("infillPercent", 20))
    inf_type = str(slicer.get("infillType", "gyroid")).lower()
    wall_loops = int(slicer.get("wallLoops", 2))
    top_layers = int(_safe_get(slicer, "topBottomLayers.top", 4))
    bot_layers = int(_safe_get(slicer, "topBottomLayers.bottom", 3))
    
    sup_type = str(slicer.get("supportType", "None")).lower()
    enable_sup = sup_type not in ["none", "tat", "off", "false"]
    tree_sup = "tree" in sup_type or "organic" in sup_type
    sup_angle = int(slicer.get("supportOverhangAngle", 45))

    speed_def = float(_safe_get(hw, "speedF.defaultMmS", 60))
    speed_wall = float(_safe_get(hw, "speedF.wallMmS", 150))
    speed_inf = float(_safe_get(hw, "speedF.infillMmS", 275))
    speed_trav = 500.0

    bed_t = float(_safe_get(hw, "tempsE.bedTempC", 60))
    noz_t = float(_safe_get(hw, "tempsE.nozzleTempC", 210))
    fan_pct = int(_safe_get(hw, "tempsE.fanSpeedPercent", 100))

    flow = float(_safe_get(hw, "extrusion.flowRatio", 0.98))
    ret_mm = float(_safe_get(hw, "extrusion.retractionMm", 0.8))
    zh_mm = float(_safe_get(hw, "extrusion.zHopMm", 0.4))

    mat = str(meta.get("material", "PLA")).upper()
    model = str(meta.get("modelName", f"Model_Session_{s_id}"))

    preset = {
        "type": "process",
        "name": f"CoreXY Pro - {model} ({mat} {lh}mm)",
        "from": "system",
        "inherits": "0.20mm Standard @BBL X1C",
        "version": "2.2.0.0",
        "setting_id": f"corexy_process_{s_id}",
        "process_settings": {
            "layer_height": str(lh),
            "initial_layer_print_height": str(round(max(0.16, lh * 1.2), 2)),
            "sparse_infill_density": f"{inf_pct}%",
            "sparse_infill_pattern": inf_type,
            "wall_loops": str(wall_loops),
            "top_shell_layers": str(top_layers),
            "bottom_shell_layers": str(bot_layers),
            "enable_support": "1" if enable_sup else "0",
            "support_type": "tree(auto)" if tree_sup else "normal(auto)",
            "support_threshold_angle": str(sup_angle),
            "outer_wall_speed": str(speed_wall),
            "inner_wall_speed": str(round(speed_wall * 1.3, 1)),
            "sparse_infill_speed": str(speed_inf),
            "internal_solid_infill_speed": str(speed_inf),
            "travel_speed": str(speed_trav),
            "default_print_speed": str(speed_def),
            "reduce_fan_stop_start_freq": "1",
        },
        "filament_settings": {
            "filament_type": [mat],
            "filament_flow_ratio": [str(flow)],
            "filament_retraction_length": [str(ret_mm)],
            "filament_z_hop": [str(zh_mm)],
            "nozzle_temperature": [str(int(noz_t))],
            "nozzle_temperature_initial_layer": [str(int(noz_t + 5))],
            "hot_plate_temp": [str(int(bed_t))],
            "hot_plate_temp_initial_layer": [str(int(bed_t + 5))],
            "fan_cooling_layer_time": [str(round(60 * (100 / max(1, fan_pct))))],
        },
        "metadata": {
            "source": "3D PrintSim Pro Telemetry Engine",
            "session_id": s_id,
            "qc_score": meta.get("printabilityScore", 95),
            "schema_version": "v2026.1",
        }
    }
    return json.dumps(preset, indent=2, ensure_ascii=False)


def export_bambulab_profile(session: Dict[str, Any]) -> str:
    """
    Exports session telemetry parameters into Bambu Studio 3MF process preset format.
    Compatible with Bambu Studio v1.8 - v2.0+ (X1C, P1S, A1 Mini, Voron CoreXY).
    """
    s_id = str(session.get("sessionId", "01"))
    meta = session.get("metadata", {})
    slicer = session.get("slicer", {})
    hw = session.get("hardware", {})

    lh = float(slicer.get("layerHeightMm", 0.20))
    inf_pct = int(slicer.get("infillPercent", 20))
    inf_type = str(slicer.get("infillType", "gyroid")).lower()
    wall_loops = int(slicer.get("wallLoops", 2))
    top_layers = int(_safe_get(slicer, "topBottomLayers.top", 4))
    bot_layers = int(_safe_get(slicer, "topBottomLayers.bottom", 3))
    
    sup_type = str(slicer.get("supportType", "None")).lower()
    enable_sup = sup_type not in ["none", "tat", "off", "false"]
    tree_sup = "tree" in sup_type or "organic" in sup_type
    sup_angle = int(slicer.get("supportOverhangAngle", 45))

    speed_def = float(_safe_get(hw, "speedF.defaultMmS", 60))
    speed_wall = float(_safe_get(hw, "speedF.wallMmS", 150))
    speed_inf = float(_safe_get(hw, "speedF.infillMmS", 275))

    bed_t = float(_safe_get(hw, "tempsE.bedTempC", 60))
    noz_t = float(_safe_get(hw, "tempsE.nozzleTempC", 210))
    fan_pct = int(_safe_get(hw, "tempsE.fanSpeedPercent", 100))

    flow = float(_safe_get(hw, "extrusion.flowRatio", 0.98))
    ret_mm = float(_safe_get(hw, "extrusion.retractionMm", 0.8))
    zh_mm = float(_safe_get(hw, "extrusion.zHopMm", 0.4))

    mat = str(meta.get("material", "PLA")).upper()
    model = str(meta.get("modelName", f"Model_Session_{s_id}"))

    preset = {
        "version": "1.8.4.51",
        "name": f"Bambu Lab - {model} ({mat})",
        "setting_id": f"bambu_corexy_{s_id}",
        "inherits": "fdm_process_common",
        "layer_height": str(lh),
        "initial_layer_print_height": str(round(max(0.16, lh * 1.2), 2)),
        "wall_loops": str(wall_loops),
        "top_shell_layers": str(top_layers),
        "bottom_shell_layers": str(bot_layers),
        "sparse_infill_density": f"{inf_pct}%",
        "sparse_infill_pattern": inf_type,
        "enable_support": "1" if enable_sup else "0",
        "support_type": "tree_hybrid" if tree_sup else "normal",
        "support_threshold_angle": str(sup_angle),
        "initial_layer_speed": "50",
        "outer_wall_speed": str(speed_wall),
        "inner_wall_speed": str(round(speed_wall * 1.33, 1)),
        "sparse_infill_speed": str(speed_inf),
        "travel_speed": "500",
        "nozzle_temperature": str(int(noz_t)),
        "hot_plate_temp": str(int(bed_t)),
        "fan_cooling_percent": str(fan_pct),
        "flow_ratio": str(flow),
        "retraction_length": str(ret_mm),
        "z_hop": str(zh_mm),
        "print_sequence": "by layer",
        "notes": f"Generated by 3D PrintSim Pro Telemetry Engine for Session #{s_id}. QC: {meta.get('printabilityScore', 95)}/100."
    }
    return json.dumps(preset, indent=2, ensure_ascii=False)


def export_prusaslicer_profile(session: Dict[str, Any]) -> str:
    """
    Exports session telemetry parameters into PrusaSlicer / SuperSlicer INI configuration.
    Compatible with PrusaSlicer v2.6 - v2.8+.
    """
    s_id = str(session.get("sessionId", "01"))
    meta = session.get("metadata", {})
    slicer = session.get("slicer", {})
    hw = session.get("hardware", {})

    lh = float(slicer.get("layerHeightMm", 0.20))
    inf_pct = int(slicer.get("infillPercent", 20))
    inf_type = str(slicer.get("infillType", "gyroid")).lower()
    wall_loops = int(slicer.get("wallLoops", 2))
    top_layers = int(_safe_get(slicer, "topBottomLayers.top", 4))
    bot_layers = int(_safe_get(slicer, "topBottomLayers.bottom", 3))
    
    sup_type = str(slicer.get("supportType", "None")).lower()
    enable_sup = sup_type not in ["none", "tat", "off", "false"]
    sup_angle = int(slicer.get("supportOverhangAngle", 45))

    speed_def = float(_safe_get(hw, "speedF.defaultMmS", 60))
    speed_wall = float(_safe_get(hw, "speedF.wallMmS", 150))
    speed_inf = float(_safe_get(hw, "speedF.infillMmS", 275))

    bed_t = float(_safe_get(hw, "tempsE.bedTempC", 60))
    noz_t = float(_safe_get(hw, "tempsE.nozzleTempC", 210))
    fan_pct = int(_safe_get(hw, "tempsE.fanSpeedPercent", 100))

    flow = float(_safe_get(hw, "extrusion.flowRatio", 0.98))
    ret_mm = float(_safe_get(hw, "extrusion.retractionMm", 0.8))
    zh_mm = float(_safe_get(hw, "extrusion.zHopMm", 0.4))

    mat = str(meta.get("material", "PLA")).upper()
    model = str(meta.get("modelName", f"Model_Session_{s_id}"))

    lines = [
        f"# PrusaSlicer Config Profile - {model} ({mat})",
        f"# Generated by 3D PrintSim Pro Telemetry Engine - Session #{s_id}",
        f"# QC Printability Score: {meta.get('printabilityScore', 95)}/100",
        "",
        "# [Print Settings]",
        f"layer_height = {lh}",
        f"first_layer_height = {round(max(0.16, lh * 1.2), 2)}",
        f"perimeters = {wall_loops}",
        f"top_solid_layers = {top_layers}",
        f"bottom_solid_layers = {bot_layers}",
        f"fill_density = {inf_pct}%",
        f"fill_pattern = {inf_type}",
        f"support_material = {'1' if enable_sup else '0'}",
        f"support_material_threshold = {sup_angle}",
        f"perimeter_speed = {speed_wall}",
        f"small_perimeter_speed = {round(speed_wall * 0.7, 1)}",
        f"external_perimeter_speed = {round(speed_wall * 0.8, 1)}",
        f"infill_speed = {speed_inf}",
        f"solid_infill_speed = {round(speed_inf * 0.9, 1)}",
        f"travel_speed = 500",
        "",
        "# [Filament Settings]",
        f"filament_type = {mat}",
        f"temperature = {int(noz_t)}",
        f"first_layer_temperature = {int(noz_t + 5)}",
        f"bed_temperature = {int(bed_t)}",
        f"first_layer_bed_temperature = {int(bed_t + 5)}",
        f"fan_below_layer_time = {round(60 * (100 / max(1, fan_pct)))}",
        f"extrusion_multiplier = {flow}",
        "",
        "# [Printer Extrusion Settings]",
        f"retract_length = {ret_mm}",
        f"retract_lift = {zh_mm}",
        "retract_speed = 40",
    ]
    return "\n".join(lines) + "\n"


def export_cura_profile(session: Dict[str, Any]) -> str:
    """
    Exports session telemetry parameters into Ultimaker Cura .curaprofile configuration.
    Compatible with Ultimaker Cura v4.x - v5.x+.
    """
    s_id = str(session.get("sessionId", "01"))
    meta = session.get("metadata", {})
    slicer = session.get("slicer", {})
    hw = session.get("hardware", {})

    lh = float(slicer.get("layerHeightMm", 0.20))
    inf_pct = int(slicer.get("infillPercent", 20))
    inf_type = str(slicer.get("infillType", "gyroid")).lower()
    wall_loops = int(slicer.get("wallLoops", 2))
    top_layers = int(_safe_get(slicer, "topBottomLayers.top", 4))
    bot_layers = int(_safe_get(slicer, "topBottomLayers.bottom", 3))

    sup_type = str(slicer.get("supportType", "None")).lower()
    enable_sup = sup_type not in ["none", "tat", "off", "false"]
    tree_sup = "tree" in sup_type or "organic" in sup_type
    sup_angle = int(slicer.get("supportOverhangAngle", 45))

    speed_def = float(_safe_get(hw, "speedF.defaultMmS", 60))
    speed_wall = float(_safe_get(hw, "speedF.wallMmS", 150))
    speed_inf = float(_safe_get(hw, "speedF.infillMmS", 275))

    bed_t = float(_safe_get(hw, "tempsE.bedTempC", 60))
    noz_t = float(_safe_get(hw, "tempsE.nozzleTempC", 210))
    fan_pct = int(_safe_get(hw, "tempsE.fanSpeedPercent", 100))

    flow = float(_safe_get(hw, "extrusion.flowRatio", 0.98))
    ret_mm = float(_safe_get(hw, "extrusion.retractionMm", 0.8))
    zh_mm = float(_safe_get(hw, "extrusion.zHopMm", 0.4))

    mat = str(meta.get("material", "PLA")).upper()
    model = str(meta.get("modelName", f"Model_Session_{s_id}"))

    lines = [
        "[general]",
        "version = 4",
        f"name = Cura_Profile_{model}_{mat}",
        "definition = fdmprinter",
        "",
        "[metadata]",
        "type = quality_changes",
        "quality_type = normal",
        "setting_version = 20",
        "",
        "[values]",
        f"layer_height = {lh}",
        f"layer_height_0 = {round(max(0.16, lh * 1.2), 2)}",
        f"wall_line_count = {wall_loops}",
        f"top_layers = {top_layers}",
        f"bottom_layers = {bot_layers}",
        f"infill_sparse_density = {inf_pct}",
        f"infill_pattern = {inf_type}",
        f"support_enable = {'True' if enable_sup else 'False'}",
        f"support_structure = {'tree' if tree_sup else 'normal'}",
        f"support_angle = {sup_angle}",
        f"speed_print = {speed_def}",
        f"speed_wall = {speed_wall}",
        f"speed_infill = {speed_inf}",
        f"material_print_temperature = {int(noz_t)}",
        f"material_bed_temperature = {int(bed_t)}",
        f"cool_fan_speed = {fan_pct}",
        f"material_flow = {round(flow * 100, 1)}",
        f"retraction_amount = {ret_mm}",
        f"retraction_hop = {zh_mm}",
    ]
    return "\n".join(lines) + "\n"


def export_slicer_preset(session: Dict[str, Any], slicer_type: str = "orcaslicer") -> Tuple[str, str, str]:
    """
    Main export dispatcher.
    Returns (content, filename, mime_type).
    """
    s_id = str(session.get("sessionId", "01"))
    st = slicer_type.lower().strip()

    if "bambu" in st:
        content = export_bambulab_profile(session)
        filename = f"BambuLab_Profile_Session_{s_id}.json"
        mime = "application/json"
    elif "prusa" in st:
        content = export_prusaslicer_profile(session)
        filename = f"PrusaSlicer_Profile_Session_{s_id}.ini"
        mime = "text/plain"
    elif "cura" in st:
        content = export_cura_profile(session)
        filename = f"Cura_Profile_Session_{s_id}.curaprofile"
        mime = "text/plain"
    else:  # default orcaslicer
        content = export_orcaslicer_profile(session)
        filename = f"OrcaSlicer_Profile_Session_{s_id}.json"
        mime = "application/json"

    return content, filename, mime

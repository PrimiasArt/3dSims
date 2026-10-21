"""
Native 3MF Project Packager for Bambu Studio & OrcaSlicer.
Constructs valid Open Packaging Conventions (OPC) ZIP archives (.3mf) containing
3D geometry XML, Bambu/OrcaSlicer configuration metadata, and plate thumbnail previews.
"""
import io
import zipfile
from typing import Dict, Any, List, Optional, Tuple


# Default 1x1 transparent PNG icon bytes if no custom thumbnail is provided
DEFAULT_THUMBNAIL_PNG = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
])


class ProjectPackager3MF:
    """Builds native .3mf project packages ready for Bambu Studio and OrcaSlicer."""

    @staticmethod
    def create_cube_geometry(size_mm: float = 20.0, center_x: float = 128.0, center_y: float = 128.0) -> Tuple[List[Dict[str, float]], List[Dict[str, int]]]:
        """Generates a calibration test cube geometry centered on 256x256mm build plate."""
        half = size_mm / 2.0
        v = [
            {"x": center_x - half, "y": center_y - half, "z": 0.0},
            {"x": center_x + half, "y": center_y - half, "z": 0.0},
            {"x": center_x + half, "y": center_y + half, "z": 0.0},
            {"x": center_x - half, "y": center_y + half, "z": 0.0},
            {"x": center_x - half, "y": center_y - half, "z": size_mm},
            {"x": center_x + half, "y": center_y - half, "z": size_mm},
            {"x": center_x + half, "y": center_y + half, "z": size_mm},
            {"x": center_x - half, "y": center_y + half, "z": size_mm},
        ]
        # 12 triangles (2 per face)
        t = [
            {"v1": 0, "v2": 2, "v3": 1}, {"v1": 0, "v2": 3, "v3": 2},  # Bottom
            {"v1": 4, "v2": 5, "v3": 6}, {"v1": 4, "v2": 6, "v3": 7},  # Top
            {"v1": 0, "v2": 1, "v3": 5}, {"v1": 0, "v2": 5, "v3": 4},  # Front
            {"v1": 1, "v2": 2, "v3": 6}, {"v1": 1, "v2": 6, "v3": 5},  # Right
            {"v1": 2, "v2": 3, "v3": 7}, {"v1": 2, "v2": 7, "v3": 6},  # Back
            {"v1": 3, "v2": 0, "v3": 4}, {"v1": 3, "v2": 4, "v3": 7},  # Left
        ]
        return v, t

    @staticmethod
    def generate_sample_gcode(model_name: str, profile: Dict[str, Any]) -> str:
        """Generates realistic FDM G-Code instructions for direct MicroSD card printing."""
        slicer = profile.get("slicer", {}) if "slicer" in profile else profile
        hardware = profile.get("hardware", {}) if "hardware" in profile else profile
        lh = slicer.get("layerHeightMm") or profile.get("layer_height_mm", 0.20)
        inf = slicer.get("infillPercent") or profile.get("infill_percent", 20)
        spd = hardware.get("speedF", {}).get("defaultMmS") if "speedF" in hardware else profile.get("speed_mms", 120)
        bed = hardware.get("tempsE", {}).get("bedTempC") if "tempsE" in hardware else profile.get("bed_temp_c", 60)
        noz = hardware.get("tempsE", {}).get("nozzleTempC") if "tempsE" in hardware else profile.get("nozzle_temp_c", 215)
        mat = profile.get("material", "PLA")

        return f"""; ========================================================
; G-Code sinh bởi 3D PrintSim Pro - CoreXY SD Card Engine
; Tên mô hình: {model_name}
; Vật liệu: {mat} | Độ cao lớp: {lh} mm
; Tốc độ: {spd} mm/s | Mật độ: {inf}%
; Nhiệt độ Nozzle: {noz}°C | Bàn in: {bed}°C
; Tương thích: Bambu Lab X1C/P1S/A1, Klipper, Voron
; ========================================================

; --- START GCODE ---
G90 ; Absolute coordinates
M83 ; Relative extruder
M104 S{noz} ; Set nozzle temp
M140 S{bed} ; Set bed temp
G28 ; Home XYZ
G29 ; Auto Bed Leveling
M190 S{bed} ; Wait for bed temp
M109 S{noz} ; Wait for nozzle temp

; --- PRIME NOZZLE LINE ---
G1 Z2.0 F3000
G1 X10 Y20 Z0.28 F5000
G1 X10 Y180 Z0.28 E15 F1200
G1 X12 Y180 Z0.28 F5000
G1 X12 Y20 Z0.28 E15 F1200
G92 E0

; --- LAYER 1 ---
;LAYER:1
;HEIGHT:{lh}
G1 Z{lh} F{float(spd) * 60}
G1 X108 Y108 F4000
G1 X148 Y108 E2.5 F{float(spd) * 40}
G1 X148 Y148 E2.5
G1 X108 Y148 E2.5
G1 X108 Y108 E2.5

; --- END GCODE ---
M104 S0 ; Turn off hotend
M140 S0 ; Turn off bed
M106 S0 ; Turn off part fan
G91 ; Relative positioning
G1 Z10 F3000 ; Raise Z
G90 ; Absolute positioning
G1 X10 Y240 F6000 ; Park toolhead at chute
M84 ; Disable steppers
; ========================================================
"""

    @classmethod
    def generate_3mf_bytes(
        cls,
        model_name: str,
        profile: Dict[str, Any],
        vertices: Optional[List[Dict[str, float]]] = None,
        triangles: Optional[List[Dict[str, int]]] = None,
        thumbnail_bytes: Optional[bytes] = None,
        sd_card_mode: bool = False,
        gcode_content: Optional[str] = None,
    ) -> bytes:
        """
        Assembles an in-memory .3mf or .gcode.3mf ZIP package.
        When sd_card_mode is True, embeds Metadata/plate_1.gcode for direct SD card printing.
        """
        # Default geometry if none provided
        if not vertices or not triangles:
            vertices, triangles = cls.create_cube_geometry(size_mm=25.0)

        # 1. Build 3D/3dmodel.model XML
        vertex_lines = [
            f'          <vertex x="{v.get("x", 0.0):.4f}" y="{v.get("y", 0.0):.4f}" z="{v.get("z", 0.0):.4f}" />'
            for v in vertices
        ]
        triangle_lines = [
            f'          <triangle v1="{t.get("v1", 0)}" v2="{t.get("v2", 1)}" v3="{t.get("v3", 2)}" />'
            for t in triangles
        ]

        model_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">{model_name}</metadata>
  <metadata name="Application">3D PrintSim Pro CAD Studio</metadata>
  <metadata name="Designer">3D PrintSim Engineering Engine</metadata>
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
{chr(10).join(vertex_lines)}
        </vertices>
        <triangles>
{chr(10).join(triangle_lines)}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>
"""

        # 2. Extract profile parameters
        slicer = profile.get("slicer", {}) if "slicer" in profile else profile
        hardware = profile.get("hardware", {}) if "hardware" in profile else profile
        lh = slicer.get("layerHeightMm") or profile.get("layer_height_mm", 0.20)
        inf = slicer.get("infillPercent") or profile.get("infill_percent", 20)
        inf_type = slicer.get("infillType") or profile.get("infill_type", "Gyroid")
        wl = slicer.get("wallLoops") or profile.get("wall_loops", 2)
        sup = slicer.get("supportType") or profile.get("support_type", "tree_hybrid")
        mat = profile.get("material", "PLA")
        spd = hardware.get("speedF", {}).get("defaultMmS") if "speedF" in hardware else profile.get("speed_mms", 120)
        bed = hardware.get("tempsE", {}).get("bedTempC") if "tempsE" in hardware else profile.get("bed_temp_c", 60)
        noz = hardware.get("tempsE", {}).get("nozzleTempC") if "tempsE" in hardware else profile.get("nozzle_temp_c", 215)

        # 3. Build Metadata/model_settings.config XML
        model_settings_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="1">
    <metadata key="name" value="{model_name}"/>
    <metadata key="layer_height" value="{lh}"/>
    <metadata key="sparse_infill_density" value="{inf}%"/>
    <metadata key="sparse_infill_pattern" value="{inf_type}"/>
    <metadata key="wall_loops" value="{wl}"/>
    <metadata key="enable_support" value="{'1' if sup != 'none' else '0'}"/>
    <metadata key="support_type" value="{sup}"/>
    <metadata key="filament_type" value="{mat}"/>
    <metadata key="default_print_speed" value="{spd}"/>
    <metadata key="bed_temperature" value="{bed}"/>
    <metadata key="nozzle_temperature" value="{noz}"/>
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="Plate 1 (Textured PEI)"/>
    <metadata key="bed_type" value="textured_plate"/>
    <metadata key="bed_size" value="256,256"/>
  </plate>
</config>
"""

        # 4. Build Metadata/slice_info.config XML
        slice_info_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<slice_info>
  <header>
    <software name="3D PrintSim Pro" version="2026.1"/>
    <profile_name>{model_name}_{mat}_Preset</profile_name>
  </header>
  <filament>
    <type>{mat}</type>
    <density>1.24</density>
    <diameter>1.75</diameter>
    <nozzle_temp>{noz}</nozzle_temp>
    <bed_temp>{bed}</bed_temp>
  </filament>
  <process>
    <layer_height>{lh}</layer_height>
    <infill_density>{inf}</infill_density>
    <infill_pattern>{inf_type}</infill_pattern>
    <speed>{spd}</speed>
  </process>
</slice_info>
"""

        # 5. Build Content Types XML
        content_types_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="config" ContentType="application/xml"/>
  <Default Extension="gcode" ContentType="text/x.gcode"/>
</Types>
"""

        # 6. Build _rels/.rels
        rels_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
  <Relationship Target="/Metadata/plate_1.png" Id="rel1" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>
</Relationships>
"""

        # 7. Package everything into a ZIP byte stream
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("[Content_Types].xml", content_types_xml.strip().encode("utf-8"))
            zf.writestr("_rels/.rels", rels_xml.strip().encode("utf-8"))
            zf.writestr("3D/3dmodel.model", model_xml.strip().encode("utf-8"))
            zf.writestr("Metadata/model_settings.config", model_settings_xml.strip().encode("utf-8"))
            zf.writestr("Metadata/slice_info.config", slice_info_xml.strip().encode("utf-8"))
            zf.writestr("Metadata/plate_1.png", thumbnail_bytes or DEFAULT_THUMBNAIL_PNG)

            # In SD Card mode, embed plate_1.gcode
            if sd_card_mode:
                gcode_str = gcode_content or cls.generate_sample_gcode(model_name, profile)
                zf.writestr("Metadata/plate_1.gcode", gcode_str.encode("utf-8"))

        buf.seek(0)
        return buf.getvalue()


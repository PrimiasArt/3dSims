"""
Physics-Based Sanity Check Engine for 3D Printing Simulation & QC Audit.
Applies deterministic thermal, fluid dynamic (volumetric flow), kinematic,
and structural laws to prevent FDM print failures before manufacturing.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class PhysicsIssueSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class PhysicsIssueCategory(str, Enum):
    WARPING_ADHESION = "Cong Vênh & Bám Dính Bàn In"
    FLOW_EXTRUSION = "Đùn Nhựa & Lưu Lượng Nóng Chảy"
    COOLING_STRENGTH = "Làm Mát & Độ Bền Cơ Học"
    GEOMETRY_SUPPORT = "Hình Học, Cành Đỡ & Góc Nghiêng"
    SPEED_KINEMATICS = "Tốc Độ & Cơ Khí Chuyển Động"


@dataclass
class PhysicsIssue:
    code: str
    severity: PhysicsIssueSeverity
    category: PhysicsIssueCategory
    title: str
    description: str
    suggested_action: str
    conflicting_parameters: List[str]
    risk_penalty: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "severity": self.severity.value,
            "category": self.category.value,
            "title": self.title,
            "description": self.description,
            "suggested_action": self.suggested_action,
            "conflicting_parameters": self.conflicting_parameters,
            "risk_penalty": self.risk_penalty,
        }


@dataclass
class PhysicsSanityResult:
    qc_risk_score: int  # 0 to 100 (0 = Safe, 100 = Guaranteed Failure)
    qc_health_score: int  # 100 - risk_score
    status: str  # OPTIMAL, ACCEPTABLE, CAUTION, CRITICAL_HAZARD
    status_label: str
    material: str
    max_volumetric_flow_rate: float
    estimated_volumetric_flow_rate: float
    flow_headroom_percent: float
    issues: List[PhysicsIssue] = field(default_factory=list)
    passed_checks: List[str] = field(default_factory=list)
    summary: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "qc_risk_score": self.qc_risk_score,
            "qc_health_score": self.qc_health_score,
            "status": self.status,
            "status_label": self.status_label,
            "material": self.material,
            "max_volumetric_flow_rate": round(self.max_volumetric_flow_rate, 2),
            "estimated_volumetric_flow_rate": round(self.estimated_volumetric_flow_rate, 2),
            "flow_headroom_percent": round(self.flow_headroom_percent, 1),
            "issues": [issue.to_dict() for issue in self.issues],
            "passed_checks": self.passed_checks,
            "summary": self.summary,
        }


class PhysicsSanityEngine:
    """
    Deterministic FDM 3D printing physics validator.
    Inspects thermal equilibrium, melt zone volumetric limits, layer aspect ratios,
    adhesion energetics, and overhang overhang physics.
    """

    # Thermal & flow baseline specs per material family
    MATERIAL_PROFILES: Dict[str, Dict[str, Any]] = {
        "PLA": {
            "nozzle_min": 190,
            "nozzle_max": 230,
            "nozzle_optimal": 210,
            "bed_min": 45,
            "bed_max": 65,
            "glass_transition_temp": 55,
            "max_volumetric_flow": 22.0,  # mm3/s standard hotend
            "fan_recommended_min": 60,
            "fan_max": 100,
            "shrinkage_rate": 0.003,
            "requires_brim": False,
        },
        "PETG": {
            "nozzle_min": 230,
            "nozzle_max": 260,
            "nozzle_optimal": 245,
            "bed_min": 70,
            "bed_max": 85,
            "glass_transition_temp": 75,
            "max_volumetric_flow": 16.0,
            "fan_recommended_min": 20,
            "fan_max": 50,  # >50% causes brittle layer bonding
            "shrinkage_rate": 0.005,
            "requires_brim": False,
        },
        "ABS": {
            "nozzle_min": 240,
            "nozzle_max": 275,
            "nozzle_optimal": 255,
            "bed_min": 90,
            "bed_max": 115,
            "glass_transition_temp": 105,
            "max_volumetric_flow": 18.0,
            "fan_recommended_min": 0,
            "fan_max": 20,  # High cooling causes violent warping & cracking
            "shrinkage_rate": 0.015,  # High thermal contraction
            "requires_brim": True,
        },
        "ASA": {
            "nozzle_min": 240,
            "nozzle_max": 275,
            "nozzle_optimal": 260,
            "bed_min": 90,
            "bed_max": 115,
            "glass_transition_temp": 100,
            "max_volumetric_flow": 18.0,
            "fan_recommended_min": 0,
            "fan_max": 25,
            "shrinkage_rate": 0.012,
            "requires_brim": True,
        },
        "TPU": {
            "nozzle_min": 210,
            "nozzle_max": 240,
            "nozzle_optimal": 225,
            "bed_min": 30,
            "bed_max": 60,
            "glass_transition_temp": -20,
            "max_volumetric_flow": 7.5,  # High friction & elasticity
            "fan_recommended_min": 40,
            "fan_max": 100,
            "shrinkage_rate": 0.006,
            "requires_brim": False,
            "max_print_speed": 45.0,  # mm/s max for TPU
            "max_retraction": 1.5,
        },
        "PC": {
            "nozzle_min": 265,
            "nozzle_max": 305,
            "nozzle_optimal": 285,
            "bed_min": 100,
            "bed_max": 125,
            "glass_transition_temp": 145,
            "max_volumetric_flow": 15.0,
            "fan_recommended_min": 0,
            "fan_max": 15,
            "shrinkage_rate": 0.018,
            "requires_brim": True,
        },
        "PA": {  # Nylon
            "nozzle_min": 255,
            "nozzle_max": 295,
            "nozzle_optimal": 270,
            "bed_min": 85,
            "bed_max": 110,
            "glass_transition_temp": 60,
            "max_volumetric_flow": 14.0,
            "fan_recommended_min": 0,
            "fan_max": 25,
            "shrinkage_rate": 0.020,
            "requires_brim": True,
        },
    }

    def evaluate(self, profile: Dict[str, Any]) -> PhysicsSanityResult:
        """
        Runs comprehensive physics sanity checks against the provided slicer profile.
        """
        issues: List[PhysicsIssue] = []
        passed_checks: List[str] = []

        # 1. Normalize parameters with safe fallbacks
        mat_raw = str(profile.get("material", "PLA")).upper()
        mat_key = next((k for k in self.MATERIAL_PROFILES if k in mat_raw), "PLA")
        mat_spec = self.MATERIAL_PROFILES[mat_key]

        layer_height = float(profile.get("layerHeight", 0.20))
        first_layer_height = float(profile.get("firstLayerHeight", layer_height))
        nozzle_diam = float(profile.get("nozzleDiameterMm", 0.40))
        line_width = float(profile.get("lineWidthMm", nozzle_diam * 1.1))

        nozzle_temp = float(profile.get("nozzleTemp", profile.get("nozzle_temp", mat_spec["nozzle_optimal"])))
        bed_temp = float(profile.get("bedTemp", profile.get("bed_temp", mat_spec["bed_min"])))
        fan_speed = float(profile.get("coolingFanSpeed", profile.get("cooling_fan_speed", 100)))

        wall_speed = float(profile.get("outerWallSpeed", profile.get("outer_wall_speed", 150)))
        infill_speed = float(profile.get("infillSpeed", profile.get("infill_speed", 275)))
        base_speed = float(profile.get("printSpeed", profile.get("print_speed", 60)))

        wall_loops = int(profile.get("wallLoops", profile.get("wall_loops", 2)))
        infill_density = float(profile.get("infillDensity", profile.get("infill_density", 20)))

        support_mode = str(profile.get("supportMode", profile.get("support_mode", "Tắt"))).lower()
        support_angle = float(profile.get("supportAngleThreshold", profile.get("support_angle_threshold", 45)))
        has_support = support_mode not in ("none", "false", "tắt", "off", "0", "")

        brim_enabled = bool(profile.get("brimEnabled", profile.get("brim_enabled", False)))
        brim_width = float(profile.get("brimWidthMm", profile.get("brim_width_mm", 0)))
        has_active_brim = brim_enabled and (brim_width >= 3.0)

        retraction_dist = float(profile.get("retractionDistanceMm", profile.get("retraction_distance_mm", 0.8)))

        # -------------------------------------------------------------
        # CHECK 1: Volumetric Melt Flow Rate Limit (Q = H * W * V)
        # -------------------------------------------------------------
        # Flow rate in mm3/s
        flow_infill = layer_height * line_width * infill_speed
        flow_wall = layer_height * line_width * wall_speed
        max_demanded_flow = max(flow_infill, flow_wall)
        flow_limit = mat_spec["max_volumetric_flow"]
        headroom = ((flow_limit - max_demanded_flow) / flow_limit) * 100.0

        if max_demanded_flow > flow_limit * 1.25:
            issues.append(
                PhysicsIssue(
                    code="PHYS-FLOW-001",
                    severity=PhysicsIssueSeverity.CRITICAL,
                    category=PhysicsIssueCategory.FLOW_EXTRUSION,
                    title="Vượt Ngưỡng Lưu Lượng Nóng Chảy Nghiêm Trọng (Volumetric Limit Exceeded)",
                    description=(
                        f"Lưu lượng nhựa yêu cầu đạt {max_demanded_flow:.1f} mm³/s (ở tốc độ ruột {infill_speed:.0f} mm/s "
                        f"hoặc vách {wall_speed:.0f} mm/s), vượt xa giới hạn nóng chảy {flow_limit:.1f} mm³/s của cụm Hotend "
                        f"cho chất liệu {mat_key}. Hậu quả: Bánh răng đùn trượt liên tục (Extruder Clicking), thiếu đùn xốp "
                        f"(Severe Under-extrusion) làm yếu gãy chi tiết."
                    ),
                    suggested_action=f"Giảm infillSpeed xuống ≤ {int(flow_limit / (layer_height * line_width)):.0f} mm/s hoặc giảm layerHeight xuống 0.16mm.",
                    conflicting_parameters=["infillSpeed", "outerWallSpeed", "layerHeight"],
                    risk_penalty=38,
                )
            )
        elif max_demanded_flow > flow_limit:
            issues.append(
                PhysicsIssue(
                    code="PHYS-FLOW-002",
                    severity=PhysicsIssueSeverity.WARNING,
                    category=PhysicsIssueCategory.FLOW_EXTRUSION,
                    title="Tiệm Cận Giới Hạn Đùn Nóng Chảy (Melt Zone Saturation)",
                    description=(
                        f"Lưu lượng đùn {max_demanded_flow:.1f} mm³/s vượt quá mức an toàn {flow_limit:.1f} mm³/s. "
                        f"Có thể xuất hiện các khoảng trống nhỏ giữa các đường đùn và giảm độ bóng bề mặt."
                    ),
                    suggested_action=f"Hạ tốc độ in khoảng 15-20% hoặc tăng nhiệt độ đầu in thêm 5-10°C để tăng độ lỏng nhớt.",
                    conflicting_parameters=["infillSpeed", "outerWallSpeed"],
                    risk_penalty=18,
                )
            )
        else:
            passed_checks.append(f"Lưu lượng đùn tối đa {max_demanded_flow:.1f} mm³/s nằm trong ngưỡng an toàn ({flow_limit:.1f} mm³/s).")

        # -------------------------------------------------------------
        # CHECK 2: Thermal Adhesion & Warping Physics (ABS/ASA/Nylon)
        # -------------------------------------------------------------
        if mat_spec["requires_brim"] and not has_active_brim:
            issues.append(
                PhysicsIssue(
                    code="PHYS-WARP-001",
                    severity=PhysicsIssueSeverity.CRITICAL,
                    category=PhysicsIssueCategory.WARPING_ADHESION,
                    title=f"Nguy Cơ Cong Vênh Cực Cao Với Nhựa {mat_key} (Warping Detachment)",
                    description=(
                        f"Chất liệu {mat_key} có hệ số co rút nhiệt cao ({mat_spec['shrinkage_rate']*100:.1f}%). "
                        f"In không có vành bám (Brim = Tắt) sẽ khiến các góc nhọn co kéo cực mạnh và bong tróc khỏi bàn in "
                        f"sau khoảng 15-30 phút đầu, dẫn tới va chạm đầu in và hỏng hoàn toàn bản in."
                    ),
                    suggested_action="Bật brimEnabled = True với brimWidthMm tối thiểu 5mm - 8mm (Inner/Outer Brim).",
                    conflicting_parameters=["brimEnabled", "brimWidthMm"],
                    risk_penalty=35,
                )
            )
        elif mat_spec["requires_brim"] and has_active_brim:
            passed_checks.append(f"Vành bám Brim ({brim_width}mm) được kích hoạt chuẩn cho nhựa co rút {mat_key}.")

        if bed_temp < mat_spec["bed_min"]:
            issues.append(
                PhysicsIssue(
                    code="PHYS-WARP-002",
                    severity=PhysicsIssueSeverity.CRITICAL if mat_key in ("ABS", "ASA", "PC", "PA") else PhysicsIssueSeverity.WARNING,
                    category=PhysicsIssueCategory.WARPING_ADHESION,
                    title=f"Nhiệt Độ Bàn In Quá Thấp Cho Nhựa {mat_key}",
                    description=(
                        f"Nhiệt độ bàn in hiện tại ({bed_temp:.0f}°C) thấp hơn ngưỡng dính bám tối thiểu ({mat_spec['bed_min']}°C). "
                        f"Đáy chi tiết không thể duy trì trạng thái bám dính phân tử với bề mặt PEI/Textured."
                    ),
                    suggested_action=f"Tăng nhiệt bàn in lên ít nhất {mat_spec['bed_min']}°C (Khuyến nghị: {(mat_spec['bed_min']+mat_spec['bed_max'])//2}°C).",
                    conflicting_parameters=["bedTemp"],
                    risk_penalty=28,
                )
            )
        elif mat_key == "PLA" and bed_temp > 68:
            issues.append(
                PhysicsIssue(
                    code="PHYS-WARP-003",
                    severity=PhysicsIssueSeverity.WARNING,
                    category=PhysicsIssueCategory.WARPING_ADHESION,
                    title="Nhiệt Bàn In Vượt Ngưỡng Chuyển Dịch Thủy Tinh Của PLA (Elephant's Foot)",
                    description=(
                        f"Nhiệt độ bàn in {bed_temp:.0f}°C vượt quá nhiệt độ hóa mềm Tg của PLA (khoảng 55-60°C). "
                        f"Đáy mô hình sẽ bị chảy bè sang hai bên, gây ra hiện tượng chân voi (Elephant's foot) và kẹt kích thước lắp ráp."
                    ),
                    suggested_action="Hạ nhiệt độ bàn in về 55°C - 60°C.",
                    conflicting_parameters=["bedTemp"],
                    risk_penalty=14,
                )
            )
        else:
            passed_checks.append(f"Nhiệt độ bàn in ({bed_temp:.0f}°C) tương thích hoàn hảo với {mat_key}.")

        # -------------------------------------------------------------
        # CHECK 3: Cooling vs Layer Adhesion (Delamination)
        # -------------------------------------------------------------
        if mat_key in ("ABS", "ASA", "PC", "PA") and fan_speed > mat_spec["fan_max"]:
            issues.append(
                PhysicsIssue(
                    code="PHYS-COOL-001",
                    severity=PhysicsIssueSeverity.CRITICAL,
                    category=PhysicsIssueCategory.COOLING_STRENGTH,
                    title=f"Quạt Làm Mát Quá Mạnh Gây Tách Lớp Nứt Vỡ Cho Nhựa {mat_key}",
                    description=(
                        f"Tốc độ quạt làm mát đang đặt {fan_speed:.0f}%, trong khi {mat_key} chỉ cho phép tối đa {mat_spec['fan_max']}%. "
                        f"Luồng gió lạnh làm lớp in bên dưới co rút đột ngột trước khi lớp mới kịp hòa tan phân tử, "
                        f"gây ra hiện tượng nứt toác giữa các lớp in (Layer Delamination / Cracking)."
                    ),
                    suggested_action=f"Giảm quạt làm mát xuống 0% - {mat_spec['fan_max']}% và giữ kín buồng in.",
                    conflicting_parameters=["coolingFanSpeed"],
                    risk_penalty=32,
                )
            )
        elif mat_key == "PETG" and fan_speed > 60:
            issues.append(
                PhysicsIssue(
                    code="PHYS-COOL-002",
                    severity=PhysicsIssueSeverity.WARNING,
                    category=PhysicsIssueCategory.COOLING_STRENGTH,
                    title="Quạt Làm Mát PETG Quá Cao Khiến Chi Tiết Giòn Dễ Gãy",
                    description=(
                        f"Quạt làm mát {fan_speed:.0f}% đối với PETG làm giảm độ bám dính giữa các lớp, "
                        f"khiến chi tiết mất độ dẻo dai đặc trưng và dễ nứt dọc theo đường lớp in."
                    ),
                    suggested_action="Đặt coolingFanSpeed ở mức 30% - 40% cho PETG.",
                    conflicting_parameters=["coolingFanSpeed"],
                    risk_penalty=15,
                )
            )
        elif mat_key == "PLA" and fan_speed < 40 and layer_height <= 0.16:
            issues.append(
                PhysicsIssue(
                    code="PHYS-COOL-003",
                    severity=PhysicsIssueSeverity.WARNING,
                    category=PhysicsIssueCategory.COOLING_STRENGTH,
                    title="Thiếu Tản Nhiệt Cho Chi Tiết Nhỏ Với Nhựa PLA",
                    description=(
                        f"Với lớp in mỏng {layer_height}mm, quạt {fan_speed:.0f}% không đủ làm đông cứng nhanh các cầu nối và góc vát nhô ra, "
                        f"dẫn tới xệ nhựa (Sagging) và méo mó hình học."
                    ),
                    suggested_action="Tăng coolingFanSpeed lên 80% - 100% đối với PLA.",
                    conflicting_parameters=["coolingFanSpeed"],
                    risk_penalty=12,
                )
            )
        else:
            passed_checks.append(f"Cấu hình quạt làm mát ({fan_speed:.0f}%) phù hợp với đặc tính nhiệt {mat_key}.")

        # -------------------------------------------------------------
        # CHECK 4: Nozzle Temperature vs Print Speed
        # -------------------------------------------------------------
        if nozzle_temp < mat_spec["nozzle_min"]:
            issues.append(
                PhysicsIssue(
                    code="PHYS-EXTR-001",
                    severity=PhysicsIssueSeverity.CRITICAL,
                    category=PhysicsIssueCategory.FLOW_EXTRUSION,
                    title=f"Nhiệt Độ Đầu In Dưới Ngưỡng Nóng Chảy Của {mat_key}",
                    description=(
                        f"Nhiệt độ đầu phun {nozzle_temp:.0f}°C quá thấp so với mức tối thiểu {mat_spec['nozzle_min']}°C. "
                        f"Sợi nhựa không thể chảy lỏng, gây kẹt đầu phun (Cold Extrusion Jam) và mòn bánh răng Feeder."
                    ),
                    suggested_action=f"Tăng nhiệt độ đầu in lên mức khuyến nghị {mat_spec['nozzle_optimal']}°C.",
                    conflicting_parameters=["nozzleTemp"],
                    risk_penalty=40,
                )
            )
        elif wall_speed >= 180 and nozzle_temp < mat_spec["nozzle_optimal"]:
            issues.append(
                PhysicsIssue(
                    code="PHYS-EXTR-002",
                    severity=PhysicsIssueSeverity.WARNING,
                    category=PhysicsIssueCategory.FLOW_EXTRUSION,
                    title="Tốc Độ In Cao Nhưng Nhiệt Đầu Đùn Chưa Bù Đắp Nhiệt Lượng",
                    description=(
                        f"Tốc độ vách ngoài {wall_speed:.0f} mm/s ở nhiệt độ {nozzle_temp:.0f}°C khiến nhựa đi qua buồng nóng quá nhanh "
                        f"mà chưa kịp hấp thụ đủ nhiệt lượng, làm bề mặt mờ xỉn và giảm độ bền chịu lực."
                    ),
                    suggested_action=f"Tăng nhiệt đầu in thêm 10°C - 15°C (lên khoảng {nozzle_temp + 10:.0f}°C) để bù nhiệt lưu lượng cao.",
                    conflicting_parameters=["outerWallSpeed", "nozzleTemp"],
                    risk_penalty=16,
                )
            )
        elif nozzle_temp > mat_spec["nozzle_max"]:
            issues.append(
                PhysicsIssue(
                    code="PHYS-EXTR-003",
                    severity=PhysicsIssueSeverity.WARNING,
                    category=PhysicsIssueCategory.FLOW_EXTRUSION,
                    title=f"Nhiệt Độ Đầu In Vượt Ngưỡng Cho Phép Của {mat_key} (Thermal Degradation)",
                    description=(
                        f"Nhiệt độ {nozzle_temp:.0f}°C vượt trần {mat_spec['nozzle_max']}°C, gây phân hủy polymer, tạo khói độc, "
                        f"rỉ nhựa liên tục (Oozing/Stringing nghiêm trọng) và cháy cặn nghẹt đầu kim."
                    ),
                    suggested_action=f"Hạ nhiệt đầu in về dưới {mat_spec['nozzle_max']}°C (Khuyến nghị: {mat_spec['nozzle_optimal']}°C).",
                    conflicting_parameters=["nozzleTemp"],
                    risk_penalty=20,
                )
            )
        else:
            passed_checks.append(f"Nhiệt độ đầu phun ({nozzle_temp:.0f}°C) đạt điểm nóng chảy lý tưởng.")

        # -------------------------------------------------------------
        # CHECK 5: Layer Height vs Nozzle Geometry
        # -------------------------------------------------------------
        max_layer_height_safe = nozzle_diam * 0.75  # 0.30mm for 0.4mm nozzle
        min_layer_height_safe = 0.06

        if layer_height > max_layer_height_safe:
            issues.append(
                PhysicsIssue(
                    code="PHYS-STRUC-001",
                    severity=PhysicsIssueSeverity.WARNING,
                    category=PhysicsIssueCategory.COOLING_STRENGTH,
                    title="Tỷ Lệ Chiều Cao Lớp Quá Lớn So Với Đầu Phun (Bad Aspect Ratio)",
                    description=(
                        f"Độ dày lớp {layer_height:.2f}mm vượt quá 75% đường kính đầu phun ({max_layer_height_safe:.2f}mm). "
                        f"Đường đùn không còn hình oval dẹp tiếp xúc tốt mà trở thành hình tròn rời rạc, làm giảm 60% diện tích bám dính."
                    ),
                    suggested_action=f"Hạ layerHeight về mức an toàn ≤ {max_layer_height_safe:.2f}mm (hoặc thay đầu phun đường kính 0.6mm).",
                    conflicting_parameters=["layerHeight"],
                    risk_penalty=18,
                )
            )
        elif layer_height < min_layer_height_safe:
            issues.append(
                PhysicsIssue(
                    code="PHYS-STRUC-002",
                    severity=PhysicsIssueSeverity.INFO,
                    category=PhysicsIssueCategory.COOLING_STRENGTH,
                    title="Độ Dày Lớp Cực Nhỏ (Ultra-thin Layer Height)",
                    description=(
                        f"Lớp in {layer_height:.2f}mm yêu cầu độ chính xác cơ khí Z cực cao và tăng thời gian in gấp 3-4 lần."
                    ),
                    suggested_action="Xem xét tăng lên 0.08mm - 0.12mm để cân bằng tốc độ và chi tiết.",
                    conflicting_parameters=["layerHeight"],
                    risk_penalty=6,
                )
            )
        else:
            passed_checks.append(f"Tỷ lệ độ dày lớp ({layer_height:.2f}mm) cân đối hoàn hảo với đầu phun {nozzle_diam}mm.")

        # -------------------------------------------------------------
        # CHECK 6: Wall Thickness & Infill Structural Integrity
        # -------------------------------------------------------------
        if wall_loops == 1 and infill_density < 15:
            issues.append(
                PhysicsIssue(
                    code="PHYS-STRUC-003",
                    severity=PhysicsIssueSeverity.WARNING,
                    category=PhysicsIssueCategory.COOLING_STRENGTH,
                    title="Vách Ngoài Quá Mỏng Kết Hợp Ruột Thưa (Ghosting / Shell Fragility)",
                    description=(
                        f"Chỉ có 1 vòng thành tường (wallLoops = 1) kết hợp mật độ ruột {infill_density:.0f}% sẽ làm lộ "
                        f"cấu trúc ruột ra mặt ngoài (Infill Show-through), đồng thời vỏ rất dễ giòn thủng khi chạm tay."
                    ),
                    suggested_action="Tăng wallLoops lên tối thiểu 2 hoặc 3 vòng tường để đảm bảo tính thẩm mỹ và cơ lý tính.",
                    conflicting_parameters=["wallLoops", "infillDensity"],
                    risk_penalty=14,
                )
            )
        else:
            passed_checks.append(f"Độ dày vỏ ngoài ({wall_loops} vòng tường) đảm bảo độ cứng vững.")

        # -------------------------------------------------------------
        # CHECK 7: Overhangs & Support Geometry
        # -------------------------------------------------------------
        if support_angle >= 55 and not has_support:
            issues.append(
                PhysicsIssue(
                    code="PHYS-GEOM-001",
                    severity=PhysicsIssueSeverity.CRITICAL,
                    category=PhysicsIssueCategory.GEOMETRY_SUPPORT,
                    title="Góc Vát Lớn Không Có Cành Đỡ (Severe Overhang Collapse)",
                    description=(
                        f"Ngưỡng góc nghiêng thiết lập {support_angle:.0f}° nhưng cấu trúc cành đỡ lại đang tắt (supportMode = Tắt). "
                        f"Bất kỳ góc treo lơ lửng dốc trên 45°-50° sẽ bị rơi sợi đùn tự do thành sợi mì (Spaghetti failure)."
                    ),
                    suggested_action="Kích hoạt supportMode = 'Tree' (Organic) hoặc 'Normal' để đỡ các bề mặt dốc.",
                    conflicting_parameters=["supportMode", "supportAngleThreshold"],
                    risk_penalty=30,
                )
            )
        elif has_support:
            passed_checks.append(f"Hệ thống cành đỡ ({profile.get('treeStyle', 'Tree')}) đã được cấu hình an toàn cho góc dốc.")

        # -------------------------------------------------------------
        # CHECK 8: TPU Flexible Filament Constraints
        # -------------------------------------------------------------
        if mat_key == "TPU":
            max_tpu_spd = mat_spec.get("max_print_speed", 45.0)
            if wall_speed > max_tpu_spd or infill_speed > max_tpu_spd:
                issues.append(
                    PhysicsIssue(
                        code="PHYS-FLEX-001",
                        severity=PhysicsIssueSeverity.CRITICAL,
                        category=PhysicsIssueCategory.SPEED_KINEMATICS,
                        title="Tốc Độ Quá Cao Đối Với Sợi Nhựa Dẻo TPU (Filament Jam)",
                        description=(
                            f"Nhựa TPU dẻo có độ đàn hồi cao. In ở tốc độ vách {wall_speed:.0f} mm/s hoặc ruột {infill_speed:.0f} mm/s "
                            f"(vượt giới hạn an toàn {max_tpu_spd:.0f} mm/s) sẽ khiến sợi nhựa bị gập cuộn quanh bánh răng kéo "
                            f"(Extruder Buckling) và nghẹt đường dẫn nhựa."
                        ),
                        suggested_action=f"Giảm toàn bộ tốc độ in xuống ≤ {max_tpu_spd:.0f} mm/s cho vật liệu dẻo TPU.",
                        conflicting_parameters=["outerWallSpeed", "infillSpeed", "printSpeed"],
                        risk_penalty=35,
                    )
                )

            max_tpu_ret = mat_spec.get("max_retraction", 1.5)
            if retraction_dist > max_tpu_ret:
                issues.append(
                    PhysicsIssue(
                        code="PHYS-FLEX-002",
                        severity=PhysicsIssueSeverity.WARNING,
                        category=PhysicsIssueCategory.FLOW_EXTRUSION,
                        title="Khoảng Cách Rút Nhựa Quá Lớn Cho TPU",
                        description=(
                            f"Khoảng cách rút {retraction_dist}mm đối với TPU sẽ kéo đoạn nhựa nóng chảy vào vùng tản nhiệt, "
                            f"khi đẩy ngược lại sợi dẻo sẽ phình to gây nghẽn hoàn toàn cổ họng đùn (Heat Creep Jam)."
                        ),
                        suggested_action=f"Giảm retractionDistanceMm xuống 0.6mm - 1.2mm cho máy truyền động trực tiếp (Direct Drive).",
                        conflicting_parameters=["retractionDistanceMm"],
                        risk_penalty=20,
                    )
                )

        # -------------------------------------------------------------
        # Compute Aggregate QC Risk & Health Score
        # -------------------------------------------------------------
        total_risk = sum(issue.risk_penalty for issue in issues)
        qc_risk_score = min(100, max(0, total_risk))
        qc_health_score = 100 - qc_risk_score

        if qc_risk_score <= 15:
            status = "OPTIMAL"
            status_label = "✅ Cấu hình tối ưu (An toàn in FDM)"
        elif qc_risk_score <= 35:
            status = "ACCEPTABLE"
            status_label = "ℹ️ Khả thi (Có thể tinh chỉnh thêm)"
        elif qc_risk_score <= 65:
            status = "CAUTION"
            status_label = "⚠️ Cảnh báo: Nguy cơ phát sinh lỗi ngoại quan hoặc cơ tính"
        else:
            status = "CRITICAL_HAZARD"
            status_label = "🚨 Nguy cơ hỏng bản in nghiêm trọng (Warping / Kẹt đùn / Sập)"

        summary_parts = []
        if issues:
            summary_parts.append(f"Phát hiện {len(issues)} vấn đề vật lý tiềm ẩn ({sum(1 for i in issues if i.severity == PhysicsIssueSeverity.CRITICAL)} lỗi nghiêm trọng).")
        else:
            summary_parts.append("Toàn bộ các quy tắc nhiệt học, lưu lượng nóng chảy và cơ tính đều đạt chuẩn hoàn hảo.")

        return PhysicsSanityResult(
            qc_risk_score=qc_risk_score,
            qc_health_score=qc_health_score,
            status=status,
            status_label=status_label,
            material=mat_key,
            max_volumetric_flow_rate=flow_limit,
            estimated_volumetric_flow_rate=max_demanded_flow,
            flow_headroom_percent=headroom,
            issues=issues,
            passed_checks=passed_checks,
            summary=" ".join(summary_parts),
        )

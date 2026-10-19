"""
AI Defect Prediction & Risk Heatmap Engine.
Analyzes 3D slicing parameters, thermal dynamics, and kinematic stresses
to calculate failure risk scores and actionable mitigation strategies.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from backend.src.domain.printer_profiles import get_printer_profile, PrinterHardwareSpecs


class DefectRiskItem(BaseModel):
    defect_id: str
    name: str
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Risk probability score 0-100%")
    risk_level: str = Field(..., description="LOW, MODERATE, HIGH, or CRITICAL")
    primary_cause: str
    physics_mechanism: str
    preventive_actions: List[str]


class DefectPredictionReport(BaseModel):
    overall_risk_score: float = Field(..., ge=0.0, le=100.0)
    overall_risk_level: str
    printer_id: Optional[str] = None
    printer_model: Optional[str] = None
    defect_breakdown: List[DefectRiskItem]
    heatmap_distribution: Dict[str, float]
    summary_verdict: str


class DefectPredictor:
    """Predicts common 3D printing defects based on physical heuristics and parameters."""

    @staticmethod
    def _extract_param(profile: Dict[str, Any], key: str, default: float) -> float:
        val = profile.get(key)
        if val is None:
            # Check nested tabs if any
            for tab_key in ["speed", "temperature", "extrusion", "layer", "motion", "cooling"]:
                sub = profile.get(tab_key)
                if isinstance(sub, dict) and key in sub:
                    val = sub[key]
                    break
        if val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    @staticmethod
    def _extract_str(profile: Dict[str, Any], key: str, default: str) -> str:
        val = profile.get(key)
        if val is None:
            for tab_key in ["material", "printer", "general"]:
                sub = profile.get(tab_key)
                if isinstance(sub, dict) and key in sub:
                    val = sub[key]
                    break
        return str(val).strip() if val is not None else default

    @classmethod
    def predict(
        cls,
        profile: Dict[str, Any],
        printer_id: Optional[str] = None
    ) -> DefectPredictionReport:
        specs: Optional[PrinterHardwareSpecs] = get_printer_profile(printer_id) if printer_id else None

        # Extract normalized parameters
        nozzle_temp = cls._extract_param(profile, "nozzle_temp", cls._extract_param(profile, "nozzle_temperature", 210.0))
        bed_temp = cls._extract_param(profile, "bed_temp", cls._extract_param(profile, "bed_temperature", 60.0))
        print_speed = cls._extract_param(profile, "print_speed", cls._extract_param(profile, "speed", 150.0))
        travel_speed = cls._extract_param(profile, "travel_speed", 250.0)
        layer_height = cls._extract_param(profile, "layer_height", 0.2)
        first_layer_speed = cls._extract_param(profile, "first_layer_speed", 30.0)
        line_width = cls._extract_param(profile, "line_width", 0.42)
        nozzle_dia = cls._extract_param(profile, "nozzle_diameter", 0.4)
        retraction_dist = cls._extract_param(profile, "retraction_distance", 0.8)
        retraction_speed = cls._extract_param(profile, "retraction_speed", 35.0)
        fan_speed = cls._extract_param(profile, "fan_speed", 100.0)
        acceleration = cls._extract_param(profile, "acceleration", 5000.0)
        material = cls._extract_str(profile, "material", "PLA").upper()

        # Volumetric flow calculation
        volumetric_flow = print_speed * layer_height * line_width
        max_flow = specs.max_volumetric_flow if specs else 24.0

        defects: List[DefectRiskItem] = []

        # -------------------------------------------------------------
        # 1. WARPING (Cong vênh góc đế in)
        # -------------------------------------------------------------
        warp_score = 10.0
        warp_causes = []
        warp_fixes = []

        if "ABS" in material or "ASA" in material:
            if bed_temp < 95.0:
                warp_score += 45.0
                warp_causes.append(f"Bed temp {bed_temp}°C quá thấp cho nhựa co ngót cao {material} (cần >= 100°C)")
                warp_fixes.append("Tăng nhiệt độ bàn in lên 100°C - 110°C")
            if specs and not specs.enclosed:
                warp_score += 30.0
                warp_causes.append("In vật liệu nhiệt độ cao trên máy in không có lồng kín (open frame)")
                warp_fixes.append("Sử dụng lồng chắn gió hoặc chuyển sang máy có buồng kín như Bambu/Voron")
            if fan_speed > 25.0:
                warp_score += 20.0
                warp_causes.append("Quạt làm mát quá mạnh làm nguội nhựa đột ngột gây co rút cơ học")
                warp_fixes.append("Tắt quạt hoặc giới hạn quạt dưới 15% đối với ABS/ASA")
        elif "PETG" in material:
            if bed_temp < 70.0:
                warp_score += 25.0
                warp_fixes.append("Tăng nhiệt bàn in PETG lên 75°C - 85°C")
        else: # PLA
            if bed_temp < 45.0:
                warp_score += 20.0
                warp_fixes.append("Tăng nhiệt bàn in PLA lên 55°C - 60°C")
            elif bed_temp > 70.0:
                warp_score += 15.0
                warp_causes.append("Nhiệt bàn in vượt quá nhiệt độ biến tinh (Tg ~60°C) của PLA gây mềm chân đế (Elephant foot)")
                warp_fixes.append("Hạ nhiệt bàn in PLA về 55°C - 60°C")

        if first_layer_speed > 40.0:
            warp_score += 20.0
            warp_causes.append(f"Tốc độ lớp đầu {first_layer_speed} mm/s quá nhanh cản trở bám dính")
            warp_fixes.append("Giảm tốc độ lớp đầu xuống 20 - 25 mm/s")

        warp_score = min(100.0, max(5.0, warp_score))
        defects.append(DefectRiskItem(
            defect_id="warping",
            name="Warping & Peeling (Bong tróc / Cong vênh góc đế)",
            risk_score=round(warp_score, 1),
            risk_level="CRITICAL" if warp_score >= 75 else ("HIGH" if warp_score >= 50 else ("MODERATE" if warp_score >= 25 else "LOW")),
            primary_cause=warp_causes[0] if warp_causes else "Độ bám dính nhiệt phân bố đồng đều",
            physics_mechanism="Co ngót thể tích bất đối xứng do gradient nhiệt độ giữa các lớp phía trên và bề mặt bàn gia nhiệt",
            preventive_actions=warp_fixes if warp_fixes else ["Bảo trì bôi keo dán bàn và giữ sạch dầu mỡ trên bề mặt PEI"]
        ))

        # -------------------------------------------------------------
        # 2. STRINGING & OOZING (Kéo tơ nhựa / Rỉ nhựa khi di chuyển)
        # -------------------------------------------------------------
        string_score = 10.0
        string_causes = []
        string_fixes = []

        is_direct_drive = (specs.extruder_type == "Direct Drive") if specs else True

        if is_direct_drive:
            if retraction_dist < 0.5:
                string_score += 35.0
                string_causes.append(f"Khoảng cách rút nhựa ({retraction_dist}mm) quá ngắn cho Direct Drive")
                string_fixes.append("Tăng khoảng cách rút nhựa (retraction distance) lên 0.8 - 1.2 mm")
            elif retraction_dist > 2.5:
                string_score += 15.0
                string_causes.append("Rút nhựa quá dài trên Direct Drive có nguy cơ gây kẹt họng nhiệt")
        else: # Bowden
            if retraction_dist < 3.0:
                string_score += 45.0
                string_causes.append(f"Khoảng cách rút nhựa ({retraction_dist}mm) quá ngắn đối với ống dẫn Bowden")
                string_fixes.append("Tăng khoảng cách rút nhựa lên 4.5 - 6.0 mm cho ống Bowden")

        if travel_speed < 150.0:
            string_score += 25.0
            string_causes.append(f"Tốc độ di chuyển không in ({travel_speed} mm/s) chậm, tạo thời gian cho nhựa lỏng nhỏ giọt")
            string_fixes.append("Tăng tốc độ di chuyển không in (Travel Speed) lên 250 - 350 mm/s")

        if "PETG" in material and nozzle_temp > 245.0:
            string_score += 20.0
            string_causes.append(f"Nhiệt độ in PETG ({nozzle_temp}°C) cao làm giảm độ nhớt nóng chảy")
            string_fixes.append("Hạ nhiệt độ đầu in PETG xuống 230°C - 240°C và bật tính năng 'Avoid crossing perimeters'")

        string_score = min(100.0, max(5.0, string_score))
        defects.append(DefectRiskItem(
            defect_id="stringing",
            name="Stringing & Oozing (Kéo tơ sợi nhựa / Chảy giọt travel)",
            risk_score=round(string_score, 1),
            risk_level="CRITICAL" if string_score >= 75 else ("HIGH" if string_score >= 50 else ("MODERATE" if string_score >= 25 else "LOW")),
            primary_cause=string_causes[0] if string_causes else "Áp suất đầu phun được triệt tiêu tốt khi travel",
            physics_mechanism="Sức căng bề mặt của polymer nóng chảy kết hợp với áp suất dư trong buồng hóa lỏng (melt zone) khi di chuyển",
            preventive_actions=string_fixes if string_fixes else ["Bảo quản sấy khô sợi nhựa (filament drying) để tránh bọt ẩm sôi"]
        ))

        # -------------------------------------------------------------
        # 3. LAYER SHIFTING (Mất bước động cơ / Lệch tầng)
        # -------------------------------------------------------------
        shift_score = 10.0
        shift_causes = []
        shift_fixes = []

        kinematics = specs.kinematics if specs else "CoreXY"
        max_accel = specs.max_acceleration if specs else 15000.0

        if acceleration > max_accel:
            ratio = (acceleration - max_accel) / max_accel
            shift_score += min(50.0, ratio * 70.0)
            shift_causes.append(f"Gia tốc ({acceleration} mm/s²) vượt trần công suất cơ học của máy ({max_accel} mm/s²)")
            shift_fixes.append(f"Giảm gia tốc in xuống dưới ngưỡng an toàn {max_accel * 0.85:.0f} mm/s²")

        if "Bed-Slinger" in kinematics and (print_speed > 220.0 or acceleration > 6000.0):
            shift_score += 35.0
            shift_causes.append("Cơ chế bàn in trượt trục Y (Bed-Slinger) chịu lực quán tính rất lớn khi chạy tốc độ cao")
            shift_fixes.append("Giảm gia tốc trục Y xuống dưới 4000 mm/s² và giảm tốc độ in khi in vật thể cao nặng")

        shift_score = min(100.0, max(5.0, shift_score))
        defects.append(DefectRiskItem(
            defect_id="layer_shifting",
            name="Layer Shifting (Mất bước trục / Lệch tầng cơ học)",
            risk_score=round(shift_score, 1),
            risk_level="CRITICAL" if shift_score >= 75 else ("HIGH" if shift_score >= 50 else ("MODERATE" if shift_score >= 25 else "LOW")),
            primary_cause=shift_causes[0] if shift_causes else "Động cơ và dây đai hoạt động trong dải mô-men xoắn an toàn",
            physics_mechanism="Mô-men xoắn cản trở của đầu đùn hoặc quán tính bàn in vượt qua mô-men giữ của động cơ bước (stepper motor torque limit)",
            preventive_actions=shift_fixes if shift_fixes else ["Kiểm tra độ căng dây đai đòn bẩy và bôi trơn ray trượt định kỳ"]
        ))

        # -------------------------------------------------------------
        # 4. CLOGGING & UNDER-EXTRUSION (Nghẹt vòi phun / Đùn thiếu nhựa)
        # -------------------------------------------------------------
        clog_score = 10.0
        clog_causes = []
        clog_fixes = []

        if volumetric_flow > max_flow:
            overage = (volumetric_flow - max_flow) / max_flow
            clog_score += min(60.0, overage * 80.0)
            clog_causes.append(f"Lưu lượng đùn ({volumetric_flow:.1f} mm³/s) vượt quá giới hạn nung chảy của hotend ({max_flow:.1f} mm³/s)")
            safe_speed = (max_flow * 0.9) / (layer_height * line_width)
            clog_fixes.append(f"Giảm tốc độ in xuống tối đa {safe_speed:.0f} mm/s hoặc tăng nhiệt độ đầu in thêm 10°C")

        if layer_height > nozzle_dia * 0.8:
            clog_score += 25.0
            clog_causes.append(f"Độ dày lớp in ({layer_height}mm) quá cao so với đường kính vòi phun ({nozzle_dia}mm)")
            clog_fixes.append(f"Giảm chiều cao lớp in xuống dưới {nozzle_dia * 0.6:.2f} mm")

        clog_score = min(100.0, max(5.0, clog_score))
        defects.append(DefectRiskItem(
            defect_id="clogging",
            name="Clogging & Under-Extrusion (Nghẹt vòi phun / Thiếu lưu lượng)",
            risk_score=round(clog_score, 1),
            risk_level="CRITICAL" if clog_score >= 75 else ("HIGH" if clog_score >= 50 else ("MODERATE" if clog_score >= 25 else "LOW")),
            primary_cause=clog_causes[0] if clog_causes else "Lưu lượng thể tích nằm trong vùng truyền nhiệt tối ưu",
            physics_mechanism="Tốc độ đẩy nhựa vượt quá năng lượng nhiệt truyền từ heater block, gây đông đặc cục bộ và trượt bánh răng đùn",
            preventive_actions=clog_fixes if clog_fixes else ["Sử dụng vòi phun High-Flow (CHT) nếu muốn in tốc độ cao hơn"]
        ))

        # -------------------------------------------------------------
        # 5. HEAT CREEP (Nhiệt leo ngược họng tản nhiệt)
        # -------------------------------------------------------------
        creep_score = 10.0
        creep_causes = []
        creep_fixes = []

        if "PLA" in material and specs and specs.enclosed and nozzle_temp > 220.0:
            creep_score += 35.0
            creep_causes.append("In nhựa PLA trong thùng máy đóng kín với nhiệt độ đầu phun cao gây mềm sợi nhựa sớm trong họng tản nhiệt")
            creep_fixes.append("Mở cửa kính hoặc mở nắp trên máy in khi in PLA để nhiệt thoát ra")

        if print_speed < 30.0 and nozzle_temp > 230.0:
            creep_score += 20.0
            creep_causes.append("Nhựa lưu lại trong vùng hóa lỏng quá lâu do tốc độ in quá chậm")
            creep_fixes.append("Tăng tốc độ in tối thiểu lên 50 mm/s hoặc giảm nhiệt độ đầu in")

        creep_score = min(100.0, max(5.0, creep_score))
        defects.append(DefectRiskItem(
            defect_id="heat_creep",
            name="Heat Creep (Nhiệt truyền ngược / Phồng sợi nhựa trước họng)",
            risk_score=round(creep_score, 1),
            risk_level="CRITICAL" if creep_score >= 75 else ("HIGH" if creep_score >= 50 else ("MODERATE" if creep_score >= 25 else "LOW")),
            primary_cause=creep_causes[0] if creep_causes else "Quạt tản nhiệt hotend giải nhiệt ổn định",
            physics_mechanism="Sự dẫn nhiệt ngược từ block nung chảy lên vùng cold zone vượt quá công suất tản nhiệt của heatsink fan",
            preventive_actions=creep_fixes if creep_fixes else ["Vệ sinh bụi trên cánh quạt tản nhiệt của cụm đầu đùn"]
        ))

        # Overall weighted risk score
        weights = {"warping": 0.25, "clogging": 0.30, "layer_shifting": 0.20, "stringing": 0.15, "heat_creep": 0.10}
        total_risk = sum(item.risk_score * weights.get(item.defect_id, 0.2) for item in defects)

        if total_risk >= 65.0:
            overall_level = "CRITICAL"
            verdict = "⚠️ Nguy cơ in hỏng rất cao! Cần điều chỉnh lại các thông số xung đột vật lý trước khi xuất G-Code."
        elif total_risk >= 45.0:
            overall_level = "HIGH"
            verdict = "Cảnh báo: Có một số thông số tiệm cận giới hạn chịu tải cơ nhiệt, có thể để lại khuyết tật bề mặt."
        elif total_risk >= 25.0:
            overall_level = "MODERATE"
            verdict = "Hồ sơ in chấp nhận được, chỉ có vài rủi ro thẩm mỹ nhỏ có thể tối ưu thêm."
        else:
            overall_level = "LOW"
            verdict = "✅ Hồ sơ in xuất sắc! Mọi thông số đều nằm trong vùng dung sai cơ nhiệt tối ưu của thiết bị."

        heatmap = {item.defect_id: item.risk_score for item in defects}

        return DefectPredictionReport(
            overall_risk_score=round(total_risk, 1),
            overall_risk_level=overall_level,
            printer_id=specs.id if specs else None,
            printer_model=f"{specs.brand} {specs.model}" if specs else "Generic FDM",
            defect_breakdown=defects,
            heatmap_distribution=heatmap,
            summary_verdict=verdict
        )
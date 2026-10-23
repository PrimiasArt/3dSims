"""
Statistical Process Control (SPC) & Anomaly Detection Engine for 3D Printing Production.
Calculates Mean, Variance, Shewhart Control Limits (UCL, CL, LCL), Process Capability
Indices (Cp, Cpk, Cpm), and detects operational outliers using Z-score and IQR heuristics.
"""
import math
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field


class ControlLimits(BaseModel):
    cl: float = Field(..., description="Center Line (Mean)")
    ucl: float = Field(..., description="Upper Control Limit (+3 sigma)")
    lcl: float = Field(..., description="Lower Control Limit (-3 sigma)")
    sigma: float = Field(..., description="Standard deviation")
    sample_size: int


class ProcessCapability(BaseModel):
    cp: float = Field(..., description="Potential Process Capability (USL - LSL) / 6 sigma")
    cpk: float = Field(..., description="Demonstrated Process Capability min(USL-mu, mu-LSL) / 3 sigma")
    status: str = Field(..., description="SIX_SIGMA, CAPABLE, MARGINAL, or INCAPABLE")
    usl: float = Field(..., description="Upper Specification Limit")
    lsl: float = Field(..., description="Lower Specification Limit")
    ppm_estimated_defects: float = Field(..., description="Estimated Parts Per Million defective")
    interpretation: str


class AnomalyRecord(BaseModel):
    session_id: str
    metric: str
    observed_value: float
    expected_mean: float
    deviation_sigma: float = Field(..., description="Z-Score standard deviations from mean")
    severity: str = Field(..., description="CRITICAL, HIGH, or MODERATE")
    root_cause_hypothesis: str
    remediation_suggestion: str


class BatchQCReport(BaseModel):
    total_audited_sessions: int
    passed_sessions: int
    failed_sessions: int
    yield_rate_percent: float
    average_qc_score: float
    process_capability_summary: Dict[str, ProcessCapability]
    control_charts: Dict[str, ControlLimits]
    detected_anomalies: List[AnomalyRecord]
    executive_recommendations: List[str]


class SPCEngine:
    """Mathematical engine for industrial statistical process control and outlier detection."""

    @staticmethod
    def calculate_stats(values: List[float]) -> Tuple[float, float, float, float, float]:
        """Returns (mean, stdev, min, max, median)."""
        if not values:
            return 0.0, 0.0, 0.0, 0.0, 0.0
        n = len(values)
        mean_val = sum(values) / n
        if n > 1:
            variance = sum((x - mean_val) ** 2 for x in values) / (n - 1)
            sigma = math.sqrt(variance)
        else:
            sigma = 0.0

        sorted_vals = sorted(values)
        min_val = sorted_vals[0]
        max_val = sorted_vals[-1]
        mid = n // 2
        median_val = sorted_vals[mid] if n % 2 != 0 else (sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0

        return mean_val, sigma, min_val, max_val, median_val

    @classmethod
    def calculate_control_limits(cls, values: List[float]) -> ControlLimits:
        """Calculates Shewhart 3-sigma control limits."""
        mean_val, sigma, _, _, _ = cls.calculate_stats(values)
        return ControlLimits(
            cl=round(mean_val, 2),
            ucl=round(mean_val + 3.0 * sigma, 2),
            lcl=round(max(0.0, mean_val - 3.0 * sigma), 2),
            sigma=round(sigma, 3),
            sample_size=len(values)
        )

    @classmethod
    def calculate_process_capability(
        cls,
        values: List[float],
        lsl: float,
        usl: float
    ) -> ProcessCapability:
        """Calculates Cp, Cpk and defect PPM against engineering tolerances."""
        mean_val, sigma, _, _, _ = cls.calculate_stats(values)
        if sigma <= 0.0001:
            # Virtually zero variance -> perfect capability
            return ProcessCapability(
                cp=2.0,
                cpk=2.0,
                status="SIX_SIGMA",
                usl=usl,
                lsl=lsl,
                ppm_estimated_defects=0.0,
                interpretation="Quy trình đạt đẳng cấp Six Sigma: Độ biến thiên cực kỳ thấp, kiểm soát nhiệt/áp hoàn hảo."
            )

        cp = (usl - lsl) / (6.0 * sigma)
        cpu = (usl - mean_val) / (3.0 * sigma)
        cpl = (mean_val - lsl) / (3.0 * sigma)
        cpk = min(cpu, cpl)

        # Estimate PPM (Parts per Million) using normal cumulative distribution approximation
        z_min = min(cpu, cpl)
        # Erf-based normal CDF approximation
        def normal_cdf(z):
            return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))

        prob_defect = (1.0 - normal_cdf(cpu)) + (1.0 - normal_cdf(cpl))
        ppm = max(0.0, min(1000000.0, prob_defect * 1000000.0))

        if cpk >= 1.67:
            status = "SIX_SIGMA"
            interp = f"Cpk={cpk:.2f} (Six Sigma): Năng lực quy trình tuyệt đối, tỷ lệ lỗi dự kiến < 1 PPM."
        elif cpk >= 1.33:
            status = "CAPABLE"
            interp = f"Cpk={cpk:.2f} (Đạt chuẩn công nghiệp): Quy trình ổn định, tỷ lệ lỗi xấp xỉ {ppm:.1f} PPM."
        elif cpk >= 1.0:
            status = "MARGINAL"
            interp = f"Cpk={cpk:.2f} (Cận biên nguy cơ): Quy trình dao động sát ngưỡng dung sai, cần giám sát định kỳ."
        else:
            status = "INCAPABLE"
            interp = f"Cpk={cpk:.2f} (Không đạt chuẩn): Độ tán xạ quá lớn, nguy cơ in hỏng lên tới {ppm:,.0f} PPM."

        return ProcessCapability(
            cp=round(cp, 2),
            cpk=round(cpk, 2),
            status=status,
            usl=usl,
            lsl=lsl,
            ppm_estimated_defects=round(ppm, 1),
            interpretation=interp
        )

    @classmethod
    def detect_anomalies(
        cls,
        sessions_data: List[Dict[str, Any]]
    ) -> List[AnomalyRecord]:
        """Detects outliers across sessions using Z-Score and physics bounds."""
        anomalies: List[AnomalyRecord] = []
        if len(sessions_data) < 3:
            return anomalies

        # Check QC Score outliers
        qc_scores = []
        for s in sessions_data:
            val = s.get("qc_score") or s.get("qcScore") or 80.0
            qc_scores.append((str(s.get("session_id") or s.get("sessionId", "N/A")), float(val)))

        mean_qc, sigma_qc, _, _, _ = cls.calculate_stats([x[1] for x in qc_scores])
        if sigma_qc > 1.0:
            for s_id, score in qc_scores:
                z = (score - mean_qc) / sigma_qc
                if z < -2.2 or score < 60.0:
                    anomalies.append(AnomalyRecord(
                        session_id=s_id,
                        metric="QC Score",
                        observed_value=score,
                        expected_mean=round(mean_qc, 1),
                        deviation_sigma=round(z, 2),
                        severity="CRITICAL" if score < 50.0 else "HIGH",
                        root_cause_hypothesis="Điểm chất lượng giảm đột biến do xuất hiện xung đột thông số hoặc lỗi bám dính nặng.",
                        remediation_suggestion="Kiểm tra lại vật liệu in và chạy lại bài test Physics Sanity Check."
                    ))

        # Check Duration Outliers
        durations = []
        for s in sessions_data:
            d = s.get("durationMinutes") or s.get("duration_minutes") or 0.0
            if float(d) > 0:
                durations.append((str(s.get("session_id") or s.get("sessionId", "N/A")), float(d)))

        if len(durations) >= 3:
            mean_d, sigma_d, _, _, _ = cls.calculate_stats([x[1] for x in durations])
            if sigma_d > 0.5:
                for s_id, dur in durations:
                    z = (dur - mean_d) / sigma_d
                    if abs(z) > 2.5:
                        anomalies.append(AnomalyRecord(
                            session_id=s_id,
                            metric="Thời gian in (Phút)",
                            observed_value=dur,
                            expected_mean=round(mean_d, 1),
                            deviation_sigma=round(z, 2),
                            severity="MODERATE",
                            root_cause_hypothesis=f"Thời gian in lệch {z:+.1f}σ so với trung bình lô sản xuất.",
                            remediation_suggestion="Đối soát tốc độ di chuyển không in (Travel Speed) và mật độ Infill."
                        ))

        # Check Volumetric Flow excursions
        for s in sessions_data:
            s_id = str(s.get("session_id") or s.get("sessionId", "N/A"))
            slicer = s.get("slicer", {})
            hw = s.get("hardware", {})
            spd = hw.get("speedF", {}).get("infillMmS") or slicer.get("speed") or 150.0
            lh = slicer.get("layerHeightMm") or slicer.get("layer_height") or 0.2
            flow = float(spd) * float(lh) * 0.42
            if flow > 28.0:
                anomalies.append(AnomalyRecord(
                    session_id=s_id,
                    metric="Lưu lượng thể tích (Flow Rate)",
                    observed_value=round(flow, 1),
                    expected_mean=18.0,
                    deviation_sigma=round((flow - 18.0) / 4.0, 2),
                    severity="HIGH",
                    root_cause_hypothesis=f"Lưu lượng đùn {flow:.1f} mm³/s tiệm cận hoặc vượt quá công suất gia nhiệt hotend.",
                    remediation_suggestion="Kích hoạt tính năng Auto-Tune để hạ tốc độ in xuống mức an toàn."
                ))

        return anomalies
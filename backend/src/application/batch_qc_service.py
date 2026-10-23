"""
Batch QC and Statistical Process Control (SPC) Application Service.
Orchestrates large-scale batch quality checks across dozens of simulation sessions,
evaluates process capability (Cp, Cpk), and extracts multi-metric control charts.
"""
from typing import Dict, Any, List, Optional
from backend.src.domain.spc_engine import (
    SPCEngine,
    BatchQCReport,
    ProcessCapability,
    ControlLimits,
    AnomalyRecord,
)
from backend.src.domain.defect_predictor import DefectPredictor
from backend.src.domain.protocols import VaultStorageProtocol


class BatchQCService:
    """Orchestrates batch-level quality audits and statistical quality metrics."""

    @classmethod
    def load_vault_sessions(cls, vault: VaultStorageProtocol) -> List[Dict[str, Any]]:
        """Reads all sessions from nhat_ky_in.json."""
        import json
        json_path = vault._resolve_safe_path("nhat_ky_in.json")
        if not json_path.exists():
            return []
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])
                elif isinstance(data, list):
                    return data
        except Exception:
            return []
        return []

    @classmethod
    def audit_batch(
        cls,
        sessions: List[Dict[str, Any]],
        printer_id: Optional[str] = None
    ) -> BatchQCReport:
        """Performs comprehensive batch audit on a collection of print sessions."""
        total = len(sessions)
        if total == 0:
            return BatchQCReport(
                total_audited_sessions=0,
                passed_sessions=0,
                failed_sessions=0,
                yield_rate_percent=100.0,
                average_qc_score=100.0,
                process_capability_summary={},
                control_charts={},
                detected_anomalies=[],
                executive_recommendations=["Chua co phien in nao duoc cung cap de tham dinh hang loat."]
            )

        passed_count = 0
        failed_count = 0
        qc_scores: List[float] = []
        nozzle_temps: List[float] = []
        bed_temps: List[float] = []
        flows: List[float] = []

        enriched_sessions = []

        for s in sessions:
            s_id = str(s.get("session_id") or s.get("sessionId") or "UNK")
            status = str(s.get("status", "COMPLETED")).upper()

            # Extract parameters
            slicer = s.get("slicer", {})
            hw = s.get("hardware", {})

            # Temperature
            noz = hw.get("nozzleTempC") or s.get("nozzle_temp") or slicer.get("nozzle_temp") or 215.0
            bed = hw.get("bedTempC") or s.get("bed_temp") or slicer.get("bed_temp") or 60.0

            # Speed & Flow
            spd = hw.get("speedF", {}).get("infillMmS") or s.get("print_speed") or slicer.get("speed") or 150.0
            lh = slicer.get("layerHeightMm") or s.get("layer_height") or slicer.get("layer_height") or 0.2
            flow = float(spd) * float(lh) * 0.42

            # Evaluate defect prediction
            profile_snapshot = {
                "material": s.get("material", "PLA"),
                "nozzle_temp": float(noz),
                "bed_temp": float(bed),
                "print_speed": float(spd),
                "layer_height": float(lh),
                "line_width": 0.42
            }
            defect_rep = DefectPredictor.predict(profile_snapshot, printer_id)
            score = max(20.0, round(100.0 - defect_rep.overall_risk_score, 1))

            if status in ("COMPLETED", "SUCCESS") and score >= 70.0:
                passed_count += 1
            else:
                failed_count += 1

            qc_scores.append(score)
            nozzle_temps.append(float(noz))
            bed_temps.append(float(bed))
            flows.append(round(flow, 2))

            enriched = dict(s)
            enriched["qc_score"] = score
            enriched_sessions.append(enriched)

        yield_rate = round((passed_count / total) * 100.0, 1)
        avg_qc = round(sum(qc_scores) / total, 1)

        # Control Charts
        charts: Dict[str, ControlLimits] = {
            "qc_score": SPCEngine.calculate_control_limits(qc_scores),
            "nozzle_temp": SPCEngine.calculate_control_limits(nozzle_temps),
            "bed_temp": SPCEngine.calculate_control_limits(bed_temps),
            "volumetric_flow": SPCEngine.calculate_control_limits(flows)
        }

        # Process Capability
        capabilities: Dict[str, ProcessCapability] = {
            "qc_score": SPCEngine.calculate_process_capability(qc_scores, lsl=70.0, usl=100.0),
            "volumetric_flow": SPCEngine.calculate_process_capability(flows, lsl=2.0, usl=26.0)
        }

        # Anomalies
        anomalies: List[AnomalyRecord] = SPCEngine.detect_anomalies(enriched_sessions)

        # Executive recommendations
        recs: List[str] = []
        if yield_rate < 85.0:
            recs.append(f"Ty le Yield {yield_rate}% duoi chuan cong nghiep (85%). Can chay Auto-Tune dong bo cho cac ca in diem duoi 70.")
        if capabilities["qc_score"].cpk < 1.33:
            recs.append(f"Chi so Cpk diem chat luong ({capabilities['qc_score'].cpk:.2f}) chua dat muc 1.33, the hien do phan tan quy trinh con lon.")
        if len(anomalies) > 0:
            recs.append(f"Phat hien {len(anomalies)} ca in co thong so di thuong (outliers) can kiem tra nhat ky loi truoc khi san xuat hang loat.")
        if not recs:
            recs.append("Day chuyen san xuat dat trang thai kiem soat thong ke ly tuong (Stable In-Control Process).")

        return BatchQCReport(
            total_audited_sessions=total,
            passed_sessions=passed_count,
            failed_sessions=failed_count,
            yield_rate_percent=yield_rate,
            average_qc_score=avg_qc,
            process_capability_summary=capabilities,
            control_charts=charts,
            detected_anomalies=anomalies,
            executive_recommendations=recs
        )

    @classmethod
    def get_control_chart_timeseries(
        cls,
        sessions: List[Dict[str, Any]],
        metric_key: str = "qc_score"
    ) -> Dict[str, Any]:
        """Returns time-series data points with UCL, CL, LCL for frontend plotting."""
        report = cls.audit_batch(sessions)
        limits = report.control_charts.get(metric_key, SPCEngine.calculate_control_limits([80.0]))

        points = []
        for idx, s in enumerate(sessions):
            s_id = str(s.get("session_id") or s.get("sessionId") or f"S_{idx+1}")
            val = 80.0
            if metric_key == "qc_score":
                val = float(s.get("qc_score") or s.get("qcScore") or 80.0)
            elif metric_key == "nozzle_temp":
                val = float(s.get("hardware", {}).get("nozzleTempC") or s.get("nozzle_temp") or 215.0)
            elif metric_key == "bed_temp":
                val = float(s.get("hardware", {}).get("bedTempC") or s.get("bed_temp") or 60.0)
            elif metric_key == "volumetric_flow":
                spd = float(s.get("hardware", {}).get("speedF", {}).get("infillMmS") or s.get("print_speed") or 150.0)
                lh = float(s.get("slicer", {}).get("layerHeightMm") or s.get("layer_height") or 0.2)
                val = round(spd * lh * 0.42, 2)

            points.append({
                "session_id": s_id,
                "value": round(val, 2),
                "is_out_of_control": val > limits.ucl or val < limits.lcl
            })

        return {
            "metric": metric_key,
            "limits": limits.model_dump(),
            "data_points": points
        }
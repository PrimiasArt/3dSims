"""
Executive QC Certificate & Standalone HTML Report Generator.
Renders a luxury, print-ready 3D printing simulation verification certificate
with physical metrics, defect risk breakdown, and compliance seals.
"""
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from backend.src.domain.defect_predictor import DefectPredictor
from backend.src.domain.printer_profiles import get_printer_profile


class QCCertificateService:
    """Generates standalone printable HTML Quality Certificates."""

    @classmethod
    def generate_html(
        cls,
        session_id: str,
        profile: Dict[str, Any],
        audit_data: Optional[Dict[str, Any]] = None,
        printer_id: Optional[str] = None
    ) -> str:
        audit = audit_data or {}
        specs = get_printer_profile(printer_id) if printer_id else None
        defect_report = DefectPredictor.predict(profile, printer_id)

        # Basic metadata
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        printer_name = f"{specs.brand} {specs.model}" if specs else profile.get("printer_name", "Industrial FDM Standard")
        material = str(profile.get("material", "PLA+ / Standard")).upper()
        speed = profile.get("print_speed", profile.get("speed", 150))
        layer_h = profile.get("layer_height", 0.20)
        nozzle_d = profile.get("nozzle_diameter", 0.40)
        bed_temp = profile.get("bed_temp", profile.get("bed_temperature", 60))
        nozzle_temp = profile.get("nozzle_temp", profile.get("nozzle_temperature", 215))

        # Metrics calculation
        qc_score = audit.get("qc_score", max(30, int(100 - defect_report.overall_risk_score)))
        is_pass = qc_score >= 70 and defect_report.overall_risk_level in ["LOW", "MODERATE"]
        badge_text = "PASSED FOR PRODUCTION" if is_pass else "CONDITIONALLY VERIFIED"
        badge_class = "pass-badge" if is_pass else "warning-badge"

        # Build defect table rows
        defect_rows = ""
        for d in defect_report.defect_breakdown:
            color = "#ef4444" if d.risk_score >= 60 else ("#f59e0b" if d.risk_score >= 35 else "#10b981")
            defect_rows += f"""
            <tr>
                <td style="font-weight: 600; color: #f8fafc;">{d.name}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; background: #1e293b; height: 6px; border-radius: 3px; overflow: hidden;">
                            <div style="width: {d.risk_score}%; background: {color}; height: 100%;"></div>
                        </div>
                        <span style="font-weight: 700; color: {color}; font-size: 13px;">{d.risk_score}%</span>
                    </div>
                </td>
                <td style="font-size: 12px; color: #94a3b8;">{d.primary_cause}</td>
                <td style="font-size: 12px; color: #38bdf8;">{d.preventive_actions[0] if d.preventive_actions else 'N/A'}</td>
            </tr>
            """

        html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QC Certificate - Session {session_id}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-canvas: #090d16;
            --bg-card: #0f172a;
            --bg-surface: #1e293b;
            --border-color: rgba(255, 255, 255, 0.08);
            --gold-primary: #f59e0b;
            --gold-gradient: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
            --accent-cyan: #06b6d4;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }}
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
        }}
        body {{
            background: var(--bg-canvas);
            color: var(--text-main);
            padding: 40px 20px;
            display: flex;
            justify-content: center;
        }}
        .certificate-container {{
            width: 100%;
            max-width: 960px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 48px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            position: relative;
            overflow: hidden;
        }}
        .certificate-container::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: var(--gold-gradient);
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 28px;
            margin-bottom: 32px;
        }}
        .brand-title {{
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .subtitle {{
            font-size: 13px;
            color: var(--gold-primary);
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-weight: 700;
            margin-top: 4px;
        }}
        .meta-box {{
            text-align: right;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--text-muted);
        }}
        .status-badge-container {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
        }}
        .score-circle {{
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 3px solid var(--gold-primary);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(245, 158, 11, 0.05);
        }}
        .score-num {{
            font-size: 28px;
            font-weight: 800;
            color: #ffffff;
            line-height: 1;
        }}
        .score-sub {{
            font-size: 10px;
            color: var(--gold-primary);
            font-weight: 600;
        }}
        .badge-pill {{
            padding: 8px 18px;
            border-radius: 9999px;
            font-weight: 800;
            font-size: 13px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }}
        .pass-badge {{
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.4);
        }}
        .warning-badge {{
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.4);
        }}
        .grid-2 {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            margin-bottom: 32px;
        }}
        .info-card {{
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
        }}
        .card-heading {{
            font-size: 13px;
            font-weight: 700;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            font-size: 13px;
        }}
        .info-row:last-child {{
            border-bottom: none;
        }}
        .info-label {{
            color: var(--text-muted);
        }}
        .info-val {{
            font-weight: 600;
            color: var(--text-main);
            font-family: 'JetBrains Mono', monospace;
        }}
        table.defect-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 12px;
        }}
        table.defect-table th {{
            text-align: left;
            padding: 10px;
            background: rgba(15, 23, 42, 0.8);
            color: var(--text-muted);
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
        }}
        table.defect-table td {{
            padding: 12px 10px;
            border-bottom: 1px solid var(--border-color);
        }}
        .footer {{
            margin-top: 40px;
            padding-top: 24px;
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }}
        .signature-box {{
            text-align: center;
            width: 220px;
        }}
        .signature-line {{
            width: 100%;
            border-bottom: 1px dashed var(--text-muted);
            margin-bottom: 8px;
            height: 40px;
        }}
        .btn-print {{
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: var(--gold-gradient);
            color: #000;
            font-weight: 700;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        @media print {{
            body {{
                background: #ffffff !important;
                color: #000000 !important;
                padding: 0 !important;
            }}
            .certificate-container {{
                box-shadow: none !important;
                border: 1px solid #ccc !important;
                background: #ffffff !important;
                color: #000000 !important;
                padding: 30px !important;
            }}
            .btn-print {{ display: none !important; }}
            .brand-title {{ -webkit-text-fill-color: #000 !important; }}
            .info-card, .status-badge-container {{ background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }}
            .info-val, .score-num {{ color: #000 !important; }}
            table.defect-table th {{ background: #e2e8f0 !important; color: #000 !important; }}
            table.defect-table td {{ color: #000 !important; }}
        }}
    </style>
</head>
<body>
    <div class="certificate-container">
        <div class="header">
            <div>
                <div class="brand-title">3D PrintSim Pro - Quality Audit</div>
                <div class="subtitle">Official Verification Certificate & Technical Compliance</div>
            </div>
            <div class="meta-box">
                <div>SESSION: <strong style="color: #f8fafc;">{session_id}</strong></div>
                <div>ISSUED: {now_str}</div>
                <div>ENGINE: v2.4 Physical Simulator</div>
            </div>
        </div>

        <div class="status-badge-container">
            <div style="display: flex; align-items: center; gap: 20px;">
                <div class="score-circle">
                    <span class="score-num">{qc_score}</span>
                    <span class="score-sub">QC SCORE</span>
                </div>
                <div>
                    <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">{badge_text}</div>
                    <div style="font-size: 13px; color: var(--text-muted);">{defect_report.summary_verdict}</div>
                </div>
            </div>
            <div class="badge-pill {badge_class}">{badge_text}</div>
        </div>

        <div class="grid-2">
            <div class="info-card">
                <div class="card-heading">🖨️ Kinematic & Hardware Profile</div>
                <div class="info-row">
                    <span class="info-label">Target Machine</span>
                    <span class="info-val">{printer_name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Kinematic Type</span>
                    <span class="info-val">{specs.kinematics if specs else 'CoreXY / Cartesian'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Extruder Style</span>
                    <span class="info-val">{specs.extruder_type if specs else 'Direct Drive'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Enclosure Environment</span>
                    <span class="info-val">{'Enclosed Chamber' if (specs and specs.enclosed) else 'Open Frame'}</span>
                </div>
            </div>

            <div class="info-card">
                <div class="card-heading">⚙️ Slicer Parameter Matrix</div>
                <div class="info-row">
                    <span class="info-label">Filament Polymer</span>
                    <span class="info-val" style="color: #38bdf8;">{material}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Nozzle / Bed Temp</span>
                    <span class="info-val">{nozzle_temp}°C / {bed_temp}°C</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Print Speed / Layer H</span>
                    <span class="info-val">{speed} mm/s | {layer_h} mm</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Volumetric Flow</span>
                    <span class="info-val">{speed * layer_h * nozzle_d * 1.05:.1f} mm³/s</span>
                </div>
            </div>
        </div>

        <div class="info-card" style="margin-bottom: 32px;">
            <div class="card-heading">🔬 AI Failure Risk & Defect Prediction Breakdown</div>
            <table class="defect-table">
                <thead>
                    <tr>
                        <th style="width: 25%;">Failure Category</th>
                        <th style="width: 20%;">Risk Probability</th>
                        <th style="width: 30%;">Root Cause Mechanism</th>
                        <th style="width: 25%;">Preventive Tuning</th>
                    </tr>
                </thead>
                <tbody>
                    {defect_rows}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <div style="font-size: 11px; color: var(--text-muted); max-width: 480px; line-height: 1.5;">
                Chứng chỉ được cấp tự động bởi Physics Sanity Engine. Kết quả thẩm định dựa trên thuật toán động học dòng chảy nhiệt FDM và đối soát trần thông số thiết bị.
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div style="font-size: 12px; font-weight: 700; color: #f8fafc;">PHYSICS AUDITOR</div>
                <div style="font-size: 11px; color: var(--gold-primary);">3D PrintSim Pro Verification System</div>
            </div>
        </div>
    </div>

    <button class="btn-print" onclick="window.print()">
        🖨️ In Chứng chỉ / Xuất PDF
    </button>
</body>
</html>
"""
        return html
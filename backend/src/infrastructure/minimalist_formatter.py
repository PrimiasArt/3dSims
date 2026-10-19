"""
Minimalist Log Formatter conforming strictly to the LOCKED SCHEMA & PRINT LOG CONTRACT.
Spreadsheet-Style Master Log Table Component for Obsidian:
- Exact 2-Tier Header Architecture from User Specifications:
  1. THÔNG TIN PHIÊN (colspan=2): Mã Phiên | Phiên Gốc
  2. VẬN HÀNH & THỜI GIAN (colspan=2): Người Thực Hiện | Thời Gian (Thời Lượng)
  3. KẾT QUẢ & HIỆN TƯỢNG (colspan=2): Trạng Thái | Chi Tiết Lỗi / Ghi Chú
  4. CẤU TRÚC LỚP & KHỐI (colspan=5): Độ Cao Lớp (mm) | Mật Độ Ruột | Thành Vách | Nóc / Đáy | Support & Góc
  5. THÔNG SỐ MÁY & ĐÙN NHỰA (colspan=5): Tốc Độ F (mm/s) | Vách • Ruột (mm/s) | Nhiệt Bàn (°C) | Đầu In • Quạt | Đùn • Rút • Hop
  6. NỐI TIẾP (colspan=1): Phiên Nối Tiếp
- Top KPI Summary Cards:
  * Tổng Số Phiên In
  * Hoàn Tất Thành Công (Xanh lá)
  * Số Ca Lỗi Warping (Đỏ/Cam)
  * Tỷ Lệ Thành Công (Xanh dương)
- 100% Obsidian Native Link compatibility with class="internal-link" data-href="..."
"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


PARAM_CONFIG = {
    "layerHeight": {"key": "A_do_day_lop", "label": "A (Độ dày lớp)", "unit": "mm"},
    "supportMode": {"key": "B_canh_do", "label": "B (Cành đỡ)", "unit": ""},
    "treeStyle": {"key": "B_canh_do", "label": "B (Cành đỡ)", "unit": ""},
    "infillDensity": {"key": "C_do_rong", "label": "C (Độ rỗng)", "unit": "%"},
    "brimEnabled": {"key": "D_vanh_bam", "label": "D (Vành bám)", "unit": ""},
    "brimWidthMm": {"key": "D_vanh_bam", "label": "D (Vành bám)", "unit": "mm"},
    "bedTemp": {"key": "E_nhiet_ban_in", "label": "E (Nhiệt bàn in)", "unit": "°C"},
    "printSpeed": {"key": "F_toc_do_day", "label": "F (Tốc độ lớp đáy)", "unit": "mm/s"},
}


ALL_PARAM_SPECS: Dict[str, Dict[str, Any]] = {
    # ================= TAB 1: CƠ BẢN =================
    "preset": {"tab_name": "Cơ Bản", "label": "Cấu hình in mẫu (Preset)", "unit": "", "default": "Standard"},
    "material": {"tab_name": "Cơ Bản", "label": "Chất liệu nhựa (Material)", "unit": "", "default": "PLA"},
    "materialColor": {"tab_name": "Cơ Bản", "label": "Màu sắc nhựa (Color)", "unit": "", "default": "#ea580c"},
    "layerHeight": {"tab_name": "Cơ Bản", "label": "Độ dày lớp in (Layer Height)", "unit": "mm", "default": 0.20, "report_key": "A_do_day_lop", "report_label": "A (Độ dày lớp)"},
    "infillDensity": {"tab_name": "Cơ Bản", "label": "Độ rỗng bên trong (Infill)", "unit": "%", "default": 20, "report_key": "C_do_rong", "report_label": "C (Độ rỗng)"},
    "infillType": {"tab_name": "Cơ Bản", "label": "Kiểu hoa văn ruột", "unit": "", "default": "Gyroid"},
    "supportMode": {"tab_name": "Cơ Bản", "label": "Cấu trúc đỡ (Support Mode)", "unit": "", "default": "Tắt", "report_key": "B_canh_do", "report_label": "B (Cành đỡ)"},
    "brimEnabled": {"tab_name": "Cơ Bản", "label": "Vành bám bàn in (Brim)", "unit": "", "default": False, "report_key": "D_vanh_bam", "report_label": "D (Vành bám)"},

    # ================= TAB 2: VÁCH & VỎ =================
    "wallLoops": {"tab_name": "Vách & Vỏ", "label": "Số vòng tường ngoài (Wall Loops)", "unit": "vòng", "default": 2},
    "firstLayerHeight": {"tab_name": "Vách & Vỏ", "label": "Chiều cao lớp đầu tiên", "unit": "mm", "default": 0.20},
    "topShellLayers": {"tab_name": "Vách & Vỏ", "label": "Lớp nóc (Top Shells)", "unit": "lớp", "default": 4},
    "bottomShellLayers": {"tab_name": "Vách & Vỏ", "label": "Lớp đáy (Bottom Shells)", "unit": "lớp", "default": 3},
    "seamPosition": {"tab_name": "Vách & Vỏ", "label": "Vị trí giấu đường nối (Seam Alignment)", "unit": "", "default": "Aligned"},

    # ================= TAB 3: SUPPORT =================
    "treeStyle": {"tab_name": "Support", "label": "Kiểu dáng Tree Support", "unit": "", "default": "Organic", "report_key": "B_canh_do", "report_label": "B (Cành đỡ)"},
    "supportAngleThreshold": {"tab_name": "Support", "label": "Ngưỡng góc nghiêng (Overhang Angle)", "unit": "°", "default": 45},
    "supportTopZDistance": {"tab_name": "Support", "label": "Khe hở bóc tách (Top Z Distance)", "unit": "mm", "default": 0.20},
    "supportBranchDiameter": {"tab_name": "Support", "label": "Đường kính cành (Branch Diameter)", "unit": "mm", "default": 2.8},
    "supportBranchAngle": {"tab_name": "Support", "label": "Góc vươn cành (Branch Angle)", "unit": "°", "default": 42},
    "brimWidthMm": {"tab_name": "Support", "label": "Bề rộng vành Brim", "unit": "mm", "default": 5, "report_key": "D_vanh_bam", "report_label": "D (Vành bám)"},

    # ================= TAB 4: TỐC ĐỘ =================
    "printSpeed": {"tab_name": "Tốc Độ", "label": "Tốc độ in tổng thể", "unit": "mm/s", "default": 60, "report_key": "F_toc_do_day", "report_label": "F (Tốc độ lớp đáy)"},
    "outerWallSpeed": {"tab_name": "Tốc Độ", "label": "Tốc độ vách ngoài (Outer Wall)", "unit": "mm/s", "default": 150},
    "infillSpeed": {"tab_name": "Tốc Độ", "label": "Tốc độ ruột (Infill Speed)", "unit": "mm/s", "default": 275},
    "travelSpeed": {"tab_name": "Tốc Độ", "label": "Tốc độ chạy không tải (Travel Move)", "unit": "mm/s", "default": 500},

    # ================= TAB 5: NHIỆT ĐỘ =================
    "nozzleTemp": {"tab_name": "Nhiệt Độ", "label": "Nhiệt độ Đầu Phun (Nozzle)", "unit": "°C", "default": 210},
    "bedTemp": {"tab_name": "Nhiệt Độ", "label": "Nhiệt độ Bàn In (Heatbed)", "unit": "°C", "default": 60, "report_key": "E_nhiet_ban_in", "report_label": "E (Nhiệt bàn in)"},
    "coolingFanSpeed": {"tab_name": "Nhiệt Độ", "label": "Tốc độ quạt thổi làm mát (Part Fan)", "unit": "%", "default": 100},

    # ================= TAB 6: ĐÙN NHỰA =================
    "flowRateMm3s": {"tab_name": "Đùn Nhựa", "label": "Hệ số dòng đùn (Flow Ratio)", "unit": "", "default": 0.98},
    "retractionDistanceMm": {"tab_name": "Đùn Nhựa", "label": "Khoảng cách rút nhựa (Retraction)", "unit": "mm", "default": 0.8},
    "retractionSpeedMmS": {"tab_name": "Đùn Nhựa", "label": "Tốc độ rút (Retraction Speed)", "unit": "mm/s", "default": 35},
    "zHopMm": {"tab_name": "Đùn Nhựa", "label": "Nhấc đầu Z-Hop", "unit": "mm", "default": 0.4},
}

APP_CHANGEABLE_PARAMETERS = [
    {
        "id": pid,
        "category": spec["tab_name"],
        "label": spec["label"],
        "default": spec["default"],
        "unit": spec.get("unit", ""),
        "report_key": spec.get("report_key"),
        "report_label": spec.get("report_label", spec["label"]),
        "is_report_target": bool(spec.get("report_key")),
    }
    for pid, spec in ALL_PARAM_SPECS.items()
]


def format_param_value(param_name: str, val: Any) -> str:
    """Formats value cleanly according to domain standards across all 5+ tabs."""
    if val is None:
        return "Mặc định"
    if param_name == "brimEnabled":
        return "Bật 5mm" if bool(val) else "Tắt"
    if param_name in ("supportMode", "treeStyle"):
        val_str = str(val).lower()
        if "tree" in val_str or val_str == "organic":
            return "Tree"
        if val_str in ("none", "false", "tắt"):
            return "None"
        if val_str in ("normal", "snug"):
            return "Normal"
        return str(val).capitalize()
    if param_name in ("infillDensity", "coolingFanSpeed"):
        return f"{val}%"
    if param_name in (
        "layerHeight",
        "firstLayerHeight",
        "supportTopZDistance",
        "supportBranchDiameter",
        "brimWidthMm",
        "retractionDistanceMm",
        "zHopMm",
    ):
        return f"{val}mm"
    if param_name in ("bedTemp", "nozzleTemp"):
        return f"{val}°C"
    if param_name in (
        "printSpeed",
        "outerWallSpeed",
        "infillSpeed",
        "travelSpeed",
        "retractionSpeedMmS",
    ):
        return f"{val}mm/s"
    if param_name == "wallLoops":
        return f"{val} vòng"
    if param_name in ("topShellLayers", "bottomShellLayers"):
        return f"{val} lớp"
    if param_name in ("supportAngleThreshold", "supportBranchAngle"):
        return f"{val}°"
    if param_name == "flowRateMm3s":
        try:
            return f"{float(val):.2f}"
        except Exception:
            return str(val)
    if param_name == "seamPosition":
        m = {
            "aligned": "Aligned (Thẳng hàng)",
            "nearest": "Nearest (Gần nhất)",
            "random": "Random (Ngẫu nhiên)",
        }
        return m.get(str(val).lower(), str(val))
    return str(val)


def _get_val_and_churn(entry: Dict[str, Any], key: str, alias: Optional[str] = None) -> Tuple[Optional[str], int]:
    """Helper to extract parameter value and mutation count."""
    tham_so = entry.get("tham_so", {})
    if key in tham_so:
        it = tham_so[key]
        if isinstance(it, dict):
            return it.get("gia_tri"), it.get("so_lan_doi", 1)
        return str(it), 1
    if alias and alias in tham_so:
        it = tham_so[alias]
        if isinstance(it, dict):
            return it.get("gia_tri"), it.get("so_lan_doi", 1)
        return str(it), 1
    for k in [key, alias] if alias else [key]:
        if k in entry and entry[k] != "-":
            raw = str(entry[k])
            val_part = raw.split(" (")[0]
            mut = 1
            if "(" in raw and "lần" in raw:
                try:
                    mut = int(raw.split("(")[1].split(" lần")[0].replace("đổi ", "").strip())
                except Exception:
                    mut = 1
            return val_part, mut
    return None, 0


def convert_entry_to_print_log_session(entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Converts an existing session entry strictly to the PrintLogSession schema contract.
    """
    if "sessionId" in entry and "slicer" in entry:
        return entry

    p_str = entry.get("sessionId") or entry.get("phien", "01")
    user = entry.get("operator") or entry.get("nguoi_dung", "Nguyễn Văn A")
    parent = entry.get("parentSessionId") or entry.get("thu_lai_tu_phien")
    time_raw = entry.get("thoi_gian") or entry.get("startedAt", "2026-10-15 08:47 (7 phút)")

    duration = 7
    if "(" in time_raw and "phút" in time_raw:
        try:
            duration = int(time_raw.split("(")[1].split(" phút")[0].strip())
        except Exception:
            duration = 7
    started_at = time_raw.split(" (")[0].strip()

    loi = entry.get("loi", "Không phát hiện lỗi")
    if "Va chạm" in loi or "Warping" in loi:
        status = "WARPING"
        failure = "Lớp 35: Va chạm đầu in (thiếu vành bám)"
    elif "Nghẹt" in loi:
        status = "FAILED"
        failure = "Lớp 120: Nghẹt nhựa đầu phun"
    else:
        status = "COMPLETED"
        failure = None

    # Slicer Config
    va, _ = _get_val_and_churn(entry, "A_do_day_lop", "layerHeight")
    lh = float(va.replace("mm", "").strip()) if va and "mm" in va else 0.20

    vc, _ = _get_val_and_churn(entry, "C_do_rong", "infillDensity")
    inf = int(vc.replace("%", "").strip()) if vc and "%" in vc else 20

    vw, _ = _get_val_and_churn(entry, "wallLoops")
    wl = int(vw.replace(" vòng", "").strip()) if vw and "vòng" in vw else 2

    vt, _ = _get_val_and_churn(entry, "topShellLayers")
    top_l = int(vt.replace(" lớp", "").strip()) if vt and "lớp" in vt else 4
    vbt, _ = _get_val_and_churn(entry, "bottomShellLayers")
    bot_l = int(vbt.replace(" lớp", "").strip()) if vbt and "lớp" in vbt else 3

    vb, _ = _get_val_and_churn(entry, "B_canh_do", "supportMode")
    sup_raw = (vb or "None").lower()
    if "tree" in sup_raw:
        sup_type = "Tree"
    elif "organic" in sup_raw:
        sup_type = "Organic"
    elif "normal" in sup_raw:
        sup_type = "Normal"
    else:
        sup_type = "None"

    # Hardware Telemetry
    vf, _ = _get_val_and_churn(entry, "F_toc_do_day", "printSpeed")
    spd = int(vf.replace("mm/s", "").strip()) if vf and "mm/s" in vf else 60

    ve, _ = _get_val_and_churn(entry, "E_nhiet_ban_in", "bedTemp")
    bed_t = int(ve.replace("°C", "").strip()) if ve and "°C" in ve else 60

    v_noz, _ = _get_val_and_churn(entry, "nozzleTemp")
    noz_t = int(v_noz.replace("°C", "").strip()) if v_noz and "°C" in v_noz else 210

    v_fan, _ = _get_val_and_churn(entry, "coolingFanSpeed")
    fan_spd = int(v_fan.replace("%", "").strip()) if v_fan and "%" in v_fan else 100

    v_flow, _ = _get_val_and_churn(entry, "flowRateMm3s")
    flow_r = float(v_flow) if v_flow else 0.98

    v_ret, _ = _get_val_and_churn(entry, "retractionDistanceMm")
    ret_mm = float(v_ret.replace("mm", "").strip()) if v_ret and "mm" in v_ret else 0.8

    v_zh, _ = _get_val_and_churn(entry, "zHopMm")
    zh_mm = float(v_zh.replace("mm", "").strip()) if v_zh and "mm" in v_zh else 0.4

    session_obj = {
        "sessionId": p_str,
        "operator": user,
        "startedAt": started_at,
        "durationMinutes": duration,
        "status": status,
        "slicer": {
            "layerHeightMm": lh,
            "infillPercent": inf,
            "wallLoops": wl,
            "topBottomLayers": {"top": top_l, "bottom": bot_l},
            "supportType": sup_type,
            "supportOverhangAngle": 45,
        },
        "hardware": {
            "speedF": {"defaultMmS": spd, "wallMmS": 150, "infillMmS": 275},
            "tempsE": {"bedTempC": bed_t, "nozzleTempC": noz_t, "fanSpeedPercent": fan_spd},
            "extrusion": {"flowRatio": flow_r, "retractionMm": ret_mm, "zHopMm": zh_mm},
        },
    }
    if parent:
        session_obj["parentSessionId"] = parent
    if failure:
        session_obj["failureDetail"] = failure

    return session_obj


def build_session_entry(
    phien_index: int,
    metrics: List[Any],
    nguoi_dung: str = "Nguyễn Văn A",
    thoi_gian_str: Optional[str] = None,
    hanh_dong: str = "Mô phỏng (50x) -> Bắt đầu in",
    loi: Optional[str] = None,
    thu_lai_tu_phien: Optional[str] = None,
) -> Dict[str, Any]:
    """Builds a single session object strictly conforming to nhat_ky_in.json contract."""
    phien_str = f"{phien_index:02d}"

    if not thoi_gian_str:
        now = datetime.now()
        thoi_gian_str = f"{now.strftime('%Y-%m-%d %H:%M')} (7 phút)"

    tham_so: Dict[str, Dict[str, Any]] = {}
    for m in metrics:
        p_name = getattr(m, "parameter_name", "")
        mut_count = getattr(m, "mutation_count", 0)
        formatted_val = format_param_value(p_name, getattr(m, "final_value", None))
        times = max(1, mut_count) if mut_count > 0 else 1

        cfg = PARAM_CONFIG.get(p_name)
        if cfg:
            key = cfg["key"]
            if key in tham_so:
                if mut_count > tham_so[key]["so_lan_doi"]:
                    tham_so[key] = {
                        "gia_tri": formatted_val,
                        "so_lan_doi": times,
                    }
            else:
                tham_so[key] = {
                    "gia_tri": formatted_val,
                    "so_lan_doi": times,
                }

        tham_so[p_name] = {
            "gia_tri": formatted_val,
            "so_lan_doi": times,
            "tab": getattr(m, "tab_name", ALL_PARAM_SPECS.get(p_name, {}).get("tab_name", "Cơ Bản")),
        }

    entry: Dict[str, Any] = {
        "phien": phien_str,
        "nguoi_dung": nguoi_dung,
        "thoi_gian": thoi_gian_str,
    }
    if thu_lai_tu_phien:
        entry["thu_lai_tu_phien"] = thu_lai_tu_phien

    param_keys = ["A_do_day_lop", "B_canh_do", "C_do_rong", "D_vanh_bam", "E_nhiet_ban_in", "F_toc_do_day"]
    for pk in param_keys:
        if pk in tham_so:
            val = tham_so[pk].get("gia_tri", "-")
            doi = tham_so[pk].get("so_lan_doi", 1)
            entry[pk] = f"{val} ({doi} lần ⚠️)" if doi >= 3 else (f"{val} ({doi} lần)" if doi > 1 else str(val))
        else:
            entry[pk] = "-"

    entry["hanh_dong"] = hanh_dong
    entry["loi"] = loi or "Không phát hiện lỗi nghiêm trọng (In hoàn tất)"
    entry["tham_so"] = tham_so

    return entry


def render_kpi_cards(sessions: List[Dict[str, Any]]) -> str:
    """Renders native Obsidian KPI summary callout without any raw HTML."""
    total = len(sessions)
    completed = sum(1 for s in sessions if s.get("status") == "COMPLETED")
    warping = sum(1 for s in sessions if s.get("status") == "WARPING")
    rate = f"{(completed / total * 100):.1f}%" if total > 0 else "0.0%"

    return f"""> [!summary] 📊 BẢNG TỔNG HỢP CHỈ SỐ VẬN HÀNH (KPI SUMMARY)
> 
> | 📦 TỔNG SỐ PHIÊN IN | ✅ HOÀN TẤT THÀNH CÔNG | ⚠️ SỐ CA LỖI WARPING | 📈 TỶ LỆ THÀNH CÔNG |
> | :---: | :---: | :---: | :---: |
> | **{total}** | **{completed}** | **{warping}** | **{rate}** |"""


def render_spreadsheet_table(sessions: List[Dict[str, Any]]) -> str:
    """
    Renders the exact 17-column Master Table in 100% Native Obsidian GFM Markdown syntax.
    Zero raw HTML tags so Obsidian Live Preview and Reading Mode render it seamlessly.
    """
    header = (
        "| Mã Phiên | Phiên Gốc | Người Thực Hiện | Thời Gian (Thời Lượng) | Trạng Thái | Chi Tiết Lỗi / Ghi Chú | Độ Cao Lớp (mm) | Mật Độ Ruột | Thành Vách | Nóc / Đáy | Support & Góc | Tốc Độ F (mm/s) | Vách • Ruột (mm/s) | Nhiệt Bàn (°C) | Đầu In • Quạt | Đùn • Rút • Hop | Phiên Nối Tiếp |\n"
        "| :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: |"
    )
    rows = []
    total = len(sessions)

    for i, s in enumerate(sessions):
        s_id = s.get("sessionId", f"{i+1:02d}")
        parent_id = s.get("parentSessionId")
        op = s.get("operator", "Kỹ sư in 3D (CoreXY)")
        started = s.get("startedAt", "-").replace("2026-", "")
        duration = s.get("durationMinutes", 7)
        status = s.get("status", "COMPLETED")
        failure = s.get("failureDetail")

        slicer = s.get("slicer", {})
        lh = slicer.get("layerHeightMm", 0.20)
        inf = slicer.get("infillPercent", 20)
        inf_type = slicer.get("infillType", "Gyroid")
        wl = slicer.get("wallLoops", 2)
        tb = slicer.get("topBottomLayers", {"top": 4, "bottom": 3})
        sup = slicer.get("supportType", "None")
        ang = slicer.get("supportOverhangAngle", 45)

        hw = s.get("hardware", {})
        spd = hw.get("speedF", {})
        spd_def = spd.get("defaultMmS", 60)
        spd_wall = spd.get("wallMmS", 150)
        spd_inf = spd.get("infillMmS", 275)

        temps = hw.get("tempsE", {})
        bed_t = temps.get("bedTempC", 60)
        noz_t = temps.get("nozzleTempC", 210)
        fan = temps.get("fanSpeedPercent", 100)

        ext = hw.get("extrusion", {})
        flow = ext.get("flowRatio", 0.98)
        ret = ext.get("retractionMm", 0.8)
        zh = ext.get("zHopMm", 0.4)

        # Links (Obsidian native wikilink with escaped pipe)
        phien_link = f"[[PHIEU_{s_id}\\|PHIEU_{s_id}]]"
        parent_link = f"[[PHIEU_{parent_id}\\|PHIEU_{parent_id}]]" if parent_id else "—"

        # Status badge
        if status == "COMPLETED":
            badge = "✅ Hoàn tất"
        elif status == "WARPING":
            badge = "⚠️ Lỗi Warping"
        elif status == "FAILED":
            badge = "❌ Thất bại"
        else:
            badge = "🔄 Đang in"

        failure_text = failure if failure else "—"

        if i < total - 1:
            nxt_id = sessions[i + 1].get("sessionId", f"{i+2:02d}")
            next_link = f"[[PHIEU_{nxt_id}\\|PHIEU_{nxt_id}]]"
        else:
            next_link = "— (Mới nhất)"

        extrusion_summary = f"Dòng {flow:.2f} • Rút {ret}mm • Hop {zh}mm"
        top_bot = f"{tb.get('top', 4)}/{tb.get('bottom', 3)}"

        row = (
            f"| {phien_link} | {parent_link} | {op} | {started} ({duration}p) | "
            f"{badge} | {failure_text} | {lh:.2f} | {inf}% ({inf_type}) | "
            f"{wl} vòng | {top_bot} | {sup} ({ang}°) | {spd_def} | "
            f"{spd_wall} • {spd_inf} | {bed_t}°C | {noz_t}°C • {fan}% | "
            f"{extrusion_summary} | {next_link} |"
        )
        rows.append(row)

    return header + "\n" + "\n".join(rows)


def build_parameter_session_matrix(entries: List[Dict[str, Any]]) -> Tuple[List[str], List[Dict[str, Any]], str]:
    """
    Constructs the Spreadsheet Master Table and returns session IDs, session objects, and markdown.
    """
    sessions = [convert_entry_to_print_log_session(e) for e in entries]
    session_cols = [s["sessionId"] for s in sessions]
    table_md = render_spreadsheet_table(sessions)
    return session_cols, sessions, table_md


def render_markdown_log(entries: List[Dict[str, Any]]) -> str:
    """
    Renders nhat_ky_in.md in 100% Native Obsidian Markdown syntax:
    - Clean Frontmatter
    - Title: NHẬT KÝ THEO DÕI & TỐI ƯU HÓA THÔNG SỐ IN 3D
    - Obsidian Callout KPI Cards
    - 17-column GFM Master Table with [[PHIEU_XX]] internal links
    - Embedded Dataview Query
    """
    sessions = [convert_entry_to_print_log_session(e) for e in entries]
    ma_phien = [s["sessionId"] for s in sessions]
    operator = sessions[0]["operator"] if sessions else "Kỹ sư in 3D (CoreXY)"
    ma_phien_formatted = str(ma_phien).replace("'", '"')

    kpi_callout = render_kpi_cards(sessions)
    table_markdown = render_spreadsheet_table(sessions)

    return f"""---
ma_phien: {ma_phien_formatted}
nguoi_dung: "{operator}"
the: [printsim/nhat-ky]
---

# 📋 NHẬT KÝ THEO DÕI & TỐI ƯU HÓA THÔNG SỐ IN 3D

> **Obsidian MOC:** [[000_PRINT_INDEX]] | **Người thực hiện:** `{operator}`

---

{kpi_callout}

---

### 📑 BẢNG THEO DÕI CHI TIẾT 17 THAM SỐ IN 3D (MASTER SPREADSHEET)

{table_markdown}

---

## 🔍 Truy Vấn Tự Động (Obsidian Dataview)
```dataview
TABLE startedAt as "Thời gian", status as "Trạng thái", slicer.layerHeightMm as "Độ dày lớp", hardware.speedF.defaultMmS as "Tốc độ F"
FROM "02_NhatKy_In" OR #printsim/phieu-in
SORT file.mtime DESC
```

---
*Tự động đồng bộ và hợp nhất bởi 3D PrintSim Telemetry Engine.*
"""


def extract_session_report_parameters(metrics: List[Any]) -> Dict[str, Any]:
    """
    Truy xuất chính xác các thông số cần report từ metrics phiên in:
    1. locked_report_parameters: Ánh xạ chuẩn A_..., B_..., C_..., D_..., E_..., F_... kèm số lần đổi & cảnh báo.
    2. all_parameters: Toàn bộ danh sách 29 thông số từ tất cả các tab (Cơ Bản, Vách & Vỏ, Support, Tốc Độ, Nhiệt Độ, Đùn Nhựa).
    3. by_tab: Nhóm theo từng tab của bảng Cấu hình in & Cắt lớp.
    """
    locked_report: Dict[str, Any] = {}
    all_params: Dict[str, Any] = {}
    by_tab: Dict[str, List[Dict[str, Any]]] = {}

    for m in metrics:
        p_name = getattr(m, "parameter_name", "")
        mut_count = getattr(m, "mutation_count", 0)
        final_val = getattr(m, "final_value", None)
        formatted_val = format_param_value(p_name, final_val)
        cfg = PARAM_CONFIG.get(p_name)
        spec = ALL_PARAM_SPECS.get(p_name, {})

        tab = getattr(m, "tab_name", None) or spec.get("tab_name", "Cơ Bản")
        label = getattr(m, "label", None) or spec.get("label", p_name)

        item = {
            "parameter_name": p_name,
            "tab_name": tab,
            "label": label,
            "gia_tri_goc": final_val,
            "gia_tri_dinh_dang": formatted_val,
            "so_lan_doi": mut_count,
            "canh_bao_phan_van": mut_count >= 3,
            "canh_bao_icon": "⚠️" if mut_count >= 3 else "",
            "chuoi_hien_thi": f"{formatted_val} (đổi {mut_count} lần ⚠️)" if mut_count >= 3 else (f"{formatted_val} (1 lần)" if mut_count == 1 else (f"{formatted_val} (đổi {mut_count} lần)" if mut_count > 1 else f"{formatted_val} (Mặc định)")),
            "lich_su": getattr(m, "change_history", []),
        }

        all_params[p_name] = item
        by_tab.setdefault(tab, []).append(item)

        if cfg:
            key = cfg["key"]
            locked_report[key] = {
                "key": key,
                "nhan": cfg["label"],
                "gia_tri": formatted_val,
                "so_lan_doi": max(1, mut_count),
                "canh_bao": mut_count >= 3,
                "chuoi_hien_thi": f"`{formatted_val}` (đổi {mut_count} lần ⚠️)" if mut_count >= 3 else (f"`{formatted_val}` (1 lần)" if mut_count <= 1 else f"`{formatted_val}` (đổi {mut_count} lần)"),
            }

    sorted_locked = dict(sorted(locked_report.items(), key=lambda item: item[0]))

    return {
        "locked_report_parameters": sorted_locked,
        "all_parameters": all_params,
        "by_tab": by_tab,
        "total_parameters": len(all_params),
        "total_changed_parameters": sum(1 for v in all_params.values() if v["so_lan_doi"] > 0),
        "high_churn_count": sum(1 for v in all_params.values() if v["canh_bao_phan_van"]),
    }

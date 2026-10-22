"""
Session Formatter & Master Log Table Generator.
Converts raw session logs into structured contracts, renders KPI summary cards,
and builds the 17-column GFM Master Table with native Obsidian internal wikilinks.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from backend.src.infrastructure.formatters.profile_formatter import (
    PARAM_CONFIG,
    ALL_PARAM_SPECS,
    format_param_value,
    get_val_and_churn,
)


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
    va, _ = get_val_and_churn(entry, "A_do_day_lop", "layerHeight")
    lh = float(va.replace("mm", "").strip()) if va and "mm" in va else 0.20

    vc, _ = get_val_and_churn(entry, "C_do_rong", "infillDensity")
    inf = int(float(vc.replace("%", "").strip())) if vc and "%" in vc else 20

    vw, _ = get_val_and_churn(entry, "wallLoops")
    wl = int(float(vw.replace(" vòng", "").strip())) if vw and "vòng" in vw else 2

    vt, _ = get_val_and_churn(entry, "topShellLayers")
    top_l = int(float(vt.replace(" lớp", "").strip())) if vt and "lớp" in vt else 4
    vbt, _ = get_val_and_churn(entry, "bottomShellLayers")
    bot_l = int(float(vbt.replace(" lớp", "").strip())) if vbt and "lớp" in vbt else 3

    vb, _ = get_val_and_churn(entry, "B_canh_do", "supportMode")
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
    vf, _ = get_val_and_churn(entry, "F_toc_do_day", "printSpeed")
    spd = int(float(vf.replace("mm/s", "").strip())) if vf and "mm/s" in vf else 60

    ve, _ = get_val_and_churn(entry, "E_nhiet_ban_in", "bedTemp")
    bed_t = int(float(ve.replace("°C", "").strip())) if ve and "°C" in ve else 60

    v_noz, _ = get_val_and_churn(entry, "nozzleTemp")
    noz_t = int(float(v_noz.replace("°C", "").strip())) if v_noz and "°C" in v_noz else 210

    v_fan, _ = get_val_and_churn(entry, "coolingFanSpeed")
    fan_spd = int(float(v_fan.replace("%", "").strip())) if v_fan and "%" in v_fan else 100

    v_flow, _ = get_val_and_churn(entry, "flowRateMm3s")
    flow_r = float(v_flow) if v_flow else 0.98

    v_ret, _ = get_val_and_churn(entry, "retractionDistanceMm")
    ret_mm = float(v_ret.replace("mm", "").strip()) if v_ret and "mm" in v_ret else 0.8

    v_zh, _ = get_val_and_churn(entry, "zHopMm")
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


def render_phieu_markdown(s: dict) -> str:
    """Renders individual PHIEU_{session_id}.md note for 02_NhatKy_In folder."""
    s_id = str(s.get("sessionId", "01"))
    op = s.get("operator", "Kỹ sư in 3D (CoreXY)")
    started = s.get("startedAt", "2026-10-17 10:00")
    dur = s.get("durationMinutes", 7)
    status = s.get("status", "COMPLETED")
    parent = s.get("parentSessionId")
    failure = s.get("failureDetail")

    slicer = s.get("slicer", {})
    lh = slicer.get("layerHeightMm", 0.2)
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

    status_text = "Hoàn tất thành công" if status == "COMPLETED" else ("Lỗi Warping" if status == "WARPING" else "Thất bại")
    parent_md = f"[[PHIEU_{parent}|Phiên {parent}]]" if parent else "Không có (Phiên gốc ban đầu)"

    return f"""---
ma_phien: "{s_id}"
nguoi_thuc_hien: "{op}"
thoi_gian: "{started}"
thoi_luong: "{dur} phút"
trang_thai: "{status}"
phien_goc: "{parent or '-'}"
tags:
  - printsim/phieu-in
  - printsim/phien-{s_id}
---

# 🖨️ Phiếu In Chi Tiết: PHIEU_{s_id}

> **Điều hướng:** [[000_PRINT_INDEX|MOC Tổng]] | [[nhat_ky_in|📋 Bảng Nhật Ký Tổng Hợp]]  
> **Người thực hiện:** `{op}` | **Bắt đầu lúc:** `{started}` (`{dur} phút`)  
> **Trạng thái:** `{status_text}` | **Phiên gốc:** {parent_md}

---

## 📌 Kết Quả & Hiện Tượng In
- **Đánh giá tổng quan:** {status_text}
- **Chi tiết lỗi / Ghi chú:** {failure if failure else "Không phát hiện lỗi nghiêm trọng. Quá trình in diễn ra ổn định hoàn toàn."}

---

## ⚙️ Cấu Hình Slicer & Khối (Cấu Trúc Lớp)
| Thông số | Giá trị thiết lập | Ghi chú kỹ thuật |
| :--- | :--- | :--- |
| **Độ cao lớp (Layer Height)** | `{lh:.2f} mm` | Chiều cao từng lớp đùn |
| **Mật độ ruột (Infill)** | `{inf}% ({inf_type})` | Cấu trúc rỗng bên trong |
| **Số vòng thành vách (Wall Loops)** | `{wl} vòng` | Độ dày vỏ ngoài |
| **Lớp Nóc / Đáy (Top/Bottom)** | `{tb.get('top', 4)} / {tb.get('bottom', 3)}` | Số lớp kín mặt trên & mặt đáy |
| **Giá đỡ & Góc (Support)** | `{sup} ({ang}°)` | Kiểu giá đỡ và ngưỡng góc dốc |

---

## 🎛️ Thông Số Phần Cứng & Đùn Nhựa (Hardware & Telemetry)
| Thành phần | Thiết lập vận hành | Vai trò kỹ thuật |
| :--- | :--- | :--- |
| **Tốc độ di chuyển F** | `{spd_def} mm/s` (Vách: `{spd_wall}` • Ruột: `{spd_inf}`) | Tốc độ in các phân đoạn |
| **Nhiệt độ E** | Bàn in: `{bed_t}°C` • Đầu in: `{noz_t}°C` • Quạt: `{fan}%` | Kiểm soát nhiệt & tản nhiệt |
| **Cơ chế đùn nhựa** | Dòng đùn: `{flow}` • Rút sợi: `{ret} mm` • Z-Hop: `{zh} mm` | Chống tơ và chống va chạm |

---

## 🔍 Truy Vấn Tự Động (Obsidian Dataview)
```dataview
TABLE startedAt as "Thời gian", status as "Trạng thái", slicer.layerHeightMm as "Độ dày lớp", hardware.speedF.defaultMmS as "Tốc độ F"
FROM #printsim/phieu-{s_id}
```

---
*Phiếu in được tự động kết xuất bởi 3D PrintSim Telemetry Engine.*
"""


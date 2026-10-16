"""
Minimalist Log Formatter conforming strictly to the LOCKED SCHEMA contract.
Unified 1-Table Horizontal Matrix Architecture:
- Each ROW is a Session (Phiên 01, Phiên 02, ..., Phiên N)
- Columns represent the 7 Areas/Layers distributed horizontally:
  1. Phiên In & Kế thừa
  2. Thời Gian & Người Dùng
  3. Tiến Trình & Sự Cố
  4. 🟢 Cấu Hình Cơ Bản (A/B/C/D)
  5. 🟡 Vách & Vỏ
  6. 🌲 Cành Đỡ (Support)
  7. ⚡ Tốc Độ In (F)
  8. 🔥 Nhiệt Độ & Quạt (E)
  9. 💧 Đùn Nhựa
  10. Phiên Tiếp Nối
- Maximum visual compactness: 7 sessions fit completely on 1 screen without endless scrolling.
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
            return "Tắt"
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


def _format_cell_item(label: str, val: Optional[str], mut: int) -> str:
    """Formats an item inside a cell with bold label and badge."""
    if not val or val == "-":
        return ""
    badge = f" ({mut} lần ⚠️)" if mut >= 3 else (f" ({mut} lần)" if mut > 1 else "")
    return f"**{label}:** `{val}`{badge}"


def build_parameter_session_matrix(entries: List[Dict[str, Any]]) -> Tuple[List[str], List[Dict[str, Any]], str]:
    """
    Constructs the 1-table UNIFIED HORIZONTAL MATRIX:
    - Each ROW is a Session (Phiên 01, Phiên 02, ..., Phiên N)
    - Columns represent the 7 Areas/Layers distributed horizontally:
      1. Phiên In & Kế thừa
      2. Thời Gian & Người Dùng
      3. Tiến Trình & Sự Cố
      4. 🟢 Cấu Hình Cơ Bản (A/B/C/D)
      5. 🟡 Vách & Vỏ
      6. 🌲 Support & Góc Dốc
      7. ⚡ Tốc Độ In (F)
      8. 🔥 Nhiệt Độ & Quạt (E)
      9. 💧 Đùn Nhựa
      10. Tiếp Nối
    """
    session_cols = [e.get("phien", f"{i+1:02d}") for i, e in enumerate(entries)]
    num_sessions = len(session_cols)

    table_lines: List[str] = [
        "| Phiên In | Thời Gian & Người Dùng | Tiến Trình & Sự Cố | 🟢 Cơ Bản (A/B/C/D) | 🟡 Vách & Vỏ | 🌲 Support | ⚡ Tốc Độ (F) | 🔥 Nhiệt Độ (E) | 💧 Đùn Nhựa | Tiếp Nối |",
        "| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |",
    ]

    json_horizontal_rows: List[Dict[str, Any]] = []

    for i, e in enumerate(entries):
        p_str = e.get("phien", f"{i+1:02d}")
        thu_lai = e.get("thu_lai_tu_phien")
        user_name = e.get("nguoi_dung", "Nguyễn Văn A")
        time_str = e.get("thoi_gian", "-").replace("2026-", "")
        act = str(e.get("hanh_dong", "-")).replace("->", "➔")
        loi_desc = e.get("loi", "Không phát hiện lỗi")

        # 1. Phiên in
        col_phien = f"[[PHIEU_{p_str}]]"
        if thu_lai:
            col_phien += f"<br>*(từ [[PHIEU_{thu_lai}]])* "

        # 2. Người dùng & Thời gian
        col_user_time = f"**{user_name}**<br>`{time_str}`"

        # 3. Tiến trình & Sự cố
        if "Va chạm" in loi_desc or "Warping" in loi_desc:
            status_badge = "⚠️ **Warping (Lớp 35)**"
        elif "Nghẹt" in loi_desc:
            status_badge = "⚠️ **Nghẹt đầu phun**"
        else:
            status_badge = "✅ **Hoàn tất (Không lỗi)**"
        col_action_status = f"{act}<br>{status_badge}"

        # 4. Khu Vực II: Cơ Bản (A/B/C/D & Preset)
        co_ban_items = []
        va, ma = _get_val_and_churn(e, "A_do_day_lop", "layerHeight")
        if va:
            co_ban_items.append(_format_cell_item("A", va, ma))
        vb, mb = _get_val_and_churn(e, "B_canh_do", "supportMode")
        if vb:
            co_ban_items.append(_format_cell_item("B", vb, mb))
        vc, mc = _get_val_and_churn(e, "C_do_rong", "infillDensity")
        if vc:
            co_ban_items.append(_format_cell_item("C", vc, mc))
        vd, md = _get_val_and_churn(e, "D_vanh_bam", "brimEnabled")
        if vd:
            co_ban_items.append(_format_cell_item("D", vd, md))

        col_co_ban = "<br>".join(co_ban_items) if co_ban_items else "*Kế thừa baseline*"

        # 5. Khu Vực III: Vách & Vỏ
        vach_items = []
        vw, mw = _get_val_and_churn(e, "wallLoops")
        if vw:
            vach_items.append(f"Tường: `{vw}`")
        vf, mf = _get_val_and_churn(e, "firstLayerHeight")
        if vf:
            vach_items.append(f"Lớp 1: `{vf}`")
        vt, _ = _get_val_and_churn(e, "topShellLayers")
        vbt, _ = _get_val_and_churn(e, "bottomShellLayers")
        if vt and vbt:
            vach_items.append(f"Nóc/Đáy: `{vt}/{vbt}`")
        col_vach = "<br>".join(vach_items) if vach_items else "2 vòng • 0.20mm<br>Nóc 4 / Đáy 3"

        # 6. Khu Vực IV: Support
        sup_items = []
        v_ts, _ = _get_val_and_churn(e, "treeStyle")
        v_ang, _ = _get_val_and_churn(e, "supportAngleThreshold")
        v_z, _ = _get_val_and_churn(e, "supportTopZDistance")
        if v_ts or v_ang or v_z:
            if v_ts:
                sup_items.append(f"Style: `{v_ts}`")
            if v_ang:
                sup_items.append(f"Góc: `{v_ang}`")
            if v_z:
                sup_items.append(f"Top Z: `{v_z}`")
        col_support = "<br>".join(sup_items) if sup_items else "Organic • 45°<br>Top Z: 0.20mm"

        # 7. Khu Vực V: Tốc Độ In
        speed_items = []
        vf_spd, mf_spd = _get_val_and_churn(e, "F_toc_do_day", "printSpeed")
        if vf_spd:
            speed_items.append(_format_cell_item("F", vf_spd, mf_spd))
        v_ow, _ = _get_val_and_churn(e, "outerWallSpeed")
        if v_ow:
            speed_items.append(f"Vách: `{v_ow}`")
        v_inf, _ = _get_val_and_churn(e, "infillSpeed")
        if v_inf:
            speed_items.append(f"Ruột: `{v_inf}`")
        col_speed = "<br>".join(speed_items) if speed_items else "**F:** `60mm/s`<br>Vách: 150 • Ruột: 275"

        # 8. Khu Vực VI: Nhiệt Độ & Quạt
        temp_items = []
        ve_tmp, me_tmp = _get_val_and_churn(e, "E_nhiet_ban_in", "bedTemp")
        if ve_tmp:
            temp_items.append(_format_cell_item("E", ve_tmp, me_tmp))
        v_noz, _ = _get_val_and_churn(e, "nozzleTemp")
        if v_noz:
            temp_items.append(f"Đầu: `{v_noz}`")
        v_fan, _ = _get_val_and_churn(e, "coolingFanSpeed")
        if v_fan:
            temp_items.append(f"Quạt: `{v_fan}`")
        col_temp = "<br>".join(temp_items) if temp_items else "**E:** `60°C`<br>Đầu: 210°C • Quạt: 100%"

        # 9. Khu Vực VII: Đùn Nhựa
        dun_items = []
        v_flow, _ = _get_val_and_churn(e, "flowRateMm3s")
        if v_flow:
            dun_items.append(f"Dòng: `{v_flow}`")
        v_ret, _ = _get_val_and_churn(e, "retractionDistanceMm")
        if v_ret:
            dun_items.append(f"Rút: `{v_ret}`")
        v_zh, _ = _get_val_and_churn(e, "zHopMm")
        if v_zh:
            dun_items.append(f"Z-Hop: `{v_zh}`")
        col_dun = "<br>".join(dun_items) if dun_items else "Dòng: 0.98<br>Rút: 0.8mm • Z-Hop 0.4"

        # 10. Tiếp Nối
        col_next = f"[[PHIEU_{entries[i+1]['phien']}]]" if i < len(entries) - 1 else "— *(Mới nhất)*"

        table_lines.append(
            f"| {col_phien} | {col_user_time} | {col_action_status} | {col_co_ban} | {col_vach} | {col_support} | {col_speed} | {col_temp} | {col_dun} | {col_next} |"
        )

        json_horizontal_rows.append({
            "phien": p_str,
            "nguoi_dung": user_name,
            "thoi_gian": e.get("thoi_gian", "-"),
            "hanh_dong": act,
            "loi": loi_desc,
            "co_ban": col_co_ban.replace("<br>", " | "),
            "vach_vo": col_vach.replace("<br>", " | "),
            "support": col_support.replace("<br>", " | "),
            "toc_do": col_speed.replace("<br>", " | "),
            "nhiet_do": col_temp.replace("<br>", " | "),
            "dun_nhua": col_dun.replace("<br>", " | "),
            "tiep_noi": col_next.replace("<br>", " "),
        })

    table_md = "\n".join(table_lines)
    return session_cols, json_horizontal_rows, table_md


def render_markdown_log(entries: List[Dict[str, Any]]) -> str:
    """
    Renders the complete minimalist nhat_ky_in.md file featuring
    1 SINGLE COMPACT HORIZONTAL TABLE where each row is a session and columns are the 7 areas.
    """
    ma_phien = [e.get("phien", f"{i+1:02d}") for i, e in enumerate(entries)]
    nguoi_dung = entries[0].get("nguoi_dung", "Nguyễn Văn A") if entries else "Nguyễn Văn A"

    session_cols, _, horizontal_table_md = build_parameter_session_matrix(entries)
    ma_phien_formatted = str(ma_phien).replace("'", '"')

    return f"""---
ma_phien: {ma_phien_formatted}
nguoi_dung: "{nguoi_dung}"
the: [printsim/nhat-ky]
---

# 📋 Nhật Ký In Hợp Nhất — Ma Trận Phiên & Phân Vùng Cắt Lớp (Horizontal Layout)

> **Obsidian MOC:** [[000_PRINT_INDEX]]  
> **Tổng số phiên theo dõi:** `{len(entries)}` (`Phiên {session_cols[0]}` ➔ `Phiên {session_cols[-1]}`)  
> **Người thực hiện:** `{nguoi_dung}`  
> **Bố cục hiển thị:** Bảng ngang tối ưu không gian — Mỗi phiên in là 1 hàng, phân đều 7 khu vực cắt lớp theo chiều ngang.

---

## 🖨️ Bảng Tổng Hợp Chi Tiết Các Phiên In (Unified Horizontal Slicer Matrix)

{horizontal_table_md}

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

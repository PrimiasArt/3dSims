"""
Profile Formatter & Parameter Specifications.
Defines parameter mappings, specs, formatting rules, and extraction helpers
for 3D print slicing and hardware parameters.
"""
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


def get_val_and_churn(entry: Dict[str, Any], key: str, alias: Optional[str] = None) -> Tuple[Optional[str], int]:
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


def extract_session_report_parameters(metrics: List[Any]) -> Dict[str, Any]:
    """
    Truy xuất chính xác các thông số cần report từ metrics phiên in:
    1. locked_report_parameters: Ánh xạ chuẩn A_..., B_..., C_..., D_..., E_..., F_... kèm số lần đổi & cảnh báo.
    2. all_parameters: Toàn bộ danh sách 29 thông số từ tất cả các tab.
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

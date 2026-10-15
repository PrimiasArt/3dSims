"""
Minimalist Log Formatter conforming strictly to the LOCKED SCHEMA contract.
Generates:
1. nhat_ky_in.json (Array of session objects)
2. nhat_ky_in.md (Markdown with YAML frontmatter and [[PHIEU_XX]] wikilinks)
"""
from datetime import datetime
from typing import Any, Dict, List, Optional


PARAM_CONFIG = {
    "layerHeight": {"key": "A_do_day_lop", "label": "A (Độ dày lớp)", "unit": "mm"},
    "supportMode": {"key": "B_canh_do", "label": "B (Cành đỡ)", "unit": ""},
    "treeStyle": {"key": "B_canh_do", "label": "B (Cành đỡ)", "unit": ""},
    "infillDensity": {"key": "C_do_rong", "label": "C (Độ rỗng)", "unit": "%"},
    "brimEnabled": {"key": "D_vanh_bam", "label": "D (Vành bám)", "unit": ""},
    "bedTemp": {"key": "E_nhiet_ban_in", "label": "E (Nhiệt bàn in)", "unit": "°C"},
    "printSpeed": {"key": "F_toc_do_day", "label": "F (Tốc độ lớp đáy)", "unit": "mm/s"},
}


def format_param_value(param_name: str, val: Any) -> str:
    """Formats value cleanly according to domain standards (e.g. 0.12mm, Tree, 25%, Bật 5mm)."""
    if param_name == "brimEnabled":
        return "Bật 5mm" if val else "Tắt"
    if param_name in ("supportMode", "treeStyle"):
        if str(val).lower() == "tree":
            return "Tree"
        if str(val).lower() in ("none", "false", "tắt"):
            return "Tắt"
        if str(val).lower() == "normal":
            return "Normal"
        return str(val).capitalize()
    if param_name == "infillDensity":
        return f"{val}%"
    if param_name == "layerHeight":
        return f"{val}mm"
    if param_name in ("bedTemp", "nozzleTemp"):
        return f"{val}°C"
    if param_name == "printSpeed":
        return f"{val}mm/s"
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
        cfg = PARAM_CONFIG.get(p_name)
        if cfg:
            key = cfg["key"]
            formatted_val = format_param_value(p_name, getattr(m, "final_value", None))
            tham_so[key] = {
                "gia_tri": formatted_val,
                "so_lan_doi": getattr(m, "mutation_count", 1),
            }
        else:
            # Fallback for unmapped params
            key = f"X_{p_name}"
            tham_so[key] = {
                "gia_tri": str(getattr(m, "final_value", "")),
                "so_lan_doi": getattr(m, "mutation_count", 1),
            }

    # Sort tham_so alphabetically by key (A_..., B_..., etc.)
    sorted_tham_so = dict(sorted(tham_so.items(), key=lambda item: item[0]))

    entry: Dict[str, Any] = {
        "phien": phien_str,
    }
    if thu_lai_tu_phien:
        entry["thu_lai_tu_phien"] = thu_lai_tu_phien

    entry["nguoi_dung"] = nguoi_dung
    entry["thoi_gian"] = thoi_gian_str
    entry["tham_so"] = sorted_tham_so
    entry["hanh_dong"] = hanh_dong
    entry["loi"] = loi or "Không phát hiện lỗi nghiêm trọng (In hoàn tất)"

    return entry


def render_markdown_log(entries: List[Dict[str, Any]]) -> str:
    """Renders the complete minimalist nhat_ky_in.md file from session entries."""
    ma_phien = [e["phien"] for e in entries]
    nguoi_dung = entries[0]["nguoi_dung"] if entries else "Nguyễn Văn A"

    sections = []
    for i, e in enumerate(entries):
        phien_num = int(e["phien"])
        time_part = e.get("thoi_gian", "")
        if "(" in time_part:
            time_display = time_part.split(" ", 1)[-1]  # e.g. "08:00 (7 phút)" -> "08:00 - 7 phút"
            time_display = time_display.replace(" (", " - ").replace(")", "")
        else:
            time_display = time_part

        user_line = f"- **Người dùng:** {e['nguoi_dung']}"
        if e.get("thu_lai_tu_phien"):
            user_line += f" *(thử lại từ [[PHIEU_{e['thu_lai_tu_phien']}]])*"

        param_lines = []
        for key, p_data in e.get("tham_so", {}).items():
            # Extract label
            label = key
            for orig_key, cfg in PARAM_CONFIG.items():
                if cfg["key"] == key:
                    label = cfg["label"]
                    break

            times = p_data.get("so_lan_doi", 1)
            if times >= 3:
                times_str = f"đổi {times} lần ⚠️"
            elif times == 1:
                times_str = "1 lần"
            else:
                times_str = f"đổi {times} lần"

            param_lines.append(f"  - {label}: `{p_data.get('gia_tri', '')}` ({times_str})")

        progress_line = f"- **Tiến trình:** {e.get('hanh_dong', '')}".replace("->", "➔")
        error_line = f"- **Lỗi:** {e.get('loi', '')}"

        next_phien_str = ""
        if i < len(entries) - 1:
            next_phien_str = f"\n- **Khắc phục tiếp tại:** [[PHIEU_{entries[i+1]['phien']}]]"

        section = f"""## 📌 Phiên {phien_num} ({time_display}) — [[PHIEU_{e['phien']}]]
{user_line}
- **Chỉnh tham số:**
{chr(10).join(param_lines)}
{progress_line}
{error_line}{next_phien_str}"""
        sections.append(section)

    body = "\n\n---\n\n".join(sections)
    ma_phien_formatted = str(ma_phien).replace("'", '"')

    return f"""---
ma_phien: {ma_phien_formatted}
nguoi_dung: "{nguoi_dung}"
the: [printsim/nhat-ky]
---

{body}
"""


APP_CHANGEABLE_PARAMETERS = [
    {
        "id": "layerHeight",
        "category": "Chất lượng cắt lớp (Quality)",
        "label": "Độ dày lớp in",
        "min": 0.08,
        "max": 0.32,
        "default": 0.20,
        "unit": "mm",
        "report_key": "A_do_day_lop",
        "report_label": "A (Độ dày lớp)",
        "is_report_target": True,
    },
    {
        "id": "supportMode",
        "category": "Cấu trúc chống đỡ (Support)",
        "label": "Chế độ cành đỡ",
        "options": ["none", "tree", "normal"],
        "default": "none",
        "unit": "",
        "report_key": "B_canh_do",
        "report_label": "B (Cành đỡ)",
        "is_report_target": True,
    },
    {
        "id": "treeStyle",
        "category": "Cấu trúc chống đỡ (Support)",
        "label": "Kiểu cành cây (Tree Style)",
        "options": ["organic", "slim", "strong", "hybrid"],
        "default": "organic",
        "unit": "",
        "report_key": "B_canh_do",
        "report_label": "B (Cành đỡ)",
        "is_report_target": True,
    },
    {
        "id": "infillDensity",
        "category": "Độ đặc ruột (Infill)",
        "label": "Mật độ rỗng / đặc",
        "min": 0,
        "max": 100,
        "default": 20,
        "unit": "%",
        "report_key": "C_do_rong",
        "report_label": "C (Độ rỗng)",
        "is_report_target": True,
    },
    {
        "id": "brimEnabled",
        "category": "Độ bám bàn in (Adhesion)",
        "label": "Vành bám chống cong vênh (Brim)",
        "options": [True, False],
        "default": False,
        "unit": "",
        "report_key": "D_vanh_bam",
        "report_label": "D (Vành bám)",
        "is_report_target": True,
    },
    {
        "id": "brimWidthMm",
        "category": "Độ bám bàn in (Adhesion)",
        "label": "Độ rộng vành bám",
        "min": 2,
        "max": 20,
        "default": 5,
        "unit": "mm",
        "report_key": "D_vanh_bam",
        "report_label": "D (Vành bám)",
        "is_report_target": True,
    },
    {
        "id": "bedTemp",
        "category": "Nhiệt độ (Thermals)",
        "label": "Nhiệt độ bàn in",
        "min": 40,
        "max": 110,
        "default": 60,
        "unit": "°C",
        "report_key": "E_nhiet_ban_in",
        "report_label": "E (Nhiệt bàn in)",
        "is_report_target": True,
    },
    {
        "id": "printSpeed",
        "category": "Tốc độ in (Dynamics)",
        "label": "Tốc độ lớp đáy / in",
        "min": 30,
        "max": 500,
        "default": 60,
        "unit": "mm/s",
        "report_key": "F_toc_do_day",
        "report_label": "F (Tốc độ lớp đáy)",
        "is_report_target": True,
    },
    {
        "id": "nozzleTemp",
        "category": "Nhiệt độ (Thermals)",
        "label": "Nhiệt độ đầu đùn",
        "min": 190,
        "max": 290,
        "default": 210,
        "unit": "°C",
        "report_key": None,
        "report_label": "Nhiệt độ đầu phun",
        "is_report_target": False,
    },
    {
        "id": "infillType",
        "category": "Độ đặc ruột (Infill)",
        "label": "Hoa văn đan ruột",
        "options": ["gyroid", "grid", "honeycomb", "triangles", "concentric"],
        "default": "gyroid",
        "unit": "",
        "report_key": None,
        "report_label": "Hoa văn ruột",
        "is_report_target": False,
    },
    {
        "id": "wallLoops",
        "category": "Chất lượng cắt lớp (Quality)",
        "label": "Số vòng vách thành",
        "min": 1,
        "max": 6,
        "default": 2,
        "unit": "vòng",
        "report_key": None,
        "report_label": "Vách thành",
        "is_report_target": False,
    },
    {
        "id": "material",
        "category": "Vật liệu (Filament)",
        "label": "Loại nhựa in 3D",
        "options": ["PLA", "PETG", "ABS", "TPU", "PLA-CF"],
        "default": "PLA",
        "unit": "",
        "report_key": None,
        "report_label": "Vật liệu",
        "is_report_target": False,
    },
    {
        "id": "coolingFanSpeed",
        "category": "Nhiệt độ (Thermals)",
        "label": "Tốc độ quạt thổi chi tiết",
        "min": 0,
        "max": 100,
        "default": 100,
        "unit": "%",
        "report_key": None,
        "report_label": "Quạt làm mát",
        "is_report_target": False,
    },
]


def extract_session_report_parameters(metrics: List[Any]) -> Dict[str, Any]:
    """
    Truy xuất chính xác các thông số cần report từ metrics phiên in:
    1. locked_report_parameters: Ánh xạ chuẩn A_..., B_..., C_..., D_..., E_..., F_... kèm số lần đổi & cảnh báo.
    2. all_changed_parameters: Toàn bộ danh sách thay đổi chi tiết.
    """
    locked_report: Dict[str, Any] = {}
    all_changed: Dict[str, Any] = {}

    for m in metrics:
        p_name = getattr(m, "parameter_name", "")
        mut_count = getattr(m, "mutation_count", 1)
        final_val = getattr(m, "final_value", None)
        formatted_val = format_param_value(p_name, final_val)
        cfg = PARAM_CONFIG.get(p_name)

        item = {
            "parameter_name": p_name,
            "gia_tri_goc": final_val,
            "gia_tri_dinh_dang": formatted_val,
            "so_lan_doi": mut_count,
            "canh_bao_phan_van": mut_count >= 3,
            "canh_bao_icon": "⚠️" if mut_count >= 3 else "",
            "chuoi_hien_thi": f"{formatted_val} (đổi {mut_count} lần ⚠️)" if mut_count >= 3 else (f"{formatted_val} (1 lần)" if mut_count == 1 else f"{formatted_val} (đổi {mut_count} lần)"),
            "lich_su": getattr(m, "change_history", []),
        }

        all_changed[p_name] = item

        if cfg:
            key = cfg["key"]
            locked_report[key] = {
                "key": key,
                "nhan": cfg["label"],
                "gia_tri": formatted_val,
                "so_lan_doi": mut_count,
                "canh_bao": mut_count >= 3,
                "chuoi_hien_thi": f"`{formatted_val}` (đổi {mut_count} lần ⚠️)" if mut_count >= 3 else (f"`{formatted_val}` (1 lần)" if mut_count == 1 else f"`{formatted_val}` (đổi {mut_count} lần)"),
            }

    # Sắp xếp theo thứ tự A, B, C, D, E, F
    sorted_locked = dict(sorted(locked_report.items(), key=lambda item: item[0]))

    return {
        "locked_report_parameters": sorted_locked,
        "all_changed_parameters": all_changed,
        "total_changed_parameters": len(all_changed),
        "high_churn_count": sum(1 for v in all_changed.values() if v["canh_bao_phan_van"]),
    }


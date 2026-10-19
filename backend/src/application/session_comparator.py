"""
3D PrintSim Pro - Session Comparison & Benchmark Engine
Compares two simulation/print sessions, evaluates parameter deltas,
analyzes physical trade-offs, and generates executive Markdown reports for Obsidian.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _safe_int(val: Any, default: int = 0) -> int:
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def compare_sessions(base: Dict[str, Any], target: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compares base session with target session across all dimensions.
    Returns structured comparison analysis and generated Obsidian Markdown.
    """
    b_id = str(base.get("sessionId", "base"))
    t_id = str(target.get("sessionId", "target"))

    b_meta = base.get("metadata", {})
    t_meta = target.get("metadata", {})
    b_slicer = base.get("slicer", {})
    t_slicer = target.get("slicer", {})
    b_hw = base.get("hardware", {})
    t_hw = target.get("hardware", {})

    # 1. Key Metrics Delta
    b_score = _safe_int(b_meta.get("printabilityScore", 80))
    t_score = _safe_int(t_meta.get("printabilityScore", 80))
    score_delta = t_score - b_score

    b_dur = _safe_int(base.get("durationMinutes", 0))
    t_dur = _safe_int(target.get("durationMinutes", 0))
    dur_delta = t_dur - b_dur

    b_fil = _safe_float(b_meta.get("filamentGrams", 0))
    t_fil = _safe_float(t_meta.get("filamentGrams", 0))
    fil_delta = round(t_fil - b_fil, 1)

    # 2. Extract Specific Parameters for Comparison Table
    diff_items = []

    # Category 1: Slicer & Structure
    b_lh = _safe_float(b_slicer.get("layerHeightMm", 0.20))
    t_lh = _safe_float(t_slicer.get("layerHeightMm", 0.20))
    lh_delta = round(t_lh - b_lh, 2)
    lh_impact = "Giữ nguyên"
    if lh_delta < 0:
        lh_impact = f"Tăng độ mịn bề mặt (+{abs(round(lh_delta/b_lh*100))}% mịn), nhưng tốn thêm thời gian in."
    elif lh_delta > 0:
        lh_impact = f"Giảm thời gian in, bề mặt có vân lớp rõ hơn."
    diff_items.append({
        "category": "Cấu trúc lớp",
        "name": "Độ cao lớp (Layer Height)",
        "base_val": f"{b_lh:.2f} mm",
        "target_val": f"{t_lh:.2f} mm",
        "delta_str": f"{'+' if lh_delta > 0 else ''}{lh_delta:.2f} mm" if lh_delta != 0 else "—",
        "status": "IMPROVED" if lh_delta < 0 else ("CHANGED" if lh_delta > 0 else "UNCHANGED"),
        "impact": lh_impact,
    })

    b_inf = _safe_int(b_slicer.get("infillPercent", 20))
    t_inf = _safe_int(t_slicer.get("infillPercent", 20))
    inf_delta = t_inf - b_inf
    inf_impact = "Giữ nguyên"
    if inf_delta > 0:
        inf_impact = f"Gia tăng độ cứng cáp chịu lực cơ học (+{inf_delta}% mật độ ruột)."
    elif inf_delta < 0:
        inf_impact = f"Tiết kiệm nhựa và rút ngắn thời gian in."
    diff_items.append({
        "category": "Cấu trúc lớp",
        "name": "Mật độ ruột (Infill)",
        "base_val": f"{b_inf}% ({b_slicer.get('infillType', 'Gyroid')})",
        "target_val": f"{t_inf}% ({t_slicer.get('infillType', 'Gyroid')})",
        "delta_str": f"{'+' if inf_delta > 0 else ''}{inf_delta}%" if inf_delta != 0 else "—",
        "status": "CHANGED" if inf_delta != 0 else "UNCHANGED",
        "impact": inf_impact,
    })

    b_wl = _safe_int(b_slicer.get("wallLoops", 2))
    t_wl = _safe_int(t_slicer.get("wallLoops", 2))
    wl_delta = t_wl - b_wl
    diff_items.append({
        "category": "Cấu trúc lớp",
        "name": "Số vòng vỏ ngoài (Wall Loops)",
        "base_val": f"{b_wl} vòng",
        "target_val": f"{t_wl} vòng",
        "delta_str": f"{'+' if wl_delta > 0 else ''}{wl_delta} vòng" if wl_delta != 0 else "—",
        "status": "IMPROVED" if wl_delta > 0 else ("CHANGED" if wl_delta < 0 else "UNCHANGED"),
        "impact": "Tăng cường độ bền thành vỏ và độ chống thấm nước." if wl_delta > 0 else ("Giảm độ dày vỏ." if wl_delta < 0 else "Giữ nguyên"),
    })

    b_sup = str(b_slicer.get("supportType", "None"))
    t_sup = str(t_slicer.get("supportType", "None"))
    diff_items.append({
        "category": "Cấu trúc lớp",
        "name": "Giá đỡ (Support)",
        "base_val": f"{b_sup} ({b_slicer.get('supportOverhangAngle', 45)}°)",
        "target_val": f"{t_sup} ({t_slicer.get('supportOverhangAngle', 45)}°)",
        "delta_str": "Khác kiểu" if b_sup != t_sup else "—",
        "status": "CHANGED" if b_sup != t_sup else "UNCHANGED",
        "impact": "Tối ưu hóa khả năng đỡ chi tiết nghiêng và độ dễ tháo." if b_sup != t_sup else "Giữ nguyên",
    })

    # Category 2: Speed
    b_spd = _safe_float(b_hw.get("speedF", {}).get("defaultMmS", 60))
    t_spd = _safe_float(t_hw.get("speedF", {}).get("defaultMmS", 60))
    spd_delta = round(t_spd - b_spd, 0)
    spd_impact = "Giữ nguyên"
    if spd_delta > 0:
        spd_impact = f"Tốc độ in tăng nhanh (+{int(spd_delta)} mm/s), cần quạt tản nhiệt đủ mạnh."
    elif spd_delta < 0:
        spd_impact = f"Giảm tốc độ in để tăng độ bám dính và giảm rung động (ringing)."
    diff_items.append({
        "category": "Tốc độ",
        "name": "Tốc độ in cơ sở (Base Speed)",
        "base_val": f"{int(b_spd)} mm/s",
        "target_val": f"{int(t_spd)} mm/s",
        "delta_str": f"{'+' if spd_delta > 0 else ''}{int(spd_delta)} mm/s" if spd_delta != 0 else "—",
        "status": "CHANGED" if spd_delta != 0 else "UNCHANGED",
        "impact": spd_impact,
    })

    # Category 3: Thermal & Extrusion
    b_bed = _safe_float(b_hw.get("tempsE", {}).get("bedTempC", 60))
    t_bed = _safe_float(t_hw.get("tempsE", {}).get("bedTempC", 60))
    bed_delta = round(t_bed - b_bed, 0)
    bed_impact = "Giữ nguyên"
    if bed_delta > 0:
        bed_impact = f"Tăng nhiệt bàn in (+{int(bed_delta)}°C) giúp nhựa bám chắc hơn, triệt tiêu cong vênh."
    elif bed_delta < 0:
        bed_impact = f"Hạ nhiệt bàn in (-{abs(int(bed_delta))}°C) để chống hiện tượng cổ đùn tích nhiệt."
    diff_items.append({
        "category": "Nhiệt độ",
        "name": "Nhiệt độ bàn in (Heatbed)",
        "base_val": f"{int(b_bed)}°C",
        "target_val": f"{int(t_bed)}°C",
        "delta_str": f"{'+' if bed_delta > 0 else ''}{int(bed_delta)}°C" if bed_delta != 0 else "—",
        "status": "IMPROVED" if bed_delta > 0 and b_bed < 60 else ("CHANGED" if bed_delta != 0 else "UNCHANGED"),
        "impact": bed_impact,
    })

    b_noz = _safe_float(b_hw.get("tempsE", {}).get("nozzleTempC", 210))
    t_noz = _safe_float(t_hw.get("tempsE", {}).get("nozzleTempC", 210))
    noz_delta = round(t_noz - b_noz, 0)
    diff_items.append({
        "category": "Nhiệt độ",
        "name": "Nhiệt độ đầu phun (Hotend)",
        "base_val": f"{int(b_noz)}°C",
        "target_val": f"{int(t_noz)}°C",
        "delta_str": f"{'+' if noz_delta > 0 else ''}{int(noz_delta)}°C" if noz_delta != 0 else "—",
        "status": "CHANGED" if noz_delta != 0 else "UNCHANGED",
        "impact": "Tăng độ dẻo nóng chảy của sợi nhựa khi in tốc độ cao." if noz_delta > 0 else ("Giảm nhiệt độ nóng chảy." if noz_delta < 0 else "Giữ nguyên"),
    })

    b_flow = _safe_float(b_hw.get("extrusion", {}).get("flowRatio", 0.98))
    t_flow = _safe_float(t_hw.get("extrusion", {}).get("flowRatio", 0.98))
    flow_delta = round(t_flow - b_flow, 2)
    diff_items.append({
        "category": "Cơ chế đùn",
        "name": "Hệ số đùn (Flow Ratio)",
        "base_val": f"{b_flow:.2f}",
        "target_val": f"{t_flow:.2f}",
        "delta_str": f"{'+' if flow_delta > 0 else ''}{flow_delta:.2f}" if flow_delta != 0 else "—",
        "status": "CHANGED" if flow_delta != 0 else "UNCHANGED",
        "impact": "Hiệu chỉnh độ đầy đặn của lớp in, tránh đùn thiếu hoặc thừa." if flow_delta != 0 else "Giữ nguyên",
    })

    # Verdict
    if score_delta >= 10:
        verdict_badge = "🟢 CẢI THIỆN ĐỘT PHÁ (SIGNIFICANT IMPROVEMENT)"
        verdict_summary = f"Phiên #{t_id} nâng cấp vượt bậc so với phiên gốc #{b_id} (+{score_delta} điểm QC). Toàn bộ tham số được tối ưu hóa chuẩn xác."
    elif score_delta >= 0:
        verdict_badge = "🔵 TỐI ƯU CÂN BẰNG (OPTIMIZED BALANCE)"
        verdict_summary = f"Phiên #{t_id} duy trì độ tin cậy tương đương hoặc tăng nhẹ so với #{b_id} (+{score_delta} điểm QC), cân đối giữa thời gian và chất lượng."
    else:
        verdict_badge = "🟡 CÓ ĐÁNH ĐỔI CHẤT LƯỢNG (TRADE-OFF)"
        verdict_summary = f"Phiên #{t_id} đánh đổi chất lượng (-{abs(score_delta)} điểm QC) để đạt được mục tiêu khác (như tốc độ in nhanh hơn)."

    # 3. Generate Markdown Table Rows
    table_rows = []
    for item in diff_items:
        icon = "✅" if item["status"] == "IMPROVED" else ("⚡" if item["status"] == "CHANGED" else "➖")
        table_rows.append(
            f"| {icon} **{item['name']}** | `{item['base_val']}` | `{item['target_val']}` | **{item['delta_str']}** | {item['impact']} |"
        )
    table_str = "\n".join(table_rows)

    now_iso = datetime.now(timezone.utc).isoformat()

    markdown_content = f"""---
schema_version: "v2026.1"
doc_type: "session_comparison"
comparison_id: "COMPARE_{b_id}_VS_{t_id}"
base_session_id: "{b_id}"
target_session_id: "{t_id}"
score_delta: {score_delta}
time_delta_minutes: {dur_delta}
filament_delta_grams: {fil_delta}
created_at: "{now_iso}"
tags:
  - printsim/comparison
  - compare/{b_id}-vs-{t_id}
---

# ⚖️ BÁO CÁO SO SÁNH ĐỐI CHIẾU PHIÊN IN: #{b_id} VS #{t_id}

> **Điều hướng:** [[000_PRINT_INDEX|🧭 MOC Tổng]] | [[Profile_In3D_{b_id}|Hồ Sơ Gốc #{b_id}]] | [[Profile_In3D_{t_id}|Hồ Sơ Mục Tiêu #{t_id}]]  
> **Đánh giá tổng quan:** {verdict_badge}  
> **Kết luận nhanh:** {verdict_summary}

---

## 📊 1. Bảng Điểm Hiệu Năng Đối Chiếu (Executive Scorecard)

| Chỉ số trọng tâm | Phiên gốc (#{b_id}) | Phiên mục tiêu (#{t_id}) | Chênh lệch (Delta) | Chi tiết đánh giá |
| :--- | :---: | :---: | :---: | :--- |
| **Điểm chất lượng QC** | `{b_score}/100` | `{t_score}/100` | **{'+' if score_delta > 0 else ''}{score_delta} điểm** | {'🟢 Tăng độ tin cậy' if score_delta > 0 else ('🔴 Giảm điểm' if score_delta < 0 else '➖ Tương đương')} |
| **Thời gian in ước tính** | `{b_dur} phút` | `{t_dur} phút` | **{'+' if dur_delta > 0 else ''}{dur_delta} phút** | {'⚡ Nhanh hơn' if dur_delta < 0 else ('⏳ Lâu hơn' if dur_delta > 0 else '➖ Bằng nhau')} |
| **Khối lượng nhựa tiêu hao** | `{b_fil} g` | `{t_fil} g` | **{'+' if fil_delta > 0 else ''}{fil_delta} g** | {'Tiết kiệm nhựa' if fil_delta < 0 else ('Tốn thêm nhựa' if fil_delta > 0 else '➖ Như nhau')} |
| **Vật liệu in sử dụng** | `{b_meta.get('material', 'PLA')}` | `{t_meta.get('material', 'PLA')}` | {'Đổi nhựa' if b_meta.get('material') != t_meta.get('material') else 'Giữ nguyên'} | {t_meta.get('material', 'PLA')} |

---

## 📑 2. Bảng Ma Trận So Sánh Từng Tham Số Kỹ Thuật (Parameter Delta Matrix)

| Tham số cấu hình | Phiên #{b_id} | Phiên #{t_id} | Chênh lệch | Phân tích tác động thực tế |
| :--- | :---: | :---: | :---: | :--- |
{table_str}

---

## ⚖️ 3. Phân Tích Đánh Đổi Kỹ Thuật & Khuyến Nghị (Engineering Insights)
> [!tip] 💡 Nhận Định Của Chuyên Gia Vận Hành:
> - **Chất lượng bề mặt:** {diff_items[0]['impact']}
> - **Khả năng chịu lực:** {diff_items[1]['impact']}
> - **Độ ổn định nhiệt:** {diff_items[4]['impact']}
> - **Khuyến nghị chung:** {verdict_summary}

---

## 🔍 Truy Vấn Tự Động (Obsidian Dataview)
```dataview
TABLE score_delta as "Chênh lệch điểm", time_delta_minutes as "Chênh lệch phút", filament_delta_grams as "Chênh lệch gram"
FROM "01_BaoCao_KiemDinh" OR #printsim/comparison
WHERE comparison_id = "COMPARE_{b_id}_VS_{t_id}"
```

---
*Tự động khởi tạo bởi 3D PrintSim Pro Benchmark & Comparison Engine.*
"""

    return {
        "status": "success",
        "comparison_id": f"COMPARE_{b_id}_VS_{t_id}",
        "base_session_id": b_id,
        "target_session_id": t_id,
        "score_delta": score_delta,
        "time_delta_minutes": dur_delta,
        "filament_delta_grams": fil_delta,
        "verdict_badge": verdict_badge,
        "verdict_summary": verdict_summary,
        "parameter_diffs": diff_items,
        "markdown_filename": f"Comparison_{b_id}_vs_{t_id}.md",
        "markdown_path": f"01_BaoCao_KiemDinh/Comparison_{b_id}_vs_{t_id}.md",
        "markdown": markdown_content,
    }

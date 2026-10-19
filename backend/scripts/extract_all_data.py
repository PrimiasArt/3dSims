import os
import sys
import json
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
JSON_LOGS_DIR = ROOT_DIR / "JsonLogs"
OBSIDIAN_DIR = ROOT_DIR / "ObsidianVault" / "02_NhatKy_In"

def extract_all():
    print("=" * 80)
    print("🚀 BẮT ĐẦU TRUY XUẤT TOÀN BỘ DATA: NHẬT KÝ MÔ PHỎNG, OBSIDIAN VAULT & JSON LOGS")
    print("=" * 80)

    # 1. TRÍCH XUẤT TỪ JSON LOGS
    print("\n📦 [1/4] DỮ LIỆU JSON LOGS (JsonLogs/nhat_ky_in.json):")
    json_file = JSON_LOGS_DIR / "nhat_ky_in.json"
    if not json_file.exists():
        print(f"❌ Không tìm thấy file: {json_file}")
        return

    with open(json_file, "r", encoding="utf-8") as f:
        json_data = json.load(f)

    if isinstance(json_data, dict):
        sessions = json_data.get("bang_tong_hop") or json_data.get("sessions") or []
        schema_ver = json_data.get("schema_version", "N/A")
        total_p = json_data.get("tong_so_phien", len(sessions))
        print(f"  -> Cấu trúc JSON: Dict (Schema: {schema_ver}, Tổng phiên: {total_p})")
    elif isinstance(json_data, list):
        sessions = json_data
        print(f"  -> Cấu trúc JSON: Array ({len(sessions)} phần tử)")
    else:
        sessions = []

    print(f"  -> Tổng số phiên in ghi nhận: {len(sessions)} phiên")
    for idx, item in enumerate(sessions, start=1):
        sid = str(item.get("sessionId") or item.get("phien") or idx)
        time_stamp = item.get("startedAt") or item.get("timestamp") or item.get("ngay") or "N/A"
        metadata = item.get("metadata", {})
        filament = metadata.get("material") or item.get("filament") or item.get("vat_lieu") or "PLA"
        model_name = metadata.get("modelName") or item.get("modelName") or "Chưa rõ"
        status = item.get("status") or item.get("trang_thai") or "COMPLETED"
        slicer = item.get("slicer", {})
        hw = item.get("hardware", {})
        temps = hw.get("tempsE", {}) if isinstance(hw.get("tempsE"), dict) else {}
        speed = hw.get("speedF", {}) if isinstance(hw.get("speedF"), dict) else {}
        extrusion = hw.get("extrusion", {}) if isinstance(hw.get("extrusion"), dict) else {}
        locked = item.get("lockedContract", {})

        layer_h = locked.get("A_do_day_lop") or slicer.get("layerHeightMm") or slicer.get("layerHeight") or "N/A"
        infill = locked.get("B_mat_do_infill") or slicer.get("infillPercent") or slicer.get("infillDensity") or "N/A"
        spd = locked.get("C_toc_do_in") or speed.get("defaultMmS") or slicer.get("printSpeed") or "N/A"
        flow = locked.get("D_luu_luong_nhua") or extrusion.get("flowRatio") or slicer.get("flowRatio") or "N/A"
        retract = locked.get("E_khoang_rut_nhua") or extrusion.get("retractionMm") or slicer.get("retractionDist") or "N/A"
        ext_spd = locked.get("F_toc_do_day") or slicer.get("extrusionSpeed") or "N/A"

        nozzle_t = temps.get("nozzleTempC") or hw.get("nozzleTemp") or item.get("nhiet_do_dau_phun") or 210
        bed_t = temps.get("bedTempC") or hw.get("bedTemp") or item.get("nhiet_do_ban_nhiet") or 60
        bed_type = hw.get("bedType") or item.get("tam_lot") or "PEI Textured"

        print(f"\n  --- 🏷️ PHIÊN #{sid.zfill(2)} ({time_stamp}) | Model: {model_name} | Trạng thái: {status} ---")
        print(f"      • Vật liệu: {filament} | Tấm lót: {bed_type}")
        print(f"      • Nhiệt đầu phun: {nozzle_t}°C | Nhiệt bàn: {bed_t}°C")
        print(f"      • 6 Tham số Locked Contract:")
        print(f"        [A] Độ dày lớp (Layer Height):       {layer_h} mm")
        print(f"        [B] Mật độ infill (Infill Density):  {infill} %")
        print(f"        [C] Tốc độ in (Print Speed):         {spd} mm/s")
        print(f"        [D] Lưu lượng đùn (Flow Ratio):      {flow}")
        print(f"        [E] Khoảng rút nhựa (Retraction):    {retract} mm")
        print(f"        [F] Tốc độ đẩy (Extrusion Speed):    {ext_spd} mm/s")
        
        telemetry = item.get("telemetry", {})
        if telemetry:
            print(f"      • Telemetry Telemetry: Churn Count={telemetry.get('churnCount', 0)}, Session Time={telemetry.get('sessionDurationSec', 0)}s, Warning Count={telemetry.get('warningCount', 0)}")

    # 2. DANH MỤC CATALOG 30 THAM SỐ
    print("\n" + "=" * 80)
    print("📋 [2/4] DANH MỤC TOÀN BỘ THAM SỐ HỆ THỐNG (PARAMETER CATALOG):")
    try:
        from backend.src.infrastructure.minimalist_formatter import APP_CHANGEABLE_PARAMETERS
        print(f"  -> Tổng số tham số trong Catalog: {len(APP_CHANGEABLE_PARAMETERS)}")
        print(f"  {'STT':<4} | {'MÃ THAM SỐ':<24} | {'TÊN HIỂN THỊ TIẾNG VIỆT':<34} | {'MẶC ĐỊNH':<12} | {'REPORT TARGET'}")
        print("  " + "-" * 95)
        for idx, p in enumerate(APP_CHANGEABLE_PARAMETERS, start=1):
            target_str = f"🔒 [{p.get('report_key')}]" if p.get("is_report_target") else "—"
            def_str = f"{p.get('default')} {p.get('unit', '')}".strip()
            print(f"  {idx:<4} | {p['id']:<24} | {p['label']:<34} | {def_str:<12} | {target_str}")
    except Exception as e:
        print(f"  ⚠️ Không load được catalog: {e}")

    # 3. TRÍCH XUẤT OBSIDIAN MASTER SPREADSHEET
    print("\n" + "=" * 80)
    print("📑 [3/4] DỮ LIỆU OBSIDIAN MASTER SPREADSHEET (ObsidianVault/02_NhatKy_In/nhat_ky_in.md):")
    master_md = OBSIDIAN_DIR / "nhat_ky_in.md"
    if master_md.exists():
        with open(master_md, "r", encoding="utf-8") as f:
            md_content = f.read()
        print(f"  -> Kích thước file: {len(md_content.encode('utf-8'))} bytes, {len(md_content.splitlines())} dòng")
        
        # Check rows in table
        phieu_cells = [l.strip() for l in md_content.splitlines() if "PHIEU_" in l and ("[[" in l or "internal-link" in l or "href=" in l or ".md" in l)]
        total_rows = len(phieu_cells)
        print(f"  -> Bảng Master 17 cột (Chuẩn Obsidian Markdown thuần): {total_rows} phiên in hiển thị trong bảng")
        for pc in phieu_cells:
            # show short snippet
            print(f"     • {pc[:110]}...")
        print(f"  -> Các khối KPI Thẻ: [TỔNG SỐ PHIÊN IN], [HOÀN TẤT THÀNH CÔNG], [SỐ CA LỖI WARPING], [TỶ LỆ THÀNH CÔNG]")
        print(f"  -> Nhóm 17 cột: [THÔNG TIN PHIÊN] | [VẬN HÀNH & THỜI GIAN] | [KẾT QUẢ & HIỆN TƯỢNG] | [CẤU TRÚC LỚP & KHỐI] | [THÔNG SỐ MÁY & ĐÙN NHỰA] | [NỐI TIẾP]")
    else:
        print(f"  ❌ Không tìm thấy: {master_md}")

    # 4. DANH SÁCH PHIẾU IN OBSIDIAN INDIVIDUAL TICKETS
    print("\n" + "=" * 80)
    print("🗂️ [4/4] DANH SÁCH PHIẾU IN OBSIDIAN (PHIEU_*.md):")
    phieu_files = sorted(OBSIDIAN_DIR.glob("PHIEU_*.md"))
    print(f"  -> Tìm thấy {len(phieu_files)} phiếu in chi tiết:")
    for pf in phieu_files:
        size = pf.stat().st_size
        with open(pf, "r", encoding="utf-8") as f:
            first_few = [f.readline().strip() for _ in range(5)]
        print(f"    📄 {pf.name:<18} ({size} bytes) | Dòng đầu: {' '.join(first_few[:2])}")

    index_file = OBSIDIAN_DIR / "000_PRINT_INDEX.md"
    if index_file.exists():
        print(f"  -> 🧭 Chỉ mục MOC: {index_file.name} ({index_file.stat().st_size} bytes) [OK]")

    print("\n" + "=" * 80)
    print("✅ HOÀN TẤT TRÍCH XUẤT TOÀN BỘ DỮ LIỆU THÀNH CÔNG 100%!")
    print("=" * 80)

if __name__ == "__main__":
    extract_all()

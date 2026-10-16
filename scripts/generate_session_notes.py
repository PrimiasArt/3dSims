import json
from pathlib import Path

def main():
    root = Path(__file__).resolve().parent.parent
    json_path = root / "JsonLogs" / "nhat_ky_in.json"
    vault_dir = root / "ObsidianVault" / "02_NhatKy_In"

    if not json_path.exists():
        print(f"Error: {json_path} not found")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    sessions = data.get("sessions", [])

    for s in sessions:
        s_id = s.get("sessionId", "01")
        op = s.get("operator", "Nguyễn Văn A")
        started = s.get("startedAt", "2026-10-15 08:47")
        dur = s.get("durationMinutes", 7)
        status = s.get("status", "COMPLETED")
        parent = s.get("parentSessionId")
        failure = s.get("failureDetail")

        slicer = s.get("slicer", {})
        lh = slicer.get("layerHeightMm", 0.2)
        inf = slicer.get("infillPercent", 20)
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

        content = f"""---
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
| **Mật độ ruột (Infill)** | `{inf}%` | Cấu trúc rỗng bên trong |
| **Số vòng thành vách (Wall Loops)** | `{wl} vòng` | Độ dày vỏ ngoài |
| **Lớp Nóc / Đáy (Top/Bottom)** | `{tb.get('top', 4)} / {tb.get('bottom', 3)}` | Số lớp kín mặt trên & mặt đáy |
| **Giá đỡ & Góc (Support)** | `{sup} ({ang}°)` | Kiểu giá đỡ và ngưỡng góc dốc |

---

## 🎛️ Thông Số Phần Cứng & Đùn Nhựa (Hardware & Telemetry)
| Thành phần | Thiết lập | Chi tiết |
| :--- | :--- | :--- |
| **Tốc độ in mặc định** | `{spd_def} mm/s` | Tốc độ đẩy đầu phun cơ sở |
| **Tốc độ Vách • Ruột** | `{spd_wall} mm/s • {spd_inf} mm/s` | Vách ngoài và ruột khối |
| **Nhiệt độ bàn in** | `{bed_t}°C` | Độ bám dính đáy chống warping |
| **Nhiệt độ đầu in & Quạt gió** | `{noz_t}°C • {fan}%` | Nhiệt độ nóng chảy & làm nguội |
| **Hệ số đùn • Rút • Z-Hop** | `Dòng {flow:.2f} \| Rút {ret}mm \| Hop {zh}mm` | Kiểm soát đùn và chống xước mặt |

---
*Tự động đồng bộ bởi 3D PrintSim Telemetry Engine.*
"""
        note_file = vault_dir / f"PHIEU_{s_id}.md"
        with open(note_file, "w", encoding="utf-8") as nf:
            nf.write(content)
        print(f"Created: {note_file.name}")

if __name__ == "__main__":
    main()

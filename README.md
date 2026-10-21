# 🖨️ 3D PrintSim Pro — Hệ Thống Giả Lập, Kiểm Lỗi In 3D & Trợ Lý Cắt Lớp AI

Hệ thống Full-Stack chuyên dụng mô phỏng và kiểm soát chất lượng in 3D FDM/CoreXY theo thời gian thực (Real-time Slicing & Printing Simulator). Ứng dụng tích hợp công nghệ WebGL Three.js không gian 3D, Backend FastAPI Clean Architecture, công cụ đóng gói dự án 3MF & định dạng `.gcode.3mf` nạp thẳng thẻ nhớ SD máy in, trợ lý AI chuẩn đoán khuyết tật và đồng bộ đám mây Supabase.

---

## 🌟 Tính Năng Trọng Tâm

### 1. Không Gian Mô Phỏng 3D Trực Quan (Three.js WebGL)
- Bàn in gia nhiệt Textured PEI (chuẩn 256x256mm Bambu Lab / Voron) với lưới toạ độ laser và vạch gạt kim.
- Đầu in CoreXY ảo (Virtual Toolhead) di chuyển thực tế theo quỹ đạo đùn nhựa (Perimeter, Infill, Support, Travel).
- Đèn LED trạng thái đổi màu theo vật liệu và quạt tản nhiệt xoay động khi in.

### 2. Cơ Chế Cắt Lớp & Tua Nhanh Thời Gian (Time-lapse Scrubbing)
- Cắt lớp động theo mặt phẳng thực (Clipping Planes) — mô hình "mọc lên" chân thực theo từng layer.
- Thanh trượt Layer Scrubber: tua từ lớp $0 \rightarrow N$ tức thì.
- Các mốc tốc độ tua: `1x`, `10x`, `50x`, `200x`, `1000x`, và chế độ **"Thành Phẩm"** (Instant Finish).
- Đo lường vi sai thời gian thực: thời gian in trôi qua, khối lượng nhựa tiêu thụ, cao độ trục Z (mm).

### 3. Xuất File Đa Định Dạng — Hỗ Trợ Độc Quyền Thẻ Nhớ SD (`.gcode.3mf`)
- **Gói Dự Án Chuẩn (`.3mf`)**: Đóng gói mô hình 3D, cấu hình lát cắt và thumbnail màn hình LCD tương thích 100% với **Bambu Studio** và **OrcaSlicer**.
- **Thẻ Nhớ SD Máy In (`.gcode.3mf`)**: Tự động sinh luồng mã lệnh G-code FDM hoàn chỉnh (`Metadata/plate_1.gcode`) và đăng ký MIME Type `text/x.gcode`. Người dùng chỉ cần chép vào thẻ MicroSD cắm trực tiếp vào máy in (Bambu Lab X1C / P1S / A1 / A1 Mini, Voron, Klipper) là in được ngay mà không cần mở lại slicer.
- **Lưới Hình Học Thô (`.stl`)**: Xuất mesh STL chuẩn hóa toạ độ.

### 4. Trợ Lý AI Chuẩn Đoán Khuyết Tật & Tự Động Tối Ưu Profile
- Quét pháp tuyến bề mặt (Surface Normals) phát hiện rủi ro sập góc dốc Overhang ($> 45^\circ - 50^\circ$) và cong vênh Warping.
- Tích hợp mô hình AI (Google Gemini 2.5) tự động đọc telemetries và đề xuất bộ thông số tối ưu (Auto-tune Profile).
- Cấp Chứng Nhận Kiểm Chuẩn Chất Lượng (QC Certificate) với mã chứng thực SHA-256 bảo mật.

### 5. Backend FastAPI Clean Architecture & Telemetry Engine
- **Telemetry Streaming & WebSocket Rooms**: Tiếp nhận và stream dữ liệu cảm biến (nhiệt độ đầu đùn, bàn in, độ rung rung cảm, tốc độ quạt) 2 chiều thời gian thực.
- **Fleet Management**: Quản lý ma trận phân đội máy in (Bambu Lab X1C, P1S, A1 Mini, Voron 2.4, Creality K1C, Prusa MK4).
- **Hệ Thống Phân Tích Analytics**: Báo cáo tổng lượng nhựa tiêu thụ, thời lượng in trung bình, tỷ lệ thành công và phân bổ vật liệu.
- **Đồng Bộ Đám Mây Supabase Hub**: Đồng bộ dữ liệu nhật ký in và profiles lên đám mây với cơ chế tự động thử lại khi mất mạng.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu cầu hệ thống
- **Node.js**: v18.0 trở lên
- **Python**: 3.10 trở lên

### 2. Cài đặt & chạy Frontend (React + Vite)
```bash
# 1. Cài đặt thư viện dependencies
npm install

# 2. Khởi chạy máy chủ phát triển Frontend
npm run dev
```
> Giao diện web sẽ sẵn sàng tại: **`http://localhost:3001`** (hoặc port được cấp trên terminal).

### 3. Cài đặt & chạy Backend (FastAPI Python)
```bash
# 1. Tạo môi trường ảo (khuyên dùng)
python -m venv .venv
# Trên Windows:
.venv\Scripts\activate
# Trên Linux/macOS:
source .venv/bin/activate

# 2. Cài đặt các gói phụ thuộc
pip install -r requirements.txt

# 3. Cấu hình biến môi trường (tùy chọn)
cp .env.example .env

# 4. Khởi chạy máy chủ Backend
python -m backend.main
```
> API Server sẽ chạy tại: **`http://127.0.0.1:8000`**  
> Tài liệu Swagger UI: **`http://127.0.0.1:8000/docs`**

---

## 🔗 Hướng Dẫn Nhúng Vào 3D Hub (`3D Hub`)

Ứng dụng được thiết kế sẵn sàng để nhúng vào bất kỳ trang web nào (đặc biệt là module **AI Studio 2D > 3D** của `3D Hub`) qua giao thức `postMessage` bảo mật 2 chiều.

### 1. Nhúng bằng thẻ `<iframe>`
```tsx
<iframe
  id="print-simulator-frame"
  src="http://localhost:3001?embed=true"
  className="w-full h-[700px] rounded-3xl border border-white/20 shadow-2xl"
  allow="accelerometer; autoplay; encrypted-media; gyroscope"
/>
```

### 2. Giao tiếp 2 chiều (Bi-Directional postMessage API)

#### Gửi từ 3D Hub sang Bộ Giả Lập:
```typescript
const iframe = document.getElementById('print-simulator-frame') as HTMLIFrameElement;

// 1. Nạp mô hình mẫu hoặc file vừa sinh từ 2D > 3D:
iframe.contentWindow?.postMessage({
  source: '3DHUB',
  type: 'LOAD_MODEL',
  data: { sampleId: 'sample-benchy' } // hoặc { modelUrl: '...', modelName: 'Mô hình vừa sinh' }
}, '*');

// 2. Đồng bộ Profile in đã tính toán:
iframe.contentWindow?.postMessage({
  source: '3DHUB',
  type: 'SET_PROFILE',
  data: {
    profile: {
      layerHeight: 0.16,
      infillType: 'gyroid',
      material: 'PETG',
      supportMode: 'tree'
    }
  }
}, '*');

// 3. Kích hoạt lệnh mô phỏng in:
iframe.contentWindow?.postMessage({
  source: '3DHUB',
  type: 'START_SIMULATION',
}, '*');
```

#### Lắng nghe kết quả từ Bộ Giả Lập trả về 3D Hub:
```typescript
window.addEventListener('message', (event) => {
  if (event.data?.source !== '3D_PRINT_SIMULATOR') return;

  const { type, data } = event.data;

  if (type === 'SIMULATOR_READY') {
    console.log('Bộ giả lập in 3D đã sẵn sàng!');
  }

  if (type === 'SIMULATOR_TELEMETRY') {
    // Nhận tiến trình thời gian thực: progress (0-1), currentLayer, totalLayers, elapsedTimeSec
    console.log(`Tiến độ in: ${(data.progress * 100).toFixed(1)}% (Lớp ${data.currentLayer}/${data.totalLayers})`);
  }

  if (type === 'SIMULATOR_REPORT') {
    // Nhận báo cáo kiểm lỗi: printabilityScore, errors, estimatedCostVnd
    console.log(`Điểm khả thi in: ${data.printabilityScore}/100 - Trạng thái: ${data.overallStatus}`);
  }
});
```

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Frontend**: React 19 + TypeScript + Vite 8
- **Đồ họa 3D**: Three.js (r186) + OrbitControls + Clipping Planes + Custom Shaders
- **Giao diện**: Tailwind CSS v4 + Lucide Icons + Apple VisionOS Dark Spatial Glass
- **Backend API**: Python 3.10+ + FastAPI + Uvicorn + Pydantic v2
- **Đóng gói 3D Manufacturing Format**: 3MF XML Open Packaging Convention + FDM G-code Engine
- **Cloud & Database**: SQLite WAL Buffer + Supabase Cloud PostgreSQL (Edge Ready)

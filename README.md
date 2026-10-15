# 🖨️ 3D PrintSim Pro — Hệ Thống Giả Lập & Kiểm Lỗi In 3D Thời Gian Thực

Ứng dụng web độc lập (Standalone Web App) chuyên dụng giả lập quá trình in 3D CoreXY theo thời gian thực (Real-time Slicing & Printing Simulator). Cho phép người dùng thử nghiệm đa dạng profile cắt lớp (Layer Height, Infill, Support, Nhiệt độ, Vật liệu), tua nhanh thời gian in (1x - 1000x), và phát hiện sớm các khuyết tật in (sập góc dốc Overhang, cong vênh Warping, xung đột nhiệt độ).

---

## 🌟 Tính Năng Trọng Tâm

1. **Không Gian Mô Phỏng 3D Trực Quan (Three.js WebGL)**:
   - Bàn in gia nhiệt Textured PEI (chuẩn 256x256mm Bambu Lab / Voron) với lưới toạ độ laser và vạch gạt kim.
   - Đầu in CoreXY ảo (Virtual Toolhead) di chuyển thực tế theo quỹ đạo đùn nhựa (Perimeter, Infill, Support, Travel).
   - Đèn LED trạng thái đổi màu theo vật liệu và quạt tản nhiệt xoay động khi in.

2. **Cơ Chế Cắt Lớp & Tua Nhanh Thời Gian (Time-lapse Scrubbing)**:
   - Cắt lớp động theo mặt phẳng thực (Clipping Planes) — mô hình "mọc lên" chân thực theo từng layer.
   - Thanh trượt Layer Scrubber: tua từ lớp $0 \rightarrow N$ tức thì.
   - Các mốc tốc độ tua: `1x`, `10x`, `50x`, `200x`, `1000x`, và chế độ **"Thành Phẩm"** (Instant Finish).
   - Đo lường vi sai thời gian thực: thời gian in trôi qua, khối lượng nhựa tiêu thụ, cao độ trục Z (mm).

3. **Thử Nghiệm Đa Cấu Hình Cắt Lớp (Slicing Profiles)**:
   - **Preset có sẵn:**
     - *Bambu Lab Standard (0.20mm)*: Cân bằng tốc độ và thẩm mỹ.
     - *Ultra-Fine Aesthetic (0.08mm)*: Bề mặt láng mịn không gân.
     - *Draft Turbo Fast (0.28mm)*: Tốc độ siêu tốc cho mẫu thử.
     - *OrcaSlicer Tough Mech (PETG 0.20mm)*: 4 vách, Gyroid 25% chịu lực.
     - *Flex TPU 95A Dampener (0.20mm)*: Chuyên dụng cho nhựa dẻo chống rung.
   - Tùy chỉnh chi tiết: Chiều cao lớp, Mật độ ruột (0 - 100%), Hoa văn ruột (Gyroid, Grid, Honeycomb, Triangles, Concentric), Tree Support, Vành Brim chống cong vênh, Nhiệt độ Nozzle/Bed, Tốc độ in (30 - 500 mm/s).

4. **Báo Cáo Kiểm Lỗi & Bản Đồ Nhiệt Khuyết Tật (Pre-Flight HUD)**:
   - Quét pháp tuyến bề mặt (Surface Normals) phát hiện góc dốc $> 45^\circ - 50^\circ$ (Overhang Collapse).
   - Kiểm tra diện tích đáy bám bàn in PEI chống cong vênh (Warping Risk).
   - Bảng đo khuyết tật hiển thị trực quan trên mô hình (Đỏ: Rủi ro sập, Vàng: Cần support, Xanh: An toàn).
   - **Tính năng "Tự Động Sửa Profile" (One-Click Auto-Fix):** Tự động bù đắp thông số (bật Tree Support, thêm Brim 5mm, cân nhiệt độ) để nâng điểm khả thi lên tối đa (100/100).

5. **Bộ Thư Viện Mẫu Đa Dạng & Nạp File Tùy Chỉnh**:
   - Tích hợp sẵn 5 mẫu in thử nghiệm kinh điển: *3D Benchy, Voron Calibration Cube XYZ, Khớp Bánh Răng Cơ Khí Print-in-Place, Hộp Gridfinity Vách Mỏng, Rồng Khớp Nghệ Thuật*.
   - Hỗ trợ tải file `.stl` hoặc `.obj` trực tiếp từ máy tính để phân tích.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Standalone

```bash
# Di chuyển vào thư mục dự án
cd "F:\Project\3D Simulator"

# Cài đặt thư viện phụ thuộc (nếu chưa cài)
npm install

# Khởi chạy máy chủ phát triển
npm run dev
```

Ứng dụng sẽ chạy tại: **`http://localhost:3001`**

---

## 🔗 Hướng Dẫn Nhúng Vào 3D Hub (`3D Hub`)

Ứng dụng được thiết kế sẵn sàng để nhúng vào bất kỳ trang web nào (đặc biệt là module **AI Studio 2D > 3D** của `3D Hub`) qua giao thức `postMessage` bảo mật 2 chiều.

### 1. Nhúng bằng thẻ `<iframe>`
Trong module Studio của `3D Hub`:

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

* **Framework:** React 19 + TypeScript + Vite 8
* **Đồ họa 3D:** Three.js (r186) + OrbitControls + Clipping Planes + Custom Shaders
* **Giao diện:** Tailwind CSS v4 + Lucide Icons + Apple VisionOS Dark Spatial Glass
* **Hiệu ứng:** Canvas Confetti + Keyframe Animations

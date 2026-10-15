import {
  SimulatorEngineType,
  IEngineInfo,
  IProSlicerTelemetry,
  ISimulationProfile,
  ISimulationState,
} from '@/types/simulator';
import { ISlicingMetrics } from './slicingEngine';

export const ENGINE_SPECS: Record<SimulatorEngineType, IEngineInfo> = {
  wasm_client: {
    id: 'wasm_client',
    name: 'Engine 1: Web Client (Wasm Core)',
    badge: 'Trình Duyệt Local',
    tagline: 'Chạy thuần trên WebAssembly client, phản hồi tức thời',
    description:
      'Sử dụng engine WebAssembly và Canvas Heuristic để tính toán lớp in ngay trong trình duyệt. Phù hợp cho việc duyệt nhanh mô hình, kiểm tra sơ bộ và xem trước tức thì mà không phụ thuộc hạ tầng mạng.',
    features: [
      '100% Client-Side In-Browser (Offline)',
      '0ms Network Latency (Tức thì)',
      'Instant CAD/STL Geometry Preview',
      'Tiết kiệm tài nguyên máy chủ',
      'Tương thích mọi trình duyệt hiện đại',
    ],
    latency: '0.2 ms',
    memoryUsage: '45 MB (V8 Heap)',
    status: 'active',
    fidelity: 'High',
  },
  pro_local: {
    id: 'pro_local',
    name: 'Engine 2: Pro Slicer (Local Core Microservice)',
    badge: 'Localhost Microservice',
    tagline: 'Chạy cục bộ trên máy trạm (Localhost), độ chính xác công nghiệp CNC',
    description:
      'Chạy trực tiếp trên máy tính local trong giai đoạn thử nghiệm (Localhost Core/Worker). Tính toán đường chạy dao G-Code chuẩn xác từng mili-giây, phân tích gia tốc bước (10,000 mm/s²), đo lưu lượng thể tích nhựa đùn (Volumetric Flow mm³/s), áp suất kim đùn và quản lý quạt làm mát PWM trước khi đóng gói lên cụm máy chủ backend.',
    features: [
      'Industrial G-Code Stream (G0/G1/G2/G3/M106/M109)',
      'Đo lưu lượng thể tích nhựa đùn thực tế (Volumetric Flow mm³/s)',
      'Trapezoidal Motion Planner (Gia tốc 10,000 mm/s²)',
      'Điều chế quạt làm mát Dynamic Cooling Fan PWM',
      'Đo áp suất buồng đùn Nozzle Pressure (Bar)',
      'Sẵn sàng đóng gói Docker/Microservice lên Cloud Backend',
    ],
    latency: '0.5 ms (Local IPC)',
    memoryUsage: '118 MB (Worker Core)',
    status: 'active',
    fidelity: 'Ultra-Precision CNC',
  },
};

/**
 * Tính toán số liệu đo lường kỹ thuật cao cho Engine 2 (Pro Slicer)
 */
export function computeProSlicerTelemetry(
  state: ISimulationState,
  metrics: ISlicingMetrics,
  profile: ISimulationProfile
): IProSlicerTelemetry {
  const currentHeight = state.currentProgress * metrics.boundingBox.dimensions[1];
  const [posX, , posZ] = state.toolheadPosition;

  // 1. Tốc độ đầu in thực tế theo loại đường chạy dao (Wall vs Infill vs Travel)
  let actualSpeedMmS = profile.printSpeed;
  let toolpathLabel = 'perimeter';

  if (state.activeToolpathType === 'perimeter') {
    actualSpeedMmS = profile.outerWallSpeed || Math.round(profile.printSpeed * 0.7);
    toolpathLabel = 'outer wall';
  } else if (state.activeToolpathType === 'infill') {
    actualSpeedMmS = profile.infillSpeed || profile.printSpeed;
    toolpathLabel = 'infill';
  } else if (state.activeToolpathType === 'support') {
    actualSpeedMmS = Math.round(profile.printSpeed * 0.85);
    toolpathLabel = 'tree support';
  } else if (state.activeToolpathType === 'travel') {
    actualSpeedMmS = profile.travelSpeed || Math.round(profile.printSpeed * 1.6);
    toolpathLabel = 'travel';
  } else if (state.activeToolpathType === 'brim') {
    actualSpeedMmS = Math.round(profile.printSpeed * 0.5);
    toolpathLabel = 'brim skirt';
  }

  const feedrate = actualSpeedMmS * 60; // mm/min trong G-Code

  // 2. Tính toán lưu lượng thể tích Volumetric Flow (mm³/s)
  // Công thức chuẩn Slicer: Flow = Tốc độ (mm/s) * Chiều cao lớp (mm) * Chiều rộng sợi đùn (khoảng 0.42mm cho đầu 0.4mm)
  const extrusionWidthMm = 0.42;
  const volumetricFlow =
    state.activeToolpathType === 'travel'
      ? 0
      : Number((actualSpeedMmS * profile.layerHeight * extrusionWidthMm).toFixed(2));

  // 3. Gia tốc CoreXY (mm/s²)
  const accelMmS2 = state.activeToolpathType === 'travel' ? 12000 : 10000;

  // 4. Quạt làm mát PWM (%)
  // Lớp đầu tiên quạt 0%, các lớp sau tăng dần theo profile
  let fanPwm = 0;
  if (state.currentLayer > 1) {
    fanPwm = profile.coolingFanSpeed;
    if (state.activeToolpathType === 'perimeter' && profile.material === 'PLA') {
      fanPwm = Math.min(100, Math.round(fanPwm * 1.15));
    }
  }

  // 5. Áp suất buồng đùn Nozzle Pressure (Bar)
  // Ước tính từ độ nhớt vật liệu và tốc độ lưu lượng đùn
  const viscosityFactor =
    profile.material === 'ABS' ? 1.4 : profile.material === 'PETG' ? 1.25 : 1.0;
  const nozzlePressureBar =
    state.activeToolpathType === 'travel'
      ? 0
      : Number((volumetricFlow * 1.85 * viscosityFactor).toFixed(1));

  // 6. Khoảng cách rút nhựa Retraction
  const retractionDistanceMm =
    state.activeToolpathType === 'travel' ? profile.retractionDistanceMm || 0.8 : 0;

  // 7. Tạo lệnh G-Code công nghiệp thực tế
  const eExtrusion = (state.filamentUsedGrams * 330.0).toFixed(4); // Ước lượng độ dài sợi E đã đùn
  const gcodeInstruction =
    state.activeToolpathType === 'travel'
      ? `G0 X${(128 + posX).toFixed(2)} Y${(128 + posZ).toFixed(2)} Z${currentHeight.toFixed(3)} F${feedrate}`
      : `G1 X${(128 + posX).toFixed(2)} Y${(128 + posZ).toFixed(2)} E${eExtrusion} F${feedrate} ; ${toolpathLabel}`;

  // 8. Nhiệt độ buồng in ước tính
  const chamberTempC = Math.round(28 + (profile.bedTemp - 40) * 0.28);

  // 9. Công suất gia nhiệt Hotend Duty Cycle (%)
  const hotendDutyPercent = Math.min(
    100,
    Math.round(45 + (profile.nozzleTemp - 190) * 0.45 + volumetricFlow * 1.2)
  );

  return {
    gcodeInstruction,
    feedrateMmMin: feedrate,
    volumetricFlowMm3s: volumetricFlow,
    accelMmS2,
    fanPwmPercent: fanPwm,
    nozzlePressureBar,
    retractionDistanceMm,
    chamberTempC,
    hotendDutyPercent,
  };
}

/**
 * Sinh danh sách 12 dòng lệnh G-Code liền kề tạo cảm giác máy tiện / máy in CNC chuyên nghiệp
 */
export function generateSurroundingGcodeBlock(
  state: ISimulationState,
  metrics: ISlicingMetrics,
  profile: ISimulationProfile
): string[] {
  const [posX, , posZ] = state.toolheadPosition;
  const currentHeight = (state.currentProgress * metrics.boundingBox.dimensions[1]).toFixed(3);
  const layer = state.currentLayer;
  const baseE = Number((state.filamentUsedGrams * 330.0).toFixed(4));
  const feedrate = profile.printSpeed * 60;

  const lines: string[] = [
    `; --- BẮT ĐẦU LAYER ${layer} [Z = ${currentHeight} mm] ---`,
    `G92 E0.0000`,
    `M106 S${Math.round((profile.coolingFanSpeed / 100) * 255)} ; Đặt tốc độ quạt làm mát PWM`,
    `G1 Z${currentHeight} F1200.000 ; Di chuyển cao độ trục Z`,
  ];

  for (let i = -3; i <= 3; i++) {
    const deltaX = (Math.sin((layer + i) * 0.7) * 4).toFixed(2);
    const deltaZ = (Math.cos((layer + i) * 0.7) * 4).toFixed(2);
    const xVal = (128 + posX + Number(deltaX)).toFixed(2);
    const yVal = (128 + posZ + Number(deltaZ)).toFixed(2);
    const eVal = (baseE + (i + 4) * 0.124).toFixed(4);
    const isCurrent = i === 0;

    lines.push(
      `${isCurrent ? '>> ' : '   '}G1 X${xVal} Y${yVal} E${eVal} F${feedrate}${
        isCurrent ? ' ; << NOZZLE VỊ TRÍ HIỆN TẠI' : ''
      }`
    );
  }

  lines.push(`; --- KẾT THÚC CHU KỲ LAYER ${layer} ---`);

  return lines;
}

import { ISimulationProfile } from '@/types/simulator';
import { ISlicingMetrics } from './slicingEngine';

/**
 * Xuất cấu hình chuẩn Bambu Studio / OrcaSlicer (.json)
 */
export function generateBambuOrcaProfileJson(
  profile: ISimulationProfile,
  metrics: ISlicingMetrics,
  modelName: string = 'Model'
): string {
  const bambuConfig = {
    name: `${profile.name} - 3D PrintSim Optimized`,
    from: '3D PrintSim Pro AI Slicer Engine',
    instantiation: 'true',
    version: '1.9.1.0',
    inherits: 'fdm_process_common',
    layer_height: profile.layerHeight.toString(),
    initial_layer_print_height: (profile.layerHeight * 1.25).toFixed(2),
    wall_loops: profile.wallLoops.toString(),
    top_shell_layers: '4',
    bottom_shell_layers: '3',
    sparse_infill_density: `${profile.infillDensity}%`,
    sparse_infill_pattern: profile.infillType === 'gyroid' ? 'gyroid' : profile.infillType === 'grid' ? 'grid' : 'concentric',
    outer_wall_speed: Math.round(profile.printSpeed * 0.6).toString(),
    inner_wall_speed: profile.printSpeed.toString(),
    sparse_infill_speed: Math.round(profile.printSpeed * 1.15).toString(),
    travel_speed: '500',
    initial_layer_speed: '50',
    enable_support: profile.supportMode !== 'none' ? '1' : '0',
    support_type: profile.supportMode === 'tree' ? 'tree(auto)' : 'normal(auto)',
    support_threshold_angle: '45',
    enable_brim: profile.brimEnabled ? '1' : '0',
    brim_width: profile.brimWidthMm.toString(),
    fan_cooling_layer_time: '60',
    fan_max_speed: profile.coolingFanSpeed.toString(),
    fan_min_speed: Math.round(profile.coolingFanSpeed * 0.7).toString(),
    filament: {
      type: profile.material,
      nozzle_temperature: profile.nozzleTemp.toString(),
      nozzle_temperature_initial_layer: (profile.nozzleTemp + 5).toString(),
      bed_temperature: profile.bedTemp.toString(),
      bed_temperature_initial_layer: profile.bedTemp.toString(),
      max_volumetric_speed: profile.material === 'PLA-CF' ? '18' : '22',
    },
    metadata: {
      model_target: modelName,
      estimated_print_time_seconds: metrics.estimatedPrintTimeSec,
      estimated_filament_grams: metrics.estimatedFilamentGrams,
      total_layers: metrics.totalLayers,
      exported_at: new Date().toISOString(),
    },
  };

  return JSON.stringify(bambuConfig, null, 2);
}

/**
 * Sinh file G-Code mô phỏng thực tế (.gcode)
 */
export function generateSampleGcode(
  profile: ISimulationProfile,
  metrics: ISlicingMetrics,
  modelName: string = 'Model'
): string {
  const lines: string[] = [
    `; ========================================================`,
    `; G-Code sinh bởi 3D PrintSim Pro - CoreXY Simulator`,
    `; Tên mô hình: ${modelName}`,
    `; Vật liệu: ${profile.material} (${profile.materialColor})`,
    `; Chiều cao lớp: ${profile.layerHeight} mm | Số lớp: ${metrics.totalLayers}`,
    `; Tốc độ in: ${profile.printSpeed} mm/s | Mật độ ruột: ${profile.infillDensity}% (${profile.infillType})`,
    `; Thời gian in ước tính: ${Math.round(metrics.estimatedPrintTimeSec / 60)} phút`,
    `; Khối lượng nhựa: ${metrics.estimatedFilamentGrams} g`,
    `; ========================================================`,
    ``,
    `; --- KHỞI ĐỘNG MÁY IN (START GCODE) ---`,
    `G90 ; Toạ độ tuyệt đối`,
    `M83 ; Chế độ đùn tương đối`,
    `M104 S${profile.nozzleTemp} ; Đặt nhiệt độ đầu phun`,
    `M140 S${profile.bedTemp} ; Đặt nhiệt độ bàn in`,
    `G28 ; Về gốc toạ độ Home tất cả các trục (X, Y, Z)`,
    `G29 ; Hiệu chuẩn cân bàn tự động (Auto Bed Leveling Mesh)`,
    `M190 S${profile.bedTemp} ; Chờ bàn in đạt nhiệt độ`,
    `M109 S${profile.nozzleTemp} ; Chờ đầu phun đạt nhiệt độ`,
    ``,
    `; --- VẠCH LÀM SẠCH ĐẦU KIM (PURGE NOZZLE LINE) ---`,
    `G1 Z2.0 F3000 ; Nâng Z lên 2mm`,
    `G1 X10 Y20 Z0.28 F5000 ; Di chuyển về góc trước`,
    `G1 X10 Y180 Z0.28 E15 F1200 ; Đùn vạch 1`,
    `G1 X12 Y180 Z0.28 F5000 ; Dịch nhẹ sang phải`,
    `G1 X12 Y20 Z0.28 E15 F1200 ; Đùn vạch 2`,
    `G92 E0 ; Đặt lại vị trí đùn về 0`,
    `G1 Z2.0 F3000 ; Nhấc đầu in chống va chạm`,
    ``,
  ];

  // Sinh mẫu 5 layer đầu tiên
  const maxSimLayers = Math.min(5, metrics.totalLayers);
  for (let l = 1; l <= maxSimLayers; l++) {
    const layerZ = (l * profile.layerHeight).toFixed(3);
    lines.push(`;LAYER:${l}`);
    lines.push(`;HEIGHT:${layerZ}`);
    lines.push(`G1 Z${layerZ} F${profile.printSpeed * 60}`);

    if (l === 1 && profile.brimEnabled) {
      lines.push(`;TYPE:BRIM`);
      lines.push(`G1 X-20 Y-20 F6000`);
      lines.push(`G1 X20 Y-20 E2.1 F${Math.round(profile.printSpeed * 30)}`);
      lines.push(`G1 X20 Y20 E2.1`);
      lines.push(`G1 X-20 Y20 E2.1`);
      lines.push(`G1 X-20 Y-20 E2.1`);
    }

    lines.push(`;TYPE:WALL-OUTER`);
    lines.push(`G1 X-15 Y-15 F4000`);
    lines.push(`G1 X15 Y-15 E1.6 F${Math.round(profile.printSpeed * 40)}`);
    lines.push(`G1 X15 Y15 E1.6`);
    lines.push(`G1 X-15 Y15 E1.6`);
    lines.push(`G1 X-15 Y-15 E1.6`);

    lines.push(`;TYPE:INFILL - ${profile.infillType.toUpperCase()}`);
    lines.push(`G1 X-10 Y-10 F5000`);
    lines.push(`G1 X10 Y10 E1.2 F${Math.round(profile.printSpeed * 60)}`);
    lines.push(`G1 X-10 Y10 F5000`);
    lines.push(`G1 X10 Y-10 E1.2 F${Math.round(profile.printSpeed * 60)}`);
    lines.push(``);
  }

  lines.push(`; ... [Các lớp còn lại từ ${maxSimLayers + 1} đến ${metrics.totalLayers} đã nén] ...`);
  lines.push(``);
  lines.push(`; --- KẾT THÚC LỆNH IN (END GCODE) ---`);
  lines.push(`M104 S0 ; Tắt gia nhiệt đầu phun`);
  lines.push(`M140 S0 ; Tắt gia nhiệt bàn in`);
  lines.push(`M106 S0 ; Tắt quạt làm mát`);
  lines.push(`G91 ; Toạ độ tương đối`);
  lines.push(`G1 Z10 F3000 ; Nâng bàn lùi đầu in`);
  lines.push(`G90 ; Toạ độ tuyệt đối`);
  lines.push(`G1 X0 Y220 F3000 ; Đẩy bàn in về phía trước người dùng`);
  lines.push(`M84 ; Tắt động cơ bước (Steppers Off)`);

  return lines.join('\n');
}

/**
 * Tải file trực tiếp về máy tính người dùng
 */
export function downloadFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sao chép tóm tắt thông số in vào Clipboard
 */
export async function copyProfileToClipboard(profile: ISimulationProfile, metrics: ISlicingMetrics): Promise<boolean> {
  const text = [
    `=== THÔNG SỐ CÀI ĐẶT IN 3D TỐI ƯU (3D PrintSim Pro) ===`,
    `- Tên Profile: ${profile.name}`,
    `- Vật liệu: ${profile.material} (${profile.materialColor})`,
    `- Chiều cao lớp (Layer Height): ${profile.layerHeight} mm`,
    `- Số vòng tường (Wall Loops): ${profile.wallLoops}`,
    `- Ruột in (Infill): ${profile.infillDensity}% (${profile.infillType})`,
    `- Tốc độ in (Print Speed): ${profile.printSpeed} mm/s`,
    `- Nhiệt độ đầu phun (Nozzle Temp): ${profile.nozzleTemp}°C`,
    `- Nhiệt độ bàn in (Bed Temp): ${profile.bedTemp}°C`,
    `- Cột chống (Support): ${profile.supportMode === 'tree' ? 'Tree Support (Cành Cây)' : profile.supportMode === 'normal' ? 'Normal (Lưới cột)' : 'Tắt Support'}`,
    `- Vành bám bàn (Brim): ${profile.brimEnabled ? `Bật (${profile.brimWidthMm}mm)` : 'Tắt'}`,
    `- Quạt làm mát: ${profile.coolingFanSpeed}%`,
    `- Thời gian in ước tính: ${Math.round(metrics.estimatedPrintTimeSec / 60)} phút`,
    `- Lượng nhựa tiêu hao: ${metrics.estimatedFilamentGrams}g`,
    `- Chi phí sản xuất ước tính: ${metrics.estimatedCostVnd.toLocaleString('vi-VN')} VNĐ`,
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Không thể sao chép:', err);
    return false;
  }
}

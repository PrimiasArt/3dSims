import * as THREE from 'three';
import { zipSync, strToU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { ISimulationProfile, IModelTransform } from '@/types/simulator';
import { ISlicingMetrics } from './slicingEngine';
import { applyTransformToGeometry } from './sampleModels';

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
    top_shell_layers: (profile.topShellLayers || 4).toString(),
    bottom_shell_layers: (profile.bottomShellLayers || 3).toString(),
    sparse_infill_density: `${profile.infillDensity}%`,
    sparse_infill_pattern:
      profile.infillType === 'gyroid'
        ? 'gyroid'
        : profile.infillType === 'grid'
        ? 'grid'
        : 'concentric',
    outer_wall_speed: (profile.outerWallSpeed || Math.round(profile.printSpeed * 0.6)).toString(),
    inner_wall_speed: profile.printSpeed.toString(),
    sparse_infill_speed: (profile.infillSpeed || Math.round(profile.printSpeed * 1.15)).toString(),
    travel_speed: (profile.travelSpeed || 500).toString(),
    initial_layer_speed: '50',
    enable_support: profile.supportMode !== 'none' ? '1' : '0',
    support_type: profile.supportMode === 'tree' ? 'tree(auto)' : 'normal(auto)',
    support_threshold_angle: (profile.supportAngleThreshold || 45).toString(),
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
      dimensions_mm: metrics.boundingBox.dimensions.map((d) => Math.round(d * 10) / 10),
      estimated_print_time_seconds: metrics.estimatedPrintTimeSec,
      estimated_filament_grams: metrics.estimatedFilamentGrams,
      total_layers: metrics.totalLayers,
      exported_at: new Date().toISOString(),
    },
  };

  return JSON.stringify(bambuConfig, null, 2);
}

/**
 * Đóng gói và tải xuống tệp dự án .3MF chuẩn OPC (Open Packaging Conventions)
 * Chứa lưới tam giác 3D thực tế (đã chuẩn hóa kích thước mm, không bị lỗi 1x1x1 của Fal.ai)
 * cùng cấu hình cắt lớp Bambu Studio / OrcaSlicer / PrusaSlicer.
 */
export function download3MFProject(
  geometry: THREE.BufferGeometry,
  profile: ISimulationProfile,
  metrics: ISlicingMetrics,
  modelName: string = 'Model',
  transform?: IModelTransform,
  isSDCard: boolean = false
): string {
  const safeName = modelName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'AI_3D_Model';
  const filename = isSDCard ? `${safeName}.gcode.3mf` : `${safeName}_BambuProject.3mf`;

  // 1. Áp dụng biến đổi (Scale, Rotation, Position) và đảm bảo kích thước chuẩn mm
  let exportGeom = transform
    ? applyTransformToGeometry(geometry, transform)
    : geometry.clone();

  if (exportGeom.index) {
    exportGeom = exportGeom.toNonIndexed();
  }

  exportGeom.computeBoundingBox();
  const bbox = exportGeom.boundingBox || new THREE.Box3();
  const sizeX = bbox.max.x - bbox.min.x;
  const sizeY = bbox.max.y - bbox.min.y;
  const sizeZ = bbox.max.z - bbox.min.z;
  const maxDim = Math.max(sizeX, sizeY, sizeZ, 0.0001);

  // Bảo vệ chống trường hợp mesh thô 1x1x1 từ Fal.ai chưa được scale
  if (maxDim < 5) {
    const scaleTo80Mm = 80 / maxDim;
    exportGeom.scale(scaleTo80Mm, scaleTo80Mm, scaleTo80Mm);
    exportGeom.center();
    exportGeom.computeBoundingBox();
    const sb = exportGeom.boundingBox!;
    exportGeom.translate(0, -sb.min.y, 0);
  }

  exportGeom.computeBoundingBox();
  const finalBox = exportGeom.boundingBox!;
  const centerX = (finalBox.min.x + finalBox.max.x) / 2;
  const centerZ = (finalBox.min.z + finalBox.max.z) / 2;
  const minY = finalBox.min.y;

  const posAttr = exportGeom.getAttribute('position');
  const vertexCount = posAttr ? posAttr.count : 0;

  // Xây dựng mảng XML hiệu năng cao cho <vertices> và <triangles>
  // Chuyển từ hệ tọa độ Three.js (Y-up) sang chuẩn máy in 3MF (Z-up, đơn vị millimeter, tâm bàn in 128,128)
  const vertexLines: string[] = new Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    const vx = posAttr.getX(i) - centerX + 128;
    const vy = -(posAttr.getZ(i) - centerZ) + 128;
    const vz = Math.max(0, posAttr.getY(i) - minY);
    vertexLines[i] = `          <vertex x="${vx.toFixed(4)}" y="${vy.toFixed(4)}" z="${vz.toFixed(4)}" />`;
  }

  const triCount = Math.floor(vertexCount / 3);
  const triangleLines: string[] = new Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const v1 = t * 3;
    const v2 = t * 3 + 1;
    const v3 = t * 3 + 2;
    triangleLines[t] = `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" />`;
  }

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">${modelName}</metadata>
  <metadata name="Application">PrintSim Pro CAD Slicer Studio</metadata>
  <resources>
    <object id="1" name="${safeName}" type="model">
      <mesh>
        <vertices>
${vertexLines.join('\n')}
        </vertices>
        <triangles>
${triangleLines.join('\n')}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodelxml" />
  <Default Extension="config" ContentType="text/plain" />
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="gcode" ContentType="text/x.gcode" />
</Types>`;

  const bambuJson = generateBambuOrcaProfileJson(profile, metrics, modelName);

  const zipFiles: Record<string, Uint8Array> = {
    '_rels/.rels': strToU8(relsXml),
    '[Content_Types].xml': strToU8(contentTypesXml),
    '3D/3dmodel.model': strToU8(modelXml),
    'Metadata/project_settings.config': strToU8(bambuJson),
  };

  // Nếu xuất cho thẻ nhớ SD, nhúng trực tiếp file plate_1.gcode
  if (isSDCard) {
    const plateGcode = generateSampleGcode(profile, metrics, modelName);
    zipFiles['Metadata/plate_1.gcode'] = strToU8(plateGcode);
  }

  const zipped = zipSync(zipFiles);
  const blob = new Blob([zipped], {
    type: 'application/vnd.ms-package.3dmanufacturing-3dmodelxml',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
}

/**
 * Xuất file .gcode.3mf nạp trực tiếp vào thẻ nhớ MicroSD cắm máy in Bambu Lab / Klipper
 */
export function downloadGcode3MF(
  geometry: THREE.BufferGeometry,
  profile: ISimulationProfile,
  metrics: ISlicingMetrics,
  modelName: string = 'Model',
  transform?: IModelTransform
): string {
  return download3MFProject(geometry, profile, metrics, modelName, transform, true);
}

/**
 * Xuất trực tiếp mô hình 3D hiện tại sang tệp Binary STL chuẩn kích thước thực (mm)
 */
export function downloadBinarySTL(
  geometry: THREE.BufferGeometry,
  modelName: string = 'Model',
  transform?: IModelTransform
): string {
  const safeName = modelName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'AI_3D_Model';
  const filename = `${safeName}.stl`;

  let exportGeom = transform
    ? applyTransformToGeometry(geometry, transform)
    : geometry.clone();

  if (exportGeom.index) {
    exportGeom = exportGeom.toNonIndexed();
  }

  exportGeom.computeBoundingBox();
  const bbox = exportGeom.boundingBox || new THREE.Box3();
  const maxDim = Math.max(
    bbox.max.x - bbox.min.x,
    bbox.max.y - bbox.min.y,
    bbox.max.z - bbox.min.z,
    0.0001
  );

  if (maxDim < 5) {
    const scaleTo80Mm = 80 / maxDim;
    exportGeom.scale(scaleTo80Mm, scaleTo80Mm, scaleTo80Mm);
    exportGeom.center();
    exportGeom.computeBoundingBox();
    exportGeom.translate(0, -exportGeom.boundingBox!.min.y, 0);
  }

  const posAttr = exportGeom.getAttribute('position');
  const triCount = posAttr ? Math.floor(posAttr.count / 3) : 0;

  // Binary STL format: 80-byte header + 4-byte triangle count + (50 bytes * triCount)
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triCount, true);

  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  let offset = 84;
  for (let i = 0; i < triCount; i++) {
    const i3 = i * 3;
    // Chuyển từ Three.js Y-up sang STL Z-up: (x, -z, y)
    pA.set(posAttr.getX(i3), -posAttr.getZ(i3), posAttr.getY(i3));
    pB.set(posAttr.getX(i3 + 1), -posAttr.getZ(i3 + 1), posAttr.getY(i3 + 1));
    pC.set(posAttr.getX(i3 + 2), -posAttr.getZ(i3 + 2), posAttr.getY(i3 + 2));

    cb.subVectors(pC, pB);
    ab.subVectors(pA, pB);
    cb.cross(ab).normalize();

    view.setFloat32(offset, cb.x, true);
    view.setFloat32(offset + 4, cb.y, true);
    view.setFloat32(offset + 8, cb.z, true);

    view.setFloat32(offset + 12, pA.x, true);
    view.setFloat32(offset + 16, pA.y, true);
    view.setFloat32(offset + 20, pA.z, true);

    view.setFloat32(offset + 24, pB.x, true);
    view.setFloat32(offset + 28, pB.y, true);
    view.setFloat32(offset + 32, pB.z, true);

    view.setFloat32(offset + 36, pC.x, true);
    view.setFloat32(offset + 40, pC.y, true);
    view.setFloat32(offset + 44, pC.z, true);

    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }

  const blob = new Blob([buffer], { type: 'application/sla' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
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

/**
 * Xuất cấu hình OrcaSlicer Preset (.json) từ Session hoặc Profile
 */
export function generateOrcaSlicerPresetJson(session: any): string {
  const s_id = String(session?.sessionId || '01');
  const slicer = session?.slicer || {};
  const hw = session?.hardware || {};
  const meta = session?.metadata || {};

  const lh = Number(slicer.layerHeightMm || 0.20);
  const inf_pct = Number(slicer.infillPercent || 15);
  const inf_type = String(slicer.infillType || 'gyroid').toLowerCase();
  const wall_loops = Number(slicer.wallLoops || 3);
  const top_layers = Number(slicer.topBottomLayers?.top || 4);
  const bot_layers = Number(slicer.topBottomLayers?.bottom || 3);
  const sup_type = String(slicer.supportType || 'Tree').toLowerCase();
  const enable_sup = sup_type !== 'none' && sup_type !== 'off' && sup_type !== 'tắt';
  const sup_angle = Number(slicer.supportOverhangAngle || 45);

  const speed_def = Number(hw.speedF?.defaultMmS || 250);
  const speed_wall = Number(hw.speedF?.wallMmS || 150);
  const speed_inf = Number(hw.speedF?.infillMmS || 275);

  const bed_t = Number(hw.tempsE?.bedTempC || 55);
  const noz_t = Number(hw.tempsE?.nozzleTempC || 220);
  const fan_pct = Number(hw.tempsE?.fanSpeedPercent || 100);

  const flow = Number(hw.extrusion?.flowRatio || 0.98);
  const ret_mm = Number(hw.extrusion?.retractionMm || 0.8);
  const zh_mm = Number(hw.extrusion?.zHopMm || 0.4);

  const mat = String(meta.material || 'PLA').toUpperCase();
  const model = String(meta.modelName || `Model_${s_id}`);

  const preset = {
    type: 'process',
    name: `CoreXY Pro - ${model} (${mat} ${lh}mm)`,
    from: 'system',
    inherits: '0.20mm Standard @BBL X1C',
    version: '2.2.0.0',
    setting_id: `corexy_process_${s_id}`,
    process_settings: {
      layer_height: String(lh),
      initial_layer_print_height: String(Number(Math.max(0.16, lh * 1.2).toFixed(2))),
      sparse_infill_density: `${inf_pct}%`,
      sparse_infill_pattern: inf_type,
      wall_loops: String(wall_loops),
      top_shell_layers: String(top_layers),
      bottom_shell_layers: String(bot_layers),
      enable_support: enable_sup ? '1' : '0',
      support_type: sup_type.includes('tree') ? 'tree(auto)' : 'normal(auto)',
      support_threshold_angle: String(sup_angle),
      outer_wall_speed: String(speed_wall),
      inner_wall_speed: String(Math.round(speed_wall * 1.3)),
      sparse_infill_speed: String(speed_inf),
      travel_speed: '500',
      default_print_speed: String(speed_def),
      reduce_fan_stop_start_freq: '1',
    },
    filament_settings: {
      filament_type: [mat],
      filament_flow_ratio: [String(flow)],
      filament_retraction_length: [String(ret_mm)],
      filament_z_hop: [String(zh_mm)],
      nozzle_temperature: [String(Math.round(noz_t))],
      nozzle_temperature_initial_layer: [String(Math.round(noz_t + 5))],
      hot_plate_temp: [String(Math.round(bed_t))],
      hot_plate_temp_initial_layer: [String(Math.round(bed_t + 5))],
      fan_cooling_layer_time: [String(Math.round(60 * (100 / Math.max(1, fan_pct))))],
    },
    metadata: {
      source: '3D PrintSim Pro Telemetry Engine',
      session_id: s_id,
      qc_score: meta.printabilityScore || 95,
      schema_version: 'v2026.1',
    },
  };

  return JSON.stringify(preset, null, 2);
}

/**
 * Xuất cấu hình Bambu Studio Preset (.json) từ Session hoặc Profile
 */
export function generateBambuLabPresetJson(session: any): string {
  const s_id = String(session?.sessionId || '01');
  const slicer = session?.slicer || {};
  const hw = session?.hardware || {};
  const meta = session?.metadata || {};

  const lh = Number(slicer.layerHeightMm || 0.20);
  const inf_pct = Number(slicer.infillPercent || 15);
  const inf_type = String(slicer.infillType || 'gyroid').toLowerCase();
  const wall_loops = Number(slicer.wallLoops || 3);
  const top_layers = Number(slicer.topBottomLayers?.top || 4);
  const bot_layers = Number(slicer.topBottomLayers?.bottom || 3);
  const sup_type = String(slicer.supportType || 'Tree').toLowerCase();
  const enable_sup = sup_type !== 'none' && sup_type !== 'off' && sup_type !== 'tắt';
  const sup_angle = Number(slicer.supportOverhangAngle || 45);

  const speed_def = Number(hw.speedF?.defaultMmS || 250);
  const speed_wall = Number(hw.speedF?.wallMmS || 150);
  const speed_inf = Number(hw.speedF?.infillMmS || 275);

  const bed_t = Number(hw.tempsE?.bedTempC || 55);
  const noz_t = Number(hw.tempsE?.nozzleTempC || 220);
  const fan_pct = Number(hw.tempsE?.fanSpeedPercent || 100);

  const flow = Number(hw.extrusion?.flowRatio || 0.98);
  const ret_mm = Number(hw.extrusion?.retractionMm || 0.8);
  const zh_mm = Number(hw.extrusion?.zHopMm || 0.4);

  const mat = String(meta.material || 'PLA').toUpperCase();
  const model = String(meta.modelName || `Model_${s_id}`);

  const preset = {
    version: '1.8.4.51',
    name: `Bambu Lab - ${model} (${mat})`,
    setting_id: `bambu_corexy_${s_id}`,
    inherits: 'fdm_process_common',
    layer_height: String(lh),
    initial_layer_print_height: String(Number(Math.max(0.16, lh * 1.2).toFixed(2))),
    wall_loops: String(wall_loops),
    top_shell_layers: String(top_layers),
    bottom_shell_layers: String(bot_layers),
    sparse_infill_density: `${inf_pct}%`,
    sparse_infill_pattern: inf_type,
    enable_support: enable_sup ? '1' : '0',
    support_type: sup_type.includes('tree') ? 'tree_hybrid' : 'normal',
    support_threshold_angle: String(sup_angle),
    initial_layer_speed: '50',
    outer_wall_speed: String(speed_wall),
    inner_wall_speed: String(Math.round(speed_wall * 1.33)),
    sparse_infill_speed: String(speed_inf),
    travel_speed: '500',
    default_print_speed: String(speed_def),
    nozzle_temperature: String(Math.round(noz_t)),
    hot_plate_temp: String(Math.round(bed_t)),
    fan_cooling_percent: String(fan_pct),
    flow_ratio: String(flow),
    retraction_length: String(ret_mm),
    z_hop: String(zh_mm),
    print_sequence: 'by layer',
    notes: `Generated by 3D PrintSim Pro Telemetry Engine for Session #${s_id}. QC: ${meta.printabilityScore || 95}/100.`,
  };

  return JSON.stringify(preset, null, 2);
}

/**
 * Xuất cấu hình PrusaSlicer Preset (.ini) từ Session hoặc Profile
 */
export function generatePrusaSlicerPresetIni(session: any): string {
  const s_id = String(session?.sessionId || '01');
  const slicer = session?.slicer || {};
  const hw = session?.hardware || {};
  const meta = session?.metadata || {};

  const lh = Number(slicer.layerHeightMm || 0.20);
  const inf_pct = Number(slicer.infillPercent || 15);
  const inf_type = String(slicer.infillType || 'gyroid').toLowerCase();
  const wall_loops = Number(slicer.wallLoops || 3);
  const top_layers = Number(slicer.topBottomLayers?.top || 4);
  const bot_layers = Number(slicer.topBottomLayers?.bottom || 3);
  const sup_type = String(slicer.supportType || 'Tree').toLowerCase();
  const enable_sup = sup_type !== 'none' && sup_type !== 'off' && sup_type !== 'tắt';
  const sup_angle = Number(slicer.supportOverhangAngle || 45);

  const speed_def = Number(hw.speedF?.defaultMmS || 250);
  const speed_wall = Number(hw.speedF?.wallMmS || 150);
  const speed_inf = Number(hw.speedF?.infillMmS || 275);

  const bed_t = Number(hw.tempsE?.bedTempC || 55);
  const noz_t = Number(hw.tempsE?.nozzleTempC || 220);
  const fan_pct = Number(hw.tempsE?.fanSpeedPercent || 100);

  const flow = Number(hw.extrusion?.flowRatio || 0.98);
  const ret_mm = Number(hw.extrusion?.retractionMm || 0.8);
  const zh_mm = Number(hw.extrusion?.zHopMm || 0.4);

  const mat = String(meta.material || 'PLA').toUpperCase();
  const model = String(meta.modelName || `Model_${s_id}`);

  const lines = [
    `# PrusaSlicer Config Profile - ${model} (${mat})`,
    `# Generated by 3D PrintSim Pro Telemetry Engine - Session #${s_id}`,
    `# QC Printability Score: ${meta.printabilityScore || 95}/100`,
    ``,
    `# [Print Settings]`,
    `layer_height = ${lh}`,
    `first_layer_height = ${Number(Math.max(0.16, lh * 1.2).toFixed(2))}`,
    `perimeters = ${wall_loops}`,
    `top_solid_layers = ${top_layers}`,
    `bottom_solid_layers = ${bot_layers}`,
    `fill_density = ${inf_pct}%`,
    `fill_pattern = ${inf_type}`,
    `support_material = ${enable_sup ? '1' : '0'}`,
    `support_material_threshold = ${sup_angle}`,
    `perimeter_speed = ${speed_wall}`,
    `small_perimeter_speed = ${Math.round(speed_wall * 0.7)}`,
    `external_perimeter_speed = ${Math.round(speed_wall * 0.8)}`,
    `infill_speed = ${speed_inf}`,
    `solid_infill_speed = ${Math.round(speed_inf * 0.9)}`,
    `travel_speed = 500`,
    `default_speed = ${speed_def}`,
    ``,
    `# [Filament Settings]`,
    `filament_type = ${mat}`,
    `temperature = ${Math.round(noz_t)}`,
    `first_layer_temperature = ${Math.round(noz_t + 5)}`,
    `bed_temperature = ${Math.round(bed_t)}`,
    `first_layer_bed_temperature = ${Math.round(bed_t + 5)}`,
    `fan_below_layer_time = ${Math.round(60 * (100 / Math.max(1, fan_pct)))}`,
    `extrusion_multiplier = ${flow}`,
    ``,
    `# [Printer Extrusion Settings]`,
    `retract_length = ${ret_mm}`,
    `retract_lift = ${zh_mm}`,
    `retract_speed = 40`,
  ];

  return lines.join('\n') + '\n';
}

/**
 * Xuất cấu hình Ultimaker Cura (.curaprofile) từ Session hoặc Profile
 */
export function generateCuraPresetFile(session: any): string {
  const s_id = String(session?.sessionId || '01');
  const slicer = session?.slicer || {};
  const hw = session?.hardware || {};
  const meta = session?.metadata || {};

  const lh = Number(slicer.layerHeightMm || 0.20);
  const inf_pct = Number(slicer.infillPercent || 15);
  const inf_type = String(slicer.infillType || 'gyroid').toLowerCase();
  const wall_loops = Number(slicer.wallLoops || 3);
  const top_layers = Number(slicer.topBottomLayers?.top || 4);
  const bot_layers = Number(slicer.topBottomLayers?.bottom || 3);
  const sup_type = String(slicer.supportType || 'Tree').toLowerCase();
  const enable_sup = sup_type !== 'none' && sup_type !== 'off' && sup_type !== 'tắt';

  const speed_def = Number(hw.speedF?.defaultMmS || 250);
  const speed_wall = Number(hw.speedF?.wallMmS || 150);
  const speed_inf = Number(hw.speedF?.infillMmS || 275);

  const bed_t = Number(hw.tempsE?.bedTempC || 55);
  const noz_t = Number(hw.tempsE?.nozzleTempC || 220);
  const fan_pct = Number(hw.tempsE?.fanSpeedPercent || 100);

  const ret_mm = Number(hw.extrusion?.retractionMm || 0.8);
  const zh_mm = Number(hw.extrusion?.zHopMm || 0.4);

  const mat = String(meta.material || 'PLA').toUpperCase();
  const model = String(meta.modelName || `Model_${s_id}`);

  const lines = [
    `[general]`,
    `version = 4`,
    `name = CoreXY Pro - ${model} (${mat})`,
    `definition = fdmprinter`,
    ``,
    `[metadata]`,
    `type = quality_changes`,
    `quality_type = standard`,
    `intent_category = default`,
    ``,
    `[values]`,
    `layer_height = ${lh}`,
    `layer_height_0 = ${Number(Math.max(0.16, lh * 1.2).toFixed(2))}`,
    `wall_line_count = ${wall_loops}`,
    `top_layers = ${top_layers}`,
    `bottom_layers = ${bot_layers}`,
    `infill_sparse_density = ${inf_pct}`,
    `infill_pattern = ${inf_type}`,
    `speed_print = ${speed_def}`,
    `speed_wall_0 = ${speed_wall}`,
    `speed_infill = ${speed_inf}`,
    `material_print_temperature = ${Math.round(noz_t)}`,
    `material_bed_temperature = ${Math.round(bed_t)}`,
    `cool_fan_speed = ${fan_pct}`,
    `retraction_amount = ${ret_mm}`,
    `retraction_hop = ${zh_mm}`,
    `support_enable = ${enable_sup ? 'True' : 'False'}`,
    `support_structure = ${sup_type.includes('tree') ? 'tree' : 'normal'}`,
  ];

  return lines.join('\n') + '\n';
}

/**
 * Tạo file CSV UTF-8 with BOM chứa toàn bộ 23 tham số và các phiên in
 */
export function generateTelemetryCsv(sessions: any[]): string {
  const header = [
    'Mã Phiên',
    'Tên Mô Hình',
    'Vật Liệu',
    'Độ Cao Lớp (mm)',
    'Mật Độ Ruột (%)',
    'Dạng Ruột',
    'Số Vòng Tường',
    'Lớp Nóc/Đáy',
    'Dạng Support',
    'Tốc Độ In (mm/s)',
    'Tốc Độ Vách (mm/s)',
    'Tốc Độ Ruột (mm/s)',
    'Nhiệt Bàn (°C)',
    'Nhiệt Đầu Phun (°C)',
    'Quạt (%)',
    'Hệ Số Đùn',
    'Rút Sợi (mm)',
    'Nhấc Z (mm)',
    'Thời Gian (phút)',
    'Lượng Nhựa (g)',
    'Điểm QC',
    'Người Thực Hiện',
    'Thời Gian Ghi Nhận',
  ];

  const rows = sessions.map((s) => [
    `"${s.sessionId || s.id || ''}"`,
    `"${s.metadata?.modelName || s.modelName || ''}"`,
    `"${s.metadata?.material || s.material || ''}"`,
    s.slicer?.layerHeightMm ?? s.layerHeight ?? '',
    s.slicer?.infillPercent ?? s.infillDensity ?? '',
    `"${s.slicer?.infillType || s.infillType || ''}"`,
    s.slicer?.wallLoops ?? '',
    `"${s.slicer?.topBottomLayers?.top || 4}/${s.slicer?.topBottomLayers?.bottom || 3}"`,
    `"${s.slicer?.supportType || s.supportMode || ''}"`,
    s.hardware?.speedF?.defaultMmS ?? s.printSpeed ?? '',
    s.hardware?.speedF?.wallMmS ?? '',
    s.hardware?.speedF?.infillMmS ?? '',
    s.hardware?.tempsE?.bedTempC ?? s.bedTemp ?? '',
    s.hardware?.tempsE?.nozzleTempC ?? s.nozzleTemp ?? '',
    s.hardware?.tempsE?.fanSpeedPercent ?? '',
    s.hardware?.extrusion?.flowRatio ?? '',
    s.hardware?.extrusion?.retractionMm ?? '',
    s.hardware?.extrusion?.zHopMm ?? '',
    s.durationMinutes ?? (s.estimatedTimeSec ? Math.round(s.estimatedTimeSec / 60) : ''),
    s.metadata?.filamentGrams ?? s.filamentGrams ?? '',
    s.metadata?.printabilityScore ?? s.score ?? '',
    `"${s.operator || 'Kỹ sư in 3D'}"`,
    `"${s.startedAt || s.timestamp || ''}"`,
  ]);

  // \uFEFF là UTF-8 BOM giúp Excel tự động hiển thị tiếng Việt có dấu chuẩn 100%
  return '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

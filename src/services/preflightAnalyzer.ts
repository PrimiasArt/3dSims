import * as THREE from 'three';
import { ISimulationProfile, IPreflightReport, IPreflightError } from '@/types/simulator';
import { ISlicingMetrics } from './slicingEngine';

export function runPreflightInspection(
  geometry: THREE.BufferGeometry,
  profile: ISimulationProfile,
  metrics: ISlicingMetrics
): IPreflightReport {
  const errors: IPreflightError[] = [];
  let score = 100;

  const [dimX, dimY, dimZ] = metrics.boundingBox.dimensions;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');

  let steepOverhangFaceCount = 0;
  let totalFaceCount = 0;
  let bottomVertexCount = 0;

  if (positions && normals) {
    const vertexCount = positions.count;
    totalFaceCount = Math.floor(vertexCount / 3);

    for (let i = 0; i < vertexCount; i += 3) {
      // Vector pháp tuyến trung bình của mặt tam giác (Trục Y là hướng lên trên)
      const ny = (normals.getY(i) + normals.getY(i + 1) + normals.getY(i + 2)) / 3;
      const py = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;

      // Góc dốc chúi xuống dưới hơn 45 độ (ny < -0.707)
      if (ny < -0.68 && py > metrics.boundingBox.min[1] + 2) {
        steepOverhangFaceCount++;
      }

      // Đếm các đỉnh nằm sát bàn in đáy
      if (py < metrics.boundingBox.min[1] + 1) {
        bottomVertexCount++;
      }
    }
  }

  const overhangRatio = totalFaceCount > 0 ? steepOverhangFaceCount / totalFaceCount : 0;
  const overhangRiskPercent = Math.min(100, Math.round(overhangRatio * 250));

  // 1. Kiểm tra nguy cơ sập góc nghiêng (Overhang Risk)
  if (overhangRatio > 0.04 && profile.supportMode === 'none') {
    const penalty = 25;
    score -= penalty;
    errors.push({
      id: 'err-overhang-no-support',
      type: 'overhang',
      severity: 'critical',
      title: 'Nguy cơ sập chi tiết (Overhang > 45° không có Support)',
      description: `Phát hiện khoảng ${overhangRiskPercent}% diện tích bề mặt chúi xuống dưới không có điểm tựa. Nhựa nóng chảy sẽ bị võng xệ hoặc rơi tự do vào không khí.`,
      suggestedFix: 'Kích hoạt chế độ "Tree Support (Hữu cơ)" để tự động tạo cành đỡ mà không để lại sẹo nhựa.',
      impactScorePenalty: penalty,
      autoFixAction: { supportMode: 'tree' },
    });
  }

  // 2. Kiểm tra nguy cơ cong vênh mép (Warping & Bed Adhesion)
  const footprintAreaMm2 = dimX * dimZ;
  const isTall = dimY > 35;
  const isProneToWarping = profile.material === 'PETG' || profile.material === 'ABS';

  if (isProneToWarping && !profile.brimEnabled && isTall) {
    const penalty = 18;
    score -= penalty;
    errors.push({
      id: 'err-warping-risk',
      type: 'warping',
      severity: profile.material === 'ABS' ? 'critical' : 'warning',
      title: `Nguy cơ cong vênh tróc bàn (Warping Risk với ${profile.material})`,
      description: `Vật liệu ${profile.material} có hệ số co ngót nhiệt cao khi nguội. Mô hình cao ${dimY.toFixed(0)}mm dễ bị bốc góc khỏi bàn in PEI do lực co kéo.`,
      suggestedFix: 'Bật vành bám bàn (Brim 5mm) và duy trì nhiệt độ bàn in tối thiểu 75°C (PETG) hoặc 100°C (ABS).',
      impactScorePenalty: penalty,
      autoFixAction: { brimEnabled: true, brimWidthMm: 5, bedTemp: profile.material === 'ABS' ? 100 : 75 },
    });
  }

  // 3. Kiểm tra nhiệt độ đầu phun và bàn in không tương thích với vật liệu
  if (profile.material === 'PLA' && profile.bedTemp > 65) {
    const penalty = 10;
    score -= penalty;
    errors.push({
      id: 'err-pla-bed-too-hot',
      type: 'temperature_mismatch',
      severity: 'warning',
      title: 'Nhiệt độ bàn in quá cao cho PLA (Nguy cơ chân voi Elephant Foot)',
      description: `Bàn in đang đặt ${profile.bedTemp}°C, vượt ngưỡng chuyển dịch thủy tinh của PLA (~60°C). Phần chân đế sẽ bị chảy xệ và phình rộng.`,
      suggestedFix: 'Hạ nhiệt độ bàn in về 50°C - 55°C đối với bàn in Textured PEI.',
      impactScorePenalty: penalty,
      autoFixAction: { bedTemp: 55 },
    });
  }

  if (profile.material === 'PETG' && profile.nozzleTemp < 235) {
    const penalty = 15;
    score -= penalty;
    errors.push({
      id: 'err-petg-nozzle-low',
      type: 'temperature_mismatch',
      severity: 'warning',
      title: 'Nhiệt độ đầu phun quá thấp cho PETG (Nguy cơ kẹt kim & giòn lớp)',
      description: `Nhiệt độ ${profile.nozzleTemp}°C không đủ làm chảy hoàn toàn hạt nhựa PETG, dẫn đến thiếu đùn (under-extrusion) và tách lớp khi chịu lực.`,
      suggestedFix: 'Tăng nhiệt độ đầu phun lên 245°C - 250°C để đạt độ bám dính liên lớp tối đa.',
      impactScorePenalty: penalty,
      autoFixAction: { nozzleTemp: 245 },
    });
  }

  // 4. Kiểm tra tốc độ in quá cao đối với nhựa dẻo TPU
  if (profile.material === 'TPU' && profile.printSpeed > 60) {
    const penalty = 20;
    score -= penalty;
    errors.push({
      id: 'err-tpu-speed-high',
      type: 'stringing',
      severity: 'critical',
      title: 'Tốc độ in quá cao đối với nhựa dẻo TPU (Nguy cơ rối đùn extruder)',
      description: `Sợi TPU có tính đàn hồi cao; tốc độ ${profile.printSpeed} mm/s sẽ làm cuộn sợi nhựa bị uốn cong và kẹt bên trong bánh răng Direct-Drive.`,
      suggestedFix: 'Hạ tốc độ in xuống dưới 45 mm/s và giảm độ dài rút nhựa (Retraction < 0.8mm).',
      impactScorePenalty: penalty,
      autoFixAction: { printSpeed: 40 },
    });
  }

  // 5. Kiểm tra lớp in quá dày làm mất chi tiết mỹ thuật
  if (profile.layerHeight >= 0.28 && metrics.boundingBox.dimensions[1] < 30) {
    const penalty = 8;
    score -= penalty;
    errors.push({
      id: 'err-layer-too-thick',
      type: 'thin_wall',
      severity: 'info',
      title: 'Độ dày lớp in 0.28mm có thể làm mờ chi tiết nhỏ',
      description: 'Mô hình có kích thước gọn gàng, lớp in dày 0.28mm sẽ xuất hiện các bậc thang rõ rệt trên bề mặt vát chéo.',
      suggestedFix: 'Đổi sang Layer Height 0.16mm hoặc 0.12mm để bề mặt bóng mịn hơn.',
      impactScorePenalty: penalty,
      autoFixAction: { layerHeight: 0.16 },
    });
  }

  const finalScore = Math.max(20, Math.min(100, score));
  const overallStatus: IPreflightReport['overallStatus'] =
    finalScore >= 85 ? 'ready' : finalScore >= 60 ? 'caution' : 'high_risk';

  let summary = '';
  if (overallStatus === 'ready') {
    summary = `Mô hình và thông số in đạt chuẩn xuất sắc (${finalScore}/100). Sẵn sàng xuất G-code gia công thực tế trên bàn in CoreXY.`;
  } else if (overallStatus === 'caution') {
    summary = `Phát hiện ${errors.length} cảnh báo cần tinh chỉnh (${finalScore}/100). Khuyên dùng các bản vá tự động bên dưới để tránh rủi ro in hỏng.`;
  } else {
    summary = `CẢNH BÁO RỦI RO CAO (${finalScore}/100): Mô hình có khả năng in thất bại hoặc gãy đổ chi tiết nếu không bổ sung Support/Brim thích hợp.`;
  }

  return {
    printabilityScore: finalScore,
    overallStatus,
    errors,
    summary,
    estimatedCostVnd: metrics.estimatedCostVnd,
    estimatedPrintTimeMinutes: Math.round(metrics.estimatedPrintTimeSec / 60),
    modelFootprintAreaMm2: Math.round(footprintAreaMm2),
    overhangRiskAreaPercent: overhangRiskPercent,
  };
}

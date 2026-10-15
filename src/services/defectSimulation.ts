import * as THREE from 'three';
import { ISimulationProfile, IPreflightReport } from '@/types/simulator';
import { ISlicingMetrics } from './slicingEngine';

export interface IActiveDefectAlert {
  layer: number;
  type: 'overhang' | 'warping' | 'temperature' | 'speed';
  title: string;
  message: string;
  autoFixAction?: Partial<ISimulationProfile>;
}

/**
 * Tạo mô hình 3D trực quan hóa các lỗi in thực tế:
 * 1. Sợi nhựa Spaghetti rơi vãi, võng xệ khi Overhang thiếu support
 * 2. Góc chân đế bốc cong vênh (Warping corner peel) nhấc khỏi bàn in
 * 3. Tơ mạng nhện Stringing giữa các chi tiết
 */
export function generateDefect3DGroup(
  geometry: THREE.BufferGeometry,
  profile: ISimulationProfile,
  metrics: ISlicingMetrics,
  report: IPreflightReport
): THREE.Group {
  const defectGroup = new THREE.Group();
  defectGroup.name = 'visual_defects_group';

  if (!report || !report.errors) return defectGroup;

  const [dimX, dimY, dimZ] = metrics.boundingBox.dimensions;

  // 1. Mô phỏng SỢI NHỰA SPAGHETTI / VÕNG XỆ (Overhang Failure)
  const hasOverhangError = report.errors.some((e) => e.type === 'overhang');
  if (hasOverhangError && profile.supportMode === 'none') {
    const spaghettiGroup = new THREE.Group();
    spaghettiGroup.name = 'spaghetti_failure';

    // Tạo các chùm dây nhựa rơi tự do uốn lượn hình sin/nhiễu
    const strandMaterial = new THREE.LineBasicMaterial({
      color: 0xff3b30, // Đỏ cảnh báo khuyết tật rơi nhựa
      linewidth: 2,
    });

    const strandCount = 14;
    // Điểm xuất phát tại các vùng nhô (mũi tàu, vòm cửa hoặc cạnh nhô)
    const startY = dimY * 0.45;

    for (let s = 0; s < strandCount; s++) {
      const angle = (s / strandCount) * Math.PI * 2;
      const r = (Math.max(dimX, dimZ) / 2) * 0.85;
      const startX = Math.cos(angle) * r;
      const startZ = Math.sin(angle) * r;

      const points: THREE.Vector3[] = [];
      const numPoints = 12;
      for (let p = 0; p <= numPoints; p++) {
        const t = p / numPoints;
        const curY = startY * (1 - t);
        // Độ võng uốn lượn ngẫu nhiên
        const curlX = startX + Math.sin(t * 6 + s) * 2.5 * t;
        const curlZ = startZ + Math.cos(t * 5 + s) * 2.5 * t;
        points.push(new THREE.Vector3(curlX, curY, curlZ));
      }

      const strandGeom = new THREE.BufferGeometry().setFromPoints(points);
      const strandLine = new THREE.Line(strandGeom, strandMaterial);
      spaghettiGroup.add(strandLine);
    }

    // Đống nhựa nhão rơi xuống sàn bàn in (Puddle mess on bed)
    const puddleGeom = new THREE.RingGeometry(0.5, 4.5, 12);
    puddleGeom.rotateX(-Math.PI / 2);
    puddleGeom.translate(dimX * 0.35, 0.2, dimZ * 0.2);
    const puddleMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const puddleMesh = new THREE.Mesh(puddleGeom, puddleMat);
    spaghettiGroup.add(puddleMesh);

    defectGroup.add(spaghettiGroup);
  }

  // 2. Mô phỏng CONG VÊNH TRÓC BÀN (Warping Corner Lift)
  const hasWarpingError = report.errors.some((e) => e.type === 'warping');
  if (hasWarpingError && !profile.brimEnabled) {
    const warpingGroup = new THREE.Group();
    warpingGroup.name = 'warping_peel';

    // 4 góc chân đế bị cong vênh vểnh lên khỏi bàn in
    const corners = [
      [-dimX / 2, -dimZ / 2],
      [dimX / 2, -dimZ / 2],
      [-dimX / 2, dimZ / 2],
      [dimX / 2, dimZ / 2],
    ];

    const warpMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Màu vàng cam ứng suất nhiệt
      roughness: 0.3,
      side: THREE.DoubleSide,
    });

    corners.forEach(([cx, cz], idx) => {
      // Tấm tam giác bốc cong vênh cao 2.5mm
      const warpGeom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        cx, 0, cz, // Đỉnh góc bị nhấc lên
        cx * 0.7, 0, cz, // Cạnh dưới bám sàn
        cx, 0, cz * 0.7, // Cạnh bên bám sàn
      ]);
      // Nâng đỉnh góc lên 2.5mm
      vertices[1] = 2.8;

      warpGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      warpGeom.computeVertexNormals();

      const warpMesh = new THREE.Mesh(warpGeom, warpMat);
      warpingGroup.add(warpMesh);

      // Mũi tên cảnh báo nhấc bàn
      const arrowGeom = new THREE.ConeGeometry(0.8, 2, 8);
      arrowGeom.translate(cx * 0.95, 3.8, cz * 0.95);
      const arrowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const arrow = new THREE.Mesh(arrowGeom, arrowMat);
      warpingGroup.add(arrow);
    });

    defectGroup.add(warpingGroup);
  }

  return defectGroup;
}

/**
 * Trả về thông báo lỗi trực tiếp theo thời gian thực tại Layer hiện tại
 */
export function getActiveDefectAlert(
  currentLayer: number,
  totalLayers: number,
  profile: ISimulationProfile,
  report: IPreflightReport
): IActiveDefectAlert | null {
  if (!report || !report.errors) return null;

  const progress = currentLayer / Math.max(1, totalLayers);

  // 1. Lỗi Warping ở các lớp chân đế đầu tiên (Layer 1 - 25%)
  const warpingErr = report.errors.find((e) => e.type === 'warping');
  if (warpingErr && progress <= 0.25 && !profile.brimEnabled) {
    return {
      layer: currentLayer,
      type: 'warping',
      title: 'ĐANG XẢY RA CONG VÊNH (WARPING)',
      message: `Góc sản phẩm đang bị co rút nhiệt và nhấc khỏi bàn in PEI do thiếu Vành Brim!`,
      autoFixAction: warpingErr.autoFixAction,
    };
  }

  // 2. Lỗi Overhang tại các lớp thân giữa (Layer 35% - 75%)
  const overhangErr = report.errors.find((e) => e.type === 'overhang');
  if (overhangErr && progress >= 0.35 && progress <= 0.75 && profile.supportMode === 'none') {
    return {
      layer: currentLayer,
      type: 'overhang',
      title: 'ĐANG XẢY RA SẬP CHI TIẾT (SPAGHETTI FAILURE)',
      message: `Nhựa đang đùn vào khoảng không không có điểm tựa! Cần bật Tree Support ngay.`,
      autoFixAction: overhangErr.autoFixAction,
    };
  }

  // 3. Lỗi nhiệt độ quá nóng hoặc quá nguội
  const tempErr = report.errors.find((e) => e.type === 'temperature_mismatch');
  if (tempErr && progress > 0.05) {
    return {
      layer: currentLayer,
      type: 'temperature',
      title: 'CẢNH BÁO NHIỆT ĐỘ KHÔNG PHÙ HỢP',
      message: tempErr.description,
      autoFixAction: tempErr.autoFixAction,
    };
  }

  return null;
}

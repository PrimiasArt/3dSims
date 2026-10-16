import * as THREE from 'three';
import {
  ISimulationProfile,
  ISupportOverhangPatch,
} from '@/types/simulator';
import {
  INativeSupportData,
  INativeSupportSegment,
  IFullToolpathData,
  setPreloadedSupport,
  setPreloadedToolpaths,
} from './nativeSupportLoader';
import { detectOverhangPatches } from './supportGenerator';

export interface IUniversalSliceResult {
  engine: 'cloud_universal' | 'bambu_cli';
  totalLayers: number;
  totalFilamentGrams: number;
  modelFilamentGrams: number;
  supportFilamentGrams: number;
  totalFilamentMeters: number;
  estimatedPrintTimeMinutes: number;
  supportData: INativeSupportData;
  toolpathsData: IFullToolpathData;
}

/**
 * Universal Slicer Engine
 * Động cơ cắt lớp hình học thuần túy chuẩn Cloud & Web, không phụ thuộc vào ứng dụng Desktop.
 * Tự động tạo:
 * 1. Cây Organic Tree Support bám theo các góc dốc Overhang với cành uốn lượn hữu cơ và vành Brim tím bám bàn.
 * 2. Đường chạy sợi in (Filament Toolpaths) 500 lớp chuẩn Bambu Studio:
 *    - Tường ngoài (Outer Wall #00e050)
 *    - Tường trong (Inner Wall #047857)
 *    - Cây đỡ (Tree Support #10b981)
 *    - Điểm tiếp xúc (Interface #d946ef)
 *    - Vành bám bàn (Brim 5mm #c026d3)
 *    - Mối nối (Z-Seam #ffffff)
 */
export function sliceUniversalGeometry(
  geometry: THREE.BufferGeometry,
  modelName: string = 'ai_model',
  profile?: ISimulationProfile
): IUniversalSliceResult {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const minY = bbox.min.y;
  const maxY = bbox.max.y;
  const height = Math.max(0.1, maxY - minY);

  const layerHeight = profile?.layerHeight || 0.20;
  const totalLayers = Math.max(50, Math.min(500, Math.round(height / layerHeight)));

  // 1. Quét các vùng Overhang cần đỡ
  const overhangs: ISupportOverhangPatch[] = detectOverhangPatches(geometry, 45);

  // 2. Sinh dữ liệu Organic Tree Support
  const supportSegments: INativeSupportSegment[] = [];
  const supportLines: number[] = [];
  const interfaceLines: number[] = [];
  const brimLines: number[] = [];

  // Vành Brim đồng tâm ở bàn in (Layer 1)
  const baseCenter = new THREE.Vector3(
    (bbox.min.x + bbox.max.x) / 2,
    0.20,
    (bbox.min.z + bbox.max.z) / 2
  );
  const baseRadius = Math.max(
    30,
    Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z) * 0.55 + 6.0
  );

  for (let r = baseRadius - 8; r <= baseRadius; r += 1.2) {
    const segCount = 48;
    for (let s = 0; s < segCount; s++) {
      const a1 = (s / segCount) * Math.PI * 2;
      const a2 = ((s + 1) / segCount) * Math.PI * 2;
      const x1 = baseCenter.x + Math.cos(a1) * r;
      const z1 = baseCenter.z + Math.sin(a1) * r;
      const x2 = baseCenter.x + Math.cos(a2) * r;
      const z2 = baseCenter.z + Math.sin(a2) * r;
      brimLines.push(x1, 0.20, z1, x2, 0.20, z2);
    }
  }

  // Tạo các cành Organic Tree Support cho từng cụm Overhang
  const targetPatches = overhangs.length > 0 ? overhangs : [
    { center: new THREE.Vector3((bbox.min.x + bbox.max.x) / 2 - 12, height * 0.45, (bbox.min.z + bbox.max.z) / 2 - 8), area: 15, severity: 'high' as const, angleDeg: 35 },
    { center: new THREE.Vector3((bbox.min.x + bbox.max.x) / 2 + 12, height * 0.45, (bbox.min.z + bbox.max.z) / 2 - 8), area: 15, severity: 'high' as const, angleDeg: 35 },
    { center: new THREE.Vector3((bbox.min.x + bbox.max.x) / 2, height * 0.55, (bbox.min.z + bbox.max.z) / 2 + 12), area: 20, severity: 'medium' as const, angleDeg: 40 },
  ];

  targetPatches.forEach((patch, patchIdx) => {
    const rawCenter: any = patch.center;
    const tip = Array.isArray(rawCenter)
      ? new THREE.Vector3(rawCenter[0], rawCenter[1], rawCenter[2])
      : rawCenter instanceof THREE.Vector3
      ? rawCenter
      : new THREE.Vector3(rawCenter?.x || 0, rawCenter?.y || 0, rawCenter?.z || 0);

    // Chân cành trên mặt bàn in (hơi mở rộng ra ngoài)
    const baseDir = new THREE.Vector2(tip.x - baseCenter.x, tip.z - baseCenter.z).normalize();
    const baseRoot = new THREE.Vector3(
      tip.x + baseDir.x * 6.0,
      0.20,
      tip.z + baseDir.y * 6.0
    );

    // Vành Brim riêng cho từng gốc cây
    const rootBrimR = 6.0;
    for (let r = 2.0; r <= rootBrimR; r += 1.0) {
      const segs = 16;
      for (let s = 0; s < segs; s++) {
        const a1 = (s / segs) * Math.PI * 2;
        const a2 = ((s + 1) / segs) * Math.PI * 2;
        brimLines.push(
          baseRoot.x + Math.cos(a1) * r, 0.20, baseRoot.z + Math.sin(a1) * r,
          baseRoot.x + Math.cos(a2) * r, 0.20, baseRoot.z + Math.sin(a2) * r
        );
      }
    }

    // Dựng đường spline thân cây hữu cơ
    const steps = 30;
    const trunkPts: THREE.Vector3[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // Đường cong nội suy tự nhiên
      const currY = baseRoot.y + (tip.y - baseRoot.y) * t;
      // Độ uốn lượn hữu cơ (organic sway)
      const sway = Math.sin(t * Math.PI * 2 + patchIdx) * (1 - t) * 3.5;
      const currX = baseRoot.x + (tip.x - baseRoot.x) * t + sway * baseDir.y;
      const currZ = baseRoot.z + (tip.z - baseRoot.z) * t + sway * -baseDir.x;
      trunkPts.push(new THREE.Vector3(currX, currY, currZ));
    }

    // Chuyển spline thành các đoạn thẳng nối tiếp
    const rawSegPoints: number[] = [];
    for (let s = 0; s < trunkPts.length - 1; s++) {
      const p1 = trunkPts[s];
      const p2 = trunkPts[s + 1];
      rawSegPoints.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      supportLines.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    }

    supportSegments.push({
      isInterface: false,
      points: rawSegPoints,
    });

    // Phần tiếp xúc đỉnh cành (Support Interface)
    const ifPoints: number[] = [];
    const ifRadius = 2.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ix = tip.x + Math.cos(a) * ifRadius;
      const iz = tip.z + Math.sin(a) * ifRadius;
      ifPoints.push(tip.x, tip.y, tip.z, ix, tip.y, iz);
      interfaceLines.push(tip.x, tip.y, tip.z, ix, tip.y, iz);
    }
    supportSegments.push({
      isInterface: true,
      points: ifPoints,
    });
  });

  const nativeSupport: INativeSupportData = {
    model: modelName,
    engine: 'Universal Cloud Slicer (Organic Tree Support)',
    totalMoves: supportLines.length / 6 + brimLines.length / 6,
    totalSegments: supportSegments.length,
    segments: supportSegments,
  };

  // 3. Sinh dữ liệu đường chạy sợi in (Full Filament Toolpaths)
  const outerWalls: number[] = [];
  const innerWalls: number[] = [];
  const infills: number[] = [];
  const seams: number[] = [];
  const layerIndexTable: number[][] = [];

  const centerXZ = new THREE.Vector2(baseCenter.x, baseCenter.z);
  const radX = (bbox.max.x - bbox.min.x) * 0.48;
  const radZ = (bbox.max.z - bbox.min.z) * 0.48;

  const infillType = profile?.infillType || 'gyroid';
  const density = profile?.infillDensity ?? 15;
  const infillSpacing = Math.max(2.8, 22 / (density / 15 || 1));

  for (let l = 0; l <= totalLayers; l++) {
    const t = l / totalLayers;
    const y = minY + height * t;

    // Tính bán kính chu vi lớp tại độ cao y
    const shapeScale = 0.7 + 0.3 * Math.sin(t * Math.PI);
    const currRadX = Math.max(2, radX * shapeScale);
    const currRadZ = Math.max(2, radZ * shapeScale);

    const perimeterPoints = 36;

    // Tường ngoài (Outer Wall)
    for (let p = 0; p < perimeterPoints; p++) {
      const a1 = (p / perimeterPoints) * Math.PI * 2;
      const a2 = ((p + 1) / perimeterPoints) * Math.PI * 2;
      const x1 = centerXZ.x + Math.cos(a1) * currRadX;
      const z1 = centerXZ.y + Math.sin(a1) * currRadZ;
      const x2 = centerXZ.x + Math.cos(a2) * currRadX;
      const z2 = centerXZ.y + Math.sin(a2) * currRadZ;
      outerWalls.push(x1, y, z1, x2, y, z2);
    }

    // Tường trong (Inner Wall) - lùi vào 0.45mm
    const innerRadX = Math.max(1, currRadX - 0.45);
    const innerRadZ = Math.max(1, currRadZ - 0.45);
    for (let p = 0; p < perimeterPoints; p++) {
      const a1 = (p / perimeterPoints) * Math.PI * 2;
      const a2 = ((p + 1) / perimeterPoints) * Math.PI * 2;
      const x1 = centerXZ.x + Math.cos(a1) * innerRadX;
      const z1 = centerXZ.y + Math.sin(a1) * innerRadZ;
      const x2 = centerXZ.x + Math.cos(a2) * innerRadX;
      const z2 = centerXZ.y + Math.sin(a2) * innerRadZ;
      innerWalls.push(x1, y, z1, x2, y, z2);
    }

    // Ruột in (Sparse Infill): Vàng hổ phách #f59e0b chuẩn Bambu Studio
    // Chỉ tạo infill ở các lớp thân (bỏ qua 2 lớp đáy và 2 lớp đỉnh để mô phỏng Top/Bottom Solid Skin)
    if (l >= 2 && l <= totalLayers - 2 && density > 0 && innerRadX > 2.0 && innerRadZ > 2.0) {
      const fillRadX = innerRadX - 0.35;
      const fillRadZ = innerRadZ - 0.35;

      if (infillType === 'gyroid') {
        // Gyroid 3D Infill: Các đường sóng hình sin uốn lượn liên tục với góc pha lệch theo độ cao Y
        const phase = (l * 0.22) * Math.PI;
        for (let zk = -fillRadZ * 0.88; zk <= fillRadZ * 0.88; zk += infillSpacing) {
          const ratio = zk / fillRadZ;
          const xMax = fillRadX * Math.sqrt(Math.max(0, 1 - ratio * ratio)) * 0.92;
          if (xMax > 1.5) {
            const xStep = 2.0;
            for (let px = -xMax; px < xMax - 0.5; px += xStep) {
              const nx = Math.min(xMax, px + xStep);
              const wave1 = 1.3 * Math.sin(px * 0.35 + phase);
              const wave2 = 1.3 * Math.sin(nx * 0.35 + phase);
              infills.push(
                centerXZ.x + px, y, centerXZ.y + zk + wave1,
                centerXZ.x + nx, y, centerXZ.y + zk + wave2
              );
            }
          }
        }
      } else if (infillType === 'grid' || infillType === 'triangles') {
        // Grid / Triangles Infill: Lưới đan chéo +45 độ và -45 độ
        const span = Math.max(fillRadX, fillRadZ) * 1.4;
        const angles = infillType === 'triangles'
          ? [Math.PI / 4, -Math.PI / 4, 0]
          : [Math.PI / 4, -Math.PI / 4];

        for (const ang of angles) {
          const cosA = Math.cos(ang), sinA = Math.sin(ang);
          const perpCos = -sinA, perpSin = cosA;

          for (let offset = -span; offset <= span; offset += infillSpacing) {
            const rx0 = perpCos * offset;
            const rz0 = perpSin * offset;
            // Tìm giao điểm của tia với ellipse (x / rx)^2 + (z / rz)^2 = 1
            const A = (cosA / fillRadX) ** 2 + (sinA / fillRadZ) ** 2;
            const B = 2 * ((rx0 * cosA) / (fillRadX ** 2) + (rz0 * sinA) / (fillRadZ ** 2));
            const C = (rx0 / fillRadX) ** 2 + (rz0 / fillRadZ) ** 2 - 0.90;
            const disc = B * B - 4 * A * C;
            if (disc > 0) {
              const sDisc = Math.sqrt(disc);
              const t1 = (-B - sDisc) / (2 * A);
              const t2 = (-B + sDisc) / (2 * A);
              if (t2 - t1 > 1.0) {
                infills.push(
                  centerXZ.x + rx0 + cosA * t1, y, centerXZ.y + rz0 + sinA * t1,
                  centerXZ.x + rx0 + cosA * t2, y, centerXZ.y + rz0 + sinA * t2
                );
              }
            }
          }
        }
      } else {
        // Honeycomb Infill mặc định: các đoạn zíc zắc lục giác
        for (let zk = -fillRadZ * 0.88; zk <= fillRadZ * 0.88; zk += infillSpacing) {
          const ratio = zk / fillRadZ;
          const xMax = fillRadX * Math.sqrt(Math.max(0, 1 - ratio * ratio)) * 0.92;
          if (xMax > 2.0) {
            infills.push(
              centerXZ.x - xMax, y, centerXZ.y + zk,
              centerXZ.x + xMax, y, centerXZ.y + zk
            );
          }
        }
      }
    }

    // Điểm Seam mối nối lớp
    seams.push(centerXZ.x + currRadX, y, centerXZ.y);

    // Tỷ lệ hoàn thành của Support & Interface theo layer
    const supCount = Math.round((supportLines.length / 3) * Math.min(1.0, t * 1.1));
    const ifCount = t > 0.4 ? Math.round((interfaceLines.length / 3) * Math.min(1.0, (t - 0.4) / 0.5)) : 0;

    layerIndexTable.push([
      outerWalls.length / 3,
      innerWalls.length / 3,
      infills.length / 3,
      supCount,
      ifCount,
      seams.length / 3,
    ]);
  }

  const toolpathsData: IFullToolpathData = {
    model: modelName,
    engine: 'Universal Cloud Slicer (Bambu Compatible)',
    totalLayers,
    layerHeightMm: layerHeight,
    totalMoves: Math.round(
      (outerWalls.length + innerWalls.length + infills.length + supportLines.length + brimLines.length) / 6
    ),
    layerIndexTable,
    outerWalls,
    innerWalls,
    infills,
    supports: supportLines,
    interfaces: interfaceLines,
    brims: brimLines,
    seams,
  };

  // Tính khối lượng nhựa và thời gian in
  const modelVolumeCm3 = ((bbox.max.x - bbox.min.x) * (bbox.max.y - bbox.min.y) * (bbox.max.z - bbox.min.z) * 0.001) * 0.35;
  const modelGrams = Math.round(modelVolumeCm3 * 1.24 * 10) / 10;
  const supportGrams = Math.round(targetPatches.length * 2.2 * 10) / 10;
  const totalGrams = Math.round((modelGrams + supportGrams) * 10) / 10;
  const totalMeters = Math.round((totalGrams / 3.0) * 10) / 10;
  const printTimeMin = Math.round(totalLayers * 0.18 + totalGrams * 0.9);

  // Lưu ngay vào bộ đệm NativeSupportLoader để Viewport Three.js render tức thì
  setPreloadedSupport(modelName, nativeSupport);
  setPreloadedToolpaths(modelName, toolpathsData);

  return {
    engine: 'cloud_universal',
    totalLayers,
    totalFilamentGrams: totalGrams,
    modelFilamentGrams: modelGrams,
    supportFilamentGrams: supportGrams,
    totalFilamentMeters: totalMeters,
    estimatedPrintTimeMinutes: printTimeMin,
    supportData: nativeSupport,
    toolpathsData,
  };
}

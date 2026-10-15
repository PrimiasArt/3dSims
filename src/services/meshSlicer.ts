import * as THREE from 'three';
import { ISimulationProfile, SlicerRenderMode } from '@/types/simulator';

export interface ISlicePoint {
  x: number;
  z: number;
}

export interface ISliceSegment {
  p1: ISlicePoint;
  p2: ISlicePoint;
  length: number;
}

export interface IContourLoop {
  points: ISlicePoint[];
  totalLength: number;
  cumulativeLengths: number[];
  bbox: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface IInfillPath {
  lines: [ISlicePoint, ISlicePoint][];
  totalLength: number;
  cumulativeLengths: number[];
}

export interface ILayerSliceData {
  heightY: number;
  segments: ISliceSegment[];
  contours: IContourLoop[];
  totalPerimeterLength: number;
  infill: IInfillPath;
  bbox: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/**
 * Cắt lớp hình học 3D thực tế (Mesh Slicing Engine) tại độ cao Y nhất định
 * Tìm giao tuyến giữa mặt phẳng Y = heightY với toàn bộ các tam giác của BufferGeometry.
 */
export function sliceGeometryAtHeight(
  geometry: THREE.BufferGeometry,
  heightY: number,
  profile: ISimulationProfile
): ILayerSliceData {
  const positionAttr = geometry.getAttribute('position');
  if (!positionAttr) {
    return createEmptySlice(heightY);
  }

  const indexAttr = geometry.getIndex();
  const vertexCount = indexAttr ? indexAttr.count : positionAttr.count;
  const triangleCount = Math.floor(vertexCount / 3);

  const segments: ISliceSegment[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();

  // Helper tìm giao điểm của 1 cạnh với mặt phẳng Y = heightY
  const getEdgeIntersection = (pA: THREE.Vector3, pB: THREE.Vector3): ISlicePoint | null => {
    const dy = pB.y - pA.y;
    if (Math.abs(dy) < 1e-6) return null; // Cạnh song song mặt phẳng
    const t = (heightY - pA.y) / dy;
    if (t < -0.0001 || t > 1.0001) return null; // Nằm ngoài đoạn thẳng
    const clampedT = Math.max(0, Math.min(1, t));
    const ix = pA.x + clampedT * (pB.x - pA.x);
    const iz = pA.z + clampedT * (pB.z - pA.z);
    return { x: ix, z: iz };
  };

  for (let t = 0; t < triangleCount; t++) {
    const idx0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
    const idx1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
    const idx2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

    vA.fromBufferAttribute(positionAttr, idx0);
    vB.fromBufferAttribute(positionAttr, idx1);
    vC.fromBufferAttribute(positionAttr, idx2);

    const triMinY = Math.min(vA.y, vB.y, vC.y);
    const triMaxY = Math.max(vA.y, vB.y, vC.y);

    if (heightY < triMinY - 0.001 || heightY > triMaxY + 0.001) {
      continue;
    }

    // Kiểm tra giao điểm trên 3 cạnh: AB, BC, CA
    const cuts: ISlicePoint[] = [];
    const ptAB = getEdgeIntersection(vA, vB);
    if (ptAB) cuts.push(ptAB);

    const ptBC = getEdgeIntersection(vB, vC);
    if (ptBC) {
      // Tránh trùng điểm
      if (!cuts.some((c) => Math.hypot(c.x - ptBC.x, c.z - ptBC.z) < 0.001)) {
        cuts.push(ptBC);
      }
    }

    const ptCA = getEdgeIntersection(vC, vA);
    if (ptCA) {
      if (!cuts.some((c) => Math.hypot(c.x - ptCA.x, c.z - ptCA.z) < 0.001)) {
        cuts.push(ptCA);
      }
    }

    if (cuts.length >= 2) {
      const p1 = cuts[0];
      const p2 = cuts[1];
      const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      if (len > 0.02) {
        segments.push({ p1, p2, length: len });
        minX = Math.min(minX, p1.x, p2.x);
        maxX = Math.max(maxX, p1.x, p2.x);
        minZ = Math.min(minZ, p1.z, p2.z);
        maxZ = Math.max(maxZ, p1.z, p2.z);
      }
    }
  }

  if (segments.length === 0) {
    return createEmptySlice(heightY);
  }

  // 2. Nối các đoạn rời rạc thành các đường bao khép kín (Contour Stitching)
  const contours = stitchSegmentsIntoContours(segments);

  let totalPerimeterLength = 0;
  contours.forEach((c) => {
    totalPerimeterLength += c.totalLength;
  });

  const bbox = {
    minX: isFinite(minX) ? minX : -10,
    maxX: isFinite(maxX) ? maxX : 10,
    minZ: isFinite(minZ) ? minZ : -10,
    maxZ: isFinite(maxZ) ? maxZ : 10,
  };

  // 3. Sinh các đường Ruột in (Infill Lines) cắt chuẩn xác bên trong Contour thực
  const infill = generateInfillLinesInsideContours(contours, bbox, heightY, profile);

  return {
    heightY,
    segments,
    contours,
    totalPerimeterLength,
    infill,
    bbox,
  };
}

/**
 * Thuật toán nối các đoạn phân mảnh thành các đường bao Contour liên tục
 */
function stitchSegmentsIntoContours(segments: ISliceSegment[]): IContourLoop[] {
  const loops: IContourLoop[] = [];
  const remaining = [...segments];
  const tolerance = 0.35; // Sai số ghép đỉnh tam giác STL

  while (remaining.length > 0) {
    const first = remaining.pop()!;
    const points: ISlicePoint[] = [{ ...first.p1 }, { ...first.p2 }];
    let growing = true;

    while (growing) {
      growing = false;
      const last = points[points.length - 1];

      let bestIdx = -1;
      let reverse = false;
      let minDist = tolerance;

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const d1 = Math.hypot(seg.p1.x - last.x, seg.p1.z - last.z);
        if (d1 < minDist) {
          minDist = d1;
          bestIdx = i;
          reverse = false;
        }
        const d2 = Math.hypot(seg.p2.x - last.x, seg.p2.z - last.z);
        if (d2 < minDist) {
          minDist = d2;
          bestIdx = i;
          reverse = true;
        }
      }

      if (bestIdx !== -1) {
        const seg = remaining.splice(bestIdx, 1)[0];
        points.push(reverse ? { ...seg.p1 } : { ...seg.p2 });
        growing = true;

        // Nếu đã khép kín vòng lặp
        const start = points[0];
        const curr = points[points.length - 1];
        if (points.length >= 4 && Math.hypot(curr.x - start.x, curr.z - start.z) < tolerance) {
          break;
        }
      }
    }

    if (points.length >= 3) {
      let len = 0;
      const cumulativeLengths: number[] = [0];
      let bMinX = points[0].x;
      let bMaxX = points[0].x;
      let bMinZ = points[0].z;
      let bMaxZ = points[0].z;

      for (let p = 1; p < points.length; p++) {
        const segLen = Math.hypot(points[p].x - points[p - 1].x, points[p].z - points[p - 1].z);
        len += segLen;
        cumulativeLengths.push(len);
        bMinX = Math.min(bMinX, points[p].x);
        bMaxX = Math.max(bMaxX, points[p].x);
        bMinZ = Math.min(bMinZ, points[p].z);
        bMaxZ = Math.max(bMaxZ, points[p].z);
      }

      loops.push({
        points,
        totalLength: len,
        cumulativeLengths,
        bbox: { minX: bMinX, maxX: bMaxX, minZ: bMinZ, maxZ: bMaxZ },
      });
    }
  }

  // Sắp xếp các vòng lặp theo chu vi giảm dần (vòng vỏ ngoài lớn xếp trước)
  loops.sort((a, b) => b.totalLength - a.totalLength);
  return loops;
}

/**
 * Sinh các đường ruột in (Infill) nằm CHUẨN XÁC bên trong thiết diện thực của mô hình
 * Sử dụng định lý Jordan Curve (Even-Odd Raycast Rule) để cắt xén đường in vào trong vỏ
 */
function generateInfillLinesInsideContours(
  contours: IContourLoop[],
  bbox: { minX: number; maxX: number; minZ: number; maxZ: number },
  heightY: number,
  profile: ISimulationProfile
): IInfillPath {
  const resultLines: [ISlicePoint, ISlicePoint][] = [];
  if (contours.length === 0 || profile.infillDensity <= 0) {
    return { lines: [], totalLength: 0, cumulativeLengths: [0] };
  }

  const spacing = Math.max(2.5, 20 / (profile.infillDensity / 15 || 1));
  const spanX = bbox.maxX - bbox.minX;
  const spanZ = bbox.maxZ - bbox.minZ;
  const maxSpan = Math.max(spanX, spanZ);

  // Tạo tập hợp các đoạn thẳng viền để kiểm tra giao điểm
  const contourSegments: ISliceSegment[] = [];
  contours.forEach((c) => {
    for (let i = 0; i < c.points.length - 1; i++) {
      contourSegments.push({
        p1: c.points[i],
        p2: c.points[i + 1],
        length: Math.hypot(c.points[i + 1].x - c.points[i].x, c.points[i + 1].z - c.points[i].z),
      });
    }
  });

  // Hướng đan chéo infill theo góc 45 độ hoặc theo pattern
  const isCross = profile.infillType === 'grid' || profile.infillType === 'triangles';
  const angles = isCross ? [Math.PI / 4, -Math.PI / 4] : [Math.PI / 4];

  angles.forEach((angle) => {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const midX = (bbox.minX + bbox.maxX) / 2;
    const midZ = (bbox.minZ + bbox.maxZ) / 2;

    const perpCos = -sinA;
    const perpSin = cosA;

    for (let offset = -maxSpan * 0.9; offset <= maxSpan * 0.9; offset += spacing) {
      // Tia song song: bắt đầu từ điểm P0 chạy theo vector (cosA, sinA)
      const rayOriginX = midX + perpCos * offset;
      const rayOriginZ = midZ + perpSin * offset;
      const rayDirX = cosA;
      const rayDirZ = sinA;

      // Tìm tất cả các giao điểm của tia này với contourSegments
      const hitDistances: number[] = [];

      for (const seg of contourSegments) {
        const hit = intersectRayWithSegment(
          rayOriginX,
          rayOriginZ,
          rayDirX,
          rayDirZ,
          seg.p1.x,
          seg.p1.z,
          seg.p2.x,
          seg.p2.z
        );
        if (hit !== null) {
          hitDistances.push(hit);
        }
      }

      // Sắp xếp các điểm giao nhau từ nhỏ đến lớn
      hitDistances.sort((a, b) => a - b);

      // Nhóm theo từng cặp chẵn-lẻ (chẵn = đi vào vật thể, lẻ = đi ra khỏi vật thể)
      for (let h = 0; h < hitDistances.length - 1; h += 2) {
        const d1 = hitDistances[h];
        const d2 = hitDistances[h + 1];
        if (d2 - d1 > 0.4) {
          // Lùi nhẹ 0.4mm vào trong để không đè lên vách Outer Perimeter
          const inset = 0.35;
          const pStart: ISlicePoint = {
            x: rayOriginX + rayDirX * (d1 + inset),
            z: rayOriginZ + rayDirZ * (d1 + inset),
          };
          const pEnd: ISlicePoint = {
            x: rayOriginX + rayDirX * (d2 - inset),
            z: rayOriginZ + rayDirZ * (d2 - inset),
          };
          resultLines.push([pStart, pEnd]);
        }
      }
    }
  });

  // Tính tổng độ dài và danh sách độ dài tích lũy để đầu in di chuyển mượt mà
  let totalLength = 0;
  const cumulativeLengths: number[] = [0];
  resultLines.forEach(([p1, p2]) => {
    const l = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    totalLength += l;
    cumulativeLengths.push(totalLength);
  });

  return {
    lines: resultLines,
    totalLength,
    cumulativeLengths,
  };
}

/**
 * Giao điểm giữa tia và đoạn thẳng
 */
function intersectRayWithSegment(
  rx: number,
  rz: number,
  rdx: number,
  rdz: number,
  sx1: number,
  sz1: number,
  sx2: number,
  sz2: number
): number | null {
  const sdx = sx2 - sx1;
  const sdz = sz2 - sz1;
  const denominator = rdx * sdz - rdz * sdx;
  if (Math.abs(denominator) < 1e-8) return null;

  const dx = sx1 - rx;
  const dz = sz1 - rz;
  const t = (dx * sdz - dz * sdx) / denominator;
  const u = (dx * rdz - dz * rdx) / denominator;

  if (u >= 0 && u <= 1.0) {
    return t;
  }
  return null;
}

/**
 * Tính toán tọa độ đầu in thực tế chạy chuẩn xác theo biên dạng mô hình 3D
 */
export function getRealToolheadPositionOnSlice(
  slice: ILayerSliceData,
  layerProgress: number,
  profile: ISimulationProfile,
  fallbackCenter: [number, number] = [0, 0]
): {
  position: [number, number, number];
  toolpathType: 'perimeter' | 'infill' | 'support' | 'travel' | 'brim';
} {
  const heightY = slice.heightY;

  // Nếu lớp rỗng (không có hình học tại cao độ này)
  if (slice.contours.length === 0) {
    return {
      position: [fallbackCenter[0], heightY, fallbackCenter[1]],
      toolpathType: 'travel',
    };
  }

  // Phân chia chu trình in trong 1 lớp (Chuẩn công nghiệp Slicer):
  // 0.00 -> 0.55: In các đường vách Perimeter theo đúng chu vi mô hình
  // 0.55 -> 0.90: In các đường ruột Infill zíc zắc bên trong lòng vật thể
  // 0.90 -> 1.00: Di chuyển nhanh Travel sang điểm bắt đầu lớp tiếp theo
  if (layerProgress < 0.55) {
    // 1. Chạy bám theo viền Perimeter thực tế của mô hình
    const perimeterFrac = layerProgress / 0.55;
    const targetDist = perimeterFrac * slice.totalPerimeterLength;

    let accumulated = 0;
    for (const loop of slice.contours) {
      if (accumulated + loop.totalLength >= targetDist || loop === slice.contours[slice.contours.length - 1]) {
        const loopDist = Math.max(0, targetDist - accumulated);
        // Tìm đoạn thẳng trong loop
        for (let i = 0; i < loop.points.length - 1; i++) {
          const dStart = loop.cumulativeLengths[i];
          const dEnd = loop.cumulativeLengths[i + 1];
          if (loopDist >= dStart && loopDist <= dEnd) {
            const segLen = dEnd - dStart;
            const alpha = segLen > 0 ? (loopDist - dStart) / segLen : 0;
            const pt0 = loop.points[i];
            const pt1 = loop.points[i + 1];
            return {
              position: [pt0.x + alpha * (pt1.x - pt0.x), heightY, pt0.z + alpha * (pt1.z - pt0.z)],
              toolpathType: 'perimeter',
            };
          }
        }
        const lastPt = loop.points[loop.points.length - 1];
        return {
          position: [lastPt.x, heightY, lastPt.z],
          toolpathType: 'perimeter',
        };
      }
      accumulated += loop.totalLength;
    }
  } else if (layerProgress < 0.90 && slice.infill.lines.length > 0) {
    // 2. Chạy đùn ruột Infill zíc zắc thực sự bên trong mô hình
    const infillFrac = (layerProgress - 0.55) / 0.35;
    const targetDist = infillFrac * slice.infill.totalLength;

    for (let i = 0; i < slice.infill.lines.length; i++) {
      const dStart = slice.infill.cumulativeLengths[i];
      const dEnd = slice.infill.cumulativeLengths[i + 1];
      if (targetDist >= dStart && targetDist <= dEnd) {
        const segLen = dEnd - dStart;
        const alpha = segLen > 0 ? (targetDist - dStart) / segLen : 0;
        const [p1, p2] = slice.infill.lines[i];
        return {
          position: [p1.x + alpha * (p2.x - p1.x), heightY, p1.z + alpha * (p2.z - p1.z)],
          toolpathType: 'infill',
        };
      }
    }
  }

  // 3. Travel nhanh
  const firstPoint = slice.contours[0]?.points[0] || { x: fallbackCenter[0], z: fallbackCenter[1] };
  return {
    position: [firstPoint.x, heightY, firstPoint.z],
    toolpathType: 'travel',
  };
}

/**
 * Sinh các Three.js Mesh / Line hiển thị đường in của lớp hiện tại khớp 100% hình học thực tế
 */
export function createSliceToolpathMeshes(
  slice: ILayerSliceData,
  profile: ISimulationProfile,
  renderMode: SlicerRenderMode
): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];
  const heightY = slice.heightY + 0.12; // Nhấc nhẹ trên mặt cắt để tránh z-fighting

  const outerColor = renderMode === 'features' ? 0xff6b00 : 0x00ffcc;
  const innerColor = renderMode === 'features' ? 0xfacc15 : 0x22d3ee;
  const infillColor = renderMode === 'features' ? 0xec4899 : 0xf59e0b;

  // 1. Đường viền Vách Ngoài (Outer Wall) khớp từng đỉnh tam giác thực
  const perimeterPoints: THREE.Vector3[] = [];
  slice.contours.forEach((loop) => {
    for (let i = 0; i < loop.points.length - 1; i++) {
      perimeterPoints.push(
        new THREE.Vector3(loop.points[i].x, heightY, loop.points[i].z),
        new THREE.Vector3(loop.points[i + 1].x, heightY, loop.points[i + 1].z)
      );
    }
  });

  if (perimeterPoints.length > 0) {
    const geom = new THREE.BufferGeometry().setFromPoints(perimeterPoints);
    const mat = new THREE.LineSegments(
      geom,
      new THREE.LineBasicMaterial({
        color: outerColor,
        linewidth: 2,
      })
    );
    objects.push(mat);
  }

  // 2. Đường viền Vách Trong (Inner Wall) thu nhẹ vào bên trong
  if (profile.wallLoops > 1 && slice.contours.length > 0) {
    const innerPoints: THREE.Vector3[] = [];
    slice.contours.forEach((loop) => {
      // Co cụm nhẹ về tâm của vòng
      const cX = (loop.bbox.minX + loop.bbox.maxX) / 2;
      const cZ = (loop.bbox.minZ + loop.bbox.maxZ) / 2;
      for (let i = 0; i < loop.points.length - 1; i++) {
        const p1 = loop.points[i];
        const p2 = loop.points[i + 1];
        const scaleIn = 0.96; // Thu nhỏ nhẹ 4% vào trong tạo vách thứ 2
        innerPoints.push(
          new THREE.Vector3(cX + (p1.x - cX) * scaleIn, heightY, cZ + (p1.z - cZ) * scaleIn),
          new THREE.Vector3(cX + (p2.x - cX) * scaleIn, heightY, cZ + (p2.z - cZ) * scaleIn)
        );
      }
    });

    if (innerPoints.length > 0) {
      const innerGeom = new THREE.BufferGeometry().setFromPoints(innerPoints);
      const innerMat = new THREE.LineSegments(
        innerGeom,
        new THREE.LineBasicMaterial({
          color: innerColor,
          opacity: 0.8,
          transparent: true,
        })
      );
      objects.push(innerMat);
    }
  }

  // 3. Đường Ruột Infill thực tế
  if (slice.infill.lines.length > 0) {
    const infillPoints: THREE.Vector3[] = [];
    slice.infill.lines.forEach(([p1, p2]) => {
      infillPoints.push(
        new THREE.Vector3(p1.x, heightY, p1.z),
        new THREE.Vector3(p2.x, heightY, p2.z)
      );
    });

    const infillGeom = new THREE.BufferGeometry().setFromPoints(infillPoints);
    const infillMat = new THREE.LineSegments(
      infillGeom,
      new THREE.LineBasicMaterial({
        color: infillColor,
        opacity: 0.85,
        transparent: true,
      })
    );
    objects.push(infillMat);
  }

  return objects;
}

/**
 * Quản lý Bộ Nhớ Đệm (Layer Slice Cache) giúp phản hồi tức thời 60 FPS
 */
class LayerSliceCacheManager {
  private cache = new Map<string, ILayerSliceData>();
  private currentGeomId = '';

  public getSlice(
    geometry: THREE.BufferGeometry,
    layerIndex: number,
    heightY: number,
    profile: ISimulationProfile
  ): ILayerSliceData {
    const geomId = geometry.uuid || 'default_geom';
    if (this.currentGeomId !== geomId) {
      this.cache.clear();
      this.currentGeomId = geomId;
    }

    // Key dựa trên layerIndex và profile parameters để cache 100% ổn định trong suốt quá trình in của layer đó
    const key = `${layerIndex}_${profile.infillDensity}_${profile.infillType}_${profile.wallLoops}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const slice = sliceGeometryAtHeight(geometry, heightY, profile);
    this.cache.set(key, slice);
    return slice;
  }

  public clear() {
    this.cache.clear();
  }
}

export const layerSliceCache = new LayerSliceCacheManager();

function createEmptySlice(heightY: number): ILayerSliceData {
  return {
    heightY,
    segments: [],
    contours: [],
    totalPerimeterLength: 0,
    infill: { lines: [], totalLength: 0, cumulativeLengths: [0] },
    bbox: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
  };
}

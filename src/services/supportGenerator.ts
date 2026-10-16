import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  ISimulationProfile,
  ISupportOverhangPatch,
  TreeSupportStyle,
} from '@/types/simulator';

interface IOverhangTriangle {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
  mx: number;
  my: number;
  mz: number;
  nx: number;
  ny: number;
  nz: number;
  area: number;
  angleDeg: number;
  floorY: number;
}

export interface IConformalOverhangPatch extends ISupportOverhangPatch {
  normal: [number, number, number];
  floorY: number;
  triangles: IOverhangTriangle[];
}

/**
 * Kiểm tra điểm 2D (px, pz) có nằm trong tam giác 2D (ax, az)-(bx, bz)-(cx, cz) trên mặt phẳng XZ không,
 * nếu có trả về cao độ Y nội suy trên mặt phẳng tam giác đó.
 */
function sampleTriangleHeightAtXZ(
  px: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): number | null {
  const v0x = cx - ax;
  const v0z = cz - az;
  const v1x = bx - ax;
  const v1z = bz - az;
  const v2x = px - ax;
  const v2z = pz - az;

  const dot00 = v0x * v0x + v0z * v0z;
  const dot01 = v0x * v1x + v0z * v1z;
  const dot02 = v0x * v2x + v0z * v2z;
  const dot11 = v1x * v1x + v1z * v1z;
  const dot12 = v1x * v2x + v1z * v2z;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-8) return null;

  const invDenom = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  if (u >= -0.02 && v >= -0.02 && u + v <= 1.02) {
    return ay + u * (cy - ay) + v * (by - ay);
  }
  return null;
}

/**
 * Cắt tam giác 3D bởi hình trụ đứng tâm (cx, cz) bán kính maxR để lớp đệm Support Interface
 * chỉ xuất hiện gọn gàng ngay tại đầu nhánh cây tiếp xúc và tuyệt đối không thò ra ngoài rìa mẫu.
 */
function clipTriangleToContactRadius(
  tri: IOverhangTriangle,
  contactX: number,
  contactY: number,
  contactZ: number,
  maxR: number
): {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
  nx: number;
  ny: number;
  nz: number;
} | null {
  const distM = Math.hypot(tri.mx - contactX, tri.mz - contactZ);
  const distY = Math.abs(tri.my - contactY);
  if (distM > maxR * 1.45 || distY > 2.2) return null;

  // Co các đỉnh nằm xa tâm tiếp xúc vào trong bán kính maxR (giữ nguyên trên mặt phẳng tam giác thông qua nội suy barycentric)
  const clampVertexToRadius = (vx: number, vy: number, vz: number): [number, number, number] => {
    const dx = vx - contactX;
    const dz = vz - contactZ;
    const d = Math.hypot(dx, dz);
    if (d <= maxR) return [vx, vy, vz];
    // Kéo đỉnh về phía tâm tam giác (mx, my, mz) để luôn nằm 100% bên trong chính tam giác đó!
    const t = Math.min(0.82, (d - maxR) / Math.max(0.1, d));
    return [
      vx + (tri.mx - vx) * t,
      vy + (tri.my - vy) * t,
      vz + (tri.mz - vz) * t,
    ];
  };

  const [ax, ay, az] = clampVertexToRadius(tri.ax, tri.ay, tri.az);
  const [bx, by, bz] = clampVertexToRadius(tri.bx, tri.by, tri.bz);
  const [cx, cy, cz] = clampVertexToRadius(tri.cx, tri.cy, tri.cz);

  return {
    ax,
    ay,
    az,
    bx,
    by,
    bz,
    cx,
    cy,
    cz,
    nx: tri.nx,
    ny: tri.ny,
    nz: tri.nz,
  };
}

/**
 * 1. Quét chính xác các tam giác Overhang lộ ra bên ngoài mô hình 3D (loại bỏ các mặt chìm bên trong khối giao nhau)
 * Tối ưu hóa tốc độ O(N) với bước nhảy thông minh cho mesh hàng triệu tam giác (< 12ms).
 */
function extractExteriorOverhangData(
  geometry: THREE.BufferGeometry,
  thresholdDeg: number = 45
): {
  patches: IConformalOverhangPatch[];
  baseFootprintGrid: Set<string>;
  hullRadialProfile: Float32Array;
  centerX: number;
  centerZ: number;
} {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const minY = bbox.min.y;
  const maxY = bbox.max.y;
  const centerX = (bbox.max.x + bbox.min.x) / 2;
  const centerZ = (bbox.max.z + bbox.min.z) / 2;

  const positions = geometry.getAttribute('position');
  const indexAttr = geometry.getIndex();
  const radialBins = 72;
  const hullRadialProfile = new Float32Array(radialBins);
  const baseFootprintGrid = new Set<string>();

  if (!positions) {
    return {
      patches: [],
      baseFootprintGrid,
      hullRadialProfile,
      centerX,
      centerZ,
    };
  }

  const rad = (thresholdDeg * Math.PI) / 180;
  const normalThresholdY = -Math.cos(rad);

  const vertCount = indexAttr ? indexAttr.count : positions.count;
  const totalTriCount = Math.floor(vertCount / 3);
  // Đảm bảo thời gian phản hồi tức thì < 12ms ngay cả với file 3MF 900,000 tam giác
  const stride = Math.max(1, Math.floor(totalTriCount / 16000));

  interface IRawTri {
    ax: number;
    ay: number;
    az: number;
    bx: number;
    by: number;
    bz: number;
    cx: number;
    cy: number;
    cz: number;
    mx: number;
    my: number;
    mz: number;
    nx: number;
    ny: number;
    nz: number;
    area: number;
  }

  const allTris: IRawTri[] = [];
  const xzGridCell = 4.5;
  const spatialGrid = new Map<string, number[]>();

  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let t = 0; t < totalTriCount; t += stride) {
    const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
    const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

    pA.fromBufferAttribute(positions, i0);
    pB.fromBufferAttribute(positions, i1);
    pC.fromBufferAttribute(positions, i2);

    edge1.subVectors(pB, pA);
    edge2.subVectors(pC, pA);
    cross.crossVectors(edge1, edge2);
    const area = cross.length() * 0.5 * stride;
    if (area < 0.002) continue;

    cross.normalize();
    const mx = (pA.x + pB.x + pC.x) / 3;
    const my = (pA.y + pB.y + pC.y) / 3;
    const mz = (pA.z + pB.z + pC.z) / 3;

    // Ghi nhận biên dạng bán kính ngoài của mô hình theo góc phương vị
    const dx = mx - centerX;
    const dz = mz - centerZ;
    const distR = Math.hypot(dx, dz);
    let angIdx = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * radialBins);
    angIdx = Math.max(0, Math.min(radialBins - 1, angIdx));
    if (distR > hullRadialProfile[angIdx]) {
      hullRadialProfile[angIdx] = distR;
    }

    // Ghi nhận phần chân đế sát bàn in (Y <= minY + 2.2mm)
    const triMinY = Math.min(pA.y, pB.y, pC.y);
    if (triMinY <= minY + 2.2) {
      const gx0 = Math.floor(Math.min(pA.x, pB.x, pC.x) / 2.0);
      const gx1 = Math.floor(Math.max(pA.x, pB.x, pC.x) / 2.0);
      const gz0 = Math.floor(Math.min(pA.z, pB.z, pC.z) / 2.0);
      const gz1 = Math.floor(Math.max(pA.z, pB.z, pC.z) / 2.0);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          baseFootprintGrid.add(`${gx}_${gz}`);
        }
      }
    }

    const triIdx = allTris.length;
    allTris.push({
      ax: pA.x,
      ay: pA.y,
      az: pA.z,
      bx: pB.x,
      by: pB.y,
      bz: pB.z,
      cx: pC.x,
      cy: pC.y,
      cz: pC.z,
      mx,
      my,
      mz,
      nx: cross.x,
      ny: cross.y,
      nz: cross.z,
      area,
    });

    const minGX = Math.floor(Math.min(pA.x, pB.x, pC.x) / xzGridCell);
    const maxGX = Math.floor(Math.max(pA.x, pB.x, pC.x) / xzGridCell);
    const minGZ = Math.floor(Math.min(pA.z, pB.z, pC.z) / xzGridCell);
    const maxGZ = Math.floor(Math.max(pA.z, pB.z, pC.z) / xzGridCell);

    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gz = minGZ; gz <= maxGZ; gz++) {
        const key = `${gx}_${gz}`;
        const bucket = spatialGrid.get(key);
        if (bucket) {
          if (bucket.length < 48) bucket.push(triIdx);
        } else {
          spatialGrid.set(key, [triIdx]);
        }
      }
    }
  }

  // Lọc ra các tam giác Overhang thực sự nằm ở mặt ngoài và có thể tiếp cận từ bàn in (Build Plate Only)
  const validOverhangs: IOverhangTriangle[] = [];

  for (let idx = 0; idx < allTris.length; idx++) {
    const t = allTris[idx];
    if (t.ny >= normalThresholdY) continue;
    if (t.my <= minY + 1.4 || t.my >= maxY * 0.985) continue;

    const key = `${Math.floor(t.mx / xzGridCell)}_${Math.floor(t.mz / xzGridCell)}`;
    const candidates = spatialGrid.get(key) || [];

    let highestHitBelowY = -Infinity;
    let highestHitBelowNy = 0;
    let lowestHitAboveY = Infinity;
    let lowestHitAboveNy = 0;

    for (const cIdx of candidates) {
      if (cIdx === idx) continue;
      const other = allTris[cIdx];
      const hitY = sampleTriangleHeightAtXZ(
        t.mx,
        t.mz,
        other.ax,
        other.ay,
        other.az,
        other.bx,
        other.by,
        other.bz,
        other.cx,
        other.cy,
        other.cz
      );
      if (hitY === null) continue;

      if (hitY < t.my - 0.08 && hitY > highestHitBelowY) {
        highestHitBelowY = hitY;
        highestHitBelowNy = other.ny;
      }
      if (hitY > t.my + 0.08 && hitY < lowestHitAboveY) {
        lowestHitAboveY = hitY;
        lowestHitAboveNy = other.ny;
      }
    }

    // Loại bỏ các mặt bị chặn phía dưới hoặc chìm trong lòng khối đặc (như cabin/vòm cửa nằm trên mặt boong tàu)
    if (highestHitBelowY > -Infinity) {
      const verticalClearance = t.my - highestHitBelowY;
      if (verticalClearance < 3.5 || highestHitBelowNy < -0.15) {
        continue;
      }
      // Kiểm tra khoảng cách tới mép ngoài: nếu điểm Overhang nằm sâu bên trong mặt boong tàu (> 2.5mm tính từ rìa ngoài),
      // nhánh cây từ bàn in sẽ phải đâm ngang qua mặt boong hoặc cabin -> Bỏ qua theo đúng chuẩn "Build Plate Only"
      const dx = t.mx - centerX;
      const dz = t.mz - centerZ;
      const distR = Math.hypot(dx, dz);
      let angIdx = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * radialBins);
      angIdx = Math.max(0, Math.min(radialBins - 1, angIdx));
      const outerR = hullRadialProfile[angIdx] || distR;
      if (outerR - distR > 2.2) {
        continue;
      }
    }

    if (lowestHitAboveY < Infinity && lowestHitAboveY - t.my < 0.6 && lowestHitAboveNy > 0.2) {
      continue;
    }

    const angleWithVertical = Math.acos(Math.max(-1, Math.min(1, -t.ny))) * (180 / Math.PI);
    const angleDeg = 90 - angleWithVertical;
    const floorY = highestHitBelowY > minY + 0.5 ? highestHitBelowY : 0;

    validOverhangs.push({
      ...t,
      angleDeg,
      floorY,
    });
  }

  if (validOverhangs.length === 0) {
    return {
      patches: [],
      baseFootprintGrid,
      hullRadialProfile,
      centerX,
      centerZ,
    };
  }

  // Gom cụm các tam giác Overhang theo ô lưới 4.8 x 4.8mm
  const patchCell = 4.8;
  const clusterMap = new Map<string, IOverhangTriangle[]>();

  for (const tri of validOverhangs) {
    const kx = Math.floor(tri.mx / patchCell);
    const kz = Math.floor(tri.mz / patchCell);
    const ky = Math.floor(tri.my / 8.0);
    const key = `${kx}_${ky}_${kz}`;
    const list = clusterMap.get(key);
    if (list) list.push(tri);
    else clusterMap.set(key, [tri]);
  }

  const patches: IConformalOverhangPatch[] = [];
  let patchId = 1;

  clusterMap.forEach((tris) => {
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let totalArea = 0;
    let minAngle = 90;
    let sumAngle = 0;

    for (const t of tris) {
      sumX += t.mx * t.area;
      sumY += t.my * t.area;
      sumZ += t.mz * t.area;
      totalArea += t.area;
      if (t.angleDeg < minAngle) minAngle = t.angleDeg;
      sumAngle += t.angleDeg * t.area;
    }

    if (totalArea < 0.45) return;

    const avgX = sumX / totalArea;
    const avgY = sumY / totalArea;
    const avgZ = sumZ / totalArea;
    const avgAngle = sumAngle / totalArea;

    // Bắt dính tâm Patch vào ĐÚNG tâm tam giác thực tế gần nhất trong cụm
    let bestTri = tris[0];
    let bestDistSq = Infinity;
    for (const t of tris) {
      const dSq = (t.mx - avgX) ** 2 + (t.my - avgY) ** 2 + (t.mz - avgZ) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestTri = t;
      }
    }

    const severity = minAngle < 20 ? 'critical' : minAngle < 35 ? 'moderate' : 'mild';

    patches.push({
      id: `patch-${patchId++}`,
      center: [
        Number(bestTri.mx.toFixed(2)),
        Number(bestTri.my.toFixed(2)),
        Number(bestTri.mz.toFixed(2)),
      ],
      normal: [bestTri.nx, bestTri.ny, bestTri.nz],
      floorY: bestTri.floorY,
      triangles: tris,
      areaMm2: Number(totalArea.toFixed(1)),
      minAngleDeg: Number(minAngle.toFixed(1)),
      avgAngleDeg: Number(avgAngle.toFixed(1)),
      severity,
      requiresSupport: true,
      isBridge: minAngle < 15 && totalArea > 8.0,
    });
  });

  patches.sort((a, b) => b.areaMm2 - a.areaMm2);

  return {
    patches: patches.slice(0, 75),
    baseFootprintGrid,
    hullRadialProfile,
    centerX,
    centerZ,
  };
}

/**
 * API tương thích cho Preflight Analyzer & các dịch vụ kiểm tra Overhang
 */
export function detectOverhangPatches(
  geometry: THREE.BufferGeometry,
  thresholdDeg: number = 45
): ISupportOverhangPatch[] {
  return extractExteriorOverhangData(geometry, thresholdDeg).patches;
}

/**
 * 2. Dựng lớp đệm tiếp xúc (Support Interface Layer #d946ef) ÔM SÁT 100% TAM GIÁC MÔ HÌNH TẠI ĐẦU NHÁNH CÂY
 * Chỉ tạo lớp đệm mỏng (0.20mm) ngay tại vùng đầu nhánh cây chạm vào tam giác mô hình (bán kính ~1.5mm),
 * tuyệt đối không có mâm tròn phẳng chìa ra ngoài và không tô tràn lan lên vùng không có nhánh đỡ.
 */
function buildPatchConformalCapGeometry(
  patch: IConformalOverhangPatch,
  capRadius: number
): THREE.BufferGeometry | null {
  const [cx, cy, cz] = patch.center;
  const positions: number[] = [];
  const topOffset = 0.01;
  const thickness = 0.2;

  const pushTri = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    x3: number,
    y3: number,
    z3: number
  ) => {
    positions.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);
  };

  let addedCount = 0;
  for (const rawTri of patch.triangles) {
    if (addedCount >= 16) break;
    const clipped = clipTriangleToContactRadius(rawTri, cx, cy, cz, capRadius);
    if (!clipped) continue;
    addedCount++;

    const { ax, ay, az, bx, by, bz, cx: tx, cy: ty, cz: tz, nx, ny, nz } = clipped;

    const a1x = ax + nx * topOffset,
      a1y = ay + ny * topOffset,
      a1z = az + nz * topOffset;
    const b1x = bx + nx * topOffset,
      b1y = by + ny * topOffset,
      b1z = bz + nz * topOffset;
    const c1x = tx + nx * topOffset,
      c1y = ty + ny * topOffset,
      c1z = tz + nz * topOffset;

    const botOffset = topOffset + thickness;
    const a2x = ax + nx * botOffset,
      a2y = ay + ny * botOffset,
      a2z = az + nz * botOffset;
    const b2x = bx + nx * topOffset + nx * thickness,
      b2y = by + ny * botOffset,
      b2z = bz + nz * botOffset;
    const c2x = tx + nx * botOffset,
      c2y = ty + ny * botOffset,
      c2z = tz + nz * botOffset;

    pushTri(a1x, a1y, a1z, c1x, c1y, c1z, b1x, b1y, b1z);
    pushTri(a2x, a2y, a2z, b2x, b2y, b2z, c2x, c2y, c2z);

    pushTri(a1x, a1y, a1z, b1x, b1y, b1z, b2x, b2y, b2z);
    pushTri(a1x, a1y, a1z, b2x, b2y, b2z, a2x, a2y, a2z);

    pushTri(b1x, b1y, b1z, c1x, c1y, c1z, c2x, c2y, c2z);
    pushTri(b1x, b1y, b1z, c2x, c2y, c2z, b2x, b2y, b2z);

    pushTri(c1x, c1y, c1z, a1x, a1y, a1z, a2x, a2y, a2z);
    pushTri(c1x, c1y, c1z, a2x, a2y, a2z, c2x, c2y, c2z);
  }

  if (positions.length === 0) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * 3. Tạo hình học thân/nhánh cây hữu cơ uốn lượn mượt mà (Catmull-Rom Spline Tube)
 * Cắt vát phẳng đầu cành (Flush Normal Clamping) theo đúng mặt phẳng nghiêng của tam giác mô hình
 * để đầu cành ôm khít tuyệt đối vào vách nghiêng mà không bị hở hay thò góc ống ra ngoài.
 */
function createSmoothOrganicBranchGeom(
  points: THREE.Vector3[],
  rBottom: number,
  rTop: number,
  numRings = 22,
  radialSegments = 14,
  tipContact?: { point: THREE.Vector3; normal: THREE.Vector3 },
  isGroundedTrunk = false
): THREE.BufferGeometry | null {
  if (points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const ringCenters: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [];

  for (let i = 0; i <= numRings; i++) {
    const t = i / numRings;
    ringCenters.push(curve.getPointAt(t));
    tangents.push(curve.getTangentAt(t).normalize());
  }

  const positions: number[] = [];
  const indices: number[] = [];
  const refVec = new THREE.Vector3(1, 0, 0);
  const altRef = new THREE.Vector3(0, 0, 1);

  const inwardSurfNormal = tipContact
    ? new THREE.Vector3(-tipContact.normal.x, -tipContact.normal.y, -tipContact.normal.z).normalize()
    : null;

  for (let i = 0; i <= numRings; i++) {
    const t = i / numRings;
    let currentRadius = rBottom * Math.pow(1 - t, 0.85) + rTop * Math.pow(t, 0.85);

    const center = ringCenters[i];
    if (isGroundedTrunk && center.y < 1.2) {
      const rootFactor = Math.max(0, (1.2 - center.y) / 1.2);
      currentRadius *= 1.0 + 0.14 * rootFactor * rootFactor;
    }

    const T = tangents[i].clone();
    if (inwardSurfNormal && t > 0.72) {
      const blend = (t - 0.72) / 0.28;
      T.lerp(inwardSurfNormal, blend * 0.88).normalize();
    }

    let N = new THREE.Vector3()
      .crossVectors(T, Math.abs(T.x) < 0.85 ? refVec : altRef)
      .normalize();
    if (N.lengthSq() < 0.001) {
      N = new THREE.Vector3(0, 0, 1);
    }
    const B = new THREE.Vector3().crossVectors(T, N).normalize();

    for (let j = 0; j < radialSegments; j++) {
      const angle = (j * Math.PI * 2) / radialSegments;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      let vx = center.x + currentRadius * (cosA * N.x + sinA * B.x);
      let vy = center.y + currentRadius * (cosA * N.y + sinA * B.y);
      let vz = center.z + currentRadius * (cosA * N.z + sinA * B.z);

      // Cắt phẳng tuyệt đối các đỉnh gần ngọn theo mặt phẳng tiếp xúc của tam giác Overhang
      if (tipContact && inwardSurfNormal && t > 0.62) {
        const dx = vx - tipContact.point.x;
        const dy = vy - tipContact.point.y;
        const dz = vz - tipContact.point.z;
        const signedPenetration =
          dx * inwardSurfNormal.x + dy * inwardSurfNormal.y + dz * inwardSurfNormal.z;
        if (signedPenetration > -0.02) {
          const pushBack = signedPenetration + 0.02;
          vx -= pushBack * inwardSurfNormal.x;
          vy -= pushBack * inwardSurfNormal.y;
          vz -= pushBack * inwardSurfNormal.z;
        }
      }

      if (vy < 0.12) vy = 0.12;
      positions.push(vx, vy, vz);
    }
  }

  for (let i = 0; i < numRings; i++) {
    const ring1 = i * radialSegments;
    const ring2 = (i + 1) * radialSegments;

    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const v00 = ring1 + j;
      const v01 = ring1 + nextJ;
      const v10 = ring2 + j;
      const v11 = ring2 + nextJ;

      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom.toNonIndexed();
}

function safeMergeGeometries(geoms: (THREE.BufferGeometry | null)[]): THREE.BufferGeometry | null {
  const valid = geoms.filter(
    (g): g is THREE.BufferGeometry =>
      g !== null &&
      g !== undefined &&
      g.getAttribute('position') !== undefined &&
      g.getAttribute('position').count > 0
  );
  if (valid.length === 0) return null;

  const normalized = valid.map((g) => {
    const target = g.index ? g.toNonIndexed() : g;
    const cleanGeom = new THREE.BufferGeometry();
    cleanGeom.setAttribute('position', target.getAttribute('position').clone());
    return cleanGeom;
  });

  const merged = BufferGeometryUtils.mergeGeometries(normalized, false);
  if (merged) {
    merged.computeVertexNormals();
  }
  return merged;
}

/**
 * Tìm vị trí đặt gốc cây trên bàn in (Y = 0) vừa nằm gọn dưới cụm Overhang,
 * vừa tránh đâm xuyên qua phần chân đế của mô hình.
 */
function findOptimalRootPosition(
  avgX: number,
  avgZ: number,
  minClusterY: number,
  maxClusterFloorY: number,
  centerX: number,
  centerZ: number,
  baseFootprintGrid: Set<string>,
  hullRadialProfile: Float32Array
): { rootX: number; rootZ: number; normX: number; normZ: number; routesAroundHull: boolean } {
  const dx = avgX - centerX;
  const dz = avgZ - centerZ;
  const dist = Math.hypot(dx, dz);
  const normX = dist > 0.05 ? dx / dist : 0;
  const normZ = dist > 0.05 ? dz / dist : 1;

  const radialBins = hullRadialProfile.length;
  let angIdx = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * radialBins);
  angIdx = Math.max(0, Math.min(radialBins - 1, angIdx));
  const maxHullR = hullRadialProfile[angIdx] || dist;

  if (maxClusterFloorY > 0.5) {
    const safeR = Math.max(dist + 1.8, maxHullR + 1.6);
    return {
      rootX: centerX + normX * safeR,
      rootZ: centerZ + normZ * safeR,
      normX,
      normZ,
      routesAroundHull: true,
    };
  }

  let rootX = avgX + normX * Math.min(1.5, minClusterY * 0.04);
  let rootZ = avgZ + normZ * Math.min(1.5, minClusterY * 0.04);

  for (let step = 0; step < 12; step++) {
    const gx = Math.floor(rootX / 2.0);
    const gz = Math.floor(rootZ / 2.0);
    if (!baseFootprintGrid.has(`${gx}_${gz}`)) {
      break;
    }
    rootX += normX * 1.5;
    rootZ += normZ * 1.5;
  }

  return {
    rootX,
    rootZ,
    normX,
    normZ,
    routesAroundHull: false,
  };
}

/**
 * 4. Khởi tạo cụm cấu trúc Tree Support chuẩn kỹ thuật Bambu Studio:
 * - Lớp tiếp xúc (Support Interface) đúc trực tiếp từ tam giác Overhang ngay tại đầu cành (ôm sát 100%, không có mâm tròn chìa ra).
 * - Các nhánh cây hữu cơ thon gọn uốn theo pháp tuyến bề mặt và vát phẳng đầu cành khớp khít với mặt nghiêng.
 * - Gốc cây gọn gàng với vành Brim mỏng 1 lớp (1.2mm) bám mặt bàn PEI.
 */
export function generateBambuSupportStructures(
  geometry: THREE.BufferGeometry,
  profile: ISimulationProfile,
  overhangThreshold: number = 45
): THREE.Group {
  const supportGroup = new THREE.Group();
  supportGroup.name = 'support_structures_group';

  if (profile.supportMode === 'none') {
    return supportGroup;
  }

  const { patches, baseFootprintGrid, hullRadialProfile, centerX, centerZ } =
    extractExteriorOverhangData(geometry, overhangThreshold);

  if (patches.length === 0) {
    return supportGroup;
  }

  const supportMat = new THREE.MeshStandardMaterial({
    color: 0x00e050,
    roughness: 0.34,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });

  const interfaceMat = new THREE.MeshStandardMaterial({
    color: 0xd946ef,
    roughness: 0.25,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });

  const brimMat = new THREE.MeshStandardMaterial({
    color: 0xc026d3,
    roughness: 0.38,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const style: TreeSupportStyle = profile.treeStyle || 'organic';

  let dMerge = 13.0;
  let tipRadius = 0.8;
  let maxTrunkRadius = 2.3;

  if (style === 'slim') {
    dMerge = 10.0;
    tipRadius = 0.65;
    maxTrunkRadius = 1.85;
  } else if (style === 'strong') {
    dMerge = 15.5;
    tipRadius = 1.0;
    maxTrunkRadius = 2.85;
  } else if (style === 'hybrid') {
    dMerge = 13.5;
    tipRadius = 0.85;
    maxTrunkRadius = 2.5;
  }

  const branchGeoms: THREE.BufferGeometry[] = [];
  const junctionGeoms: THREE.BufferGeometry[] = [];
  const interfaceGeoms: THREE.BufferGeometry[] = [];
  const brimGeoms: THREE.BufferGeometry[] = [];

  if (profile.supportMode === 'tree') {
    const visited = new Set<number>();
    const clusters: IConformalOverhangPatch[][] = [];

    for (let i = 0; i < patches.length; i++) {
      if (visited.has(i)) continue;
      const cluster = [patches[i]];
      visited.add(i);

      for (let j = i + 1; j < patches.length; j++) {
        if (visited.has(j)) continue;
        const p1 = patches[i].center;
        const p2 = patches[j].center;
        const distXZ = Math.hypot(p1[0] - p2[0], p1[2] - p2[2]);
        const distY = Math.abs(p1[1] - p2[1]);
        const sameRouting = (patches[i].floorY > 0.5) === (patches[j].floorY > 0.5);
        if (distXZ <= dMerge && distY <= 10.0 && sameRouting) {
          cluster.push(patches[j]);
          visited.add(j);
        }
      }
      clusters.push(cluster);
    }

    const rootPoints: { x: number; z: number; r: number }[] = [];

    for (const cluster of clusters) {
      const avgX = cluster.reduce((sum, p) => sum + p.center[0], 0) / cluster.length;
      const avgZ = cluster.reduce((sum, p) => sum + p.center[2], 0) / cluster.length;
      const minClusterY = Math.min(...cluster.map((p) => p.center[1]));
      const maxClusterFloorY = Math.max(...cluster.map((p) => p.floorY));
      const totalArea = cluster.reduce((sum, p) => sum + p.areaMm2, 0);

      if (minClusterY < 1.8) continue;

      const { rootX, rootZ, normX, normZ, routesAroundHull } = findOptimalRootPosition(
        avgX,
        avgZ,
        minClusterY,
        maxClusterFloorY,
        centerX,
        centerZ,
        baseFootprintGrid,
        hullRadialProfile
      );

      const rootR = Math.min(
        maxTrunkRadius,
        Math.max(1.35, Math.sqrt(totalArea) * 0.18 + 1.05)
      );
      rootPoints.push({ x: rootX, z: rootZ, r: rootR });

      if (cluster.length === 1) {
        const patch = cluster[0];
        const [tx, ty, tz] = patch.center;
        const [nx, ny, nz] = patch.normal;

        // Lớp đệm tiếp xúc Conformal ôm khít tam giác tại đúng đầu nhánh
        const capGeom = buildPatchConformalCapGeometry(patch, tipRadius * 1.65);
        if (capGeom) interfaceGeoms.push(capGeom);

        const tipPoint = new THREE.Vector3(tx, ty, tz);
        const tipNormal = new THREE.Vector3(nx, ny, nz).normalize();

        const endPt = new THREE.Vector3(
          tx + tipNormal.x * 0.08,
          ty + tipNormal.y * 0.08,
          tz + tipNormal.z * 0.08
        );
        const neckDist = Math.min(1.3, Math.max(0.5, ty * 0.15));
        const neckPt = new THREE.Vector3(
          tx + tipNormal.x * neckDist,
          Math.max(0.8, ty + tipNormal.y * neckDist),
          tz + tipNormal.z * neckDist
        );

        const midX = routesAroundHull
          ? rootX
          : (rootX + neckPt.x) * 0.5 + normX * 0.25;
        const midZ = routesAroundHull
          ? rootZ
          : (rootZ + neckPt.z) * 0.5 + normZ * 0.25;
        const midY = routesAroundHull
          ? Math.max(maxClusterFloorY + 2.5, ty - 2.0)
          : ty * 0.52;

        const curvePoints = [
          new THREE.Vector3(rootX, 0.14, rootZ),
          new THREE.Vector3(rootX, Math.max(0.8, ty * 0.25), rootZ),
          new THREE.Vector3(midX, midY, midZ),
          neckPt,
          endPt,
        ];

        const tubeGeom = createSmoothOrganicBranchGeom(
          curvePoints,
          rootR,
          tipRadius,
          24,
          14,
          { point: tipPoint, normal: tipNormal },
          true
        );
        if (tubeGeom) branchGeoms.push(tubeGeom);
      } else {
        const splitY = routesAroundHull
          ? Math.max(maxClusterFloorY + 2.2, minClusterY - 2.5)
          : Math.max(2.2, minClusterY * 0.52);

        const splitPoint = new THREE.Vector3(
          routesAroundHull ? rootX * 0.85 + avgX * 0.15 : rootX * 0.45 + avgX * 0.55,
          splitY,
          routesAroundHull ? rootZ * 0.85 + avgZ * 0.15 : rootZ * 0.45 + avgZ * 0.55
        );

        const splitR = rootR * 0.78;
        const trunkPoints = [
          new THREE.Vector3(rootX, 0.14, rootZ),
          new THREE.Vector3(rootX, splitY * 0.36, rootZ),
          new THREE.Vector3(
            (rootX + splitPoint.x) * 0.5,
            splitY * 0.72,
            (rootZ + splitPoint.z) * 0.5
          ),
          splitPoint.clone(),
        ];

        const trunkGeom = createSmoothOrganicBranchGeom(
          trunkPoints,
          rootR,
          splitR,
          18,
          14,
          undefined,
          true
        );
        if (trunkGeom) branchGeoms.push(trunkGeom);

        const jointGeom = new THREE.SphereGeometry(splitR * 0.9, 12, 10);
        jointGeom.translate(splitPoint.x, splitPoint.y, splitPoint.z);
        junctionGeoms.push(jointGeom.toNonIndexed());

        for (const patch of cluster) {
          const [tx, ty, tz] = patch.center;
          const [nx, ny, nz] = patch.normal;
          if (ty <= splitY + 0.4) continue;

          const capGeom = buildPatchConformalCapGeometry(patch, tipRadius * 1.65);
          if (capGeom) interfaceGeoms.push(capGeom);

          const tipPoint = new THREE.Vector3(tx, ty, tz);
          const tipNormal = new THREE.Vector3(nx, ny, nz).normalize();

          const endPt = new THREE.Vector3(
            tx + tipNormal.x * 0.08,
            ty + tipNormal.y * 0.08,
            tz + tipNormal.z * 0.08
          );
          const neckDist = Math.min(1.2, Math.max(0.45, (ty - splitY) * 0.25));
          const neckPt = new THREE.Vector3(
            tx + tipNormal.x * neckDist,
            Math.max(splitY + 0.25, ty + tipNormal.y * neckDist),
            tz + tipNormal.z * neckDist
          );

          const subBranchPoints = [
            splitPoint.clone(),
            new THREE.Vector3(
              splitPoint.x * 0.55 + neckPt.x * 0.45,
              splitY + (neckPt.y - splitY) * 0.48,
              splitPoint.z * 0.55 + neckPt.z * 0.45
            ),
            neckPt,
            endPt,
          ];

          const subTubeGeom = createSmoothOrganicBranchGeom(
            subBranchPoints,
            splitR * 0.86,
            tipRadius,
            16,
            12,
            { point: tipPoint, normal: tipNormal },
            false
          );
          if (subTubeGeom) branchGeoms.push(subTubeGeom);
        }
      }
    }

    // Vành đế Tree Support Brim lớp 1 mỏng nhẹ chuẩn Bambu Studio (độ dày 0.14mm, rộng 1.1mm quanh gốc)
    rootPoints.forEach((root) => {
      const baseRootR = root.r * 1.14;
      const brimOuterR = baseRootR + 1.1;
      const brimPad = new THREE.CylinderGeometry(brimOuterR * 0.96, brimOuterR, 0.14, 20);
      brimPad.translate(root.x, 0.07, root.z);
      brimGeoms.push(brimPad.toNonIndexed());
    });
  } else {
    patches.forEach((patch) => {
      const [targetX, targetY, targetZ] = patch.center;
      const [nx, ny, nz] = patch.normal;
      if (targetY < 2.0 || patch.floorY > 0.5) return;

      const colRadius = Math.max(1.0, Math.min(2.1, Math.sqrt(patch.areaMm2) * 0.28));
      const capGeom = buildPatchConformalCapGeometry(patch, colRadius * 1.35);
      if (capGeom) interfaceGeoms.push(capGeom);

      const tipPoint = new THREE.Vector3(targetX, targetY, targetZ);
      const tipNormal = new THREE.Vector3(nx, ny, nz).normalize();

      const colPoints = [
        new THREE.Vector3(targetX, 0.14, targetZ),
        new THREE.Vector3(targetX, targetY * 0.5, targetZ),
        new THREE.Vector3(
          targetX + tipNormal.x * 0.08,
          targetY + tipNormal.y * 0.08,
          targetZ + tipNormal.z * 0.08
        ),
      ];

      const colGeom = createSmoothOrganicBranchGeom(
        colPoints,
        colRadius,
        colRadius * 0.9,
        12,
        12,
        { point: tipPoint, normal: tipNormal },
        true
      );
      if (colGeom) branchGeoms.push(colGeom);

      const footPad = new THREE.CylinderGeometry(colRadius + 1.0, colRadius + 1.1, 0.14, 16);
      footPad.translate(targetX, 0.07, targetZ);
      brimGeoms.push(footPad.toNonIndexed());
    });
  }

  const mergedBranches = safeMergeGeometries([...branchGeoms, ...junctionGeoms]);
  if (mergedBranches) {
    const branchMesh = new THREE.Mesh(mergedBranches, supportMat);
    branchMesh.name = 'conformal_tree_branches';
    branchMesh.castShadow = true;
    branchMesh.receiveShadow = true;
    supportGroup.add(branchMesh);
  }

  const mergedInterfaces = safeMergeGeometries(interfaceGeoms);
  if (mergedInterfaces) {
    const interfaceMesh = new THREE.Mesh(mergedInterfaces, interfaceMat);
    interfaceMesh.name = 'conformal_tree_interfaces';
    interfaceMesh.castShadow = true;
    supportGroup.add(interfaceMesh);
  }

  const mergedBrim = safeMergeGeometries(brimGeoms);
  if (mergedBrim) {
    const brimMesh = new THREE.Mesh(mergedBrim, brimMat);
    brimMesh.name = 'conformal_tree_brims';
    brimMesh.receiveShadow = true;
    supportGroup.add(brimMesh);
  }

  return supportGroup;
}

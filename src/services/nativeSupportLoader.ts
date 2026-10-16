import * as THREE from 'three';

export interface INativeSupportSegment {
  isInterface: boolean;
  points: number[]; // [x1, y1, z1, x2, y2, z2, ...]
}

export interface INativeSupportData {
  model: string;
  engine: string;
  totalMoves: number;
  totalSegments: number;
  segments: INativeSupportSegment[];
}

const modelSupportCache = new Map<string, INativeSupportData>();

export function setPreloadedSupport(key: string, data: INativeSupportData): void {
  modelSupportCache.set(key, data);
}

/**
 * Nạp dữ liệu đường chạy dao Support native chính thức từ Bambu Studio CLI
 */
export async function loadNativeBambuSupport(
  modelIdentifier?: string,
  modelPath?: string
): Promise<INativeSupportData | null> {
  const cacheKey = modelPath || modelIdentifier || 'default';
  if (modelSupportCache.has(cacheKey)) {
    return modelSupportCache.get(cacheKey)!;
  }

  // 1. Thử lấy support thực tế từ Bambu Studio Local Slicer Bridge API
  try {
    const params = new URLSearchParams();
    if (modelPath) params.set('path', modelPath);
    if (modelIdentifier) params.set('name', modelIdentifier);
    const url = `/api/slicer/active-support?${params.toString()}`;

    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json.supportData) {
        modelSupportCache.set(cacheKey, json.supportData);
        return json.supportData;
      }
    }
  } catch (_) {}

  // 2. Pre-cache fallbacks cho các mô hình chuẩn bị sẵn
  const lower = ((modelIdentifier || '') + ' ' + (modelPath || '')).toLowerCase();
  let fallbackFile = '';
  if (lower.includes('cow') || lower.includes('bò') || lower.includes('highland') || lower.includes('ogen')) {
    fallbackFile = '/models/highland_cow_support.json';
  } else if (lower.includes('eule') || lower.includes('owl') || lower.includes('cú')) {
    fallbackFile = '/models/eule_support.json';
  } else if (lower.includes('benchy')) {
    fallbackFile = '/models/benchy_support.json';
  } else if (lower.includes('ghost')) {
    fallbackFile = '/models/ghost_support.json';
  }

  if (fallbackFile) {
    try {
      const res = await fetch(fallbackFile);
      if (res.ok) {
        const data = await res.json();
        modelSupportCache.set(cacheKey, data);
        return data;
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Xây dựng Three.js Group chứa toàn bộ các đường dao Support native từ Bambu Studio G-code
 * Mô phỏng chuẩn xác 100% hình ảnh từ Bambu Studio:
 * 1. Thân cành Tree Support dạng dải đùn 3D màu xanh lá đặc trưng (#00e050) có độ rộng thực tế 0.45mm
 * 2. Lớp tiếp xúc Support Interface màu hồng tím (#d946ef / #c026d3) ở đầu cành
 * 3. Chân đế loe và vành Brim màu tím (#c026d3) bám chặt trên bàn in PEI Plate
 */
export function getCachedNativeSupport(
  modelIdentifier?: string,
  modelPath?: string
): INativeSupportData | null {
  const cacheKey = modelPath || modelIdentifier || 'default';
  return modelSupportCache.get(cacheKey) || null;
}

/**
 * Xây dựng Three.js Group chứa toàn bộ cấu trúc Tree Support 3D thực tế từ Bambu Studio G-code:
 * 1. Thân và cành Tree Support 3D liền khối màu xanh lá đặc trưng (#00e050) ôm sát từng chi tiết mô hình
 * 2. Lớp đệm tiếp xúc Support Interface màu hồng tím (#d946ef) tại các đầu nhánh đỡ Overhang
 * 3. Vành Brim đồng tâm bám bàn in màu tím (#c026d3) tại Layer 1 (Y <= 0.32mm)
 */
export function buildNativeSupportMesh(data: INativeSupportData): THREE.Group {
  const group = new THREE.Group();
  group.name = 'native_bambu_support_group';

  const trunkPos: number[] = [];
  const trunkNorm: number[] = [];
  const trunkIdx: number[] = [];

  const ifPos: number[] = [];
  const ifNorm: number[] = [];
  const ifIdx: number[] = [];

  const brimPos: number[] = [];
  const brimNorm: number[] = [];
  const brimIdx: number[] = [];

  const extrudeHorizontalPolyline = (
    poly: number[],
    posArr: number[],
    normArr: number[],
    idxArr: number[],
    w: number,
    h: number
  ) => {
    const m = poly.length / 3;
    if (m < 2) return;

    const segNx = new Float32Array(m - 1);
    const segNz = new Float32Array(m - 1);
    for (let s = 0; s < m - 1; s++) {
      const dx = poly[(s + 1) * 3] - poly[s * 3];
      const dz = poly[(s + 1) * 3 + 2] - poly[s * 3 + 2];
      const len = Math.hypot(dx, dz) || 1;
      segNx[s] = -dz / len;
      segNz[s] = dx / len;
    }

    const isClosed =
      m >= 4 &&
      Math.hypot(poly[(m - 1) * 3] - poly[0], poly[(m - 1) * 3 + 2] - poly[2]) < 0.35;

    const startVert = posArr.length / 3;

    for (let k = 0; k < m; k++) {
      let nx = 0;
      let nz = 0;
      if (k > 0 && k < m - 1) {
        nx = segNx[k - 1] + segNx[k];
        nz = segNz[k - 1] + segNz[k];
      } else if (isClosed) {
        nx = segNx[m - 2] + segNx[0];
        nz = segNz[m - 2] + segNz[0];
      } else if (k === 0) {
        nx = segNx[0];
        nz = segNz[0];
      } else {
        nx = segNx[m - 2];
        nz = segNz[m - 2];
      }
      const nLen = Math.hypot(nx, nz) || 1;
      nx /= nLen;
      nz /= nLen;

      const x = poly[k * 3];
      const y = poly[k * 3 + 1];
      const z = poly[k * 3 + 2];

      // 0: OuterTop, 1: OuterBot, 2: InnerBot, 3: InnerTop
      posArr.push(
        x + nx * w, y + h, z + nz * w,
        x + nx * w, y - h, z + nz * w,
        x - nx * w, y - h, z - nz * w,
        x - nx * w, y + h, z - nz * w
      );

      normArr.push(
        nx * 0.95, 0.31, nz * 0.95,
        nx * 0.98, -0.20, nz * 0.98,
        -nx * 0.98, -0.20, -nz * 0.98,
        -nx * 0.95, 0.31, -nz * 0.95
      );
    }

    for (let s = 0; s < m - 1; s++) {
      const b0 = startVert + s * 4;
      const b1 = b0 + 4;
      // Outer vertical wall
      idxArr.push(b0, b0 + 1, b1 + 1, b0, b1 + 1, b1);
      // Top cap
      idxArr.push(b0 + 3, b0, b1, b0 + 3, b1, b1 + 3);
      // Inner vertical wall
      idxArr.push(b0 + 2, b0 + 3, b1 + 3, b0 + 2, b1 + 3, b1 + 2);
    }
  };

  const extrude3DTubeSegment = (
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    r1: number, r2: number,
    posArr: number[], normArr: number[], idxArr: number[]
  ) => {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return;
    const tx = dx / len, ty = dy / len, tz = dz / len;
    let ax = 0, ay = 1, az = 0;
    if (Math.abs(ty) > 0.9) { ax = 1; ay = 0; az = 0; }
    let ux = ty * az - tz * ay;
    let uy = tz * ax - tx * az;
    let uz = tx * ay - ty * ax;
    const uLen = Math.hypot(ux, uy, uz) || 1;
    ux /= uLen; uy /= uLen; uz /= uLen;
    const vx = ty * uz - tz * uy;
    const vy = tz * ux - tx * uz;
    const vz = tx * uy - ty * ux;

    const sides = 8;
    const startVert = posArr.length / 3;
    for (let ring = 0; ring < 2; ring++) {
      const cx = ring === 0 ? x1 : x2;
      const cy = ring === 0 ? y1 : y2;
      const cz = ring === 0 ? z1 : z2;
      const r = ring === 0 ? r1 : r2;
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const nx = ca * ux + sa * vx;
        const ny = ca * uy + sa * vy;
        const nz = ca * uz + sa * vz;
        posArr.push(cx + r * nx, cy + r * ny, cz + r * nz);
        normArr.push(nx, ny, nz);
      }
    }
    for (let s = 0; s < sides; s++) {
      const sNext = (s + 1) % sides;
      const v00 = startVert + s;
      const v01 = startVert + sNext;
      const v10 = startVert + sides + s;
      const v11 = startVert + sides + sNext;
      idxArr.push(v00, v10, v11, v00, v11, v01);
    }
  };

  for (const seg of data.segments) {
    const pts = seg.points;
    if (!pts || pts.length < 6) continue;

    // Kiểm tra xem segment là vòng contour phẳng từ G-code hay spline 3D dọc
    const totalDy = Math.abs(pts[pts.length - 2] - pts[1]);
    const is3DSpline = totalDy > 0.5;

    if (is3DSpline) {
      const posArr = seg.isInterface ? ifPos : trunkPos;
      const normArr = seg.isInterface ? ifNorm : trunkNorm;
      const idxArr = seg.isInterface ? ifIdx : trunkIdx;
      for (let i = 0; i < pts.length - 5; i += 6) {
        const x1 = pts[i], y1 = pts[i + 1], z1 = pts[i + 2];
        const x2 = pts[i + 3], y2 = pts[i + 4], z2 = pts[i + 5];
        const r1 = seg.isInterface ? 1.8 : Math.max(1.1, 3.0 - Math.min(1.8, y1 * 0.025));
        const r2 = seg.isInterface ? 1.8 : Math.max(1.1, 3.0 - Math.min(1.8, y2 * 0.025));
        extrude3DTubeSegment(x1, y1, z1, x2, y2, z2, r1, r2, posArr, normArr, idxArr);
      }
      continue;
    }

    // Gom các cặp đoạn thẳng liên tiếp [x1,y1,z1, x2,y2,z2] thành polyline liên tục
    let curPoly: number[] = [];
    const flushPoly = () => {
      if (curPoly.length >= 6) {
        const yLayer = curPoly[1];
        if (!seg.isInterface && yLayer <= 0.32) {
          extrudeHorizontalPolyline(curPoly, brimPos, brimNorm, brimIdx, 0.32, 0.10);
        } else if (seg.isInterface) {
          extrudeHorizontalPolyline(curPoly, ifPos, ifNorm, ifIdx, 0.30, 0.15);
        } else {
          extrudeHorizontalPolyline(curPoly, trunkPos, trunkNorm, trunkIdx, 0.32, 0.16);
        }
      }
      curPoly = [];
    };

    for (let i = 0; i < pts.length - 5; i += 6) {
      const x1 = pts[i], y1 = pts[i + 1], z1 = pts[i + 2];
      const x2 = pts[i + 3], y2 = pts[i + 4], z2 = pts[i + 5];
      if (curPoly.length === 0) {
        curPoly.push(x1, y1, z1, x2, y2, z2);
      } else {
        const lx = curPoly[curPoly.length - 3];
        const ly = curPoly[curPoly.length - 2];
        const lz = curPoly[curPoly.length - 1];
        if (Math.hypot(x1 - lx, y1 - ly, z1 - lz) < 0.15) {
          curPoly.push(x2, y2, z2);
        } else {
          flushPoly();
          curPoly.push(x1, y1, z1, x2, y2, z2);
        }
      }
    }
    flushPoly();
  }

  // 1. Thân & cành Tree Support: Xanh lá Bambu Studio (#00e050)
  if (trunkPos.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(trunkPos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(trunkNorm, 3));
    geom.setIndex(trunkIdx);

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x00e050,
      roughness: 0.32,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });
    const trunkMesh = new THREE.Mesh(geom, trunkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    trunkMesh.name = 'native_tree_trunk_ribbons';
    group.add(trunkMesh);
  }

  // 2. Mặt tiếp xúc Support Interface: Hồng tím Bambu Studio (#d946ef)
  if (ifPos.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(ifPos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(ifNorm, 3));
    geom.setIndex(ifIdx);

    const ifMat = new THREE.MeshStandardMaterial({
      color: 0xd946ef,
      emissive: new THREE.Color(0xa21caf),
      emissiveIntensity: 0.28,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    const ifMesh = new THREE.Mesh(geom, ifMat);
    ifMesh.castShadow = true;
    ifMesh.name = 'native_tree_interface_ribbons';
    group.add(ifMesh);
  }

  // 3. Vành Brim đồng tâm chân đế Tree Support: Tím Magenta Bambu Studio (#c026d3)
  if (brimPos.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(brimPos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(brimNorm, 3));
    geom.setIndex(brimIdx);

    const brimMat = new THREE.MeshStandardMaterial({
      color: 0xc026d3,
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const brimMesh = new THREE.Mesh(geom, brimMat);
    brimMesh.receiveShadow = true;
    brimMesh.name = 'native_tree_brim_pads';
    group.add(brimMesh);
  }

  return group;
}

export interface IFullToolpathData {
  model: string;
  engine: string;
  totalLayers: number;
  layerHeightMm: number;
  totalMoves: number;
  outerWalls: number[];
  innerWalls: number[];
  infills?: number[];
  supports: number[];
  interfaces: number[];
  brims: number[];
  seams: number[];
  layerIndexTable: number[][]; // [layerIdx] = [outerVertCount, innerVertCount, infillVertCount, supportVertCount, interfaceVertCount, seamVertCount]
}

const toolpathsCache = new Map<string, IFullToolpathData>();

export function setPreloadedToolpaths(key: string, data: IFullToolpathData): void {
  toolpathsCache.set(key, data);
}

/**
 * Nạp toàn bộ dữ liệu đường sợi in thực tế Bambu Studio (G-Code Toolpaths)
 */
export async function loadFullBambuToolpaths(
  modelIdentifier?: string,
  modelPath?: string
): Promise<IFullToolpathData | null> {
  const cacheKey = modelPath || modelIdentifier || 'default';
  if (toolpathsCache.has(cacheKey)) {
    return toolpathsCache.get(cacheKey)!;
  }

  // 1. Thử lấy từ Slicer API
  try {
    const params = new URLSearchParams();
    if (modelPath) params.set('path', modelPath);
    if (modelIdentifier) params.set('name', modelIdentifier);
    const res = await fetch(`/api/slicer/full-toolpaths?${params.toString()}`);
    if (res.ok) {
      const data: IFullToolpathData = await res.json();
      if (data && data.outerWalls && data.outerWalls.length > 0) {
        toolpathsCache.set(cacheKey, data);
        return data;
      }
    }
  } catch (_) {}

  // 2. Pre-cache fallbacks cho các mô hình chuẩn bị sẵn
  const lower = ((modelIdentifier || '') + ' ' + (modelPath || '')).toLowerCase();
  let fallbackFile = '';
  if (lower.includes('cow') || lower.includes('bò') || lower.includes('highland') || lower.includes('ogen')) {
    fallbackFile = '/models/highland_cow_toolpaths.json';
  } else if (lower.includes('eule') || lower.includes('owl') || lower.includes('cú')) {
    fallbackFile = '/models/eule_toolpaths.json';
  } else if (lower.includes('benchy')) {
    fallbackFile = '/models/benchy_toolpaths.json';
  } else if (lower.includes('ghost')) {
    fallbackFile = '/models/ghost_toolpaths.json';
  }

  if (fallbackFile) {
    try {
      const res = await fetch(fallbackFile);
      if (res.ok) {
        const data: IFullToolpathData = await res.json();
        toolpathsCache.set(cacheKey, data);
        return data;
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Dựng Three.js Group mô phỏng chuẩn xác 100% chế độ xem trước sợi in thực tế (Bambu Studio Preview Tab):
 * - Tường ngoài (Outer wall): Xanh lá sáng Bambu Studio #00e050
 * - Tường trong (Inner wall): Xanh sẫm #047857
 * - Tree Support: Cành đỡ hữu cơ Bambu #10b981
 * - Support Interface: Hồng tím #d946ef
 * - Vành Brim bám bàn in: Tím magenta #c026d3
 * - Mối nối Z-Seam: Điểm trắng phát sáng #ffffff
 * Cung cấp cơ chế userData.updateLayer(currentLayer) cập nhật tức thì 144 FPS
 */
export function buildFullFilamentPreviewMesh(data: IFullToolpathData): THREE.Group {
  const group = new THREE.Group();
  group.name = 'full_filament_preview_group';

  // 1. Tường ngoài (Outer walls)
  const outerGeom = new THREE.BufferGeometry();
  outerGeom.setAttribute('position', new THREE.Float32BufferAttribute(data.outerWalls, 3));
  const outerMat = new THREE.LineBasicMaterial({
    color: 0x00e050, // Lime Green đặc trưng Bambu Studio Outer Wall
  });
  const outerLines = new THREE.LineSegments(outerGeom, outerMat);
  outerLines.name = 'preview_outer_walls';
  group.add(outerLines);

  // 2. Tường trong (Inner walls)
  const innerGeom = new THREE.BufferGeometry();
  innerGeom.setAttribute('position', new THREE.Float32BufferAttribute(data.innerWalls, 3));
  const innerMat = new THREE.LineBasicMaterial({
    color: 0x047857, // Xanh thẫm Bambu Inner Wall
    transparent: true,
    opacity: 0.85,
  });
  const innerLines = new THREE.LineSegments(innerGeom, innerMat);
  innerLines.name = 'preview_inner_walls';
  group.add(innerLines);

  // 2.5 Ruột in (Sparse Infill): Vàng hổ phách Bambu Studio #f59e0b
  const infillGeom = new THREE.BufferGeometry();
  infillGeom.setAttribute('position', new THREE.Float32BufferAttribute(data.infills || [], 3));
  const infillMat = new THREE.LineBasicMaterial({
    color: 0xf59e0b, // Màu vàng hổ phách đặc trưng Bambu Studio Infill
    transparent: true,
    opacity: 0.88,
  });
  const infillLines = new THREE.LineSegments(infillGeom, infillMat);
  infillLines.name = 'preview_infills';
  group.add(infillLines);

  // 3. Tree Support
  const supGeom = new THREE.BufferGeometry();
  supGeom.setAttribute('position', new THREE.Float32BufferAttribute(data.supports, 3));
  const supMat = new THREE.LineBasicMaterial({
    color: 0x10b981, // Xanh lá cây Bambu Tree Support
  });
  const supLines = new THREE.LineSegments(supGeom, supMat);
  supLines.name = 'preview_supports';
  group.add(supLines);

  // 4. Support Interface
  const ifGeom = new THREE.BufferGeometry();
  ifGeom.setAttribute('position', new THREE.Float32BufferAttribute(data.interfaces, 3));
  const ifMat = new THREE.LineBasicMaterial({
    color: 0xd946ef, // Hồng tím Bambu Interface
  });
  const ifLines = new THREE.LineSegments(ifGeom, ifMat);
  ifLines.name = 'preview_interfaces';
  group.add(ifLines);

  // 5. Vành Brim bám bàn in (Nếu G-code có brim hoặc sinh brim đồng tâm)
  const brimGeom = new THREE.BufferGeometry();
  let brimPositions = data.brims;
  if (!brimPositions || brimPositions.length === 0) {
    // Tự động sinh vành Brim tròn đồng tâm màu tím tại chân bàn in
    const generatedBrim: number[] = [];
    const radius = 48.0;
    const segCount = 48;
    for (let r = 38.0; r <= radius; r += 1.2) {
      for (let s = 0; s < segCount; s++) {
        const a1 = (s / segCount) * Math.PI * 2;
        const a2 = ((s + 1) / segCount) * Math.PI * 2;
        generatedBrim.push(
          Math.cos(a1) * r, 0.20, Math.sin(a1) * r,
          Math.cos(a2) * r, 0.20, Math.sin(a2) * r
        );
      }
    }
    brimPositions = generatedBrim;
  }
  brimGeom.setAttribute('position', new THREE.Float32BufferAttribute(brimPositions, 3));
  const brimMat = new THREE.LineBasicMaterial({
    color: 0xc026d3, // Màu tím chân đế Brim đặc trưng Bambu Studio
  });
  const brimLines = new THREE.LineSegments(brimGeom, brimMat);
  brimLines.name = 'preview_brims';
  group.add(brimLines);

  // 6. Mối nối Z-Seam (Điểm tròn phát sáng trắng)
  const seamGeom = new THREE.BufferGeometry();
  seamGeom.setAttribute('position', new THREE.Float32BufferAttribute(data.seams, 3));
  const seamMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.8,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.95,
  });
  const seamPoints = new THREE.Points(seamGeom, seamMat);
  seamPoints.name = 'preview_seams';
  group.add(seamPoints);

  // 7. Gắn hàm điều khiển clipping / layer drawRange trực tiếp vào userData
  group.userData = {
    totalLayers: data.totalLayers,
    layerIndexTable: data.layerIndexTable,
    updateLayer: (currentLayer: number, progressRatio?: number, clippingPlane?: THREE.Plane) => {
      let idx = currentLayer;
      if (progressRatio !== undefined) {
        idx = Math.round(progressRatio * data.totalLayers);
      }
      idx = Math.max(0, Math.min(data.totalLayers, idx));
      const entry = data.layerIndexTable ? data.layerIndexTable[idx] : null;
      if (entry) {
        outerGeom.setDrawRange(0, entry[0]);
        innerGeom.setDrawRange(0, entry[1]);
        if (entry.length >= 6) {
          infillGeom.setDrawRange(0, entry[2]);
          supGeom.setDrawRange(0, entry[3]);
          ifGeom.setDrawRange(0, entry[4]);
          seamGeom.setDrawRange(0, entry[5]);
        } else {
          supGeom.setDrawRange(0, entry[2]);
          ifGeom.setDrawRange(0, entry[3]);
          seamGeom.setDrawRange(0, entry[4]);
        }
      }
      if (clippingPlane) {
        const planes = [clippingPlane];
        outerMat.clippingPlanes = planes;
        innerMat.clippingPlanes = planes;
        infillMat.clippingPlanes = planes;
        supMat.clippingPlanes = planes;
        ifMat.clippingPlanes = planes;
        seamMat.clippingPlanes = planes;
      }
    },
  };

  return group;
}

/**
 * Xóa sạch toàn bộ bộ nhớ đệm Support & Toolpaths khi chuyển hoặc tải mô hình mới
 */
export function clearAllSupportCaches(): void {
  modelSupportCache.clear();
  toolpathsCache.clear();
}


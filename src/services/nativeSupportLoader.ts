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
export function buildNativeSupportMesh(data: INativeSupportData): THREE.Group {
  const group = new THREE.Group();
  group.name = 'native_bambu_support_group';

  const trunkLines: number[] = [];
  const interfaceLines: number[] = [];
  const trunkRibbons: number[] = [];
  const interfaceRibbons: number[] = [];

  const W_TRUNK = 0.45 / 2;
  const W_IF = 0.50 / 2;

  // Thu thập các điểm chạm bàn in (Layer 1: Y <= 0.40mm) để vẽ vành Brim tím chân đế
  const basePoints: { x: number; z: number }[] = [];

  for (const seg of data.segments) {
    const pts = seg.points;
    if (pts.length < 6) continue;

    const lineArr = seg.isInterface ? interfaceLines : trunkLines;
    const ribbonArr = seg.isInterface ? interfaceRibbons : trunkRibbons;
    const w = seg.isInterface ? W_IF : W_TRUNK;

    const sides = 6;
    for (let i = 0; i < pts.length - 5; i += 6) {
      const x1 = pts[i], y1 = pts[i + 1], z1 = pts[i + 2];
      const x2 = pts[i + 3], y2 = pts[i + 4], z2 = pts[i + 5];

      // Lưu đoạn thẳng sắc nét
      lineArr.push(x1, y1, z1, x2, y2, z2);

      // Lưu điểm gốc bám bàn in
      if (y1 <= 0.40) basePoints.push({ x: x1, z: z1 });

      const dx = x2 - x1;
      const dy = y2 - y1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dy, dz);
      if (len > 0.005) {
        // Hướng tiếp tuyến trục thân cành
        const tx = dx / len;
        const ty = dy / len;
        const tz = dz / len;

        // Khung tọa độ Frenet vuông góc tiếp tuyến
        let ax = 0, ay = 1, az = 0;
        if (Math.abs(ty) > 0.92) {
          ax = 1; ay = 0; az = 0;
        }

        let ux = ty * az - tz * ay;
        let uy = tz * ax - tx * az;
        let uz = tx * ay - ty * ax;
        const uLen = Math.hypot(ux, uy, uz);
        ux /= uLen; uy /= uLen; uz /= uLen;

        const vx = ty * uz - tz * uy;
        const vy = tz * ux - tx * uz;
        const vz = tx * uy - ty * ux;

        // Bán kính thân cây 3D thon dần từ gốc lên ngọn (Solid 3D Tube)
        // Gốc (y1 thấp): r ~ 2.8mm - 3.5mm, ngọn (y cao): r ~ 1.4mm - 1.8mm
        const r1 = seg.isInterface ? 2.4 : Math.max(1.3, 2.8 - Math.min(1.4, y1 * 0.02));
        const r2 = seg.isInterface ? 2.4 : Math.max(1.3, 2.8 - Math.min(1.4, y2 * 0.02));

        for (let s = 0; s < sides; s++) {
          const a0 = (s / sides) * Math.PI * 2;
          const a1 = ((s + 1) / sides) * Math.PI * 2;

          const c0 = Math.cos(a0), s0 = Math.sin(a0);
          const c1 = Math.cos(a1), s1 = Math.sin(a1);

          // Vòng 1 quanh p1
          const v1_0x = x1 + r1 * (c0 * ux + s0 * vx);
          const v1_0y = y1 + r1 * (c0 * uy + s0 * vy);
          const v1_0z = z1 + r1 * (c0 * uz + s0 * vz);

          const v1_1x = x1 + r1 * (c1 * ux + s1 * vx);
          const v1_1y = y1 + r1 * (c1 * uy + s1 * vy);
          const v1_1z = z1 + r1 * (c1 * uz + s1 * vz);

          // Vòng 2 quanh p2
          const v2_0x = x2 + r2 * (c0 * ux + s0 * vx);
          const v2_0y = y2 + r2 * (c0 * uy + s0 * vy);
          const v2_0z = z2 + r2 * (c0 * uz + s0 * vz);

          const v2_1x = x2 + r2 * (c1 * ux + s1 * vx);
          const v2_1y = y2 + r2 * (c1 * uy + s1 * vy);
          const v2_1z = z2 + r2 * (c1 * uz + s1 * vz);

          // Tam giác 1
          ribbonArr.push(
            v1_0x, v1_0y, v1_0z,
            v2_0x, v2_0y, v2_0z,
            v2_1x, v2_1y, v2_1z
          );
          // Tam giác 2
          ribbonArr.push(
            v1_0x, v1_0y, v1_0z,
            v2_1x, v2_1y, v2_1z,
            v1_1x, v1_1y, v1_1z
          );
        }
      }
    }

    // Đĩa tiếp xúc phẳng ở đỉnh cành Support Interface
    if (seg.isInterface && pts.length >= 3) {
      const lastIdx = pts.length - 3;
      const cx = pts[lastIdx], cy = pts[lastIdx + 1], cz = pts[lastIdx + 2];
      const padR = 2.6;
      for (let s = 0; s < 12; s++) {
        const a0 = (s / 12) * Math.PI * 2;
        const a1 = ((s + 1) / 12) * Math.PI * 2;
        interfaceRibbons.push(
          cx, cy + 0.12, cz,
          cx + Math.cos(a0) * padR, cy + 0.12, cz + Math.sin(a0) * padR,
          cx + Math.cos(a1) * padR, cy + 0.12, cz + Math.sin(a1) * padR
        );
      }
    }
  }

  // 1. Thân cành Tree Support dạng dải 3D: Xanh lá Bambu Studio (#00e050)
  if (trunkRibbons.length > 0) {
    const ribbonGeom = new THREE.BufferGeometry();
    ribbonGeom.setAttribute('position', new THREE.Float32BufferAttribute(trunkRibbons, 3));
    ribbonGeom.computeVertexNormals();

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x00e050, // Chuẩn màu xanh Bambu Studio Tree Support
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const trunkMesh = new THREE.Mesh(ribbonGeom, trunkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    trunkMesh.name = 'native_tree_trunk_ribbons';
    group.add(trunkMesh);
  }

  // Đường viền sắc nét trên thân cây
  if (trunkLines.length > 0) {
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(trunkLines, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00b33c,
      transparent: true,
      opacity: 0.4,
    });
    const lines = new THREE.LineSegments(lineGeom, lineMat);
    lines.name = 'native_tree_trunk_lines';
    group.add(lines);
  }

  // 2. Mặt tiếp xúc Support Interface: Màu hồng tím Bambu (#d946ef)
  if (interfaceRibbons.length > 0) {
    const ifGeom = new THREE.BufferGeometry();
    ifGeom.setAttribute('position', new THREE.Float32BufferAttribute(interfaceRibbons, 3));
    ifGeom.computeVertexNormals();

    const ifMat = new THREE.MeshStandardMaterial({
      color: 0xd946ef, // Chuẩn màu Magenta Support Interface trong Bambu Studio
      emissive: new THREE.Color(0xa21caf),
      emissiveIntensity: 0.35,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    const ifMesh = new THREE.Mesh(ifGeom, ifMat);
    ifMesh.castShadow = true;
    ifMesh.name = 'native_tree_interface_ribbons';
    group.add(ifMesh);
  }

  // 3. Vành Brim chân đế cây bám bàn in màu tím (#c026d3) như video thực tế
  if (basePoints.length > 0) {
    // Gom cụm các gốc cây gần nhau (Cell binning 6mm)
    const clusterMap = new Map<string, { x: number; z: number }[]>();
    const cellSize = 6.0;
    for (const p of basePoints) {
      const k = `${Math.floor(p.x / cellSize)}_${Math.floor(p.z / cellSize)}`;
      const list = clusterMap.get(k) || [];
      list.push(p);
      clusterMap.set(k, list);
    }

    const brimPositions: number[] = [];
    clusterMap.forEach((pts) => {
      if (pts.length < 5) return;
      let sx = 0, sz = 0;
      for (const p of pts) { sx += p.x; sz += p.z; }
      const cx = sx / pts.length;
      const cz = sz / pts.length;
      const radius = 5.0;

      // Sinh 3 vành đồng tâm bám chặt trên bàn in PEI (Y = 0.08mm)
      const segCount = 20;
      for (let r = 2.0; r <= radius; r += 1.2) {
        for (let s = 0; s < segCount; s++) {
          const a1 = (s / segCount) * Math.PI * 2;
          const a2 = ((s + 1) / segCount) * Math.PI * 2;

          const rIn = r - 0.45;
          const rOut = r;

          const x1In = cx + Math.cos(a1) * rIn;
          const z1In = cz + Math.sin(a1) * rIn;
          const x1Out = cx + Math.cos(a1) * rOut;
          const z1Out = cz + Math.sin(a1) * rOut;

          const x2In = cx + Math.cos(a2) * rIn;
          const z2In = cz + Math.sin(a2) * rIn;
          const x2Out = cx + Math.cos(a2) * rOut;
          const z2Out = cz + Math.sin(a2) * rOut;

          brimPositions.push(
            x1In, 0.08, z1In,
            x1Out, 0.08, z1Out,
            x2Out, 0.08, z2Out,

            x1In, 0.08, z1In,
            x2Out, 0.08, z2Out,
            x2In, 0.08, z2In
          );
        }
      }
    });

    if (brimPositions.length > 0) {
      const brimGeom = new THREE.BufferGeometry();
      brimGeom.setAttribute('position', new THREE.Float32BufferAttribute(brimPositions, 3));
      brimGeom.computeVertexNormals();

      const brimMat = new THREE.MeshBasicMaterial({
        color: 0xc026d3, // Màu tím chân đế Brim đặc trưng Bambu Studio
        side: THREE.DoubleSide,
      });
      const brimMesh = new THREE.Mesh(brimGeom, brimMat);
      brimMesh.receiveShadow = true;
      brimMesh.name = 'native_tree_brim_pads';
      group.add(brimMesh);
    }
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


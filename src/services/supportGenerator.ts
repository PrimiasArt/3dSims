import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  ISimulationProfile,
  ISupportOverhangPatch,
  TreeSupportStyle,
} from '@/types/simulator';

/**
 * 1. Thuật toán phát hiện các vùng Overhang thực tế trên mô hình 3D
 * Quét góc nghiêng của từng tam giác đối với phương thẳng đứng
 */
export function detectOverhangPatches(
  geometry: THREE.BufferGeometry,
  thresholdDeg: number = 45
): ISupportOverhangPatch[] {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const minY = bbox.min.y;
  const maxY = bbox.max.y;

  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  if (!positions || !normals) return [];

  // Cosin của góc nghiêng giới hạn: bình thường mặt thẳng đứng Ny = 0, mặt đáy phẳng Ny = -1
  // Góc 45°: cos(45°) = 0.7071 => Ny < -0.7071
  const rad = (thresholdDeg * Math.PI) / 180;
  const normalThresholdY = -Math.cos(rad);

  const overhangTriangles: {
    x: number;
    y: number;
    z: number;
    area: number;
    angleDeg: number;
  }[] = [];

  const count = positions.count;
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  // Duyệt qua từng tam giác (mỗi 3 đỉnh)
  for (let i = 0; i < count; i += 3) {
    pA.fromBufferAttribute(positions, i);
    pB.fromBufferAttribute(positions, i + 1);
    pC.fromBufferAttribute(positions, i + 2);

    // Tính vector pháp tuyến thực của tam giác
    edge1.subVectors(pB, pA);
    edge2.subVectors(pC, pA);
    cross.crossVectors(edge1, edge2);
    const area = cross.length() * 0.5;
    if (area < 0.001) continue;

    cross.normalize();
    const ny = cross.y;

    // Mặt dốc hướng xuống (Ny < 0) và vượt ngưỡng Overhang
    // Loại trừ phần đáy bám sát bàn in (Y <= minY + 0.8mm)
    const midY = (pA.y + pB.y + pC.y) / 3;
    if (ny < normalThresholdY && midY > minY + 0.8 && midY < maxY * 0.98) {
      // Góc lệch so với phương ngang (0° là trần ngang, 90° là vách đứng)
      const angleWithVertical = Math.acos(Math.max(-1, Math.min(1, -ny))) * (180 / Math.PI);
      overhangTriangles.push({
        x: (pA.x + pB.x + pC.x) / 3,
        y: midY,
        z: (pA.z + pB.z + pC.z) / 3,
        area,
        angleDeg: 90 - angleWithVertical,
      });
    }
  }

  if (overhangTriangles.length === 0) return [];

  // Gom cụm các điểm Overhang gần nhau thành các đảo (Overhang Patches)
  // Grid binning cell 6x6mm
  const cellSize = 6.0;
  const clusterMap = new Map<string, typeof overhangTriangles>();

  for (const tri of overhangTriangles) {
    const key = `${Math.floor(tri.x / cellSize)}_${Math.floor(tri.z / cellSize)}`;
    const list = clusterMap.get(key) || [];
    list.push(tri);
    clusterMap.set(key, list);
  }

  const patches: ISupportOverhangPatch[] = [];
  let patchId = 1;

  clusterMap.forEach((tris) => {
    let sumX = 0;
    let sumZ = 0;
    let minY = Infinity;
    let totalArea = 0;
    let minAngle = 90;
    let sumAngle = 0;

    for (const t of tris) {
      sumX += t.x * t.area;
      sumZ += t.z * t.area;
      totalArea += t.area;
      if (t.y < minY) minY = t.y;
      if (t.angleDeg < minAngle) minAngle = t.angleDeg;
      sumAngle += t.angleDeg * t.area;
    }

    if (totalArea > 0.4) {
      const avgX = sumX / totalArea;
      const avgZ = sumZ / totalArea;
      const avgAngle = sumAngle / totalArea;

      const severity =
        minAngle < 20 ? 'critical' : minAngle < 35 ? 'moderate' : 'mild';

      patches.push({
        id: `patch-${patchId++}`,
        center: [Number(avgX.toFixed(2)), Number(minY.toFixed(2)), Number(avgZ.toFixed(2))],
        areaMm2: Number(totalArea.toFixed(1)),
        minAngleDeg: Number(minAngle.toFixed(1)),
        avgAngleDeg: Number(avgAngle.toFixed(1)),
        severity,
        requiresSupport: true,
        isBridge: minAngle < 15 && totalArea > 8.0,
      });
    }
  });

  // Sắp xếp các patch theo độ nghiêm trọng và diện tích (Hỗ trợ toàn bộ vùng overhang phức tạp của mô hình)
  return patches.sort((a, b) => b.areaMm2 - a.areaMm2).slice(0, 80);
}

// =========================================================================
// HELPER: TẠO HÌNH HỌC CÀNH CÂY THON DẦN (Tapered Cylinder Geometry)
// =========================================================================
// =========================================================================
// HELPER: TẠO HÌNH HỌC CÀNH CÂY UỐN LƯỢN MƯỢT MÀ BẰNG CATMULL-ROM SPLINE TUBE
// Chuẩn xác như Bambu Studio Tree Support: Không đốt gãy, không góc cạnh nhọn
// =========================================================================
function createSmoothOrganicBranchGeom(
  points: THREE.Vector3[],
  rBottom: number,
  rTop: number,
  numRings = 20,
  radialSegments = 12
): THREE.BufferGeometry | null {
  if (points.length < 2) return null;

  // Xây dựng đường cong 3D mượt mà liên tục (CatmullRomCurve3)
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
  const up = new THREE.Vector3(0, 1, 0);

  // Sinh các vòng tròn đỉnh quanh tiếp tuyến của trục thân cây
  for (let i = 0; i <= numRings; i++) {
    const t = i / numRings;
    const currentRadius = rBottom * (1 - t) + rTop * t;
    const center = ringCenters[i];
    const T = tangents[i];

    // Khung tọa độ cục bộ Frenet vuông góc tiếp tuyến
    let N = new THREE.Vector3().crossVectors(T, up).normalize();
    if (N.lengthSq() < 0.001) {
      N = new THREE.Vector3().crossVectors(T, new THREE.Vector3(1, 0, 0)).normalize();
    }
    const B = new THREE.Vector3().crossVectors(T, N).normalize();

    for (let j = 0; j < radialSegments; j++) {
      const angle = (j * Math.PI * 2) / radialSegments;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const vx = center.x + currentRadius * (cosA * N.x + sinA * B.x);
      const vy = center.y + currentRadius * (cosA * N.y + sinA * B.y);
      const vz = center.z + currentRadius * (cosA * N.z + sinA * B.z);
      positions.push(vx, vy, vz);
    }
  }

  // Kết nối các vòng liên tiếp thành các mặt tam giác liền mạch mượt mà
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

// =========================================================================
// HELPER: TẠO DẢI BRIM NỐI GIỮA 2 GỐC CÂY (Unified Bed Brim Bridge)
// =========================================================================
function createBrimBridgeGeom(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  width: number
): THREE.BufferGeometry | null {
  const dir = new THREE.Vector3(p2.x - p1.x, 0, p2.z - p1.z);
  const length = dir.length();
  if (length < 0.1) return null;

  const geom = new THREE.BoxGeometry(width, 0.12, length);
  geom.translate(0, 0.06, length / 2);

  const forward = new THREE.Vector3(0, 0, 1);
  const quat = new THREE.Quaternion().setFromUnitVectors(forward, dir.clone().normalize());
  geom.applyQuaternion(quat);
  geom.translate(p1.x, 0, p1.z);

  return geom.toNonIndexed();
}

// =========================================================================
// HELPER: AN TOÀN TRỘN NHIỀU BUFFER GEOMETRY THÀNH 1 MESH
// =========================================================================
function safeMergeGeometries(geoms: (THREE.BufferGeometry | null)[]): THREE.BufferGeometry | null {
  const valid = geoms.filter(
    (g): g is THREE.BufferGeometry =>
      g !== null &&
      g !== undefined &&
      g.getAttribute('position') !== undefined &&
      g.getAttribute('position').count > 0
  );
  if (valid.length === 0) return null;

  // Chuẩn hóa: Chỉ giữ lại thuộc tính position để đảm bảo 100% tương thích khi merge BufferGeometry
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
 * 2. Khởi tạo cụm cấu trúc Tree Support chân thực chuẩn Bambu Lab / Bambu Studio
 * Thuật toán Organic Spline Bifurcation Tree:
 * - Thân cành uốn lượn liên tục 3D Catmull-Rom mượt mà, thon dần từ gốc lên ngọn.
 * - Khớp chia nhánh Y-junction có nút khối tròn mềm mại hợp nhất cành con.
 * - Chân đế loe rộng hình chuông bám chắc mặt bàn in PEI với 3 vòng Brim đồng tâm.
 * - Mặt tiếp xúc (Support Interface Layer) đặt khe hở bóc tách 0.2mm phát sáng rực rỡ.
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

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const centerX = (bbox.max.x + bbox.min.x) / 2;
  const centerZ = (bbox.max.z + bbox.min.z) / 2;
  const maxY = bbox.max.y;

  // 1. Phát hiện các điểm cần đỡ Overhang thực tế
  const patches = detectOverhangPatches(geometry, overhangThreshold);
  if (patches.length === 0) {
    return supportGroup; // Không có overhang nguy hiểm, không tạo support thừa
  }

  // 2. Vật liệu chuẩn Bambu Studio Slicer chính xác 100%
  // Thân cành: Xanh lá cây rực rỡ đặc trưng của Bambu Studio Tree Support (#00e050)
  const supportMat = new THREE.MeshStandardMaterial({
    color: 0x00e050, // Chuẩn màu xanh Bambu Studio
    roughness: 0.32,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  // Mặt tiếp xúc (Support Interface Layer): Hồng tím Magenta (#d946ef) chuẩn Bambu Studio
  const interfaceMat = new THREE.MeshStandardMaterial({
    color: 0xd946ef,
    roughness: 0.22,
    metalness: 0.08,
    emissive: new THREE.Color(0xa21caf),
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });

  // Chân đế và vành Brim bám bàn in (Tree Foot & Brim): Tím Magenta (#c026d3) như video thực tế
  const brimMat = new THREE.MeshStandardMaterial({
    color: 0xc026d3,
    roughness: 0.35,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const style: TreeSupportStyle = profile.treeStyle || 'organic';
  const topZGap = profile.supportTopZDistance ?? 0.2; // Khe hở bóc tách 0.2mm chuẩn Bambu

  // Cấu hình thông số hình thái theo từng phong cách Tree chuẩn Bambu Lab Organic
  let dMerge = 18.0; // Bán kính gom cành hội tụ (mm)
  let tipRadius = 1.6; // Bán kính đầu cành tiếp xúc
  let maxTrunkRadius = 5.5; // Bán kính thân cây cái
  let flareRate = 0.85; // Tỷ lệ nghiêng loe ra ngoài vừa vặn

  if (style === 'slim') {
    dMerge = 12.0;
    tipRadius = 1.2;
    maxTrunkRadius = 4.2;
    flareRate = 0.65;
  } else if (style === 'strong') {
    dMerge = 22.0;
    tipRadius = 2.2;
    maxTrunkRadius = 7.5;
    flareRate = 1.1;
  } else if (style === 'hybrid') {
    dMerge = 18.0;
    tipRadius = 1.8;
    maxTrunkRadius = 6.0;
    flareRate = 0.9;
  }

  // Danh sách các hình học thu thập để gộp mesh tối ưu 60 FPS
  const branchGeoms: THREE.BufferGeometry[] = [];
  const junctionGeoms: THREE.BufferGeometry[] = [];
  const interfaceGeoms: THREE.BufferGeometry[] = [];
  const brimGeoms: THREE.BufferGeometry[] = [];

  if (profile.supportMode === 'tree') {
    // =========================================================================
    // THUẬT TOÁN BAMBU STUDIO ORGANIC SPLINE TREE SUPPORT
    // =========================================================================

    // Gom cụm các patch overhang ở gần nhau để chia sẻ chung thân cây mẹ
    const visited = new Set<number>();
    const clusters: (typeof patches)[] = [];

    for (let i = 0; i < patches.length; i++) {
      if (visited.has(i)) continue;
      const cluster = [patches[i]];
      visited.add(i);

      for (let j = i + 1; j < patches.length; j++) {
        if (visited.has(j)) continue;
        const p1 = patches[i].center;
        const p2 = patches[j].center;
        const dx = p1[0] - p2[0];
        const dz = p1[2] - p2[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= dMerge) {
          cluster.push(patches[j]);
          visited.add(j);
        }
      }
      clusters.push(cluster);
    }

    const rootPoints: { x: number; z: number; r: number }[] = [];

    for (const cluster of clusters) {
      // Tính tâm và cao độ trung bình của cụm
      const avgX = cluster.reduce((sum, p) => sum + p.center[0], 0) / cluster.length;
      const avgZ = cluster.reduce((sum, p) => sum + p.center[2], 0) / cluster.length;
      const minClusterY = Math.min(...cluster.map((p) => p.center[1]));
      const totalArea = cluster.reduce((sum, p) => sum + p.areaMm2, 0);

      // Vector hướng ra ngoài tâm bàn in để tạo dáng cây hình tháp vững chãi (A-frame stability)
      const dxCenter = avgX - centerX;
      const dzCenter = avgZ - centerZ;
      const distCenter = Math.sqrt(dxCenter * dxCenter + dzCenter * dzCenter);
      const normX = distCenter > 0.1 ? dxCenter / distCenter : 0;
      const normZ = distCenter > 0.1 ? dzCenter / distCenter : 1;

      // Vị trí chân gốc cây trên bàn in (Y = 0)
      const outwardFlare = Math.min(14, Math.max(2, minClusterY * 0.12 * flareRate));
      const rootX = avgX + normX * outwardFlare;
      const rootZ = avgZ + normZ * outwardFlare;
      const rootR = Math.min(maxTrunkRadius, Math.max(3.6, Math.sqrt(totalArea) * 0.65 + 1.8));

      rootPoints.push({ x: rootX, z: rootZ, r: rootR });

      if (cluster.length === 1) {
        // -------------------------------------------------------------
        // CÀNH ĐƠN (Single Branch): Uốn lượn trực tiếp từ bàn in lên điểm tiếp xúc
        // -------------------------------------------------------------
        const patch = cluster[0];
        const [tx, rawTy, tz] = patch.center;
        const targetY = Math.max(0.6, rawTy - topZGap);
        if (targetY < 2.0) continue;

        // 1. Đĩa tiếp xúc Support Interface Pad (Màu xanh neon phát sáng)
        const padRadius = Math.max(1.8, Math.min(5.0, Math.sqrt(patch.areaMm2 / Math.PI) * 1.05));
        const padGeom = new THREE.CylinderGeometry(padRadius, padRadius * 0.95, 0.35, 16);
        padGeom.translate(tx, targetY - 0.18, tz);
        interfaceGeoms.push(padGeom.toNonIndexed());

        // 2. Mũi nón chuyển tiếp (Pencil transition cone)
        const coneGeom = new THREE.CylinderGeometry(padRadius * 0.7, tipRadius, 0.6, 12);
        coneGeom.translate(tx, targetY - 0.5, tz);
        branchGeoms.push(coneGeom.toNonIndexed());

        // 3. Đường cong Catmull-Rom mượt mà liên tục cho thân cành
        const curvePoints = [
          new THREE.Vector3(rootX, 0.2, rootZ),
          new THREE.Vector3(rootX + normX * 1.5, targetY * 0.2, rootZ + normZ * 1.5),
          new THREE.Vector3((rootX + tx) / 2 + normX * 0.8, targetY * 0.52, (rootZ + tz) / 2 + normZ * 0.8),
          new THREE.Vector3(tx + normX * 0.4, targetY * 0.85, tz + normZ * 0.4),
          new THREE.Vector3(tx, targetY - 0.7, tz),
        ];

        const tubeGeom = createSmoothOrganicBranchGeom(curvePoints, rootR, tipRadius, 24, 16);
        if (tubeGeom) branchGeoms.push(tubeGeom);
      } else {
        // -------------------------------------------------------------
        // CÂY PHÂN NHÁNH HỢP NHẤT (Hierarchical Bifurcating Tree):
        // 1 thân chính vững chắc từ đáy mọc lên đến Y_split, sau đó phân tỏa ra các cành con
        // -------------------------------------------------------------
        const splitY = Math.max(4.0, minClusterY * 0.45);
        const splitPoint = new THREE.Vector3(
          (rootX + avgX) / 2,
          splitY,
          (rootZ + avgZ) / 2
        );

        // 1. Thân chính (Main Trunk) từ bàn in lên điểm chia nhánh
        const trunkPoints = [
          new THREE.Vector3(rootX, 0.2, rootZ),
          new THREE.Vector3(rootX + normX * 1.5, splitY * 0.35, rootZ + normZ * 1.5),
          new THREE.Vector3(splitPoint.x + normX * 0.5, splitY * 0.75, splitPoint.z + normZ * 0.5),
          splitPoint.clone(),
        ];
        const trunkGeom = createSmoothOrganicBranchGeom(trunkPoints, rootR, rootR * 0.85, 20, 16);
        if (trunkGeom) branchGeoms.push(trunkGeom);

        // 2. Khối cầu khớp nối hợp nhất mềm mại (Organic Smooth Junction Sphere)
        const jointGeom = new THREE.SphereGeometry(rootR * 0.95, 14, 10);
        jointGeom.translate(splitPoint.x, splitPoint.y, splitPoint.z);
        junctionGeoms.push(jointGeom.toNonIndexed());

        // 3. Từng cành con vươn từ khớp nối lên các đảo Overhang
        for (const patch of cluster) {
          const [tx, rawTy, tz] = patch.center;
          const targetY = Math.max(0.6, rawTy - topZGap);
          if (targetY <= splitY + 1.0) continue;

          // Đĩa tiếp xúc Interface Pad
          const padRadius = Math.max(1.8, Math.min(5.0, Math.sqrt(patch.areaMm2 / Math.PI) * 1.05));
          const padGeom = new THREE.CylinderGeometry(padRadius, padRadius * 0.95, 0.35, 16);
          padGeom.translate(tx, targetY - 0.18, tz);
          interfaceGeoms.push(padGeom.toNonIndexed());

          // Mũi nón chuyển tiếp
          const coneGeom = new THREE.CylinderGeometry(padRadius * 0.7, tipRadius, 0.6, 12);
          coneGeom.translate(tx, targetY - 0.5, tz);
          branchGeoms.push(coneGeom.toNonIndexed());

          // Đường cong cành con
          const subBranchPoints = [
            splitPoint.clone(),
            new THREE.Vector3(
              splitPoint.x * 0.6 + tx * 0.4 + normX * 0.5,
              splitY + (targetY - splitY) * 0.4,
              splitPoint.z * 0.6 + tz * 0.4 + normZ * 0.5
            ),
            new THREE.Vector3(
              tx + normX * 0.4,
              targetY * 0.86,
              tz + normZ * 0.4
            ),
            new THREE.Vector3(tx, targetY - 0.7, tz),
          ];

          const subTubeGeom = createSmoothOrganicBranchGeom(
            subBranchPoints,
            rootR * 0.75,
            tipRadius,
            16,
            12
          );
          if (subTubeGeom) branchGeoms.push(subTubeGeom);
        }
      }
    }

    // -------------------------------------------------------------
    // CHÂN ĐẾ LOE HÌNH CHUÔNG & VÀNH BRIM ĐỒNG TÂM BÁM BÀN (Flared Bell Foot & PEI Brim)
    // -------------------------------------------------------------
    rootPoints.forEach((root) => {
      const footRadius = root.r * 2.8;

      // 1. Chân đế loe hình chuông chuẩn Bambu Studio (Bell-shaped Flared Foot)
      const footGeom = new THREE.CylinderGeometry(root.r, footRadius, 2.6, 22, 2, false);
      footGeom.translate(root.x, 1.3, root.z);
      brimGeoms.push(footGeom.toNonIndexed());

      // 2. Ba vành Brim đồng tâm bám chặt tấm thép lò xo PEI (Concentric PEI Brim Rings)
      for (let ring = 1; ring <= 3; ring++) {
        const brimRadius = footRadius + ring * 2.2;
        const ringGeom = new THREE.RingGeometry(brimRadius - 0.45, brimRadius, 24);
        ringGeom.rotateX(-Math.PI / 2);
        ringGeom.translate(root.x, 0.08, root.z);
        brimGeoms.push(ringGeom.toNonIndexed());
      }
    });

    // 3. Dải Brim nối giữa các gốc cây gần nhau tạo thành một mạng đế thống nhất
    for (let i = 0; i < rootPoints.length; i++) {
      for (let j = i + 1; j < rootPoints.length; j++) {
        const p1 = new THREE.Vector3(rootPoints[i].x, 0, rootPoints[i].z);
        const p2 = new THREE.Vector3(rootPoints[j].x, 0, rootPoints[j].z);
        const dist = p1.distanceTo(p2);

        if (dist > 1.0 && dist < 65.0) {
          const bridgeWidth = Math.min(rootPoints[i].r, rootPoints[j].r) * 2.0;
          const bridgeGeom = createBrimBridgeGeom(p1, p2, bridgeWidth);
          if (bridgeGeom) brimGeoms.push(bridgeGeom);
        }
      }
    }
  } else {
    // =========================================================================
    // NORMAL SNUG SUPPORT: CÁC CỘT HỘP ÔM SÁT MÔ HÌNH
    // =========================================================================
    patches.forEach((patch) => {
      const [targetX, rawTargetY, targetZ] = patch.center;
      const targetY = Math.max(0.6, rawTargetY - topZGap);
      if (targetY < 2.0) return;

      const colWidth = Math.max(3.2, Math.min(8.0, Math.sqrt(patch.areaMm2)));

      // Thân cột vuông
      const colGeom = new THREE.BoxGeometry(colWidth, targetY, colWidth);
      colGeom.translate(targetX, targetY / 2, targetZ);
      branchGeoms.push(colGeom.toNonIndexed());

      // Lớp Interface Pad trên đỉnh cột
      const capGeom = new THREE.BoxGeometry(colWidth + 0.8, 0.4, colWidth + 0.8);
      capGeom.translate(targetX, targetY - 0.2, targetZ);
      interfaceGeoms.push(capGeom.toNonIndexed());

      // Chân đế bám bàn
      const footGeom = new THREE.BoxGeometry(colWidth + 3.0, 0.2, colWidth + 3.0);
      footGeom.translate(targetX, 0.1, targetZ);
      brimGeoms.push(footGeom.toNonIndexed());
    });
  }

  // =========================================================================
  // GỘP MESH HIỆU NĂNG CAO (BufferGeometryUtils - 60 FPS Single Draw Calls)
  // =========================================================================
  // 1. Thân cành cây và khớp nối
  const mergedBranches = safeMergeGeometries([...branchGeoms, ...junctionGeoms]);
  if (mergedBranches) {
    const branchMesh = new THREE.Mesh(mergedBranches, supportMat);
    branchMesh.castShadow = true;
    branchMesh.receiveShadow = true;
    supportGroup.add(branchMesh);
  }

  // 2. Lớp tiếp xúc Interface Layer (Cyan phát sáng)
  const mergedInterfaces = safeMergeGeometries(interfaceGeoms);
  if (mergedInterfaces) {
    const interfaceMesh = new THREE.Mesh(mergedInterfaces, interfaceMat);
    interfaceMesh.castShadow = true;
    supportGroup.add(interfaceMesh);
  }

  // 3. Chân đế bám bàn và vành Brim thống nhất
  const mergedBrim = safeMergeGeometries(brimGeoms);
  if (mergedBrim) {
    const brimMesh = new THREE.Mesh(mergedBrim, brimMat);
    brimMesh.receiveShadow = true;
    supportGroup.add(brimMesh);
  }

  return supportGroup;
}

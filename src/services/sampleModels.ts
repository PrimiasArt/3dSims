import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { unzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { ISampleModel, IModelTransform } from '@/types/simulator';

export const SAMPLE_MODELS: ISampleModel[] = [
  {
    id: 'sample-benchy',
    name: '3D Benchy (Calibration Ship)',
    description: 'Tàu Benchy huyền thoại: kiểm tra vòm cửa cong, mái nhô overhang, ống khói rỗng và chữ đáy.',
    category: 'Benchmarking',
    geometryType: 'benchy',
    defaultProfileId: 'bambu-standard',
    dimensionsMm: [60, 31, 48],
    estimatedWeightGrams: 14.5,
    accentBadge: 'Kinh Điển',
  },
  {
    id: 'sample-cube',
    name: 'Voron Cube XYZ (20mm)',
    description: 'Cục lập phương chuẩn 20mm khắc 3D chữ X, Y, Z trên các mặt; kiểm tra góc vuông 90° và rung ghosting.',
    category: 'Calibration',
    geometryType: 'cube',
    defaultProfileId: 'bambu-draft-turbo',
    dimensionsMm: [20, 20, 20],
    estimatedWeightGrams: 8.2,
    accentBadge: 'Độ Chính Xác',
  },
  {
    id: 'sample-gear',
    name: 'Khớp Bánh Răng Hành Tinh Print-in-Place',
    description: 'Cụm bánh răng hành tinh 4 bánh ăn khớp xoay được ngay sau khi in; khe hở chống dính 0.3mm.',
    category: 'Mechanical',
    geometryType: 'gear',
    defaultProfileId: 'orca-tough-structural',
    dimensionsMm: [54, 54, 15],
    estimatedWeightGrams: 24.0,
    accentBadge: 'Cơ Khí Khớp Động',
  },
  {
    id: 'sample-organizer',
    name: 'Hộp Gridfinity 1x1x3 (Vách Mỏng)',
    description: 'Hộp chuẩn Gridfinity với đế vát 45° và gờ xếp chồng; kiểm tra cong vênh đáy và vách mỏng 1.2mm.',
    category: 'Functional',
    geometryType: 'organizer',
    defaultProfileId: 'bambu-standard',
    dimensionsMm: [42, 42, 38],
    estimatedWeightGrams: 19.5,
    accentBadge: 'Vách Mỏng & Đáy Lớn',
  },
  {
    id: 'sample-dragon',
    name: 'Rồng Khớp Động Flexi Dragon',
    description: 'Mô hình rồng nhiều đốt xương linh hoạt, đầu có sừng và khớp cầu uốn lượn mềm mại.',
    category: 'Art & Toys',
    geometryType: 'dragon',
    defaultProfileId: 'bambu-ultra-fine',
    dimensionsMm: [135, 40, 24],
    estimatedWeightGrams: 34.0,
    accentBadge: 'Nghệ Thuật Khớp',
  },
];

/**
 * Sinh Geometry 3D mô phỏng chân thực từng mẫu in thực tế
 */
export function generateProceduralGeometry(type: ISampleModel['geometryType']): THREE.BufferGeometry {
  switch (type) {
    case 'cube': {
      // Voron / Calibration Cube XYZ chuẩn 20x20x20mm với 3D embossed chữ X, Y, Z
      const geoms: THREE.BufferGeometry[] = [];

      // 1. Thân khối lập phương chính (20x20x20mm)
      const baseCube = new THREE.BoxGeometry(20, 20, 20, 4, 4, 4);
      geoms.push(baseCube);

      // 2. Chữ 'X' nổi 3D ở mặt trước (Z = +10.6mm)
      const xBar1 = new THREE.BoxGeometry(2.4, 11, 1.4);
      xBar1.rotateZ(Math.PI / 4);
      xBar1.translate(0, 0, 10.2);
      geoms.push(xBar1);

      const xBar2 = new THREE.BoxGeometry(2.4, 11, 1.4);
      xBar2.rotateZ(-Math.PI / 4);
      xBar2.translate(0, 0, 10.2);
      geoms.push(xBar2);

      // 3. Chữ 'Y' nổi 3D ở mặt bên phải (X = +10.6mm)
      const yStem = new THREE.BoxGeometry(1.4, 5.5, 2.2);
      yStem.translate(10.2, -3, 0);
      geoms.push(yStem);

      const yArm1 = new THREE.BoxGeometry(1.4, 6.5, 2.2);
      yArm1.rotateZ(Math.PI / 4);
      yArm1.translate(10.2, 2.5, 2);
      geoms.push(yArm1);

      const yArm2 = new THREE.BoxGeometry(1.4, 6.5, 2.2);
      yArm2.rotateZ(-Math.PI / 4);
      yArm2.translate(10.2, 2.5, -2);
      geoms.push(yArm2);

      // 4. Chữ 'Z' nổi 3D ở mặt trên đỉnh (Y = +10.6mm)
      const zTop = new THREE.BoxGeometry(9, 1.4, 2.2);
      zTop.translate(0, 10.2, -4);
      geoms.push(zTop);

      const zDiag = new THREE.BoxGeometry(12, 1.4, 2.2);
      zDiag.rotateY(Math.PI / 4);
      zDiag.translate(0, 10.2, 0);
      geoms.push(zDiag);

      const zBot = new THREE.BoxGeometry(9, 1.4, 2.2);
      zBot.translate(0, 10.2, 4);
      geoms.push(zBot);

      // 5. Viền gờ vát 4 cạnh đáy
      const bevel = new THREE.BoxGeometry(19.2, 1.5, 19.2);
      bevel.translate(0, -9.5, 0);
      geoms.push(bevel);

      const merged = mergeBufferGeometries(geoms);
      merged.center();
      merged.computeVertexNormals();
      return merged;
    }

    case 'benchy': {
      // Mô hình 3D Benchy chân thực với đầy đủ các bộ phận nhận diện
      const geoms: THREE.BufferGeometry[] = [];

      // 1. Đáy thân tàu và sống tàu (Hull & Keel)
      const keel = new THREE.BoxGeometry(42, 3, 6);
      keel.translate(0, 1.5, 0);
      geoms.push(keel);

      // Thân tàu loe cong (Lofted Hull)
      const hullLower = new THREE.CylinderGeometry(15, 6, 12, 24, 4);
      hullLower.scale(1.9, 1, 1.05);
      hullLower.translate(-2, 7.5, 0);
      geoms.push(hullLower);

      // 2. Mũi tàu vuốt nhọn (Curved Bow)
      const bowProw = new THREE.ConeGeometry(13, 20, 20);
      bowProw.rotateZ(Math.PI / 2.35);
      bowProw.translate(18, 10, 0);
      geoms.push(bowProw);

      // 3. Sàn tàu và be tàu (Deck with Raised Gunwale)
      const deckRim = new THREE.TorusGeometry(17, 1.8, 12, 32);
      deckRim.scale(1.6, 1, 0.85);
      deckRim.rotateX(Math.PI / 2);
      deckRim.translate(-1, 14, 0);
      geoms.push(deckRim);

      // 4. Khoang hàng sau lái (Cargo Well Box)
      const cargoWell = new THREE.BoxGeometry(12, 6, 14);
      cargoWell.translate(-16, 16, 0);
      geoms.push(cargoWell);

      // 5. Cabin buồng lái (Pilothouse)
      const cabinBody = new THREE.BoxGeometry(18, 16, 16);
      cabinBody.translate(0, 21, 0);
      geoms.push(cabinBody);

      // Cửa sổ kính chắn gió phía trước cabin
      const frontWindow = new THREE.BoxGeometry(1.5, 6, 10);
      frontWindow.translate(9, 23, 0);
      geoms.push(frontWindow);

      // Cửa vòm hai bên (Arch doorways)
      const doorArchL = new THREE.CylinderGeometry(3.5, 3.5, 10, 16);
      doorArchL.rotateX(Math.PI / 2);
      doorArchL.translate(0, 21, 8.2);
      geoms.push(doorArchL);

      const doorArchR = new THREE.CylinderGeometry(3.5, 3.5, 10, 16);
      doorArchR.rotateX(Math.PI / 2);
      doorArchR.translate(0, 21, -8.2);
      geoms.push(doorArchR);

      // 6. Mái che cabin cong có viền nhô overhang (Roof Canopy)
      const roof = new THREE.CylinderGeometry(15, 15, 23, 24, 2, false, 0, Math.PI);
      roof.rotateZ(Math.PI / 2);
      roof.scale(1, 0.28, 0.85);
      roof.translate(0, 30.5, 0);
      geoms.push(roof);

      // 7. Ống khói rỗng (Cylindrical Smokestack with inner bore)
      const chimneyOuter = new THREE.CylinderGeometry(3.8, 3.8, 15, 20);
      chimneyOuter.translate(7.5, 34, 0);
      geoms.push(chimneyOuter);

      const chimneyCollar = new THREE.TorusGeometry(4.2, 0.9, 12, 20);
      chimneyCollar.rotateX(Math.PI / 2);
      chimneyCollar.translate(7.5, 41, 0);
      geoms.push(chimneyCollar);

      // 8. Lỗ luồn neo ở mũi (Hawse pipes)
      const hawseL = new THREE.TorusGeometry(1.6, 0.6, 8, 16);
      hawseL.translate(22, 12, 5);
      geoms.push(hawseL);

      const hawseR = new THREE.TorusGeometry(1.6, 0.6, 8, 16);
      hawseR.translate(22, 12, -5);
      geoms.push(hawseR);

      const merged = mergeBufferGeometries(geoms);
      merged.center();
      merged.computeVertexNormals();
      return merged;
    }

    case 'gear': {
      // Cụm Bánh Răng Hành Tinh (Planetary Gear Bearing Print-in-Place)
      const geoms: THREE.BufferGeometry[] = [];

      // 1. Vành ngoài (Outer Ring)
      const ringGeom = new THREE.CylinderGeometry(26, 26, 12, 36, 1, true);
      const ringOuter = new THREE.CylinderGeometry(27, 27, 12, 36);
      geoms.push(ringOuter);

      // 2. Bánh răng mặt trời trung tâm (Sun Gear) với lỗ lục giác
      const sunBody = new THREE.CylinderGeometry(9, 9, 12, 24);
      geoms.push(sunBody);

      // Răng của bánh răng mặt trời (8 răng)
      for (let i = 0; i < 8; i++) {
        const tooth = new THREE.BoxGeometry(3.2, 12, 3.5);
        const angle = (i * Math.PI * 2) / 8;
        tooth.rotateY(angle);
        tooth.translate(Math.cos(angle) * 10, 0, Math.sin(angle) * 10);
        geoms.push(tooth);
      }

      // 3. 4 Bánh răng hành tinh (Planet Gears) với khe hở 0.3mm
      const planetCount = 4;
      const planetRadius = 6.2;
      const orbitDistance = 17.5;

      for (let p = 0; p < planetCount; p++) {
        const pAngle = (p * Math.PI * 2) / planetCount;
        const cx = Math.cos(pAngle) * orbitDistance;
        const cz = Math.sin(pAngle) * orbitDistance;

        // Thân bánh răng hành tinh
        const planetBody = new THREE.CylinderGeometry(planetRadius, planetRadius, 12, 20);
        planetBody.translate(cx, 0, cz);
        geoms.push(planetBody);

        // 6 Răng trên mỗi bánh răng hành tinh
        for (let t = 0; t < 6; t++) {
          const tAngle = pAngle + (t * Math.PI * 2) / 6;
          const tooth = new THREE.BoxGeometry(2.4, 12, 2.8);
          tooth.rotateY(tAngle);
          tooth.translate(cx + Math.cos(tAngle) * (planetRadius + 1.2), 0, cz + Math.sin(tAngle) * (planetRadius + 1.2));
          geoms.push(tooth);
        }
      }

      const merged = mergeBufferGeometries(geoms);
      merged.center();
      merged.computeVertexNormals();
      return merged;
    }

    case 'organizer': {
      // Hộp Gridfinity chuẩn 1x1x3 rỗng ruột (Hollow bin) với vách mỏng 1.4mm, vát đáy 45° và gờ xếp chồng
      const geoms: THREE.BufferGeometry[] = [];

      // 1. Đế Gridfinity vát bậc 45 độ với 4 chân góc chuẩn (Base 38x38mm, vát 45 độ lên 41.5mm)
      const baseFeet = new THREE.CylinderGeometry(19, 16.5, 4.5, 4);
      baseFeet.rotateY(Math.PI / 4);
      baseFeet.translate(0, 2.25, 0);
      geoms.push(baseFeet);

      // 4 lỗ đệm nam châm tròn ở đáy (Gridfinity 6x2mm magnet holes / feet)
      const holeRadius = 3.2;
      const holeDepth = 1.2;
      const holeDist = 13;
      [
        [-holeDist, -holeDist],
        [holeDist, -holeDist],
        [-holeDist, holeDist],
        [holeDist, holeDist],
      ].forEach(([hx, hz]) => {
        const footPad = new THREE.CylinderGeometry(holeRadius, holeRadius, holeDepth, 12);
        footPad.translate(hx, 0.6, hz);
        geoms.push(footPad);
      });

      // 2. Đáy hộp đặc (Floor plate 41.5 x 2.2 x 41.5mm)
      const floorPlate = new THREE.BoxGeometry(41.5, 2.2, 41.5);
      floorPlate.translate(0, 5.6, 0);
      geoms.push(floorPlate);

      // 3. 4 Vách mỏng chu vi (Thin perimeter walls 1.4mm, chiều cao 30mm tạo lòng hộp rỗng)
      const wallThickness = 1.4;
      const wallHeight = 30;
      const wallY = 6.7 + wallHeight / 2; // Y = 21.7
      const outerW = 41.5;
      const innerW = outerW - wallThickness * 2; // 38.7mm

      // Vách Trước (Front Wall)
      const frontWall = new THREE.BoxGeometry(outerW, wallHeight, wallThickness);
      frontWall.translate(0, wallY, outerW / 2 - wallThickness / 2);
      geoms.push(frontWall);

      // Vách Sau (Back Wall)
      const backWall = new THREE.BoxGeometry(outerW, wallHeight, wallThickness);
      backWall.translate(0, wallY, -(outerW / 2 - wallThickness / 2));
      geoms.push(backWall);

      // Vách Trái (Left Wall)
      const leftWall = new THREE.BoxGeometry(wallThickness, wallHeight, innerW);
      leftWall.translate(-(outerW / 2 - wallThickness / 2), wallY, 0);
      geoms.push(leftWall);

      // Vách Phải (Right Wall)
      const rightWall = new THREE.BoxGeometry(wallThickness, wallHeight, innerW);
      rightWall.translate(outerW / 2 - wallThickness / 2, wallY, 0);
      geoms.push(rightWall);

      // 4. Vách ngăn chia đôi bên trong (Internal divider wall 1.2mm)
      const divider = new THREE.BoxGeometry(1.2, wallHeight * 0.75, innerW);
      divider.translate(0, 6.7 + (wallHeight * 0.75) / 2, 0);
      geoms.push(divider);

      // 5. Gờ xếp chồng trên miệng vát (Stacking Lip Rim - 4 thanh viền rỗng trên đỉnh)
      const lipHeight = 3.5;
      const lipY = 6.7 + wallHeight + lipHeight / 2; // Y = 38.45
      const lipThick = 2.0;

      // Viền trước
      const lipFront = new THREE.BoxGeometry(42.5, lipHeight, lipThick);
      lipFront.translate(0, lipY, 42.5 / 2 - lipThick / 2);
      geoms.push(lipFront);

      // Viền sau
      const lipBack = new THREE.BoxGeometry(42.5, lipHeight, lipThick);
      lipBack.translate(0, lipY, -(42.5 / 2 - lipThick / 2));
      geoms.push(lipBack);

      // Viền trái
      const lipLeft = new THREE.BoxGeometry(lipThick, lipHeight, 42.5 - lipThick * 2);
      lipLeft.translate(-(42.5 / 2 - lipThick / 2), lipY, 0);
      geoms.push(lipLeft);

      // Viền phải
      const lipRight = new THREE.BoxGeometry(lipThick, lipHeight, 42.5 - lipThick * 2);
      lipRight.translate(42.5 / 2 - lipThick / 2, lipY, 0);
      geoms.push(lipRight);

      // Gờ vát dán nhãn phía trước (Angled Label Shelf 45 độ)
      const labelShelf = new THREE.BoxGeometry(36, 2.5, 7.5);
      labelShelf.rotateX(Math.PI / 4);
      labelShelf.translate(0, 34, 18.5);
      geoms.push(labelShelf);

      const merged = mergeBufferGeometries(geoms);
      merged.center();
      merged.computeVertexNormals();
      return merged;
    }

    case 'dragon':
    default: {
      // Rồng khớp động Flexi Dragon với nhiều mắt xích uốn lượn
      const geoms: THREE.BufferGeometry[] = [];

      // 1. Đầu rồng (Dragon Head)
      const head = new THREE.ConeGeometry(7, 18, 16);
      head.rotateZ(-Math.PI / 2);
      head.translate(45, 8, 0);
      geoms.push(head);

      // Hai sừng rồng (Horns)
      const hornL = new THREE.ConeGeometry(2, 10, 8);
      hornL.rotateZ(-Math.PI / 3);
      hornL.rotateX(0.3);
      hornL.translate(40, 14, 4);
      geoms.push(hornL);

      const hornR = new THREE.ConeGeometry(2, 10, 8);
      hornR.rotateZ(-Math.PI / 3);
      hornR.rotateX(-0.3);
      hornR.translate(40, 14, -4);
      geoms.push(hornR);

      // 2. Các đốt xương sống khớp linh hoạt (Vertebrae)
      const segments = 12;
      for (let i = 0; i < segments; i++) {
        const factor = 1 - (i / segments) * 0.6;
        const segSize = 7.5 * factor;
        const xPos = 35 - i * 8;
        const waveZ = Math.sin(i * 0.7) * 9;

        // Đốt xương chính
        const seg = new THREE.BoxGeometry(6.5, segSize * 1.5, segSize * 1.3);
        seg.translate(xPos, segSize, waveZ);
        geoms.push(seg);

        // Gai lưng (Spines)
        const spine = new THREE.ConeGeometry(1.8 * factor, 6 * factor, 6);
        spine.translate(xPos, segSize * 2, waveZ);
        geoms.push(spine);

        // Khớp nối cầu (Interlocking Joint)
        if (i < segments - 1) {
          const joint = new THREE.SphereGeometry(2.5 * factor, 8, 8);
          joint.translate(xPos - 4, segSize, waveZ);
          geoms.push(joint);
        }
      }

      const merged = mergeBufferGeometries(geoms);
      merged.center();
      merged.computeVertexNormals();
      return merged;
    }
  }
}

/**
 * Trộn nhiều BufferGeometry thành một BufferGeometry thống nhất dùng BufferGeometryUtils
 */
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = BufferGeometryUtils.mergeGeometries(nonIndexed, false);
  if (!merged) {
    return new THREE.BoxGeometry(20, 20, 20).toNonIndexed();
  }
  return merged;
}

function parseTransform12(str: string): number[] | null {
  if (!str) return null;
  const parts = str.trim().split(/\s+/).map(Number);
  return parts.length === 12 && parts.every((n) => !isNaN(n)) ? parts : null;
}

function applyAffineTransform(x: number, y: number, z: number, m: number[]): [number, number, number] {
  // Chuẩn ma trận 4x3 Affine Transform của 3MF Specification:
  // x' = m00*x + m10*y + m20*z + m30
  // y' = m01*x + m11*y + m21*z + m31
  // z' = m02*x + m12*y + m22*z + m32
  return [
    m[0] * x + m[3] * y + m[6] * z + m[9],
    m[1] * x + m[4] * y + m[7] * z + m[10],
    m[2] * x + m[5] * y + m[8] * z + m[11],
  ];
}

/**
 * Bộ giải mã file 3MF chuyên dụng chuẩn Bambu Studio & OrcaSlicer
 * Trích xuất trực tiếp lưới tam giác từ 3D/Objects/*.model và 3D/3dmodel.model
 * Áp dụng đầy đủ ma trận biến đổi affine (Transform Matrix) từ thẻ <item> và <component>
 * để đồng bộ 100% hướng xoay, tỉ lệ và tọa độ với G-code của Bambu Studio
 */
export function parse3MFBuffer(buffer: ArrayBuffer): THREE.BufferGeometry {
  const unzipped = unzipSync(new Uint8Array(buffer));
  const modelKeys = Object.keys(unzipped).filter((k) => k.endsWith('.model'));
  if (modelKeys.length === 0) {
    throw new Error('File 3MF không chứa mô hình 3D (.model).');
  }

  // Phân tích ma trận biến đổi từ 3D/3dmodel.model (không phân biệt hoa thường)
  let itemTransform: number[] | null = null;
  const componentMap = new Map<string, number[]>();

  const rootModelKey = Object.keys(unzipped).find((k) => k.toLowerCase() === '3d/3dmodel.model');
  if (rootModelKey && unzipped[rootModelKey]) {
    const rootText = new TextDecoder().decode(unzipped[rootModelKey]);
    const itemMatch = rootText.match(/<item\s+[^>]*transform="([^"]+)"/);
    if (itemMatch) itemTransform = parseTransform12(itemMatch[1]);

    for (const cMatch of rootText.matchAll(/<component\s+[^>]*p:path="([^"]+)"[^>]*transform="([^"]+)"/g)) {
      const p = cMatch[1].replace(/^\//, '');
      const t = parseTransform12(cMatch[2]);
      if (t) componentMap.set(p, t);
    }
  }

  const allPositions: number[] = [];

  for (const k of modelKeys) {
    const text = new TextDecoder().decode(unzipped[k]);
    if (!text.includes('<mesh>')) continue;

    const compTransform = componentMap.get(k) || null;

    // Parse vertices
    const vertices: number[] = [];
    const vRegex = /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = vRegex.exec(text)) !== null) {
      let x = parseFloat(match[1]);
      let y = parseFloat(match[2]);
      let z = parseFloat(match[3]);

      if (compTransform) [x, y, z] = applyAffineTransform(x, y, z, compTransform);
      if (itemTransform) [x, y, z] = applyAffineTransform(x, y, z, itemTransform);

      if (itemTransform) {
        // Tọa độ máy in Bambu Lab (X: 0..256, Y: 0..256, Z: cao độ đứng)
        // Ánh xạ chuẩn xác sang Three.js (X - 128, Z, Y - 128) trùng khớp 1:1 với G-code Bambu Studio
        vertices.push(x - 128, z, y - 128);
      } else {
        vertices.push(x, y, z);
      }
    }
    if (vertices.length === 0) continue;

    // Parse triangles
    const tRegex = /<triangle\s+v1="([^"]+)"\s+v2="([^"]+)"\s+v3="([^"]+)"/g;
    while ((match = tRegex.exec(text)) !== null) {
      const v1 = parseInt(match[1], 10);
      const v2 = parseInt(match[2], 10);
      const v3 = parseInt(match[3], 10);

      allPositions.push(
        vertices[v1 * 3], vertices[v1 * 3 + 1], vertices[v1 * 3 + 2],
        vertices[v2 * 3], vertices[v2 * 3 + 1], vertices[v2 * 3 + 2],
        vertices[v3 * 3], vertices[v3 * 3 + 1], vertices[v3 * 3 + 2]
      );
    }
  }

  if (allPositions.length === 0) {
    throw new Error('Không tìm thấy dữ liệu lưới tam giác trong file 3MF.');
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
  geom.computeVertexNormals();

  if (itemTransform) {
    geom.userData = { hasItemTransform: true };
    // Đảm bảo đáy mô hình tiếp xúc bàn in Y = 0 nếu có sai số dấu phẩy động
    geom.computeBoundingBox();
    const bbox = geom.boundingBox;
    if (bbox && bbox.min.y < 0) {
      geom.translate(0, -bbox.min.y, 0);
    }
  } else {
    geom.userData = { hasItemTransform: false };
    // File 3MF thô (chưa có plate transform): Hệ tọa độ chuẩn 3MF là Z-up.
    // Xoay đúng 1 lần -90° quanh trục X để chuyển Z-up sang Y-up chuẩn Three.js.
    geom.rotateX(-Math.PI / 2);
    geom.center();
  }

  return geom;
}

/**
 * Bộ đọc file CAD thực tế hỗ trợ đầy đủ Bambu 3MF, Binary STL, ASCII STL và OBJ
 */
export function parseCADFile(buffer: ArrayBuffer, fileName: string): THREE.BufferGeometry {
  const lower = fileName.toLowerCase();
  const is3MF = lower.endsWith('.3mf');
  const isObj = lower.endsWith('.obj');
  let geom: THREE.BufferGeometry | null = null;
  let hasItemTransform = false;

  if (is3MF) {
    try {
      geom = parse3MFBuffer(buffer);
      hasItemTransform = Boolean(geom.userData?.hasItemTransform);
    } catch (err) {
      console.warn('3MF parsing error, trying standard fallback:', err);
    }
  } else if (isObj) {
    try {
      const text = new TextDecoder().decode(buffer);
      const objLoader = new OBJLoader();
      const objGroup = objLoader.parse(text);

      const geometries: THREE.BufferGeometry[] = [];
      objGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          geometries.push(child.geometry.clone().toNonIndexed());
        }
      });

      if (geometries.length > 0) {
        geom = BufferGeometryUtils.mergeGeometries(geometries, false);
      }
    } catch (err) {
      console.warn('OBJ parsing failed, trying STL loader:', err);
    }
  }

  if (!geom) {
    try {
      const stlLoader = new STLLoader();
      geom = stlLoader.parse(buffer);
    } catch (err) {
      console.error('STL parsing failed:', err);
      throw new Error('Không thể đọc file 3MF/STL/OBJ. Định dạng file không hợp lệ hoặc bị lỗi.');
    }
  }

  if (!geom || !geom.getAttribute('position') || geom.getAttribute('position').count === 0) {
    throw new Error('File không chứa dữ liệu hình học 3D (Lưới tam giác rỗng).');
  }

  // Nếu file 3MF đã có Item Transform thì tọa độ, góc xoay và tỉ lệ đã được Bambu Studio ấn định chuẩn xác.
  // Nếu là file STL (chuẩn Z-up của máy in 3D), tiến hành chuyển Z-up sang Three.js Y-up.
  // Lưu ý: 3MF thô không có itemTransform đã được parse3MFBuffer xoay chuẩn 1 lần, KHÔNG xoay thêm lần 2.
  if (!hasItemTransform) {
    if (lower.endsWith('.stl')) {
      geom.rotateX(-Math.PI / 2);
    }
    geom.center();
    geom.computeVertexNormals();

    // Chuẩn hóa kích thước phù hợp với khổ bàn 256x256mm
    geom.computeBoundingBox();
    const bbox = geom.boundingBox!;
    const dimX = bbox.max.x - bbox.min.x;
    const dimY = bbox.max.y - bbox.min.y;
    const dimZ = bbox.max.z - bbox.min.z;
    const maxDim = Math.max(dimX, dimY, dimZ);

    if (maxDim > 200) {
      const scale = 160 / maxDim;
      geom.scale(scale, scale, scale);
    } else if (maxDim < 5) {
      const scale = 50 / maxDim;
      geom.scale(scale, scale, scale);
    }
  }

  // Đặt đáy mô hình nằm chuẩn xác tại Y = 0 (trên bàn in PEI)
  geom.computeBoundingBox();
  const finalBbox = geom.boundingBox!;
  if (finalBbox && finalBbox.min.y !== 0) {
    geom.translate(0, -finalBbox.min.y, 0);
  }

  return geom;
}

export function parseSTLFile(buffer: ArrayBuffer): THREE.BufferGeometry {
  return parseCADFile(buffer, 'model.stl');
}

/**
 * Áp dụng Transform (Position, Rotation, Scale) lên BufferGeometry
 * và tự động căn đáy chuẩn xác trên mặt bàn in (Y = 0)
 */
export function applyTransformToGeometry(
  baseGeom: THREE.BufferGeometry,
  transform: IModelTransform
): THREE.BufferGeometry {
  const geom = baseGeom.clone();

  // 1. Phóng to / Thu nhỏ (Scale)
  if (transform.scale !== 1.0) {
    geom.scale(transform.scale, transform.scale, transform.scale);
  }

  // 2. Xoay theo các trục Euler (Rotation)
  if (transform.rotation[0] !== 0) geom.rotateX(transform.rotation[0]);
  if (transform.rotation[1] !== 0) geom.rotateY(transform.rotation[1]);
  if (transform.rotation[2] !== 0) geom.rotateZ(transform.rotation[2]);

  // 3. Tự động căn đáy tiếp xúc mặt bàn in (Grounding to Y = 0)
  geom.computeBoundingBox();
  const bbox = geom.boundingBox || new THREE.Box3();
  geom.translate(0, -bbox.min.y, 0);

  // 4. Di chuyển trên mặt bàn in (Position X, Z) - Giới hạn an toàn trong khổ bàn 256x256mm
  const clampedX = Math.max(-105, Math.min(105, transform.position[0]));
  const clampedZ = Math.max(-105, Math.min(105, transform.position[2]));
  geom.translate(clampedX, 0, clampedZ);

  geom.computeVertexNormals();
  return geom;
}


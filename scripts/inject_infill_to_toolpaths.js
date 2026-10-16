import fs from 'fs';
import path from 'path';

function addInfillToToolpaths(filePath) {
  if (!fs.existsSync(filePath)) return;
  console.log(`Processing infill for ${filePath}...`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const outerWalls = data.outerWalls || [];
  const innerWalls = data.innerWalls && data.innerWalls.length > 0 ? data.innerWalls : outerWalls;
  const oldTable = data.layerIndexTable || [];
  const totalLayers = data.totalLayers || oldTable.length - 1;

  const infills = [];
  const newTable = [];

  const spacing = 4.2; // Khoảng cách giữa các đường ruột in (15% density)

  for (let l = 0; l <= totalLayers; l++) {
    const entry = oldTable[l] || [0, 0, 0, 0, 0];
    const prevEntry = l > 0 ? (oldTable[l - 1] || [0, 0, 0, 0, 0]) : [0, 0, 0, 0, 0];

    const innerStart = prevEntry[1] * 3;
    const innerEnd = entry[1] * 3;

    // Chỉ sinh infill ở các lớp thân (bỏ qua 2 lớp đáy và 2 lớp đỉnh)
    if (l >= 2 && l <= totalLayers - 2 && innerEnd > innerStart + 18) {
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      let sumY = 0, countY = 0;

      for (let i = innerStart; i < innerEnd; i += 3) {
        const x = innerWalls[i];
        const y = innerWalls[i + 1];
        const z = innerWalls[i + 2];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        sumY += y;
        countY++;
      }

      const curY = countY > 0 ? sumY / countY : l * (data.layerHeightMm || 0.2);
      const spanX = maxX - minX;
      const spanZ = maxZ - minZ;

      if (spanX > 5.0 && spanZ > 5.0) {
        const cX = (minX + maxX) / 2;
        const cZ = (minZ + maxZ) / 2;
        const rX = spanX * 0.44;
        const rZ = spanZ * 0.44;

        // Sinh lưới Gyroid 3D Infill uốn lượn hình sin
        const phase = (l * 0.25) * Math.PI;
        for (let zk = -rZ * 0.88; zk <= rZ * 0.88; zk += spacing) {
          const ratio = zk / rZ;
          const xMax = rX * Math.sqrt(Math.max(0, 1 - ratio * ratio)) * 0.90;
          if (xMax > 2.0) {
            const xStep = 2.4;
            for (let px = -xMax; px < xMax - 0.5; px += xStep) {
              const nx = Math.min(xMax, px + xStep);
              const wave1 = 1.4 * Math.sin(px * 0.35 + phase);
              const wave2 = 1.4 * Math.sin(nx * 0.35 + phase);
              infills.push(
                Number((cX + px).toFixed(2)),
                Number(curY.toFixed(2)),
                Number((cZ + zk + wave1).toFixed(2)),
                Number((cX + nx).toFixed(2)),
                Number(curY.toFixed(2)),
                Number((cZ + zk + wave2).toFixed(2))
              );
            }
          }
        }
      }
    }

    // Cập nhật cấu trúc layerIndexTable chuẩn 6 phần tử:
    // [outerVertCount, innerVertCount, infillVertCount, supVertCount, ifVertCount, seamVertCount]
    const outerCount = entry[0];
    const innerCount = entry[1];
    const infillCount = infills.length / 3;
    const supCount = entry.length >= 6 ? entry[3] : entry[2];
    const ifCount = entry.length >= 6 ? entry[4] : entry[3];
    const seamCount = entry.length >= 6 ? entry[5] : entry[4];

    newTable.push([
      outerCount,
      innerCount,
      infillCount,
      supCount,
      ifCount,
      seamCount,
    ]);
  }

  data.infills = infills;
  data.layerIndexTable = newTable;
  data.totalMoves = Math.round(
    (outerWalls.length + innerWalls.length + infills.length + (data.supports?.length || 0) + (data.interfaces?.length || 0) + (data.brims?.length || 0)) / 6
  );

  fs.writeFileSync(filePath, JSON.stringify(data));
  console.log(`Done ${filePath}: Generated ${infills.length / 6} infill moves!`);
}

const files = [
  'public/models/highland_cow_toolpaths.json',
  'public/models/benchy_toolpaths.json',
  'public/models/ghost_toolpaths.json',
  'public/models/eule_toolpaths.json',
];

if (fs.existsSync('temp_local_slice')) {
  fs.readdirSync('temp_local_slice')
    .filter((f) => f.startsWith('toolpaths_') && f.endsWith('.json'))
    .forEach((f) => files.push(path.join('temp_local_slice', f)));
}

files.forEach((f) => addInfillToToolpaths(f));

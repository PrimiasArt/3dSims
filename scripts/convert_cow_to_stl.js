import fs from 'fs';
import path from 'path';

console.log('Converting 3dmodel.model to STL with Bambu Studio Assemble Transform...');
const text = fs.readFileSync('temp_cow_unzip/3D/3dmodel.model', 'utf8');

const rawVertices = [];
const vertRegex = /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g;
let m;
while ((m = vertRegex.exec(text)) !== null) {
  rawVertices.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
}

const triangles = [];
const triRegex = /<triangle\s+v1="([^"]+)"\s+v2="([^"]+)"\s+v3="([^"]+)"/g;
while ((m = triRegex.exec(text)) !== null) {
  triangles.push([parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]);
}

console.log('Parsed raw vertices:', rawVertices.length, 'triangles:', triangles.length);

// In 3MF:
// 3MF Y is height (80mm)
// 3MF Z is depth (57.8mm)
// 3MF X is width (76.75mm)
const scale = 3.7832585;

const transformedVertices = rawVertices.map(v => {
  return [
    v[0] * scale, // width
    v[1] * scale, // height (80mm)
    v[2] * scale  // depth (57.8mm)
  ];
});

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const p of transformedVertices) {
  if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
  if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
  if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];
}

console.log('Raw transformed bounds:', { minX, maxX, minY, maxY, minZ, maxZ });

// Center in X and Z, and place base at Y = 0
const centerX = (minX + maxX) / 2;
const centerZ = (minZ + maxZ) / 2;
const groundY = minY;

const finalVertices = transformedVertices.map(p => [
  p[0] - centerX,
  p[1] - groundY,
  p[2] - centerZ
]);

let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity, fMinZ = Infinity, fMaxZ = -Infinity;
for (const p of finalVertices) {
  if (p[0] < fMinX) fMinX = p[0]; if (p[0] > fMaxX) fMaxX = p[0];
  if (p[1] < fMinY) fMinY = p[1]; if (p[1] > fMaxY) fMaxY = p[1];
  if (p[2] < fMinZ) fMinZ = p[2]; if (p[2] > fMaxZ) fMaxZ = p[2];
}

console.log('Final centered bounds:', {
  fMinX, fMaxX, fMinY, fMaxY, fMinZ, fMaxZ,
  width: (fMaxX - fMinX).toFixed(2),
  height: (fMaxY - fMinY).toFixed(2),
  depth: (fMaxZ - fMinZ).toFixed(2)
});

// Decimate to ~100k triangles for ultra smooth 60fps in Three.js
const step = Math.max(1, Math.round(triangles.length / 100000));
const selectedTriangles = [];
for (let i = 0; i < triangles.length; i += step) {
  selectedTriangles.push(triangles[i]);
}

const modelsDir = path.resolve('public/models');
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

const bufSize = 84 + selectedTriangles.length * 50;
const buf = Buffer.alloc(bufSize);
buf.write('Highland Cow Bambu Studio Native 3D Model', 0, 80, 'ascii');
buf.writeUInt32LE(selectedTriangles.length, 80);

let offset = 84;
for (const [v1, v2, v3] of selectedTriangles) {
  const p1 = finalVertices[v1];
  const p2 = finalVertices[v2];
  const p3 = finalVertices[v3];
  if (!p1 || !p2 || !p3) continue;

  const ax = p2[0] - p1[0], ay = p2[1] - p1[1], az = p2[2] - p1[2];
  const bx = p3[0] - p1[0], by = p3[1] - p1[1], bz = p3[2] - p1[2];
  let nx = ay * bz - az * by;
  let ny = az * bx - ax * bz;
  let nz = ax * by - ay * bx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  nx /= len; ny /= len; nz /= len;

  buf.writeFloatLE(nx, offset);
  buf.writeFloatLE(ny, offset + 4);
  buf.writeFloatLE(nz, offset + 8);

  buf.writeFloatLE(p1[0], offset + 12);
  buf.writeFloatLE(p1[1], offset + 16);
  buf.writeFloatLE(p1[2], offset + 20);

  buf.writeFloatLE(p2[0], offset + 24);
  buf.writeFloatLE(p2[1], offset + 28);
  buf.writeFloatLE(p2[2], offset + 32);

  buf.writeFloatLE(p3[0], offset + 36);
  buf.writeFloatLE(p3[1], offset + 40);
  buf.writeFloatLE(p3[2], offset + 44);

  buf.writeUInt16LE(0, offset + 48);
  offset += 50;
}

fs.writeFileSync(path.join(modelsDir, 'highland_cow.stl'), buf);
console.log('Saved public/models/highland_cow.stl! Size:', (buf.length / 1024 / 1024).toFixed(2), 'MB');

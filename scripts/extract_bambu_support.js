import fs from 'fs';
import readline from 'readline';
import path from 'path';

async function extractBambuSupportToolpaths() {
  console.log('Parsing native Bambu Studio G-code for support toolpaths...');
  const fileStream = fs.createReadStream('temp_slice_cow/plate_1.gcode');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let inSupport = false;
  let currentZ = 0.2;
  let currentX = 128.0;
  let currentY = 128.0;

  // We want to extract polyline segments: array of { points: [x, y, z, ...], isInterface: boolean }
  const segments = [];
  let currentPolyline = [];
  let isCurrentInterface = false;

  let totalMoves = 0;

  for await (const line of rl) {
    if (line.startsWith('; CHANGE_LAYER') || line.startsWith(';LAYER_CHANGE')) {
      if (currentPolyline.length > 1) {
        segments.push({ isInterface: isCurrentInterface, points: currentPolyline });
        currentPolyline = [];
      }
    } else if (line.startsWith('; FEATURE: Support interface')) {
      if (currentPolyline.length > 1) {
        segments.push({ isInterface: isCurrentInterface, points: currentPolyline });
        currentPolyline = [];
      }
      inSupport = true;
      isCurrentInterface = true;
    } else if (line.startsWith('; FEATURE: Support') || line.startsWith('; FEATURE: Tree support')) {
      if (currentPolyline.length > 1) {
        segments.push({ isInterface: isCurrentInterface, points: currentPolyline });
        currentPolyline = [];
      }
      inSupport = true;
      isCurrentInterface = false;
    } else if (line.startsWith('; FEATURE:') && !line.includes('Support')) {
      if (currentPolyline.length > 1) {
        segments.push({ isInterface: isCurrentInterface, points: currentPolyline });
        currentPolyline = [];
      }
      inSupport = false;
    }

    if (line.startsWith('G1 ')) {
      const zMatch = line.match(/Z([0-9.]+)/);
      if (zMatch) currentZ = parseFloat(zMatch[1]);

      const xMatch = line.match(/X([0-9.]+)/);
      const yMatch = line.match(/Y([0-9.]+)/);
      const eMatch = line.match(/E([0-9.-]+)/);

      let newX = xMatch ? parseFloat(xMatch[1]) : currentX;
      let newY = yMatch ? parseFloat(yMatch[1]) : currentY;

      if (inSupport && eMatch) {
        totalMoves++;
        // Extruding support line!
        // In G-code, bed center is at (128, 128). In Three.js, center is (0, 0)
        // Three.js: X = Gcode X - 128
        //           Y = Gcode Z (height)
        //           Z = Gcode Y - 128
        const pX = Number((newX - 128.0).toFixed(2));
        const pY = Number(currentZ.toFixed(2));
        const pZ = Number((newY - 128.0).toFixed(2));

        if (currentPolyline.length === 0) {
          const prevPX = Number((currentX - 128.0).toFixed(2));
          const prevPY = Number(currentZ.toFixed(2));
          const prevPZ = Number((currentY - 128.0).toFixed(2));
          currentPolyline.push(prevPX, prevPY, prevPZ);
        }
        currentPolyline.push(pX, pY, pZ);
      } else if (inSupport && !eMatch) {
        // Travel move within support
        if (currentPolyline.length > 1) {
          segments.push({ isInterface: isCurrentInterface, points: currentPolyline });
          currentPolyline = [];
        }
      }

      currentX = newX;
      currentY = newY;
    }
  }

  if (currentPolyline.length > 1) {
    segments.push({ isInterface: isCurrentInterface, points: currentPolyline });
  }

  console.log('Total Extruding Support Moves:', totalMoves);
  console.log('Total Support Continuous Segments:', segments.length);

  // Sample or save as JSON for fast client loading
  // To keep size compact for web delivery, we can compress or sample segments
  // E.g. every 2nd or 3rd layer or full segments
  const supportData = {
    model: 'highland_cow',
    engine: 'Bambu Studio v02.08.02.61 CLI',
    totalMoves,
    totalSegments: segments.length,
    segments: segments // We can write this to public/models/highland_cow_support.json
  };

  const outPath = path.resolve('public/models/highland_cow_support.json');
  fs.writeFileSync(outPath, JSON.stringify(supportData));
  console.log('Wrote support data to:', outPath, 'Size:', (fs.statSync(outPath).size / 1024 / 1024).toFixed(2), 'MB');
}

extractBambuSupportToolpaths();

import * as THREE from 'three';
import { ISimulationProfile } from '@/types/simulator';
import { layerSliceCache, getRealToolheadPositionOnSlice } from './meshSlicer';

export interface ISlicingMetrics {
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    dimensions: [number, number, number];
  };
  totalLayers: number;
  estimatedPrintTimeSec: number;
  estimatedFilamentGrams: number;
  layerHeightMm: number;
  estimatedCostVnd: number;
}

/**
 * Tính toán số liệu phân lớp cắt lớp (Slicing Metrics) từ geometry và profile
 */
export function computeSlicingMetrics(
  geometry: THREE.BufferGeometry,
  profile: ISimulationProfile,
  scale: number = 1.0
): ISlicingMetrics {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3(new THREE.Vector3(-15, 0, -15), new THREE.Vector3(15, 30, 15));

  const dimX = Math.max(1, (bbox.max.x - bbox.min.x) * scale);
  const dimY = Math.max(1, (bbox.max.y - bbox.min.y) * scale);
  const dimZ = Math.max(1, (bbox.max.z - bbox.min.z) * scale);

  // Model height theo trục Y (Three.js mặc định trục Y hướng lên trên bàn in)
  const heightMm = dimY;
  const totalLayers = Math.max(1, Math.round(heightMm / profile.layerHeight));

  // Thể tích hình hộp bao ngoài (cm³)
  const boundingVolumeCm3 = (dimX * dimY * dimZ) / 1000;

  // Hệ số lấp đầy thực tế ước tính (Shells + Infill + Support)
  const shellFactor = Math.min(0.35, (profile.wallLoops * 0.4 * 2) / Math.min(dimX, dimZ));
  const infillFactor = (profile.infillDensity / 100) * (1 - shellFactor);
  const supportFactor = profile.supportMode === 'none' ? 0 : profile.supportMode === 'tree' ? 0.08 : 0.15;
  const brimFactor = profile.brimEnabled ? 0.04 : 0;

  const effectiveSolidFraction = Math.min(0.95, Math.max(0.08, shellFactor + infillFactor + supportFactor + brimFactor));
  const solidVolumeCm3 = boundingVolumeCm3 * 0.45 * effectiveSolidFraction;

  // Khối lượng riêng của vật liệu (g/cm³)
  const densityMap: { [key in ISimulationProfile['material']]: number } = {
    PLA: 1.24,
    'PLA-CF': 1.28,
    PETG: 1.27,
    ABS: 1.04,
    TPU: 1.21,
  };
  const density = densityMap[profile.material] || 1.24;
  const estimatedFilamentGrams = Number(Math.max(2, solidVolumeCm3 * density).toFixed(1));

  // Tính toán thời gian in (giây)
  // Chiều dài sợi nhựa đùn (mm) = Thể tích (mm³) / tiết diện sợi 1.75mm (2.405 mm²)
  const totalExtrusionLengthMm = (solidVolumeCm3 * 1000) / 2.405;
  const averageSpeedMmS = profile.printSpeed * 0.55; // Có tính đến gia tốc và giảm tốc ở góc
  const extrusionTimeSec = totalExtrusionLengthMm / averageSpeedMmS;
  const layerChangeOverheadSec = totalLayers * 0.8; // Thời gian nâng hạ trục Z và lau đầu phun
  const heatUpOverheadSec = 75; // Thời gian gia nhiệt bàn in & đầu phun

  const estimatedPrintTimeSec = Math.max(120, Math.round(extrusionTimeSec + layerChangeOverheadSec + heatUpOverheadSec));

  // Chi phí sản xuất ước tính (VND): tiền nhựa + tiền điện + khấu hao máy
  const materialPricePerGram = profile.material === 'PETG' ? 380 : profile.material === 'TPU' ? 450 : 320;
  const plasticCost = estimatedFilamentGrams * materialPricePerGram;
  const machineDepreciationAndPower = (estimatedPrintTimeSec / 3600) * 12000; // ~12k VND/giờ in
  const estimatedCostVnd = Math.round((plasticCost + machineDepreciationAndPower) / 1000) * 1000;

  return {
    boundingBox: {
      min: [bbox.min.x * scale, bbox.min.y * scale, bbox.min.z * scale],
      max: [bbox.max.x * scale, bbox.max.y * scale, bbox.max.z * scale],
      dimensions: [dimX, dimY, dimZ],
    },
    totalLayers,
    estimatedPrintTimeSec,
    estimatedFilamentGrams,
    layerHeightMm: profile.layerHeight,
    estimatedCostVnd,
  };
}

/**
 * Chuẩn hóa tính toán số lớp và tiến trình trong lớp hiện tại (Lockstep Sync)
 * Đảm bảo bộ đếm (Counter) và bộ vẽ giả lập (Visualizer) hoàn toàn khớp nhau
 */
export function calculateLayerProgress(
  progress: number,
  totalLayers: number
): {
  currentLayer: number;
  layerProgress: number;
} {
  const clamped = Math.max(0, Math.min(1.0, progress));
  if (clamped >= 1.0) {
    return {
      currentLayer: Math.max(1, totalLayers),
      layerProgress: 1.0,
    };
  }
  const currentLayer = Math.min(
    totalLayers,
    Math.max(1, Math.floor(clamped * totalLayers) + 1)
  );
  const layerProgress = (clamped * totalLayers) % 1.0;
  return { currentLayer, layerProgress };
}

/**
 * Tính toán vị trí đầu phun ảo (Virtual Nozzle Position) bám sát 100% hình học thực tế của mô hình
 * Đầu in chạy theo biên dạng thật của STL/Mesh (không chạy hình elip mặc định)
 */
export function computeVirtualToolheadPosition(
  progress: number,
  metrics: ISlicingMetrics,
  profile: ISimulationProfile,
  geometry?: THREE.BufferGeometry
): {
  position: [number, number, number];
  currentLayer: number;
  toolpathType: 'perimeter' | 'infill' | 'support' | 'travel' | 'brim';
} {
  const { currentLayer, layerProgress } = calculateLayerProgress(progress, metrics.totalLayers);
  const [dimX, dimY, dimZ] = metrics.boundingBox.dimensions;

  // Chiều cao Y hiện tại của đầu phun (trục Y hướng lên từ mặt bàn in Y = 0)
  const currentY = (currentLayer / Math.max(1, metrics.totalLayers)) * dimY;

  const [minX, , minZ] = metrics.boundingBox.min;
  const [maxX, , maxZ] = metrics.boundingBox.max;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // 1. NẾU CÓ HÌNH HỌC BUFFERGEOMETRY: Cắt lớp mesh thực và di chuyển đầu in theo đúng biên dạng thực tế
  if (geometry) {
    // Vành bám bàn in Brim ở lớp đầu tiên
    if (currentLayer === 1 && profile.brimEnabled && layerProgress < 0.20) {
      const t = layerProgress / 0.20;
      const theta = t * Math.PI * 2;
      const r = Math.max(dimX, dimZ) / 2 + (profile.brimWidthMm || 5);
      return {
        position: [centerX + Math.cos(theta) * r, currentY, centerZ + Math.sin(theta) * r],
        currentLayer,
        toolpathType: 'brim',
      };
    }

    const slice = layerSliceCache.getSlice(geometry, currentLayer, currentY, profile);
    if (slice && slice.contours.length > 0) {
      const realToolhead = getRealToolheadPositionOnSlice(slice, layerProgress, profile, [centerX, centerZ]);
      return {
        position: realToolhead.position,
        currentLayer,
        toolpathType: realToolhead.toolpathType,
      };
    }
  }

  // 2. Dự phòng Heuristic hình hộp bao ngoài (nếu không có hình học)
  const rx = Math.max(4, (dimX / 2) * 0.88);
  const rz = Math.max(4, (dimZ / 2) * 0.88);

  let toolpathType: 'perimeter' | 'infill' | 'support' | 'travel' | 'brim' = 'perimeter';
  let posX = 0;
  let posZ = 0;

  if (currentLayer === 1 && profile.brimEnabled && layerProgress < 0.22) {
    // In vành bám bàn Brim
    toolpathType = 'brim';
    const t = layerProgress / 0.22;
    const theta = t * Math.PI * 2;
    const r = Math.max(dimX, dimZ) / 2 + 5;
    posX = Math.cos(theta) * r;
    posZ = Math.sin(theta) * r;
  } else if (layerProgress < 0.48) {
    // In vách ngoài
    toolpathType = 'perimeter';
    const t0 = currentLayer === 1 && profile.brimEnabled ? 0.22 : 0;
    const t = Math.max(0, (layerProgress - t0) / (0.48 - t0));
    const theta = t * Math.PI * 2;
    posX = Math.cos(theta) * rx;
    posZ = Math.sin(theta) * rz;
  } else if (layerProgress < 0.72) {
    // In vách trong (Inner Perimeter)
    toolpathType = 'perimeter';
    const t = (layerProgress - 0.48) / 0.24;
    const theta = t * Math.PI * 2;
    posX = Math.cos(theta) * Math.max(2, rx - 0.8);
    posZ = Math.sin(theta) * Math.max(2, rz - 0.8);
  } else if (layerProgress < 0.94) {
    // In ruột (Continuous Infill Zigzag)
    toolpathType = 'infill';
    const t = (layerProgress - 0.72) / 0.22;
    const lines = 6;
    const lineIndex = Math.min(lines - 1, Math.floor(t * lines));
    const lineT = (t * lines) % 1.0;
    const sweepZ = -rz * 0.75 + (lineIndex / (lines - 1)) * (rz * 1.5);
    const direction = lineIndex % 2 === 0 ? 1 : -1;
    const sweepX = direction === 1 
      ? -rx * 0.75 + lineT * (rx * 1.5)
      : rx * 0.75 - lineT * (rx * 1.5);

    posX = sweepX;
    posZ = sweepZ;
  } else {
    // Di chuyển nhanh chuyển lớp (Smooth Travel Move)
    toolpathType = 'travel';
    const t = (layerProgress - 0.94) / 0.06;
    const startX = -rx * 0.75;
    const startZ = rz * 0.75;
    const endX = rx;
    const endZ = 0;
    posX = startX + t * (endX - startX);
    posZ = startZ + t * (endZ - startZ);
  }

  return {
    position: [centerX + posX, currentY, centerZ + posZ],
    currentLayer,
    toolpathType,
  };
}

/**
 * Định dạng số giây thành chuỗi thời gian đọc được (vd: 2h 15m 30s)
 */
export function formatPrintTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

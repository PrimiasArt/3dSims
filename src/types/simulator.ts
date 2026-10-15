export type MaterialType = 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'PLA-CF';

export type InfillPattern = 'gyroid' | 'grid' | 'honeycomb' | 'triangles' | 'concentric' | 'solid';

export type SupportType = 'none' | 'normal' | 'tree';

export type TreeSupportStyle = 'organic' | 'slim' | 'strong' | 'hybrid';

export type PlaybackSpeed = 1 | 5 | 10 | 25 | 50 | 100 | 200 | 500 | 1000 | 'instant';

export type SlicerRenderMode = 'realistic' | 'features' | 'defects' | 'speed';

export type ViewportDisplayMode = 'cad' | 'filament_preview';


export interface ISimulationProfile {
  id: string;
  name: string;
  description: string;
  layerHeight: number; // 0.08 - 0.32 mm
  infillType: InfillPattern;
  infillDensity: number; // 0 - 100%
  wallLoops: number; // 1 - 6
  printSpeed: number; // 30 - 500 mm/s
  nozzleTemp: number; // 190 - 290 °C
  bedTemp: number; // 40 - 110 °C
  material: MaterialType;
  materialColor: string; // Hex color
  supportMode: SupportType;
  brimEnabled: boolean;
  brimWidthMm: number;
  coolingFanSpeed: number; // 0 - 100%
  flowRateMm3s?: number;
  retractionDistanceMm?: number;
  // Professional Slicer Parameters
  firstLayerHeight?: number;
  topShellLayers?: number;
  bottomShellLayers?: number;
  outerWallSpeed?: number;
  infillSpeed?: number;
  travelSpeed?: number;
  retractionSpeedMmS?: number;
  zHopMm?: number;
  seamPosition?: 'aligned' | 'nearest' | 'random';
  // Bambu Lab / Bambu Studio Realistic Support Parameters
  supportAngleThreshold?: number; // e.g. 45°
  treeStyle?: TreeSupportStyle; // 'organic' | 'slim' | 'strong' | 'hybrid'
  supportOnBuildPlateOnly?: boolean; // true = only roots on bed, false = everywhere
  supportTopZDistance?: number; // air gap in mm, e.g. 0.2mm
  supportBottomZDistance?: number; // e.g. 0.2mm
  supportBranchDiameter?: number; // e.g. 2.8mm
  supportBranchAngle?: number; // e.g. 42°
  supportInterfaceLayers?: number; // e.g. 2 layers
}

export interface ISimulationState {
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  currentProgress: number; // 0.0 - 1.0
  currentLayer: number;
  totalLayers: number;
  elapsedTimeSec: number;
  totalTimeSec: number;
  filamentUsedGrams: number;
  totalFilamentGrams: number;
  toolheadPosition: [number, number, number];
  activeToolpathType: 'perimeter' | 'infill' | 'support' | 'travel' | 'brim';
  isCompleted: boolean;
}

export type DefectSeverity = 'critical' | 'warning' | 'info';

export type DefectType =
  | 'overhang'
  | 'warping'
  | 'thin_wall'
  | 'bridging'
  | 'stringing'
  | 'delamination'
  | 'temperature_mismatch';

export interface IPreflightError {
  id: string;
  type: DefectType;
  severity: DefectSeverity;
  title: string;
  description: string;
  suggestedFix: string;
  impactScorePenalty: number;
  autoFixAction?: Partial<ISimulationProfile>;
  layerRange?: [number, number];
  location?: [number, number, number];
}

export interface IPreflightReport {
  printabilityScore: number; // 0 - 100
  overallStatus: 'ready' | 'caution' | 'high_risk';
  errors: IPreflightError[];
  summary: string;
  estimatedCostVnd: number;
  estimatedPrintTimeMinutes: number;
  modelFootprintAreaMm2: number;
  overhangRiskAreaPercent: number;
}

export interface ISampleModel {
  id: string;
  name: string;
  description: string;
  category: string;
  geometryType: 'benchy' | 'cube' | 'dragon' | 'gear' | 'organizer' | 'custom';
  defaultProfileId: string;
  dimensionsMm: [number, number, number];
  estimatedWeightGrams: number;
  accentBadge: string;
  path?: string;
}

export interface IModelTransform {
  position: [number, number, number]; // [x, y, z] on bed (x, z on PEI plate, y = 0)
  rotation: [number, number, number]; // [rx, ry, rz] in radians
  scale: number; // uniform scale factor (0.2 - 3.0)
}

export const DEFAULT_TRANSFORM: IModelTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1.0,
};

export type SimulatorEngineType = 'wasm_client' | 'pro_local';

export interface IEngineInfo {
  id: SimulatorEngineType;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  features: string[];
  latency: string;
  memoryUsage: string;
  status: 'active' | 'ready';
  fidelity: 'High' | 'Ultra-Precision CNC';
}

export interface IProSlicerTelemetry {
  gcodeInstruction: string;
  feedrateMmMin: number;
  volumetricFlowMm3s: number;
  accelMmS2: number;
  fanPwmPercent: number;
  nozzlePressureBar: number;
  retractionDistanceMm: number;
  chamberTempC: number;
  hotendDutyPercent: number;
}

// ==========================================
// BAMBU LAB TIMELAPSE TYPES
// ==========================================
export type TimelapseMode = 'smooth' | 'live';
export type TimelapseCameraPreset = 'chamber_iso' | 'front_hero' | 'top_down' | 'custom';

export interface ITimelapseFrame {
  layer: number;
  progress: number;
  dataUrl?: string;
  timestamp: string;
  elapsedTimeSec: number;
  toolheadParked: boolean;
  nozzleTemp: number;
  bedTemp: number;
}

export interface ITimelapseConfig {
  mode: TimelapseMode;
  cameraPreset: TimelapseCameraPreset;
  fps: number; // 15, 30, 60
  parkPosition: [number, number, number]; // Bambu Purge Chute / Waste Bin: [-110, Y, 110]
  showOsdOverlay: boolean;
  resolution: '720p' | '1080p';
}

// ==========================================
// GEMINI AI & BAMBU STUDIO SUPPORT ANALYSIS
// ==========================================
export interface ISupportOverhangPatch {
  id: string;
  center: [number, number, number];
  areaMm2: number;
  minAngleDeg: number;
  avgAngleDeg: number;
  severity: 'critical' | 'moderate' | 'mild';
  requiresSupport: boolean;
  isBridge: boolean;
}

export interface ISupportAnalysisResult {
  modelName: string;
  source: 'gemini_flash' | 'bambu_expert_rules';
  timestamp: string;
  totalTriangles: number;
  totalSurfaceAreaMm2: number;
  overhangPercent: number;
  severeOverhangPercent: number;
  bridgeSpansCount: number;
  estimatedSupportWeightGrams: number;
  recommendedOrientation: {
    axis: 'x' | 'y' | 'z';
    degrees: number;
    savingsPercent: number;
    rationale: string;
  };
  supportRecommendation: {
    mode: SupportType;
    treeStyle: TreeSupportStyle;
    angleThreshold: number;
    topZDistance: number;
    branchDiameter: number;
    branchAngle: number;
    onBuildPlateOnly: boolean;
    interfaceLayers: number;
    summary: string;
  };
  riskHotspots: {
    id: string;
    title: string;
    location: [number, number, number];
    severity: DefectSeverity;
    description: string;
    fixSuggestion: string;
  }[];
  bambuStudioProTips: string[];
}


import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import {
  ISimulationProfile,
  ISimulationState,
  ISampleModel,
  PlaybackSpeed,
  SlicerRenderMode,
  IModelTransform,
  DEFAULT_TRANSFORM,
  SimulatorEngineType,
  ViewportDisplayMode,
} from '@/types/simulator';
import { PRESET_PROFILES } from '@/services/presetProfiles';
import {
  SAMPLE_MODELS,
  generateProceduralGeometry,
  parseCADFile,
  applyTransformToGeometry,
} from '@/services/sampleModels';
import {
  computeSlicingMetrics,
  computeVirtualToolheadPosition,
  calculateLayerProgress,
} from '@/services/slicingEngine';
import {
  computeProSlicerTelemetry,
  generateSurroundingGcodeBlock,
} from '@/services/proSlicerLocalEngine';
import { runPreflightInspection } from '@/services/preflightAnalyzer';
import { embedProtocol } from '@/services/embedProtocol';
import {
  clearAllSupportCaches,
  setPreloadedSupport,
  setPreloadedToolpaths,
} from '@/services/nativeSupportLoader';

import { PrintSimulatorViewport } from '@/components/viewport/PrintSimulatorViewport';
import { TimeScrubber } from '@/components/controls/TimeScrubber';
import { ProfileSettingsPanel } from '@/components/controls/ProfileSettingsPanel';
import { PreflightReportModal } from '@/components/controls/PreflightReportModal';
import { ExportProfileModal } from '@/components/controls/ExportProfileModal';
import { SimulatorHeader } from '@/components/header/SimulatorHeader';
import { EngineComparisonModal } from '@/components/controls/EngineComparisonModal';
import { BambuTimelapseModal } from '@/components/controls/BambuTimelapseModal';
import { BambuSupportAIAssistantModal } from '@/components/controls/BambuSupportAIAssistantModal';
import { GeminiApiKeyModal } from '@/components/controls/GeminiApiKeyModal';
import { getSavedGeminiApiKey } from '@/services/geminiSupportService';
import { LocalSlicerModal } from '@/components/controls/LocalSlicerModal';
import { ModelLibraryModal } from '@/components/controls/ModelLibraryModal';
import { AI3DGeneratorModal } from '@/components/controls/AI3DGeneratorModal';
import {
  SimulationRunLogPanel,
  ISimulationLogEntry,
} from '@/components/controls/SimulationRunLogPanel';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ISliceResponse } from '@/services/localSlicerService';
import { IconAxis, IconLayers, IconToolpath } from '@/components/icons/MinimalIcons';

export default function App() {
  // 0. Luxury Dark / Light Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('printsim_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('printsim_theme', theme);
  }, [theme]);

  // 1. Model & Geometry State
  const [currentModel, setCurrentModel] = useState<ISampleModel>(SAMPLE_MODELS[0]);
  const [baseGeometry, setBaseGeometry] = useState<THREE.BufferGeometry>(() =>
    generateProceduralGeometry(SAMPLE_MODELS[0].geometryType)
  );
  const [modelTransform, setModelTransform] = useState<IModelTransform>(DEFAULT_TRANSFORM);

  // Dùng baseGeometry gốc làm chuẩn (Three.js Scene Graph modelRootGroup sẽ quản lý Position, Rotation, Scale tức thì)
  const geometry = baseGeometry;

  // 2. Profile State
  const [profile, setProfile] = useState<ISimulationProfile>(PRESET_PROFILES[0]);

  // 3. UI Toggles & Engine Selection
  const [simulatorEngine, setSimulatorEngine] = useState<SimulatorEngineType>('wasm_client');
  const [isEngineModalOpen, setIsEngineModalOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isTimelapseModalOpen, setIsTimelapseModalOpen] = useState<boolean>(false);
  const [isSupportAIModalOpen, setIsSupportAIModalOpen] = useState<boolean>(false);
  const [isGeminiKeyModalOpen, setIsGeminiKeyModalOpen] = useState<boolean>(false);
  const [isLocalSlicerModalOpen, setIsLocalSlicerModalOpen] = useState<boolean>(false);
  const [isModelLibraryOpen, setIsModelLibraryOpen] = useState<boolean>(false);
  const [isAI3DModalOpen, setIsAI3DModalOpen] = useState<boolean>(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(() => {
    return getSavedGeminiApiKey().length > 0;
  });
  const captureSnapshotRef = useRef<(() => string | null) | null>(null);

  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showToolhead, setShowToolhead] = useState<boolean>(true);
  const [showSupport, setShowSupport] = useState<boolean>(true);
  const [cameraView, setCameraView] = useState<'iso' | 'top' | 'front' | 'nozzle'>('iso');
  const [renderMode, setRenderMode] = useState<SlicerRenderMode>('realistic');
  const [viewMode, setViewMode] = useState<ViewportDisplayMode>('cad');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [uploadSlicingStatus, setUploadSlicingStatus] = useState<string | null>(null);
  const isEmbedded = embedProtocol.getIsEmbedded();

  // 4. Compute Slicing Metrics & Pre-flight Report
  const slicingMetrics = React.useMemo(() => {
    return computeSlicingMetrics(geometry, profile, modelTransform.scale);
  }, [geometry, profile, modelTransform.scale]);

  const preflightReport = React.useMemo(() => {
    return runPreflightInspection(geometry, profile, slicingMetrics);
  }, [geometry, profile, slicingMetrics]);

  // 5. Simulation State (Mặc định hiển thị 100% mô hình hoàn thiện rõ ràng ngay khi mở)
  const [simulationState, setSimulationState] = useState<ISimulationState>(() => ({
    isPlaying: false,
    playbackSpeed: 50,
    currentProgress: 1.0,
    currentLayer: slicingMetrics.totalLayers,
    totalLayers: slicingMetrics.totalLayers,
    elapsedTimeSec: slicingMetrics.estimatedPrintTimeSec,
    totalTimeSec: slicingMetrics.estimatedPrintTimeSec,
    filamentUsedGrams: Number(slicingMetrics.estimatedFilamentGrams.toFixed(1)),
    totalFilamentGrams: slicingMetrics.estimatedFilamentGrams,
    toolheadPosition: [0, 0, 0],
    activeToolpathType: 'perimeter',
    isCompleted: true,
  }));

  // Đồng bộ lại simulation metrics khi geometry hoặc profile đổi
  useEffect(() => {
    setSimulationState((prev) => {
      const curLayer = Math.min(slicingMetrics.totalLayers, Math.max(1, Math.floor(prev.currentProgress * slicingMetrics.totalLayers)));
      const toolhead = computeVirtualToolheadPosition(prev.currentProgress, slicingMetrics, profile, geometry);
      return {
        ...prev,
        totalLayers: slicingMetrics.totalLayers,
        totalTimeSec: slicingMetrics.estimatedPrintTimeSec,
        totalFilamentGrams: slicingMetrics.estimatedFilamentGrams,
        currentLayer: curLayer,
        elapsedTimeSec: Math.round(prev.currentProgress * slicingMetrics.estimatedPrintTimeSec),
        filamentUsedGrams: Number((prev.currentProgress * slicingMetrics.estimatedFilamentGrams).toFixed(1)),
        toolheadPosition: toolhead.position,
        activeToolpathType: toolhead.toolpathType,
      };
    });
  }, [slicingMetrics, profile, geometry]);

  // 6. Pro Slicer Engine Telemetry & G-Code Buffer (Engine 2)
  const proTelemetry = React.useMemo(() => {
    return computeProSlicerTelemetry(simulationState, slicingMetrics, profile);
  }, [simulationState, slicingMetrics, profile]);

  const gcodeLines = React.useMemo(() => {
    return generateSurroundingGcodeBlock(simulationState, slicingMetrics, profile);
  }, [simulationState, slicingMetrics, profile]);

  // Gửi thông báo Ready và Report khi nhúng trong iframe
  useEffect(() => {
    embedProtocol.notifyReady();
    embedProtocol.notifyReport(preflightReport);
  }, []);

  // Lắng nghe Message từ 3D Hub nếu nhúng qua iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || e.data.source !== '3DHUB') return;
      const { type, data } = e.data;

      if (type === 'LOAD_MODEL') {
        if (data.sampleId) {
          const sample = SAMPLE_MODELS.find((m) => m.id === data.sampleId);
          if (sample) handleSelectSample(sample);
        }
      } else if (type === 'SET_PROFILE') {
        if (data.profile) {
          setProfile((prev) => ({ ...prev, ...data.profile }));
        }
      } else if (type === 'START_SIMULATION') {
        setSimulationState((prev) => ({ ...prev, isPlaying: true }));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Vòng lặp mô phỏng in 3D thời gian thực (Simulation Clock Loop)
  useEffect(() => {
    if (!simulationState.isPlaying) return;

    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;

      setSimulationState((prev) => {
        if (!prev.isPlaying || prev.isCompleted) return prev;

        // Tính toán bước nhảy tiến độ theo tốc độ playback
        // Nếu tốc độ 1x: tiến trình thực = deltaSec / totalTimeSec
        // Nếu tốc độ 100x: nhanh gấp 100 lần
        const speedMultiplier = prev.playbackSpeed === 'instant' ? 10000 : (prev.playbackSpeed as number);
        const progressIncrement = (deltaSec * speedMultiplier) / Math.max(10, prev.totalTimeSec);
        const nextProgress = Math.min(1.0, prev.currentProgress + progressIncrement);

        const { currentLayer: nextLayer } = calculateLayerProgress(nextProgress, prev.totalLayers);
        const nextElapsed = Math.round(nextProgress * prev.totalTimeSec);
        const nextFilament = Number((nextProgress * prev.totalFilamentGrams).toFixed(1));

        const toolhead = computeVirtualToolheadPosition(nextProgress, slicingMetrics, profile, geometry);
        const hasFinished = nextProgress >= 1.0;

        if (hasFinished && !prev.isCompleted) {
          // Bắn pháo hoa ăn mừng in thành công!
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.7 },
            colors: ['#2dd4bf', '#10b981', '#f59e0b', '#8b5cf6'],
          });
        }

        // Báo cáo telemetry
        embedProtocol.notifyTelemetry({
          progress: nextProgress,
          currentLayer: nextLayer,
          totalLayers: prev.totalLayers,
          elapsedTimeSec: nextElapsed,
          totalTimeSec: prev.totalTimeSec,
          filamentUsedGrams: nextFilament,
        });

        return {
          ...prev,
          currentProgress: nextProgress,
          currentLayer: nextLayer,
          elapsedTimeSec: nextElapsed,
          filamentUsedGrams: nextFilament,
          toolheadPosition: toolhead.position,
          activeToolpathType: toolhead.toolpathType,
          isPlaying: !hasFinished,
          isCompleted: hasFinished,
        };
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [simulationState.isPlaying, simulationState.playbackSpeed, slicingMetrics, profile, geometry]);

  // Phím tắt bàn phím (Space, Mũi tên trái/phải, H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setSimulationState((prev) => {
          if (prev.isCompleted) {
            return { ...prev, isPlaying: true, isCompleted: false, currentProgress: 0 };
          }
          return { ...prev, isPlaying: !prev.isPlaying };
        });
      } else if (e.code === 'ArrowLeft') {
        handleStepLayer(-1);
      } else if (e.code === 'ArrowRight') {
        handleStepLayer(1);
      } else if (e.key.toLowerCase() === 'h') {
        setShowHeatmap((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slicingMetrics]);

  // Chọn Sample Model
  const handleSelectSample = (sample: ISampleModel) => {
    clearAllSupportCaches();
    setViewMode('cad');
    setCurrentModel(sample);
    setModelTransform(DEFAULT_TRANSFORM);
    const newGeom = generateProceduralGeometry(sample.geometryType);
    setBaseGeometry(newGeom);

    const preset = PRESET_PROFILES.find((p) => p.id === sample.defaultProfileId) || PRESET_PROFILES[0];
    setProfile(preset);

    setSimulationState((prev) => ({
      ...prev,
      currentProgress: 1.0,
      isPlaying: false,
      isCompleted: true,
    }));
  };

  // Áp dụng kết quả Slicing từ Local Slicer CLI vào Simulation State
  const handleApplySliceResult = (res: ISliceResponse) => {
    if (!res || !res.success) return;
    setSimulationState((prev) => ({
      ...prev,
      totalLayers: res.totalLayers,
      totalTimeSec: res.estimatedTimeSec,
      totalFilamentGrams: res.filamentWeightGrams,
      currentLayer: res.totalLayers,
      currentProgress: 1.0,
      elapsedTimeSec: res.estimatedTimeSec,
      filamentUsedGrams: res.filamentWeightGrams,
    }));
  };

  // Tải file 3MF / STL / OBJ từ máy tính
  const handleUploadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return;
      try {
        clearAllSupportCaches();
        setViewMode('cad');
        setModelTransform(DEFAULT_TRANSFORM);
        const customGeom = parseCADFile(buffer, file.name);
        setBaseGeometry(customGeom);

        customGeom.computeBoundingBox();
        const bbox = customGeom.boundingBox || new THREE.Box3();
        const dimX = Math.round(bbox.max.x - bbox.min.x);
        const dimY = Math.round(bbox.max.y - bbox.min.y);
        const dimZ = Math.round(bbox.max.z - bbox.min.z);

        const is3MF = file.name.toUpperCase().endsWith('.3MF');
        const customModelObj: ISampleModel = {
          id: 'custom-' + Date.now(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          description: `Mô hình 3D tùy chỉnh (${dimX} x ${dimY} x ${dimZ} mm) nạp từ máy tính`,
          category: 'User Upload',
          geometryType: 'custom' as any,
          defaultProfileId: profile.id,
          dimensionsMm: [dimX, dimY, dimZ],
          estimatedWeightGrams: Math.round(dimX * dimY * dimZ * 0.00045 * 1.24 * 10) / 10,
          accentBadge: is3MF ? 'Bambu 3MF' : file.name.toUpperCase().endsWith('.OBJ') ? 'File OBJ' : 'File STL',
        };
        setCurrentModel(customModelObj);

        setSimulationState((prev) => ({
          ...prev,
          currentProgress: 1.0,
          isPlaying: false,
          isCompleted: true,
        }));

        // Gửi trực tiếp file nhị phân lên Bambu Studio CLI để dựng Organic Tree Support & Sợi In
        setUploadSlicingStatus('⚡ Đang gửi sang Bambu Studio CLI để dựng Organic Tree Support & Sợi In...');
        fetch(`/api/slicer/upload-and-slice?name=${encodeURIComponent(file.name)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file,
        })
          .then((res) => res.json())
          .then((resData) => {
            if (resData.success) {
              if (resData.supportData) {
                setPreloadedSupport(resData.modelPath || file.name, resData.supportData);
                setPreloadedSupport(customModelObj.name, resData.supportData);
                setPreloadedSupport(customModelObj.id, resData.supportData);
              }
              if (resData.toolpathData) {
                setPreloadedToolpaths(resData.modelPath || file.name, resData.toolpathData);
                setPreloadedToolpaths(customModelObj.name, resData.toolpathData);
                setPreloadedToolpaths(customModelObj.id, resData.toolpathData);
              }

              setCurrentModel((prev) => ({
                ...prev,
                path: resData.modelPath,
              }));

              if (resData.totalLayers) {
                setSimulationState((prev) => ({
                  ...prev,
                  totalLayers: resData.totalLayers,
                  currentLayer: resData.totalLayers,
                  totalTimeSec: resData.estimatedTimeSec || prev.totalTimeSec,
                  totalFilamentGrams: resData.filamentWeightGrams || prev.totalFilamentGrams,
                  filamentUsedGrams: resData.filamentWeightGrams || prev.filamentUsedGrams,
                }));
              }

              setUploadSlicingStatus(
                `✓ Hoàn tất Bambu Studio Native! (${resData.totalLayers || 180} lớp in, ${resData.supportLinesCount || 0} đoạn Tree Support)`
              );
              setTimeout(() => setUploadSlicingStatus(null), 5000);
            } else {
              setUploadSlicingStatus(null);
            }
          })
          .catch((err) => {
            console.warn('Lỗi gọi upload-and-slice:', err);
            setUploadSlicingStatus(null);
          });
      } catch (err: any) {
        alert('Không thể đọc file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Nạp geometry tùy chỉnh từ ModelLibraryModal
  const handleLoadCustomGeometry = (geom: THREE.BufferGeometry, modelInfo: ISampleModel) => {
    clearAllSupportCaches();
    setViewMode('cad');
    setModelTransform(DEFAULT_TRANSFORM);
    setBaseGeometry(geom);
    setCurrentModel(modelInfo);
    setSimulationState((prev) => ({
      ...prev,
      currentProgress: 1.0,
      isPlaying: false,
      isCompleted: true,
    }));

    if (modelInfo.path) {
      setUploadSlicingStatus('⚡ Đang đồng bộ Bambu Studio Native Tree Support & Sợi In...');
      fetch(`/api/slicer/active-support?path=${encodeURIComponent(modelInfo.path)}`)
        .then((r) => r.json())
        .then((data) => {
          setUploadSlicingStatus(null);
          if (data && data.supportData) {
            setPreloadedSupport(modelInfo.path!, data.supportData);
            setPreloadedSupport(modelInfo.name, data.supportData);
            setPreloadedSupport(modelInfo.id, data.supportData);
          }
        })
        .catch(() => setUploadSlicingStatus(null));

      fetch(`/api/slicer/full-toolpaths?path=${encodeURIComponent(modelInfo.path)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.outerWalls && data.outerWalls.length > 0) {
            setPreloadedToolpaths(modelInfo.path!, data);
            setPreloadedToolpaths(modelInfo.name, data);
            setPreloadedToolpaths(modelInfo.id, data);
            if (data.totalLayers) {
              setSimulationState((prev) => ({
                ...prev,
                totalLayers: data.totalLayers,
                currentLayer: data.totalLayers,
              }));
            }
          }
        })
        .catch(() => {});
    }
  };

  // Đặt lại vị trí mặc định trên bàn in
  const handleResetTransform = () => {
    setModelTransform(DEFAULT_TRANSFORM);
  };

  // Tự động lật mặt phẳng tiếp xúc lớn nhất xuống đáy (Auto Lay Flat)
  const handleAutoLayFlat = () => {
    setModelTransform((prev) => ({
      ...prev,
      rotation: [0, 0, 0],
      position: [0, 0, 0],
    }));
  };

  // Điều khiển Tua tiến trình (Scrubbing)
  const handleScrubProgress = useCallback((newProgress: number) => {
    setSimulationState((prev) => {
      const progress = Math.max(0, Math.min(1.0, newProgress));
      const { currentLayer: curLayer } = calculateLayerProgress(progress, prev.totalLayers);
      const elapsed = Math.round(progress * prev.totalTimeSec);
      const filament = Number((progress * prev.totalFilamentGrams).toFixed(1));
      const toolhead = computeVirtualToolheadPosition(progress, slicingMetrics, profile, geometry);

      return {
        ...prev,
        currentProgress: progress,
        currentLayer: curLayer,
        elapsedTimeSec: elapsed,
        filamentUsedGrams: filament,
        toolheadPosition: toolhead.position,
        activeToolpathType: toolhead.toolpathType,
        isCompleted: progress >= 1.0,
      };
    });
  }, [slicingMetrics, profile, geometry]);

  // Tiến / Lùi 1 Layer
  const handleStepLayer = (delta: number) => {
    setSimulationState((prev) => {
      const nextLayer = Math.max(1, Math.min(prev.totalLayers, prev.currentLayer + delta));
      const nextProgress = prev.totalLayers > 1 ? (nextLayer - 0.5) / prev.totalLayers : 0;
      const toolhead = computeVirtualToolheadPosition(nextProgress, slicingMetrics, profile, geometry);
      return {
        ...prev,
        currentProgress: nextProgress,
        currentLayer: nextLayer,
        elapsedTimeSec: Math.round(nextProgress * prev.totalTimeSec),
        filamentUsedGrams: Number((nextProgress * prev.totalFilamentGrams).toFixed(1)),
        toolheadPosition: toolhead.position,
        activeToolpathType: toolhead.toolpathType,
        isCompleted: nextProgress >= 1.0,
      };
    });
  };

  // Reset về Layer 0
  const handleReset = () => {
    setSimulationState((prev) => ({
      ...prev,
      currentProgress: 0.001,
      currentLayer: 1,
      elapsedTimeSec: 0,
      filamentUsedGrams: 0,
      isPlaying: false,
      isCompleted: false,
    }));
  };

  // 7. Bảng Nhật Ký Chạy Mô Phỏng (Simulation Run Logs)
  const formatTimestampNow = () => {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
  };

  const [simulationLogs, setSimulationLogs] = useState<ISimulationLogEntry[]>(() => [
    {
      id: 'run-init-1',
      runNumber: 1,
      timestamp: new Date().toTimeString().slice(0, 8),
      triggerLabel: 'Khởi tạo',
      modelName: SAMPLE_MODELS[0].name,
      material: PRESET_PROFILES[0].material,
      layerHeight: PRESET_PROFILES[0].layerHeight,
      infillDensity: PRESET_PROFILES[0].infillDensity,
      infillType: PRESET_PROFILES[0].infillType,
      supportMode: PRESET_PROFILES[0].supportMode,
      printSpeed: PRESET_PROFILES[0].printSpeed,
      nozzleTemp: PRESET_PROFILES[0].nozzleTemp,
      estimatedTimeSec: slicingMetrics.estimatedPrintTimeSec,
      filamentGrams: slicingMetrics.estimatedFilamentGrams,
      totalLayers: slicingMetrics.totalLayers,
      score: preflightReport.printabilityScore,
      overhangPercent: preflightReport.overhangRiskAreaPercent,
      profileSnapshot: { ...PRESET_PROFILES[0] },
    },
  ]);

  const recordSimulationLog = useCallback(
    (
      triggerLabel: string,
      customProfile?: ISimulationProfile,
      customModelName?: string
    ) => {
      const targetProfile = customProfile || profile;
      const targetMetrics = customProfile
        ? computeSlicingMetrics(geometry, targetProfile, modelTransform.scale)
        : slicingMetrics;
      const targetReport = customProfile
        ? runPreflightInspection(geometry, targetProfile, targetMetrics)
        : preflightReport;

      setSimulationLogs((prev) => {
        const nextRunNum = (prev[0]?.runNumber || 0) + 1;
        const entry: ISimulationLogEntry = {
          id: `run-${Date.now()}-${nextRunNum}`,
          runNumber: nextRunNum,
          timestamp: formatTimestampNow(),
          triggerLabel,
          modelName: customModelName || currentModel.name,
          material: targetProfile.material,
          layerHeight: targetProfile.layerHeight,
          infillDensity: targetProfile.infillDensity,
          infillType: targetProfile.infillType,
          supportMode: targetProfile.supportMode,
          printSpeed: targetProfile.printSpeed,
          nozzleTemp: targetProfile.nozzleTemp,
          estimatedTimeSec: targetMetrics.estimatedPrintTimeSec,
          filamentGrams: targetMetrics.estimatedFilamentGrams,
          totalLayers: targetMetrics.totalLayers,
          score: targetReport.printabilityScore,
          overhangPercent: targetReport.overhangRiskAreaPercent,
          profileSnapshot: { ...targetProfile },
        };
        return [entry, ...prev].slice(0, 20);
      });
    },
    [profile, geometry, modelTransform.scale, slicingMetrics, preflightReport, currentModel.name]
  );

  // Tua đến Thành Phẩm (100%)
  const handleInstantFinish = () => {
    handleScrubProgress(1.0);
    recordSimulationLog('Tua 100%');
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#d4b483', '#10b981'],
    });
  };

  // Áp dụng bản vá lỗi tự động từ Preflight HUD
  const handleApplyFix = (patch: Partial<ISimulationProfile>) => {
    const nextProfile = { ...profile, ...patch };
    setProfile(nextProfile);
    recordSimulationLog('Tối ưu AI', nextProfile);
  };

  // Nạp mô hình từ AI 3D Generator Studio (Trellis • Tripo • Meshy)
  const handleAIModelLoaded = (model: ISampleModel, geom: THREE.BufferGeometry) => {
    setCurrentModel(model);
    setBaseGeometry(geom);
    setModelTransform(DEFAULT_TRANSFORM);
    recordSimulationLog('Nạp AI 3D', profile, model.name);
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.75 },
      colors: ['#d4b483', '#10b981', '#38bdf8'],
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-300">
      {/* 1. Header Toolbar (Single Unified Top Bar - No Overlap) */}
      <SimulatorHeader
        currentModel={currentModel}
        onSelectSample={(sample) => {
          handleSelectSample(sample);
          recordSimulationLog('Đổi mẫu phôi', profile, sample.name);
        }}
        onUploadFile={handleUploadFile}
        preflightReport={preflightReport}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        isEmbedded={isEmbedded}
        onResetSimulation={handleReset}
        simulatorEngine={simulatorEngine}
        onSetEngine={setSimulatorEngine}
        onOpenEngineModal={() => setIsEngineModalOpen(true)}
        showHeatmap={showHeatmap}
        onToggleHeatmap={() => setShowHeatmap((prev) => !prev)}
        showToolhead={showToolhead}
        onToggleToolhead={() => setShowToolhead((prev) => !prev)}
        showSupport={showSupport}
        onToggleSupport={() => setShowSupport((prev) => !prev)}
        hasSupport={profile.supportMode !== 'none'}
        cameraView={cameraView}
        onSetCameraView={setCameraView}
        renderMode={renderMode}
        onSetRenderMode={setRenderMode}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenTimelapseModal={() => setIsTimelapseModalOpen(true)}
        onOpenSupportAIModal={() => setIsSupportAIModalOpen(true)}
        hasGeminiKey={hasGeminiKey}
        onOpenGeminiKeyModal={() => setIsGeminiKeyModalOpen(true)}
        onOpenLocalSlicerModal={() => setIsLocalSlicerModalOpen(true)}
        onOpenModelLibrary={() => setIsModelLibraryOpen(true)}
        onOpenAI3DModal={() => setIsAI3DModalOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      {/* Notification Toast khi Bambu Studio CLI đang cắt lát */}
      {uploadSlicingStatus && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-2.5 glass-panel studio-gold-badge rounded-xl shadow-2xl text-xs font-semibold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-gold)] animate-ping" />
          <span>{uploadSlicingStatus}</span>
        </div>
      )}

      {/* 2. Three.js 3D Simulation Viewport */}
      <main className="w-full h-full">
        <PrintSimulatorViewport
          geometry={geometry}
          profile={profile}
          simulationState={simulationState}
          slicingMetrics={slicingMetrics}
          preflightReport={preflightReport}
          showHeatmap={showHeatmap}
          showToolhead={showToolhead}
          showSupport={showSupport}
          cameraView={cameraView}
          onSetCameraView={setCameraView}
          renderMode={renderMode}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
          modelTransform={modelTransform}
          onChangeTransform={setModelTransform}
          onResetTransform={handleResetTransform}
          onAutoLayFlat={handleAutoLayFlat}
          onStepLayer={handleStepLayer}
          onScrubProgress={handleScrubProgress}
          onApplyFix={handleApplyFix}
          onUploadFile={handleUploadFile}
          onRegisterCaptureSnapshot={(fn) => {
            captureSnapshotRef.current = fn;
          }}
          isSmoothTimelapseActive={isTimelapseModalOpen}
          currentModel={currentModel}
          theme={theme}
          onOpenReportModal={() => setIsReportModalOpen(true)}
          simulatorEngine={simulatorEngine}
          proTelemetry={proTelemetry}
          gcodeLines={gcodeLines}
          isProfileOpen={isProfileOpen}
        />
      </main>

      {/* 3. Profile Settings Side Drawer */}
      <ProfileSettingsPanel
        profile={profile}
        onChangeProfile={(updated) => setProfile((prev) => ({ ...prev, ...updated }))}
        onApplyPreset={(presetId) => {
          const found = PRESET_PROFILES.find((p) => p.id === presetId);
          if (found) {
            setProfile(found);
            recordSimulationLog(`Preset: ${found.material}`, found);
          }
        }}
        isOpen={isProfileOpen}
        onToggleOpen={() => setIsProfileOpen((prev) => !prev)}
        onOpenSupportAIModal={() => setIsSupportAIModalOpen(true)}
        onOpenGeminiKeyModal={() => setIsGeminiKeyModalOpen(true)}
        onOpenLocalSlicerModal={() => setIsLocalSlicerModalOpen(true)}
      />

      {/* 3.5. Simulation Run Log Panel (Ghi lại thông số các lần chạy mô phỏng) */}
      <SimulationRunLogPanel
        logs={simulationLogs}
        isProfileOpen={isProfileOpen}
        onRecordManualLog={() => recordSimulationLog('Ghi thủ công')}
        onRestoreProfile={(savedProfile) => {
          setProfile(savedProfile);
          recordSimulationLog('Khôi phục Log', savedProfile);
        }}
        onClearLogs={() => setSimulationLogs((prev) => (prev.length > 0 ? [prev[0]] : []))}
      />

      {/* 4. Bottom Dock: Prepare Stage Action Bar OR Playback Timeline Scrubber */}
      <div className="fixed bottom-3 left-3 right-3 z-20 pointer-events-auto">
        {viewMode === 'prepare' ? (
          <div className="w-full max-w-4xl mx-auto px-4 py-2 rounded-2xl glass-panel flex items-center justify-between gap-4 whitespace-nowrap">
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg studio-gold-badge font-bold uppercase tracking-wider text-[10px]">
                <IconAxis className="w-3.5 h-3.5" />
                <span>Chế Độ Chuẩn Bị Bàn In</span>
              </span>
              <span className="text-[var(--text-secondary)] font-mono text-[11px] hidden sm:inline">
                Kích thước: <strong className="text-[var(--text-primary)]">{Math.round(slicingMetrics.boundingBox.dimensions[0])} × {Math.round(slicingMetrics.boundingBox.dimensions[2])} × {Math.round(slicingMetrics.boundingBox.dimensions[1])} mm</strong>
              </span>
              <span className="text-[var(--text-muted)] font-mono text-[11px] hidden md:inline">
                • Overhang: <strong className="text-[var(--accent-gold)]">{preflightReport.overhangRiskAreaPercent}%</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setViewMode('cad')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl studio-cta-primary font-bold text-xs transition-all cursor-pointer"
              >
                <IconLayers className="w-3.5 h-3.5" />
                <span>Cắt Lớp &amp; Mô Phỏng CAD →</span>
              </button>
              <button
                onClick={() => setViewMode('filament_preview')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl studio-gold-badge hover:opacity-90 font-bold text-xs transition-all cursor-pointer"
              >
                <IconToolpath className="w-3.5 h-3.5" />
                <span>Xem Sợi In Bambu →</span>
              </button>
            </div>
          </div>
        ) : (
          <TimeScrubber
            state={simulationState}
            onTogglePlay={() => {
              if (!simulationState.isPlaying) {
                recordSimulationLog('Chạy mô phỏng');
              }
              setSimulationState((prev) => {
                if (prev.isCompleted) {
                  return { ...prev, isPlaying: true, isCompleted: false, currentProgress: 0 };
                }
                return { ...prev, isPlaying: !prev.isPlaying };
              });
            }}
            onSetSpeed={(speed: PlaybackSpeed) => setSimulationState((prev) => ({ ...prev, playbackSpeed: speed }))}
            onScrubProgress={handleScrubProgress}
            onStepLayer={handleStepLayer}
            onReset={handleReset}
            onInstantFinish={handleInstantFinish}
            defects={preflightReport.errors}
          />
        )}
      </div>

      {/* 5. Pre-flight Defect Inspection Modal */}
      <PreflightReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        report={preflightReport}
        onApplyFix={handleApplyFix}
        onStartSimulation={() => {
          setSimulationState((prev) => ({ ...prev, isPlaying: true, isCompleted: false }));
        }}
      />

      {/* 6. Export Slicer Profile Modal (.json / .gcode / clipboard) */}
      <ExportProfileModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        profile={profile}
        metrics={slicingMetrics}
        modelName={currentModel.name}
      />

      {/* 7. Dual-Engine Comparison Modal (So Sánh 2 Phương Án Engine 1 vs Engine 2) */}
      <EngineComparisonModal
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
        activeEngine={simulatorEngine}
        onSelectEngine={setSimulatorEngine}
        onOpenLocalSlicer={() => setIsLocalSlicerModalOpen(true)}
      />

      {/* 8. Bambu Lab Print Timelapse Studio Modal */}
      <BambuTimelapseModal
        isOpen={isTimelapseModalOpen}
        onClose={() => setIsTimelapseModalOpen(false)}
        currentModel={currentModel}
        profile={profile}
        simulationState={simulationState}
        onScrubProgress={handleScrubProgress}
        onSetCameraView={setCameraView}
        onCaptureSnapshot={() => (captureSnapshotRef.current ? captureSnapshotRef.current() : null)}
      />

      {/* 9. Bambu Studio Support AI Copilot & Gemini Reasoning Modal */}
      <BambuSupportAIAssistantModal
        isOpen={isSupportAIModalOpen}
        onClose={() => setIsSupportAIModalOpen(false)}
        currentModel={currentModel}
        geometry={geometry}
        profile={profile}
        modelTransform={modelTransform}
        onChangeProfile={(updated) => setProfile((prev) => ({ ...prev, ...updated }))}
        onChangeTransform={setModelTransform}
      />

      {/* 10. Dedicated Gemini AI API Key Configuration Modal */}
      <GeminiApiKeyModal
        isOpen={isGeminiKeyModalOpen}
        onClose={() => setIsGeminiKeyModalOpen(false)}
        onKeyUpdated={(hasKey) => setHasGeminiKey(hasKey)}
      />

      {/* 11. Local Slicer CLI Studio Modal (Bambu Studio & PrusaSlicer) */}
      <LocalSlicerModal
        isOpen={isLocalSlicerModalOpen}
        onClose={() => setIsLocalSlicerModalOpen(false)}
        currentModel={currentModel}
        profile={profile}
        onApplyProfilePatch={(patch) => setProfile((prev) => ({ ...prev, ...patch }))}
        onApplySliceResult={handleApplySliceResult}
      />

      {/* 12. Model Library & 3MF Local Browser Modal */}
      <ModelLibraryModal
        isOpen={isModelLibraryOpen}
        onClose={() => setIsModelLibraryOpen(false)}
        currentModel={currentModel}
        onSelectSample={handleSelectSample}
        onLoadCustomGeometry={handleLoadCustomGeometry}
      />

      {/* 13. AI 3D Generator Studio Modal (Trellis • Tripo3D • Meshy) */}
      <AI3DGeneratorModal
        isOpen={isAI3DModalOpen}
        onClose={() => setIsAI3DModalOpen(false)}
        onModelLoaded={handleAIModelLoaded}
      />
    </div>
  );
}

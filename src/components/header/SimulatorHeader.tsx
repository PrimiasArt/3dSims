import React, { useRef } from 'react';
import {
  Upload,
  ShieldCheck,
  Compass,
  Layers,
  Box,
  Link2,
  Download,
  AlertTriangle,
  Eye,
  Activity,
  Sparkles,
  Zap,
  Server,
  Cpu,
  Camera,
  Key,
} from 'lucide-react';
import {
  ISampleModel,
  IPreflightReport,
  SlicerRenderMode,
  SimulatorEngineType,
  ViewportDisplayMode,
} from '@/types/simulator';
import { SAMPLE_MODELS } from '@/services/sampleModels';

interface SimulatorHeaderProps {
  currentModel: ISampleModel;
  onSelectSample: (model: ISampleModel) => void;
  onUploadFile: (file: File) => void;
  preflightReport: IPreflightReport;
  onOpenReportModal: () => void;
  isEmbedded: boolean;
  onResetSimulation: () => void;
  // Dual-Engine Architecture Switcher
  simulatorEngine: SimulatorEngineType;
  onSetEngine: (engine: SimulatorEngineType) => void;
  onOpenEngineModal: () => void;
  // Viewport Toggles & Camera Controls
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  showToolhead: boolean;
  onToggleToolhead: () => void;
  showSupport: boolean;
  onToggleSupport: () => void;
  hasSupport: boolean;
  cameraView: 'iso' | 'top' | 'front' | 'nozzle';
  onSetCameraView: (view: 'iso' | 'top' | 'front' | 'nozzle') => void;
  // Slicer Render Modes & View Modes
  renderMode: SlicerRenderMode;
  onSetRenderMode: (mode: SlicerRenderMode) => void;
  viewMode: ViewportDisplayMode;
  onSetViewMode: (mode: ViewportDisplayMode) => void;
  onOpenExportModal: () => void;
  // Bambu Lab Features: Timelapse & AI Support
  onOpenTimelapseModal: () => void;
  onOpenSupportAIModal: () => void;
  hasGeminiKey: boolean;
  onOpenGeminiKeyModal: () => void;
  // Local Slicer CLI Bridge
  onOpenLocalSlicerModal: () => void;
  // Model Library / 3MF Selector
  onOpenModelLibrary?: () => void;
}

export function SimulatorHeader({
  currentModel,
  onSelectSample,
  onUploadFile,
  preflightReport,
  onOpenReportModal,
  isEmbedded,
  simulatorEngine,
  onSetEngine,
  onOpenEngineModal,
  showHeatmap,
  onToggleHeatmap,
  showToolhead,
  onToggleToolhead,
  showSupport,
  onToggleSupport,
  hasSupport,
  cameraView,
  onSetCameraView,
  renderMode,
  onSetRenderMode,
  viewMode,
  onSetViewMode,
  onOpenExportModal,
  onOpenTimelapseModal,
  onOpenSupportAIModal,
  hasGeminiKey,
  onOpenGeminiKeyModal,
  onOpenLocalSlicerModal,
  onOpenModelLibrary,
}: SimulatorHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  const scoreBadgeBg =
    preflightReport.printabilityScore >= 85
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30'
      : preflightReport.printabilityScore >= 60
      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-amber-500/30'
      : 'bg-rose-500/20 text-rose-300 border-rose-400/40 hover:bg-rose-500/30';

  const renderModes: { id: SlicerRenderMode; label: string; icon: React.ReactNode }[] = [
    { id: 'realistic', label: 'Nhựa Thật', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'features', label: 'Cấu Trúc', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'defects', label: 'Khuyết Tật', icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'speed', label: 'Lưu Lượng', icon: <Activity className="w-3.5 h-3.5 text-amber-400" /> },
  ];

  return (
    <header className="fixed top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
      {/* 1. Left Section: Logo & Model Selector */}
      <div className="flex items-center gap-2 pointer-events-auto shrink-0">
        {/* Brand Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border border-white/20 shadow-xl backdrop-blur-xl">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-black font-black text-xs shadow-md shadow-teal-500/30">
            3D
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-black text-xs sm:text-sm tracking-tight text-white">
              3D PrintSim Pro
            </span>
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-500/25 text-teal-300 border border-teal-400/30 hidden md:inline">
              CoreXY Lab
            </span>
          </div>
        </div>

        {/* Model Selector Dropdown & Library Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel border border-white/15 shadow-lg">
          <Box className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <select
            value={currentModel.id}
            onChange={(e) => {
              const found = SAMPLE_MODELS.find((m) => m.id === e.target.value);
              if (found) onSelectSample(found);
            }}
            className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1 max-w-[180px] truncate"
          >
            {/* Nếu là file tùy chỉnh upload từ máy tính */}
            {!SAMPLE_MODELS.some((m) => m.id === currentModel.id) && (
              <option value={currentModel.id} className="bg-slate-900 text-teal-300 font-bold">
                📂 {currentModel.name} ({currentModel.accentBadge})
              </option>
            )}
            {SAMPLE_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                {m.name} ({m.accentBadge})
              </option>
            ))}
          </select>

          {onOpenModelLibrary && (
            <button
              onClick={onOpenModelLibrary}
              className="px-2 py-0.5 rounded-full bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-400/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Mở kho mô hình 3MF / STL trên máy tính"
            >
              <span>Kho Model</span>
            </button>
          )}
        </div>

        {/* Dual-Engine Architecture Switcher Pill */}
        <div className="flex items-center gap-1 p-1 rounded-full glass-panel border border-white/20 shadow-xl bg-black/50 backdrop-blur-xl">
          <button
            onClick={() => onSetEngine('wasm_client')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              simulatorEngine === 'wasm_client'
                ? 'bg-gradient-to-r from-teal-400 to-emerald-400 text-black shadow-md font-black'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Engine 1: Web Client (Wasm Core) - Chạy thuần 100% trên trình duyệt"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>E1 Wasm</span>
          </button>

          <button
            onClick={() => onSetEngine('pro_local')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              simulatorEngine === 'pro_local'
                ? 'bg-gradient-to-r from-indigo-400 to-purple-400 text-black shadow-md font-black'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Engine 2: Pro Slicer (Local Core Microservice) - Chạy cục bộ trên máy tính (Localhost), độ chính xác CNC G-Code"
          >
            <Server className="w-3.5 h-3.5" />
            <span>E2 Local</span>
          </button>

          <button
            onClick={onOpenEngineModal}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/60 hover:text-white transition-all cursor-pointer"
            title="So sánh chi tiết 2 Engine"
          >
            <Cpu className="w-3.5 h-3.5 text-teal-300" />
          </button>
        </div>
      </div>

      {/* 2. Center Section: View Mode Toggle, Slicer Render Modes & Camera Presets */}
      <div className="hidden lg:flex items-center gap-1.5 pointer-events-auto">
        {/* View Mode Switcher: [📐 CAD] <-> [🧵 Sợi In Bambu] */}
        <div className="flex items-center gap-1 p-0.5 rounded-full glass-panel border border-white/20 shadow-lg bg-black/40">
          <button
            data-testid="view-mode-cad-btn"
            onClick={() => onSetViewMode('cad')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              viewMode === 'cad'
                ? 'bg-teal-400 text-black shadow-xs font-black'
                : 'text-white/60 hover:text-white'
            }`}
            title="Chế độ hiển thị phôi CAD 3D mượt"
          >
            <span>📐 CAD Mượt</span>
          </button>
          <button
            data-testid="view-mode-filament-btn"
            onClick={() => onSetViewMode('filament_preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              viewMode === 'filament_preview'
                ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-black shadow-sm font-black'
                : 'text-white/60 hover:text-white'
            }`}
            title="Chế độ xem trước sợi in thực tế Bambu Studio (G-code Toolpaths, Z-Seam & Tree Support)"
          >
            <Sparkles className="w-3 h-3 text-emerald-950" />
            <span>🧵 Sợi In Bambu</span>
          </button>
        </div>

        {/* Compact Slicer Render Mode Dropdown */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel border border-white/15 shadow-lg bg-black/40">
          <Sparkles className="w-3.5 h-3.5 text-teal-300 shrink-0" />
          <select
            value={renderMode}
            onChange={(e) => onSetRenderMode(e.target.value as SlicerRenderMode)}
            className="bg-transparent text-[11px] font-bold text-teal-200 focus:outline-none cursor-pointer"
          >
            {renderModes.map((rm) => (
              <option key={rm.id} value={rm.id} className="bg-slate-900 text-white font-medium">
                {rm.label}
              </option>
            ))}
          </select>
        </div>

        {/* Camera Angles */}
        <div className="flex items-center gap-0.5 p-1 rounded-full glass-panel border border-white/15 shadow-lg">
          {(['iso', 'front', 'top', 'nozzle'] as const).map((v) => (
            <button
              key={v}
              onClick={() => onSetCameraView(v)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
                cameraView === v
                  ? 'bg-white/30 text-white shadow-xs'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {v === 'iso' ? '3D' : v === 'front' ? 'Trước' : v === 'top' ? 'Đỉnh' : 'POV'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Right Section: Action Buttons */}
      <div className="flex items-center gap-1.5 pointer-events-auto shrink-0 justify-end">
        {/* Viewport Toggles (Toolhead & Support) */}
        <div className="flex items-center gap-1 p-1 rounded-full glass-panel border border-white/15 shadow-lg">
          <button
            onClick={onToggleToolhead}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              showToolhead
                ? 'bg-teal-400 text-black shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title="Bật/Tắt đầu in ảo"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">Đầu In</span>
          </button>

          {hasSupport && (
            <button
              onClick={onToggleSupport}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                showSupport
                  ? 'bg-amber-400 text-black shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title="Bật/Tắt cột chống Support"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Support</span>
            </button>
          )}
        </div>

        {/* Upload Custom Model Button (3MF / STL / OBJ) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".3mf,.stl,.obj"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full glass-panel hover:bg-white/15 border border-white/20 text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-lg"
          title="Tải file 3MF, STL hoặc OBJ từ máy tính"
        >
          <Upload className="w-3.5 h-3.5 text-teal-300" />
          <span className="hidden xl:inline">Nạp 3MF/STL</span>
        </button>

        {/* Local Slicer CLI Trigger (Bambu Studio & PrusaSlicer) */}
        <button
          onClick={onOpenLocalSlicerModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/25 to-teal-500/25 hover:from-emerald-500/35 hover:to-teal-500/35 text-emerald-200 border border-emerald-400/40 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur-md"
          title="Chạy Bambu Studio CLI và PrusaSlicer CLI cục bộ để sinh Tree Support thực tế"
        >
          <Zap className="w-3.5 h-3.5 text-emerald-300" />
          <span>Slicer CLI</span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300">
            Local
          </span>
        </button>

        {/* Gemini API Key Configuration Trigger */}
        <button
          data-testid="gemini-key-modal-btn"
          onClick={onOpenGeminiKeyModal}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur-md ${
            hasGeminiKey
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
              : 'bg-gradient-to-r from-amber-500/25 to-orange-500/25 hover:from-amber-500/35 hover:to-orange-500/35 text-amber-200 border border-amber-400/50 ring-1 ring-amber-400/30 font-black'
          }`}
          title={
            hasGeminiKey
              ? 'Google Gemini 2.0 Flash AI đã kết nối. Nhấp để kiểm tra hoặc đổi API Key'
              : 'Nhấp để nhập Google Gemini API Key trực tiếp trên giao diện web'
          }
        >
          {hasGeminiKey ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
              <Key className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Gemini AI</span>
            </>
          ) : (
            <>
              <Key className="w-3.5 h-3.5 text-amber-300" />
              <span>Nhập Gemini API</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            </>
          )}
        </button>

        {/* Bambu Support AI & Gemini Trigger */}
        <button
          onClick={onOpenSupportAIModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-400/40 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur-md"
          title="Trợ lý Bambu Support AI & Gemini 2.0 Flash phân tích vùng Overhang và tối ưu Tree Support"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-300" />
          <span>AI Support</span>
        </button>

        {/* Bambu Lab Timelapse Studio Trigger */}
        <button
          onClick={onOpenTimelapseModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-500/25 to-amber-500/25 hover:from-rose-500/35 hover:to-amber-500/35 text-rose-200 border border-rose-400/40 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur-md"
          title="Bambu Lab Timelapse Studio (Smooth Timelapse bãi đỗ Purge Chute)"
        >
          <Camera className="w-3.5 h-3.5 text-rose-300" />
          <span>Timelapse</span>
        </button>

        {/* Export Real Slicer Profile Button */}
        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-teal-500/30 to-emerald-500/30 hover:from-teal-500/40 hover:to-emerald-500/40 text-teal-200 border border-teal-400/50 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur-md"
          title="Xuất Profile sang Bambu Studio, OrcaSlicer, G-Code"
        >
          <Download className="w-3.5 h-3.5 text-teal-300" />
          <span className="hidden xl:inline">Xuất</span>
        </button>

        {/* Pre-Flight Inspection HUD Trigger */}
        <button
          onClick={onOpenReportModal}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur-md ${scoreBadgeBg}`}
          title="Xem bảng đánh giá khuyết tật và tính khả thi trước khi in"
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="font-mono font-black">{preflightReport.printabilityScore}/100</span>
        </button>

        {/* Embedded Status Badge (nếu nhúng trong 3D Hub) */}
        {isEmbedded && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/40 text-[10px] font-bold shadow-sm">
            <Link2 className="w-3 h-3 text-purple-300" />
            <span className="hidden xl:inline">3D Hub</span>
          </div>
        )}
      </div>
    </header>
  );
}

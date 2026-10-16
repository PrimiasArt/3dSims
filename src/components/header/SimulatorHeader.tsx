import React, { useRef, useState, useEffect } from 'react';
import {
  Upload,
  ShieldCheck,
  Compass,
  Layers,
  Box,
  Link2,
  Download,
  AlertTriangle,
  Activity,
  Sparkles,
  Zap,
  Server,
  Cpu,
  Camera,
  Key,
  FolderOpen,
  ChevronDown,
  Flame,
  Wrench,
  SlidersHorizontal,
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
  // Live Telemetry & Report Inspector
  onOpenLiveInspectorModal?: () => void;
  // AI 3D Generator Studio (Trellis / Tripo / Meshy)
  onOpenAI3DModal?: () => void;
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
  onOpenLiveInspectorModal,
  onOpenAI3DModal,
}: SimulatorHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isStudioMenuOpen, setIsStudioMenuOpen] = useState(false);
  const studioMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (studioMenuRef.current && !studioMenuRef.current.contains(e.target as Node)) {
        setIsStudioMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  const scoreBadgeStyle =
    preflightReport.printabilityScore >= 85
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25'
      : preflightReport.printabilityScore >= 60
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25'
      : 'bg-rose-500/15 text-rose-300 border-rose-500/35 hover:bg-rose-500/25';

  const renderModes: { id: SlicerRenderMode; label: string; icon: React.ReactNode }[] = [
    { id: 'realistic', label: 'Nhựa Thật', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'features', label: 'Line Type', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'defects', label: 'Góc Overhang', icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'speed', label: 'Lưu Lượng', icon: <Activity className="w-3.5 h-3.5 text-amber-400" /> },
  ];

  return (
    <header className="fixed top-2.5 left-3 right-3 z-30 flex items-center justify-between gap-1.5 pointer-events-none whitespace-nowrap">
      {/* =====================================================================
          1. CỤM TRÁI: THƯƠNG HIỆU & QUẢN LÝ FILE / MÔ HÌNH (UNIFIED MODEL BAR)
         ===================================================================== */}
      <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
        {/* Brand Identity */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-panel border border-white/15">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-slate-950 font-black text-[10px] shadow-sm shadow-emerald-500/30">
            3D
          </div>
          <span className="font-extrabold text-xs tracking-tight text-white">
            PrintSim
          </span>
          <span className="text-[8px] font-mono font-bold uppercase px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hidden 2xl:inline">
            STUDIO
          </span>
        </div>

        {/* Unified Model Selector + Library + Upload Dock */}
        <div className="flex items-center rounded-xl glass-panel border border-white/15 p-0.5">
          <div className="flex items-center gap-1 px-2 py-1">
            <Box className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <select
              value={currentModel.id}
              onChange={(e) => {
                const found = SAMPLE_MODELS.find((m) => m.id === e.target.value);
                if (found) onSelectSample(found);
              }}
              className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none cursor-pointer max-w-[125px] truncate"
              title="Chọn mô hình mẫu hoặc mô hình đang tải"
            >
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
          </div>

          <div className="w-[1px] h-4 bg-white/10" />

          {onOpenModelLibrary && (
            <button
              onClick={onOpenModelLibrary}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 text-slate-200 hover:text-teal-300 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Mở kho mô hình 3MF / STL có sẵn"
            >
              <FolderOpen className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden md:inline">Kho 3MF</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".3mf,.stl,.obj"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-teal-500/20 text-teal-300 border border-white/5 hover:border-teal-400/30 text-[11px] font-bold transition-all cursor-pointer ml-0.5"
            title="Tải file .3MF, .STL hoặc .OBJ từ máy tính và tự động cắt lớp"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden md:inline">Nạp File</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. CỤM GIỮA: 3 CHẾ ĐỘ LÀM VIỆC TRUNG TÂM (PREPARE / CAD / FILAMENT)
         ===================================================================== */}
      <div className="hidden lg:flex items-center gap-1.5 pointer-events-auto shrink-0">
        {/* 3-Stage Workspace Mode Switcher */}
        <div className="flex items-center p-0.5 rounded-xl glass-panel border border-white/15">
          <button
            data-testid="view-mode-prepare-btn"
            onClick={() => onSetViewMode('prepare')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              viewMode === 'prepare'
                ? 'bg-cyan-400 text-slate-950 shadow-xs font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Giai đoạn 1: Chuẩn bị bàn in (Xoay, Di chuyển, Tỉ lệ, Tự động đặt phẳng)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>Chuẩn Bị</span>
          </button>

          <button
            data-testid="view-mode-cad-btn"
            onClick={() => onSetViewMode('cad')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              viewMode === 'cad'
                ? 'bg-teal-400 text-slate-950 shadow-xs font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Giai đoạn 2: Mô phỏng đùn lớp trên phôi 3D CAD mượt + Mặt cắt Infill & Tree Support"
          >
            <Box className="w-3.5 h-3.5 shrink-0" />
            <span>Mô Phỏng CAD</span>
          </button>

          <button
            data-testid="view-mode-filament-btn"
            onClick={() => onSetViewMode('filament_preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              viewMode === 'filament_preview'
                ? 'bg-emerald-400 text-slate-950 shadow-xs font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Giai đoạn 3: Xem sợi in G-code thực tế từ Bambu Studio (Tường ngoài, Tường trong, Infill, Seam & Tree Support)"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Sợi In Bambu</span>
          </button>
        </div>

        {/* Viewport Display & Overlay Bar (Color Scheme + Toolhead + Support + Overhang Heatmap) */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl glass-panel border border-white/15">
          {/* Color Scheme Selector */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5">
            <Sparkles className="w-3 h-3 text-teal-400 shrink-0" />
            <select
              value={renderMode}
              onChange={(e) => onSetRenderMode(e.target.value as SlicerRenderMode)}
              className="bg-transparent text-[11px] font-semibold text-slate-200 focus:outline-none cursor-pointer"
              title="Chọn chế độ tô màu phân tích kỹ thuật"
            >
              {renderModes.map((rm) => (
                <option key={rm.id} value={rm.id} className="bg-slate-900 text-white">
                  {rm.label}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[1px] h-4 bg-white/10" />

          {/* Toolhead Toggle */}
          <button
            onClick={onToggleToolhead}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              showToolhead
                ? 'bg-teal-500/20 text-teal-300 border border-teal-400/35'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title="Bật/Tắt đầu phun CoreXY ảo"
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline">Đầu In</span>
          </button>

          {/* Support Visibility Toggle */}
          {hasSupport && (
            <button
              onClick={onToggleSupport}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                showSupport
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
              title="Ẩn/Hiện cấu trúc cây đỡ Support"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">Support</span>
            </button>
          )}

          {/* Overhang Heatmap Toggle */}
          <button
            onClick={onToggleHeatmap}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              showHeatmap
                ? 'bg-rose-500/20 text-rose-300 border border-rose-400/35'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title="Bật/Tắt bản đồ nhiệt cảnh báo góc nghiêng Overhang (>45°)"
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* =====================================================================
          3. CỤM PHẢI: MENU "AI & STUDIO TOOLS" + PREFLIGHT SCORE + XUẤT G-CODE
         ===================================================================== */}
      <div className="flex items-center gap-1.5 pointer-events-auto shrink-0 justify-end">
        {/* Unified "AI & Studio Tools" Split Pill */}
        <div ref={studioMenuRef} className="relative">
          <div className="flex items-center rounded-xl glass-panel border border-white/15 p-0.5">
            {/* Quick AI 3D Trigger inside the unified pill */}
            {onOpenAI3DModal && (
              <>
                <button
                  data-testid="ai-3d-generator-btn"
                  onClick={onOpenAI3DModal}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-teal-300 hover:bg-teal-500/15 transition-colors cursor-pointer"
                  title="Tạo mô hình 3D tự động bằng AI (Trellis / Tripo3D / Meshy)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="hidden 2xl:inline">AI 3D</span>
                </button>
                <div className="w-[1px] h-4 bg-white/10" />
              </>
            )}

            {/* Quick Gemini Key Status Indicator */}
            <button
              data-testid="gemini-key-modal-btn"
              onClick={onOpenGeminiKeyModal}
              className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                hasGeminiKey
                  ? 'text-emerald-300 hover:bg-emerald-500/15'
                  : 'text-amber-300 bg-amber-500/15 hover:bg-amber-500/25'
              }`}
              title={
                hasGeminiKey
                  ? 'Google Gemini AI đã kết nối — Nhấp để kiểm tra API Key'
                  : 'Nhấp để thiết lập Google Gemini API Key'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasGeminiKey ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
                }`}
              />
              <Key className="w-3 h-3 shrink-0" />
            </button>

            <div className="w-[1px] h-4 bg-white/10" />

            {/* Studio Tools Dropdown Trigger */}
            <button
              data-testid="studio-tools-menu-btn"
              onClick={() => setIsStudioMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                isStudioMenuOpen || simulatorEngine === 'pro_local'
                  ? 'bg-teal-500/20 text-teal-200 border border-teal-400/30'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
              title="Mở bảng AI & Studio Tools (Slicer CLI, AI Support Copilot, Timelapse, Chuyển đổi Engine E1/E2)"
            >
              <Wrench className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>AI &amp; Tools</span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform ${
                  isStudioMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Consolidated AI & Studio Tools Popover */}
          {isStudioMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl glass-panel border border-white/15 p-3 shadow-2xl space-y-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-1.5 pb-1.5 border-b border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  AI &amp; Studio Tools Hub
                </span>
                <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                  Bambu Core
                </span>
              </div>

              {/* 1. Local Slicer CLI (Bambu Studio & PrusaSlicer) */}
              <button
                onClick={() => {
                  setIsStudioMenuOpen(false);
                  onOpenLocalSlicerModal();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-200 group-hover:text-white flex items-center gap-1.5">
                      <span>Bambu Studio / PrusaSlicer CLI</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300">
                        Local
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Cắt lớp G-code &amp; dựng Tree Support chuẩn thực tế
                    </div>
                  </div>
                </div>
              </button>

              {/* 2. AI 3D Model Generator */}
              {onOpenAI3DModal && (
                <button
                  onClick={() => {
                    setIsStudioMenuOpen(false);
                    onOpenAI3DModal();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-cyan-300">
                        AI Tạo Mô Hình 3D (Trellis / Tripo)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Tạo phôi 3D từ văn bản hoặc hình ảnh
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* 3. AI Support Copilot */}
              <button
                onClick={() => {
                  setIsStudioMenuOpen(false);
                  onOpenSupportAIModal();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-teal-300">
                      Trợ Lý AI Support &amp; Góc Đặt
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Gemini 2.0 phân tích Overhang &amp; tối ưu thông số
                    </div>
                  </div>
                </div>
              </button>

              {/* 4. Timelapse Studio */}
              <button
                onClick={() => {
                  setIsStudioMenuOpen(false);
                  onOpenTimelapseModal();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-300 shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-rose-300">
                      Bambu Timelapse Studio
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Mô phỏng Smooth Timelapse đỗ đầu phun Purge Chute
                    </div>
                  </div>
                </div>
              </button>

              {/* 5. Gemini API Key Config */}
              <button
                onClick={() => {
                  setIsStudioMenuOpen(false);
                  onOpenGeminiKeyModal();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center gap-1.5">
                      <span>Cấu Hình Gemini API Key</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          hasGeminiKey
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {hasGeminiKey ? 'Đã kết nối' : 'Chưa nhập'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Quản lý khóa kết nối Google Gemini AI
                    </div>
                  </div>
                </div>
              </button>

              {/* 6. Dual-Engine Switcher */}
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-semibold text-slate-400">
                    Bộ Giải Mô Phỏng (Simulation Engine):
                  </span>
                  <button
                    onClick={() => {
                      setIsStudioMenuOpen(false);
                      onOpenEngineModal();
                    }}
                    className="text-[10px] text-teal-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Cpu className="w-3 h-3" />
                    <span>So sánh E1/E2</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 bg-black/50 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => onSetEngine('wasm_client')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      simulatorEngine === 'wasm_client'
                        ? 'bg-teal-400 text-slate-950 font-extrabold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>E1 Web Wasm</span>
                  </button>
                  <button
                    onClick={() => onSetEngine('pro_local')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      simulatorEngine === 'pro_local'
                        ? 'bg-indigo-400 text-slate-950 font-extrabold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Server className="w-3 h-3" />
                    <span>E2 CNC Local</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

<<<<<<< HEAD
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

        {/* Live Telemetry & Report Inspector Button */}
        {onOpenLiveInspectorModal && (
          <button
            onClick={onOpenLiveInspectorModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/25 to-blue-500/25 hover:from-cyan-500/35 hover:to-blue-500/35 text-cyan-200 border border-cyan-400/40 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur-md"
            title="Truy xuất trực tiếp các giá trị thay đổi của app và thông số report đã khóa"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
            <span className="hidden sm:inline">Truy Xuất Report</span>
          </button>
        )}

        {/* Pre-Flight Printability Score Badge */}
        <button
          onClick={onOpenReportModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer glass-panel ${scoreBadgeStyle}`}
          title="Đánh giá độ khả thi và cảnh báo khuyết tật trước khi in"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="font-mono font-black">{preflightReport.printabilityScore}</span>
          <span className="text-[10px] opacity-60 hidden sm:inline">/100</span>
        </button>

        {/* Primary Action CTA: Export G-Code / Profile */}
        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 text-xs font-extrabold transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/20"
          title="Xuất cấu hình Slicer (.json) hoặc mã máy G-Code (.gcode)"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
          <span>Xuất</span>
        </button>

        {isEmbedded && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-400/40 text-[10px] font-bold">
            <Link2 className="w-3 h-3 text-purple-300" />
            <span className="hidden 2xl:inline">3D Hub</span>
          </div>
        )}
      </div>
    </header>
  );
}

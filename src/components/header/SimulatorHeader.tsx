import React, { useRef, useState, useEffect } from 'react';
import {
  IconCube,
  IconAxis,
  IconLayers,
  IconToolpath,
  IconNozzle,
  IconSupport,
  IconAngle,
  IconImport,
  IconExport,
  IconArchive,
  IconMeshGen,
  IconTerminal,
  IconCheckShield,
  IconSliders,
  IconKeyMinimal,
  IconAperture,
  IconSun,
  IconMoon,
  IconChevronDown,
} from '@/components/icons/MinimalIcons';
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
  simulatorEngine: SimulatorEngineType;
  onSetEngine: (engine: SimulatorEngineType) => void;
  onOpenEngineModal: () => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  showToolhead: boolean;
  onToggleToolhead: () => void;
  showSupport: boolean;
  onToggleSupport: () => void;
  hasSupport: boolean;
  cameraView: 'iso' | 'top' | 'front' | 'nozzle';
  onSetCameraView: (view: 'iso' | 'top' | 'front' | 'nozzle') => void;
  renderMode: SlicerRenderMode;
  onSetRenderMode: (mode: SlicerRenderMode) => void;
  viewMode: ViewportDisplayMode;
  onSetViewMode: (mode: ViewportDisplayMode) => void;
  onOpenExportModal: () => void;
  onOpenTimelapseModal: () => void;
  onOpenSupportAIModal: () => void;
  hasGeminiKey: boolean;
  onOpenGeminiKeyModal: () => void;
  onOpenLocalSlicerModal: () => void;
  onOpenModelLibrary?: () => void;
  onOpenAI3DModal?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export function SimulatorHeader({
  currentModel,
  onSelectSample,
  onUploadFile,
  preflightReport,
  onOpenReportModal,
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
  onOpenAI3DModal,
  theme = 'dark',
  onToggleTheme,
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

  const renderModes: { id: SlicerRenderMode; label: string }[] = [
    { id: 'realistic', label: 'Vật Liệu PBR' },
    { id: 'features', label: 'Cấu Trúc Lớp' },
    { id: 'defects', label: 'Góc Overhang' },
    { id: 'speed', label: 'Lưu Lượng Đùn' },
  ];

  return (
    <header className="fixed top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none whitespace-nowrap">
      {/* =====================================================================
          1. CỤM TRÁI: NHẬN DIỆN STUDIO & QUẢN LÝ PHÔI MÔ HÌNH
         ===================================================================== */}
      <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
        {/* Minimalist Architectural Brand Mark */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel">
          <div className="w-5 h-5 rounded-md studio-pill-active flex items-center justify-center">
            <IconCube size={12} />
          </div>
          <span className="font-semibold text-xs tracking-tight studio-text-primary">
            PrintSim
          </span>
          <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded studio-gold-badge hidden xl:inline">
            PRO
          </span>
        </div>

        {/* Unified Model Selector + Library + Import Bar */}
        <div className="flex items-center rounded-xl glass-panel p-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1">
            <IconCube size={13} className="studio-text-gold shrink-0" />
            <select
              value={currentModel.id}
              onChange={(e) => {
                const found = SAMPLE_MODELS.find((m) => m.id === e.target.value);
                if (found) onSelectSample(found);
              }}
              className="bg-transparent text-xs font-medium studio-text-primary focus:outline-none cursor-pointer max-w-[135px] truncate"
              title="Chọn phôi mô hình 3D"
            >
              {!SAMPLE_MODELS.some((m) => m.id === currentModel.id) && (
                <option value={currentModel.id} className="bg-neutral-900 text-amber-200 font-semibold">
                  {currentModel.name} ({currentModel.accentBadge})
                </option>
              )}
              {SAMPLE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-neutral-900 text-neutral-100">
                  {m.name} ({m.accentBadge})
                </option>
              ))}
            </select>
          </div>

          <div className="w-[1px] h-3.5 bg-[var(--border-hairline)]" />

          {onOpenModelLibrary && (
            <button
              onClick={onOpenModelLibrary}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg studio-pill-inactive text-[11px] font-medium transition-colors cursor-pointer"
              title="Thư viện phôi 3MF / STL"
            >
              <IconArchive size={12} />
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg studio-gold-badge text-[11px] font-medium transition-all cursor-pointer ml-0.5 hover:opacity-85"
            title="Nạp file CAD (.3MF, .STL, .OBJ)"
          >
            <IconImport size={12} />
            <span className="hidden md:inline">Nạp File</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. CỤM GIỮA: 3 CHẾ ĐỘ LÀM VIỆC TRUNG TÂM (PREPARE / CAD / FILAMENT)
         ===================================================================== */}
      <div className="hidden lg:flex items-center gap-1.5 pointer-events-auto shrink-0">
        {/* 3-Stage Workspace Mode Switcher (Zero emojis, Pure Minimalist Geometry) */}
        <div className="flex items-center p-0.5 rounded-xl glass-panel">
          <button
            data-testid="view-mode-prepare-btn"
            onClick={() => onSetViewMode('prepare')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
              viewMode === 'prepare' ? 'studio-pill-active' : 'studio-pill-inactive font-medium'
            }`}
            title="Giai đoạn 1: Chuẩn bị bàn in (Định vị, Xoay góc, Tỉ lệ)"
          >
            <IconAxis size={13} />
            <span>Chuẩn Bị</span>
          </button>

          <button
            data-testid="view-mode-cad-btn"
            onClick={() => onSetViewMode('cad')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
              viewMode === 'cad' ? 'studio-pill-active' : 'studio-pill-inactive font-medium'
            }`}
            title="Giai đoạn 2: Mô phỏng cắt lớp trên phôi CAD & Conformal Support"
          >
            <IconCube size={13} />
            <span>Mô Phỏng CAD</span>
          </button>

          <button
            data-testid="view-mode-filament-btn"
            onClick={() => onSetViewMode('filament_preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
              viewMode === 'filament_preview' ? 'studio-pill-active' : 'studio-pill-inactive font-medium'
            }`}
            title="Giai đoạn 3: Xem sợi in G-code Bambu Studio thực tế"
          >
            <IconToolpath size={13} />
            <span>Sợi In Bambu</span>
          </button>
        </div>

        {/* Viewport Display & Overlay Bar */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl glass-panel">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg studio-card">
            <IconLayers size={12} className="studio-text-gold shrink-0" />
            <select
              value={renderMode}
              onChange={(e) => onSetRenderMode(e.target.value as SlicerRenderMode)}
              className="bg-transparent text-[11px] font-medium studio-text-primary focus:outline-none cursor-pointer"
              title="Chế độ hiển thị bề mặt kỹ thuật"
            >
              {renderModes.map((rm) => (
                <option key={rm.id} value={rm.id} className="bg-neutral-900 text-neutral-100">
                  {rm.label}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[1px] h-3.5 bg-[var(--border-hairline)] mx-0.5" />

          <button
            onClick={onToggleToolhead}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
              showToolhead ? 'studio-gold-badge font-semibold' : 'studio-pill-inactive'
            }`}
            title="Ẩn/Hiện cụm đầu phun CoreXY"
          >
            <IconNozzle size={12} />
            <span className="hidden xl:inline">Đầu In</span>
          </button>

          {hasSupport && (
            <button
              onClick={onToggleSupport}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                showSupport ? 'studio-gold-badge font-semibold' : 'studio-pill-inactive'
              }`}
              title="Ẩn/Hiện cấu trúc Tree Support"
            >
              <IconSupport size={12} />
              <span className="hidden xl:inline">Support</span>
            </button>
          )}

          <button
            onClick={onToggleHeatmap}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
              showHeatmap ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'studio-pill-inactive'
            }`}
            title="Phân tích góc nghiêng Overhang (>45°)"
          >
            <IconAngle size={12} />
          </button>
        </div>
      </div>

      {/* =====================================================================
          3. CỤM PHẢI: AI & STUDIO TOOLS + THEME TOGGLE + PREFLIGHT + XUẤT
         ===================================================================== */}
      <div className="flex items-center gap-1.5 pointer-events-auto shrink-0 justify-end">
        {/* Consolidated AI & Studio Tools Pill */}
        <div ref={studioMenuRef} className="relative">
          <div className="flex items-center rounded-xl glass-panel p-0.5">
            {onOpenAI3DModal && (
              <>
                <button
                  data-testid="ai-3d-generator-btn"
                  onClick={onOpenAI3DModal}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium studio-pill-inactive cursor-pointer"
                  title="Tạo phôi 3D bằng AI (Trellis / Tripo3D / Meshy)"
                >
                  <IconMeshGen size={13} className="studio-text-gold" />
                </button>
                <div className="w-[1px] h-3.5 bg-[var(--border-hairline)]" />
              </>
            )}

            <button
              data-testid="gemini-key-modal-btn"
              onClick={onOpenGeminiKeyModal}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium studio-pill-inactive cursor-pointer"
              title={
                hasGeminiKey
                  ? 'Đã kết nối Gemini AI — Nhấp để quản lý khóa API'
                  : 'Thiết lập khóa kết nối Gemini API'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasGeminiKey ? 'bg-emerald-400' : 'bg-[var(--accent-gold)]'
                }`}
              />
              <IconKeyMinimal size={12} />
            </button>

            <div className="w-[1px] h-3.5 bg-[var(--border-hairline)]" />

            <button
              data-testid="studio-tools-menu-btn"
              onClick={() => setIsStudioMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                isStudioMenuOpen || simulatorEngine === 'pro_local'
                  ? 'studio-gold-badge font-semibold'
                  : 'studio-pill-inactive'
              }`}
              title="Mở bộ công cụ AI & Slicer Studio"
            >
              <IconSliders size={12} />
              <span>Studio Tools</span>
              <IconChevronDown
                size={11}
                className={`transition-transform ${isStudioMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* Minimalist Architectural Dropdown Menu */}
          {isStudioMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl glass-panel p-3 space-y-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-1.5 pb-1.5 border-b studio-border flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest studio-text-muted">
                  BỘ CÔNG CỤ KỸ THUẬT &amp; AI
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded studio-gold-badge">
                  CORE STUDIO
                </span>
              </div>

              {/* 1. Local Slicer CLI */}
              <button
                onClick={() => {
                  setIsStudioMenuOpen(false);
                  onOpenLocalSlicerModal();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl studio-card hover:border-[var(--accent-gold-border)] text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg studio-gold-badge flex items-center justify-center shrink-0">
                    <IconTerminal size={15} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold studio-text-primary flex items-center gap-1.5">
                      <span>Bambu Studio / PrusaSlicer CLI</span>
                    </div>
                    <div className="text-[10px] studio-text-secondary">
                      Biên dịch G-code &amp; Tree Support gốc cục bộ
                    </div>
                  </div>
                </div>
              </button>

              {/* 2. AI 3D Mesh Synthesis */}
              {onOpenAI3DModal && (
                <button
                  onClick={() => {
                    setIsStudioMenuOpen(false);
                    onOpenAI3DModal();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--bg-hover)] text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg studio-card flex items-center justify-center studio-text-gold shrink-0">
                      <IconMeshGen size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold studio-text-primary">
                        Tổng Hợp Phôi 3D (Trellis / Tripo)
                      </div>
                      <div className="text-[10px] studio-text-secondary">
                        Tạo lưới 3D từ mô tả kỹ thuật hoặc ảnh chụp
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* 3. AI Overhang & Orientation Advisor */}
              <button
                onClick={() => {
                  setIsStudioMenuOpen(false);
                  onOpenSupportAIModal();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--bg-hover)] text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg studio-card flex items-center justify-center studio-text-gold shrink-0">
                    <IconAngle size={15} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold studio-text-primary">
                      Phân Tích Góc Đặt &amp; Support AI
                    </div>
                    <div className="text-[10px] studio-text-secondary">
                      Tối ưu hóa hướng đặt phôi giảm thiểu nhựa đỡ
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
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--bg-hover)] text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg studio-card flex items-center justify-center studio-text-secondary shrink-0">
                    <IconAperture size={15} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold studio-text-primary">
                      Bambu Timelapse Studio
                    </div>
                    <div className="text-[10px] studio-text-secondary">
                      Ghi hình Smooth Timelapse tại vị trí Purge Chute
                    </div>
                  </div>
                </div>
              </button>

              {/* 5. Gemini API Key */}
              <button
                onClick={() => {
                  setIsStudioMenuOpen(false);
                  onOpenGeminiKeyModal();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--bg-hover)] text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg studio-card flex items-center justify-center studio-text-gold shrink-0">
                    <IconKeyMinimal size={15} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold studio-text-primary flex items-center gap-2">
                      <span>Khóa Kết Nối Gemini API</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono studio-gold-badge">
                        {hasGeminiKey ? 'ĐÃ KẾT NỐI' : 'CHƯA CẤU HÌNH'}
                      </span>
                    </div>
                    <div className="text-[10px] studio-text-secondary">
                      Xác thực mô hình suy luận hình học đám mây
                    </div>
                  </div>
                </div>
              </button>

              {/* 6. Dual-Engine Switcher */}
              <div className="pt-2 border-t studio-border space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-medium studio-text-secondary">
                    Nhân Mô Phỏng (Core Engine):
                  </span>
                  <button
                    onClick={() => {
                      setIsStudioMenuOpen(false);
                      onOpenEngineModal();
                    }}
                    className="text-[10px] studio-text-gold hover:underline cursor-pointer"
                  >
                    Chi tiết kiến trúc →
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 studio-card p-1 rounded-xl">
                  <button
                    onClick={() => onSetEngine('wasm_client')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                      simulatorEngine === 'wasm_client'
                        ? 'studio-pill-active'
                        : 'studio-pill-inactive font-medium'
                    }`}
                  >
                    <span>E1 Web Wasm</span>
                  </button>
                  <button
                    onClick={() => onSetEngine('pro_local')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                      simulatorEngine === 'pro_local'
                        ? 'studio-pill-active'
                        : 'studio-pill-inactive font-medium'
                    }`}
                  >
                    <span>E2 CNC Local</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dark / Light Mode Toggle Button */}
        {onToggleTheme && (
          <button
            data-testid="theme-toggle-btn"
            onClick={onToggleTheme}
            className="p-2 rounded-xl glass-panel hover:opacity-85 transition-all cursor-pointer"
            title={
              theme === 'dark'
                ? 'Chuyển sang Giao diện Sáng (Soft Daylight Studio)'
                : 'Chuyển sang Giao diện Tối (Obsidian Dark Mode)'
            }
          >
            {theme === 'dark' ? (
              <IconSun size={14} className="studio-text-gold" />
            ) : (
              <IconMoon size={14} className="studio-text-primary" />
            )}
          </button>
        )}

        {/* Primary Export CTA */}
        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-cta-primary text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm"
          title="Xuất G-Code hoặc hồ sơ cắt lớp (.json)"
        >
          <IconExport size={13} />
          <span>Xuất</span>
        </button>
      </div>
    </header>
  );
}

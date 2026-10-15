import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Zap,
  Terminal,
  Layers,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  FolderOpen,
  Cpu,
  Server,
  FileCode,
  Download,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronRight,
} from 'lucide-react';
import {
  detectLocalSlicers,
  runLocalSlice,
  ILocalSlicerInfo,
  ISliceResponse,
} from '@/services/localSlicerService';
import { ISampleModel, ISimulationProfile, TreeSupportStyle } from '@/types/simulator';

interface LocalSlicerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: ISampleModel;
  profile: ISimulationProfile;
  onApplyProfilePatch: (patch: Partial<ISimulationProfile>) => void;
  onApplySliceResult?: (result: ISliceResponse) => void;
}

export function LocalSlicerModal({
  isOpen,
  onClose,
  currentModel,
  profile,
  onApplyProfilePatch,
  onApplySliceResult,
}: LocalSlicerModalProps) {
  // 1. Slicer Engine State
  const [slicers, setSlicers] = useState<ILocalSlicerInfo[]>([]);
  const [selectedEngine, setSelectedEngine] = useState<'bambu_studio' | 'prusa_slicer' | 'orca_slicer' | 'custom'>('bambu_studio');
  const [customPath, setCustomPath] = useState<string>('');
  const [isLoadingSlicers, setIsLoadingSlicers] = useState<boolean>(true);

  // 2. Support Configuration State
  const [supportEnabled, setSupportEnabled] = useState<boolean>(profile.supportMode !== 'none');
  const [treeStyle, setTreeStyle] = useState<TreeSupportStyle>(profile.treeStyle || 'organic');
  const [angleThreshold, setAngleThreshold] = useState<number>(profile.supportAngleThreshold || 45);
  const [topZDistance, setTopZDistance] = useState<number>(profile.supportTopZDistance || 0.2);
  const [branchDiameter, setBranchDiameter] = useState<number>(profile.supportBranchDiameter || 3.2);
  const [onBedOnly, setOnBedOnly] = useState<boolean>(profile.supportOnBuildPlateOnly ?? true);

  // 3. Execution & Terminal State
  const [isSlicing, setIsSlicing] = useState<boolean>(false);
  const [sliceResult, setSliceResult] = useState<ISliceResponse | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'terminal' | 'gcode' | 'summary'>('terminal');
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Dò tìm Slicer khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingSlicers(true);

    detectLocalSlicers().then((data) => {
      if (!isMounted) return;
      setSlicers(data.slicers || []);
      const detectedDefault = data.slicers?.find((s) => s.isAvailable)?.id || 'bambu_studio';
      setSelectedEngine(detectedDefault as any);
      setIsLoadingSlicers(false);

      setTerminalLogs([
        `[System Probe] Đã hoàn tất dò quét phần mềm Slicer cục bộ trên máy tính.`,
        ...data.slicers.map(
          (s) =>
            ` - [${s.isAvailable ? 'SẴN SÀNG ✅' : 'CHƯA CÀI ⚠️'}] ${s.name}: ${s.path}`
        ),
        `[Default Engine] Kích hoạt mặc định: ${detectedDefault.toUpperCase()}`,
        `[Model Target] Mô hình mục tiêu: ${currentModel.name} (${currentModel.dimensionsMm.join(' x ')} mm)`,
      ]);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentModel]);

  // Tự cuộn console xuống dòng mới
  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, activeTab]);

  if (!isOpen) return null;

  const currentSlicer = slicers.find((s) => s.id === selectedEngine);

  // Chạy tiến trình Slicing Local
  const handleExecuteSlice = async () => {
    setIsSlicing(true);
    setAppliedNotice(null);
    setActiveTab('terminal');

    const timestamp = new Date().toLocaleTimeString('vi-VN');
    setTerminalLogs((prev) => [
      ...prev,
      `\n-----------------------------------------------------------`,
      `[${timestamp}] 🚀 Bắt đầu lệnh Slicing cục bộ...`,
      `[CLI Command] ${
        selectedEngine === 'bambu_studio'
          ? `bambu-studio.exe --slice 0 --outputdir ./temp_local_slice ${currentModel.name}.3mf`
          : `prusa-slicer-console.exe --export-gcode --support-material-style ${treeStyle} ${currentModel.name}.stl`
      }`,
      `[Support Configuration] Style=${treeStyle.toUpperCase()}, Angle=${angleThreshold}°, TopZ=${topZDistance}mm, BranchDia=${branchDiameter}mm`,
      `[Status] Đang thực thi tiến trình trên vi xử lý CPU máy tính...`,
    ]);

    try {
      const res = await runLocalSlice({
        engine: selectedEngine,
        slicerPath: selectedEngine === 'custom' ? customPath : currentSlicer?.path,
        modelName: currentModel.name,
        supportSettings: {
          enabled: supportEnabled,
          style: treeStyle as any,
          angleThreshold,
          topZDistance,
          branchDiameter,
        },
      });

      setSliceResult(res);

      setTerminalLogs((prev) => [
        ...prev,
        res.logs,
        `[Result] Slicing thành công! Tổng số lớp: ${res.totalLayers}, Thời gian ước tính: ${Math.round(
          res.estimatedTimeSec / 60
        )} phút, Khối lượng nhựa: ${res.filamentWeightGrams}g`,
        `[Support Telemetry] Phát hiện ${res.supportLinesCount.toLocaleString()} đường chạy dao Tree Support!`,
        `[Ready] Đã sẵn sàng áp dụng trực tiếp vào Viewport 3D mô phỏng.`,
      ]);

      setActiveTab('summary');
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        `[Error ❌] Lỗi thực thi Slicing: ${err.message}`,
        `[Fallback] Hãy kiểm tra đường dẫn file thực thi slicer hoặc cho phép quyền ứng dụng.`,
      ]);
    } finally {
      setIsSlicing(false);
    }
  };

  // Áp dụng cấu hình và kết quả Slicing vào Viewport 3D
  const handleApplyToViewport = () => {
    onApplyProfilePatch({
      supportMode: supportEnabled ? 'tree' : 'none',
      treeStyle,
      supportAngleThreshold: angleThreshold,
      supportTopZDistance: topZDistance,
      supportBranchDiameter: branchDiameter,
      supportOnBuildPlateOnly: onBedOnly,
    });

    if (sliceResult && onApplySliceResult) {
      onApplySliceResult(sliceResult);
    }

    setAppliedNotice('✓ Đã áp dụng thành công G-Code & Cấu trúc Tree Support vào Viewport 3D!');
    setTimeout(() => {
      setAppliedNotice(null);
      onClose();
    }, 1200);
  };

  // Tải file G-code về máy
  const handleDownloadGcode = () => {
    if (!sliceResult) return;
    const blob = new Blob([sliceResult.gcodeHeader + '\n\n' + sliceResult.rawGcodeSnippet + '\n\n' + sliceResult.gcodeTail], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentModel.name}_${selectedEngine}_sliced.gcode`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full max-w-5xl rounded-3xl glass-panel border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center text-black font-black shadow-lg shadow-emerald-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">
                  Local Slicer CLI Bridge
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Bambu Studio & PrusaSlicer
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  Native CLI
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Chạy lệnh <code className="text-emerald-300 font-mono">--slice</code> trực tiếp trên máy tính để tạo cấu trúc Tree Support thực tế chuẩn xác nhất
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice applied banner */}
        {appliedNotice && (
          <div className="px-6 py-2.5 bg-emerald-500/30 border-b border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{appliedNotice}</span>
          </div>
        )}

        {/* Content Body Grid */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Row: Engine Selection & Model Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Slicer 1: Bambu Studio CLI */}
            <div
              onClick={() => setSelectedEngine('bambu_studio')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedEngine === 'bambu_studio'
                  ? 'bg-gradient-to-b from-emerald-950/70 to-slate-900 border-emerald-400 ring-2 ring-emerald-400/30 shadow-lg'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    BS
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Bambu Studio CLI</div>
                    <div className="text-[10px] text-emerald-400 font-mono">bambu-studio.exe</div>
                  </div>
                </div>
                {slicers.find((s) => s.id === 'bambu_studio')?.isAvailable ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-black text-[9px] font-black uppercase">
                    Đã Cài ✅
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-[9px] font-mono">
                    Khuyên Dùng
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/60 mt-2 line-clamp-2">
                Hệ thống Tree Support Organic độc quyền, chân đế loe chống rung và bóc tách siêu mượt.
              </p>
            </div>

            {/* Slicer 2: PrusaSlicer CLI */}
            <div
              onClick={() => setSelectedEngine('prusa_slicer')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedEngine === 'prusa_slicer'
                  ? 'bg-gradient-to-b from-orange-950/70 to-slate-900 border-orange-400 ring-2 ring-orange-400/30 shadow-lg'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
                    PS
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">PrusaSlicer CLI</div>
                    <div className="text-[10px] text-orange-400 font-mono">prusa-slicer-console.exe</div>
                  </div>
                </div>
                {slicers.find((s) => s.id === 'prusa_slicer')?.isAvailable ? (
                  <span className="px-2 py-0.5 rounded-full bg-orange-400 text-black text-[9px] font-black uppercase">
                    Đã Cài ✅
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-[9px] font-mono">
                    Organic v2.8
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/60 mt-2 line-clamp-2">
                Thuật toán Organic Support mã nguồn mở danh tiếng, đường in ổn định không tạo vết xước.
              </p>
            </div>

            {/* Slicer 3: OrcaSlicer CLI */}
            <div
              onClick={() => setSelectedEngine('orca_slicer')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedEngine === 'orca_slicer'
                  ? 'bg-gradient-to-b from-cyan-950/70 to-slate-900 border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                    OS
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">OrcaSlicer CLI</div>
                    <div className="text-[10px] text-cyan-400 font-mono">orca-slicer.exe</div>
                  </div>
                </div>
                {slicers.find((s) => s.id === 'orca_slicer')?.isAvailable ? (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-400 text-black text-[9px] font-black uppercase">
                    Đã Cài ✅
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-[9px] font-mono">
                    High Speed
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/60 mt-2 line-clamp-2">
                Bộ sinh G-Code tốc độ cao với các tùy biến dòng chảy và áp lực extrusion tiên tiến.
              </p>
            </div>
          </div>

          {/* Middle Row: Support Parameters Configuration Panel */}
          <div className="p-5 rounded-2xl glass-panel border border-white/15 bg-black/40 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Tùy Chỉnh Thông Số Tree Support Chuẩn Slicer
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-white/80">
                  <input
                    type="checkbox"
                    checked={supportEnabled}
                    onChange={(e) => setSupportEnabled(e.target.checked)}
                    className="accent-emerald-400 w-4 h-4 rounded cursor-pointer"
                  />
                  <span>Bật Cột Chống Support</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tree Support Style */}
              <div>
                <label className="text-[11px] font-bold text-white/70 block mb-1">
                  Phong Cách Tree Support
                </label>
                <select
                  value={treeStyle}
                  onChange={(e) => setTreeStyle(e.target.value as TreeSupportStyle)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-white/20 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  <option value="organic">Organic (Chuẩn Bambu / Prusa)</option>
                  <option value="slim">Slim (Thon gọn, tiết kiệm nhựa)</option>
                  <option value="strong">Strong (Trụ lớn, chống rung ngã)</option>
                  <option value="hybrid">Hybrid (Cây kết hợp đế Snug)</option>
                </select>
              </div>

              {/* Overhang Threshold */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-white/70 mb-1">
                  <span>Ngưỡng Góc Overhang</span>
                  <span className="text-emerald-300 font-mono font-black">{angleThreshold}°</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="65"
                  step="1"
                  value={angleThreshold}
                  onChange={(e) => setAngleThreshold(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              {/* Top Z Distance (Air Gap) */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-white/70 mb-1">
                  <span>Khe Hở Bóc Tách (Top Z)</span>
                  <span className="text-emerald-300 font-mono font-black">{topZDistance.toFixed(2)} mm</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.30"
                  step="0.02"
                  value={topZDistance}
                  onChange={(e) => setTopZDistance(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              {/* Branch Diameter */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-white/70 mb-1">
                  <span>Đường Kính Thân Cành</span>
                  <span className="text-emerald-300 font-mono font-black">{branchDiameter.toFixed(1)} mm</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="5.0"
                  step="0.2"
                  value={branchDiameter}
                  onChange={(e) => setBranchDiameter(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Action Trigger Bar */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-slate-900 border border-emerald-500/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black text-white flex items-center gap-2">
                  <span>Mô Hình: {currentModel.name}</span>
                  <span className="text-[10px] font-mono text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-400/20">
                    {currentModel.accentBadge}
                  </span>
                </div>
                <div className="text-[11px] text-white/60">
                  Binary: <span className="font-mono text-emerald-300">{currentSlicer?.path || 'Auto Built-in'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={isSlicing}
                onClick={handleExecuteSlice}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 ${
                  isSlicing
                    ? 'bg-emerald-500/50 text-black cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-black hover:from-emerald-300 hover:to-teal-300'
                }`}
              >
                {isSlicing ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin text-black" />
                    <span>Đang Slicing Local...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black text-black" />
                    <span>Bắt Đầu Slicing CLI Local</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Section: Tabs (Terminal Console / Slicing Summary / G-Code Snippet) */}
          <div className="rounded-2xl border border-white/15 bg-black/60 overflow-hidden flex flex-col min-h-[220px]">
            {/* Tabs Header */}
            <div className="px-4 py-2 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('terminal')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'terminal'
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Terminal CLI Logs</span>
                </button>

                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'summary'
                      ? 'bg-teal-500/25 text-teal-300 border border-teal-400/30 font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Kết Quả Slicing Telemetry</span>
                  {sliceResult && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>

                <button
                  onClick={() => setActiveTab('gcode')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'gcode'
                      ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-400/30 font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Xem G-Code Native</span>
                </button>
              </div>

              {sliceResult && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadGcode}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-teal-300" />
                    <span>Tải G-Code</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tab 1: Terminal Console */}
            {activeTab === 'terminal' && (
              <div className="p-4 font-mono text-xs text-emerald-400 bg-[#0a0d14] max-h-[220px] overflow-y-auto space-y-1 select-text">
                {terminalLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                    {log}
                  </div>
                ))}
                <div ref={terminalBottomRef} />
              </div>
            )}

            {/* Tab 2: Slicing Summary Cards */}
            {activeTab === 'summary' && (
              <div className="p-5 space-y-4">
                {sliceResult ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-white/50 font-bold uppercase">Tổng Lớp Sliced</div>
                      <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                        {sliceResult.totalLayers} <span className="text-xs text-white/50">layers</span>
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">Chiều cao: {(sliceResult.totalLayers * 0.16).toFixed(1)} mm</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-white/50 font-bold uppercase">Thời Gian In Dự Kiến</div>
                      <div className="text-xl font-black text-teal-300 font-mono mt-1">
                        {Math.floor(sliceResult.estimatedTimeSec / 3600)}h {Math.floor((sliceResult.estimatedTimeSec % 3600) / 60)}m
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">{sliceResult.estimatedTimeSec.toLocaleString()} giây CNC</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-white/50 font-bold uppercase">Khối Lượng Nhựa (PLA)</div>
                      <div className="text-xl font-black text-amber-300 font-mono mt-1">
                        {sliceResult.filamentWeightGrams} <span className="text-xs text-white/50">grams</span>
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">Tiết kiệm ~24% nhờ Tree</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-white/50 font-bold uppercase">Đường Dao Tree Support</div>
                      <div className="text-xl font-black text-emerald-300 font-mono mt-1">
                        {sliceResult.supportLinesCount.toLocaleString()} <span className="text-xs text-white/50">lines</span>
                      </div>
                      <div className="text-[10px] text-emerald-400/80 mt-0.5 font-bold">✓ Native Bambu Feature</div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-white/50 text-xs">
                    Chưa có kết quả Slicing. Hãy nhấn <span className="text-emerald-400 font-bold">"Bắt Đầu Slicing CLI Local"</span> để chạy lệnh thực tế trên máy tính.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: G-Code Snippet */}
            {activeTab === 'gcode' && (
              <div className="p-4 font-mono text-[11px] text-white/80 bg-[#0a0d14] max-h-[220px] overflow-y-auto space-y-1 select-text">
                {sliceResult ? (
                  <pre className="whitespace-pre-wrap">{sliceResult.rawGcodeSnippet}</pre>
                ) : (
                  <div className="py-8 text-center text-white/50 text-xs font-sans">
                    Nhấn Slicing để xem các khối mã G-Code và cờ <code className="text-emerald-300">; FEATURE: Support</code>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-white/60">
            Trạng thái Slicer: <span className="text-emerald-400 font-bold">{currentSlicer?.isAvailable ? 'Sẵn sàng cục bộ (Localhost)' : 'Embedded Microservice Core'}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Đóng Lại
            </button>

            <button
              onClick={handleApplyToViewport}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Áp Dụng Tree Support Vào Viewport 3D</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import {
  X,
  Zap,
  Server,
  Cpu,
  Gauge,
  CheckCircle2,
  Layers,
  Activity,
  ArrowRight,
  ShieldCheck,
  Flame,
  Radio,
} from 'lucide-react';
import { SimulatorEngineType } from '@/types/simulator';
import { ENGINE_SPECS } from '@/services/proSlicerLocalEngine';

interface EngineComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEngine: SimulatorEngineType;
  onSelectEngine: (engine: SimulatorEngineType) => void;
  onOpenLocalSlicer?: () => void;
}

export function EngineComparisonModal({
  isOpen,
  onClose,
  activeEngine,
  onSelectEngine,
  onOpenLocalSlicer,
}: EngineComparisonModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const wasmSpec = ENGINE_SPECS.wasm_client;
  const proSpec = ENGINE_SPECS.pro_local;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full max-w-4xl rounded-3xl glass-panel border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white shadow-lg">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <span>So Sánh 2 Phương Án Bộ Giả Lập In 3D</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30">
                  A/B Testing
                </span>
              </h2>
              <p className="text-xs text-white/60 mt-0.5">
                Chuyển đổi tức thì giữa Client Web thuần và Pro Slicer Localhost trong giai đoạn thử nghiệm
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

        {/* Content: Side-by-side comparison */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Phase Notice Banner */}
          <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-500/30 flex items-start gap-3">
            <Radio className="w-5 h-5 text-teal-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-teal-200">
                Giai Đoạn Thử Nghiệm Local (Không Cần Máy Chủ Cloud):
              </span>
              <p className="text-white/70 leading-relaxed">
                Cả 2 engine hiện tại đều đang chạy <span className="text-teal-300 font-semibold">100% cục bộ trên máy tính của bạn</span>.
                Bạn có thể bấm nút chuyển đổi trên thanh điều hướng bất cứ lúc nào để so sánh độ mượt, mức tiêu thụ tài nguyên và chi tiết đường in trước khi đưa lên máy chủ backend sản phẩm.
              </p>
            </div>
          </div>

          {/* Cards Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Engine 1 (Wasm Client) */}
            <div
              className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                activeEngine === 'wasm_client'
                  ? 'bg-gradient-to-b from-teal-950/60 to-slate-900/90 border-teal-400 ring-2 ring-teal-400/30 shadow-xl shadow-teal-500/10'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-black">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">{wasmSpec.name}</div>
                      <div className="text-[10px] text-teal-400 font-mono">{wasmSpec.badge}</div>
                    </div>
                  </div>

                  {activeEngine === 'wasm_client' ? (
                    <span className="px-2.5 py-1 rounded-full bg-teal-400 text-black text-[10px] font-black uppercase tracking-wider">
                      Đang Dùng
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/40 font-mono">Sẵn Sàng</span>
                  )}
                </div>

                <p className="text-xs text-white/70 leading-relaxed">{wasmSpec.description}</p>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div className="text-[10px] text-white/50">Độ Trễ Phản Hồi</div>
                    <div className="text-sm font-black text-teal-300 font-mono">{wasmSpec.latency}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div className="text-[10px] text-white/50">Chi Phí RAM</div>
                    <div className="text-sm font-black text-teal-300 font-mono">{wasmSpec.memoryUsage}</div>
                  </div>
                </div>

                {/* Feature Checklist */}
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-bold text-white/80">Tính Năng Cốt Lõi:</div>
                  {wasmSpec.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-white/80">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-white/10">
                <button
                  onClick={() => {
                    onSelectEngine('wasm_client');
                    onClose();
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeEngine === 'wasm_client'
                      ? 'bg-teal-400 text-black hover:bg-teal-300'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{activeEngine === 'wasm_client' ? 'Đang Hoạt Động' : 'Kích Hoạt Engine 1'}</span>
                </button>
              </div>
            </div>

            {/* Card 2: Engine 2 (Pro Slicer Local Microservice) */}
            <div
              className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                activeEngine === 'pro_local'
                  ? 'bg-gradient-to-b from-indigo-950/60 to-slate-900/90 border-indigo-400 ring-2 ring-indigo-400/30 shadow-xl shadow-indigo-500/10'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-black">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">{proSpec.name}</div>
                      <div className="text-[10px] text-indigo-400 font-mono">{proSpec.badge}</div>
                    </div>
                  </div>

                  {activeEngine === 'pro_local' ? (
                    <span className="px-2.5 py-1 rounded-full bg-indigo-400 text-black text-[10px] font-black uppercase tracking-wider">
                      Đang Dùng
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/40 font-mono">Sẵn Sàng</span>
                  )}
                </div>

                <p className="text-xs text-white/70 leading-relaxed">{proSpec.description}</p>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div className="text-[10px] text-white/50">Độ Trễ Local IPC</div>
                    <div className="text-sm font-black text-indigo-300 font-mono">{proSpec.latency}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <div className="text-[10px] text-white/50">Chi Phí RAM</div>
                    <div className="text-sm font-black text-indigo-300 font-mono">{proSpec.memoryUsage}</div>
                  </div>
                </div>

                {/* Feature Checklist */}
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-bold text-white/80">Tính Năng Nâng Cao (Pro):</div>
                  {proSpec.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-white/80">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectEngine('pro_local');
                      onClose();
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      activeEngine === 'pro_local'
                        ? 'bg-indigo-400 text-black hover:bg-indigo-300'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>{activeEngine === 'pro_local' ? 'Đang Hoạt Động' : 'Kích Hoạt E2'}</span>
                  </button>

                  {onOpenLocalSlicer && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenLocalSlicer();
                      }}
                      className="py-2.5 px-3 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      title="Chạy Bambu Studio CLI hoặc PrusaSlicer CLI cục bộ"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Slicer CLI</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <div className="text-xs text-white/60">
            Engine hiện tại: <span className="font-bold text-white uppercase">{activeEngine === 'wasm_client' ? 'Engine 1 (Client Wasm)' : 'Engine 2 (Pro Local)'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Đóng Lại
          </button>
        </div>
      </div>
    </div>
  );
}

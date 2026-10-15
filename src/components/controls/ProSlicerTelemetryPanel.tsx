import React, { useState } from 'react';
import {
  Activity,
  Cpu,
  Terminal,
  Gauge,
  Flame,
  Wind,
  Zap,
  ChevronDown,
  ChevronUp,
  Server,
  Layers,
  Radio,
} from 'lucide-react';
import { IProSlicerTelemetry, ISimulationState } from '@/types/simulator';

interface ProSlicerTelemetryPanelProps {
  telemetry: IProSlicerTelemetry;
  state: ISimulationState;
  gcodeLines: string[];
}

export function ProSlicerTelemetryPanel({
  telemetry,
  state,
  gcodeLines,
}: ProSlicerTelemetryPanelProps) {
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);

  // An toàn lưu lượng nhựa: dưới 18 mm³/s là tối ưu cho đầu in CHT/Volcano
  const flowColor =
    telemetry.volumetricFlowMm3s > 22
      ? 'text-rose-400'
      : telemetry.volumetricFlowMm3s > 15
      ? 'text-amber-400'
      : 'text-teal-300';

  return (
    <div className="space-y-2 pointer-events-auto">
      {/* Telemetry Card */}
      <div className="p-3 rounded-2xl glass-panel border border-indigo-400/30 bg-slate-950/80 shadow-2xl backdrop-blur-xl text-xs space-y-2 max-w-sm">
        {/* Status Line */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-indigo-300">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Engine 2: Pro Slicer Local
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Localhost IPC</span>
          </div>
        </div>

        {/* Real-time Current G-Code Instruction */}
        <div className="p-2 rounded-xl bg-black/60 border border-white/5 font-mono text-[11px]">
          <div className="text-[9px] text-white/40 flex items-center justify-between uppercase font-bold mb-0.5">
            <span>Lệnh G-Code Đang Chạy</span>
            <span className="text-teal-400">Lớp {state.currentLayer}</span>
          </div>
          <div className="text-teal-200 font-bold truncate select-all">
            {telemetry.gcodeInstruction}
          </div>
        </div>

        {/* 4 Metrics Grid */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          {/* Volumetric Flow */}
          <div className="p-2 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              <Activity className="w-3 h-3 text-teal-400" />
              <span>Lưu Lượng Thể Tích</span>
            </div>
            <div className={`text-sm font-black font-mono ${flowColor}`}>
              {telemetry.volumetricFlowMm3s}{' '}
              <span className="text-[9px] font-normal text-white/40">mm³/s</span>
            </div>
          </div>

          {/* Stepper Acceleration */}
          <div className="p-2 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Gia Tốc Động Cơ</span>
            </div>
            <div className="text-sm font-black font-mono text-amber-300">
              {(telemetry.accelMmS2 / 1000).toFixed(0)}k{' '}
              <span className="text-[9px] font-normal text-white/40">mm/s²</span>
            </div>
          </div>

          {/* Cooling Fan PWM */}
          <div className="p-2 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              <Wind className="w-3 h-3 text-cyan-400" />
              <span>Quạt Tản Nhiệt</span>
            </div>
            <div className="text-sm font-black font-mono text-cyan-300">
              {telemetry.fanPwmPercent}%{' '}
              <span className="text-[9px] font-normal text-white/40">PWM</span>
            </div>
          </div>

          {/* Nozzle Backpressure */}
          <div className="p-2 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              <Gauge className="w-3 h-3 text-indigo-400" />
              <span>Áp Suất Đầu Đùn</span>
            </div>
            <div className="text-sm font-black font-mono text-indigo-300">
              {telemetry.nozzlePressureBar}{' '}
              <span className="text-[9px] font-normal text-white/40">Bar</span>
            </div>
          </div>
        </div>

        {/* Collapsible G-Code Terminal Inspector Button */}
        <button
          onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}
          className="w-full py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-all cursor-pointer flex items-center justify-between text-[11px] font-bold"
        >
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-teal-400" />
            <span>Màn Hình G-Code CNC ({gcodeLines.length} Dòng)</span>
          </div>
          {isTerminalExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {/* G-Code Stream Terminal Box */}
        {isTerminalExpanded && (
          <div className="p-2.5 rounded-xl bg-black/90 border border-teal-500/30 font-mono text-[10px] space-y-1 max-h-40 overflow-y-auto animate-in fade-in">
            {gcodeLines.map((line, idx) => {
              const isHighlight = line.startsWith('>>');
              return (
                <div
                  key={idx}
                  className={`truncate leading-relaxed ${
                    isHighlight
                      ? 'text-teal-300 font-black bg-teal-500/20 px-1 rounded'
                      : line.startsWith(';')
                      ? 'text-white/40 italic'
                      : 'text-white/75'
                  }`}
                >
                  {line}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

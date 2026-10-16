import React, { useState } from 'react';
import {
  IconTerminal,
  IconFlow,
  IconVelocity,
  IconThermal,
  IconSliders,
  IconChevronDown,
  IconChevronUp,
  IconClose,
} from '@/components/icons/MinimalIcons';
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);

  const flowColor =
    telemetry.volumetricFlowMm3s > 22
      ? 'text-rose-400'
      : telemetry.volumetricFlowMm3s > 15
      ? 'studio-text-gold'
      : 'text-emerald-400';

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel text-[var(--text-primary)] hover:border-[var(--accent-gold)] text-[11px] font-semibold transition-all cursor-pointer pointer-events-auto"
        title="Mở bảng Telemetry Engine 2: Pro Slicer Local"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <IconTerminal size={12} className="studio-text-gold" />
        <span>Pro Slicer IPC ({telemetry.volumetricFlowMm3s} mm³/s)</span>
      </button>
    );
  }

  return (
    <div
      data-testid="pro-slicer-telemetry-panel"
      className="w-64 p-3 rounded-2xl glass-panel text-[11px] space-y-2 pointer-events-auto animate-in fade-in duration-150"
    >
      {/* Header Line */}
      <div className="flex items-center justify-between border-b studio-border pb-1.5">
        <div className="flex items-center gap-1.5 font-bold studio-text-primary">
          <IconTerminal size={12} className="studio-text-gold shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider truncate">
            Pro Slicer Local
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[9px] font-mono studio-gold-badge px-1.5 py-0.5 rounded-md font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>IPC</span>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors cursor-pointer"
            title="Thu gọn bảng Pro Slicer"
          >
            <IconClose size={12} />
          </button>
        </div>
      </div>

      {/* Real-time Current G-Code Instruction */}
      <div className="px-2 py-1.5 rounded-lg studio-card font-mono text-[10px]">
        <div className="text-[8px] studio-text-muted flex items-center justify-between uppercase font-semibold mb-0.5">
          <span>G-Code Đang Chạy</span>
          <span className="studio-text-gold font-bold">L{state.currentLayer}</span>
        </div>
        <div className="studio-text-primary font-semibold truncate select-all">
          {telemetry.gcodeInstruction}
        </div>
      </div>

      {/* Compact 2x2 Metrics Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="px-2 py-1.5 rounded-lg studio-card space-y-0.5">
          <div className="flex items-center gap-1 text-[9px] studio-text-secondary">
            <IconFlow size={10} className="studio-text-gold shrink-0" />
            <span className="truncate">Lưu Lượng</span>
          </div>
          <div className={`text-xs font-bold font-mono ${flowColor}`}>
            {telemetry.volumetricFlowMm3s}{' '}
            <span className="text-[8px] font-normal studio-text-muted">mm³/s</span>
          </div>
        </div>

        <div className="px-2 py-1.5 rounded-lg studio-card space-y-0.5">
          <div className="flex items-center gap-1 text-[9px] studio-text-secondary">
            <IconVelocity size={10} className="studio-text-gold shrink-0" />
            <span className="truncate">Gia Tốc</span>
          </div>
          <div className="text-xs font-bold font-mono studio-text-primary">
            {(telemetry.accelMmS2 / 1000).toFixed(0)}k{' '}
            <span className="text-[8px] font-normal studio-text-muted">mm/s²</span>
          </div>
        </div>

        <div className="px-2 py-1.5 rounded-lg studio-card space-y-0.5">
          <div className="flex items-center gap-1 text-[9px] studio-text-secondary">
            <IconThermal size={10} className="studio-text-gold shrink-0" />
            <span className="truncate">Quạt Làm Mát</span>
          </div>
          <div className="text-xs font-bold font-mono studio-text-primary">
            {telemetry.fanPwmPercent}%{' '}
            <span className="text-[8px] font-normal studio-text-muted">PWM</span>
          </div>
        </div>

        <div className="px-2 py-1.5 rounded-lg studio-card space-y-0.5">
          <div className="flex items-center gap-1 text-[9px] studio-text-secondary">
            <IconSliders size={10} className="studio-text-gold shrink-0" />
            <span className="truncate">Áp Suất Đùn</span>
          </div>
          <div className="text-xs font-bold font-mono studio-text-gold">
            {telemetry.nozzlePressureBar}{' '}
            <span className="text-[8px] font-normal studio-text-muted">Bar</span>
          </div>
        </div>
      </div>

      {/* Collapsible G-Code Stream Inspector Button */}
      <button
        onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}
        className="w-full py-1 px-2 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary transition-all cursor-pointer flex items-center justify-between text-[10px] font-semibold"
      >
        <div className="flex items-center gap-1.5 truncate">
          <IconTerminal size={11} className="studio-text-gold shrink-0" />
          <span className="truncate">G-Code CNC ({gcodeLines.length} dòng)</span>
        </div>
        {isTerminalExpanded ? <IconChevronUp size={11} /> : <IconChevronDown size={11} />}
      </button>

      {/* G-Code Stream Terminal Box */}
      {isTerminalExpanded && (
        <div className="p-2 rounded-lg glass-input font-mono text-[9px] space-y-0.5 max-h-28 overflow-y-auto animate-in fade-in">
          {gcodeLines.map((line, idx) => {
            const isHighlight = line.startsWith('>>');
            return (
              <div
                key={idx}
                className={`truncate leading-tight ${
                  isHighlight
                    ? 'studio-text-gold font-bold bg-[var(--accent-gold-bg)] px-1 py-0.5 rounded'
                    : line.startsWith(';')
                    ? 'studio-text-muted italic'
                    : 'studio-text-secondary'
                }`}
              >
                {line}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

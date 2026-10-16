import React from 'react';
import {
  IconPlay,
  IconPause,
  IconReset,
  IconChevronLeft,
  IconChevronRight,
  IconLayers,
} from '@/components/icons/MinimalIcons';
import { ISimulationState, PlaybackSpeed, IPreflightError } from '@/types/simulator';
import { formatPrintTime } from '@/services/slicingEngine';

interface TimeScrubberProps {
  state: ISimulationState;
  onTogglePlay: () => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
  onScrubProgress: (progress: number) => void;
  onStepLayer: (delta: number) => void;
  onReset: () => void;
  onInstantFinish: () => void;
  defects?: IPreflightError[];
}

export function TimeScrubber({
  state,
  onTogglePlay,
  onSetSpeed,
  onScrubProgress,
  onStepLayer,
  onReset,
  onInstantFinish,
  defects = [],
}: TimeScrubberProps) {
  const speeds: PlaybackSpeed[] = [1, 5, 10, 25, 50, 100];

  const percent = state.isCompleted ? 100 : Math.min(99, Math.round(state.currentProgress * 100));

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-2.5 rounded-2xl glass-panel space-y-2">
      {/* Row 1: Scrubber Track with Progress Fill & Defect Markers */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold studio-text-primary shrink-0 min-w-[88px]">
          <IconLayers size={12} className="studio-text-gold" />
          <span>
            L{state.currentLayer}
            <span className="studio-text-muted font-normal">/{state.totalLayers}</span>
          </span>
        </div>

        <div className="relative flex-1 flex items-center">
          {/* Progress Fill */}
          <div
            className="pointer-events-none absolute left-0 h-1 rounded-full bg-[var(--accent-gold)]"
            style={{ width: `${Math.max(0, Math.min(100, state.currentProgress * 100))}%` }}
          />

          {/* Defect Layer Tick Markers */}
          {defects.map((err) => {
            if (!err.layerRange || state.totalLayers <= 1) return null;
            const midLayer = Math.round((err.layerRange[0] + err.layerRange[1]) / 2);
            const leftPct = Math.max(2, Math.min(98, (midLayer / state.totalLayers) * 100));
            return (
              <button
                key={err.id}
                type="button"
                onClick={() => onScrubProgress(midLayer / state.totalLayers)}
                style={{ left: `${leftPct}%` }}
                className={`absolute -top-1.5 -translate-x-1/2 w-2 h-2 rounded-full cursor-pointer z-10 transition-transform hover:scale-150 ${
                  err.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-400'
                }`}
                title={`${err.title} (Nhấp nhảy tới Lớp ${midLayer})`}
              />
            );
          })}

          <input
            data-testid="time-scrubber-slider"
            type="range"
            min="0"
            max="1000"
            value={Math.round(state.currentProgress * 1000)}
            onChange={(e) => onScrubProgress(Number(e.target.value) / 1000)}
            className="w-full h-1.5 rounded-full cursor-pointer relative z-0"
            title="Duyệt từng lớp cắt G-code"
          />
        </div>

        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md studio-gold-badge shrink-0 min-w-[48px] text-center">
          {percent}%
        </span>
      </div>

      {/* Row 2: Transport Controls + Live Telemetry + Speed Multipliers */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Left: Playback Transport Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            className="p-1.5 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary transition-all active:scale-95 cursor-pointer"
            title="Về lớp đầu tiên (Lớp 1)"
          >
            <IconReset size={13} />
          </button>

          <button
            onClick={() => onStepLayer(-1)}
            disabled={state.currentLayer <= 1}
            className="p-1.5 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary disabled:opacity-30 transition-all cursor-pointer"
            title="Lùi 1 lớp (Phím ←)"
          >
            <IconChevronLeft size={13} />
          </button>

          <button
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl studio-cta-primary font-semibold text-xs transition-all active:scale-95 cursor-pointer"
            title={state.isPlaying ? 'Tạm dừng (Space)' : 'Chạy mô phỏng in (Space)'}
          >
            {state.isPlaying ? (
              <>
                <IconPause size={12} />
                <span>Tạm Dừng</span>
              </>
            ) : (
              <>
                <IconPlay size={12} />
                <span>{state.isCompleted ? 'In Lại' : 'Mô Phỏng'}</span>
              </>
            )}
          </button>

          <button
            onClick={() => onStepLayer(1)}
            disabled={state.currentLayer >= state.totalLayers}
            className="p-1.5 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary disabled:opacity-30 transition-all cursor-pointer"
            title="Tiến 1 lớp (Phím →)"
          >
            <IconChevronRight size={13} />
          </button>
        </div>

        {/* Center: Live Print Time & Filament Readout */}
        <div className="hidden md:flex items-center gap-3 text-[11px] studio-card px-3 py-1 rounded-xl">
          <div className="flex items-center gap-1.5 studio-text-secondary">
            <span>Thời gian:</span>
            <strong className="studio-text-primary font-mono">{formatPrintTime(state.elapsedTimeSec)}</strong>
            <span className="studio-text-muted font-mono">/ {formatPrintTime(state.totalTimeSec)}</span>
          </div>

          <div className="w-[1px] h-3.5 bg-[var(--border-hairline)]" />

          <div className="flex items-center gap-1.5 studio-text-secondary">
            <span>Khối lượng:</span>
            <strong className="studio-text-primary font-mono">{state.filamentUsedGrams.toFixed(1)}g</strong>
            <span className="studio-text-muted font-mono">/ {state.totalFilamentGrams.toFixed(1)}g</span>
          </div>
        </div>

        {/* Right: Speed Multipliers & Instant Finish */}
        <div className="flex items-center gap-0.5 studio-card p-0.5 rounded-xl">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                state.playbackSpeed === s
                  ? 'studio-pill-active'
                  : 'studio-pill-inactive font-medium'
              }`}
            >
              {s}x
            </button>
          ))}

          <button
            onClick={onInstantFinish}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
              state.isCompleted ? 'studio-gold-badge' : 'studio-pill-inactive'
            }`}
            title="Tua tới 100% thành phẩm"
          >
            100%
          </button>
        </div>
      </div>
    </div>
  );
}

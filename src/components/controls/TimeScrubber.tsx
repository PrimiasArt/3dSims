import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Weight,
  Sparkles,
  Layers,
} from 'lucide-react';
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
    <div className="w-full max-w-4xl mx-auto px-4 py-2.5 rounded-2xl glass-panel border border-white/15 shadow-2xl space-y-2">
      {/* Row 1: Scrubber Track with Interactive Progress Bar & Defect Tick Markers */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-teal-300 shrink-0 min-w-[88px]">
          <Layers className="w-3.5 h-3.5 text-teal-400" />
          <span>
            L{state.currentLayer}
            <span className="text-slate-500 font-normal">/{state.totalLayers}</span>
          </span>
        </div>

        <div className="relative flex-1 flex items-center">
          {/* Custom Progress Fill Underlay */}
          <div
            className="pointer-events-none absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400"
            style={{ width: `${Math.max(0, Math.min(100, state.currentProgress * 100))}%` }}
          />

          {/* Defect Layer Tick Markers on Timeline */}
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
                className={`absolute -top-1.5 -translate-x-1/2 w-2 h-2 rounded-full border border-black/60 cursor-pointer z-10 transition-transform hover:scale-150 ${
                  err.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-400'
                }`}
                title={`${err.title} (Nhấp để nhảy tới Lớp ${midLayer})`}
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
            className="w-full h-1.5 rounded-full cursor-pointer accent-teal-400 relative z-0"
            title="Kéo trượt để duyệt từng lớp cắt G-code (Layer Scrubbing)"
          />
        </div>

        <span className="font-mono text-[11px] font-extrabold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30 shrink-0 min-w-[48px] text-center">
          {percent}%
        </span>
      </div>

      {/* Row 2: Transport Controls + Live Telemetry + Speed Multipliers */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Left: Playback Transport Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Về lớp đầu tiên (Lớp 1)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onStepLayer(-1)}
            disabled={state.currentLayer <= 1}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
            title="Lùi 1 lớp (Phím ←)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-extrabold text-xs transition-all shadow-md shadow-teal-500/20 active:scale-95 cursor-pointer"
            title={state.isPlaying ? 'Tạm dừng (Space)' : 'Chạy mô phỏng in (Space)'}
          >
            {state.isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Tạm Dừng</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{state.isCompleted ? 'In Lại' : 'Mô Phỏng'}</span>
              </>
            )}
          </button>

          <button
            onClick={() => onStepLayer(1)}
            disabled={state.currentLayer >= state.totalLayers}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
            title="Tiến 1 lớp (Phím →)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Live Print Time & Filament Readout */}
        <div className="hidden md:flex items-center gap-3 text-[11px] bg-black/35 px-3 py-1 rounded-xl border border-white/5">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <strong className="text-white font-mono">{formatPrintTime(state.elapsedTimeSec)}</strong>
            <span className="text-slate-500 font-mono">/ {formatPrintTime(state.totalTimeSec)}</span>
          </div>

          <div className="w-[1px] h-3.5 bg-white/10" />

          <div className="flex items-center gap-1.5 text-slate-300">
            <Weight className="w-3.5 h-3.5 text-amber-400" />
            <strong className="text-white font-mono">{state.filamentUsedGrams.toFixed(1)}g</strong>
            <span className="text-slate-500 font-mono">/ {state.totalFilamentGrams.toFixed(1)}g</span>
          </div>
        </div>

        {/* Right: Speed Multipliers & Instant Finish */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                state.playbackSpeed === s
                  ? 'bg-teal-400 text-slate-950 font-extrabold shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {s}x
            </button>
          ))}

          <button
            onClick={onInstantFinish}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              state.isCompleted
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                : 'bg-white/5 hover:bg-white/15 text-emerald-300'
            }`}
            title="Tua tới 100% thành phẩm"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">100%</span>
          </button>
        </div>
      </div>
    </div>
  );
}

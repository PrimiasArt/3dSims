import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ChevronLeft,
  ChevronRight,
  Clock,
  Weight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ISimulationState, PlaybackSpeed } from '@/types/simulator';
import { formatPrintTime } from '@/services/slicingEngine';

interface TimeScrubberProps {
  state: ISimulationState;
  onTogglePlay: () => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
  onScrubProgress: (progress: number) => void;
  onStepLayer: (delta: number) => void;
  onReset: () => void;
  onInstantFinish: () => void;
}

export function TimeScrubber({
  state,
  onTogglePlay,
  onSetSpeed,
  onScrubProgress,
  onStepLayer,
  onReset,
  onInstantFinish,
}: TimeScrubberProps) {
  const speeds: PlaybackSpeed[] = [1, 5, 10, 25, 50, 100];

  const percent = state.isCompleted ? 100 : Math.min(99, Math.round(state.currentProgress * 100));

  return (
    <div className="w-full max-w-4xl mx-auto p-4 rounded-3xl glass-panel border border-white/20 shadow-2xl backdrop-blur-2xl space-y-3">
      {/* Top Metrics Row: Time & Filament telemetry */}
      <div className="flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-white/80">
            <Clock className="w-4 h-4 text-teal-400" />
            <span>Thời Gian: </span>
            <strong className="text-white font-mono">
              {formatPrintTime(state.elapsedTimeSec)}
            </strong>
            <span className="text-white/40 font-mono">/ {formatPrintTime(state.totalTimeSec)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-white/80 border-l border-white/15 pl-3">
            <Weight className="w-4 h-4 text-amber-400" />
            <span>Nhựa Tiêu Hao: </span>
            <strong className="text-white font-mono">{state.filamentUsedGrams.toFixed(1)}g</strong>
            <span className="text-white/40 font-mono">/ {state.totalFilamentGrams.toFixed(1)}g</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-teal-300 bg-teal-500/20 px-2.5 py-0.5 rounded-full border border-teal-400/30">
            {percent}% Hoàn Thành
          </span>
          <span className="font-mono text-xs text-white/60 hidden md:inline">
            (Lớp {state.currentLayer} / {state.totalLayers})
          </span>
        </div>
      </div>

      {/* Main Scrubber Track */}
      <div className="relative flex items-center gap-3">
        <input
          data-testid="time-scrubber-slider"
          type="range"
          min="0"
          max="1000"
          value={Math.round(state.currentProgress * 1000)}
          onChange={(e) => onScrubProgress(Number(e.target.value) / 1000)}
          className="w-full h-2 rounded-full cursor-pointer accent-teal-400"
          title="Kéo trượt để tua nhanh / quay lại từng lớp in 3D"
        />
      </div>

      {/* Playback Controls & Speed Selector Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Play / Step Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onReset}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Quay lại lớp đầu tiên (Lớp 0)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onStepLayer(-1)}
            disabled={state.currentLayer <= 1}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
            title="Lùi lại 1 lớp (-1 Layer)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-black font-extrabold text-xs transition-all shadow-lg shadow-teal-500/25 active:scale-95 cursor-pointer"
            title={state.isPlaying ? 'Tạm dừng mô phỏng (Phím Space)' : 'Bắt đầu mô phỏng in 3D (Phím Space)'}
          >
            {state.isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current text-black" />
                <span>Tạm Dừng</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-black" />
                <span>{state.isCompleted ? 'In Lại' : 'Mô Phỏng In'}</span>
              </>
            )}
          </button>

          <button
            onClick={() => onStepLayer(1)}
            disabled={state.currentLayer >= state.totalLayers}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
            title="Tiến tới 1 lớp (+1 Layer)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Multipliers & Instant Finish */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-full border border-white/10 backdrop-blur-md">
          <span className="text-[10px] text-white/50 px-2 font-semibold hidden sm:inline">Tua Nhanh:</span>
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                state.playbackSpeed === s
                  ? 'bg-teal-400 text-black shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {s}x
            </button>
          ))}

          <button
            onClick={onInstantFinish}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              state.isCompleted
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-emerald-300'
            }`}
            title="Tua đến thành phẩm cuối cùng ngay lập tức"
          >
            <Sparkles className="w-3 h-3 text-emerald-300" />
            <span>Thành Phẩm</span>
          </button>
        </div>
      </div>
    </div>
  );
}

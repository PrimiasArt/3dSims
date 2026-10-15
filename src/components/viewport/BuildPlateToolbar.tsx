import React, { useState } from 'react';
import { IModelTransform, DEFAULT_TRANSFORM } from '@/types/simulator';
import {
  Move,
  RotateCw,
  Maximize2,
  Crosshair,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Repeat,
  X,
} from 'lucide-react';

interface BuildPlateToolbarProps {
  transform?: IModelTransform;
  dimensions?: [number, number, number]; // [X, Y, Z] in mm
  onChangeTransform: (newTransform: IModelTransform) => void;
  onResetTransform: () => void;
  onAutoLayFlat: () => void;
  activeGizmoMode?: 'move' | 'rotate' | 'scale' | null;
  onToggleGizmoMode?: (mode: 'move' | 'rotate' | 'scale' | null) => void;
}

type TransformTab = 'move' | 'rotate' | 'scale' | null;

export const BuildPlateToolbar: React.FC<BuildPlateToolbarProps> = ({
  transform = DEFAULT_TRANSFORM,
  dimensions = [60, 48, 31],
  onChangeTransform,
  onResetTransform,
  onAutoLayFlat,
  activeGizmoMode,
  onToggleGizmoMode,
}) => {
  const currentTransform = transform || DEFAULT_TRANSFORM;
  const currentDim = dimensions || [60, 48, 31];
  const [internalTab, setInternalTab] = useState<TransformTab>(null);

  const activeTab = activeGizmoMode !== undefined ? activeGizmoMode : internalTab;
  const setActiveTab = (tab: TransformTab) => {
    if (onToggleGizmoMode) {
      onToggleGizmoMode(tab);
    } else {
      setInternalTab(tab);
    }
  };

  // Căn giữa bàn in (0, 0)
  const handleCenter = () => {
    onChangeTransform({
      ...currentTransform,
      position: [0, 0, 0],
    });
  };

  // Nudge vị trí
  const handleNudge = (dx: number, dz: number) => {
    const curX = currentTransform.position?.[0] ?? 0;
    const curZ = currentTransform.position?.[2] ?? 0;
    const newX = Math.max(-105, Math.min(105, curX + dx));
    const newZ = Math.max(-105, Math.min(105, curZ + dz));
    onChangeTransform({
      ...currentTransform,
      position: [newX, 0, newZ],
    });
  };

  // Xoay quanh trục bất kỳ (X, Y, Z)
  const handleRotateAxis = (axis: 'x' | 'y' | 'z', deltaDeg: number) => {
    const rad = (deltaDeg * Math.PI) / 180;
    const curRot = currentTransform.rotation || [0, 0, 0];
    const newRot: [number, number, number] = [curRot[0], curRot[1], curRot[2]];
    if (axis === 'x') newRot[0] += rad;
    if (axis === 'y') newRot[1] += rad;
    if (axis === 'z') newRot[2] += rad;
    onChangeTransform({
      ...currentTransform,
      rotation: newRot,
    });
  };

  // Đặt góc xoay chính xác trên trục (X, Y, Z)
  const handleSetAxisAngle = (axis: 'x' | 'y' | 'z', targetDeg: number) => {
    const rad = (targetDeg * Math.PI) / 180;
    const curRot = currentTransform.rotation || [0, 0, 0];
    const newRot: [number, number, number] = [curRot[0], curRot[1], curRot[2]];
    if (axis === 'x') newRot[0] = rad;
    if (axis === 'y') newRot[1] = rad;
    if (axis === 'z') newRot[2] = rad;
    onChangeTransform({
      ...currentTransform,
      rotation: newRot,
    });
  };

  // Sửa nhanh: Đứng thẳng (Z-Up / Y-Up)
  const handleMakeStandUp = () => {
    onChangeTransform({
      ...currentTransform,
      rotation: [0, 0, 0],
    });
  };

  // Lật 180° quanh trục X để sửa nhanh mô hình bị lộn ngược / nằm ngửa
  const handleFlip180 = () => {
    handleRotateAxis('x', 180);
  };

  // Đổi tỉ lệ (Scale)
  const handleSetScale = (scaleValue: number) => {
    const clamped = Math.max(0.2, Math.min(2.5, scaleValue));
    onChangeTransform({
      ...currentTransform,
      scale: Number(clamped.toFixed(2)),
    });
  };

  // Tối đa hóa kích thước vừa vặn bàn in 256x256mm
  const handleFitMaxBed = () => {
    const maxDimension = Math.max(currentDim[0], currentDim[2]);
    if (maxDimension <= 0) return;
    const curScale = currentTransform.scale || 1.0;
    const targetScale = Math.min(2.2, 210 / (maxDimension / curScale));
    handleSetScale(targetScale);
  };

  const posX = Math.round(currentTransform.position?.[0] ?? 0);
  const posZ = Math.round(currentTransform.position?.[2] ?? 0);
  const rotXDeg = Math.round((((currentTransform.rotation?.[0] ?? 0) * 180) / Math.PI) % 360);
  const rotYDeg = Math.round((((currentTransform.rotation?.[1] ?? 0) * 180) / Math.PI) % 360);
  const rotZDeg = Math.round((((currentTransform.rotation?.[2] ?? 0) * 180) / Math.PI) % 360);
  const scalePercent = Math.round((currentTransform.scale ?? 1.0) * 100);

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center select-none">
      {/* 1. Main Floating Gizmo Dock (Bambu Studio Style - Clean, Compact, No Overlap) */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel border border-white/20 bg-slate-950/80 shadow-2xl backdrop-blur-2xl text-white">
        {/* Model Dimensions Info */}
        <div className="flex items-center gap-2 pr-2 border-r border-white/10 hidden sm:flex">
          <div className="w-5 h-5 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div className="text-[10px] font-mono text-white/70">
            {Math.round(currentDim[0])} × {Math.round(currentDim[2])} × {Math.round(currentDim[1])} mm
          </div>
        </div>

        {/* Tab Buttons */}
        <button
          onClick={() => setActiveTab(activeTab === 'move' ? null : 'move')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'move'
              ? 'bg-teal-400 text-black shadow-md shadow-teal-500/30'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`}
          title="Di chuyển mô hình trên bàn in"
        >
          <Move className="w-3.5 h-3.5" />
          <span>Vị Trí</span>
          {posX !== 0 || posZ !== 0 ? (
            <span className="text-[9px] font-mono px-1 rounded bg-black/20 text-teal-200">
              {posX},{posZ}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'rotate' ? null : 'rotate')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'rotate'
              ? 'bg-teal-400 text-black shadow-md shadow-teal-500/30'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`}
          title="Xoay mô hình theo các góc"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Xoay</span>
          {rotYDeg !== 0 ? (
            <span className="text-[9px] font-mono px-1 rounded bg-black/20 text-teal-200">
              {rotYDeg}°
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'scale' ? null : 'scale')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'scale'
              ? 'bg-teal-400 text-black shadow-md shadow-teal-500/30'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`}
          title="Phóng to / Thu nhỏ kích thước"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Tỉ Lệ</span>
          {scalePercent !== 100 ? (
            <span className="text-[9px] font-mono px-1 rounded bg-black/20 text-teal-200">
              {scalePercent}%
            </span>
          ) : null}
        </button>

        <div className="w-[1px] h-4 bg-white/15 mx-1" />

        {/* Quick Slicer Actions */}
        <button
          onClick={handleMakeStandUp}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/15 transition-all cursor-pointer"
          title="Dựng đứng mô hình thẳng góc chuẩn (0°, 0°, 0°)"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Dựng Đứng</span>
        </button>

        <button
          onClick={onAutoLayFlat}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/15 transition-all cursor-pointer"
          title="Tự động lật mặt phẳng tiếp xúc lớn nhất xuống đáy (Auto Lay Flat)"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Nằm Phẳng</span>
        </button>

        <button
          onClick={handleFlip180}
          className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-semibold text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 transition-all cursor-pointer"
          title="Lật ngược 180° (Sửa nhanh mô hình bị nằm ngửa phơi bụng)"
        >
          <Repeat className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Lật 180°</span>
        </button>

        <button
          onClick={onResetTransform}
          className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          title="Khôi phục vị trí, góc xoay và tỉ lệ 100% ban đầu"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Popover Tool Panel (Renders cleanly under the dock when a tool is active) */}
      {activeTab && (
        <div className="mt-2 p-3 rounded-2xl glass-panel border border-white/20 bg-slate-950/90 shadow-2xl backdrop-blur-2xl text-white w-72 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <span className="text-xs font-black uppercase text-teal-300 tracking-wider">
              {activeTab === 'move' ? 'Điều Chỉnh Tọa Độ Bàn In' : activeTab === 'rotate' ? 'Xoay & Định Hướng' : 'Tỉ Lệ Kích Thước'}
            </span>
            <button
              onClick={() => setActiveTab(null)}
              className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TAB 1: MOVE */}
          {activeTab === 'move' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono px-1">
                <span className="text-white/60">Tọa Độ Hiện Tại:</span>
                <span className="text-teal-300 font-bold">
                  X: {posX > 0 ? `+${posX}` : posX} mm | Y: {posZ > 0 ? `+${posZ}` : posZ} mm
                </span>
              </div>

              {/* D-Pad Controls */}
              <div className="grid grid-cols-3 gap-1.5 max-w-[200px] mx-auto py-1">
                <div />
                <button
                  onClick={() => handleNudge(0, -10)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-teal-500 hover:text-black font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                  title="Dịch về sau (-10mm)"
                >
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-[9px]">Sau (-Y)</span>
                </button>
                <div />

                <button
                  onClick={() => handleNudge(-10, 0)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-teal-500 hover:text-black font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                  title="Dịch sang trái (-10mm)"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-[9px]">Trái (-X)</span>
                </button>

                <button
                  onClick={handleCenter}
                  className="p-2 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-300 hover:bg-teal-500 hover:text-black font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                  title="Căn giữa bàn in (0, 0)"
                >
                  <Crosshair className="w-4 h-4" />
                  <span className="text-[9px]">Căn Giữa</span>
                </button>

                <button
                  onClick={() => handleNudge(10, 0)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-teal-500 hover:text-black font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                  title="Dịch sang phải (+10mm)"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-[9px]">Phải (+X)</span>
                </button>

                <div />
                <button
                  onClick={() => handleNudge(0, 10)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-teal-500 hover:text-black font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                  title="Dịch về trước (+10mm)"
                >
                  <ArrowDown className="w-4 h-4" />
                  <span className="text-[9px]">Trước (+Y)</span>
                </button>
                <div />
              </div>

              <p className="text-[10px] text-white/40 text-center italic">
                * Mẹo: Bạn có thể click chuột trái kéo rê trực tiếp trên mặt bàn in.
              </p>
            </div>
          )}

          {/* TAB 2: ROTATE */}
          {activeTab === 'rotate' && (
            <div className="space-y-3 max-h-[390px] overflow-y-auto pr-1">
              {/* Gizmo Notification Pill */}
              <div className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-[10px] text-teal-200 leading-tight">
                <span className="font-bold text-teal-300">🎯 Gizmo Xoay 3D Trực Tiếp:</span> Kéo các vòng tròn màu <span className="text-rose-400 font-bold">Đỏ (X)</span>, <span className="text-emerald-400 font-bold">Xanh (Y)</span>, <span className="text-sky-400 font-bold">Lam (Z)</span> trên mô hình để xoay tự do!
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={handleMakeStandUp}
                  className="py-1.5 px-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  title="Sửa nhanh mô hình bị lật ngang: Đứng thẳng trên bàn in"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Đứng Thẳng (Z-Up)</span>
                </button>
                <button
                  onClick={handleFlip180}
                  className="py-1.5 px-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 hover:bg-amber-500 hover:text-black text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  title="Lật úp / lật ngửa 180°"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Lật 180° (X)</span>
                </button>
              </div>

              {/* Trục X: Lật Trước / Sau (Pitch) */}
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-rose-300 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Trục X (Lật Trước/Sau):
                  </span>
                  <span className="text-white font-bold">{rotXDeg}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={rotXDeg}
                  onChange={(e) => handleSetAxisAngle('x', Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                />
                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  <button
                    onClick={() => handleRotateAxis('x', -90)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-rose-500 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                  >
                    -90°
                  </button>
                  <button
                    onClick={() => handleSetAxisAngle('x', 0)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold transition-all cursor-pointer"
                  >
                    0°
                  </button>
                  <button
                    onClick={() => handleRotateAxis('x', 90)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-rose-500 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                  >
                    +90°
                  </button>
                </div>
              </div>

              {/* Trục Y: Xoay Tròn Đứng (Yaw) */}
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-300 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Trục Y (Xoay Tròn Đứng):
                  </span>
                  <span className="text-white font-bold">{rotYDeg}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={rotYDeg < 0 ? rotYDeg + 360 : rotYDeg}
                  onChange={(e) => handleSetAxisAngle('y', Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                />
                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  <button
                    onClick={() => handleRotateAxis('y', -45)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-emerald-500 hover:text-black text-[10px] font-bold transition-all cursor-pointer"
                  >
                    -45°
                  </button>
                  <button
                    onClick={() => handleRotateAxis('y', 45)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-emerald-500 hover:text-black text-[10px] font-bold transition-all cursor-pointer"
                  >
                    +45°
                  </button>
                  <button
                    onClick={() => handleRotateAxis('y', 90)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-emerald-500 hover:text-black text-[10px] font-bold transition-all cursor-pointer"
                  >
                    +90°
                  </button>
                </div>
              </div>

              {/* Trục Z: Nghiêng Trái / Phải (Roll) */}
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-sky-300 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                    Trục Z (Nghiêng Trái/Phải):
                  </span>
                  <span className="text-white font-bold">{rotZDeg}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={rotZDeg}
                  onChange={(e) => handleSetAxisAngle('z', Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                />
                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  <button
                    onClick={() => handleRotateAxis('z', -90)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-sky-500 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                  >
                    -90°
                  </button>
                  <button
                    onClick={() => handleSetAxisAngle('z', 0)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold transition-all cursor-pointer"
                  >
                    0°
                  </button>
                  <button
                    onClick={() => handleRotateAxis('z', 90)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-sky-500 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                  >
                    +90°
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SCALE */}
          {activeTab === 'scale' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono px-1">
                <span className="text-white/60">Tỉ Lệ Hiện Tại:</span>
                <span className="text-teal-300 font-bold">{scalePercent}%</span>
              </div>

              <input
                type="range"
                min="0.3"
                max="2.5"
                step="0.05"
                value={currentTransform.scale ?? 1.0}
                onChange={(e) => handleSetScale(Number(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleSetScale(0.8)}
                  className="py-1.5 rounded-xl bg-white/10 hover:bg-teal-500 hover:text-black text-xs font-bold transition-all cursor-pointer"
                >
                  80%
                </button>
                <button
                  onClick={() => handleSetScale(1.0)}
                  className="py-1.5 rounded-xl bg-white/10 hover:bg-teal-500 hover:text-black text-xs font-bold transition-all cursor-pointer"
                >
                  100%
                </button>
                <button
                  onClick={handleFitMaxBed}
                  className="py-1.5 rounded-xl bg-teal-500/20 text-teal-300 hover:bg-teal-500 hover:text-black text-xs font-bold transition-all cursor-pointer"
                  title="Tối đa hóa kích thước phủ đầy bàn in"
                >
                  Vừa Bàn
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

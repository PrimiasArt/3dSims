import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Play,
  Pause,
  RotateCcw,
  Download,
  Camera,
  Layers,
  Sparkles,
  Clock,
  Thermometer,
  Zap,
  Sliders,
  CheckCircle,
  Eye,
  X,
  FastForward,
} from 'lucide-react';
import {
  ISimulationProfile,
  ISimulationState,
  ISampleModel,
  TimelapseMode,
  TimelapseCameraPreset,
} from '@/types/simulator';

interface BambuTimelapseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: ISampleModel;
  profile: ISimulationProfile;
  simulationState: ISimulationState;
  onScrubProgress: (progress: number) => void;
  onSetCameraView: (view: 'iso' | 'top' | 'front' | 'nozzle') => void;
  onCaptureSnapshot?: () => string | null;
}

export function BambuTimelapseModal({
  isOpen,
  onClose,
  currentModel,
  profile,
  simulationState,
  onScrubProgress,
  onSetCameraView,
  onCaptureSnapshot,
}: BambuTimelapseModalProps) {
  const [timelapseMode, setTimelapseMode] = useState<TimelapseMode>('smooth');
  const [cameraPreset, setCameraPreset] = useState<TimelapseCameraPreset>('chamber_iso');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(5); // 5x speed
  const [currentLayer, setCurrentLayer] = useState(simulationState.currentLayer);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canvasPreviewRef = useRef<HTMLCanvasElement>(null);
  const playbackTimerRef = useRef<number | null>(null);

  const totalLayers = Math.max(10, simulationState.totalLayers);

  // Đồng bộ layer khi modal mở ra
  useEffect(() => {
    if (isOpen) {
      setCurrentLayer(simulationState.currentLayer);
    }
  }, [isOpen, simulationState.currentLayer]);

  // Toast auto-clear
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Vòng lặp phát Timelapse (Playback Loop)
  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      return;
    }

    const intervalMs = Math.max(16, Math.round(1000 / (15 * playbackSpeed)));

    playbackTimerRef.current = window.setInterval(() => {
      setCurrentLayer((prev) => {
        if (prev >= totalLayers) {
          setIsPlaying(false);
          onScrubProgress(1.0);
          return totalLayers;
        }
        const next = prev + 1;
        onScrubProgress((next - 0.5) / totalLayers);
        return next;
      });
    }, intervalMs);

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, totalLayers, onScrubProgress]);

  // Thay đổi góc quay camera phù hợp Timelapse
  const handleChangeCamera = (preset: TimelapseCameraPreset) => {
    setCameraPreset(preset);
    if (preset === 'top_down') {
      onSetCameraView('top');
    } else if (preset === 'front_hero') {
      onSetCameraView('front');
    } else {
      onSetCameraView('iso');
    }
    setToastMessage(`✓ Đã chuyển sang góc quay: ${preset === 'chamber_iso' ? 'Bambu Chamber Cam' : preset === 'front_hero' ? 'Front Hero 45°' : 'Top-Down POV'}`);
  };

  // Kéo thanh trượt layer
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentLayer(val);
    onScrubProgress(val / totalLayers);
  };

  // 1. Chụp ảnh Frame hiện tại kèm OSD Watermark
  const handleSnapshotCurrentFrame = () => {
    if (!onCaptureSnapshot) return;
    const rawDataUrl = onCaptureSnapshot();
    if (!rawDataUrl) {
      setToastMessage('⚠️ Không thể chụp ảnh từ Canvas 3D lúc này.');
      return;
    }

    // Vẽ thêm Watermark OSD Bambu Lab lên ảnh
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      // OSD Header Bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, c.width, 42);

      // OSD Logo & Recording indicator
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(24, 21, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('BAMBU X1-CARBON CHAMBER CAM [TIMELAPSE]', 40, 26);

      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'right';
      ctx.fillText(`LAYER ${currentLayer}/${totalLayers} (${Math.round((currentLayer / totalLayers) * 100)}%)`, c.width - 24, 26);

      // OSD Footer Bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, c.height - 38, c.width, 38);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#10b981';
      ctx.fillText(`NOZZLE: ${profile.nozzleTemp}°C  |  BED: ${profile.bedTemp}°C  |  MATERIAL: ${profile.material}`, 24, c.height - 14);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(new Date().toLocaleString('vi-VN'), c.width - 24, c.height - 14);

      // Tải về máy
      const link = document.createElement('a');
      link.download = `Bambu_Timelapse_Layer_${currentLayer}_${currentModel.name.replace(/\s+/g, '_')}.png`;
      link.href = c.toDataURL('image/png');
      link.click();
      setToastMessage(`✓ Đã lưu ảnh chụp HD Layer ${currentLayer}!`);
    };
    img.src = rawDataUrl;
  };

  // 2. Tự động sinh chuỗi frame Timelapse từ 0% đến 100%
  const handleGenerateTimelapseSequence = async () => {
    if (!onCaptureSnapshot) return;
    setIsGenerating(true);
    setGenerationProgress(0);
    setIsPlaying(false);

    const stepCount = 36; // Lấy mẫu 36 khung hình đại diện
    const frames: string[] = [];

    for (let i = 0; i <= stepCount; i++) {
      const prog = i / stepCount;
      const layerNum = Math.max(1, Math.round(prog * totalLayers));
      onScrubProgress(prog);
      setCurrentLayer(layerNum);
      setGenerationProgress(Math.round(prog * 100));

      // Đợi WebGL render khung hình mới
      await new Promise((resolve) => setTimeout(resolve, 60));

      const snapshot = onCaptureSnapshot();
      if (snapshot) {
        frames.push(snapshot);
      }
    }

    setCapturedFrames(frames);
    setIsGenerating(false);
    setToastMessage(`✓ Đã tạo thành công chuỗi Timelapse ${frames.length} khung hình!`);
  };

  // 3. Xuất Video Timelapse (.webm)
  const handleExportTimelapseVideo = async () => {
    if (capturedFrames.length < 5) {
      await handleGenerateTimelapseSequence();
    }
    if (capturedFrames.length === 0) return;

    setIsExportingVideo(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot init canvas context');

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Bambu_Timelapse_${currentModel.name.replace(/\s+/g, '_')}.webm`;
        link.click();
        URL.revokeObjectURL(url);
        setIsExportingVideo(false);
        setToastMessage('✓ Đã xuất video Timelapse (.webm) thành công!');
      };

      recorder.start();

      // Vẽ từng frame vào canvas với tốc độ 20 FPS
      for (let i = 0; i < capturedFrames.length; i++) {
        const frameUrl = capturedFrames[i];
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Watermark HUD
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(0, 0, canvas.width, 36);
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(20, 18, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px monospace';
            ctx.fillText('BAMBU LAB SMOOTH TIMELAPSE', 34, 22);

            ctx.textAlign = 'right';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(`LAYER ${Math.round((i / capturedFrames.length) * totalLayers)} / ${totalLayers}`, canvas.width - 20, 22);
            ctx.textAlign = 'left';

            resolve();
          };
          img.src = frameUrl;
        });
        await new Promise((r) => setTimeout(r, 65));
      }

      recorder.stop();
    } catch (err) {
      console.error(err);
      setIsExportingVideo(false);
      setToastMessage('⚠️ Trình duyệt không hỗ trợ xuất MediaRecorder.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl glass-panel border border-white/20 shadow-2xl overflow-hidden bg-slate-950/95 text-white">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-emerald-500/90 text-black text-xs font-black shadow-2xl backdrop-blur-md animate-bounce">
            {toastMessage}
          </div>
        )}

        {/* 1. Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/25">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">Bambu Lab Print Timelapse Studio</h2>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-black uppercase tracking-wider">
                  Chamber Cam
                </span>
              </div>
              <p className="text-xs text-white/50">
                Ghi hình tua nhanh quá trình in 3D: Chế độ Tua Mịn (Smooth Timelapse) bãi đỗ Purge Chute chuẩn Bambu X1-Carbon / P1S
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Main Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Chamber HUD Preview Card */}
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black/90 shadow-2xl flex flex-col justify-between p-4 group">
            {/* Ambient Chamber Lighting Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />

            {/* Top OSD Bar */}
            <div className="relative z-10 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-md shadow-rose-500/50" />
                <span className="font-black text-rose-400 tracking-wider">REC</span>
                <span className="text-white/40">|</span>
                <span className="text-white font-bold">BAMBU X1-CARBON CAM</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md">
                <span className="text-teal-300 font-bold">1080P 30FPS</span>
                <span className="text-white/40">|</span>
                <span className="text-amber-300 font-bold uppercase">{timelapseMode} MODE</span>
              </div>
            </div>

            {/* Center Visual Mock / Watermark */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto pointer-events-none select-none">
              <div className="p-4 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm space-y-1 max-w-md">
                <div className="text-sm font-black text-white/90">
                  {currentModel.name}
                </div>
                <div className="text-xs text-white/60 font-mono">
                  Tầng in hiện tại: <span className="text-teal-300 font-bold">{currentLayer}</span> / {totalLayers} ({Math.round((currentLayer / totalLayers) * 100)}%)
                </div>
                {timelapseMode === 'smooth' && (
                  <div className="text-[11px] text-amber-300/90 font-medium pt-1">
                    ✓ Đầu phun đang đỗ ở trạm Purge Chute [-110, Y, 110] để ảnh không bị rung giật
                  </div>
                )}
              </div>
            </div>

            {/* Bottom OSD Bar */}
            <div className="relative z-10 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-rose-300">
                  <Thermometer className="w-3.5 h-3.5" />
                  <span>{profile.nozzleTemp}°C</span>
                </div>
                <span className="text-white/30">•</span>
                <div className="flex items-center gap-1.5 text-amber-300">
                  <span>BED {profile.bedTemp}°C</span>
                </div>
                <span className="text-white/30">•</span>
                <div className="text-teal-300 font-bold">{profile.material}</div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md text-white/70">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>{new Date().toLocaleTimeString('vi-VN')}</span>
              </div>
            </div>
          </div>

          {/* 3. Interactive Playback Controls */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            {/* Layer Scrubber Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/70 font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  Kéo tua tầng in (Layer Scrubber):
                </span>
                <span className="font-mono font-bold text-teal-300">
                  {currentLayer} / {totalLayers} <span className="text-white/40">({Math.round((currentLayer / totalLayers) * 100)}%)</span>
                </span>
              </div>
              <input
                type="range"
                min="1"
                max={totalLayers}
                value={currentLayer}
                onChange={handleSliderChange}
                className="w-full accent-teal-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Play, Step, Speed buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95 ${
                    isPlaying
                      ? 'bg-rose-500 hover:bg-rose-600 text-white'
                      : 'bg-teal-400 hover:bg-teal-300 text-black font-black'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isPlaying ? 'Tạm Dừng' : 'Phát Timelapse'}</span>
                </button>

                <button
                  onClick={() => {
                    const prev = Math.max(1, currentLayer - 1);
                    setCurrentLayer(prev);
                    onScrubProgress(prev / totalLayers);
                  }}
                  className="px-3 py-2 rounded-xl glass-input hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
                  title="Lùi 1 layer"
                >
                  -1 Layer
                </button>

                <button
                  onClick={() => {
                    const next = Math.min(totalLayers, currentLayer + 1);
                    setCurrentLayer(next);
                    onScrubProgress(next / totalLayers);
                  }}
                  className="px-3 py-2 rounded-xl glass-input hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
                  title="Tiến 1 layer"
                >
                  +1 Layer
                </button>

                <button
                  onClick={() => {
                    setCurrentLayer(1);
                    onScrubProgress(1 / totalLayers);
                  }}
                  className="p-2 rounded-xl glass-input hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                  title="Tua về đầu"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Speed Buttons */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/10 text-xs font-bold font-mono">
                <span className="text-[10px] text-white/40 px-2 font-sans">Tốc độ:</span>
                {[1, 2, 5, 10, 30].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      playbackSpeed === spd
                        ? 'bg-teal-400 text-black font-black'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Bambu Camera & Timelapse Mode Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Timelapse Mode Selection */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <label className="text-xs font-bold text-white/90 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-400" />
                <span>Chế độ Tua Nhanh (Timelapse Mode):</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTimelapseMode('smooth')}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    timelapseMode === 'smooth'
                      ? 'bg-teal-500/20 border-teal-400 text-teal-200 shadow-md shadow-teal-500/10'
                      : 'bg-white/5 border-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                    <span>Tua Mịn (Smooth)</span>
                  </div>
                  <div className="text-[10px] text-white/50 pt-1 leading-snug">
                    Đầu in tự đỗ tại Purge Chute ở cuối mỗi lớp. Mô hình lớn dần kỳ diệu mà không bị nhấp nháy đầu in!
                  </div>
                </button>

                <button
                  onClick={() => setTimelapseMode('live')}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    timelapseMode === 'live'
                      ? 'bg-purple-500/20 border-purple-400 text-purple-200 shadow-md shadow-purple-500/10'
                      : 'bg-white/5 border-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-purple-300" />
                    <span>Thực Tế (Live Action)</span>
                  </div>
                  <div className="text-[10px] text-white/50 pt-1 leading-snug">
                    Chụp trực tiếp đầu in đang đùn nhựa tại từng tọa độ trên đường bao mô hình.
                  </div>
                </button>
              </div>
            </div>

            {/* Camera Presets */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <label className="text-xs font-bold text-white/90 flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Góc Quay Camera Buồng In (Presets):</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleChangeCamera('chamber_iso')}
                  className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer text-xs font-bold ${
                    cameraPreset === 'chamber_iso'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-white/5 border-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  <div>Chamber Cam</div>
                  <div className="text-[9px] text-white/40">Góc Trong X1C</div>
                </button>

                <button
                  onClick={() => handleChangeCamera('front_hero')}
                  className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer text-xs font-bold ${
                    cameraPreset === 'front_hero'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-white/5 border-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  <div>Front 45°</div>
                  <div className="text-[9px] text-white/40">Góc Trực Diện</div>
                </button>

                <button
                  onClick={() => handleChangeCamera('top_down')}
                  className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer text-xs font-bold ${
                    cameraPreset === 'top_down'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-white/5 border-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  <div>Top Down</div>
                  <div className="text-[9px] text-white/40">Từ Đỉnh Xuống</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Footer Actions: Exporting & Capturing */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSnapshotCurrentFrame}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-md"
            >
              <Camera className="w-4 h-4 text-teal-300" />
              <span>Chụp Ảnh Frame Hiện Tại (HD OSD)</span>
            </button>

            <button
              onClick={handleGenerateTimelapseSequence}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/40 text-xs font-bold transition-all cursor-pointer active:scale-95"
            >
              <FastForward className="w-4 h-4 text-purple-300" />
              <span>{isGenerating ? `Đang tạo ${generationProgress}%...` : 'Tạo Toàn Bộ Chuỗi Frame'}</span>
            </button>
          </div>

          <button
            onClick={handleExportTimelapseVideo}
            disabled={isExportingVideo}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 text-black font-black text-xs hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-teal-500/20 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingVideo ? 'Đang xuất video (.webm)...' : 'Xuất Video Timelapse (.webm)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Image as ImageIcon,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Key,
  X,
  ArrowRight,
  RefreshCw,
  Box,
  Compass,
} from 'lucide-react';
import {
  AI3DEngineType,
  AI_3D_SHOWCASE_PRESETS,
  IAI3DPresetShowcase,
  getSavedFalApiKey,
  saveFalApiKey,
  generate3DModelFromAI,
} from '@/services/ai3dGenerationService';
import { ISampleModel } from '@/types/simulator';
import * as THREE from 'three';

interface AI3DGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModelLoaded: (model: ISampleModel, geometry: THREE.BufferGeometry) => void;
}

export function AI3DGeneratorModal({
  isOpen,
  onClose,
  onModelLoaded,
}: AI3DGeneratorModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'showcase'>('text');
  const [prompt, setPrompt] = useState<string>('Bò cao nguyên Scotland (Highland Cow) sừng dài, lông rủ mượt mà');
  const [selectedEngine, setSelectedEngine] = useState<AI3DEngineType>('tripo');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [falApiKey, setFalApiKey] = useState<string>(() => getSavedFalApiKey());
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  if (!isOpen) return null;

  const handleSaveKey = () => {
    saveFalApiKey(falApiKey);
    setShowKeyConfig(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartGenerate = async () => {
    setIsGenerating(true);
    setProgressPercent(10);
    setStatusMessage('Đang khởi tạo tác vụ sinh hình thái học 3D...');

    try {
      const result = await generate3DModelFromAI(
        {
          engine: selectedEngine,
          prompt,
          imageUrl: uploadedImage || undefined,
          falApiKey: falApiKey || undefined,
        },
        (status, percent) => {
          setStatusMessage(status);
          setProgressPercent(percent);
        }
      );

      // Nạp model và geometry vào ứng dụng chính
      onModelLoaded(result.model, result.geometry);
      setTimeout(() => {
        setIsGenerating(false);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error(err);
      setStatusMessage('Có lỗi xảy ra, vui lòng thử lại.');
      setIsGenerating(false);
    }
  };

  const handleSelectShowcase = async (preset: IAI3DPresetShowcase) => {
    setIsGenerating(true);
    setProgressPercent(30);
    setStatusMessage(`Đang nạp mô hình ${preset.name} và tự động cắt lớp Tree Support...`);

    try {
      const result = await generate3DModelFromAI(
        {
          engine: 'tripo',
          prompt: preset.name,
        },
        (status, percent) => {
          setStatusMessage(status);
          setProgressPercent(percent);
        }
      );

      onModelLoaded(result.model, result.geometry);
      setTimeout(() => {
        setIsGenerating(false);
        onClose();
      }, 400);
    } catch (err: any) {
      console.error(err);
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-white/20 bg-slate-950/90 text-white shadow-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 shadow-lg">
              <Sparkles className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  AI 3D Model Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  Thế Hệ Mới
                </span>
              </div>
              <p className="text-xs text-white/60">
                Sinh lưới 3D kín nước (Watertight) từ Trellis & Tripo3D • Tự động cắt lớp Tree Support hữu cơ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                falApiKey
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title="Cấu hình API Key (Fal.ai cho Trellis/Tripo)"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">API Key</span>
            </button>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Key Drawer (nếu mở) */}
        {showKeyConfig && (
          <div className="px-6 py-3 border-b border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-amber-200">
              <Key className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Nhập <strong>FAL_KEY</strong> để gọi trực tiếp Microsoft Trellis & Tripo3D API qua Fal.ai:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={falApiKey}
                onChange={(e) => setFalApiKey(e.target.value)}
                placeholder="fal_key_..."
                className="px-3 py-1 text-xs rounded-lg bg-black/60 border border-white/20 text-white focus:outline-none focus:border-amber-400 w-56"
              />
              <button
                onClick={handleSaveKey}
                className="px-3 py-1 rounded-lg bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition-all cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </div>
        )}

        {/* Body Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-white/10">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Mô tả Văn bản (Text to 3D)</span>
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'image'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Từ Ảnh Chụp (Image to 3D)</span>
          </button>
          <button
            data-testid="ai-tab-showcase"
            onClick={() => setActiveTab('showcase')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'showcase'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Mẫu AI Tuyển Chọn (Quick Showcase)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: TEXT TO 3D */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/80 mb-2">
                  Nhập mô tả chi tiết mẫu 3D muốn in:
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="Ví dụ: Highland Cow standing upright, thick fur texture, long horns curving upward, flat base for 3D printing..."
                  className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:border-teal-400 resize-none transition-all placeholder:text-white/30"
                />
              </div>

              {/* Gợi ý Prompt nhanh */}
              <div>
                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">
                  Gợi ý nhanh tối ưu cho máy in FDM CoreXY:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    '🐂 Bò Cao Nguyên Scotland (Highland Cow)',
                    '🐉 Rồng Thần Cơ Khí Nghệ Thuật (Cyber Dragon)',
                    '⛵ Tàu Benchy Tốc Độ Cao (Voron Bench)',
                    '⚙️ Khớp Bánh Răng Hành Tinh (Print-in-Place)',
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(s.slice(3))}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 transition-all cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMAGE TO 3D */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-white/80">
                Tải lên ảnh mẫu 2D (Chụp góc nghiêng 45° hoặc chính diện):
              </label>

              <div className="border-2 border-dashed border-white/20 rounded-2xl p-6 text-center hover:border-teal-400/50 transition-all bg-black/20">
                {uploadedImage ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={uploadedImage}
                      alt="Uploaded preview"
                      className="max-h-48 rounded-xl object-contain border border-white/20 shadow-lg"
                    />
                    <button
                      onClick={() => setUploadedImage(null)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                    >
                      Chọn ảnh khác
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2">
                    <ImageIcon className="w-10 h-10 text-teal-400/70" />
                    <span className="text-xs font-bold text-white">
                      Kéo thả ảnh vào đây hoặc bấm để chọn tệp
                    </span>
                    <span className="text-[11px] text-white/40">
                      Hỗ trợ JPG, PNG, WEBP (Tự động tách nền cho Trellis/Tripo)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* CHỌN ENGINE AI (Dùng cho cả Tab 1 & 2) */}
          {activeTab !== 'showcase' && (
            <div>
              <label className="block text-xs font-bold text-white/80 mb-2.5">
                Chọn Động Cơ AI 3D Thế Hệ Mới:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'tripo' as AI3DEngineType,
                    name: 'Tripo3D v2.5',
                    badge: 'Siêu Tốc 10s • Top FDM',
                    desc: 'Tự động tạo mặt đáy phẳng và tối ưu thành vách kín nước cho máy in 3D.',
                    color: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300',
                  },
                  {
                    id: 'trellis' as AI3DEngineType,
                    name: 'Microsoft Trellis',
                    badge: 'Độ Chi Tiết Cao',
                    desc: 'Mô hình tiên tiến nhất về hình thái học (geometry) và ít lỗi rách mặt.',
                    color: 'border-cyan-400/50 bg-cyan-500/10 text-cyan-300',
                  },
                  {
                    id: 'meshy' as AI3DEngineType,
                    name: 'Meshy-4 Pro',
                    badge: 'Quad-Mesh',
                    desc: 'Tối ưu cho cơ khí với lưới đồng đều và bề mặt cong mượt mà.',
                    color: 'border-purple-400/50 bg-purple-500/10 text-purple-300',
                  },
                ].map((engine) => (
                  <div
                    key={engine.id}
                    onClick={() => setSelectedEngine(engine.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                      selectedEngine === engine.id
                        ? `${engine.color} ring-1 ring-white/30 shadow-lg`
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-sm font-black text-white">{engine.name}</h4>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-white/10 text-white">
                        {engine.badge}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-80">{engine.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SHOWCASE PRESETS */}
          {activeTab === 'showcase' && (
            <div className="space-y-3">
              <span className="text-xs text-white/60 block">
                Các mẫu 3D đã được chuẩn hóa lưới watertight, sẵn sàng cắt lớp Tree Support hữu cơ và chạy 500 lớp sợi in:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AI_3D_SHOWCASE_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    data-testid={`ai-preset-${preset.id}`}
                    onClick={() => handleSelectShowcase(preset)}
                    className="p-4 rounded-2xl border border-white/10 bg-white/5 hover:border-teal-400/60 hover:bg-white/10 transition-all cursor-pointer flex items-start gap-3 group"
                  >
                    <div className="text-3xl p-2 rounded-xl bg-black/40 border border-white/10 shrink-0">
                      {preset.thumbnail}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-black text-white group-hover:text-teal-300 transition-colors truncate">
                          {preset.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-teal-400/20 text-teal-300 border border-teal-400/30">
                          {preset.badge}
                        </span>
                        <span className="text-[9px] font-mono text-white/50">
                          {preset.engineUsed}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-teal-400 transition-transform group-hover:translate-x-1 shrink-0 mt-3" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Box khi đang sinh */}
          {isGenerating && (
            <div className="p-4 rounded-2xl border border-teal-400/40 bg-teal-500/10 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-teal-200">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-300" />
                  <span>{statusMessage}</span>
                </div>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {activeTab !== 'showcase' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tự động kích hoạt Organic Tree Support & Sợi in Bambu sau khi tạo</span>
            </div>

            <button
              onClick={handleStartGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-xl active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý hình thái học...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Sinh Mô Hình & Nạp Vào Bàn In</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

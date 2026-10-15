import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Cpu,
  Shield,
  Layers,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Key,
  ExternalLink,
  Zap,
  Info,
  Sliders,
  X,
  HelpCircle,
} from 'lucide-react';
import * as THREE from 'three';
import {
  ISimulationProfile,
  ISampleModel,
  IModelTransform,
  ISupportAnalysisResult,
  TreeSupportStyle,
  SupportType,
} from '@/types/simulator';
import {
  analyzeWithGeminiAI,
  analyzeWithBambuExpertRules,
  getSavedGeminiApiKey,
  saveGeminiApiKey,
  clearGeminiApiKey,
} from '@/services/geminiSupportService';

interface BambuSupportAIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: ISampleModel;
  geometry: THREE.BufferGeometry;
  profile: ISimulationProfile;
  modelTransform: IModelTransform;
  onChangeProfile: (patch: Partial<ISimulationProfile>) => void;
  onChangeTransform: (newTransform: IModelTransform) => void;
}

export function BambuSupportAIAssistantModal({
  isOpen,
  onClose,
  currentModel,
  geometry,
  profile,
  modelTransform,
  onChangeProfile,
  onChangeTransform,
}: BambuSupportAIAssistantModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavedKey, setIsSavedKey] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ISupportAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendation' | 'hotspots' | 'tips' | 'settings'>('recommendation');
  const [applySuccess, setApplySuccess] = useState(false);

  // Khởi tạo key đã lưu từ LocalStorage
  useEffect(() => {
    const saved = getSavedGeminiApiKey();
    if (saved) {
      setApiKeyInput(saved);
      setIsSavedKey(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Tự động phân tích tức thì khi mở Modal (sử dụng AI nếu có key, hoặc Expert Rules nội tại)
  useEffect(() => {
    if (isOpen && geometry) {
      handleRunAnalysis();
    }
  }, [isOpen, geometry, currentModel]);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setApplySuccess(false);

    try {
      const result = await analyzeWithGeminiAI(
        currentModel.name,
        geometry,
        profile,
        apiKeyInput.trim()
      );
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      // Fallback
      setAnalysisResult(analyzeWithBambuExpertRules(currentModel.name, geometry, profile));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim().length > 0) {
      saveGeminiApiKey(apiKeyInput.trim());
      setIsSavedKey(true);
      handleRunAnalysis();
    }
  };

  const handleClearApiKey = () => {
    clearGeminiApiKey();
    setApiKeyInput('');
    setIsSavedKey(false);
    handleRunAnalysis();
  };

  // Áp dụng khuyến nghị AI vào mô hình
  const handleApplyAIRecommendation = () => {
    if (!analysisResult) return;
    const rec = analysisResult.supportRecommendation;

    onChangeProfile({
      supportMode: rec.mode,
      treeStyle: rec.treeStyle,
      supportAngleThreshold: rec.angleThreshold,
      supportTopZDistance: rec.topZDistance,
      supportBranchDiameter: rec.branchDiameter,
      supportBranchAngle: rec.branchAngle,
      supportOnBuildPlateOnly: rec.onBuildPlateOnly,
      supportInterfaceLayers: rec.interfaceLayers,
      brimEnabled: rec.mode !== 'none' || profile.brimEnabled,
    });

    setApplySuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Xoay góc mô hình theo gợi ý của AI
  const handleApplyOrientation = () => {
    if (!analysisResult?.recommendedOrientation) return;
    const { axis, degrees } = analysisResult.recommendedOrientation;
    const rad = (degrees * Math.PI) / 180;
    const newRot: [number, number, number] = [...modelTransform.rotation];

    if (axis === 'x') newRot[0] += rad;
    if (axis === 'y') newRot[1] += rad;
    if (axis === 'z') newRot[2] += rad;

    onChangeTransform({
      ...modelTransform,
      rotation: newRot,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl glass-panel border border-teal-500/30 shadow-2xl overflow-hidden bg-slate-950/95 text-white">
        {/* 1. Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-black font-black shadow-lg shadow-teal-500/25">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">Bambu Studio AI Support Copilot</h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 text-[10px] font-black uppercase tracking-wider">
                  Gemini 2.5 Flash
                </span>
              </div>
              <p className="text-xs text-white/50">
                Suy luận hình học đa giác 3D &amp; kiến trúc cành cây Tree Support hữu cơ chuẩn Bambu Lab
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

        {/* 2. Mode Status & API Key Banner */}
        <div className="px-6 py-3 border-b border-white/10 bg-black/40 flex items-center justify-between gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                analysisResult?.source === 'gemini_flash' ? 'bg-emerald-400 shadow-md shadow-emerald-400/50' : 'bg-teal-400'
              }`}
            />
            <span className="text-white/80">Nguồn phân tích:</span>
            <span className="font-bold text-teal-300">
              {analysisResult?.source === 'gemini_flash'
                ? 'Google Gemini 2.5 Flash AI (Trực Tuyến)'
                : 'Bambu Studio Expert Rule Engine (Cục Bộ)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white/70 hover:text-white transition-all cursor-pointer text-[11px]"
            >
              <Key className="w-3.5 h-3.5 text-amber-300" />
              <span>{isSavedKey ? 'API Key (Đã cấu hình)' : 'Thêm Gemini API Key'}</span>
            </button>

            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-400/40 text-[11px] font-bold transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-teal-300" />
              <span>{isAnalyzing ? 'Đang suy luận...' : 'Phân Tích Lại'}</span>
            </button>
          </div>
        </div>

        {/* 3. Navigation Tabs */}
        <div className="flex items-center border-b border-white/10 bg-white/5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('recommendation')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'recommendation'
                ? 'border-teal-400 text-teal-300 bg-white/5'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            Khuyến Nghị Support Bambu
          </button>

          <button
            onClick={() => setActiveTab('hotspots')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'hotspots'
                ? 'border-teal-400 text-teal-300 bg-white/5'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span>Điểm Nóng Overhang</span>
            {analysisResult && analysisResult.riskHotspots.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono">
                {analysisResult.riskHotspots.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tips')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'tips'
                ? 'border-teal-400 text-teal-300 bg-white/5'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            Mẹo Bambu Studio
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'settings'
                ? 'border-teal-400 text-teal-300 bg-white/5'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Cài Đặt Gemini</span>
          </button>
        </div>

        {/* 4. Tab Contents */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* TAB 1: KHUYẾN NGHỊ SUPPORT */}
          {activeTab === 'recommendation' && analysisResult && (
            <div className="space-y-4">
              {/* Prominent Gemini API Key Banner on Web UI */}
              {!isSavedKey ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-400/40 text-xs space-y-2 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300 font-bold">
                      <Key className="w-4 h-4 text-amber-400" />
                      <span>Kích hoạt Google Gemini 2.5 Flash AI:</span>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-amber-300 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <span>Lấy Key miễn phí tại AI Studio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Dán Gemini API Key (AIzaSy...) trực tiếp tại đây..."
                      className="flex-1 px-3 py-1.5 rounded-xl glass-input text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-white/30 border border-white/10"
                    />
                    <button
                      onClick={handleSaveApiKey}
                      disabled={!apiKeyInput.trim()}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-md"
                    >
                      Lưu &amp; Phân Tích
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 px-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
                    <span>Gemini 2.5 Flash AI đã kích hoạt</span>
                    <span className="text-[10px] opacity-75 font-mono">({apiKeyInput.slice(0, 8)}•••••)</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="text-[10px] text-emerald-300 hover:underline cursor-pointer font-bold"
                  >
                    Cài đặt / Đổi Key
                  </button>
                </div>
              )}

              {/* Summary Card */}
              <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-400/30 text-xs leading-relaxed space-y-2">
                <div className="flex items-center gap-2 text-teal-300 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Đánh Giá Từ Chuyên Gia AI:</span>
                </div>
                <p className="text-white/90 font-medium">{analysisResult.supportRecommendation.summary}</p>
              </div>

              {/* Geometry Metrics Spectrum */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-white/50 text-[10px]">Diện tích Overhang &gt;45°:</div>
                  <div className="text-lg font-black text-amber-300 font-mono">
                    {analysisResult.overhangPercent}%
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-white/50 text-[10px]">Dốc Hiểm &gt;60°:</div>
                  <div className="text-lg font-black text-rose-300 font-mono">
                    {analysisResult.severeOverhangPercent}%
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-white/50 text-[10px]">Cầu nối ngang (Bridges):</div>
                  <div className="text-lg font-black text-teal-300 font-mono">
                    {analysisResult.bridgeSpansCount} vị trí
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-white/50 text-[10px]">Nhựa Support ước tính:</div>
                  <div className="text-lg font-black text-emerald-300 font-mono">
                    ~{analysisResult.estimatedSupportWeightGrams}g
                  </div>
                </div>
              </div>

              {/* Suggested Parameters Box */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="text-xs font-bold text-white/90 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-teal-400" />
                  <span>Cấu hình Support Bambu Studio được đề xuất:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-white/60">Kiểu dáng Support:</span>
                    <span className="font-bold text-teal-300 uppercase">
                      {analysisResult.supportRecommendation.mode === 'tree'
                        ? `Tree (${analysisResult.supportRecommendation.treeStyle})`
                        : analysisResult.supportRecommendation.mode}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-white/60">Ngưỡng góc Overhang:</span>
                    <span className="font-bold text-amber-300 font-mono">
                      {analysisResult.supportRecommendation.angleThreshold}°
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-white/60">Khoảng hở đỉnh (Top Z Distance):</span>
                    <span className="font-bold text-teal-300 font-mono">
                      {analysisResult.supportRecommendation.topZDistance} mm (Dễ bóc)
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-white/60">Đường kính thân cành (Diameter):</span>
                    <span className="font-bold text-teal-300 font-mono">
                      {analysisResult.supportRecommendation.branchDiameter} mm
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-white/60">Lớp tiếp xúc (Interface Layers):</span>
                    <span className="font-bold text-teal-300 font-mono">
                      {analysisResult.supportRecommendation.interfaceLayers} lớp đệm phẳng
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-white/60">Vị trí mọc cành:</span>
                    <span className="font-bold text-teal-300">
                      {analysisResult.supportRecommendation.onBuildPlateOnly ? 'Chỉ trên bàn in (Bed Only)' : 'Mọi nơi (Everywhere)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Orientation Recommendation Card */}
              {analysisResult.recommendedOrientation && (
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-400/30 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-300 font-bold">
                      <RotateCw className="w-4 h-4" />
                      <span>Khuyến Nghị Góc Đặt Mô Hình (Print Orientation):</span>
                    </div>
                    {analysisResult.recommendedOrientation.savingsPercent > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold">
                        Giảm {analysisResult.recommendedOrientation.savingsPercent}% Support
                      </span>
                    )}
                  </div>
                  <p className="text-white/80">{analysisResult.recommendedOrientation.rationale}</p>

                  {analysisResult.recommendedOrientation.degrees !== 0 && (
                    <button
                      onClick={handleApplyOrientation}
                      className="mt-1 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs transition-all cursor-pointer"
                    >
                      Xoay {analysisResult.recommendedOrientation.degrees}° quanh trục {analysisResult.recommendedOrientation.axis.toUpperCase()}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ĐIỂM NÓNG OVERHANG */}
          {activeTab === 'hotspots' && analysisResult && (
            <div className="space-y-3">
              {analysisResult.riskHotspots.length === 0 ? (
                <div className="p-8 text-center text-white/50 text-xs">
                  ✓ Không có điểm nóng Overhang nguy hiểm nào cần cảnh báo trên mô hình này.
                </div>
              ) : (
                analysisResult.riskHotspots.map((spot) => (
                  <div
                    key={spot.id}
                    className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                      spot.severity === 'critical'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{spot.title}</span>
                      </div>
                      <span className="font-mono text-[10px] opacity-75">
                        X:{spot.location[0]} Y:{spot.location[1]} Z:{spot.location[2]}
                      </span>
                    </div>
                    <div className="text-white/80">{spot.description}</div>
                    <div className="text-teal-300 text-[11px] font-medium pt-1">
                      💡 Giải pháp: {spot.fixSuggestion}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: MẸO BAMBU STUDIO */}
          {activeTab === 'tips' && analysisResult && (
            <div className="space-y-3">
              {analysisResult.bambuStudioProTips.map((tip, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-teal-300 font-bold">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Mẹo chuyên gia #{idx + 1}:</span>
                  </div>
                  <p className="text-white/80 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: CÀI ĐẶT GEMINI API KEY */}
          {activeTab === 'settings' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center gap-2 font-bold text-white/90">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Google Gemini API Key (Tùy Chọn):</span>
                </div>
                <p className="text-white/60 text-[11px] leading-relaxed">
                  Khi cung cấp Gemini API Key, hệ thống sẽ gửi ma trận hình học và đặc tính vật liệu lên mô hình
                  <strong className="text-teal-300"> Gemini 2.5 Flash</strong> để nhận được suy luận và giải pháp thiết kế Tree Support chuyên biệt nhất.
                  Key được mã hóa và lưu trực tiếp trong LocalStorage trình duyệt của bạn.
                </p>

                <div className="space-y-2 pt-2">
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono text-teal-300 placeholder:text-white/20"
                  />
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-teal-400 hover:underline flex items-center gap-1"
                    >
                      <span>Lấy API Key miễn phí từ Google AI Studio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <div className="flex items-center gap-2">
                      {isSavedKey && (
                        <button
                          onClick={handleClearApiKey}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold cursor-pointer"
                        >
                          Xóa Key
                        </button>
                      )}
                      <button
                        onClick={handleSaveApiKey}
                        className="px-4 py-1.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-black cursor-pointer shadow-md"
                      >
                        Lưu &amp; Phân Tích
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between gap-3">
          <div className="text-xs text-white/50">
            {applySuccess ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                Đã áp dụng thành công cấu hình Tree Support vào 3D Viewport!
              </span>
            ) : (
              <span>Áp dụng cấu hình sẽ cập nhật tức thì cành cây 3D trong không gian in.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl glass-input hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>

            <button
              onClick={handleApplyAIRecommendation}
              disabled={!analysisResult || applySuccess}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 text-black font-black text-xs hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-teal-500/20 active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Áp Dụng Cấu Hình AI Vào Mô Hình</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

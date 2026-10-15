import React, { useState } from 'react';
import {
  Sliders,
  Layers,
  Thermometer,
  Gauge,
  Palette,
  Shield,
  Zap,
  ChevronLeft,
  ChevronRight,
  Info,
  Wind,
  MoveUpRight,
  Sparkles,
  Settings2,
  Key,
} from 'lucide-react';
import { ISimulationProfile, MaterialType, InfillPattern, SupportType } from '@/types/simulator';
import { PRESET_PROFILES, MATERIAL_PALETTE } from '@/services/presetProfiles';

interface ProfileSettingsPanelProps {
  profile: ISimulationProfile;
  onChangeProfile: (updated: Partial<ISimulationProfile>) => void;
  onApplyPreset: (presetId: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpenSupportAIModal?: () => void;
  onOpenGeminiKeyModal?: () => void;
  onOpenLocalSlicerModal?: () => void;
}

type SettingsTab = 'basic' | 'quality' | 'support' | 'speed' | 'thermals' | 'extrusion';

export function ProfileSettingsPanel({
  profile,
  onChangeProfile,
  onApplyPreset,
  isOpen,
  onToggleOpen,
  onOpenSupportAIModal,
  onOpenGeminiKeyModal,
  onOpenLocalSlicerModal,
}: ProfileSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');

  const materials: MaterialType[] = ['PLA', 'PETG', 'ABS', 'TPU', 'PLA-CF'];
  const infillTypes: { id: InfillPattern; label: string }[] = [
    { id: 'gyroid', label: 'Gyroid (Chịu lực 3D cao)' },
    { id: 'grid', label: 'Grid (Lưới song song nhanh)' },
    { id: 'honeycomb', label: 'Tổ Ong (Honeycomb)' },
    { id: 'triangles', label: 'Tam Giác (Triangles)' },
    { id: 'concentric', label: 'Đồng Tâm (Concentric nghệ thuật)' },
  ];
  const supportModes: { id: SupportType; label: string }[] = [
    { id: 'none', label: 'Tắt Support' },
    { id: 'tree', label: 'Tree Support (Cành Cây Tự Động)' },
    { id: 'normal', label: 'Normal (Cột Vuông Truyền Thống)' },
  ];

  return (
    <div
      className={`fixed top-20 left-4 z-20 transition-all duration-300 ${
        isOpen ? 'w-80 md:w-96' : 'w-12'
      }`}
    >
      <div className="rounded-3xl glass-panel border border-white/20 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[calc(100vh-160px)]">
        {/* Header / Toggle Button */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            {isOpen && (
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Cấu Hình In &amp; Cắt Lớp
                </h3>
                <p className="text-[10px] text-white/50">Bambu Studio / Orca Engine</p>
              </div>
            )}
          </div>

          <button
            onClick={onToggleOpen}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
            title={isOpen ? 'Thu gọn thanh cấu hình' : 'Mở thanh cấu hình'}
          >
            {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Multi-Tab Selector Bar */}
        {isOpen && (
          <div className="grid grid-cols-5 border-b border-white/10 bg-black/40 text-[10px] font-bold">
            <button
              onClick={() => setActiveTab('basic')}
              className={`py-2 px-1 text-center border-b-2 transition-all cursor-pointer ${
                activeTab === 'basic'
                  ? 'border-teal-400 text-teal-300 bg-white/5'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              Cơ Bản
            </button>
            <button
              onClick={() => setActiveTab('quality')}
              className={`py-2 px-1 text-center border-b-2 transition-all cursor-pointer ${
                activeTab === 'quality'
                  ? 'border-teal-400 text-teal-300 bg-white/5'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              Vách &amp; Vỏ
            </button>
            <button
              onClick={() => setActiveTab('support')}
              className={`py-2 px-1 text-center border-b-2 transition-all cursor-pointer ${
                activeTab === 'support'
                  ? 'border-teal-400 text-teal-300 bg-white/5 font-bold'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              Support
            </button>
            <button
              onClick={() => setActiveTab('speed')}
              className={`py-2 px-1 text-center border-b-2 transition-all cursor-pointer ${
                activeTab === 'speed'
                  ? 'border-teal-400 text-teal-300 bg-white/5'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              Tốc Độ
            </button>
            <button
              onClick={() => setActiveTab('thermals')}
              className={`py-2 px-1 text-center border-b-2 transition-all cursor-pointer ${
                activeTab === 'thermals'
                  ? 'border-teal-400 text-teal-300 bg-white/5'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              Nhiệt Độ
            </button>
            <button
              onClick={() => setActiveTab('extrusion')}
              className={`py-2 px-1 text-center border-b-2 transition-all cursor-pointer ${
                activeTab === 'extrusion'
                  ? 'border-teal-400 text-teal-300 bg-white/5'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              Đùn Nhựa
            </button>
          </div>
        )}

        {/* Content Body (Scrollable) */}
        {isOpen && (
          <div className="p-4 space-y-4 overflow-y-auto text-xs">
            {/* ================= TAB 1: CƠ BẢN ================= */}
            {activeTab === 'basic' && (
              <>
                {/* 1. Preset Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-white/70 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cấu hình in mẫu (Preset):</span>
                  </label>
                  <select
                    value={profile.id}
                    onChange={(e) => onApplyPreset(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold text-teal-300 cursor-pointer"
                  >
                    {PRESET_PROFILES.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-white/50 italic px-1">{profile.description}</p>
                </div>

                {/* 2. Material & Color Selector */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/70 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-pink-400" />
                    <span>Chất liệu &amp; Màu nhựa:</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {materials.map((m) => (
                      <button
                        key={m}
                        onClick={() => onChangeProfile({ material: m })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          profile.material === m
                            ? 'bg-teal-500/30 text-teal-300 border border-teal-400/60 shadow-md shadow-teal-500/20'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {/* Material Color Palette */}
                  <div className="flex items-center gap-2 pt-1 px-1">
                    <span className="text-[10px] text-white/40">Màu sắc:</span>
                    <div className="flex items-center gap-2">
                      {(MATERIAL_PALETTE[profile.material] || MATERIAL_PALETTE.PLA).map((hex) => (
                        <button
                          key={hex}
                          onClick={() => onChangeProfile({ materialColor: hex })}
                          className={`w-5 h-5 rounded-full transition-all cursor-pointer border ${
                            profile.materialColor === hex
                              ? 'scale-125 border-white shadow-lg ring-2 ring-teal-400/50'
                              : 'border-white/20 hover:scale-110 opacity-75'
                          }`}
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Layer Height Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 flex items-center gap-1.5 font-semibold">
                      <Layers className="w-3.5 h-3.5 text-teal-400" />
                      Độ dày lớp in (Layer Height):
                    </span>
                    <span className="font-mono font-bold text-teal-300 text-xs">
                      {profile.layerHeight} <span className="text-[10px] text-white/40">mm</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.08"
                    max="0.32"
                    step="0.04"
                    value={profile.layerHeight}
                    onChange={(e) => onChangeProfile({ layerHeight: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-white/40 font-mono">
                    <span>0.08mm (Cực mịn)</span>
                    <span>0.20mm (Chuẩn)</span>
                    <span>0.32mm (Nhanh)</span>
                  </div>
                </div>

                {/* 4. Infill Density & Pattern */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 font-semibold">Độ rỗng bên trong (Infill):</span>
                    <span className="font-mono font-bold text-teal-300 text-xs">
                      {profile.infillDensity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={profile.infillDensity}
                    onChange={(e) => onChangeProfile({ infillDensity: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40">Kiểu hoa văn ruột:</label>
                    <select
                      value={profile.infillType}
                      onChange={(e) => onChangeProfile({ infillType: e.target.value as InfillPattern })}
                      className="w-full px-3 py-1.5 rounded-xl glass-input text-xs font-medium text-white cursor-pointer"
                    >
                      {infillTypes.map((t) => (
                        <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 5. Support & Brim */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/70 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cấu trúc đỡ (Support) &amp; Bám bàn (Brim):</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {supportModes.map((sm) => (
                      <button
                        key={sm.id}
                        onClick={() => onChangeProfile({ supportMode: sm.id })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          profile.supportMode === sm.id
                            ? 'bg-amber-500/30 text-amber-300 border border-amber-400/60 shadow-md shadow-amber-500/20'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        {sm.id === 'none' ? 'Tắt' : sm.id === 'tree' ? 'Tree' : 'Normal'}
                      </button>
                    ))}
                  </div>

                  {/* Brim Toggle */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div>
                      <div className="text-xs font-semibold text-white">Vành Bám Bàn (Brim 5mm)</div>
                      <div className="text-[10px] text-white/40">Chống cong vênh góc cho PETG &amp; ABS</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.brimEnabled}
                      onChange={(e) => onChangeProfile({ brimEnabled: e.target.checked })}
                      className="w-4 h-4 accent-teal-400 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ================= TAB 2: VÁCH & VỎ ================= */}
            {activeTab === 'quality' && (
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 font-semibold">Số Vòng Tường Ngoài (Wall Loops):</span>
                    <span className="font-mono font-bold text-teal-300">{profile.wallLoops} vòng</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={profile.wallLoops}
                    onChange={(e) => onChangeProfile({ wallLoops: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="text-[10px] text-white/40 italic">
                    * Khuyên dùng 2 vòng cho decor, 4 vòng cho chi tiết cơ khí chịu lực.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 font-semibold">Chiều cao lớp đầu tiên:</span>
                    <span className="font-mono font-bold text-teal-300">{profile.firstLayerHeight || 0.2} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.12"
                    max="0.28"
                    step="0.02"
                    value={profile.firstLayerHeight || 0.2}
                    onChange={(e) => onChangeProfile({ firstLayerHeight: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/60">Lớp Nóc (Top Shells):</span>
                    <input
                      type="number"
                      min="2"
                      max="8"
                      value={profile.topShellLayers || 4}
                      onChange={(e) => onChangeProfile({ topShellLayers: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/60">Lớp Đáy (Bottom Shells):</span>
                    <input
                      type="number"
                      min="2"
                      max="8"
                      value={profile.bottomShellLayers || 3}
                      onChange={(e) => onChangeProfile({ bottomShellLayers: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/60">Vị trí giấu đường nối (Seam Alignment):</label>
                  <select
                    value={profile.seamPosition || 'aligned'}
                    onChange={(e) => onChangeProfile({ seamPosition: e.target.value as any })}
                    className="w-full px-3 py-1.5 rounded-xl glass-input text-xs font-semibold text-white cursor-pointer"
                  >
                    <option value="aligned" className="bg-slate-900">Aligned (Thẳng hàng góc khuất)</option>
                    <option value="nearest" className="bg-slate-900">Nearest (Gần nhất - in nhanh)</option>
                    <option value="random" className="bg-slate-900">Random (Phân tán ngẫu nhiên)</option>
                  </select>
                </div>
              </div>
            )}

            {/* ================= TAB: SUPPORT BAMBU STUDIO ================= */}
            {activeTab === 'support' && (
              <div className="space-y-4">
                {/* AI Copilot Banner Button */}
                {onOpenSupportAIModal && (
                  <button
                    onClick={onOpenSupportAIModal}
                    className="w-full p-3 rounded-2xl bg-gradient-to-r from-teal-500/20 via-emerald-500/20 to-teal-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 border border-teal-400/40 text-left transition-all cursor-pointer shadow-lg group flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-teal-300 font-black text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-teal-300 group-hover:rotate-12 transition-transform" />
                        <span>Trợ Lý Bambu Support AI &amp; Gemini</span>
                      </div>
                      <div className="text-[10px] text-white/60">
                        Quét góc dốc và tự động tối ưu hóa Tree Support &amp; góc đặt
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-teal-400 text-black text-[10px] font-black uppercase shadow-sm">
                      Mở AI
                    </span>
                  </button>
                )}

                {/* Gemini API Key Configuration Link */}
                {onOpenGeminiKeyModal && (
                  <button
                    onClick={onOpenGeminiKeyModal}
                    className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 text-white/80">
                      <Key className="w-3.5 h-3.5 text-amber-300" />
                      <span>Cấu hình Gemini API Key</span>
                    </div>
                    <span className="text-[10px] text-teal-300 font-bold hover:underline">
                      Thiết lập &gt;
                    </span>
                  </button>
                )}

                {/* Local Slicer CLI Bridge Banner Button */}
                {onOpenLocalSlicerModal && (
                  <button
                    onClick={onOpenLocalSlicerModal}
                    className="w-full py-2 px-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-slate-900 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-between shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span>Slicer CLI (Bambu Studio & Prusa)</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-400/20 px-2 py-0.5 rounded-full">
                      Chạy Local &gt;
                    </span>
                  </button>
                )}

                {/* 1. Support Mode Selection */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-white/70 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cấu trúc đỡ (Support Mode):</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['none', 'tree', 'normal'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onChangeProfile({ supportMode: mode })}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                          profile.supportMode === mode
                            ? 'bg-teal-500/30 text-teal-300 border border-teal-400/60 shadow-md shadow-teal-500/20 font-black'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        {mode === 'none' ? 'Tắt' : mode === 'tree' ? 'Tree Support' : 'Normal Snug'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Tree Support Style (if tree is selected) */}
                {profile.supportMode === 'tree' && (
                  <div className="space-y-2 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <label className="text-[11px] font-semibold text-teal-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Kiểu Dáng Tree Support (Bambu Lab):</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'organic', name: 'Tree Organic', desc: 'Uốn lượn, dễ bóc' },
                        { id: 'slim', name: 'Tree Slim', desc: 'Thanh mảnh, ít nhựa' },
                        { id: 'strong', name: 'Tree Strong', desc: 'Cường lực, chống rung' },
                        { id: 'hybrid', name: 'Tree Hybrid', desc: 'Trụ thẳng + cành cây' },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => onChangeProfile({ treeStyle: st.id as any })}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            (profile.treeStyle || 'organic') === st.id
                              ? 'bg-teal-500/25 border-teal-400/60 text-white font-bold'
                              : 'bg-white/5 border-white/5 text-white/60 hover:text-white'
                          }`}
                        >
                          <div className="text-xs font-bold text-teal-300">{st.name}</div>
                          <div className="text-[9px] text-white/40">{st.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Overhang Angle Threshold */}
                {profile.supportMode !== 'none' && (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/70 font-semibold">Ngưỡng góc nghiêng (Overhang Angle):</span>
                        <span className="font-mono font-bold text-amber-300 text-xs">
                          {profile.supportAngleThreshold || 45}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="75"
                        step="1"
                        value={profile.supportAngleThreshold || 45}
                        onChange={(e) => onChangeProfile({ supportAngleThreshold: Number(e.target.value) })}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-white/40 font-mono">
                        <span>30° (Đỡ nhiều)</span>
                        <span>45° (Chuẩn Bambu)</span>
                        <span>65° (Tiết kiệm)</span>
                      </div>
                    </div>

                    {/* 4. Top Z Distance (Air Gap) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/70 font-semibold">Khe hở bóc tách (Top Z Distance):</span>
                        <span className="font-mono font-bold text-teal-300 text-xs">
                          {profile.supportTopZDistance || 0.2} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.10"
                        max="0.32"
                        step="0.02"
                        value={profile.supportTopZDistance || 0.2}
                        onChange={(e) => onChangeProfile({ supportTopZDistance: Number(e.target.value) })}
                        className="w-full accent-teal-400 cursor-pointer"
                      />
                      <div className="text-[10px] text-white/40 italic">
                        * 0.20mm cho PLA, 0.25mm cho PETG để bóc bằng tay êm ái.
                      </div>
                    </div>

                    {/* 5. Branch Diameter & Angle */}
                    {profile.supportMode === 'tree' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] text-white/60">Đường kính cành (mm):</span>
                          <input
                            type="number"
                            step="0.2"
                            min="1.5"
                            max="5.0"
                            value={profile.supportBranchDiameter || 2.8}
                            onChange={(e) => onChangeProfile({ supportBranchDiameter: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                          />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-white/60">Góc vươn cành (°):</span>
                          <input
                            type="number"
                            step="1"
                            min="25"
                            max="60"
                            value={profile.supportBranchAngle || 42}
                            onChange={(e) => onChangeProfile({ supportBranchAngle: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 6. Brim Settings */}
                <div className="space-y-2 p-3 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Vành Bám Bàn (Brim Skirt)</div>
                      <div className="text-[10px] text-white/40">Tăng diện tích bám đáy, chống cong vênh</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.brimEnabled}
                      onChange={(e) => onChangeProfile({ brimEnabled: e.target.checked })}
                      className="w-4 h-4 accent-teal-400 rounded cursor-pointer"
                    />
                  </div>

                  {profile.brimEnabled && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-white/60">Bề rộng vành Brim:</span>
                        <span className="font-mono font-bold text-teal-300">{profile.brimWidthMm || 5} mm</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        step="1"
                        value={profile.brimWidthMm || 5}
                        onChange={(e) => onChangeProfile({ brimWidthMm: Number(e.target.value) })}
                        className="w-full accent-teal-400 cursor-pointer h-1.5"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= TAB 3: TỐC ĐỘ ================= */}
            {activeTab === 'speed' && (
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 flex items-center gap-1.5 font-semibold">
                      <Gauge className="w-3.5 h-3.5 text-blue-400" />
                      Tốc độ in tổng thể:
                    </span>
                    <span className="font-mono font-bold text-teal-300">{profile.printSpeed} mm/s</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="500"
                    step="10"
                    value={profile.printSpeed}
                    onChange={(e) => onChangeProfile({ printSpeed: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-white/40 font-mono">
                    <span>50 mm/s (Êm ái)</span>
                    <span>250 mm/s (CoreXY Chuẩn)</span>
                    <span>500 mm/s (Turbo)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/60">Vách Ngoài (Outer):</span>
                    <input
                      type="number"
                      value={profile.outerWallSpeed || Math.round(profile.printSpeed * 0.6)}
                      onChange={(e) => onChangeProfile({ outerWallSpeed: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/60">Ruột (Infill):</span>
                    <input
                      type="number"
                      value={profile.infillSpeed || Math.round(profile.printSpeed * 1.1)}
                      onChange={(e) => onChangeProfile({ infillSpeed: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 font-semibold">Tốc độ chạy không tải (Travel Move):</span>
                    <span className="font-mono font-bold text-teal-300">{profile.travelSpeed || 500} mm/s</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="700"
                    step="50"
                    value={profile.travelSpeed || 500}
                    onChange={(e) => onChangeProfile({ travelSpeed: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* ================= TAB 4: NHIỆT ĐỘ & QUẠT ================= */}
            {activeTab === 'thermals' && (
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 flex items-center gap-1.5 font-semibold">
                      <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                      Nhiệt độ Đầu Phun (Nozzle):
                    </span>
                    <span className="font-mono font-bold text-rose-300">{profile.nozzleTemp}°C</span>
                  </div>
                  <input
                    type="range"
                    min="180"
                    max="290"
                    step="5"
                    value={profile.nozzleTemp}
                    onChange={(e) => onChangeProfile({ nozzleTemp: Number(e.target.value) })}
                    className="w-full accent-rose-400 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 flex items-center gap-1.5 font-semibold">
                      <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      Nhiệt độ Bàn In (Heatbed):
                    </span>
                    <span className="font-mono font-bold text-amber-300">{profile.bedTemp}°C</span>
                  </div>
                  <input
                    type="range"
                    min="35"
                    max="110"
                    step="5"
                    value={profile.bedTemp}
                    onChange={(e) => onChangeProfile({ bedTemp: Number(e.target.value) })}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 flex items-center gap-1.5 font-semibold">
                      <Wind className="w-3.5 h-3.5 text-cyan-400" />
                      Tốc độ quạt thổi làm mát (Part Fan):
                    </span>
                    <span className="font-mono font-bold text-cyan-300">{profile.coolingFanSpeed}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={profile.coolingFanSpeed}
                    onChange={(e) => onChangeProfile({ coolingFanSpeed: Number(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* ================= TAB 5: ĐÙN NHỰA & RETRACTION ================= */}
            {activeTab === 'extrusion' && (
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 font-semibold">Hệ Số Dòng Đùn (Flow Ratio):</span>
                    <span className="font-mono font-bold text-teal-300">
                      {(profile.flowRateMm3s || 0.98).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.85"
                    max="1.15"
                    step="0.01"
                    value={profile.flowRateMm3s || 0.98}
                    onChange={(e) => onChangeProfile({ flowRateMm3s: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-white/70 font-semibold">Khoảng cách rút nhựa (Retraction):</span>
                    <span className="font-mono font-bold text-teal-300">
                      {profile.retractionDistanceMm || 0.8} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="6.0"
                    step="0.2"
                    value={profile.retractionDistanceMm || 0.8}
                    onChange={(e) => onChangeProfile({ retractionDistanceMm: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="text-[10px] text-white/40 italic">
                    * 0.8mm cho Direct Drive CoreXY, 4-6mm cho ống Bowden.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/60">Tốc độ rút (mm/s):</span>
                    <input
                      type="number"
                      value={profile.retractionSpeedMmS || 35}
                      onChange={(e) => onChangeProfile({ retractionSpeedMmS: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/60">Nhấc đầu Z-Hop (mm):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={profile.zHopMm || 0.4}
                      onChange={(e) => onChangeProfile({ zHopMm: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

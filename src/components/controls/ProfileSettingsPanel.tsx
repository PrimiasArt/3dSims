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
  Wind,
  Sparkles,
  Key,
  Droplets,
  Box,
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
    { id: 'gyroid', label: 'Gyroid (Chịu lực 3D đẳng hướng)' },
    { id: 'grid', label: 'Grid (Lưới vuông tốc độ cao)' },
    { id: 'honeycomb', label: 'Honeycomb (Tổ ong lục giác)' },
    { id: 'triangles', label: 'Triangles (Khung giàn tam giác)' },
    { id: 'concentric', label: 'Concentric (Đồng tâm đàn hồi)' },
  ];
  const supportModes: { id: SupportType; label: string }[] = [
    { id: 'none', label: 'Tắt' },
    { id: 'tree', label: 'Tree (Cành Cây)' },
    { id: 'normal', label: 'Normal (Trụ)' },
  ];

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: 'Cơ Bản', icon: <Sliders className="w-3 h-3" /> },
    { id: 'quality', label: 'Vách/Vỏ', icon: <Box className="w-3 h-3" /> },
    { id: 'support', label: 'Support', icon: <Shield className="w-3 h-3" /> },
    { id: 'speed', label: 'Tốc Độ', icon: <Gauge className="w-3 h-3" /> },
    { id: 'thermals', label: 'Nhiệt Độ', icon: <Thermometer className="w-3 h-3" /> },
    { id: 'extrusion', label: 'Đùn Nhựa', icon: <Droplets className="w-3 h-3" /> },
  ];

  return (
    <aside
      className={`fixed top-16 left-3 z-20 transition-all duration-300 ${
        isOpen ? 'w-80 md:w-[360px]' : 'w-11'
      }`}
    >
      <div className="rounded-2xl glass-panel border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-148px)]">
        {/* Header / Collapse Toggle */}
        <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            {isOpen && (
              <div className="leading-tight">
                <h3 className="text-[11px] font-extrabold text-white uppercase tracking-wider">
                  Thông Số Cắt Lớp (Process)
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  {profile.material} • {profile.layerHeight}mm • {profile.infillDensity}%
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onToggleOpen}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
            title={isOpen ? 'Thu gọn bảng thông số' : 'Mở bảng thông số cắt lớp'}
          >
            {isOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 6-Tab Navigation Bar (Fixed 6-column alignment - No wrapping bug) */}
        {isOpen && (
          <div className="grid grid-cols-6 border-b border-white/10 bg-black/40 p-1 gap-0.5">
            {tabs.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-400/15 text-teal-300 border border-teal-400/35 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {t.icon}
                  <span className="truncate max-w-full leading-none">{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Scrollable Inspector Body */}
        {isOpen && (
          <div className="p-3.5 space-y-3.5 overflow-y-auto text-xs">
            {/* ================= TAB 1: CƠ BẢN ================= */}
            {activeTab === 'basic' && (
              <>
                {/* 1. Preset Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Cấu hình mẫu (System Preset)</span>
                    </span>
                    <span className="text-[9px] font-mono text-teal-400 uppercase">0.4mm Nozzle</span>
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
                  <p className="text-[10px] text-slate-400 leading-relaxed px-0.5">{profile.description}</p>
                </div>

                {/* 2. Filament Material & Color Swatch */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-teal-400" />
                      <span>Nhựa In (Filament)</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {profile.nozzleTemp}°C / {profile.bedTemp}°C
                    </span>
                  </label>

                  <div className="grid grid-cols-5 gap-1">
                    {materials.map((m) => (
                      <button
                        key={m}
                        onClick={() => onChangeProfile({ material: m })}
                        className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          profile.material === m
                            ? 'bg-teal-400 text-slate-950 font-extrabold shadow-xs'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {/* Color Swatches */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-[10px] text-slate-400 font-medium">Màu cuộn nhựa:</span>
                    <div className="flex items-center gap-1.5">
                      {(MATERIAL_PALETTE[profile.material] || MATERIAL_PALETTE.PLA).map((hex) => (
                        <button
                          key={hex}
                          onClick={() => onChangeProfile({ materialColor: hex })}
                          className={`w-5 h-5 rounded-full transition-all cursor-pointer border ${
                            profile.materialColor === hex
                              ? 'scale-115 border-white ring-2 ring-teal-400/60'
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
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <Layers className="w-3.5 h-3.5 text-teal-400" />
                      Độ dày lớp cắt (Layer Height)
                    </span>
                    <span className="font-mono font-bold text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded border border-teal-500/25">
                      {profile.layerHeight.toFixed(2)} mm
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
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>0.08mm (Siêu mịn)</span>
                    <span>0.20mm (Chuẩn)</span>
                    <span>0.32mm (Draft)</span>
                  </div>
                </div>

                {/* 4. Sparse Infill Density & Pattern */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 font-bold">Mật độ ruột (Sparse Infill)</span>
                    <span className="font-mono font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/25">
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
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="space-y-1 pt-0.5">
                    <label className="text-[10px] text-slate-400">Hoa văn chịu lực bên trong:</label>
                    <select
                      value={profile.infillType}
                      onChange={(e) => onChangeProfile({ infillType: e.target.value as InfillPattern })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-medium text-white cursor-pointer"
                    >
                      {infillTypes.map((t) => (
                        <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 5. Quick Support & Brim */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cấu trúc đỡ (Support)</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('support')}
                      className="text-[10px] text-teal-400 hover:underline cursor-pointer font-semibold"
                    >
                      Chi tiết &gt;
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {supportModes.map((sm) => (
                      <button
                        key={sm.id}
                        onClick={() => onChangeProfile({ supportMode: sm.id })}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          profile.supportMode === sm.id
                            ? 'bg-emerald-400 text-slate-950 font-extrabold shadow-xs'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        {sm.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-200">
                        Vành Bám Bàn (Brim {profile.brimWidthMm || 5}mm)
                      </div>
                      <div className="text-[10px] text-slate-400">Chống cong vênh mép đáy</div>
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
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 font-bold">Số vòng tường (Wall Loops)</span>
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
                  <div className="text-[10px] text-slate-400">
                    2 vòng cho mô hình trưng bày, 4 vòng cho chi tiết chịu tải cơ khí.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 font-bold">Độ dày lớp đầu tiên (First Layer)</span>
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
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-400">Lớp Nóc (Top Shells)</span>
                    <input
                      type="number"
                      min="2"
                      max="8"
                      value={profile.topShellLayers || 4}
                      onChange={(e) => onChangeProfile({ topShellLayers: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-400">Lớp Đáy (Bottom Shells)</span>
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

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300">Vị trí mối nối Z-Seam:</label>
                  <select
                    value={profile.seamPosition || 'aligned'}
                    onChange={(e) => onChangeProfile({ seamPosition: e.target.value as any })}
                    className="w-full px-3 py-1.5 rounded-lg glass-input text-xs font-semibold text-white cursor-pointer"
                  >
                    <option value="aligned" className="bg-slate-900">Aligned (Giấu dọc cạnh sắc)</option>
                    <option value="nearest" className="bg-slate-900">Nearest (Gần nhất - tối ưu tốc độ)</option>
                    <option value="random" className="bg-slate-900">Random (Phân tán ngẫu nhiên)</option>
                  </select>
                </div>
              </div>
            )}

            {/* ================= TAB 3: SUPPORT BAMBU STUDIO ================= */}
            {activeTab === 'support' && (
              <div className="space-y-3">
                {/* Support Engine Architecture Card */}
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-emerald-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Bộ Giải Tree Support Kép</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">
                      Conformal + CLI
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    Hệ thống tự động nạp G-code Tree Support từ <strong>Bambu Studio CLI</strong> hoặc dựng mặt tiếp xúc <strong>Triangle-Conformal</strong> ôm khít 100% biên dạng mô hình.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {onOpenLocalSlicerModal && (
                      <button
                        onClick={onOpenLocalSlicerModal}
                        className="py-1.5 px-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Chạy Bambu CLI</span>
                      </button>
                    )}
                    {onOpenSupportAIModal && (
                      <button
                        onClick={onOpenSupportAIModal}
                        className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 text-teal-300 border border-teal-400/30 font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>AI Tối Ưu Góc</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 1. Support Mode Selection */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Chế độ Support:</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['none', 'tree', 'normal'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onChangeProfile({ supportMode: mode })}
                        className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                          profile.supportMode === mode
                            ? 'bg-emerald-400 text-slate-950 font-extrabold shadow-xs'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        {mode === 'none' ? 'Tắt' : mode === 'tree' ? 'Tree (Auto)' : 'Normal Snug'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Tree Support Style */}
                {profile.supportMode === 'tree' && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <label className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Kiểu nhánh Tree Support:</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'organic', name: 'Tree Organic', desc: 'Mượt, ôm sát vách' },
                        { id: 'slim', name: 'Tree Slim', desc: 'Nhánh mảnh, tiết kiệm' },
                        { id: 'strong', name: 'Tree Strong', desc: 'Thân lớn, chịu lực' },
                        { id: 'hybrid', name: 'Tree Hybrid', desc: 'Kết hợp nhánh + lưới' },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => onChangeProfile({ treeStyle: st.id as any })}
                          className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                            (profile.treeStyle || 'organic') === st.id
                              ? 'bg-teal-500/20 border-teal-400/50 text-white font-bold'
                              : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="text-[11px] font-bold text-teal-300">{st.name}</div>
                          <div className="text-[9px] text-slate-400">{st.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Overhang Angle & Z-Distance */}
                {profile.supportMode !== 'none' && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-300 font-bold">Ngưỡng góc đổ (Threshold Angle)</span>
                        <span className="font-mono font-bold text-amber-300">
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
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-300 font-bold">Khe hở bóc tách (Top Z Distance)</span>
                        <span className="font-mono font-bold text-teal-300">
                          {(profile.supportTopZDistance || 0.2).toFixed(2)} mm
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
                    </div>

                    {profile.supportMode === 'tree' && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400">Đường kính nhánh (mm)</span>
                          <input
                            type="number"
                            step="0.2"
                            min="1.5"
                            max="5.0"
                            value={profile.supportBranchDiameter || 2.8}
                            onChange={(e) => onChangeProfile({ supportBranchDiameter: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400">Góc vươn nhánh (°)</span>
                          <input
                            type="number"
                            step="1"
                            min="25"
                            max="60"
                            value={profile.supportBranchAngle || 42}
                            onChange={(e) => onChangeProfile({ supportBranchAngle: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {onOpenGeminiKeyModal && (
                  <button
                    onClick={onOpenGeminiKeyModal}
                    className="w-full py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/10 text-left transition-all cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 text-slate-300">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>Cấu hình Gemini API Key</span>
                    </div>
                    <span className="text-[10px] text-teal-400 font-bold">Mở &gt;</span>
                  </button>
                )}
              </div>
            )}

            {/* ================= TAB 4: TỐC ĐỘ ================= */}
            {activeTab === 'speed' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <Gauge className="w-3.5 h-3.5 text-teal-400" />
                      Tốc độ in chuẩn (Print Speed)
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
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>50 mm/s (Silent)</span>
                    <span>250 mm/s (Standard)</span>
                    <span>500 mm/s (Ludicrous)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-400">Tường ngoài (mm/s)</span>
                    <input
                      type="number"
                      value={profile.outerWallSpeed || Math.round(profile.printSpeed * 0.6)}
                      onChange={(e) => onChangeProfile({ outerWallSpeed: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-400">Ruột Infill (mm/s)</span>
                    <input
                      type="number"
                      value={profile.infillSpeed || Math.round(profile.printSpeed * 1.1)}
                      onChange={(e) => onChangeProfile({ infillSpeed: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 font-bold">Chạy không tải (Travel Speed)</span>
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

            {/* ================= TAB 5: NHIỆT ĐỘ & LÀM MÁT ================= */}
            {activeTab === 'thermals' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                      Nhiệt độ Đầu phun (Nozzle)
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

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      Nhiệt độ Bàn nhiệt (PEI Bed)
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

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                      <Wind className="w-3.5 h-3.5 text-cyan-400" />
                      Quạt làm mát vật in (Part Fan)
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

            {/* ================= TAB 6: ĐÙN NHỰA & RETRACTION ================= */}
            {activeTab === 'extrusion' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 font-bold">Hệ số dòng đùn (Flow Ratio)</span>
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

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 font-bold">Cự ly rút nhựa (Retraction Length)</span>
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
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-400">Tốc độ rút (mm/s)</span>
                    <input
                      type="number"
                      value={profile.retractionSpeedMmS || 35}
                      onChange={(e) => onChangeProfile({ retractionSpeedMmS: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-bold text-teal-300"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-400">Nhấc đầu Z-Hop (mm)</span>
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
    </aside>
  );
}

import React, { useState } from 'react';
import {
  IconSliders,
  IconCube,
  IconSupport,
  IconVelocity,
  IconThermal,
  IconFlow,
  IconLayers,
  IconTerminal,
  IconAngle,
  IconKeyMinimal,
  IconChevronLeft,
  IconChevronRight,
} from '@/components/icons/MinimalIcons';
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
    { id: 'gyroid', label: 'Gyroid (Đẳng hướng 3D)' },
    { id: 'grid', label: 'Grid (Lưới trực giao)' },
    { id: 'honeycomb', label: 'Honeycomb (Cấu trúc tổ ong)' },
    { id: 'triangles', label: 'Triangles (Khung giàn tam giác)' },
    { id: 'concentric', label: 'Concentric (Biên dạng đồng tâm)' },
  ];
  const supportModes: { id: SupportType; label: string }[] = [
    { id: 'none', label: 'Tắt' },
    { id: 'tree', label: 'Tree (Nhánh)' },
    { id: 'normal', label: 'Normal (Trụ)' },
  ];

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: 'Cơ Bản', icon: <IconSliders size={12} /> },
    { id: 'quality', label: 'Vách/Vỏ', icon: <IconCube size={12} /> },
    { id: 'support', label: 'Support', icon: <IconSupport size={12} /> },
    { id: 'speed', label: 'Tốc Độ', icon: <IconVelocity size={12} /> },
    { id: 'thermals', label: 'Nhiệt Độ', icon: <IconThermal size={12} /> },
    { id: 'extrusion', label: 'Đùn Nhựa', icon: <IconFlow size={12} /> },
  ];

  return (
    <aside
      className={`fixed top-16 left-3 z-20 transition-all duration-300 ${
        isOpen ? 'w-80 md:w-[356px]' : 'w-12'
      }`}
    >
      {!isOpen ? (
        /* Symmetrical Collapsed Vertical Studio Dock */
        <div className="w-12 rounded-2xl glass-panel py-2 px-1.5 flex flex-col items-center gap-1.5">
          <button
            data-testid="toggle-profile-panel-btn"
            onClick={onToggleOpen}
            className="w-8 h-8 rounded-xl studio-gold-badge hover:opacity-90 flex items-center justify-center transition-all cursor-pointer"
            title="Mở bảng thông số cắt lớp (Process)"
          >
            <IconChevronRight size={14} />
          </button>

          <div className="w-5 h-[1px] bg-[var(--border-hairline)] my-0.5" />

          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id);
                  onToggleOpen();
                }}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isActive ? 'studio-pill-active' : 'studio-pill-inactive'
                }`}
                title={`Mở nhanh tab: ${t.label}`}
              >
                {t.icon}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl glass-panel overflow-hidden flex flex-col max-h-[calc(100vh-148px)]">
          {/* Header / Collapse Toggle */}
          <div className="px-3.5 py-2.5 border-b studio-border flex items-center justify-between bg-[var(--bg-subtle)]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg studio-gold-badge flex items-center justify-center shrink-0">
                <IconSliders size={13} />
              </div>
              <div className="leading-tight">
                <h3 className="text-[11px] font-semibold studio-text-primary uppercase tracking-wider">
                  Thông Số Cắt Lớp (Process)
                </h3>
                <p className="text-[10px] studio-text-secondary font-mono">
                  {profile.material} • {profile.layerHeight}mm • {profile.infillDensity}%
                </p>
              </div>
            </div>

            <button
              data-testid="toggle-profile-panel-btn"
              onClick={onToggleOpen}
              className="w-7 h-7 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Thu gọn bảng thông số"
            >
              <IconChevronLeft size={13} />
            </button>
          </div>

          {/* 6-Tab Minimalist Segmented Navigation */}
          <div className="grid grid-cols-6 border-b studio-border bg-[var(--bg-subtle)] p-1 gap-0.5">
            {tabs.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg text-[10px] transition-all cursor-pointer ${
                    isActive
                      ? 'studio-pill-active'
                      : 'studio-pill-inactive font-medium'
                  }`}
                >
                  {t.icon}
                  <span className="truncate max-w-full leading-none">{t.label}</span>
                </button>
              );
            })}
          </div>

        {/* Scrollable Inspector Body */}
        {isOpen && (
          <div className="p-3.5 space-y-3 overflow-y-auto text-xs">
            {/* ================= TAB 1: CƠ BẢN ================= */}
            {activeTab === 'basic' && (
              <>
                {/* 1. Preset Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold studio-text-primary flex items-center justify-between">
                    <span>Cấu hình mẫu (System Preset)</span>
                    <span className="text-[9px] font-mono studio-text-gold uppercase">0.4mm Nozzle</span>
                  </label>
                  <select
                    value={profile.id}
                    onChange={(e) => onApplyPreset(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium cursor-pointer"
                  >
                    {PRESET_PROFILES.map((p) => (
                      <option key={p.id} value={p.id} className="bg-neutral-900 text-neutral-100">
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] studio-text-secondary leading-relaxed px-0.5">{profile.description}</p>
                </div>

                {/* 2. Filament Material & Color Swatch */}
                <div className="p-3 rounded-xl studio-card space-y-2.5">
                  <label className="text-[11px] font-semibold studio-text-primary flex items-center justify-between">
                    <span>Nhựa In (Filament)</span>
                    <span className="text-[10px] font-mono studio-text-secondary">
                      {profile.nozzleTemp}°C / {profile.bedTemp}°C
                    </span>
                  </label>

                  <div className="grid grid-cols-5 gap-1">
                    {materials.map((m) => (
                      <button
                        key={m}
                        onClick={() => onChangeProfile({ material: m })}
                        className={`py-1.5 px-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                          profile.material === m
                            ? 'studio-pill-active'
                            : 'studio-card studio-pill-inactive font-medium'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {/* Color Swatches */}
                  <div className="flex items-center justify-between pt-1.5 border-t studio-border">
                    <span className="text-[10px] studio-text-secondary">Màu sắc phôi:</span>
                    <div className="flex items-center gap-1.5">
                      {(MATERIAL_PALETTE[profile.material] || MATERIAL_PALETTE.PLA).map((hex) => (
                        <button
                          key={hex}
                          onClick={() => onChangeProfile({ materialColor: hex })}
                          className={`w-4.5 h-4.5 rounded-full transition-all cursor-pointer border ${
                            profile.materialColor === hex
                              ? 'scale-115 border-[var(--text-primary)] ring-2 ring-[var(--accent-gold)]'
                              : 'border-black/20 hover:scale-110 opacity-75'
                          }`}
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Layer Height Slider */}
                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary flex items-center gap-1.5 font-semibold">
                      <IconLayers size={12} className="studio-text-gold" />
                      <span>Độ dày lớp cắt (Layer Height)</span>
                    </span>
                    <span className="font-mono font-semibold text-[11px] px-2 py-0.5 rounded studio-gold-badge">
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
                    className="w-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] studio-text-muted font-mono">
                    <span>0.08mm (Fine)</span>
                    <span>0.20mm (Standard)</span>
                    <span>0.32mm (Draft)</span>
                  </div>
                </div>

                {/* 4. Sparse Infill Density & Pattern */}
                <div className="p-3 rounded-xl studio-card space-y-2.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Mật độ ruột (Sparse Infill)</span>
                    <span className="font-mono font-semibold text-[11px] px-2 py-0.5 rounded studio-gold-badge">
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
                    className="w-full cursor-pointer"
                  />
                  <div className="space-y-1 pt-0.5">
                    <label className="text-[10px] studio-text-secondary">Cấu trúc chịu lực bên trong:</label>
                    <select
                      value={profile.infillType}
                      onChange={(e) => onChangeProfile({ infillType: e.target.value as InfillPattern })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-medium cursor-pointer"
                    >
                      {infillTypes.map((t) => (
                        <option key={t.id} value={t.id} className="bg-neutral-900 text-neutral-100">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 5. Quick Support & Brim */}
                <div className="p-3 rounded-xl studio-card space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold studio-text-primary flex items-center gap-1.5">
                      <IconSupport size={12} className="studio-text-gold" />
                      <span>Cấu trúc đỡ (Support)</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('support')}
                      className="text-[10px] studio-text-gold hover:underline cursor-pointer font-medium"
                    >
                      Chi tiết →
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {supportModes.map((sm) => (
                      <button
                        key={sm.id}
                        onClick={() => onChangeProfile({ supportMode: sm.id })}
                        className={`py-1.5 px-2 rounded-lg text-[11px] transition-all cursor-pointer ${
                          profile.supportMode === sm.id
                            ? 'studio-pill-active'
                            : 'studio-card studio-pill-inactive font-medium'
                        }`}
                      >
                        {sm.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t studio-border">
                    <div>
                      <div className="text-[11px] font-medium studio-text-primary">
                        Vành Bám Bàn (Brim {profile.brimWidthMm || 5}mm)
                      </div>
                      <div className="text-[10px] studio-text-secondary">Tăng diện tích tiếp xúc đáy</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.brimEnabled}
                      onChange={(e) => onChangeProfile({ brimEnabled: e.target.checked })}
                      className="w-4 h-4 accent-[var(--accent-gold)] rounded cursor-pointer"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ================= TAB 2: VÁCH & VỎ ================= */}
            {activeTab === 'quality' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Số vòng tường (Wall Loops)</span>
                    <span className="font-mono font-semibold studio-text-gold">{profile.wallLoops} vòng</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={profile.wallLoops}
                    onChange={(e) => onChangeProfile({ wallLoops: Number(e.target.value) })}
                    className="w-full cursor-pointer"
                  />
                  <div className="text-[10px] studio-text-secondary">
                    2 vòng cho mô hình tiêu chuẩn, 4 vòng cho chi tiết cơ khí.
                  </div>
                </div>

                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Độ dày lớp đầu tiên</span>
                    <span className="font-mono font-semibold studio-text-gold">{profile.firstLayerHeight || 0.2} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.12"
                    max="0.28"
                    step="0.02"
                    value={profile.firstLayerHeight || 0.2}
                    onChange={(e) => onChangeProfile({ firstLayerHeight: Number(e.target.value) })}
                    className="w-full cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl studio-card space-y-1">
                    <span className="text-[10px] studio-text-secondary">Lớp Nóc (Top Shells)</span>
                    <input
                      type="number"
                      min="2"
                      max="8"
                      value={profile.topShellLayers || 4}
                      onChange={(e) => onChangeProfile({ topShellLayers: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-semibold"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl studio-card space-y-1">
                    <span className="text-[10px] studio-text-secondary">Lớp Đáy (Bottom Shells)</span>
                    <input
                      type="number"
                      min="2"
                      max="8"
                      value={profile.bottomShellLayers || 3}
                      onChange={(e) => onChangeProfile({ bottomShellLayers: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-semibold"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl studio-card space-y-1.5">
                  <label className="text-[11px] font-semibold studio-text-primary">Vị trí mối nối Z-Seam:</label>
                  <select
                    value={profile.seamPosition || 'aligned'}
                    onChange={(e) => onChangeProfile({ seamPosition: e.target.value as any })}
                    className="w-full px-3 py-1.5 rounded-lg glass-input text-xs font-medium cursor-pointer"
                  >
                    <option value="aligned" className="bg-neutral-900">Aligned (Giấu dọc cạnh sắc)</option>
                    <option value="nearest" className="bg-neutral-900">Nearest (Gần nhất - tối ưu tốc độ)</option>
                    <option value="random" className="bg-neutral-900">Random (Phân tán ngẫu nhiên)</option>
                  </select>
                </div>
              </div>
            )}

            {/* ================= TAB 3: SUPPORT BAMBU STUDIO ================= */}
            {activeTab === 'support' && (
              <div className="space-y-3">
                {/* Support Engine Architecture Card */}
                <div className="p-3 rounded-xl glass-panel-accent space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold studio-text-primary flex items-center gap-1.5">
                      <IconSupport size={13} className="studio-text-gold" />
                      <span>Bộ Giải Tree Support Kép</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded studio-gold-badge">
                      CONFORMAL + CLI
                    </span>
                  </div>
                  <p className="text-[10px] studio-text-secondary leading-relaxed">
                    Tự động nạp G-code từ <strong>Bambu Studio CLI</strong> hoặc dựng mặt tiếp xúc <strong>Triangle-Conformal</strong> ôm sát 100% biên dạng vỏ.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {onOpenLocalSlicerModal && (
                      <button
                        onClick={onOpenLocalSlicerModal}
                        className="py-1.5 px-2 rounded-lg studio-cta-primary font-semibold text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <IconTerminal size={11} />
                        <span>Chạy Bambu CLI</span>
                      </button>
                    )}
                    {onOpenSupportAIModal && (
                      <button
                        onClick={onOpenSupportAIModal}
                        className="py-1.5 px-2 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-primary font-medium text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <IconAngle size={11} className="studio-text-gold" />
                        <span>Tối Ưu Góc Đặt</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 1. Support Mode Selection */}
                <div className="p-3 rounded-xl studio-card space-y-2">
                  <label className="text-[11px] font-semibold studio-text-primary">Chế độ Support:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['none', 'tree', 'normal'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onChangeProfile({ supportMode: mode })}
                        className={`py-1.5 px-1 rounded-lg text-[11px] transition-all cursor-pointer text-center ${
                          profile.supportMode === mode
                            ? 'studio-pill-active'
                            : 'studio-card studio-pill-inactive font-medium'
                        }`}
                      >
                        {mode === 'none' ? 'Tắt' : mode === 'tree' ? 'Tree (Auto)' : 'Normal Snug'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Tree Support Style */}
                {profile.supportMode === 'tree' && (
                  <div className="p-3 rounded-xl studio-card space-y-2">
                    <label className="text-[11px] font-semibold studio-text-primary">Kiểu nhánh Tree Support:</label>
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
                              ? 'studio-gold-badge font-semibold'
                              : 'studio-card studio-pill-inactive'
                          }`}
                        >
                          <div className="text-[11px] font-semibold studio-text-primary">{st.name}</div>
                          <div className="text-[9px] studio-text-secondary">{st.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Overhang Angle & Z-Distance */}
                {profile.supportMode !== 'none' && (
                  <div className="p-3 rounded-xl studio-card space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="studio-text-primary font-semibold">Ngưỡng góc đổ (Threshold)</span>
                        <span className="font-mono font-semibold studio-text-gold">
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
                        className="w-full cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5 pt-2 border-t studio-border">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="studio-text-primary font-semibold">Khe hở bóc tách (Top Z)</span>
                        <span className="font-mono font-semibold studio-text-gold">
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
                        className="w-full cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {onOpenGeminiKeyModal && (
                  <button
                    onClick={onOpenGeminiKeyModal}
                    className="w-full py-2 px-3 rounded-xl studio-card hover:bg-[var(--bg-hover)] text-left transition-all cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 studio-text-secondary">
                      <IconKeyMinimal size={12} className="studio-text-gold" />
                      <span>Cấu hình Gemini API Key</span>
                    </div>
                    <span className="text-[10px] studio-text-gold font-semibold">Mở →</span>
                  </button>
                )}
              </div>
            )}

            {/* ================= TAB 4: TỐC ĐỘ ================= */}
            {activeTab === 'speed' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Tốc độ in chuẩn (Print Speed)</span>
                    <span className="font-mono font-semibold studio-text-gold">{profile.printSpeed} mm/s</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="500"
                    step="10"
                    value={profile.printSpeed}
                    onChange={(e) => onChangeProfile({ printSpeed: Number(e.target.value) })}
                    className="w-full cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl studio-card space-y-1">
                    <span className="text-[10px] studio-text-secondary">Tường ngoài (mm/s)</span>
                    <input
                      type="number"
                      value={profile.outerWallSpeed || Math.round(profile.printSpeed * 0.6)}
                      onChange={(e) => onChangeProfile({ outerWallSpeed: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-semibold"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl studio-card space-y-1">
                    <span className="text-[10px] studio-text-secondary">Ruột Infill (mm/s)</span>
                    <input
                      type="number"
                      value={profile.infillSpeed || Math.round(profile.printSpeed * 1.1)}
                      onChange={(e) => onChangeProfile({ infillSpeed: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-semibold"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Chạy không tải (Travel Speed)</span>
                    <span className="font-mono font-semibold studio-text-gold">{profile.travelSpeed || 500} mm/s</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="700"
                    step="50"
                    value={profile.travelSpeed || 500}
                    onChange={(e) => onChangeProfile({ travelSpeed: Number(e.target.value) })}
                    className="w-full cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* ================= TAB 5: NHIỆT ĐỘ & LÀM MÁT ================= */}
            {activeTab === 'thermals' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Nhiệt độ Đầu phun (Nozzle)</span>
                    <span className="font-mono font-semibold studio-text-gold">{profile.nozzleTemp}°C</span>
                  </div>
                  <input
                    type="range"
                    min="180"
                    max="290"
                    step="5"
                    value={profile.nozzleTemp}
                    onChange={(e) => onChangeProfile({ nozzleTemp: Number(e.target.value) })}
                    className="w-full cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Nhiệt độ Bàn nhiệt (PEI Bed)</span>
                    <span className="font-mono font-semibold studio-text-gold">{profile.bedTemp}°C</span>
                  </div>
                  <input
                    type="range"
                    min="35"
                    max="110"
                    step="5"
                    value={profile.bedTemp}
                    onChange={(e) => onChangeProfile({ bedTemp: Number(e.target.value) })}
                    className="w-full cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Quạt làm mát (Part Fan)</span>
                    <span className="font-mono font-semibold studio-text-gold">{profile.coolingFanSpeed}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={profile.coolingFanSpeed}
                    onChange={(e) => onChangeProfile({ coolingFanSpeed: Number(e.target.value) })}
                    className="w-full cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* ================= TAB 6: ĐÙN NHỰA & RETRACTION ================= */}
            {activeTab === 'extrusion' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Hệ số dòng đùn (Flow Ratio)</span>
                    <span className="font-mono font-semibold studio-text-gold">
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
                    className="w-full cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl studio-card space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="studio-text-primary font-semibold">Cự ly rút nhựa (Retraction)</span>
                    <span className="font-mono font-semibold studio-text-gold">
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
                    className="w-full cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl studio-card space-y-1">
                    <span className="text-[10px] studio-text-secondary">Tốc độ rút (mm/s)</span>
                    <input
                      type="number"
                      value={profile.retractionSpeedMmS || 35}
                      onChange={(e) => onChangeProfile({ retractionSpeedMmS: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-semibold"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl studio-card space-y-1">
                    <span className="text-[10px] studio-text-secondary">Nhấc đầu Z-Hop (mm)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={profile.zHopMm || 0.4}
                      onChange={(e) => onChangeProfile({ zHopMm: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      )}
    </aside>
  );
}

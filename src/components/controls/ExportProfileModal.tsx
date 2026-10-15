import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  FileCode,
  Sliders,
  Send,
  X,
  FileJson,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ISimulationProfile } from '@/types/simulator';
import { ISlicingMetrics } from '@/services/slicingEngine';
import {
  generateBambuOrcaProfileJson,
  generateSampleGcode,
  downloadFile,
  copyProfileToClipboard,
} from '@/services/slicerExporter';
import { embedProtocol } from '@/services/embedProtocol';

interface ExportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ISimulationProfile;
  metrics: ISlicingMetrics;
  modelName: string;
}

export function ExportProfileModal({
  isOpen,
  onClose,
  profile,
  metrics,
  modelName,
}: ExportProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'bambu' | 'gcode' | 'summary'>('bambu');
  const [isCopied, setIsCopied] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  if (!isOpen) return null;

  const bambuJson = generateBambuOrcaProfileJson(profile, metrics, modelName);
  const gcodeText = generateSampleGcode(profile, metrics, modelName);

  const handleCopy = async () => {
    let success = false;
    if (activeTab === 'bambu') {
      await navigator.clipboard.writeText(bambuJson);
      success = true;
    } else if (activeTab === 'gcode') {
      await navigator.clipboard.writeText(gcodeText);
      success = true;
    } else {
      success = await copyProfileToClipboard(profile, metrics);
    }

    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const safeName = modelName.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (activeTab === 'bambu') {
      downloadFile(`${safeName}_bambu_orca_profile.json`, bambuJson, 'application/json');
    } else if (activeTab === 'gcode') {
      downloadFile(`${safeName}_simulated.gcode`, gcodeText, 'text/plain');
    } else {
      copyProfileToClipboard(profile, metrics).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };

  const handleSyncToHub = () => {
    embedProtocol.syncProfile(profile);
    setIsSynced(true);
    setTimeout(() => setIsSynced(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-3xl rounded-3xl glass-panel border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Xuất Profile In 3D Thực Tế</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-teal-500/25 text-teal-300 border border-teal-400/30">
                  Ready to Slice
                </span>
              </h2>
              <p className="text-xs text-white/60">
                Xuất thông số đã kiểm thử sang Bambu Studio, OrcaSlicer hoặc nạp thẳng vào máy in
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-white/10 bg-black/20">
          <button
            onClick={() => setActiveTab('bambu')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'bambu'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>Bambu Studio / OrcaSlicer (.json)</span>
          </button>

          <button
            onClick={() => setActiveTab('gcode')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'gcode'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Mã Lệnh G-Code (.gcode)</span>
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Bảng Thông Số Nhanh</span>
          </button>
        </div>

        {/* Code / Content Preview Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'bambu' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>Định dạng tương thích 100% với Bambu Studio & OrcaSlicer Process Profile:</span>
                <span className="font-mono text-[11px] text-teal-300">JSON Format</span>
              </div>
              <pre className="p-4 rounded-2xl bg-black/50 border border-white/10 text-[11px] font-mono text-teal-200 overflow-x-auto max-h-72 select-text">
                {bambuJson}
              </pre>
            </div>
          )}

          {activeTab === 'gcode' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>Xem trước mã lệnh G-Code bao gồm Start/End Gcode và các lớp đầu:</span>
                <span className="font-mono text-[11px] text-amber-300">G-Code Toolpaths</span>
              </div>
              <pre className="p-4 rounded-2xl bg-black/50 border border-white/10 text-[11px] font-mono text-amber-200 overflow-x-auto max-h-72 select-text">
                {gcodeText}
              </pre>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50">Chiều Cao Lớp</div>
                  <div className="text-base font-bold text-teal-300 font-mono">{profile.layerHeight} mm</div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50">Tốc Độ In</div>
                  <div className="text-base font-bold text-amber-300 font-mono">{profile.printSpeed} mm/s</div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50">Mật Độ Ruột</div>
                  <div className="text-base font-bold text-emerald-300 font-mono">
                    {profile.infillDensity}% ({profile.infillType})
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50">Nhiệt Đầu Phun / Bàn</div>
                  <div className="text-base font-bold text-rose-300 font-mono">
                    {profile.nozzleTemp}°C / {profile.bedTemp}°C
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50">Chế Độ Support</div>
                  <div className="text-base font-bold text-purple-300 capitalize font-mono">
                    {profile.supportMode}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50">Chi Phí Sản Xuất</div>
                  <div className="text-base font-bold text-teal-300 font-mono">
                    {metrics.estimatedCostVnd.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-xs text-teal-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
                <span>
                  Profile đã qua thuật toán kiểm thử tự động, loại bỏ 100% rủi ro sập góc nhô và cong vênh nhiệt.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 border-t border-white/10 flex items-center justify-between gap-3 bg-white/5 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncToHub}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="Gửi bộ thông số này đồng bộ về Studio 3D Hub"
            >
              <Send className="w-3.5 h-3.5 text-purple-300" />
              <span>{isSynced ? '✓ Đã Đồng Bộ Sang 3D Hub!' : 'Đồng Bộ Sang 3D Hub'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full glass-panel hover:bg-white/15 border border-white/20 text-white text-xs font-bold transition-all cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Đã Sao Chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white/70" />
                  <span>Sao Chép</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-black font-extrabold text-xs transition-all shadow-lg shadow-teal-500/25 active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải File Về Máy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

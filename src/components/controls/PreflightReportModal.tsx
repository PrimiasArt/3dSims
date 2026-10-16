import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Wrench,
  Clock,
  Coins,
  Sparkles,
  FileText,
} from 'lucide-react';
import { IPreflightReport, IPreflightError, ISimulationProfile } from '@/types/simulator';
import { triggerAuditGeneration } from '@/services/telemetryService';

interface PreflightReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: IPreflightReport;
  onApplyFix: (action: Partial<ISimulationProfile>) => void;
  onStartSimulation: () => void;
  profile?: ISimulationProfile;
}

export function PreflightReportModal({
  isOpen,
  onClose,
  report,
  onApplyFix,
  onStartSimulation,
  profile,
}: PreflightReportModalProps) {
  const [exportingVault, setExportingVault] = useState<boolean>(false);
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const statusBg =
    report.overallStatus === 'ready'
      ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200'
      : report.overallStatus === 'caution'
      ? 'border-amber-500/50 bg-amber-950/40 text-amber-200'
      : 'border-rose-500/50 bg-rose-950/40 text-rose-200';

  const scoreColor =
    report.printabilityScore >= 85
      ? 'text-emerald-400'
      : report.printabilityScore >= 60
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl glass-panel border border-white/20 p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Báo Cáo Kiểm Lỗi In 3D (Pre-Flight Inspection HUD)
              </h2>
              <p className="text-xs text-white/60">
                Phát hiện sớm nguy cơ sập chi tiết, cong vênh và xung đột nhiệt độ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Status & Score Hero Card */}
        <div className={`p-5 rounded-2xl border ${statusBg} flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">Đánh Giá Tổng Quan:</span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white/20">
                {report.overallStatus === 'ready'
                  ? 'SẴN SÀNG IN THỰC TẾ'
                  : report.overallStatus === 'caution'
                  ? 'CẦN LƯU Ý ĐIỀU CHỈNH'
                  : 'NGUY CƠ IN THẤT BẠI'}
              </span>
            </div>
            <p className="text-xs text-white/90 leading-relaxed font-normal">{report.summary}</p>
          </div>

          <div className="text-center sm:text-right shrink-0">
            <span className="text-[10px] text-white/60 uppercase font-semibold block">Điểm Khả Thi:</span>
            <div className={`text-3xl sm:text-4xl font-black font-mono ${scoreColor}`}>
              {report.printabilityScore}
              <span className="text-sm text-white/40">/100</span>
            </div>
          </div>
        </div>

        {/* Quick Cost & Time Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
            <span className="text-white/50 text-[10px] flex items-center gap-1">
              <Clock className="w-3 h-3 text-teal-400" /> Thời gian in:
            </span>
            <span className="font-mono font-bold text-white block">
              {Math.floor(report.estimatedPrintTimeMinutes / 60)}h{' '}
              {report.estimatedPrintTimeMinutes % 60}m
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
            <span className="text-white/50 text-[10px] flex items-center gap-1">
              <Coins className="w-3 h-3 text-amber-400" /> Chi phí BOM:
            </span>
            <span className="font-mono font-bold text-amber-300 block">
              {report.estimatedCostVnd.toLocaleString('vi-VN')} đ
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
            <span className="text-white/50 text-[10px]">Diện tích đáy bám:</span>
            <span className="font-mono font-bold text-white block">{report.modelFootprintAreaMm2} mm²</span>
          </div>

          <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
            <span className="text-white/50 text-[10px]">Tỷ lệ góc dốc:</span>
            <span className={`font-mono font-bold block ${report.overhangRiskAreaPercent > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {report.overhangRiskAreaPercent}%
            </span>
          </div>
        </div>

        {/* Detailed Issues List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">
            Chi Tiết Các Cảnh Báo &amp; Giải Pháp Sửa Lỗi ({report.errors.length}):
          </h3>

          {report.errors.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Không phát hiện lỗi hình học nào. Mô hình tối ưu hoàn hảo để in!</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {report.errors.map((err) => (
                <div
                  key={err.id}
                  className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          err.severity === 'critical'
                            ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                            : err.severity === 'warning'
                            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                            : 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        {err.severity === 'critical' ? 'Nghiêm Trọng' : err.severity === 'warning' ? 'Cảnh Báo' : 'Lưu Ý'}
                      </span>
                      <h4 className="font-bold text-white text-xs">{err.title}</h4>
                    </div>

                    <span className="text-[11px] font-mono text-rose-400 font-bold shrink-0">
                      -{err.impactScorePenalty} điểm
                    </span>
                  </div>

                  <p className="text-[11px] text-white/70 leading-relaxed">{err.description}</p>

                  <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-[11px] text-teal-200">
                      <strong>Khuyến nghị khắc phục:</strong> {err.suggestedFix}
                    </div>

                    {err.autoFixAction && (
                      <button
                        onClick={() => onApplyFix(err.autoFixAction!)}
                        className="px-3 py-1 rounded-lg bg-teal-400 hover:bg-teal-300 text-black font-extrabold text-[11px] flex items-center gap-1 transition-all active:scale-95 shrink-0 cursor-pointer shadow-sm"
                      >
                        <Wrench className="w-3 h-3 text-black" />
                        <span>Tự Động Sửa Profile</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={async () => {
                setExportingVault(true);
                setVaultMessage(null);
                const res = await triggerAuditGeneration(undefined, profile);
                setExportingVault(false);
                if (res) {
                  setVaultMessage(`✅ Đã lưu Obsidian: ${res.markdown_path.split('\\').pop()}`);
                } else {
                  setVaultMessage('⚠️ Chưa thể kết nối Backend FastAPI (Port 8000)');
                }
              }}
              disabled={exportingVault}
              className="px-3.5 py-2 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              title="Xuất Báo Cáo Kiểm Định sang Obsidian Vault kép (.md & .json)"
            >
              <span>{exportingVault ? '⏳ Đang phân tích AI...' : '📓 Xuất Obsidian Audit'}</span>
            </button>

            <a
              href="http://127.0.0.1:8000/api/v1/nhat-ky"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-xs font-bold transition-all flex items-center gap-1 shadow-sm hover:scale-105"
              title="Xem nhật ký JSON tinh gọn đã khóa (nhat_ky_in.json)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>JSON Nhật Ký</span>
            </a>

            <a
              href="http://127.0.0.1:8000/api/v1/nhat-ky/markdown"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 text-xs font-bold transition-all flex items-center gap-1 shadow-sm hover:scale-105"
              title="Xem nhật ký Markdown tinh gọn đã khóa (nhat_ky_in.md)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>MD Nhật Ký</span>
            </a>

            <a
              href="obsidian://open?path=D%3A%5CCheems%5Cnew%5C3D_Sim_QC%5CObsidianVault%5C02_NhatKy_In%5Cnhat_ky_in.md"
              className="px-3 py-2 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/40 text-xs font-bold transition-all flex items-center gap-1 shadow-sm hover:scale-105"
              title="Mở trực tiếp tệp nhat_ky_in.md trong ứng dụng Obsidian Desktop"
            >
              <span>🔮 Mở Obsidian</span>
            </a>

            {vaultMessage && (
              <span className="text-[11px] font-mono text-teal-300 animate-in fade-in truncate max-w-[240px]">
                {vaultMessage}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Đóng Báo Cáo
            </button>

            <button
              onClick={() => {
                onClose();
                onStartSimulation();
              }}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-black font-extrabold text-xs transition-all shadow-lg active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>Bắt Đầu Giả Lập In Ngay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

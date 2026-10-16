import React, { useState } from 'react';
import { IPreflightReport, ISimulationProfile } from '@/types/simulator';
import { triggerAuditGeneration } from '@/services/telemetryService';
import {
  IconCheckShield,
  IconClose,
  IconSliders,
  IconPlay,
  IconExport,
  IconTerminal,
  IconAngle,
} from '@/components/icons/MinimalIcons';

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

  const statusBorder =
    report.overallStatus === 'ready'
      ? 'border-emerald-500/35 bg-emerald-500/10'
      : report.overallStatus === 'caution'
      ? 'border-[var(--accent-gold-border)] bg-[var(--accent-gold-bg)]'
      : 'border-rose-500/35 bg-rose-500/10';

  const scoreColor =
    report.printabilityScore >= 85
      ? 'text-emerald-400'
      : report.printabilityScore >= 60
      ? 'studio-text-gold'
      : 'text-rose-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl glass-panel p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b studio-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl studio-gold-badge flex items-center justify-center">
              <IconCheckShield size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold studio-text-primary uppercase tracking-wider">
                Báo Cáo Kiểm Định Khả Năng In 3D (Pre-Flight Inspection)
              </h2>
              <p className="text-xs studio-text-secondary">
                Chẩn đoán hình học, góc nghiêng Overhang, độ bám bàn và xung đột nhiệt độ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary transition-all cursor-pointer"
            title="Đóng báo cáo"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Overall Status & Score Hero Card */}
        <div className={`p-4 rounded-xl border ${statusBorder} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider studio-text-secondary">
                Đánh Giá Tổng Quan:
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md studio-gold-badge uppercase tracking-wider">
                {report.overallStatus === 'ready'
                  ? 'ĐẠT CHUẨN IN THỰC TẾ'
                  : report.overallStatus === 'caution'
                  ? 'CẦN TỐI ƯU CẤU HÌNH'
                  : 'NGUY CƠ LỖI CAO'}
              </span>
            </div>
            <p className="text-xs studio-text-primary leading-relaxed">{report.summary}</p>
          </div>

          <div className="text-center sm:text-right shrink-0">
            <span className="text-[10px] studio-text-muted uppercase font-semibold block">
              Điểm An Toàn:
            </span>
            <div className={`text-3xl sm:text-4xl font-black font-mono ${scoreColor}`}>
              {report.printabilityScore}
              <span className="text-sm studio-text-muted">/100</span>
            </div>
          </div>
        </div>

        {/* Quick Cost & Time Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-xl studio-card space-y-1">
            <span className="studio-text-secondary text-[10px] block">Thời gian in ước tính</span>
            <span className="font-mono font-bold studio-text-primary text-sm block">
              {Math.floor(report.estimatedPrintTimeMinutes / 60)}h{' '}
              {report.estimatedPrintTimeMinutes % 60}m
            </span>
          </div>

          <div className="p-3 rounded-xl studio-card space-y-1">
            <span className="studio-text-secondary text-[10px] block">Chi phí vật tư BOM</span>
            <span className="font-mono font-bold studio-text-gold text-sm block">
              {report.estimatedCostVnd.toLocaleString('vi-VN')} đ
            </span>
          </div>

          <div className="p-3 rounded-xl studio-card space-y-1">
            <span className="studio-text-secondary text-[10px] block">Diện tích đáy bám</span>
            <span className="font-mono font-bold studio-text-primary text-sm block">
              {report.modelFootprintAreaMm2} mm²
            </span>
          </div>

          <div className="p-3 rounded-xl studio-card space-y-1">
            <span className="studio-text-secondary text-[10px] block">Tỷ lệ góc dốc Overhang</span>
            <span
              className={`font-mono font-bold text-sm block ${
                report.overhangRiskAreaPercent > 15 ? 'studio-text-gold' : 'text-emerald-400'
              }`}
            >
              {report.overhangRiskAreaPercent}%
            </span>
          </div>
        </div>

        {/* Detailed Issues List */}
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider studio-text-secondary">
            Chi Tiết Các Cảnh Báo &amp; Khuyến Nghị Kỹ Thuật ({report.errors.length})
          </h3>

          {report.errors.length === 0 ? (
            <div className="p-4 rounded-xl studio-card border border-emerald-500/30 text-xs flex items-center gap-2.5">
              <IconCheckShield size={16} className="text-emerald-400 shrink-0" />
              <span className="studio-text-primary">
                Không phát hiện xung đột hình học. Cấu hình hiện tại đã tối ưu để in thực tế.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {report.errors.map((err) => (
                <div
                  key={err.id}
                  className="p-3.5 rounded-xl studio-card space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          err.severity === 'critical'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : err.severity === 'warning'
                            ? 'studio-gold-badge'
                            : 'studio-card studio-text-secondary'
                        }`}
                      >
                        {err.severity === 'critical'
                          ? 'Nghiêm Trọng'
                          : err.severity === 'warning'
                          ? 'Cảnh Báo'
                          : 'Lưu Ý'}
                      </span>
                      <h4 className="font-bold studio-text-primary text-xs">{err.title}</h4>
                    </div>

                    <span className="text-[11px] font-mono text-rose-400 font-bold shrink-0">
                      -{err.impactScorePenalty} điểm
                    </span>
                  </div>

                  <p className="text-[11px] studio-text-secondary leading-relaxed">
                    {err.description}
                  </p>

                  <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)] border studio-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-[11px] studio-text-primary">
                      <strong className="studio-text-gold">Khuyến nghị:</strong> {err.suggestedFix}
                    </div>

                    {err.autoFixAction && (
                      <button
                        onClick={() => onApplyFix(err.autoFixAction!)}
                        className="px-3 py-1.5 rounded-lg studio-cta-primary font-bold text-[11px] flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
                      >
                        <IconSliders size={12} />
                        <span>Tự Động Tối Ưu</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t studio-border">
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={async () => {
                setExportingVault(true);
                setVaultMessage(null);
                const res = await triggerAuditGeneration(undefined, profile);
                setExportingVault(false);
                if (res) {
                  setVaultMessage(`Đã lưu Obsidian: ${res.markdown_path.split('\\').pop()}`);
                } else {
                  setVaultMessage('Chưa kết nối Backend FastAPI (Cổng 8000)');
                }
              }}
              disabled={exportingVault}
              className="px-3 py-1.5 rounded-xl studio-gold-badge hover:opacity-90 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="Xuất Báo Cáo Kiểm Định sang Obsidian Vault (.md & .json)"
            >
              <IconExport size={12} />
              <span>{exportingVault ? 'Đang đồng bộ...' : 'Xuất Obsidian Audit'}</span>
            </button>

            <a
              href="http://127.0.0.1:8000/api/v1/nhat-ky"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-xl studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary text-[11px] font-medium transition-all flex items-center gap-1.5"
              title="Xem nhật ký JSON tinh gọn đã khóa (nhat_ky_in.json)"
            >
              <IconTerminal size={12} className="studio-text-gold" />
              <span>JSON Nhật Ký</span>
            </a>

            <a
              href="http://127.0.0.1:8000/api/v1/nhat-ky/markdown"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-xl studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary text-[11px] font-medium transition-all flex items-center gap-1.5"
              title="Xem nhật ký Markdown tinh gọn đã khóa (nhat_ky_in.md)"
            >
              <IconAngle size={12} className="studio-text-gold" />
              <span>MD Nhật Ký</span>
            </a>

            {vaultMessage && (
              <span className="text-[10px] font-mono studio-text-gold animate-in fade-in truncate max-w-[220px]">
                {vaultMessage}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end w-full sm:w-auto shrink-0">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary text-xs font-semibold transition-all cursor-pointer"
            >
              Đóng
            </button>

            <button
              onClick={() => {
                onClose();
                onStartSimulation();
              }}
              className="px-4 py-2 rounded-xl studio-cta-primary font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <IconPlay size={12} />
              <span>Bắt Đầu Mô Phỏng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

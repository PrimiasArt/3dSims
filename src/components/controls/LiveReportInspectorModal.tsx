import React, { useEffect, useState } from 'react';
import {
  fetchReportParameters,
  fetchAppParameterCatalog,
  ISessionReportParamsResponse,
  IAppParameterCatalogItem,
  getCurrentSessionId,
} from '@/services/telemetryService';
import { ISimulationProfile } from '@/types/simulator';
import {
  IconTerminal,
  IconSliders,
  IconLayers,
  IconReset,
  IconClose,
  IconCheckShield,
  IconExport,
  IconAngle,
} from '@/components/icons/MinimalIcons';

interface LiveReportInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ISimulationProfile;
}

export function LiveReportInspectorModal({
  isOpen,
  onClose,
  currentProfile,
}: LiveReportInspectorModalProps) {
  const [reportData, setReportData] = useState<ISessionReportParamsResponse | null>(null);
  const [catalog, setCatalog] = useState<IAppParameterCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'locked_report' | 'all_app_params' | 'preview_logs'>('locked_report');

  const sessionId = getCurrentSessionId();

  const loadData = async () => {
    setIsLoading(true);
    const [rep, cat] = await Promise.all([
      fetchReportParameters(sessionId),
      fetchAppParameterCatalog(),
    ]);
    setReportData(rep);
    if (cat.length > 0) setCatalog(cat);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const lockedParams = reportData?.extracted_report.locked_report_parameters || {};
  const hasLockedData = Object.keys(lockedParams).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl glass-panel p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto studio-text-primary">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b studio-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl studio-gold-badge flex items-center justify-center">
              <IconTerminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold studio-text-primary tracking-tight">
                  Truy Xuất Tham Số Nhật Ký (Live Telemetry &amp; Report Inspector)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md studio-gold-badge font-semibold">
                  {sessionId}
                </span>
              </div>
              <p className="text-xs studio-text-secondary mt-0.5">
                Truy xuất trực tiếp các giá trị có thể thay đổi và thông số báo cáo đã khóa theo thời gian thực
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl studio-pill-inactive transition-all cursor-pointer disabled:opacity-50"
              title="Làm mới dữ liệu từ Backend"
            >
              <IconReset className={`w-4 h-4 ${isLoading ? 'animate-spin studio-text-gold' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl studio-pill-inactive transition-all cursor-pointer"
              title="Đóng"
            >
              <IconClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b studio-border pb-2.5 flex-wrap">
          <button
            onClick={() => setActiveTab('locked_report')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'locked_report'
                ? 'studio-pill-active shadow-sm'
                : 'studio-pill-inactive'
            }`}
          >
            <IconLayers className="w-3.5 h-3.5" />
            <span>Thông Số Báo Cáo Đã Khóa (Locked Contract)</span>
            {hasLockedData && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md studio-gold-badge font-mono">
                {Object.keys(lockedParams).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('all_app_params')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all_app_params'
                ? 'studio-pill-active shadow-sm'
                : 'studio-pill-inactive'
            }`}
          >
            <IconSliders className="w-3.5 h-3.5" />
            <span>Toàn Bộ Tham Số Của App ({catalog.length || 29})</span>
          </button>

          <button
            onClick={() => setActiveTab('preview_logs')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'preview_logs'
                ? 'studio-pill-active shadow-sm'
                : 'studio-pill-inactive'
            }`}
          >
            <IconTerminal className="w-3.5 h-3.5" />
            <span>Xem Trước Output Tinh Gọn</span>
          </button>
        </div>

        {/* Tab 1: Thông Số Báo Cáo Đã Khóa */}
        {activeTab === 'locked_report' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl studio-card text-xs studio-text-secondary flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <strong className="studio-text-gold">Quy tắc nghiệp vụ:</strong>
                <span>Tham số có số lần đổi ≥ 3 tự động gắn chỉ báo</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded studio-gold-badge font-semibold text-[10px]">
                  <IconAngle className="w-3 h-3" /> Phân vân cao
                </span>
                <span>phản ánh sự tinh chỉnh lặp lại của người dùng.</span>
              </div>
              <div className="text-[11px] font-mono studio-text-muted">
                Tổng biến đổi: <strong className="studio-text-gold">{reportData?.total_events ?? 0}</strong> sự kiện
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'A_do_day_lop', label: 'A (Độ dày lớp)', profileVal: `${currentProfile.layerHeight}mm`, target: 'layerHeight' },
                { key: 'B_canh_do', label: 'B (Cành đỡ)', profileVal: currentProfile.supportMode === 'tree' ? 'Tree' : (currentProfile.supportMode === 'none' ? 'Tắt' : 'Normal'), target: 'supportMode' },
                { key: 'C_do_rong', label: 'C (Độ rỗng)', profileVal: `${currentProfile.infillDensity}%`, target: 'infillDensity' },
                { key: 'D_vanh_bam', label: 'D (Vành bám)', profileVal: currentProfile.brimEnabled ? `Bật ${currentProfile.brimWidthMm}mm` : 'Tắt', target: 'brimEnabled' },
                { key: 'E_nhiet_ban_in', label: 'E (Nhiệt bàn in)', profileVal: `${currentProfile.bedTemp}°C`, target: 'bedTemp' },
                { key: 'F_toc_do_day', label: 'F (Tốc độ lớp đáy)', profileVal: `${currentProfile.printSpeed}mm/s`, target: 'printSpeed' },
              ].map((item) => {
                const recorded = lockedParams[item.key];
                const isChanged = Boolean(recorded);
                const mutCount = recorded ? recorded.so_lan_doi : 1;
                const isWarning = mutCount >= 3;

                return (
                  <div
                    key={item.key}
                    className={`p-3.5 rounded-xl transition-all ${
                      isWarning
                        ? 'studio-gold-badge'
                        : isChanged
                        ? 'studio-card border-[var(--border-accent)]'
                        : 'studio-card opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs studio-text-gold">{item.label}</span>
                        {isWarning && (
                          <span className="inline-flex items-center" title="Phân vân cao (≥ 3 lần đổi)">
                            <IconAngle className="w-3.5 h-3.5 studio-text-gold" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md glass-input studio-text-muted">
                        Mã: {item.key}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between">
                      <div className="text-lg font-black font-mono studio-text-primary">
                        {recorded ? recorded.gia_tri : item.profileVal}
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-bold font-mono ${
                            isWarning ? 'studio-text-gold' : isChanged ? 'studio-text-primary' : 'studio-text-muted'
                          }`}
                        >
                          {recorded
                            ? mutCount === 1
                              ? '1 lần'
                              : `đổi ${mutCount} lần`
                            : 'chưa đổi (1 lần)'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t studio-border text-[10px] studio-text-muted flex items-center justify-between">
                      <span>Giá trị live profile: {item.profileVal}</span>
                      <span className="font-mono studio-text-secondary">{recorded?.chuoi_hien_thi || 'Mặc định'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Toàn bộ tham số có thể thay đổi */}
        {activeTab === 'all_app_params' && (
          <div className="space-y-3">
            <p className="text-xs studio-text-secondary">
              Danh mục tham số cấu hình cắt lớp và giả lập người dùng có thể can thiệp trong hệ thống:
            </p>

            <div className="rounded-xl studio-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b studio-border text-[10px] studio-text-muted uppercase font-semibold">
                    <th className="py-2.5 px-3">Tên Tham Số</th>
                    <th className="py-2.5 px-3">Phân Nhóm</th>
                    <th className="py-2.5 px-3">Giá Trị Hiện Tại</th>
                    <th className="py-2.5 px-3">Mục Tiêu Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-mono text-[11px]">
                  {catalog.map((param) => {
                    const curVal = (currentProfile as unknown as Record<string, unknown>)[param.id];
                    const displayVal =
                      typeof curVal === 'boolean'
                        ? curVal ? 'Bật' : 'Tắt'
                        : curVal !== undefined
                        ? `${curVal}${param.unit ? ' ' + param.unit : ''}`
                        : `${param.default}${param.unit ? ' ' + param.unit : ''}`;

                    return (
                      <tr key={param.id} className="hover:bg-[var(--bg-card)] transition-colors">
                        <td className="py-2 px-3 font-bold studio-text-primary">
                          <div>{param.label}</div>
                          <span className="text-[10px] studio-text-muted font-normal">{param.id}</span>
                        </td>
                        <td className="py-2 px-3 studio-text-secondary font-sans text-xs">{param.category}</td>
                        <td className="py-2 px-3 studio-text-gold font-bold">{displayVal}</td>
                        <td className="py-2 px-3 font-sans">
                          {param.is_report_target ? (
                            <span className="px-2 py-0.5 rounded-md studio-gold-badge text-[10px] font-bold">
                              {param.report_label}
                            </span>
                          ) : (
                            <span className="studio-text-muted text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Xem trước Output Tinh Gọn */}
        {activeTab === 'preview_logs' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* JSON Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold studio-text-gold flex items-center gap-1.5">
                    <IconTerminal className="w-3.5 h-3.5" /> nhat_ky_in.json (Phiên Hiện Tại)
                  </span>
                  <a
                    href="http://127.0.0.1:8000/api/v1/nhat-ky"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] studio-text-secondary hover:underline flex items-center gap-1"
                  >
                    Toàn bộ file <IconExport className="w-3 h-3" />
                  </a>
                </div>
                <pre className="p-3.5 rounded-xl glass-input studio-text-primary font-mono text-[11px] overflow-x-auto max-h-64 select-all">
                  {JSON.stringify(reportData?.preview_entry_json || {}, null, 2)}
                </pre>
              </div>

              {/* Markdown Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold studio-text-gold flex items-center gap-1.5">
                    <IconLayers className="w-3.5 h-3.5" /> nhat_ky_in.md (Render Thời Gian Thực)
                  </span>
                  <a
                    href="http://127.0.0.1:8000/api/v1/nhat-ky/markdown"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] studio-text-secondary hover:underline flex items-center gap-1"
                  >
                    Toàn bộ file <IconExport className="w-3 h-3" />
                  </a>
                </div>
                <pre className="p-3.5 rounded-xl glass-input studio-text-primary font-mono text-[11px] overflow-x-auto max-h-64 whitespace-pre-wrap select-all">
                  {reportData?.preview_markdown || 'Chưa có dữ liệu'}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t studio-border">
          <div className="text-xs studio-text-secondary flex items-center gap-2">
            <IconCheckShield className="w-4 h-4 studio-text-gold" />
            <span>Backend Telemetry: http://127.0.0.1:8000</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl studio-pill-inactive text-xs font-semibold transition-all cursor-pointer"
          >
            Đóng Bảng Truy Xuất
          </button>
        </div>
      </div>
    </div>
  );
}

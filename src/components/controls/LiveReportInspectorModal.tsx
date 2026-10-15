import React, { useEffect, useState } from 'react';
import {
  X,
  Activity,
  Layers,
  Sliders,
  AlertTriangle,
  FileCode,
  FileText,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  fetchReportParameters,
  fetchAppParameterCatalog,
  ISessionReportParamsResponse,
  IAppParameterCatalogItem,
  getCurrentSessionId,
} from '@/services/telemetryService';
import { ISimulationProfile } from '@/types/simulator';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl rounded-3xl glass-panel border border-white/20 p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Truy Xuất Tham Số Nhật Ký (Live Telemetry &amp; Report Inspector)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                  {sessionId}
                </span>
              </div>
              <p className="text-xs text-white/60">
                Truy xuất trực tiếp các giá trị có thể thay đổi và thông số báo cáo đã khóa theo thời gian thực
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Làm mới dữ liệu từ Backend"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab('locked_report')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'locked_report'
                ? 'bg-teal-400 text-black shadow-md'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Thông Số Báo Cáo Đã Khóa (Locked Contract)</span>
            {hasLockedData && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-teal-100">
                {Object.keys(lockedParams).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('all_app_params')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all_app_params'
                ? 'bg-teal-400 text-black shadow-md'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Toàn Bộ Tham Số Có Thể Đổi Của App ({catalog.length || 13})</span>
          </button>

          <button
            onClick={() => setActiveTab('preview_logs')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'preview_logs'
                ? 'bg-teal-400 text-black shadow-md'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Xem Trước Output Tinh Gọn</span>
          </button>
        </div>

        {/* Tab 1: Thông Số Báo Cáo Đã Khóa */}
        {activeTab === 'locked_report' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-teal-950/30 border border-teal-500/30 text-xs text-teal-200 flex items-center justify-between">
              <div>
                <strong>Quy tắc nghiệp vụ:</strong> Tham số có số lần đổi ≥ 3 tự động gắn icon{' '}
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                  ⚠️
                </span>{' '}
                phản ánh sự phân vân của người dùng.
              </div>
              <div className="text-[11px] font-mono text-white/60">
                Tổng biến đổi: {reportData?.total_events ?? 0} sự kiện
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
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isWarning
                        ? 'border-amber-500/50 bg-amber-950/20'
                        : isChanged
                        ? 'border-teal-500/40 bg-black/40'
                        : 'border-white/10 bg-white/5 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-teal-300">{item.label}</span>
                        {isWarning && (
                          <span className="text-xs" title="Phân vân cao (≥ 3 lần đổi)">
                            ⚠️
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                        Mã: {item.key}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between">
                      <div className="text-lg font-black font-mono text-white">
                        {recorded ? recorded.gia_tri : item.profileVal}
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-bold font-mono ${
                            isWarning ? 'text-amber-400' : isChanged ? 'text-teal-400' : 'text-white/40'
                          }`}
                        >
                          {recorded ? (
                            isWarning ? (
                              `đổi ${mutCount} lần ⚠️`
                            ) : mutCount === 1 ? (
                              '1 lần'
                            ) : (
                              `đổi ${mutCount} lần`
                            )
                          ) : (
                            'chưa đổi (1 lần)'
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-white/50 flex items-center justify-between">
                      <span>Giá trị live profile: {item.profileVal}</span>
                      <span className="font-mono">{recorded?.chuoi_hien_thi || 'Mặc định'}</span>
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
            <p className="text-xs text-white/60">
              Danh mục 13+ tham số cấu hình cắt lớp và giả lập người dùng có thể can thiệp trong app:
            </p>

            <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/30">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-[10px] text-white/50 uppercase font-semibold">
                    <th className="py-2.5 px-3">Tên Tham Số</th>
                    <th className="py-2.5 px-3">Phân Nhóm</th>
                    <th className="py-2.5 px-3">Giá Trị Hiện Tại</th>
                    <th className="py-2.5 px-3">Mục Tiêu Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {catalog.map((param) => {
                    const curVal = (currentProfile as any)[param.id];
                    const displayVal =
                      typeof curVal === 'boolean'
                        ? curVal ? 'Bật' : 'Tắt'
                        : curVal !== undefined
                        ? `${curVal}${param.unit ? ' ' + param.unit : ''}`
                        : `${param.default}${param.unit ? ' ' + param.unit : ''}`;

                    return (
                      <tr key={param.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2 px-3 font-bold text-white">
                          <div>{param.label}</div>
                          <span className="text-[10px] text-white/40 font-normal">{param.id}</span>
                        </td>
                        <td className="py-2 px-3 text-white/60 font-sans text-xs">{param.category}</td>
                        <td className="py-2 px-3 text-teal-300 font-bold">{displayVal}</td>
                        <td className="py-2 px-3 font-sans">
                          {param.is_report_target ? (
                            <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-200 border border-teal-500/30 text-[10px] font-bold">
                              {param.report_label}
                            </span>
                          ) : (
                            <span className="text-white/30 text-[10px]">-</span>
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
                  <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4" /> nhat_ky_in.json (Mục Phiên Hiện Tại)
                  </span>
                  <a
                    href="http://127.0.0.1:8000/api/v1/nhat-ky"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-teal-400 hover:underline flex items-center gap-1"
                  >
                    Toàn bộ file <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <pre className="p-3.5 rounded-2xl bg-black/60 border border-white/10 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-64 select-all">
                  {JSON.stringify(reportData?.preview_entry_json || {}, null, 2)}
                </pre>
              </div>

              {/* Markdown Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> nhat_ky_in.md (Render Thời Gian Thực)
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href="obsidian://open?path=D%3A%5CCheems%5Cnew%5C3D_Sim_QC%5CObsidianVault%5Cnhat_ky_in.md"
                      className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/40 hover:bg-purple-500/30 flex items-center gap-1 font-bold"
                      title="Mở trực tiếp tệp nhat_ky_in.md trong Obsidian Desktop"
                    >
                      🔮 Mở Obsidian
                    </a>
                    <a
                      href="http://127.0.0.1:8000/api/v1/nhat-ky/markdown"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      Toàn bộ file <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <pre className="p-3.5 rounded-2xl bg-black/60 border border-white/10 text-cyan-200 font-mono text-[11px] overflow-x-auto max-h-64 whitespace-pre-wrap select-all">
                  {reportData?.preview_markdown || 'Chưa có dữ liệu'}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <div className="text-xs text-white/50 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Backend kết nối: http://127.0.0.1:8000</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Đóng Bảng Truy Xuất
          </button>
        </div>
      </div>
    </div>
  );
}

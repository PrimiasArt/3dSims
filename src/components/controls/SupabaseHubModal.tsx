import React, { useState, useEffect } from 'react';
import {
  fetchSupabaseStatus,
  testSupabaseConnection,
  saveSupabaseConfig,
  triggerSupabaseSync,
  fetchSupabaseSqlSchema,
  ISupabaseHubStatus,
  ISupabaseSyncResult,
} from '@/services/telemetryService';
import {
  IconCheckShield,
  IconTerminal,
  IconReset,
  IconSliders,
  IconLayers,
  IconSupport,
} from '@/components/icons/MinimalIcons';

interface SupabaseHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (connected: boolean) => void;
}

export function SupabaseHubModal({ isOpen, onClose, onStatusChange }: SupabaseHubModalProps) {
  const [activeTab, setActiveTab] = useState<'sync' | 'config' | 'sql'>('sync');
  const [status, setStatus] = useState<ISupabaseHubStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<ISupabaseSyncResult | null>(null);
  const [testResult, setTestResult] = useState<{ connected: boolean; message: string } | null>(null);

  // Form Inputs
  const [urlInput, setUrlInput] = useState<string>('');
  const [keyInput, setKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [autoSyncInput, setAutoSyncInput] = useState<boolean>(false);
  const [sqlSchema, setSqlSchema] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadSql();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    setLoading(true);
    const data = await fetchSupabaseStatus();
    if (data) {
      setStatus(data);
      setUrlInput(data.url || '');
      setAutoSyncInput(data.auto_sync || false);
      if (onStatusChange) {
        onStatusChange(data.configured);
      }
    }
    setLoading(false);
  };

  const loadSql = async () => {
    const sql = await fetchSupabaseSqlSchema();
    if (sql) setSqlSchema(sql);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testSupabaseConnection(urlInput || undefined, keyInput || undefined);
    setTestResult(res);
    setTesting(false);
  };

  const handleSaveConfig = async () => {
    if (!urlInput.trim()) {
      alert('Vui lòng nhập Supabase Project URL!');
      return;
    }
    setLoading(true);
    const updated = await saveSupabaseConfig(urlInput.trim(), keyInput.trim(), autoSyncInput);
    if (updated) {
      setStatus(updated);
      setSaveSuccess(true);
      if (onStatusChange) onStatusChange(updated.configured);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setLoading(false);
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const result = await triggerSupabaseSync();
    if (result) {
      setSyncResult(result);
      await loadStatus();
    }
    setSyncing(false);
  };

  const handleCopySql = () => {
    if (sqlSchema) {
      navigator.clipboard.writeText(sqlSchema);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-testid="supabase-hub-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
    >
      <div className="relative w-full max-w-3xl rounded-2xl glass-panel shadow-2xl flex flex-col max-h-[92vh] overflow-hidden studio-text-primary animate-in zoom-in-95">
        {/* Header - Theo đúng thiết kế chuẩn Architectural Studio */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b studio-border shrink-0 bg-[var(--bg-panel)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl studio-gold-badge flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="studio-text-gold">
                <path
                  d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold studio-text-primary tracking-tight">
                  Supabase Cloud Hub
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold border ${
                    status?.configured
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'studio-gold-badge'
                  }`}
                >
                  {status?.configured ? '● ĐÃ KẾT NỐI CLOUD' : '○ CHƯA THIẾT LẬP'}
                </span>
              </div>
              <p className="text-xs studio-text-secondary mt-0.5">
                Đồng bộ đa nền tảng Nhật ký phiên in &amp; Hồ sơ cấu hình 3D lên Supabase Cloud Database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadStatus}
              disabled={loading}
              className="p-2 rounded-xl studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary transition-all cursor-pointer disabled:opacity-50"
              title="Làm mới trạng thái kết nối"
            >
              <IconReset size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary flex items-center justify-center transition-all cursor-pointer"
              title="Đóng cửa sổ"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation - Đồng bộ 100% phong cách thanh Tabs Studio */}
        <div className="flex items-center px-5 sm:px-6 border-b studio-border gap-2 bg-[var(--bg-subtle)] text-xs shrink-0">
          <button
            onClick={() => setActiveTab('sync')}
            className={`py-2.5 px-3.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sync'
                ? 'border-[var(--accent-gold)] studio-text-gold'
                : 'border-transparent studio-text-secondary hover:studio-text-primary hover:bg-[var(--bg-hover)]'
            }`}
          >
            <span>⚡ Đồng Bộ Dữ Liệu</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-2.5 px-3.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'border-[var(--accent-gold)] studio-text-gold'
                : 'border-transparent studio-text-secondary hover:studio-text-primary hover:bg-[var(--bg-hover)]'
            }`}
          >
            <span>⚙️ Cấu Hình Dự Án</span>
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-2.5 px-3.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sql'
                ? 'border-[var(--accent-gold)] studio-text-gold'
                : 'border-transparent studio-text-secondary hover:studio-text-primary hover:bg-[var(--bg-hover)]'
            }`}
          >
            <span>📜 Khởi Tạo Bảng SQL</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* TAB 1: ĐỒNG BỘ DỮ LIỆU */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              {/* Stat Cards Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl studio-card flex flex-col justify-between">
                  <span className="text-[10px] studio-text-muted font-medium uppercase tracking-wider">
                    Phiên In Cục Bộ (Sessions)
                  </span>
                  <div className="text-2xl font-bold font-mono studio-text-gold mt-1">
                    {status?.local_sessions_count ?? 0}
                  </div>
                  <span className="text-[10px] studio-text-secondary mt-0.5">Sẵn sàng đẩy lên Cloud</span>
                </div>

                <div className="p-4 rounded-xl studio-card flex flex-col justify-between">
                  <span className="text-[10px] studio-text-muted font-medium uppercase tracking-wider">
                    Hồ Sơ Cấu Hình 3D
                  </span>
                  <div className="text-2xl font-bold font-mono studio-text-gold mt-1">
                    {status?.local_profiles_count ?? 0}
                  </div>
                  <span className="text-[10px] studio-text-secondary mt-0.5">Profiles &amp; Điểm QC</span>
                </div>

                <div className="p-4 rounded-xl studio-card flex flex-col justify-between">
                  <span className="text-[10px] studio-text-muted font-medium uppercase tracking-wider">
                    Lần Đồng Bộ Cuối
                  </span>
                  <div className="text-sm font-bold font-mono studio-text-primary mt-1 truncate" title={status?.last_synced_at || 'Chưa đồng bộ'}>
                    {status?.last_synced_at ? new Date(status.last_synced_at).toLocaleTimeString() : 'Chưa có'}
                  </div>
                  <span className="text-[10px] studio-text-secondary mt-0.5">
                    {status?.auto_sync ? 'Tự động: Đang bật' : 'Tự động: Tắt'}
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-3.5 rounded-xl studio-card flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      status?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold studio-text-primary text-xs">
                      {status?.configured ? 'Máy chủ Supabase sẵn sàng tiếp nhận' : 'Cần nhập URL và API Key'}
                    </div>
                    <div className="text-[10px] font-mono studio-text-secondary truncate">
                      {status?.url ? status.url : 'Chưa cấu hình URL'} • Khóa API: {status?.masked_key || 'Chưa có'}
                    </div>
                  </div>
                </div>

                {!status?.configured && (
                  <button
                    onClick={() => setActiveTab('config')}
                    className="px-3 py-1.5 rounded-lg studio-cta-primary text-xs font-semibold cursor-pointer shrink-0"
                  >
                    Thiết lập ngay
                  </button>
                )}
              </div>

              {/* Big 1-Click Sync Button */}
              <div className="pt-1">
                <button
                  data-testid="trigger-supabase-sync-btn"
                  onClick={handleTriggerSync}
                  disabled={syncing || !status?.configured}
                  className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                    status?.configured
                      ? 'studio-cta-primary hover:scale-[1.005] active:scale-98'
                      : 'opacity-50 cursor-not-allowed studio-card text-[var(--text-muted)]'
                  }`}
                >
                  {syncing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Đang nạp dữ liệu lên Supabase Cloud Database...</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="studio-text-gold">
                        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" />
                      </svg>
                      <span>⚡ Đồng Bộ Toàn Bộ Dữ Liệu Ngay (1-Click Sync)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sync Result Banner */}
              {syncResult && (
                <div
                  className={`p-3.5 rounded-xl border animate-in fade-in ${
                    syncResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <div className="font-bold flex items-center gap-2 text-xs">
                    <span>{syncResult.success ? '✓ Đồng bộ hoàn tất thành công!' : '⚠️ Đồng bộ có lỗi xảy ra'}</span>
                    <span className="text-[10px] font-mono studio-text-muted">({syncResult.duration_ms}ms)</span>
                  </div>
                  <div className="text-[11px] mt-1 space-y-0.5 studio-text-secondary">
                    <p>• Phiên in đã cập nhật: <strong className="studio-text-primary">{syncResult.sessions_synced}</strong> bản ghi</p>
                    <p>• Hồ sơ 3D đã cập nhật: <strong className="studio-text-primary">{syncResult.profiles_synced}</strong> bản ghi</p>
                  </div>
                  {syncResult.errors?.length > 0 && (
                    <div className="mt-2 text-[10px] text-rose-300 bg-rose-950/40 p-2 rounded-lg border border-rose-500/20">
                      {syncResult.errors.map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CẤU HÌNH DỰ ÁN */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold studio-text-primary mb-1">
                    Supabase Project URL <span className="studio-text-gold">*</span>
                  </label>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://xyzproject.supabase.co"
                    className="glass-input w-full px-3 py-2 rounded-xl font-mono text-xs studio-text-primary transition-all"
                  />
                  <p className="text-[10px] studio-text-muted mt-1">
                    Lấy tại: Supabase Dashboard → Project Settings → API → Project URL
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold studio-text-primary mb-1">
                    Supabase API Key (Anon hoặc Service Role) <span className="studio-text-gold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={status?.masked_key ? `Đã lưu: ${status.masked_key} (Nhập mới để đổi)` : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'}
                      className="glass-input w-full px-3 py-2 pr-12 rounded-xl font-mono text-xs studio-text-primary transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-2.5 studio-text-muted hover:studio-text-primary text-[10px] font-medium cursor-pointer"
                    >
                      {showKey ? 'ẨN' : 'HIỆN'}
                    </button>
                  </div>
                  <p className="text-[10px] studio-text-muted mt-1">
                    Dùng Service Role Key nếu muốn toàn quyền ghi đè và đồng bộ trọn vẹn dữ liệu.
                  </p>
                </div>

                {/* Auto-sync Switch */}
                <div className="p-3 rounded-xl studio-card">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoSyncInput}
                      onChange={(e) => setAutoSyncInput(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer accent-[var(--accent-gold)]"
                    />
                    <div>
                      <div className="text-xs font-semibold studio-text-primary">
                        Tự động đồng bộ ngầm khi lưu phiên in mới
                      </div>
                      <div className="text-[10px] studio-text-secondary">
                        Hệ thống sẽ tự động gửi dữ liệu lên Supabase mỗi khi bạn tạo hồ sơ hoặc ghi log kiểm định
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2 rounded-xl studio-card hover:bg-[var(--bg-hover)] studio-text-gold border border-[var(--accent-gold-border)] font-semibold text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  {testing ? 'Đang kiểm tra...' : '🔌 Kiểm Tra Kết Nối'}
                </button>

                <button
                  onClick={handleSaveConfig}
                  disabled={loading}
                  className="px-5 py-2 rounded-xl studio-cta-primary font-semibold text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  {loading ? 'Đang lưu...' : '💾 Lưu Cấu Hình'}
                </button>
              </div>

              {/* Feedback banners */}
              {saveSuccess && (
                <div className="p-3 rounded-xl studio-gold-badge text-xs font-medium">
                  ✓ Đã lưu cấu hình kết nối Supabase thành công!
                </div>
              )}

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium ${
                    testResult.connected
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {testResult.connected ? '✓ ' : '✕ '} {testResult.message}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: KHỞI TẠO BẢNG SQL */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold studio-text-primary text-xs">Mã SQL Khởi Tạo Bảng Supabase</h3>
                  <p className="text-[10px] studio-text-muted">
                    Sao chép mã này và dán vào Supabase Studio → SQL Editor để tự động tạo bảng dữ liệu.
                  </p>
                </div>

                <button
                  onClick={handleCopySql}
                  className="px-3.5 py-1.5 rounded-xl studio-gold-badge font-semibold text-xs cursor-pointer flex items-center gap-1.5 transition-all shrink-0 hover:opacity-90"
                >
                  {copiedSql ? '✓ Đã sao chép!' : '📋 Sao Chép SQL'}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl studio-card font-mono text-[11px] studio-text-secondary overflow-x-auto max-h-72 leading-relaxed selection:bg-[var(--accent-gold-bg)] border studio-border">
                  {sqlSchema || 'Đang tải SQL migration script...'}
                </pre>
              </div>

              <div className="p-3.5 rounded-xl studio-gold-badge text-[11px] space-y-1">
                <div className="font-semibold studio-text-gold">💡 Hướng Dẫn Nhanh 2 Bước:</div>
                <p className="studio-text-secondary">1. Nhấp nút <strong>Sao Chép SQL</strong> ở góc trên bên phải.</p>
                <p className="studio-text-secondary">2. Mở trình duyệt vào trang Supabase Project của bạn, chọn tab <strong>SQL Editor</strong>, dán mã và bấm <strong>Run</strong>.</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t studio-border bg-[var(--bg-panel)] shrink-0 text-xs">
          <span className="text-[10px] studio-text-muted font-mono">
            3D PrintSim QC Telemetry Engine • Supabase Connector v1.0
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary font-medium cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

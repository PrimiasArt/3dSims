/**
 * Telemetry Ingestion Client for 3D PrintSim Pro.
 * Communicates with the FastAPI Clean Architecture Backend (port 8000).
 */

const BACKEND_BASE_URL = 'http://127.0.0.1:8000';

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem('printsim_session_id');
    if (existing) return existing;
    const newId = 'session_' + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem('printsim_session_id', newId);
    return newId;
  } catch {
    return 'session_corexy_default';
  }
}

let activeSessionId = getOrCreateSessionId();

export function resetTelemetrySession(modelName?: string): string {
  const newId = 'session_' + (modelName ? modelName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' : '') + Math.random().toString(36).substring(2, 8);
  try {
    sessionStorage.setItem('printsim_session_id', newId);
  } catch {}
  activeSessionId = newId;
  return newId;
}

export function getCurrentSessionId(): string {
  return activeSessionId;
}

/**
 * Gửi sự kiện biến đổi tham số in 3D ngầm về Backend FastAPI (SQLite WAL)
 */
export async function sendTelemetryEvent(
  parameterName: string,
  oldValue: any,
  newValue: any,
  metadata: Record<string, any> = {}
): Promise<void> {
  if (oldValue === newValue) return;

  try {
    await fetch(`${BACKEND_BASE_URL}/api/v1/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeSessionId,
        event_type: 'PARAMETER_CHANGE',
        parameter_name: parameterName,
        old_value: oldValue,
        new_value: newValue,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  } catch (err) {
    // Non-blocking fire-and-forget: Backend offline should never disrupt 3D simulation
    console.debug('[Telemetry Client] Không thể gửi sự kiện tới Backend:', err);
  }
}

export interface IAuditResponse {
  session_id: string;
  markdown_path: string;
  json_path: string;
  high_churn_parameters: string[];
  total_events: number;
  created_at: string;
}

/**
 * Kích hoạt sinh báo cáo kép Obsidian Vault (.md & .json) kèm phân tích AI Gemini
 */
export async function triggerAuditGeneration(
  sessionId?: string,
  profile?: any
): Promise<IAuditResponse | null> {
  const targetId = sessionId || activeSessionId;
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/sessions/${encodeURIComponent(targetId)}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profile || null }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi khi tạo Audit Report:', err);
    return null;
  }
}

export interface ILockedReportParam {
  key: string;
  nhan: string;
  gia_tri: string;
  so_lan_doi: number;
  canh_bao: boolean;
  chuoi_hien_thi: string;
}

export interface IProfile3DSummary {
  profile_id: string;
  model_name: string;
  material: string;
  status: string;
  printability_score: number;
  layer_height_mm: number;
  infill_percent: number;
  bed_temp_c: number;
  nozzle_temp_c: number;
  speed_mms: number;
  markdown_path: string;
}

export interface ISessionReportParamsResponse {
  session_id: string;
  total_events: number;
  extracted_report: {
    locked_report_parameters: Record<string, ILockedReportParam>;
    all_changed_parameters: Record<string, any>;
    total_changed_parameters: number;
    high_churn_count: number;
  };
  preview_entry_json: Record<string, any>;
  preview_markdown: string;
  profile_3d?: IProfile3DSummary;
  profile_3d_markdown?: string;
  physics_sanity_check?: any;
}

/**
 * Truy xuất chính xác các thông số cần report của phiên in hiện tại (Live Query)
 */
export async function fetchReportParameters(sessionId?: string): Promise<ISessionReportParamsResponse | null> {
  const targetId = sessionId || activeSessionId;
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/sessions/${encodeURIComponent(targetId)}/report-params`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi khi truy xuất thông số report:', err);
    return null;
  }
}

/**
 * Truy xuất Hồ Sơ In 3D (3D Print Profile) theo phiên in
 */
export async function fetchProfile3D(sessionId?: string): Promise<{ status: string; session_id: string; profile_path: string; markdown: string } | null> {
  const targetId = sessionId || activeSessionId;
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/sessions/${encodeURIComponent(targetId)}/profile-3d`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi khi truy xuất profile 3D:', err);
    return null;
  }
}

export interface IAppParameterCatalogItem {
  id: string;
  category: string;
  label: string;
  min?: number;
  max?: number;
  default: any;
  unit: string;
  report_key: string | null;
  report_label: string;
  is_report_target: boolean;
  options?: any[];
}

export const DEFAULT_APP_PARAMETER_CATALOG: IAppParameterCatalogItem[] = [
  // Tab 1: Cơ Bản
  { id: 'preset', category: 'Cơ Bản', label: 'Cấu hình in mẫu (Preset)', default: 'Standard', unit: '', report_key: null, report_label: 'Cấu hình mẫu', is_report_target: false },
  { id: 'material', category: 'Cơ Bản', label: 'Chất liệu nhựa (Material)', default: 'PLA', unit: '', report_key: null, report_label: 'Chất liệu nhựa', is_report_target: false },
  { id: 'materialColor', category: 'Cơ Bản', label: 'Màu sắc nhựa (Color)', default: '#ea580c', unit: '', report_key: null, report_label: 'Màu sắc', is_report_target: false },
  { id: 'layerHeight', category: 'Cơ Bản', label: 'Độ dày lớp in (Layer Height)', default: 0.20, unit: 'mm', report_key: 'A_do_day_lop', report_label: 'A (Độ dày lớp)', is_report_target: true },
  { id: 'infillDensity', category: 'Cơ Bản', label: 'Độ rỗng bên trong (Infill)', default: 15, unit: '%', report_key: 'C_do_rong', report_label: 'C (Độ rỗng)', is_report_target: true },
  { id: 'infillType', category: 'Cơ Bản', label: 'Kiểu hoa văn ruột', default: 'Gyroid', unit: '', report_key: null, report_label: 'Hoa văn ruột', is_report_target: false },
  { id: 'supportMode', category: 'Cơ Bản', label: 'Cấu trúc đỡ (Support Mode)', default: 'tree', unit: '', report_key: 'B_canh_do', report_label: 'B (Cành đỡ)', is_report_target: true },
  { id: 'brimEnabled', category: 'Cơ Bản', label: 'Vành bám bàn in (Brim)', default: false, unit: '', report_key: 'D_vanh_bam', report_label: 'D (Vành bám)', is_report_target: true },

  // Tab 2: Vách & Vỏ
  { id: 'wallLoops', category: 'Vách & Vỏ', label: 'Số vòng tường ngoài (Wall Loops)', default: 2, unit: 'vòng', report_key: null, report_label: 'Vòng tường', is_report_target: false },
  { id: 'firstLayerHeight', category: 'Vách & Vỏ', label: 'Chiều cao lớp đầu tiên', default: 0.20, unit: 'mm', report_key: null, report_label: 'Lớp đầu tiên', is_report_target: false },
  { id: 'topShellLayers', category: 'Vách & Vỏ', label: 'Lớp nóc (Top Shells)', default: 4, unit: 'lớp', report_key: null, report_label: 'Lớp nóc', is_report_target: false },
  { id: 'bottomShellLayers', category: 'Vách & Vỏ', label: 'Lớp đáy (Bottom Shells)', default: 3, unit: 'lớp', report_key: null, report_label: 'Lớp đáy', is_report_target: false },
  { id: 'seamPosition', category: 'Vách & Vỏ', label: 'Vị trí giấu đường nối (Seam)', default: 'aligned', unit: '', report_key: null, report_label: 'Đường nối', is_report_target: false },

  // Tab 3: Support
  { id: 'treeStyle', category: 'Support', label: 'Kiểu dáng Tree Support', default: 'organic', unit: '', report_key: 'B_canh_do', report_label: 'B (Cành đỡ)', is_report_target: true },
  { id: 'supportAngleThreshold', category: 'Support', label: 'Ngưỡng góc nghiêng (Overhang Angle)', default: 45, unit: '°', report_key: null, report_label: 'Ngưỡng góc', is_report_target: false },
  { id: 'supportTopZDistance', category: 'Support', label: 'Khe hở bóc tách (Top Z Distance)', default: 0.20, unit: 'mm', report_key: null, report_label: 'Khe hở bóc tách', is_report_target: false },
  { id: 'supportBranchDiameter', category: 'Support', label: 'Đường kính cành (Branch Diameter)', default: 2.8, unit: 'mm', report_key: null, report_label: 'Đường kính cành', is_report_target: false },
  { id: 'supportBranchAngle', category: 'Support', label: 'Góc vươn cành (Branch Angle)', default: 42, unit: '°', report_key: null, report_label: 'Góc vươn cành', is_report_target: false },
  { id: 'brimWidthMm', category: 'Support', label: 'Bề rộng vành Brim', default: 5, unit: 'mm', report_key: 'D_vanh_bam', report_label: 'D (Vành bám)', is_report_target: true },

  // Tab 4: Tốc Độ
  { id: 'printSpeed', category: 'Tốc Độ', label: 'Tốc độ in tổng thể', default: 250, unit: 'mm/s', report_key: 'F_toc_do_day', report_label: 'F (Tốc độ lớp đáy)', is_report_target: true },
  { id: 'outerWallSpeed', category: 'Tốc Độ', label: 'Tốc độ vách ngoài (Outer Wall)', default: 150, unit: 'mm/s', report_key: null, report_label: 'Tốc độ vách', is_report_target: false },
  { id: 'infillSpeed', category: 'Tốc Độ', label: 'Tốc độ ruột (Infill Speed)', default: 275, unit: 'mm/s', report_key: null, report_label: 'Tốc độ ruột', is_report_target: false },
  { id: 'travelSpeed', category: 'Tốc Độ', label: 'Tốc độ chạy không tải (Travel Move)', default: 500, unit: 'mm/s', report_key: null, report_label: 'Tốc độ không tải', is_report_target: false },

  // Tab 5: Nhiệt Độ
  { id: 'nozzleTemp', category: 'Nhiệt Độ', label: 'Nhiệt độ Đầu Phun (Nozzle)', default: 220, unit: '°C', report_key: null, report_label: 'Nhiệt độ đầu phun', is_report_target: false },
  { id: 'bedTemp', category: 'Nhiệt Độ', label: 'Nhiệt độ Bàn In (Heatbed)', default: 55, unit: '°C', report_key: 'E_nhiet_ban_in', report_label: 'E (Nhiệt bàn in)', is_report_target: true },
  { id: 'coolingFanSpeed', category: 'Nhiệt Độ', label: 'Tốc độ quạt thổi làm mát (Part Fan)', default: 100, unit: '%', report_key: null, report_label: 'Quạt làm mát', is_report_target: false },

  // Tab 6: Đùn Nhựa
  { id: 'flowRateMm3s', category: 'Đùn Nhựa', label: 'Hệ số dòng đùn (Flow Ratio)', default: 0.98, unit: '', report_key: null, report_label: 'Hệ số dòng', is_report_target: false },
  { id: 'retractionDistanceMm', category: 'Đùn Nhựa', label: 'Khoảng cách rút nhựa (Retraction)', default: 0.8, unit: 'mm', report_key: null, report_label: 'Khoảng cách rút', is_report_target: false },
  { id: 'retractionSpeedMmS', category: 'Đùn Nhựa', label: 'Tốc độ rút (Retraction Speed)', default: 35, unit: 'mm/s', report_key: null, report_label: 'Tốc độ rút', is_report_target: false },
  { id: 'zHopMm', category: 'Đùn Nhựa', label: 'Nhấc đầu Z-Hop', default: 0.4, unit: 'mm', report_key: null, report_label: 'Nhấc đầu Z', is_report_target: false },
];

/**
 * Truy xuất danh mục toàn bộ các thông số có thể thay đổi của app
 */
export async function fetchAppParameterCatalog(): Promise<IAppParameterCatalogItem[]> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/inspect-parameters`);
    if (!res.ok) return DEFAULT_APP_PARAMETER_CATALOG;
    const data = await res.json();
    return data.parameters && data.parameters.length > 0 ? data.parameters : DEFAULT_APP_PARAMETER_CATALOG;
  } catch (err) {
    console.debug('[Telemetry Client] Dùng danh mục tham số mặc định:', err);
    return DEFAULT_APP_PARAMETER_CATALOG;
  }
}

/**
 * Đồng bộ toàn bộ thông số từ bản ghi Nhật Ký Mô Phỏng sang Backend Telemetry SQLite
 */
export async function syncSimulationLogToTelemetry(
  profileSnapshot: any,
  runNumber: number,
  triggerLabel: string,
  modelName: string
): Promise<void> {
  const p = profileSnapshot;
  if (!p) return;
  const meta = { runNumber, trigger: triggerLabel, modelName };
  try {
    await Promise.all([
      sendTelemetryEvent('layerHeight', null, p.layerHeight, meta),
      sendTelemetryEvent('supportMode', null, p.supportMode, meta),
      sendTelemetryEvent('infillDensity', null, p.infillDensity, meta),
      sendTelemetryEvent('brimEnabled', null, p.brimEnabled, meta),
      sendTelemetryEvent('bedTemp', null, p.bedTemp, meta),
      sendTelemetryEvent('printSpeed', null, p.printSpeed, meta),
      sendTelemetryEvent('nozzleTemp', null, p.nozzleTemp, meta),
      sendTelemetryEvent('material', null, p.material, meta),
    ]);
  } catch (err) {
    console.debug('[Telemetry Client] Sync simulation log skipped:', err);
  }
}

export interface ISaveVaultResult {
  success: boolean;
  message: string;
  jsonPath?: string;
  markdownPath?: string;
  phieuPath?: string;
}

/**
 * Lưu hoặc cập nhật phiên in vào Obsidian Vault (.md) và nhat_ky_in.json thông qua Backend FastAPI
 */
export async function saveSessionToVault(sessionData: any): Promise<ISaveVaultResult> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/nhat-ky/save-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: sessionData, append_mode: true }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      success: true,
      message: data.message || 'Đã lưu thành công vào Obsidian Vault & JsonLogs!',
      jsonPath: data.json_path,
      markdownPath: data.markdown_path,
      phieuPath: data.phieu_path,
    };
  } catch (err) {
    console.debug('[Telemetry Client] Không kết nối được Backend Vault:', err);
    return {
      success: false,
      message: 'Không kết nối được Backend FastAPI (Cổng 8000). Đã chuyển sang chế độ tải trực tiếp tệp.',
    };
  }
}

export interface IPhysicsIssue {
  code: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: string;
  title: string;
  description: string;
  suggested_action: string;
  conflicting_parameters: string[];
  risk_penalty: number;
}

export interface IPhysicsSanityResult {
  qc_risk_score: number;
  qc_health_score: number;
  status: 'OPTIMAL' | 'ACCEPTABLE' | 'CAUTION' | 'CRITICAL_HAZARD';
  status_label: string;
  material: string;
  max_volumetric_flow_rate: number;
  estimated_volumetric_flow_rate: number;
  flow_headroom_percent: number;
  issues: IPhysicsIssue[];
  passed_checks: string[];
  summary: string;
}

/**
 * Gửi yêu cầu kiểm tra toàn diện các quy tắc vật lý FDM tới Backend
 */
export async function checkPhysicsSanity(profile: any, sessionId?: string): Promise<IPhysicsSanityResult | null> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/physics/sanity-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, session_id: sessionId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.debug('[Telemetry Client] Physics sanity check unavailable:', err);
    return null;
  }
}

/**
 * Tải về cấu hình preset Slicer thật (OrcaSlicer, Bambu Studio, PrusaSlicer)
 */
export async function downloadSlicerPreset(sessionId: string, format: 'orcaslicer' | 'bambulab' | 'prusaslicer' | 'cura'): Promise<boolean> {
  try {
    const url = `${BACKEND_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/export-slicer?format=${format}&download=true`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `${format}_profile_${sessionId}.${format === 'prusaslicer' ? 'ini' : 'json'}`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi tải preset Slicer:', err);
    return false;
  }
}

/**
 * Tải về tệp bảng tính Excel (.xlsx) chứa toàn bộ ma trận 23 tham số và danh sách phiên in
 */
export async function downloadNhatKyExcel(): Promise<boolean> {
  try {
    const url = `${BACKEND_BASE_URL}/api/v1/nhat-ky/export/excel`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'Nhat_Ky_In_3D_Sim_QC.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi tải file Excel:', err);
    return false;
  }
}

/**
 * Tải về tệp CSV (UTF-8 with BOM) chứa ma trận 23 tham số và nhật ký in
 */
export async function downloadNhatKyCsv(): Promise<boolean> {
  try {
    const url = `${BACKEND_BASE_URL}/api/v1/nhat-ky/export/csv`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'Nhat_Ky_In_3D_Sim_QC.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi tải file CSV:', err);
    return false;
  }
}

/**
 * So sánh đối chiếu toàn diện giữa 2 phiên in
 */
export async function compareSessions(baseId: string, targetId: string): Promise<any | null> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/sessions/compare?base_id=${encodeURIComponent(baseId)}&target_id=${encodeURIComponent(targetId)}&save_report=true`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi so sánh phiên in:', err);
    return null;
  }
}

/**
 * Tải lên thumbnail 3D đính kèm vào Obsidian Vault Profile
 */
export async function uploadSessionThumbnail(sessionId: string, imageBase64: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64 }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi upload thumbnail:', err);
    return false;
  }
}



// ==============================================================================
// ⚡ SUPABASE CLOUD HUB CLIENT API
// ==============================================================================

export interface ISupabaseHubStatus {
  configured: boolean;
  url: string;
  masked_key: string;
  auto_sync: boolean;
  last_synced_at: string | null;
  last_sync_result: any | null;
  local_sessions_count: number;
  local_profiles_count: number;
}

export interface ISupabaseTestResult {
  connected: boolean;
  message: string;
  url?: string;
  status_code?: number;
}

export interface ISupabaseSyncResult {
  success: boolean;
  sessions_synced: number;
  profiles_synced: number;
  duration_ms: number;
  timestamp: string;
  message: string;
  errors: string[];
}

export async function fetchSupabaseStatus(): Promise<ISupabaseHubStatus | null> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/supabase/status`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi lấy trạng thái Supabase Hub:', err);
    return null;
  }
}

export async function testSupabaseConnection(url?: string, key?: string): Promise<ISupabaseTestResult> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/supabase/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url || undefined, key: key || undefined }),
    });
    return await res.json();
  } catch (err) {
    return { connected: false, message: `Lỗi kết nối máy chủ: ${err}` };
  }
}

export async function saveSupabaseConfig(url: string, key: string, autoSync: boolean): Promise<ISupabaseHubStatus | null> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/supabase/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key, auto_sync: autoSync }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi lưu cấu hình Supabase:', err);
    return null;
  }
}

export async function triggerSupabaseSync(): Promise<ISupabaseSyncResult | null> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/supabase/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi kích hoạt đồng bộ Supabase:', err);
    return null;
  }
}

export const DEFAULT_SUPABASE_SQL_MIGRATION = `-- ==============================================================================
-- 🚀 SUPABASE CLOUD HUB: 3D PRINTSIM TELEMETRY & QC PROFILES SCHEMA
-- Hướng dẫn: Mở Supabase Studio -> SQL Editor -> Dán toàn bộ đoạn mã này và bấm Run.
-- ==============================================================================

-- 1. BẢNG NHẬT KÝ PHIÊN IN & TELEMETRY CẢM BIẾN (print_sessions)
CREATE TABLE IF NOT EXISTS public.print_sessions (
    id TEXT PRIMARY KEY,
    session_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TEXT,
    status TEXT DEFAULT 'COMPLETED',
    user_name TEXT,
    model_name TEXT,
    material TEXT,
    layer_height NUMERIC,
    infill_density NUMERIC,
    print_speed NUMERIC,
    flow_ratio NUMERIC,
    retraction_mm NUMERIC,
    nozzle_temp NUMERIC,
    bed_temp NUMERIC,
    score NUMERIC DEFAULT 100,
    notes TEXT,
    telemetry_json JSONB,
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- 2. BẢNG HỒ SƠ CẤU HÌNH IN 3D & KIỂM ĐỊNH QC (profiles_3d)
CREATE TABLE IF NOT EXISTS public.profiles_3d (
    id TEXT PRIMARY KEY,
    profile_code TEXT,
    name TEXT,
    material TEXT,
    qc_score NUMERIC DEFAULT 100,
    layer_height NUMERIC,
    infill_density NUMERIC,
    print_speed NUMERIC,
    nozzle_temp NUMERIC,
    bed_temp NUMERIC,
    locked_contract JSONB,
    slicer_settings JSONB,
    markdown_content TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CHÍNH SÁCH BẢO MẬT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.print_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_3d ENABLE ROW LEVEL SECURITY;

-- Cho phép cả Anon Key (Client) và Service Role Key đọc/ghi dữ liệu
DROP POLICY IF EXISTS "Public Full Access on print_sessions" ON public.print_sessions;
CREATE POLICY "Public Full Access on print_sessions" ON public.print_sessions
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access on profiles_3d" ON public.profiles_3d;
CREATE POLICY "Public Full Access on profiles_3d" ON public.profiles_3d
    FOR ALL USING (true) WITH CHECK (true);

-- 4. TẠO INDEX TĂNG TỐC ĐỘ TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_print_sessions_status ON public.print_sessions(status);
CREATE INDEX IF NOT EXISTS idx_print_sessions_synced_at ON public.print_sessions(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_3d_material ON public.profiles_3d(material);
CREATE INDEX IF NOT EXISTS idx_profiles_3d_qc_score ON public.profiles_3d(qc_score DESC);

-- Hoàn tất thiết lập bảng Supabase Cloud Hub!
`;

export async function fetchSupabaseSqlSchema(): Promise<string> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/supabase/sql-schema`);
    if (!res.ok) return DEFAULT_SUPABASE_SQL_MIGRATION;
    const text = await res.text();
    return text.trim() ? text : DEFAULT_SUPABASE_SQL_MIGRATION;
  } catch (err) {
    console.info('[Telemetry Client] Sử dụng mã SQL migration mặc định:', err);
    return DEFAULT_SUPABASE_SQL_MIGRATION;
  }
}


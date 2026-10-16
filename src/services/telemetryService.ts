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

/**
 * Truy xuất danh mục toàn bộ các thông số có thể thay đổi của app
 */
export async function fetchAppParameterCatalog(): Promise<IAppParameterCatalogItem[]> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/v1/inspect-parameters`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.parameters || [];
  } catch (err) {
    console.warn('[Telemetry Client] Lỗi khi tải danh mục tham số:', err);
    return [];
  }
}


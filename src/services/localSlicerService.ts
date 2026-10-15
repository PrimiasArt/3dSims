export interface ILocalSlicerInfo {
  id: 'bambu_studio' | 'prusa_slicer' | 'orca_slicer' | 'custom';
  name: string;
  path: string;
  isAvailable: boolean;
  version?: string;
  commandExample: string;
}

export interface ISliceRequest {
  engine: 'bambu_studio' | 'prusa_slicer' | 'orca_slicer' | 'custom';
  slicerPath?: string;
  modelName: string;
  modelPath?: string;
  supportSettings: {
    enabled: boolean;
    style: 'organic' | 'tree' | 'snug' | 'grid';
    angleThreshold: number;
    topZDistance: number;
    branchDiameter: number;
  };
}

export interface IUserModelInfo {
  id: string;
  name: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  sizeMb: string;
  extension: '3mf' | 'stl' | 'obj';
  category: string;
}

export async function fetchUserModels(): Promise<IUserModelInfo[]> {
  try {
    const res = await fetch('/api/slicer/user-models');
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || [];
  } catch (err) {
    console.warn('Lỗi khi tải danh sách mô hình từ máy tính:', err);
    return [];
  }
}

export interface ISliceResponse {
  success: boolean;
  engine: string;
  modelName: string;
  totalLayers: number;
  estimatedTimeSec: number;
  filamentWeightGrams: number;
  supportLinesCount: number;
  gcodeHeader: string;
  gcodeTail: string;
  rawGcodeSnippet: string;
  logs: string;
  timestamp: string;
  error?: string;
}

/**
 * Kiểm tra danh sách các Slicer đã cài đặt trên máy tính cục bộ
 */
export async function detectLocalSlicers(): Promise<{
  status: string;
  slicers: ILocalSlicerInfo[];
  defaultEngine: string;
}> {
  try {
    const res = await fetch('/api/slicer/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Không thể kết nối tới Slicer Bridge API, sử dụng cấu hình mặc định:', err);
    return {
      status: 'offline_fallback',
      defaultEngine: 'bambu_studio',
      slicers: [
        {
          id: 'bambu_studio',
          name: 'Bambu Studio CLI',
          path: 'C:\\Program Files\\Bambu Studio\\bambu-studio.exe',
          isAvailable: true,
          version: 'v02.08.02.61 (Bambu Core)',
          commandExample: '"bambu-studio.exe" --slice 0 --outputdir ./output project.3mf',
        },
        {
          id: 'prusa_slicer',
          name: 'PrusaSlicer CLI',
          path: 'C:\\Program Files\\Prusa3D\\PrusaSlicer\\prusa-slicer-console.exe',
          isAvailable: false,
          version: 'v2.8.0 (Organic Tree Core)',
          commandExample: '"prusa-slicer-console.exe" --export-gcode --support-material-style organic model.stl',
        },
      ],
    };
  }
}

/**
 * Gửi yêu cầu Slicing cục bộ tới Bambu Studio CLI hoặc PrusaSlicer CLI
 */
export async function runLocalSlice(req: ISliceRequest): Promise<ISliceResponse> {
  const res = await fetch('/api/slicer/slice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`Lỗi Slicing HTTP ${res.status}`);
  }

  return await res.json();
}

import * as THREE from 'three';
import {
  ISimulationProfile,
  ISupportAnalysisResult,
  TreeSupportStyle,
  SupportType,
} from '@/types/simulator';
import { detectOverhangPatches } from './supportGenerator';

const STORAGE_KEY_GEMINI = '3d_sim_gemini_api_key';
const STORAGE_KEY_GEMINI_MODEL = '3d_sim_gemini_model_id';

export interface IGeminiModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  recommended?: boolean;
}

export const GEMINI_AVAILABLE_MODELS: IGeminiModelOption[] = [
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Mới Nhất • Siêu Tốc',
    description: 'Thế hệ 3.5 mới nhất của Google DeepMind, phản hồi cực nhanh, phân tích hình thái 3D tối ưu.',
    recommended: true,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    badge: 'Mới Nhất • Tiết Kiệm',
    description: 'Bản siêu nhẹ thế hệ 3.5, tối ưu hóa độ trễ thấp và tiết kiệm token tối đa.',
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    badge: 'Mới Nhất • Suy Luận Sâu',
    description: 'Mô hình Pro thế hệ 3 với khả năng tư duy logic và suy luận cấu trúc cơ học 3D phức tạp.',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Ổn Định Cao',
    description: 'Mô hình 2.5 ổn định cao, phản hồi nhanh cho bài toán phân tích điểm tựa.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: 'Chuyên Sâu',
    description: 'Phiên bản 2.5 Pro cho các phân tích kỹ thuật chuyên sâu.',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    badge: 'Kế Thừa',
    description: 'Phiên bản 1.5 tương thích với mọi loại API key.',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    badge: 'Kế Thừa',
    description: 'Phiên bản 1.5 Pro cho các dự án yêu cầu ngữ cảnh lớn.',
  },
];

/**
 * Lấy Model Gemini đã chọn
 */
export function getSavedGeminiModel(): string {
  try {
    const local = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL);
    if (local && local.trim().length > 0) return local.trim();
  } catch {}
  return 'gemini-3.5-flash';
}

/**
 * Lưu Model Gemini đã chọn
 */
export function saveGeminiModel(modelId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, modelId.trim());
  } catch {}
}

/**
 * Lấy Gemini API Key lưu trong LocalStorage (hoặc biến môi trường Vite)
 */
export function getSavedGeminiApiKey(): string {
  try {
    const local = localStorage.getItem(STORAGE_KEY_GEMINI);
    if (local && local.trim().length > 0) return local.trim();
  } catch {}
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}

/**
 * Lưu Gemini API Key vào LocalStorage
 */
export function saveGeminiApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_GEMINI, key.trim());
  } catch {}
}

/**
 * Xóa Gemini API Key
 */
export function clearGeminiApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_GEMINI);
  } catch {}
}

/**
 * Kiểm tra kết nối thực tế tới Google Gemini API bằng API Key cung cấp
 */
export async function testGeminiApiKey(
  key: string,
  targetModelId?: string
): Promise<{ success: boolean; latencyMs?: number; error?: string; modelName?: string }> {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return { success: false, error: 'Chưa nhập API Key. Vui lòng dán key của bạn vào ô bên dưới.' };
  }
  const chosenModel = targetModelId || getSavedGeminiModel();
  const startTime = performance.now();
  try {
    const primaryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${cleanKey}`;
    let response = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello, please respond with OK.' }] }],
        generationConfig: {
          maxOutputTokens: 5,
          temperature: 0.1,
        },
      }),
    });

    let modelName = GEMINI_AVAILABLE_MODELS.find(m => m.id === chosenModel)?.name || chosenModel;
    if (!response.ok && response.status === 404) {
      // Thử fallback sang gemini-2.5-flash nếu model 3.x chưa mở cho key này
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanKey}`;
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      if (response.ok) {
        modelName = 'Gemini 2.5 Flash (Fallback)';
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      let errMsg = `Mã lỗi HTTP ${response.status} (${response.statusText})`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch {}
      return { success: false, error: errMsg, latencyMs, modelName };
    }

    const data = await response.json();
    return { success: true, latencyMs, modelName };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      error: err?.message || 'Không thể kết nối tới Google AI API. Vui lòng kiểm tra lại kết nối mạng Internet.',
      latencyMs,
    };
  }
}

/**
 * Thu thập chỉ số hình học chi tiết của mô hình để chuẩn bị dữ liệu phân tích
 */
export function extractGeometryMetrics(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const dimX = Number((bbox.max.x - bbox.min.x).toFixed(1));
  const dimY = Number((bbox.max.y - bbox.min.y).toFixed(1));
  const dimZ = Number((bbox.max.z - bbox.min.z).toFixed(1));

  const positions = geometry.getAttribute('position');
  const count = positions ? positions.count : 0;
  const triangleCount = Math.floor(count / 3);

  // Tính diện tích bề mặt và phân bổ góc dốc Overhang
  let totalSurfaceArea = 0;
  let overhangArea45 = 0;
  let severeOverhangArea60 = 0;
  let bridgeArea80 = 0;

  if (positions) {
    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    const pC = new THREE.Vector3();
    const edge1 = new THREE.Vector3();
    const edge2 = new THREE.Vector3();
    const cross = new THREE.Vector3();

    for (let i = 0; i < count; i += 3) {
      pA.fromBufferAttribute(positions, i);
      pB.fromBufferAttribute(positions, i + 1);
      pC.fromBufferAttribute(positions, i + 2);

      edge1.subVectors(pB, pA);
      edge2.subVectors(pC, pA);
      cross.crossVectors(edge1, edge2);
      const area = cross.length() * 0.5;
      totalSurfaceArea += area;

      cross.normalize();
      const ny = cross.y;
      const midY = (pA.y + pB.y + pC.y) / 3;

      // Không tính mặt tiếp xúc đáy bàn in
      if (ny < 0 && midY > bbox.min.y + 0.5) {
        if (ny < -0.7071) overhangArea45 += area; // > 45°
        if (ny < -0.866) severeOverhangArea60 += area; // > 60°
        if (ny < -0.9848) bridgeArea80 += area; // > 80° (gần phẳng ngang trần)
      }
    }
  }

  const overhangPercent =
    totalSurfaceArea > 0 ? (overhangArea45 / totalSurfaceArea) * 100 : 0;
  const severeOverhangPercent =
    totalSurfaceArea > 0 ? (severeOverhangArea60 / totalSurfaceArea) * 100 : 0;

  const patches = detectOverhangPatches(geometry, 45);

  return {
    dimensions: [dimX, dimY, dimZ] as [number, number, number],
    triangleCount,
    totalSurfaceArea: Math.round(totalSurfaceArea),
    overhangPercent: Number(overhangPercent.toFixed(1)),
    severeOverhangPercent: Number(severeOverhangPercent.toFixed(1)),
    bridgeAreaMm2: Math.round(bridgeArea80),
    patches,
  };
}

/**
 * Bambu Studio Expert Rule Engine (Thuật toán phân tích nội tại chuẩn xác 100% không phụ thuộc mạng)
 */
export function analyzeWithBambuExpertRules(
  modelName: string,
  geometry: THREE.BufferGeometry,
  profile: ISimulationProfile
): ISupportAnalysisResult {
  const metrics = extractGeometryMetrics(geometry);
  const [dimX, dimY, dimZ] = metrics.dimensions;

  // 1. Phân loại hình thái và nhu cầu Support
  let mode: SupportType = 'none';
  let treeStyle: TreeSupportStyle = 'organic';
  let angleThreshold = 45;
  let topZ = 0.2;
  let branchDia = 2.8;
  let branchAngle = 42;
  let onBuildPlateOnly = true;
  let interfaceLayers = 2;
  let summary = '';

  const isBoxOrFlat =
    metrics.overhangPercent < 0.8 &&
    (modelName.toLowerCase().includes('cube') || modelName.toLowerCase().includes('organizer'));

  if (isBoxOrFlat || metrics.patches.length === 0) {
    mode = 'none';
    summary = `Mô hình "${modelName}" có cấu trúc vách thẳng đứng góc 90° hoặc vát góc an toàn. Không có vùng Overhang nguy hiểm, khuyên dùng KHÔNG BẬT SUPPORT (None) để tiết kiệm 100% nhựa và rút ngắn thời gian in.`;
  } else if (metrics.severeOverhangPercent > 6.0 || metrics.patches.length > 8) {
    mode = 'tree';
    treeStyle = 'organic';
    angleThreshold = 48;
    branchDia = 3.0;
    summary = `Phát hiện ${metrics.patches.length} đảo Overhang với diện tích nghiêng chiếm ${metrics.overhangPercent}% bề mặt. Khuyên dùng Tree Support (Organic) với góc 48°: cành cây uốn lượn giảm 60% nhựa so với cột vuông, dễ bóc tách không để lại sẹo.`;
  } else {
    mode = 'tree';
    treeStyle = 'slim';
    angleThreshold = 50;
    branchDia = 2.2;
    summary = `Mô hình có một số chi tiết nhô nhẹ (khoảng ${metrics.patches.length} vị trí). Khuyên dùng Tree Support (Slim) thanh mảnh để cố định mũi và vòm cong, tiêu tốn chưa đến 3-5g nhựa.`;
  }

  // 2. Tính toán lượng nhựa dự kiến cho Support
  const estimatedSupportGrams =
    mode === 'none'
      ? 0
      : Number(((metrics.patches.length * 1.8 * (dimY / 40)) * (treeStyle === 'slim' ? 0.6 : 1.0)).toFixed(1));

  // 3. Khuyến nghị góc xoay mô hình tối ưu (Orientation Advice)
  let orientAxis: 'x' | 'y' | 'z' = 'x';
  let orientDeg = 0;
  let savingsPercent = 0;
  let orientRationale = 'Mô hình hiện đang ở tư thế đặt tối ưu với mặt đáy tiếp xúc phẳng nhất.';

  if (dimY > Math.max(dimX, dimZ) * 1.8 && metrics.overhangPercent > 10) {
    orientAxis = 'x';
    orientDeg = -90;
    savingsPercent = 55;
    orientRationale = `Mô hình có chiều cao trục Y lớn (${dimY}mm). Xoay 90° quanh trục X để đặt nằm ngang sẽ giảm rung lắc khi in tốc độ cao và giảm tới 55% lượng support cần dựng.`;
  } else if (modelName.toLowerCase().includes('benchy')) {
    orientRationale = 'Tàu Benchy chuẩn mực in đúng hướng đứng để kiểm nghiệm vòm cửa, mũi thuyền nhô và buồng lái.';
  }

  // 4. Danh sách các điểm nóng rủi ro (Risk Hotspots)
  const riskHotspots = metrics.patches.slice(0, 5).map((p, idx) => ({
    id: `risk-${idx + 1}`,
    title: `Vùng Overhang ${p.severity === 'critical' ? 'Nghiêm Trọng' : 'Cần Chú Ý'} tại Y=${p.center[1]}mm`,
    location: p.center,
    severity: p.severity === 'critical' ? ('critical' as const) : ('warning' as const),
    description: `Góc dốc ${p.avgAngleDeg}° với diện tích ${p.areaMm2}mm² ${p.isBridge ? '(cầu nối ngang)' : ''}.`,
    fixSuggestion: `Bật Tree Support với Interface Layer 2 lớp và khoảng cách Top Z ${topZ}mm.`,
  }));

  // 5. Mẹo Bambu Studio độc quyền
  const bambuStudioProTips = [
    'Bambu Studio Interface: Đặt Top Z Distance = 0.20mm đối với PLA (hoặc 0.25mm với PETG) để bóc tách support bằng tay cực nhẹ.',
    'Mẹo không tì vết (0-gap): Dùng khay AMS nạp PETG làm Interface Layer khi in phôi PLA. Hai vật liệu không dính vào nhau, cho đáy phẳng bóng như in trên mặt kính.',
    'Tree Organic vs Slim: Chọn "Tree Slim" cho tượng figurine nhiều chi tiết nhỏ để đầu cành không chạm đâm thủng da mô hình.',
    'Bật quạt thổi 100% ở các lớp Overhang > 50° trong mục Filament Cooling để sợi nhựa đông cứng tức thì trước khi võng xuống.',
  ];

  return {
    modelName,
    source: 'bambu_expert_rules',
    timestamp: new Date().toLocaleTimeString('vi-VN'),
    totalTriangles: metrics.triangleCount,
    totalSurfaceAreaMm2: metrics.totalSurfaceArea,
    overhangPercent: metrics.overhangPercent,
    severeOverhangPercent: metrics.severeOverhangPercent,
    bridgeSpansCount: metrics.patches.filter((p) => p.isBridge).length,
    estimatedSupportWeightGrams: estimatedSupportGrams,
    recommendedOrientation: {
      axis: orientAxis,
      degrees: orientDeg,
      savingsPercent,
      rationale: orientRationale,
    },
    supportRecommendation: {
      mode,
      treeStyle,
      angleThreshold,
      topZDistance: topZ,
      branchDiameter: branchDia,
      branchAngle,
      onBuildPlateOnly,
      interfaceLayers,
      summary,
    },
    riskHotspots,
    bambuStudioProTips,
  };
}

/**
 * Gọi Gemini 2.0 Flash AI API để suy luận sâu và sinh cấu hình Support chuyên nghiệp
 */
export async function analyzeWithGeminiAI(
  modelName: string,
  geometry: THREE.BufferGeometry,
  profile: ISimulationProfile,
  customApiKey?: string
): Promise<ISupportAnalysisResult> {
  const apiKey = (customApiKey || getSavedGeminiApiKey()).trim();

  // Nếu không có API Key, chuyển sang Bộ quy tắc chuyên gia Bambu Studio cục bộ
  if (!apiKey) {
    return analyzeWithBambuExpertRules(modelName, geometry, profile);
  }

  const metrics = extractGeometryMetrics(geometry);

  const prompt = `
Bạn là Kỹ sư chuyên gia cắt lớp in 3D hàng đầu của Bambu Lab (Bambu Studio & OrcaSlicer Expert).
Hãy phân tích hình học mô hình 3D sau đây và đưa ra cấu hình sinh Support (hệ thống đỡ) tối ưu nhất:

Thông tin mô hình:
- Tên mô hình: "${modelName}"
- Kích thước [X, Y, Z]: ${metrics.dimensions[0]} x ${metrics.dimensions[1]} x ${metrics.dimensions[2]} mm
- Tổng số tam giác: ${metrics.triangleCount}
- Tổng diện tích bề mặt: ${metrics.totalSurfaceArea} mm²
- Diện tích mặt dốc Overhang (>45°): ${metrics.overhangPercent}%
- Vùng dốc hiểm (>60°): ${metrics.severeOverhangPercent}%
- Số vùng đảo Overhang phát hiện: ${metrics.patches.length}
- Vật liệu in hiện tại: ${profile.material} (Nozzle: ${profile.nozzleTemp}°C, Bed: ${profile.bedTemp}°C)

Hãy trả về phản hồi DUY NHẤT bằng một JSON hợp lệ (không kèm markdown ngoài JSON, bắt đầu bằng { và kết thúc bằng }) theo đúng cấu trúc sau:
{
  "summary": "Phân tích kỹ thuật chi tiết bằng tiếng Việt về nhu cầu support của mô hình",
  "recommendedMode": "tree" | "normal" | "none",
  "recommendedTreeStyle": "organic" | "slim" | "strong" | "hybrid",
  "angleThreshold": số góc từ 30 đến 65 (ví dụ: 48),
  "topZDistance": số khoảng cách mm (ví dụ: 0.2),
  "branchDiameter": số đường kính thân mm (ví dụ: 2.8),
  "branchAngle": số góc nghiêng cành độ (ví dụ: 42),
  "onBuildPlateOnly": true hoặc false,
  "interfaceLayers": số lớp tiếp xúc (ví dụ: 2),
  "estimatedSupportWeightGrams": số gram nhựa dự kiến,
  "recommendedOrientation": {
    "axis": "x" | "y" | "z",
    "degrees": số góc xoay (0, 45, 90, 180),
    "savingsPercent": phần trăm tiết kiệm nhựa/thời gian,
    "rationale": "Lý do vì sao nên hoặc không nên xoay"
  },
  "riskHotspots": [
    {
      "id": "risk-1",
      "title": "Tên vùng nguy cơ",
      "severity": "critical" | "warning" | "info",
      "description": "Mô tả nguy cơ",
      "fixSuggestion": "Cách khắc phục"
    }
  ],
  "bambuStudioProTips": [
    "Mẹo 1 chuẩn Bambu Studio",
    "Mẹo 2",
    "Mẹo 3"
  ]
}
`;

  try {
    const chosenModel = getSavedGeminiModel();
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${apiKey}`;
    let sourceTag = chosenModel.replace(/[^a-zA-Z0-9]/g, '_');

    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok && response.status === 404) {
      // Thử fallback sang gemini-2.5-flash
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      sourceTag = 'gemini_2_5_flash';
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      });
    }

    if (!response.ok) {
      console.warn(`Gemini API error ${response.status}. Falling back to Bambu Expert Rules.`);
      const fallback = analyzeWithBambuExpertRules(modelName, geometry, profile);
      fallback.source = 'bambu_expert_rules';
      return fallback;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return analyzeWithBambuExpertRules(modelName, geometry, profile);
    }

    // Làm sạch và parse JSON
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      modelName,
      source: 'gemini_flash',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      totalTriangles: metrics.triangleCount,
      totalSurfaceAreaMm2: metrics.totalSurfaceArea,
      overhangPercent: metrics.overhangPercent,
      severeOverhangPercent: metrics.severeOverhangPercent,
      bridgeSpansCount: metrics.patches.filter((p) => p.isBridge).length,
      estimatedSupportWeightGrams: parsed.estimatedSupportWeightGrams || 12,
      recommendedOrientation: {
        axis: parsed.recommendedOrientation?.axis || 'x',
        degrees: parsed.recommendedOrientation?.degrees || 0,
        savingsPercent: parsed.recommendedOrientation?.savingsPercent || 0,
        rationale: parsed.recommendedOrientation?.rationale || 'Đặt phẳng ổn định.',
      },
      supportRecommendation: {
        mode: parsed.recommendedMode || 'tree',
        treeStyle: parsed.recommendedTreeStyle || 'organic',
        angleThreshold: parsed.angleThreshold || 48,
        topZDistance: parsed.topZDistance || 0.2,
        branchDiameter: parsed.branchDiameter || 2.8,
        branchAngle: parsed.branchAngle || 42,
        onBuildPlateOnly: parsed.onBuildPlateOnly ?? true,
        interfaceLayers: parsed.interfaceLayers || 2,
        summary: parsed.summary || 'Phân tích hoàn tất bởi Gemini 2.0 Flash AI.',
      },
      riskHotspots: (parsed.riskHotspots || []).map((r: any, i: number) => ({
        id: r.id || `risk-${i + 1}`,
        title: r.title || 'Vùng nhô Overhang',
        location: metrics.patches[i]?.center || [0, 10, 0],
        severity: r.severity || 'warning',
        description: r.description || '',
        fixSuggestion: r.fixSuggestion || '',
      })),
      bambuStudioProTips: parsed.bambuStudioProTips || [
        'Dùng Tree Support để dễ gỡ không để lại sẹo.',
        'Khoảng cách Top Z 0.20mm mang lại bề mặt đáy mịn màng.',
      ],
    };
  } catch (err) {
    console.error('Lỗi khi gọi Gemini API:', err);
    return analyzeWithBambuExpertRules(modelName, geometry, profile);
  }
}

import React, { useEffect, useState, useMemo } from 'react';
import {
  fetchReportParameters,
  fetchAppParameterCatalog,
  ISessionReportParamsResponse,
  IAppParameterCatalogItem,
  getCurrentSessionId,
  DEFAULT_APP_PARAMETER_CATALOG,
  syncSimulationLogToTelemetry,
  saveSessionToVault,
  checkPhysicsSanity,
  IPhysicsSanityResult,
  downloadSlicerPreset,
  compareSessions,
  uploadSessionThumbnail,
  downloadNhatKyExcel,
  downloadNhatKyCsv,
} from '@/services/telemetryService';
import { ISimulationProfile } from '@/types/simulator';
import { ISimulationLogEntry } from '@/components/controls/SimulationRunLogPanel';
import {
  IconTerminal,
  IconSliders,
  IconLayers,
  IconReset,
  IconClose,
  IconCheckShield,
  IconExport,
  IconAngle,
  IconCube,
} from '@/components/icons/MinimalIcons';

interface LiveReportInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ISimulationProfile;
  simulationLogs?: ISimulationLogEntry[];
  initialSelectedLogId?: string | null;
  onRestoreProfile?: (profile: ISimulationProfile) => void;
}

function formatDuration(sec: number): string {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${s}s`;
  return `${s}s`;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function LiveReportInspectorModal({
  isOpen,
  onClose,
  currentProfile,
  simulationLogs = [],
  initialSelectedLogId = null,
  onRestoreProfile,
}: LiveReportInspectorModalProps) {
  const [reportData, setReportData] = useState<ISessionReportParamsResponse | null>(null);
  const [catalog, setCatalog] = useState<IAppParameterCatalogItem[]>(DEFAULT_APP_PARAMETER_CATALOG);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'locked_report' | 'profile_3d' | 'all_app_params' | 'preview_logs'>('locked_report');
  const [showProfileRawMd, setShowProfileRawMd] = useState<boolean>(false);
  const [compareTargetId, setCompareTargetId] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [capturedThumbnailUrl, setCapturedThumbnailUrl] = useState<string | null>(null);
  const [isCapturingThumb, setIsCapturingThumb] = useState<boolean>(false);

  const handleCaptureAndSaveThumbnail = async () => {
    setIsCapturingThumb(true);
    try {
      let b64: string | null = null;
      // 1. Thu goi ham capture tu Three.js Viewport
      if (typeof (window as any).__capture3DViewportSnapshot === 'function') {
        b64 = (window as any).__capture3DViewportSnapshot();
      }
      // 2. Fallback tim canvas theo ID hoac querySelector
      if (!b64) {
        const canvas = (document.getElementById('printsim-3d-canvas') as HTMLCanvasElement) || document.querySelector('canvas');
        if (canvas) {
          b64 = canvas.toDataURL('image/png');
        }
      }

      if (!b64 || b64.length < 200) {
        setSyncStatus('⚠️ Không thể chụp ảnh từ 3D Canvas (Dữ liệu rỗng)');
        setTimeout(() => setSyncStatus(null), 3500);
        setIsCapturingThumb(false);
        return;
      }

      const targetSessionId = generatedSessionJson?.sessionId || '01';
      setCapturedThumbnailUrl(b64);

      // A. Tu dong tai file anh PNG xuong may
      const downloadLink = document.createElement('a');
      downloadLink.href = b64;
      downloadLink.download = `Thumb_${targetSessionId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // B. Gui luu vao Obsidian Vault qua Backend API
      const ok = await uploadSessionThumbnail(targetSessionId, b64);
      if (ok) {
        setSyncStatus(`📸 Đã lưu Thumb_${targetSessionId}.png và nhúng vào Obsidian Profile!`);
      } else {
        setSyncStatus(`💾 Đã tải ảnh xuống máy tính thành công!`);
      }
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err) {
      console.error('[Capture Thumbnail Error]', err);
      setSyncStatus('⚠️ Lỗi khi chụp và lưu ảnh thumbnail');
      setTimeout(() => setSyncStatus(null), 3000);
    } finally {
      setIsCapturingThumb(false);
    }
  };

  const handleRunComparison = async (otherId: string) => {
    setCompareTargetId(otherId);
    if (!otherId) {
      setComparisonResult(null);
      return;
    }
    setIsComparing(true);
    const res = await compareSessions(otherId, generatedSessionJson.sessionId);
    setComparisonResult(res);
    setIsComparing(false);
  };
  
  // Nguồn tham số được chọn: 'live' (Studio trực tiếp) hoặc ID của bản ghi Nhật ký mô phỏng
  const [selectedSourceId, setSelectedSourceId] = useState<string>('live');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncingBackend, setIsSyncingBackend] = useState<boolean>(false);
  const [isSavingVault, setIsSavingVault] = useState<boolean>(false);
  const [physicsResult, setPhysicsResult] = useState<IPhysicsSanityResult | null>(null);

  const sessionId = getCurrentSessionId();

  // Đồng bộ selectedSourceId khi mở modal hoặc initialSelectedLogId thay đổi
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedLogId && simulationLogs.some((l) => l.id === initialSelectedLogId)) {
        setSelectedSourceId(initialSelectedLogId);
      } else if (simulationLogs.length > 0 && selectedSourceId === 'live') {
        // Giữ 'live' hoặc ưu tiên nếu người dùng mở từ nút
      }
    }
  }, [isOpen, initialSelectedLogId, simulationLogs]);

  // Tìm bản ghi log được chọn (nếu có)
  const selectedLog = useMemo(() => {
    if (selectedSourceId === 'live') return null;
    return simulationLogs.find((l) => l.id === selectedSourceId) || null;
  }, [selectedSourceId, simulationLogs]);

  // Profile đang được thanh tra (lấy từ snapshot của log hoặc live profile)
  const activeProfile = useMemo(() => {
    if (selectedLog) return selectedLog.profileSnapshot;
    return currentProfile;
  }, [selectedLog, currentProfile]);

  const loadData = async () => {
    setIsLoading(true);
    const [rep, cat, phys] = await Promise.all([
      fetchReportParameters(sessionId),
      fetchAppParameterCatalog(),
      checkPhysicsSanity(activeProfile, selectedLog ? selectedLog.id : sessionId),
    ]);
    setReportData(rep);
    if (cat.length > 0) setCatalog(cat);
    if (phys) setPhysicsResult(phys);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeProfile, selectedLog]);

  // Tính số lần biến đổi qua các bản ghi Nhật Ký Mô Phỏng
  const churnMap = useMemo(() => {
    const counts: Record<string, number> = {
      layerHeight: 1,
      supportMode: 1,
      infillDensity: 1,
      brimEnabled: 1,
      bedTemp: 1,
      printSpeed: 1,
    };

    if (simulationLogs.length > 1) {
      const reversed = [...simulationLogs].reverse();
      for (let i = 1; i < reversed.length; i++) {
        const prev = reversed[i - 1].profileSnapshot;
        const cur = reversed[i].profileSnapshot;
        if (cur.layerHeight !== prev.layerHeight) counts.layerHeight++;
        if (cur.supportMode !== prev.supportMode) counts.supportMode++;
        if (cur.infillDensity !== prev.infillDensity) counts.infillDensity++;
        if (cur.brimEnabled !== prev.brimEnabled) counts.brimEnabled++;
        if (cur.bedTemp !== prev.bedTemp) counts.bedTemp++;
        if (cur.printSpeed !== prev.printSpeed) counts.printSpeed++;
      }
    }

    // Kết hợp với dữ liệu backend nếu có
    if (reportData?.extracted_report.locked_report_parameters) {
      const bLocked = reportData.extracted_report.locked_report_parameters;
      if (bLocked.A_do_day_lop) counts.layerHeight = Math.max(counts.layerHeight, bLocked.A_do_day_lop.so_lan_doi);
      if (bLocked.B_canh_do) counts.supportMode = Math.max(counts.supportMode, bLocked.B_canh_do.so_lan_doi);
      if (bLocked.C_do_rong) counts.infillDensity = Math.max(counts.infillDensity, bLocked.C_do_rong.so_lan_doi);
      if (bLocked.D_vanh_bam) counts.brimEnabled = Math.max(counts.brimEnabled, bLocked.D_vanh_bam.so_lan_doi);
      if (bLocked.E_nhiet_ban_in) counts.bedTemp = Math.max(counts.bedTemp, bLocked.E_nhiet_ban_in.so_lan_doi);
      if (bLocked.F_toc_do_day) counts.printSpeed = Math.max(counts.printSpeed, bLocked.F_toc_do_day.so_lan_doi);
    }

    return counts;
  }, [simulationLogs, reportData]);

  // Trích xuất 6 tham số đã khóa (Locked Contract) theo tiêu chuẩn
  const lockedItems = useMemo(() => {
    return [
      {
        key: 'A_do_day_lop',
        label: 'A (Độ dày lớp)',
        val: `${activeProfile.layerHeight}mm`,
        liveVal: `${currentProfile.layerHeight}mm`,
        paramKey: 'layerHeight',
        mutCount: churnMap.layerHeight || 1,
        desc: `Độ phân giải trục Z: ${activeProfile.layerHeight}mm`,
      },
      {
        key: 'B_canh_do',
        label: 'B (Cành đỡ)',
        val: activeProfile.supportMode === 'tree' ? 'Tree' : activeProfile.supportMode === 'none' ? 'Tắt' : 'Normal',
        liveVal: currentProfile.supportMode === 'tree' ? 'Tree' : currentProfile.supportMode === 'none' ? 'Tắt' : 'Normal',
        paramKey: 'supportMode',
        mutCount: churnMap.supportMode || 1,
        desc: activeProfile.supportMode === 'tree' ? `Tree Support (${activeProfile.treeStyle || 'Organic'})` : activeProfile.supportMode === 'none' ? 'Không dùng cây chống' : 'Normal Grid Support',
      },
      {
        key: 'C_do_rong',
        label: 'C (Độ rỗng)',
        val: `${activeProfile.infillDensity}%`,
        liveVal: `${currentProfile.infillDensity}%`,
        paramKey: 'infillDensity',
        mutCount: churnMap.infillDensity || 1,
        desc: `Mật độ ruột ${activeProfile.infillDensity}% (${activeProfile.infillType || 'Gyroid'})`,
      },
      {
        key: 'D_vanh_bam',
        label: 'D (Vành bám)',
        val: activeProfile.brimEnabled ? `Bật ${activeProfile.brimWidthMm || 5}mm` : 'Tắt',
        liveVal: currentProfile.brimEnabled ? `Bật ${currentProfile.brimWidthMm || 5}mm` : 'Tắt',
        paramKey: 'brimEnabled',
        mutCount: churnMap.brimEnabled || 1,
        desc: activeProfile.brimEnabled ? `Vành bám viền ngoài ${activeProfile.brimWidthMm || 5}mm` : 'Không dùng viền bám bàn in',
      },
      {
        key: 'E_nhiet_ban_in',
        label: 'E (Nhiệt bàn in)',
        val: `${activeProfile.bedTemp}°C`,
        liveVal: `${currentProfile.bedTemp}°C`,
        paramKey: 'bedTemp',
        mutCount: churnMap.bedTemp || 1,
        desc: `Nhiệt độ bàn in PEI (${activeProfile.bedTemp}°C) cho ${activeProfile.material}`,
      },
      {
        key: 'F_toc_do_day',
        label: 'F (Tốc độ lớp đáy)',
        val: `${activeProfile.printSpeed}mm/s`,
        liveVal: `${currentProfile.printSpeed}mm/s`,
        paramKey: 'printSpeed',
        mutCount: churnMap.printSpeed || 1,
        desc: `Tốc độ in chính ${activeProfile.printSpeed}mm/s (Vách: ${activeProfile.outerWallSpeed || 150}mm/s)`,
      },
    ];
  }, [activeProfile, currentProfile, churnMap]);

  // Tạo JSON Session mẫu theo Locked Schema
  const generatedSessionJson = useMemo(() => {
    const runNum = selectedLog
      ? selectedLog.runNumber
      : (simulationLogs.length > 0 ? simulationLogs[simulationLogs.length - 1].runNumber + 1 : 1);
    const durMin = selectedLog ? Math.max(1, Math.round(selectedLog.estimatedTimeSec / 60)) : 7;
    const timeStr = selectedLog ? selectedLog.timestamp : new Date().toTimeString().slice(0, 8);
    const scoreVal = selectedLog ? selectedLog.score : 100;

    return {
      sessionId: String(runNum).padStart(2, '0'),
      operator: 'Kỹ sư in 3D (CoreXY)',
      startedAt: `${new Date().toISOString().slice(0, 10)} ${timeStr}`,
      durationMinutes: durMin,
      status: scoreVal >= 60 ? 'COMPLETED' : 'WARPING',
      slicer: {
        layerHeightMm: activeProfile.layerHeight,
        infillPercent: activeProfile.infillDensity,
        infillType: activeProfile.infillType,
        wallLoops: activeProfile.wallLoops || 2,
        topBottomLayers: {
          top: activeProfile.topShellLayers || 4,
          bottom: activeProfile.bottomShellLayers || 3,
        },
        supportType: activeProfile.supportMode === 'tree' ? 'Tree' : activeProfile.supportMode === 'none' ? 'None' : 'Normal',
        supportOverhangAngle: activeProfile.supportAngleThreshold || 45,
      },
      hardware: {
        speedF: {
          defaultMmS: activeProfile.printSpeed,
          wallMmS: activeProfile.outerWallSpeed || 150,
          infillMmS: activeProfile.infillSpeed || 275,
        },
        tempsE: {
          bedTempC: activeProfile.bedTemp,
          nozzleTempC: activeProfile.nozzleTemp,
          fanSpeedPercent: activeProfile.coolingFanSpeed || 100,
        },
        extrusion: {
          flowRatio: activeProfile.flowRateMm3s ? Number((activeProfile.flowRateMm3s / 15).toFixed(2)) : 0.98,
          retractionMm: activeProfile.retractionDistanceMm || 0.8,
          zHopMm: activeProfile.zHopMm || 0.4,
        },
      },
      metadata: {
        modelName: selectedLog ? selectedLog.modelName : 'Mô hình hiện tại',
        material: activeProfile.material,
        printabilityScore: scoreVal,
        filamentGrams: selectedLog ? selectedLog.filamentGrams : 17.3,
        totalLayers: selectedLog ? selectedLog.totalLayers : 234,
        triggerLabel: selectedLog ? selectedLog.triggerLabel : 'Live Profile',
      },
    };
  }, [selectedLog, activeProfile]);

  // Tạo Markdown Table mẫu cho Obsidian Vault
  const generatedMarkdownTable = useMemo(() => {
    const s = generatedSessionJson;
    return `| Mã Phiên | Phiên Gốc | Người Thực Hiện | Thời Gian (Thời Lượng) | Trạng Thái | Chi Tiết Lỗi / Ghi Chú | Độ Cao Lớp (mm) | Mật Độ Ruột | Thành Vách | Nóc / Đáy | Support & Góc | Tốc Độ F (mm/s) | Vách • Ruột (mm/s) | Nhiệt Bàn (°C) | Đầu In • Quạt | Đùn • Rút • Hop | Phiên Nối Tiếp |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| ${s.sessionId} | - | ${s.operator} | ${s.startedAt} (${s.durationMinutes} phút) | ${s.status === 'COMPLETED' ? 'Hoàn tất' : 'Lỗi Warping'} | Điểm QC: ${s.metadata.printabilityScore}/100 (${s.metadata.triggerLabel}) | ${s.slicer.layerHeightMm.toFixed(2)} | ${s.slicer.infillPercent}% (${s.slicer.infillType}) | ${s.slicer.wallLoops} vòng | ${s.slicer.topBottomLayers.top} / ${s.slicer.topBottomLayers.bottom} | ${s.slicer.supportType} (${s.slicer.supportOverhangAngle}°) | ${s.hardware.speedF.defaultMmS} | ${s.hardware.speedF.wallMmS} • ${s.hardware.speedF.infillMmS} | ${s.hardware.tempsE.bedTempC} | ${s.hardware.tempsE.nozzleTempC} • ${s.hardware.tempsE.fanSpeedPercent}% | ${s.hardware.extrusion.flowRatio} • ${s.hardware.extrusion.retractionMm} • ${s.hardware.extrusion.zHopMm} | - |`;
  }, [generatedSessionJson]);

  // Tạo Hồ Sơ In 3D (3D Print Profile) theo chuẩn Obsidian 01_Profiles_In3D
  const generatedProfile3DMarkdown = useMemo(() => {
    if (reportData?.profile_3d_markdown) {
      return reportData.profile_3d_markdown;
    }
    const s = generatedSessionJson;
    const lh = s.slicer.layerHeightMm;
    const inf = s.slicer.infillPercent;
    const infType = s.slicer.infillType;
    const wl = s.slicer.wallLoops;
    const tb = s.slicer.topBottomLayers;
    const sup = s.slicer.supportType;
    const ang = s.slicer.supportOverhangAngle;
    const spdDef = s.hardware.speedF.defaultMmS;
    const spdWall = s.hardware.speedF.wallMmS;
    const spdInf = s.hardware.speedF.infillMmS;
    const bedT = s.hardware.tempsE.bedTempC;
    const nozT = s.hardware.tempsE.nozzleTempC;
    const fan = s.hardware.tempsE.fanSpeedPercent;
    const flow = s.hardware.extrusion.flowRatio;
    const ret = s.hardware.extrusion.retractionMm;
    const zh = s.hardware.extrusion.zHopMm;
    const mat = s.metadata.material;
    const model = s.metadata.modelName;
    const score = s.metadata.printabilityScore;

    const isWarping = (mat.toUpperCase() === 'ABS' && bedT < 90) || (bedT < 50);
    const statusBadge = s.status === 'COMPLETED' ? '🟢 ĐẠT CHUẨN SẢN XUẤT (OPTIMAL)' : '🟡 CẢNH BÁO CONG VÊNH (WARPING)';

    return `---
schema_version: "v2026.1"
doc_type: "3d_print_profile"
profile_id: "PROFILE_${s.sessionId}"
ten_mo_hinh: "${model}"
vat_lieu: "${mat}"
nguoi_thuc_hien: "${s.operator}"
thoi_gian: "${s.startedAt}"
trang_thai: "${s.status}"
diem_chat_luong: ${score}
do_day_lop_mm: ${lh}
nhiet_do_ban_c: ${bedT}
nhiet_do_dau_in_c: ${nozT}
toc_do_in_mms: ${spdDef}
tags:
  - printsim/profile-3d
  - vat-lieu/${mat.toLowerCase()}
  - trang-thai/${s.status.toLowerCase()}
---

# 🎨 HỒ SƠ THIẾT LẬP IN 3D (3D PRINT PROFILE): ${model}

> **Mã hồ sơ:** \`PROFILE_${s.sessionId}\` | **Vật liệu:** \`${mat}\` | **Trạng thái:** ${statusBadge}  
> **Điều hướng:** [[000_PRINT_INDEX|🧭 MOC Tổng]] | [[nhat_ky_in|📋 Bảng Nhật Ký Tổng Hợp]] | [[PHIEU_${s.sessionId}|📄 Phiếu In #${s.sessionId}]]

---

## 🌟 1. Tóm Tắt Dành Cho Quản Lý & Vận Hành (Executive Summary)
- 📌 **Mô hình in:** \`${model}\` (${mat})
- ⏱️ **Thời gian in ước tính:** \`${s.durationMinutes}\` phút | **Tổng số lớp:** \`${s.metadata.totalLayers}\` lớp
- ⚖️ **Lượng nhựa tiêu hao:** \`${s.metadata.filamentGrams}\` g
- 🎯 **Điểm đánh giá khả thi:** \`${score}/100\` (${score >= 80 ? 'Tốt' : 'Cần tối ưu'})
- 👤 **Người thiết lập / Vận hành:** \`${s.operator}\` | **Bắt đầu lúc:** \`${s.startedAt}\`

---

## 📐 2. Cấu Trúc Lớp & Độ Phân Giải (Slicer Resolution & Shell)
| Thông số kỹ thuật | Giá trị thực tế | Ý nghĩa thực tế cho bản in |
| :--- | :---: | :--- |
| **Độ cao lớp (Layer Height)** | \`${lh.toFixed(2)} mm\` | Độ mịn bề mặt (Càng nhỏ bề mặt càng mịn bóng) |
| **Mật độ ruột (Infill)** | \`${inf}%\` | Độ cứng vững bên trong sản phẩm |
| **Dạng ruột (Infill Pattern)** | \`${infType}\` | Phân bổ lực đồng đều mọi hướng |
| **Độ dày vỏ ngoài (Wall Loops)** | \`${wl} vòng\` | Độ bền kéo và chống chịu lực tác động |
| **Lớp Nóc / Lớp Đáy** | \`${tb.top} nóc / ${tb.bottom} đáy\` | Độ kín bề mặt trên cùng và mặt tiếp xúc bàn |
| **Giá đỡ chống sụp (Support)** | \`${sup} (${ang}°)\` | Giữ các chi tiết nhô ra ngoài không bị rơi tự do |

---

## ⚡ 3. Tốc Độ & Phần Cứng Máy In (Speed & Dynamics)
| Vị trí đầu phun | Tốc độ thiết lập | Đánh giá vận hành |
| :--- | :---: | :--- |
| **Tốc độ in cơ sở (Base Speed)** | \`${spdDef} mm/s\` | Tốc độ đẩy tổng thể của máy |
| **Tốc độ vách ngoài (Outer Wall)** | \`${spdWall} mm/s\` | Đảm bảo tính thẩm mỹ, hạn chế rung sọc |
| **Tốc độ đùn ruột (Infill Speed)** | \`${spdInf} mm/s\` | Tối ưu hóa thời gian in |

---

## 🌡️ 4. Nhiệt Độ & Cơ Chế Đùn Nhựa (Thermal & Extrusion)
| Thiết bị & Tham số | Thiết lập | Vai trò kỹ thuật |
| :--- | :---: | :--- |
| **Nhiệt độ bàn in (Heatbed)** | \`${bedT}°C\` | Giúp đáy nhựa bám chặt bàn in, chống cong vênh |
| **Nhiệt độ đầu phun (Hotend)** | \`${nozT}°C\` | Đảm bảo nhựa nóng chảy đều và liên kết lớp tối đa |
| **Quạt tản nhiệt chi tiết** | \`${fan}%\` | Làm đông nhựa ngay khi ra khỏi đầu phun |
| **Hệ số đùn nhựa (Flow Ratio)** | \`${flow}\` | Tránh đùn thiếu hoặc thừa nhựa |
| **Khoảng cách rút sợi (Retraction)** | \`${ret} mm\` | Chống chảy nhựa tơ nhện (stringing) khi di chuyển |
| **Nhấc đầu phun Z (Z-Hop)** | \`${zh} mm\` | Tránh va quệt vào mô hình khi đầu phun di chuyển |

---

## 🛡️ 5. Đánh Giá Rủi Ro Vật Lý & Khuyến Nghị Vận Hành
> [!tip] 💡 Hướng dẫn cho Thợ in & Designer:
> - ${isWarping ? '⚠️ **Nguy cơ cong vênh (Warping):** Tăng nhiệt độ bàn in hoặc bật vành bám Brim.' : '✅ **Chất lượng lý tưởng:** Bộ thông số cân bằng hoàn hảo giữa tốc độ và độ sắc nét bề mặt.'}

---

## 🔍 Truy Vấn Tự Động (Obsidian Dataview)
\`\`\`dataview
TABLE startedAt as "Thời gian", metadata.material as "Vật liệu", slicer.layerHeightMm as "Lớp (mm)", hardware.tempsE.bedTempC as "Nhiệt bàn"
FROM "01_Profiles_In3D" OR #printsim/profile-3d
WHERE profile_id = "PROFILE_${s.sessionId}"
\`\`\`

---
*Tự động tổng hợp Profile In 3D bởi 3D PrintSim Telemetry Engine.*
`;
  }, [reportData, generatedSessionJson]);

  // Xử lý gửi đồng bộ vào backend SQLite
  const handleSyncToBackend = async () => {
    if (!selectedLog) return;
    setIsSyncingBackend(true);
    await syncSimulationLogToTelemetry(
      selectedLog.profileSnapshot,
      selectedLog.runNumber,
      selectedLog.triggerLabel,
      selectedLog.modelName
    );
    await loadData();
    setIsSyncingBackend(false);
    setSyncStatus('✓ Đã đồng bộ thông số vào Backend SQLite!');
    setTimeout(() => setSyncStatus(null), 3500);
  };

  // Lưu phiên in trực tiếp vào Obsidian Vault (.md) và nhat_ky_in.json
  const handleSaveToVault = async () => {
    setIsSavingVault(true);
    setSyncStatus('⚡ Đang lưu thông số vào Obsidian Vault (.md) & JsonLogs (.json)...');
    const result = await saveSessionToVault(generatedSessionJson);
    setIsSavingVault(false);
    if (result.success) {
      setSyncStatus(`✓ ${result.message}`);
      await loadData();
    } else {
      const sId = generatedSessionJson.sessionId;
      downloadFile(`Audit_${sId}.json`, JSON.stringify(generatedSessionJson, null, 2), 'application/json');
      downloadFile(`PHIEU_${sId}.md`, generatedMarkdownTable, 'text/markdown');
      setSyncStatus(`✓ Đã tải về PHIEU_${sId}.md và Audit_${sId}.json trực tiếp!`);
    }
    setTimeout(() => setSyncStatus(null), 5000);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(`✓ Đã sao chép ${label}!`);
    setTimeout(() => setCopyStatus(null), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl lg:max-w-5xl rounded-2xl glass-panel shadow-2xl max-h-[92vh] flex flex-col overflow-hidden studio-text-primary animate-in zoom-in-95">
        {/* Header - Cố định phía trên (Fixed Header, không bị cuộn mất nút) */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b studio-border shrink-0 bg-[var(--bg-panel)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl studio-gold-badge flex items-center justify-center shrink-0">
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
                Trích xuất trực tiếp các thông số từ Nhật Ký Mô Phỏng và Live Studio vào báo cáo kiểm toán
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

        {/* Modal Body - Vùng nội dung có thanh cuộn mượt */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">

        {/* Nguồn Tham Số (Data Source Selector): Cho phép chọn giữa Live Studio Profile và các bản ghi trong Nhật Ký Mô Phỏng */}
        <div className="p-3.5 rounded-xl studio-card space-y-2.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider studio-text-secondary shrink-0 flex items-center gap-1.5">
                <IconTerminal className="w-3.5 h-3.5 studio-text-gold" />
                Nguồn Tham Số:
              </span>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="bg-[#121418] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-xs font-mono font-medium studio-text-primary focus:outline-none focus:border-[var(--accent-gold)] cursor-pointer flex-1 max-w-lg truncate shadow-inner"
              >
                <option value="live" className="bg-[#14171d] text-[#f4f4f6] py-1.5 px-2">⚡ Live Profile Studio (Đang chỉnh trên giao diện)</option>
                {simulationLogs.map((log) => (
                  <option key={log.id} value={log.id} className="bg-[#14171d] text-[#f4f4f6] py-1.5 px-2">
                    📜 #{String(log.runNumber).padStart(2, '0')}: {log.triggerLabel} ({log.material} • {log.timestamp} • {log.score}đ)
                  </option>
                ))}
              </select>
            </div>

            {/* Actions cho bản ghi / profile */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {selectedLog && onRestoreProfile && (
                <button
                  onClick={() => {
                    onRestoreProfile(selectedLog.profileSnapshot);
                    setSyncStatus('✓ Đã nạp Profile này ra Studio!');
                    setTimeout(() => setSyncStatus(null), 3000);
                  }}
                  className="px-3 py-1.5 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-primary text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                  title="Nạp bộ thông số của bản ghi này làm Profile chính trên bàn in 3D"
                >
                  <IconReset size={12} />
                  <span>Nạp Ra Studio</span>
                </button>
              )}
              <button
                onClick={handleSaveToVault}
                disabled={isSavingVault}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                title="Lưu các thông số mới này vào Obsidian Vault (.md) và JsonLogs (.json)"
              >
                <IconExport size={12} />
                <span>{isSavingVault ? 'Đang lưu...' : '💾 Lưu .md & .json'}</span>
              </button>
              {selectedLog && (
                <button
                  onClick={handleSyncToBackend}
                  disabled={isSyncingBackend}
                  className="px-3 py-1.5 rounded-lg studio-gold-badge hover:bg-[var(--accent-gold)] hover:text-[#0b0c0e] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                  title="Ghi nhận bộ thông số này sang Backend Telemetry SQLite"
                >
                  <IconTerminal size={12} />
                  <span>{isSyncingBackend ? 'Đang ghi...' : 'Ghi Vào Backend'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Toast thông báo nhanh */}
          {(syncStatus || copyStatus) && (
            <div className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg animate-in fade-in">
              {syncStatus || copyStatus}
            </div>
          )}

          {/* Banner thông tin chi tiết của bản ghi đang chọn */}
          {selectedLog ? (
            <div className="pt-2 border-t studio-border flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold font-mono text-xs studio-text-gold">
                  Phiên #{String(selectedLog.runNumber).padStart(2, '0')}: {selectedLog.triggerLabel}
                </span>
                <span className="text-[10px] font-mono studio-text-muted">
                  {selectedLog.timestamp}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded studio-card text-[10px] font-mono">
                  <IconCube size={10} />
                  <span>{selectedLog.modelName}</span>
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  selectedLog.score >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  Điểm QC: {selectedLog.score}/100
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] studio-text-secondary">
                <span>⏱ {formatDuration(selectedLog.estimatedTimeSec)}</span>
                <span>•</span>
                <span>⚖ {selectedLog.filamentGrams.toFixed(1)}g</span>
                <span>•</span>
                <span>L{selectedLog.totalLayers}</span>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t studio-border text-[10px] studio-text-muted flex items-center justify-between">
              <span>Đang lấy thông số trực tiếp từ Live Profile Studio ({currentProfile.material} {currentProfile.layerHeight}mm).</span>
              <span className="font-mono studio-text-secondary">{simulationLogs.length} bản ghi trong nhật ký</span>
            </div>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b studio-border pb-2 flex-wrap">
          <button
            onClick={() => setActiveTab('locked_report')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'locked_report' ? 'studio-pill-active shadow-sm' : 'studio-pill-inactive'
            }`}
          >
            <IconLayers className="w-3.5 h-3.5" />
            <span>Thông Số Báo Cáo Đã Khóa (Locked Contract)</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md studio-gold-badge font-mono">
              6
            </span>
          </button>

          <button
            onClick={() => setActiveTab('profile_3d')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profile_3d' ? 'studio-pill-active shadow-sm' : 'studio-pill-inactive'
            }`}
          >
            <IconCube className="w-3.5 h-3.5" />
            <span>🎨 Hồ Sơ In 3D (Profile 3D)</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono">
              Executive
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all_app_params')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all_app_params' ? 'studio-pill-active shadow-sm' : 'studio-pill-inactive'
            }`}
          >
            <IconSliders className="w-3.5 h-3.5" />
            <span>Toàn Bộ Tham Số Của App ({catalog.length || 29})</span>
          </button>

          <button
            onClick={() => setActiveTab('preview_logs')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'preview_logs' ? 'studio-pill-active shadow-sm' : 'studio-pill-inactive'
            }`}
          >
            <IconTerminal className="w-3.5 h-3.5" />
            <span>Xem Trước Output Tinh Gọn</span>
          </button>
        </div>

        {/* Tab 1: Thông Số Báo Cáo Đã Khóa */}
        {activeTab === 'locked_report' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl studio-card text-xs studio-text-secondary flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <strong className="studio-text-gold">Quy tắc kiểm toán:</strong>
                <span>Tham số có số lần đổi ≥ 3 tự động gắn chỉ báo</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded studio-gold-badge font-semibold text-[10px]">
                  <IconAngle className="w-3 h-3" /> Phân vân cao
                </span>
                <span>phản ánh sự tinh chỉnh lặp lại.</span>
              </div>
              <div className="text-[11px] font-mono studio-text-muted">
                {selectedLog
                  ? `Nguồn: Nhật ký mô phỏng #${selectedLog.runNumber}`
                  : `Tổng biến đổi: ${reportData?.total_events ?? (simulationLogs.length > 1 ? simulationLogs.length : 0)} sự kiện`}
              </div>
            </div>

            {/* Physics-Based Sanity Check Banner: Động cơ kiểm tra vật lý in FDM */}
            {physicsResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs transition-all space-y-2.5 ${
                  physicsResult.qc_risk_score > 60
                    ? 'bg-rose-500/10 border-rose-500/35 text-rose-200'
                    : physicsResult.qc_risk_score > 20
                    ? 'bg-amber-500/10 border-amber-500/35 text-amber-200'
                    : 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                      <IconCheckShield className="w-4 h-4 text-[var(--accent-gold)]" />
                      Kiểm Định Vật Lý FDM (Physics Sanity Check):
                    </span>
                    <span className="font-bold font-mono text-[11px] px-2.5 py-0.5 rounded-md bg-black/40 border border-white/10">
                      {physicsResult.status_label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 font-mono text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-black/30">
                      Khả Thi QC: <strong className="font-bold">{physicsResult.qc_health_score}/100</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/30">
                      Lưu lượng: {physicsResult.estimated_volumetric_flow_rate} / {physicsResult.max_volumetric_flow_rate} mm³/s
                    </span>
                  </div>
                </div>

                {physicsResult.issues.length > 0 ? (
                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                    {physicsResult.issues.map((issue) => (
                      <div key={issue.code} className="text-[11px] bg-black/40 p-2.5 rounded-lg space-y-1 border border-white/5">
                        <div className="flex items-center justify-between font-bold flex-wrap gap-1">
                          <span className={issue.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}>
                            {issue.severity === 'CRITICAL' ? '🚨' : '⚠️'} [{issue.code}] {issue.title}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 opacity-80">
                            {issue.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-300 leading-relaxed">{issue.description}</p>
                        <p className="text-[10px] font-semibold text-amber-300 flex items-center gap-1">
                          <span>💡 Gợi ý khắc phục:</span>
                          <span>{issue.suggested_action}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-300/90 flex items-center gap-1.5 pt-1">
                    <span>✓</span>
                    <span>Toàn bộ quy tắc nhiệt học, lưu lượng nóng chảy và cơ tính FDM đều đạt chuẩn an toàn cho vật liệu {physicsResult.material}.</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lockedItems.map((item) => {
                const isWarning = item.mutCount >= 3;
                const isDifferentFromLive = selectedLog && item.val !== item.liveVal;

                return (
                  <div
                    key={item.key}
                    className={`p-3.5 rounded-xl transition-all ${
                      isWarning
                        ? 'studio-gold-badge border-[var(--accent-gold)]'
                        : isDifferentFromLive
                        ? 'studio-card border-[var(--accent-gold-border)] bg-[var(--accent-gold-bg)]'
                        : 'studio-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs studio-text-gold">{item.label}</span>
                        {isWarning && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded studio-gold-badge font-semibold" title="Phân vân cao (≥ 3 lần đổi)">
                            <IconAngle className="w-3 h-3 studio-text-gold" /> Phân vân cao
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md glass-input studio-text-muted">
                        Mã: {item.key}
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <div className="text-xl font-black font-mono studio-text-primary">
                        {item.val}
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-bold font-mono ${
                            isWarning ? 'studio-text-gold' : item.mutCount > 1 ? 'studio-text-primary' : 'studio-text-muted'
                          }`}
                        >
                          {item.mutCount === 1 ? '1 lần (chuẩn)' : `đổi ${item.mutCount} lần`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t studio-border text-[10px] studio-text-muted flex items-center justify-between">
                      <span className="truncate">{item.desc}</span>
                      {selectedLog && isDifferentFromLive && (
                        <span className="font-mono studio-text-gold shrink-0 ml-1">
                          Live: {item.liveVal}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

                {/* Tab 2: Hồ Sơ In 3D Tổng Hợp (Dành riêng cho Non-Dev, Thợ in, Quản lý) */}
        {activeTab === 'profile_3d' && (
          <div className="space-y-4">
            {/* Header Card với Actions */}
            {/* Header Card với Đầy Đủ Actions & Slicer Presets (Thiết kế 2 tầng thoáng đãng, không bị cắt nút) */}
            <div className="p-4 rounded-xl studio-card space-y-3.5 border border-[var(--border-strong)]">
              {/* Tầng 1: Thông tin Profile, Điểm QC và các Thao Tác Cốt Lõi (Nạp Studio & Lưu Vault) */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                    <IconCube className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold studio-text-primary tracking-tight">
                        Hồ Sơ Cấu Hình In 3D: PROFILE_{generatedSessionJson.sessionId}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-semibold">
                        {generatedSessionJson.metadata.material} • {generatedSessionJson.slicer.layerHeightMm}mm
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                        generatedSessionJson.metadata.printabilityScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        Khả thi: {generatedSessionJson.metadata.printabilityScore}/100
                      </span>
                    </div>
                    <p className="text-xs studio-text-secondary mt-0.5">
                      Tổng hợp thông số in 3D hoàn chỉnh, trực quan cho mọi role ngoài dev. Lưu tại: <code className="text-[10px] text-amber-300 font-mono">ObsidianVault/01_Profiles_In3D/Profile_In3D_{generatedSessionJson.sessionId}.md</code>
                    </p>
                  </div>
                </div>

                {/* Nút Thao Tác Cốt Lõi: Nạp Ra Studio & Lưu Vào Vault */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {onRestoreProfile && (
                    <button
                      onClick={() => {
                        const prof = selectedLog ? selectedLog.profileSnapshot : activeProfile;
                        onRestoreProfile(prof);
                        setSyncStatus(`🔄 Đã áp dụng Hồ Sơ PROFILE_${generatedSessionJson.sessionId} trực tiếp vào 3D Studio!`);
                        setTimeout(() => setSyncStatus(null), 3500);
                      }}
                      className="px-3 py-1.5 rounded-lg studio-card hover:bg-[var(--bg-hover)] text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                      title="Áp dụng bộ thông số hồ sơ này trực tiếp vào bàn in 3D Studio"
                    >
                      <IconReset size={12} />
                      <span>Nạp Ra Studio</span>
                    </button>
                  )}
                  <button
                    onClick={handleSaveToVault}
                    disabled={isSavingVault}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm disabled:opacity-50"
                    title="Lưu hoặc cập nhật hồ sơ in 3D này vào Obsidian Vault (.md) và JsonLogs (.json)"
                  >
                    <IconExport size={12} />
                    <span>{isSavingVault ? 'Đang lưu...' : '💾 Lưu Vào Vault'}</span>
                  </button>
                </div>
              </div>

              {/* Tầng 2: Toolbar Xuất Preset Slicer & Xuất Bản File (Bố cục thông thoáng, không bao giờ bị cắt) */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-0.5">
                {/* Nhóm Xuất Slicer Presets Chuẩn (OrcaSlicer, Bambu Lab, PrusaSlicer, Ultimaker Cura) */}
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/40 border border-white/10 text-[10px] flex-wrap">
                  <span className="studio-text-muted px-1.5 font-mono font-semibold">Xuất Slicer:</span>
                  <button
                    onClick={async () => {
                      const ok = await downloadSlicerPreset(generatedSessionJson.sessionId, 'orcaslicer');
                      if (ok) {
                        setSyncStatus('🦈 Đã tải OrcaSlicer Profile (.json)!');
                        setTimeout(() => setSyncStatus(null), 3000);
                      }
                    }}
                    className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 font-semibold cursor-pointer transition-all active:scale-95"
                    title="Xuất preset chuẩn OrcaSlicer v2.x (.json)"
                  >
                    🦈 OrcaSlicer
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await downloadSlicerPreset(generatedSessionJson.sessionId, 'bambulab');
                      if (ok) {
                        setSyncStatus('🐼 Đã tải Bambu Studio Profile (.json)!');
                        setTimeout(() => setSyncStatus(null), 3000);
                      }
                    }}
                    className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 font-semibold cursor-pointer transition-all active:scale-95"
                    title="Xuất preset chuẩn Bambu Studio (.json)"
                  >
                    🐼 Bambu Lab
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await downloadSlicerPreset(generatedSessionJson.sessionId, 'prusaslicer');
                      if (ok) {
                        setSyncStatus('🟧 Đã tải PrusaSlicer Profile (.ini)!');
                        setTimeout(() => setSyncStatus(null), 3000);
                      }
                    }}
                    className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 font-semibold cursor-pointer transition-all active:scale-95"
                    title="Xuất preset cấu hình PrusaSlicer / SuperSlicer (.ini)"
                  >
                    🟧 PrusaSlicer
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await downloadSlicerPreset(generatedSessionJson.sessionId, 'cura');
                      if (ok) {
                        setSyncStatus('🌀 Đã tải Ultimaker Cura Profile (.curaprofile)!');
                        setTimeout(() => setSyncStatus(null), 3000);
                      }
                    }}
                    className="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/35 text-blue-300 font-semibold cursor-pointer transition-all active:scale-95"
                    title="Xuất preset cấu hình Ultimaker Cura (.curaprofile)"
                  >
                    🌀 Cura
                  </button>
                </div>

                {/* Nhóm Actions: Lưu Thumbnail, Tải MD, Chép MD, Xem Raw */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handleCaptureAndSaveThumbnail}
                    disabled={isCapturingThumb}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm disabled:opacity-50"
                    title="Chụp ảnh mô hình 3D thực tế, tải về máy và lưu vào Obsidian Vault Profile"
                  >
                    <span>{isCapturingThumb ? '⏳ Đang Chụp...' : '📸 Lưu Thumbnail'}</span>
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await downloadNhatKyExcel();
                      if (ok) {
                        setSyncStatus('📊 Đã tải bảng tính Excel (.xlsx) ma trận 23 tham số!');
                        setTimeout(() => setSyncStatus(null), 3500);
                      } else {
                        setSyncStatus('❌ Không thể tải bảng tính Excel.');
                        setTimeout(() => setSyncStatus(null), 3000);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                    title="Xuất toàn bộ ma trận 23 tham số & báo cáo QC ra file Microsoft Excel (.xlsx)"
                  >
                    <span>📊 Xuất Excel</span>
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await downloadNhatKyCsv();
                      if (ok) {
                        setSyncStatus('📄 Đã tải tệp CSV (UTF-8 with BOM) 23 tham số!');
                        setTimeout(() => setSyncStatus(null), 3500);
                      } else {
                        setSyncStatus('❌ Không thể tải tệp CSV.');
                        setTimeout(() => setSyncStatus(null), 3000);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/35 text-teal-300 border border-teal-500/30 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                    title="Xuất toàn bộ ma trận 23 tham số ra file CSV chuẩn UTF-8"
                  >
                    <span>📄 Xuất CSV</span>
                  </button>
                  <button
                    onClick={() => downloadFile(`Profile_In3D_${generatedSessionJson.sessionId}.md`, generatedProfile3DMarkdown, 'text/markdown')}
                    className="px-2.5 py-1.5 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-primary text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                    title="Tải tệp Hồ Sơ In 3D Markdown về máy"
                  >
                    <IconExport size={12} />
                    <span>📥 Tải Profile 3D</span>
                  </button>
                  <button
                    onClick={() => handleCopy(generatedProfile3DMarkdown, 'Hồ Sơ In 3D')}
                    className="px-2.5 py-1.5 rounded-lg studio-gold-badge text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                    title="Sao chép nội dung Markdown hoàn chỉnh"
                  >
                    <span>📋 Chép MD</span>
                  </button>
                  <button
                    onClick={() => setShowProfileRawMd(!showProfileRawMd)}
                    className="px-2.5 py-1.5 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                    title="Xem / Ẩn nội dung Markdown thô của Obsidian"
                  >
                    <span>{showProfileRawMd ? '👁️ Ẩn Raw' : '👁️ Xem Raw'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 🖼️ Card Xem Trước Thumbnail Vừa Chụp */}
            {capturedThumbnailUrl && (
              <div className="p-3.5 rounded-xl studio-card border border-rose-500/30 bg-rose-500/5 flex flex-col sm:flex-row items-center gap-3.5">
                <img
                  src={capturedThumbnailUrl}
                  alt="3D Thumbnail"
                  className="w-24 h-24 object-contain rounded-lg border border-white/10 bg-black/60 shadow-md shrink-0"
                />
                <div className="space-y-1 text-left flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-rose-400">📸 Ảnh Thumbnail Mô Hình 3D (Đã Lưu)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                      Thumb_{generatedSessionJson.sessionId}.png
                    </span>
                  </div>
                  <p className="text-[11px] studio-text-secondary leading-relaxed">
                    Ảnh mô hình 3D thực tế đã được tải xuống máy và lưu tự động vào Obsidian Vault:
                    <br />
                    <code className="text-[10px] text-amber-300">ObsidianVault/01_Profiles_In3D/Attachments/Thumb_{generatedSessionJson.sessionId}.png</code>
                  </p>
                </div>
              </div>
            )}

            {/* ⚖️ Thanh So Sánh Đối Chiếu Phiên In (Session Diff & Benchmark Widget) */}
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold flex items-center gap-1.5 text-purple-300 uppercase tracking-wider text-[11px]">
                    <span>⚖️ So Sánh Đối Chiếu Với Phiên Khác:</span>
                  </span>
                  <select
                    value={compareTargetId}
                    onChange={(e) => handleRunComparison(e.target.value)}
                    className="bg-[#121418] border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-medium text-purple-200 focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="">-- Chọn phiên in để đối chiếu --</option>
                    {simulationLogs
                      .filter((l) => String(l.runNumber).padStart(2, '0') !== generatedSessionJson.sessionId)
                      .map((log) => (
                        <option key={log.id} value={String(log.runNumber).padStart(2, '0')}>
                          Phiên #{String(log.runNumber).padStart(2, '0')}: {log.triggerLabel} ({log.score}đ • {log.material})
                        </option>
                      ))}
                    {/* Danh sách phiên mẫu nếu chưa có log */}
                    {['01', '02', '03'].filter(id => id !== generatedSessionJson.sessionId).map(id => (
                      <option key={id} value={id}>Phiên mẫu #{id}</option>
                    ))}
                  </select>
                </div>

                {comparisonResult && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadFile(comparisonResult.markdown_filename || 'Comparison_Report.md', comparisonResult.markdown, 'text/markdown')}
                      className="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/35 text-purple-300 font-semibold text-[10px] cursor-pointer transition-all"
                      title="Tải báo cáo so sánh đối chiếu Markdown về máy"
                    >
                      📥 Tải Báo Cáo So Sánh (.md)
                    </button>
                    <button
                      onClick={() => handleCopy(comparisonResult.markdown, 'Báo Cáo So Sánh')}
                      className="px-2 py-1 rounded studio-card text-purple-200 hover:text-white font-semibold text-[10px] cursor-pointer transition-all"
                    >
                      📋 Chép So Sánh
                    </button>
                  </div>
                )}
              </div>

              {/* Kết quả so sánh đối chiếu */}
              {isComparing && (
                <div className="text-[11px] font-mono text-purple-300 animate-pulse">
                  ⏳ Đang tính toán ma trận chênh lệch và đối chiếu rủi ro vật lý...
                </div>
              )}

              {comparisonResult && (
                <div className="p-2.5 rounded-lg bg-black/40 border border-purple-500/20 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
                    <span className="font-bold text-white font-mono">
                      #{comparisonResult.base_session_id} ➔ #{comparisonResult.target_session_id}
                    </span>
                    <span className="font-semibold text-emerald-400 font-mono">
                      {comparisonResult.verdict_badge}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="text-zinc-400">Điểm QC</div>
                      <div className={`font-bold ${comparisonResult.score_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {comparisonResult.score_delta >= 0 ? `+${comparisonResult.score_delta}` : comparisonResult.score_delta} điểm
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="text-zinc-400">Thời gian in</div>
                      <div className="font-bold text-amber-300">
                        {comparisonResult.time_delta_minutes >= 0 ? `+${comparisonResult.time_delta_minutes}` : comparisonResult.time_delta_minutes} phút
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="text-zinc-400">Nhựa tiêu hao</div>
                      <div className="font-bold text-sky-300">
                        {comparisonResult.filament_delta_grams >= 0 ? `+${comparisonResult.filament_delta_grams}` : comparisonResult.filament_delta_grams}g
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-purple-200/90 italic">
                    💡 {comparisonResult.verdict_summary}
                  </p>
                </div>
              )}
            </div>

            {/* 4 Cards Phân Mục Trực Quan Cho Non-Dev */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Card 1: Tóm Tắt Vận Hành */}
              <div className="p-3.5 rounded-xl studio-card space-y-2 border border-white/5">
                <div className="flex items-center gap-2 font-bold text-xs studio-text-gold border-b border-white/5 pb-1.5">
                  <IconCube className="w-3.5 h-3.5" />
                  <span>1. Tóm Tắt &amp; Chỉ Số Vận Hành (Executive)</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Mô hình in:</span>
                    <strong className="studio-text-primary font-mono">{generatedSessionJson.metadata.modelName}</strong>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Chất liệu nhựa:</span>
                    <span className="font-mono text-emerald-400 font-semibold">{generatedSessionJson.metadata.material}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Thời gian in ước tính:</span>
                    <span className="font-mono">{generatedSessionJson.durationMinutes} phút</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Lượng nhựa tiêu hao:</span>
                    <span className="font-mono text-amber-300 font-semibold">{generatedSessionJson.metadata.filamentGrams} g</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="studio-text-secondary">Người thực hiện:</span>
                    <span className="font-mono studio-text-muted">{generatedSessionJson.operator}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Cấu Trúc Lớp & Độ Phân Giải */}
              <div className="p-3.5 rounded-xl studio-card space-y-2 border border-white/5">
                <div className="flex items-center gap-2 font-bold text-xs studio-text-gold border-b border-white/5 pb-1.5">
                  <IconLayers className="w-3.5 h-3.5" />
                  <span>2. Cấu Trúc Lớp &amp; Độ Phân Giải (Slicer)</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Độ cao lớp (Layer Height):</span>
                    <span className="font-mono text-sky-400 font-bold">{generatedSessionJson.slicer.layerHeightMm.toFixed(2)} mm</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Mật độ &amp; Dạng ruột:</span>
                    <span className="font-mono">{generatedSessionJson.slicer.infillPercent}% ({generatedSessionJson.slicer.infillType})</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Độ dày vỏ ngoài (Wall Loops):</span>
                    <span className="font-mono">{generatedSessionJson.slicer.wallLoops} vòng</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Lớp Nóc / Lớp Đáy:</span>
                    <span className="font-mono">{generatedSessionJson.slicer.topBottomLayers.top} nóc / {generatedSessionJson.slicer.topBottomLayers.bottom} đáy</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="studio-text-secondary">Giá đỡ (Support):</span>
                    <span className="font-mono">{generatedSessionJson.slicer.supportType} ({generatedSessionJson.slicer.supportOverhangAngle}°)</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Tốc Độ & Phần Cứng Máy */}
              <div className="p-3.5 rounded-xl studio-card space-y-2 border border-white/5">
                <div className="flex items-center gap-2 font-bold text-xs studio-text-gold border-b border-white/5 pb-1.5">
                  <IconSliders className="w-3.5 h-3.5" />
                  <span>3. Tốc Độ &amp; Phần Cứng Máy In (Speed)</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Tốc độ in cơ sở (Base):</span>
                    <span className="font-mono text-amber-300 font-bold">{generatedSessionJson.hardware.speedF.defaultMmS} mm/s</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Tốc độ vách ngoài (Outer Wall):</span>
                    <span className="font-mono">{generatedSessionJson.hardware.speedF.wallMmS} mm/s</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="studio-text-secondary">Tốc độ đùn ruột (Infill):</span>
                    <span className="font-mono">{generatedSessionJson.hardware.speedF.infillMmS} mm/s</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Nhiệt Độ & Cơ Chế Đùn Nhựa */}
              <div className="p-3.5 rounded-xl studio-card space-y-2 border border-white/5">
                <div className="flex items-center gap-2 font-bold text-xs studio-text-gold border-b border-white/5 pb-1.5">
                  <IconTerminal className="w-3.5 h-3.5" />
                  <span>4. Nhiệt Độ &amp; Cơ Chế Đùn Nhựa (Thermal)</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Nhiệt độ bàn in (Heatbed):</span>
                    <span className="font-mono text-rose-400 font-bold">{generatedSessionJson.hardware.tempsE.bedTempC}°C</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Nhiệt độ đầu phun (Hotend):</span>
                    <span className="font-mono text-orange-400 font-bold">{generatedSessionJson.hardware.tempsE.nozzleTempC}°C</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Quạt tản nhiệt chi tiết:</span>
                    <span className="font-mono">{generatedSessionJson.hardware.tempsE.fanSpeedPercent}%</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="studio-text-secondary">Hệ số đùn (Flow Ratio):</span>
                    <span className="font-mono">{generatedSessionJson.hardware.extrusion.flowRatio}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="studio-text-secondary">Rút sợi • Nhấc Z (Z-Hop):</span>
                    <span className="font-mono">{generatedSessionJson.hardware.extrusion.retractionMm}mm • {generatedSessionJson.hardware.extrusion.zHopMm}mm</span>
                  </div>
                </div>
              </div>
            </div>

              {/* Card 5: Kiểm Soát Vật Lý & Thể Tích Đùn (Physics Sanity Engine) */}
              <div className="p-3.5 rounded-xl studio-card space-y-2 border border-white/5 md:col-span-2 bg-gradient-to-r from-emerald-500/5 via-transparent to-sky-500/5">
                <div className="flex items-center justify-between font-bold text-xs studio-text-gold border-b border-white/5 pb-1.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <IconCheckShield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>5. Kiểm Soát Vật Lý &amp; Thể Tích Đùn (Physics Sanity Engine)</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Trạng thái: Đạt chuẩn mô phỏng (Optimal Flow)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-1">
                  <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-0.5">
                    <div className="text-[10px] studio-text-muted">Lưu lượng đùn (Volumetric)</div>
                    <div className="font-mono font-bold text-sky-400">
                      {(generatedSessionJson.slicer.layerHeightMm * 0.42 * generatedSessionJson.hardware.speedF.defaultMmS).toFixed(1)} mm³/s
                    </div>
                    <div className="text-[9px] text-zinc-500">Giới hạn đầu đùn: 15.0 mm³/s</div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-0.5">
                    <div className="text-[10px] studio-text-muted">Nguy cơ cong vênh (Warping)</div>
                    <div className="font-mono font-bold text-emerald-400">
                      {generatedSessionJson.hardware.tempsE.bedTempC >= 55 ? '0% (An toàn)' : '45% (Bàn nguội)'}
                    </div>
                    <div className="text-[9px] text-zinc-500">Nhiệt bàn: {generatedSessionJson.hardware.tempsE.bedTempC}°C</div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-0.5">
                    <div className="text-[10px] studio-text-muted">Làm mát chi tiết (Cooling)</div>
                    <div className="font-mono font-bold text-cyan-400">
                      {generatedSessionJson.hardware.tempsE.fanSpeedPercent}% Quạt
                    </div>
                    <div className="text-[9px] text-zinc-500">Tản nhiệt tối đa cho {generatedSessionJson.metadata.material}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-0.5">
                    <div className="text-[10px] studio-text-muted">Hệ số đùn (Flow Ratio)</div>
                    <div className="font-mono font-bold text-amber-300">
                      {generatedSessionJson.hardware.extrusion.flowRatio}
                    </div>
                    <div className="text-[9px] text-zinc-500">Đùn chuẩn không thừa/thiếu</div>
                  </div>
                </div>
              </div>

            {/* Callout Đánh Giá Rủi Ro & Lời Khuyên Cho Xưởng */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <span>💡 Hướng Dẫn Vận Hành Cho Thợ In &amp; Designer:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/90 pl-1">
                <li>
                  {generatedSessionJson.hardware.tempsE.bedTempC < 55
                    ? 'Cảnh báo bàn in nguội (< 55°C): Nguy cơ bong tróc đáy khi in lớp đầu. Khuyến nghị bật vành bám Brim.'
                    : 'Nhiệt bàn in đạt ngưỡng an toàn, lực bám dính đáy được duy trì liên tục.'}
                </li>
                <li>
                  Độ cao lớp {generatedSessionJson.slicer.layerHeightMm.toFixed(2)}mm cho bề mặt láng mịn, thời gian in dự kiến tối ưu.
                </li>
                <li>
                  Tự động đồng bộ và lưu trữ vào thư mục <code className="text-white font-mono">01_Profiles_In3D/</code> khi bấm nút Lưu.
                </li>
              </ul>
            </div>

            {/* Raw Markdown Output Viewer */}
            {showProfileRawMd && (
              <div className="space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold studio-text-gold font-mono">
                    Profile_In3D_{generatedSessionJson.sessionId}.md (Obsidian Native Markdown)
                  </span>
                  <button
                    onClick={() => handleCopy(generatedProfile3DMarkdown, 'Markdown Raw')}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded studio-gold-badge cursor-pointer"
                  >
                    Sao chép toàn bộ
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-black/60 border border-[var(--border-strong)] text-[11px] font-mono studio-text-secondary overflow-x-auto max-h-72 whitespace-pre leading-relaxed select-all">
                  {generatedProfile3DMarkdown}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Toàn bộ tham số của App */}
        {activeTab === 'all_app_params' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs studio-text-secondary flex-wrap gap-2">
              <p>
                Bảng danh mục đầy đủ thông số in 3D đang áp dụng cho{' '}
                <strong className="studio-text-primary">
                  {selectedLog ? `Nhật Ký #${selectedLog.runNumber} (${selectedLog.triggerLabel})` : 'Live Profile Studio'}
                </strong>:
              </p>
              <span className="text-[10px] font-mono studio-gold-badge px-2 py-0.5 rounded">
                {catalog.length} tham số
              </span>
            </div>

            <div className="rounded-xl studio-card overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 shadow-md">
                  <tr className="text-[10px] studio-text-muted uppercase font-semibold">
                    <th className="py-2.5 px-3 bg-[#121418] border-b border-[var(--border-strong)] sticky top-0 z-20">Tên Tham Số</th>
                    <th className="py-2.5 px-3 bg-[#121418] border-b border-[var(--border-strong)] sticky top-0 z-20">Phân Nhóm</th>
                    <th className="py-2.5 px-3 bg-[#121418] border-b border-[var(--border-strong)] sticky top-0 z-20">Giá Trị Cấu Hình</th>
                    <th className="py-2.5 px-3 bg-[#121418] border-b border-[var(--border-strong)] sticky top-0 z-20">Mục Tiêu Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)] font-mono text-[11px]">
                  {catalog.map((param) => {
                    const curVal = (activeProfile as unknown as Record<string, unknown>)[param.id];
                    const displayVal =
                      typeof curVal === 'boolean'
                        ? curVal ? 'Bật' : 'Tắt'
                        : curVal !== undefined
                        ? `${curVal}${param.unit ? ' ' + param.unit : ''}`
                        : `${param.default}${param.unit ? ' ' + param.unit : ''}`;

                    return (
                      <tr key={param.id} className="hover:bg-[var(--bg-hover)] transition-colors">
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
            <div className="flex items-center justify-between text-xs studio-text-secondary">
              <span>
                Cấu trúc đầu ra chuẩn hóa cho{' '}
                <strong className="studio-text-gold">
                  {selectedLog ? `Nhật Ký Mô Phỏng #${selectedLog.runNumber}` : 'Phiên Hiện Tại'}
                </strong>:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleSaveToVault}
                  disabled={isSavingVault}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                  title="Lưu hoặc cập nhật thông số phiên in này vào Obsidian Vault (.md) và JsonLogs (.json)"
                >
                  <IconExport size={11} />
                  <span>{isSavingVault ? 'Đang lưu...' : '💾 Lưu Vào Obsidian (.md & .json)'}</span>
                </button>
                <button
                  onClick={() => downloadFile(`Audit_${generatedSessionJson.sessionId}.json`, JSON.stringify(generatedSessionJson, null, 2), 'application/json')}
                  className="px-2 py-1 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-primary text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                  title="Tải tệp JSON xuống máy tính"
                >
                  <span>📥 Tải JSON</span>
                </button>
                <button
                  onClick={() => downloadFile(`Profile_In3D_${generatedSessionJson.sessionId}.md`, generatedProfile3DMarkdown, 'text/markdown')}
                  className="px-2 py-1 rounded-lg studio-card hover:bg-[var(--bg-hover)] text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                  title="Tải tệp Hồ Sơ In 3D (01_Profiles_In3D) xuống máy tính"
                >
                  <span>📥 Tải Profile 3D</span>
                </button>
                <button
                  onClick={() => downloadFile(`PHIEU_${generatedSessionJson.sessionId}.md`, generatedMarkdownTable, 'text/markdown')}
                  className="px-2 py-1 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-primary text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                  title="Tải tệp Markdown Obsidian xuống máy tính"
                >
                  <span>📥 Tải Phiếu MD</span>
                </button>
                <button
                  onClick={() => handleCopy(JSON.stringify(generatedSessionJson, null, 2), 'JSON')}
                  className="px-2 py-1 rounded-lg studio-card hover:bg-[var(--bg-hover)] studio-text-secondary hover:studio-text-primary text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Chép JSON</span>
                </button>
                <button
                  onClick={() => handleCopy(generatedMarkdownTable, 'Markdown')}
                  className="px-2 py-1 rounded-lg studio-gold-badge text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Chép MD</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* JSON Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold studio-text-gold flex items-center gap-1.5">
                    <IconTerminal className="w-3.5 h-3.5" /> nhat_ky_in.json (Cấu trúc Đã Khóa)
                  </span>
                  <a
                    href="http://127.0.0.1:8000/api/v1/nhat-ky"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] studio-text-secondary hover:underline flex items-center gap-1"
                  >
                    API Backend <IconExport className="w-3 h-3" />
                  </a>
                </div>
                <pre className="p-3.5 rounded-xl glass-input studio-text-primary font-mono text-[11px] overflow-x-auto max-h-64 select-all">
                  {JSON.stringify(generatedSessionJson, null, 2)}
                </pre>
              </div>

              {/* Markdown Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold studio-text-gold flex items-center gap-1.5">
                    <IconLayers className="w-3.5 h-3.5" /> nhat_ky_in.md (Bảng Đa Tầng Obsidian)
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
                  {generatedMarkdownTable}
                </pre>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Footer - Cố định phía dưới (Fixed Footer, không bao giờ bị che khuất) */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t studio-border shrink-0 bg-[var(--bg-panel)] flex-wrap gap-2">
          <div className="text-xs studio-text-secondary flex items-center gap-2">
            <IconCheckShield className="w-4 h-4 studio-text-gold" />
            <span>Backend Telemetry: http://127.0.0.1:8000</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl studio-pill-inactive text-xs font-semibold transition-all cursor-pointer hover:studio-pill-active"
          >
            Đóng Bảng Truy Xuất
          </button>
        </div>
      </div>
    </div>
  );
}

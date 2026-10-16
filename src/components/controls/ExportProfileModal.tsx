import React, { useState } from 'react';
import * as THREE from 'three';
import { ISimulationProfile, IModelTransform } from '@/types/simulator';
import { ISlicingMetrics } from '@/services/slicingEngine';
import {
  generateBambuOrcaProfileJson,
  generateSampleGcode,
  downloadFile,
  download3MFProject,
  downloadBinarySTL,
  copyProfileToClipboard,
} from '@/services/slicerExporter';
import { embedProtocol } from '@/services/embedProtocol';
import {
  IconExport,
  IconCube,
  IconTerminal,
  IconSliders,
  IconCheckShield,
  IconClose,
  IconLayers,
} from '@/components/icons/MinimalIcons';

interface ExportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ISimulationProfile;
  metrics: ISlicingMetrics;
  modelName: string;
  geometry?: THREE.BufferGeometry;
  modelTransform?: IModelTransform;
}

export function ExportProfileModal({
  isOpen,
  onClose,
  profile,
  metrics,
  modelName,
  geometry,
  modelTransform,
}: ExportProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'3mf_stl' | 'bambu' | 'gcode' | 'summary'>('3mf_stl');
  const [isCopied, setIsCopied] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const bambuJson = generateBambuOrcaProfileJson(profile, metrics, modelName);
  const gcodeText = generateSampleGcode(profile, metrics, modelName);

  const dimX = Math.round(metrics.boundingBox.dimensions[0]);
  const dimY = Math.round(metrics.boundingBox.dimensions[2]); // Chiều sâu (Slicer Y)
  const dimZ = Math.round(metrics.boundingBox.dimensions[1]); // Chiều cao (Slicer Z)
  const triCount = geometry?.getAttribute('position')
    ? Math.floor(geometry.getAttribute('position').count / 3)
    : 0;

  const handleCopy = async () => {
    let success = false;
    if (activeTab === 'bambu') {
      await navigator.clipboard.writeText(bambuJson);
      success = true;
    } else if (activeTab === 'gcode') {
      await navigator.clipboard.writeText(gcodeText);
      success = true;
    } else {
      success = await copyProfileToClipboard(profile, metrics);
    }

    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownload3MF = () => {
    if (!geometry) return;
    const file = download3MFProject(geometry, profile, metrics, modelName, modelTransform);
    setExportNotice(`Đã đóng gói & tải xuống dự án 3MF: ${file}`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleDownloadSTL = () => {
    if (!geometry) return;
    const file = downloadBinarySTL(geometry, modelName, modelTransform);
    setExportNotice(`Đã xuất mô hình Binary STL chuẩn mm: ${file}`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleDownload = () => {
    const safeName = modelName.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (activeTab === '3mf_stl') {
      handleDownload3MF();
    } else if (activeTab === 'bambu') {
      downloadFile(`${safeName}_bambu_orca_profile.json`, bambuJson, 'application/json');
    } else if (activeTab === 'gcode') {
      downloadFile(`${safeName}_simulated.gcode`, gcodeText, 'text/plain');
    } else {
      copyProfileToClipboard(profile, metrics).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };

  const handleSyncToHub = () => {
    embedProtocol.syncProfile(profile);
    setIsSynced(true);
    setTimeout(() => setIsSynced(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-3xl rounded-2xl glass-panel shadow-2xl overflow-hidden flex flex-col max-h-[90vh] studio-text-primary">
        {/* Modal Header */}
        <div className="p-5 border-b studio-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl studio-gold-badge flex items-center justify-center">
              <IconExport className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold studio-text-primary flex items-center gap-2">
                <span>Xuất Dự Án 3MF / STL &amp; Profile In 3D</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md studio-gold-badge">
                  Ready to Slice
                </span>
              </h2>
              <p className="text-xs studio-text-secondary">
                Đóng gói mô hình 3D chuẩn kích thước thực ({dimX}×{dimY}×{dimZ} mm) sang Bambu Studio, OrcaSlicer hoặc G-Code
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl studio-pill-inactive transition-all cursor-pointer"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b studio-border flex-wrap">
          <button
            onClick={() => setActiveTab('3mf_stl')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === '3mf_stl' ? 'studio-pill-active shadow-sm' : 'studio-pill-inactive'
            }`}
          >
            <IconCube className="w-3.5 h-3.5" />
            <span>Gói Dự Án (.3MF / .STL)</span>
          </button>

          <button
            onClick={() => setActiveTab('bambu')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bambu' ? 'studio-pill-active shadow-sm' : 'studio-pill-inactive'
            }`}
          >
            <IconLayers className="w-3.5 h-3.5" />
            <span>Profile (.JSON)</span>
          </button>

          <button
            onClick={() => setActiveTab('gcode')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'gcode' ? 'studio-pill-active shadow-sm' : 'studio-pill-inactive'
            }`}
          >
            <IconTerminal className="w-3.5 h-3.5" />
            <span>Mã Lệnh (.GCODE)</span>
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'summary' ? 'studio-pill-active shadow-sm' : 'studio-pill-inactive'
            }`}
          >
            <IconSliders className="w-3.5 h-3.5" />
            <span>Bảng Thông Số Nhanh</span>
          </button>
        </div>

        {/* Code / Content Preview Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === '3mf_stl' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl studio-card space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold studio-text-primary">
                      Phôi 3D Hiện Tại: <span className="studio-text-gold">{modelName}</span>
                    </h3>
                    <p className="text-xs studio-text-secondary mt-0.5">
                      Đã tự động chuẩn hóa hệ tọa độ Z-up &amp; tỷ lệ milimét thực tế (khắc phục hoàn toàn lỗi mesh 1×1×1 từ Fal.ai GLB).
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg studio-gold-badge font-mono text-xs font-bold">
                    {dimX} × {dimY} × {dimZ} mm
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-2 border-t studio-border text-xs">
                  <div>
                    <span className="studio-text-muted text-[10px] block">Số mặt tam giác</span>
                    <span className="font-mono font-bold studio-text-primary">
                      {triCount.toLocaleString('vi-VN')} tris
                    </span>
                  </div>
                  <div>
                    <span className="studio-text-muted text-[10px] block">Hệ tọa độ xuất</span>
                    <span className="font-mono font-bold studio-text-gold">3MF / STL Z-Up (mm)</span>
                  </div>
                  <div>
                    <span className="studio-text-muted text-[10px] block">Tâm bàn in</span>
                    <span className="font-mono font-bold studio-text-primary">128 × 128 mm (PEI)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleDownload3MF}
                  className="p-4 rounded-xl studio-card hover:border-[var(--accent-gold-border)] text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-lg studio-gold-badge flex items-center justify-center">
                      <IconCube className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded studio-gold-badge font-bold">
                      KHUYÊN DÙNG
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold studio-text-primary group-hover:studio-text-gold transition-colors">
                      Tải Gói Dự Án Chuẩn (.3MF)
                    </div>
                    <p className="text-[11px] studio-text-secondary mt-1">
                      Đóng gói cả lưới mô hình 3D (`3D/3dmodel.model`) lẫn cấu hình cắt lớp mở trực tiếp bằng Bambu Studio / OrcaSlicer.
                    </p>
                  </div>
                </button>

                <button
                  onClick={handleDownloadSTL}
                  className="p-4 rounded-xl studio-card hover:border-[var(--accent-gold-border)] text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-lg studio-card flex items-center justify-center studio-text-gold">
                      <IconExport className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded glass-input studio-text-secondary font-bold">
                      BINARY STL
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold studio-text-primary group-hover:studio-text-gold transition-colors">
                      Tải Lưới Hình Học (.STL)
                    </div>
                    <p className="text-[11px] studio-text-secondary mt-1">
                      Xuất tệp Binary STL tiêu chuẩn với kích thước {dimX}×{dimY}×{dimZ} mm tương thích với mọi phần mềm CAD &amp; Slicer.
                    </p>
                  </div>
                </button>
              </div>

              {exportNotice && (
                <div className="p-3 rounded-xl studio-gold-badge text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <IconCheckShield className="w-4 h-4 shrink-0" />
                  <span>{exportNotice}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bambu' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs studio-text-secondary">
                <span>Định dạng tương thích 100% với Bambu Studio &amp; OrcaSlicer Process Profile:</span>
                <span className="font-mono text-[11px] studio-text-gold">JSON Format</span>
              </div>
              <pre className="p-4 rounded-xl glass-input text-[11px] font-mono studio-text-primary overflow-x-auto max-h-72 select-text">
                {bambuJson}
              </pre>
            </div>
          )}

          {activeTab === 'gcode' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs studio-text-secondary">
                <span>Xem trước mã lệnh G-Code bao gồm Start/End Gcode và các lớp đầu:</span>
                <span className="font-mono text-[11px] studio-text-gold">G-Code Toolpaths</span>
              </div>
              <pre className="p-4 rounded-xl glass-input text-[11px] font-mono studio-text-primary overflow-x-auto max-h-72 select-text">
                {gcodeText}
              </pre>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl studio-card">
                  <div className="text-[11px] studio-text-muted">Chiều Cao Lớp</div>
                  <div className="text-base font-bold studio-text-gold font-mono">{profile.layerHeight} mm</div>
                </div>
                <div className="p-3 rounded-xl studio-card">
                  <div className="text-[11px] studio-text-muted">Tốc Độ In</div>
                  <div className="text-base font-bold studio-text-primary font-mono">{profile.printSpeed} mm/s</div>
                </div>
                <div className="p-3 rounded-xl studio-card">
                  <div className="text-[11px] studio-text-muted">Mật Độ Ruột</div>
                  <div className="text-base font-bold studio-text-primary font-mono">
                    {profile.infillDensity}% ({profile.infillType})
                  </div>
                </div>
                <div className="p-3 rounded-xl studio-card">
                  <div className="text-[11px] studio-text-muted">Nhiệt Đầu Phun / Bàn</div>
                  <div className="text-base font-bold studio-text-gold font-mono">
                    {profile.nozzleTemp}°C / {profile.bedTemp}°C
                  </div>
                </div>
                <div className="p-3 rounded-xl studio-card">
                  <div className="text-[11px] studio-text-muted">Chế Độ Support</div>
                  <div className="text-base font-bold studio-text-primary capitalize font-mono">
                    {profile.supportMode}
                  </div>
                </div>
                <div className="p-3 rounded-xl studio-card">
                  <div className="text-[11px] studio-text-muted">Chi Phí Sản Xuất</div>
                  <div className="text-base font-bold studio-text-gold font-mono">
                    {metrics.estimatedCostVnd.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl studio-card text-xs studio-text-secondary flex items-center gap-2">
                <IconCheckShield className="w-4 h-4 studio-text-gold shrink-0" />
                <span>
                  Profile đã qua thuật toán kiểm thử tự động, tối ưu hóa cấu trúc chống đỡ và độ bám bàn in PEI.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 border-t studio-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncToHub}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl studio-gold-badge hover:opacity-90 text-xs font-bold transition-all cursor-pointer"
              title="Gửi bộ thông số này đồng bộ về Studio 3D Hub"
            >
              <span>{isSynced ? '✓ Đã Đồng Bộ Sang 3D Hub!' : 'Đồng Bộ Sang 3D Hub'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl studio-pill-inactive text-xs font-bold transition-all cursor-pointer"
            >
              <span>{isCopied ? '✓ Đã Sao Chép!' : 'Sao Chép Thông Số'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl studio-cta-primary font-bold text-xs transition-all active:scale-95 cursor-pointer"
            >
              <IconExport className="w-4 h-4" />
              <span>{activeTab === '3mf_stl' ? 'Tải File .3MF Ngay' : 'Tải File Về Máy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

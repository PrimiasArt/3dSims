import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Box,
  Upload,
  HardDrive,
  Sparkles,
  Layers,
  CheckCircle2,
  FileCode,
  FolderOpen,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import { ISampleModel } from '@/types/simulator';
import { SAMPLE_MODELS, parseCADFile } from '@/services/sampleModels';
import { fetchUserModels, IUserModelInfo } from '@/services/localSlicerService';

interface ModelLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: ISampleModel;
  onSelectSample: (model: ISampleModel) => void;
  onLoadCustomGeometry: (geom: any, modelInfo: ISampleModel, rawBuffer?: ArrayBuffer) => void;
}

export function ModelLibraryModal({
  isOpen,
  onClose,
  currentModel,
  onSelectSample,
  onLoadCustomGeometry,
}: ModelLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<'local' | 'sample'>('local');
  const [userModels, setUserModels] = useState<IUserModelInfo[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tải danh sách model trên máy tính khi mở modal
  const reloadUserModels = () => {
    setIsLoadingLocal(true);
    setErrorMessage(null);
    fetchUserModels()
      .then((models) => {
        setUserModels(models);
        setIsLoadingLocal(false);
      })
      .catch((err) => {
        console.warn('Lỗi quét model:', err);
        setIsLoadingLocal(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      reloadUserModels();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Lọc model theo tìm kiếm
  const filteredUserModels = userModels.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSamples = SAMPLE_MODELS.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Xử lý nạp file model cục bộ từ endpoint /api/slicer/model-file
  const handleLoadLocalModel = async (model: IUserModelInfo) => {
    setLoadingModelId(model.id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/slicer/model-file?path=${encodeURIComponent(model.path)}`);
      if (!res.ok) {
        throw new Error(`Không thể tải file (Mã HTTP ${res.status})`);
      }
      const buffer = await res.arrayBuffer();
      const geom = parseCADFile(buffer, model.fileName);

      geom.computeBoundingBox();
      const bbox = geom.boundingBox!;
      const dimX = Math.round(bbox.max.x - bbox.min.x);
      const dimY = Math.round(bbox.max.y - bbox.min.y);
      const dimZ = Math.round(bbox.max.z - bbox.min.z);

      const sampleModelObj: any = {
        id: 'usr-' + model.id,
        name: model.name,
        path: model.path,
        description: `Mô hình ${model.extension.toUpperCase()} (${dimX} x ${dimY} x ${dimZ} mm) nạp trực tiếp từ máy tính (${model.fileName})`,
        category: model.category,
        geometryType: 'custom' as any,
        defaultProfileId: 'bambu-standard',
        dimensionsMm: [dimX, dimY, dimZ],
        estimatedWeightGrams: Math.round(dimX * dimY * dimZ * 0.00045 * 1.24 * 10) / 10,
        accentBadge: model.extension.toUpperCase() + ` (${model.sizeMb})`,
      };

      onLoadCustomGeometry(geom, sampleModelObj, buffer);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi nạp model:', err);
      setErrorMessage(err.message || 'Lỗi khi giải mã mô hình 3D.');
    } finally {
      setLoadingModelId(null);
    }
  };

  // Xử lý tải file trực tiếp từ máy tính qua input file
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingModelId('uploading');
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (!buffer) {
        setLoadingModelId(null);
        return;
      }

      try {
        const geom = parseCADFile(buffer, file.name);
        geom.computeBoundingBox();
        const bbox = geom.boundingBox!;
        const dimX = Math.round(bbox.max.x - bbox.min.x);
        const dimY = Math.round(bbox.max.y - bbox.min.y);
        const dimZ = Math.round(bbox.max.z - bbox.min.z);

        const sampleModelObj: ISampleModel = {
          id: 'custom-' + Date.now(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          description: `Mô hình 3D nạp từ máy tính (${dimX} x ${dimY} x ${dimZ} mm)`,
          category: 'Tải Lên Trực Tiếp',
          geometryType: 'custom' as any,
          defaultProfileId: 'bambu-standard',
          dimensionsMm: [dimX, dimY, dimZ],
          estimatedWeightGrams: Math.round(dimX * dimY * dimZ * 0.00045 * 1.24 * 10) / 10,
          accentBadge: file.name.toUpperCase().endsWith('.3MF')
            ? 'Bambu 3MF'
            : file.name.toUpperCase().endsWith('.OBJ')
            ? 'File OBJ'
            : 'File STL',
        };

        onLoadCustomGeometry(geom, sampleModelObj, buffer);
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Không thể giải mã file 3D.');
      } finally {
        setLoadingModelId(null);
        if (e.target) e.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900/95 border border-white/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/20">
              <Box className="w-5 h-5 font-black" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Kho Mô Hình 3D & Bộ Chọn File
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Bambu 3MF / STL / OBJ
                </span>
              </h2>
              <p className="text-xs text-white/60">
                Nạp trực tiếp các file 3MF từ máy tính với thuật toán Tree Support Bambu Lab tự động
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Tabs & Search & Direct Upload */}
        <div className="p-4 border-b border-white/10 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('local')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'local'
                  ? 'bg-teal-400 text-slate-950 shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>File Trên Máy Tính ({userModels.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sample')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'sample'
                  ? 'bg-teal-400 text-slate-950 shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mẫu Thử Chuẩn ({SAMPLE_MODELS.length})</span>
            </button>
          </div>

          {/* Search Input & Action Buttons */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên mô hình, định dạng..."
                className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-teal-400/50 transition-all"
              />
            </div>

            {/* Nút Refresh danh sách file trên máy */}
            {activeTab === 'local' && (
              <button
                onClick={reloadUserModels}
                disabled={isLoadingLocal}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
                title="Quét lại thư mục Downloads"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLocal ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Nút Upload Trực Tiếp */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".3mf,.stl,.obj"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black transition-all active:scale-95 shadow-lg shadow-teal-500/20 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 font-bold" />
              <span>Tải File 3D</span>
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-white/60 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Body: Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'local' ? (
            <div>
              {isLoadingLocal ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-white/50">
                  <RefreshCw className="w-8 h-8 animate-spin text-teal-400" />
                  <p className="text-xs">Đang quét các file 3MF, STL trong thư mục Downloads...</p>
                </div>
              ) : filteredUserModels.length === 0 ? (
                <div className="py-16 text-center text-white/50 flex flex-col items-center gap-3">
                  <FolderOpen className="w-10 h-10 text-white/30" />
                  <p className="text-sm font-semibold">Không tìm thấy file phù hợp</p>
                  <p className="text-xs text-white/40">
                    Bấm "Tải File 3D" để duyệt file .3mf, .stl, .obj bất kỳ trên máy tính
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredUserModels.map((m) => {
                    const isSelected = currentModel.name.includes(m.name) || currentModel.id.includes(m.id);
                    const isLoadingThis = loadingModelId === m.id;

                    return (
                      <div
                        key={`user-model-${m.path}-${m.name}`}
                        onClick={() => handleLoadLocalModel(m)}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-teal-500/15 border-teal-400/50 shadow-lg shadow-teal-500/10'
                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                m.extension === '3mf'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                                  : m.extension === 'stl'
                                  ? 'bg-teal-500/20 text-teal-300 border-teal-400/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                              }`}
                            >
                              {m.extension.toUpperCase()} • {m.sizeMb}
                            </span>

                            <span className="text-[10px] text-white/50 truncate max-w-[150px]">
                              {m.category}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors line-clamp-1">
                            {m.name}
                          </h3>
                          <p className="text-[11px] text-white/50 font-mono truncate mt-0.5">
                            {m.fileName}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <span className="text-[10px] text-white/40">
                            {m.extension === '3mf' ? 'Hỗ trợ Tree Support Bambu' : 'Lưới chuẩn'}
                          </span>

                          <button
                            onClick={() => handleLoadLocalModel(m)}
                            disabled={isLoadingThis}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-400 text-slate-950 font-black'
                                : 'bg-white/10 hover:bg-teal-400 hover:text-slate-950 text-white'
                            }`}
                          >
                            {isLoadingThis ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Đang nạp...</span>
                              </>
                            ) : isSelected ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đang Chọn</span>
                              </>
                            ) : (
                              <>
                                <span>Chọn Nạp</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSamples.map((sample) => {
                const isSelected = currentModel.id === sample.id;

                return (
                  <div
                    key={sample.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-teal-500/15 border-teal-400/50 shadow-lg shadow-teal-500/10'
                        : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                          {sample.accentBadge}
                        </span>
                        <span className="text-[10px] text-white/50">{sample.category}</span>
                      </div>

                      <h3 className="text-sm font-bold text-white mb-1">{sample.name}</h3>
                      <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                        {sample.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[10px] font-mono text-white/40">
                        {sample.dimensionsMm.join(' x ')} mm • ~{sample.estimatedWeightGrams}g
                      </span>

                      <button
                        onClick={() => {
                          onSelectSample(sample);
                          onClose();
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-400 text-slate-950 font-black'
                            : 'bg-white/10 hover:bg-teal-400 hover:text-slate-950 text-white'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đang Chọn</span>
                          </>
                        ) : (
                          <>
                            <span>Chọn Nạp</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Notice */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-xs text-white/50 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>
              Mô hình 3MF sau khi nạp sẽ được căn chỉnh tự động bám mặt bàn in PEI (Y=0) và kích hoạt Tree Support Bambu Studio.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

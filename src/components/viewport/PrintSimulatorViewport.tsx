import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  ISimulationProfile,
  ISimulationState,
  IPreflightReport,
  SlicerRenderMode,
  IModelTransform,
  ISampleModel,
  ViewportDisplayMode,
} from '@/types/simulator';
import { ISlicingMetrics } from '@/services/slicingEngine';
import { generateDefect3DGroup, getActiveDefectAlert } from '@/services/defectSimulation';
import { layerSliceCache, createSliceToolpathMeshes } from '@/services/meshSlicer';
import { generateBambuSupportStructures } from '@/services/supportGenerator';
import {
  loadNativeBambuSupport,
  getCachedNativeSupport,
  buildNativeSupportMesh,
  loadFullBambuToolpaths,
  buildFullFilamentPreviewMesh,
} from '@/services/nativeSupportLoader';
import { BuildPlateToolbar } from './BuildPlateToolbar';
import {
  Flame,
  AlertTriangle,
  Sparkles,
  Wand2,
  ChevronUp,
  ChevronDown,
  UploadCloud,
  CheckCircle2,
  X,
} from 'lucide-react';

interface PrintSimulatorViewportProps {
  geometry: THREE.BufferGeometry;
  profile: ISimulationProfile;
  simulationState: ISimulationState;
  slicingMetrics: ISlicingMetrics;
  preflightReport: IPreflightReport;
  showHeatmap: boolean;
  showToolhead: boolean;
  showSupport: boolean;
  cameraView: 'iso' | 'top' | 'front' | 'nozzle';
  renderMode: SlicerRenderMode;
  viewMode?: ViewportDisplayMode;
  onToggleViewMode?: (mode: ViewportDisplayMode) => void;
  modelTransform: IModelTransform;
  onChangeTransform: (newTransform: IModelTransform) => void;
  onResetTransform: () => void;
  onAutoLayFlat: () => void;
  onStepLayer: (delta: number) => void;
  onScrubProgress: (progress: number) => void;
  onApplyFix: (patch: Partial<ISimulationProfile>) => void;
  onUploadFile: (file: File) => void;
  onRegisterCaptureSnapshot?: (fn: () => string | null) => void;
  isSmoothTimelapseActive?: boolean;
  currentModel?: ISampleModel;
}

export function PrintSimulatorViewport({
  geometry,
  profile,
  simulationState,
  slicingMetrics,
  preflightReport,
  showHeatmap,
  showToolhead,
  showSupport,
  cameraView,
  renderMode,
  viewMode = 'filament_preview',
  onToggleViewMode,
  modelTransform,
  onChangeTransform,
  onResetTransform,
  onAutoLayFlat,
  onStepLayer,
  onScrubProgress,
  onApplyFix,
  onUploadFile,
  onRegisterCaptureSnapshot,
  isSmoothTimelapseActive,
  currentModel,
}: PrintSimulatorViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const modelRootGroupRef = useRef<THREE.Group | null>(null);
  const modelMeshRef = useRef<THREE.Mesh | null>(null);
  const ghostMeshRef = useRef<THREE.Mesh | null>(null);
  const fullFilamentGroupRef = useRef<THREE.Group | null>(null);
  const clippingPlaneRef = useRef<THREE.Plane | null>(null);
  const toolheadGroupRef = useRef<THREE.Group | null>(null);
  const gantryBarRef = useRef<THREE.Mesh | null>(null);
  const activeSliceGroupRef = useRef<THREE.Group | null>(null);
  const supportGroupRef = useRef<THREE.Group | null>(null);
  const defectGroupRef = useRef<THREE.Group | null>(null);
  const footprintMeshRef = useRef<THREE.Mesh | null>(null);
  const lastRenderedLayerRef = useRef<number>(-1);

  const transformControlsRef = useRef<TransformControls | null>(null);
  const [activeGizmoMode, setActiveGizmoMode] = useState<'move' | 'rotate' | 'scale' | null>(null);

  const onChangeTransformRef = useRef(onChangeTransform);
  onChangeTransformRef.current = onChangeTransform;
  const modelTransformRef = useRef(modelTransform);
  modelTransformRef.current = modelTransform;

  // Model Drag on Build Plate Refs
  const isDraggingModelRef = useRef(false);
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffsetRef = useRef(new THREE.Vector3());
  const raycasterRef = useRef(new THREE.Raycaster());
  const mousePosRef = useRef(new THREE.Vector2());

  // Drag & Drop State
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [fixedNotice, setFixedNotice] = useState<string | null>(null);
  const [isDefectDismissed, setIsDefectDismissed] = useState(false);
  const [showSlicingLegend, setShowSlicingLegend] = useState(true);

  // Live Defect Alert at current layer
  const activeDefect = useMemo(() => {
    return getActiveDefectAlert(
      simulationState.currentLayer,
      simulationState.totalLayers,
      profile,
      preflightReport
    );
  }, [simulationState.currentLayer, simulationState.totalLayers, profile, preflightReport]);

  useEffect(() => {
    setIsDefectDismissed(false);
  }, [simulationState.currentLayer]);

  // 1. Khởi tạo Three.js Scene, Camera, Lights, Bed
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1.1 Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080a10);
    scene.fog = new THREE.FogExp2(0x080a10, 0.0018);
    sceneRef.current = scene;
    (window as any).__scene = scene;

    // 1.2 Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(115, 100, 140);
    cameraRef.current = camera;

    // 1.3 Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.localClippingEnabled = true;

    // Dọn dẹp sạch mọi canvas cũ (ngăn ngừa duplicate canvas do React StrictMode)
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Đăng ký callback chụp ảnh Canvas HD cho Timelapse Studio
    if (onRegisterCaptureSnapshot) {
      onRegisterCaptureSnapshot(() => {
        if (!rendererRef.current) return null;
        return rendererRef.current.domElement.toDataURL('image/png');
      });
    }

    // 1.4 Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 20;
    controls.maxDistance = 850;
    controls.target.set(0, 18, 0);
    controlsRef.current = controls;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.85;
    transformControls.space = 'local';
    const gizmoHelper = typeof (transformControls as any).getHelper === 'function'
      ? (transformControls as any).getHelper()
      : transformControls;
    scene.add(gizmoHelper);
    transformControlsRef.current = transformControls;

    transformControls.addEventListener('dragging-changed', (event: any) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value;
      }
    });

    transformControls.addEventListener('objectChange', () => {
      if (!modelRootGroupRef.current) return;
      const rot = modelRootGroupRef.current.rotation;
      const pos = modelRootGroupRef.current.position;
      onChangeTransformRef.current({
        ...modelTransformRef.current,
        rotation: [rot.x, rot.y, rot.z],
        position: [pos.x, 0, pos.z],
      });
    });

    // 1.5 Professional Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    mainKeyLight.position.set(90, 160, 100);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 2048;
    mainKeyLight.shadow.mapSize.height = 2048;
    mainKeyLight.shadow.bias = -0.0001;
    scene.add(mainKeyLight);

    const cyanRimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    cyanRimLight.position.set(-100, 80, -90);
    scene.add(cyanRimLight);

    const warmFillLight = new THREE.DirectionalLight(0xf59e0b, 0.5);
    warmFillLight.position.set(0, -30, 80);
    scene.add(warmFillLight);

    // 1.6 Textured PEI Build Plate (256x256mm Bambu / Voron standard)
    const bedGroup = createHeatedBedPlate();
    scene.add(bedGroup);

    // 1.7 Clipping Plane (Cắt lớp mô hình theo chiều cao trục Y)
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);
    clippingPlaneRef.current = clipPlane;

    // 1.8 CoreXY Gantry Bar (Thanh trượt trục X carbon)
    const gantryGeom = new THREE.CylinderGeometry(2, 2, 260, 16);
    gantryGeom.rotateZ(Math.PI / 2);
    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const gantryBar = new THREE.Mesh(gantryGeom, gantryMat);
    gantryBar.castShadow = true;
    scene.add(gantryBar);
    gantryBarRef.current = gantryBar;

    // 1.9 Virtual Toolhead & Downward Task Spotlight
    const toolhead = createVirtualToolhead();
    toolheadGroupRef.current = toolhead;
    scene.add(toolhead);

    // 1.9.5 Root Model Group (Chứa toàn bộ cụm mô hình, support, brim để di chuyển đồng bộ)
    const modelRootGroup = new THREE.Group();
    modelRootGroup.name = 'model_root_group';
    scene.add(modelRootGroup);
    modelRootGroupRef.current = modelRootGroup;

    // 1.10 Active Slice Group (Chứa đường toolpath perimeters + infill trên mặt cắt)
    const activeSliceGroup = new THREE.Group();
    modelRootGroup.add(activeSliceGroup);
    activeSliceGroupRef.current = activeSliceGroup;

    // 1.11 Window Resize Listener
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 1.12 Render & Animation Loop
    let animId: number;
    const startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      const elapsedTime = (performance.now() - startTime) / 1000;

      // Hiệu ứng cánh quạt làm mát quay khi đang in
      if (toolheadGroupRef.current) {
        const fan = toolheadGroupRef.current.getObjectByName('cooling_fan');
        if (fan && simulationState.isPlaying) {
          fan.rotation.y += 0.35;
        }

        // Đèn LED đầu phun thở nhẹ
        const ledRing = toolheadGroupRef.current.getObjectByName('led_ring') as THREE.Mesh;
        if (ledRing && ledRing.material instanceof THREE.MeshStandardMaterial) {
          const pulse = 0.85 + Math.sin(elapsedTime * 4) * 0.2;
          ledRing.material.emissiveIntensity = pulse;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      transformControls.dispose();
      scene.remove(gizmoHelper as any);
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Cập nhật Model Meshes khi Geometry, Profile, hoặc RenderMode đổi
  useEffect(() => {
    if (!sceneRef.current) return;
    const parentGroup = modelRootGroupRef.current || sceneRef.current;

    // Dọn dẹp model cũ
    if (modelMeshRef.current) {
      parentGroup.remove(modelMeshRef.current);
      modelMeshRef.current.geometry.dispose();
      if (Array.isArray(modelMeshRef.current.material)) {
        modelMeshRef.current.material.forEach((m) => m.dispose());
      } else {
        modelMeshRef.current.material.dispose();
      }
      modelMeshRef.current = null;
    }

    if (ghostMeshRef.current) {
      parentGroup.remove(ghostMeshRef.current);
      ghostMeshRef.current.geometry.dispose();
      if (Array.isArray(ghostMeshRef.current.material)) {
        ghostMeshRef.current.material.forEach((m) => m.dispose());
      } else {
        ghostMeshRef.current.material.dispose();
      }
      ghostMeshRef.current = null;
    }

    // Đảm bảo model đứng chính xác trên bàn in (Y min = 0)
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox || new THREE.Box3();
    const minY = bbox.min.y;

    const clonedGeom = geometry.clone();
    clonedGeom.translate(0, -minY, 0);

    // Chuẩn bị Vertex Colors nếu ở chế độ Heatmap / Defects / Speed
    const isHeatmapActive = showHeatmap || renderMode === 'defects' || renderMode === 'speed';
    if (isHeatmapActive) {
      applyColorMap(clonedGeom, renderMode);
    }

    // 2.1 Ghost Preview Mesh (Khung hình 3D hoàn chỉnh siêu nét phong cách Hologram Slicer)
    // Giúp người dùng LUÔN thấy rõ toàn bộ mô hình trên bàn in ngay từ đầu
    const ghostMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      roughness: 0.25,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const ghostMesh = new THREE.Mesh(clonedGeom, ghostMaterial);
    ghostMesh.visible = viewMode !== 'filament_preview' && simulationState.currentProgress < 0.999;

    // Thêm đường viền Wireframe mảnh làm nổi bật các góc cạnh của mô hình
    const ghostWireMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const ghostWireMesh = new THREE.Mesh(clonedGeom, ghostWireMat);
    ghostMesh.add(ghostWireMesh);

    parentGroup.add(ghostMesh);
    ghostMeshRef.current = ghostMesh;

    // 2.2 Solid Printed Mesh (Thân vật in đặc, cắt lớp bởi ClippingPlane)
    let materialColor = new THREE.Color(profile.materialColor);
    if (renderMode === 'features') {
      materialColor = new THREE.Color(0xff6b00); // Màu tường ngoài chuẩn Slicer (Orange)
    }

    const printedMaterial = new THREE.MeshStandardMaterial({
      color: isHeatmapActive ? 0xffffff : materialColor,
      vertexColors: isHeatmapActive,
      roughness: profile.material === 'PLA' ? 0.32 : profile.material === 'PETG' ? 0.22 : 0.55,
      metalness: profile.material === 'PLA-CF' ? 0.35 : 0.08,
      clippingPlanes: clippingPlaneRef.current ? [clippingPlaneRef.current] : [],
      clipShadows: true,
      side: THREE.DoubleSide,
    });

    const printedMesh = new THREE.Mesh(clonedGeom, printedMaterial);
    printedMesh.visible = viewMode !== 'filament_preview';
    printedMesh.castShadow = true;
    printedMesh.receiveShadow = true;
    parentGroup.add(printedMesh);
    modelMeshRef.current = printedMesh;

    (window as any).__THREE__ = THREE;
    (window as any).__DEBUG_THREE__ = {
      scene: sceneRef.current,
      camera: cameraRef.current,
      controls: controlsRef.current,
      printedMesh,
      ghostMesh,
      clippingPlane: clippingPlaneRef.current,
    };

    // 2.3 Cập nhật Khuyết Tật 3D Trực Quan (Spaghetti & Warping Peel)
    if (defectGroupRef.current) {
      parentGroup.remove(defectGroupRef.current);
      defectGroupRef.current = null;
    }

    // Khi ở chế độ 'defects' hoặc khi có lỗi nghiêm trọng, đính kèm mô hình lỗi thực tế
    const showVisualDefects = renderMode === 'defects' || preflightReport.printabilityScore < 85;
    if (showVisualDefects) {
      const defects = generateDefect3DGroup(clonedGeom, profile, slicingMetrics, preflightReport);
      parentGroup.add(defects);
      defectGroupRef.current = defects;
    }

    // 2.4 Cập nhật Support & Brim
    const supportGroup = updateSupportStructures(
      parentGroup,
      clonedGeom,
      profile,
      showSupport && viewMode !== 'filament_preview',
      currentModel?.name || currentModel?.id,
      (currentModel as any)?.path
    );
    supportGroupRef.current = supportGroup;

    // 2.4.5 Cập nhật Full Filament Toolpath Preview (Bambu Studio Toolpaths)
    const removeExistingFilament = () => {
      let old: THREE.Object3D | undefined;
      while ((old = parentGroup.getObjectByName('full_filament_preview_group')) !== undefined) {
        parentGroup.remove(old);
        old.traverse((c) => {
          if (c instanceof THREE.LineSegments || c instanceof THREE.Points || c instanceof THREE.Mesh) {
            c.geometry.dispose();
            if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
            else c.material.dispose();
          }
        });
      }
      fullFilamentGroupRef.current = null;
    };
    removeExistingFilament();

    loadFullBambuToolpaths(currentModel?.name || currentModel?.id, (currentModel as any)?.path).then((toolpathsData) => {
      if (!sceneRef.current || !parentGroup) return;
      if (toolpathsData && toolpathsData.outerWalls && toolpathsData.outerWalls.length > 0) {
        removeExistingFilament();
        const filamentGroup = buildFullFilamentPreviewMesh(toolpathsData);
        filamentGroup.visible = viewMode === 'filament_preview';
        parentGroup.add(filamentGroup);
        fullFilamentGroupRef.current = filamentGroup;

        // Cập nhật drawRange ngay cho layer hiện tại
        if (filamentGroup.userData?.updateLayer) {
          filamentGroup.userData.updateLayer(
            simulationState.currentLayer,
            simulationState.currentProgress,
            clippingPlaneRef.current || undefined
          );
        }
      } else {
        removeExistingFilament();
        if (modelMeshRef.current) modelMeshRef.current.visible = true;
      }
    });

    // 2.5 Vòng định vị chân đế mô hình trên bàn in (Bed Footprint Highlight)
    if (footprintMeshRef.current) {
      parentGroup.remove(footprintMeshRef.current);
      footprintMeshRef.current.geometry.dispose();
      footprintMeshRef.current = null;
    }

    const footBbox = clonedGeom.boundingBox || new THREE.Box3();
    const footDimX = footBbox.max.x - footBbox.min.x;
    const footDimZ = footBbox.max.z - footBbox.min.z;
    const footCenterX = (footBbox.max.x + footBbox.min.x) / 2;
    const footCenterZ = (footBbox.max.z + footBbox.min.z) / 2;
    const footRadius = Math.max(footDimX, footDimZ) / 2 + 3;

    const ringGeom = new THREE.RingGeometry(footRadius - 0.7, footRadius + 0.3, 48);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const footprintMesh = new THREE.Mesh(ringGeom, ringMat);
    footprintMesh.position.set(footCenterX, 0.08, footCenterZ);
    parentGroup.add(footprintMesh);
    footprintMeshRef.current = footprintMesh;

    // Đồng bộ ngay lập tức vị trí/xoay/tỉ lệ hiện tại
    if (modelRootGroupRef.current) {
      modelRootGroupRef.current.position.set(
        modelTransform.position[0],
        modelTransform.position[1],
        modelTransform.position[2]
      );
      modelRootGroupRef.current.rotation.set(
        modelTransform.rotation[0],
        modelTransform.rotation[1],
        modelTransform.rotation[2]
      );
      modelRootGroupRef.current.scale.set(
        modelTransform.scale,
        modelTransform.scale,
        modelTransform.scale
      );
    }
  }, [
    geometry,
    profile.material,
    profile.materialColor,
    profile.layerHeight,
    profile.supportMode,
    profile.brimEnabled,
    showHeatmap,
    showSupport,
    renderMode,
    preflightReport,
    currentModel?.id,
    currentModel?.name,
    (currentModel as any)?.path,
  ]);

  // 2.5.5 Tự động nạp và dựng lại Tree Support & Toolpaths khi có dữ liệu mới từ Slicer
  useEffect(() => {
    const parentGroup = modelRootGroupRef.current;
    if (!parentGroup || !sceneRef.current) return;

    // 1. Nạp và đính kèm Tree Support Native từ Bambu Studio G-code
    if (profile.supportMode !== 'none') {
      loadNativeBambuSupport(currentModel?.name || currentModel?.id, (currentModel as any)?.path).then((nativeData) => {
        if (!modelRootGroupRef.current) return;
        const curSupportGroup = modelRootGroupRef.current.getObjectByName('support_structures_group');
        if (curSupportGroup && nativeData && nativeData.segments && nativeData.segments.length > 0) {
          while (curSupportGroup.children.length > 0) {
            const c = curSupportGroup.children[0];
            curSupportGroup.remove(c);
            if (c instanceof THREE.Mesh || c instanceof THREE.LineSegments) {
              c.geometry?.dispose();
              if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
              else c.material?.dispose();
            }
          }
          const nativeMesh = buildNativeSupportMesh(nativeData);
          nativeMesh.name = 'native_bambu_toolpaths';
          if (clippingPlaneRef.current) {
            nativeMesh.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mat = (child as THREE.Mesh).material;
                if (Array.isArray(mat)) mat.forEach((m) => (m.clippingPlanes = [clippingPlaneRef.current!]));
                else if (mat) mat.clippingPlanes = [clippingPlaneRef.current!];
              }
            });
          }
          curSupportGroup.add(nativeMesh);
        }
      });
    }

    // 2. Nạp và đính kèm Full Filament Toolpaths Preview
    loadFullBambuToolpaths(currentModel?.name || currentModel?.id, (currentModel as any)?.path).then((toolpathsData) => {
      if (!modelRootGroupRef.current) return;
      if (toolpathsData && toolpathsData.outerWalls && toolpathsData.outerWalls.length > 0) {
        let old: THREE.Object3D | undefined;
        while ((old = modelRootGroupRef.current.getObjectByName('full_filament_preview_group')) !== undefined) {
          modelRootGroupRef.current.remove(old);
          old.traverse((c) => {
            if (c instanceof THREE.LineSegments || c instanceof THREE.Points || c instanceof THREE.Mesh) {
              c.geometry.dispose();
              if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
              else c.material.dispose();
            }
          });
        }
        const filamentGroup = buildFullFilamentPreviewMesh(toolpathsData);
        filamentGroup.visible = viewMode === 'filament_preview';
        modelRootGroupRef.current.add(filamentGroup);
        fullFilamentGroupRef.current = filamentGroup;

        if (filamentGroup.userData?.updateLayer) {
          filamentGroup.userData.updateLayer(
            simulationState.currentLayer,
            simulationState.currentProgress,
            clippingPlaneRef.current || undefined
          );
        }
      }
    });
  }, [currentModel?.id, currentModel?.name, (currentModel as any)?.path, profile.supportMode]);

  // 2.6 Đồng bộ Transform khi người dùng tương tác với Bảng Điều Khiển Bàn In hoặc Kéo chuột
  useEffect(() => {
    if (!modelRootGroupRef.current) return;
    modelRootGroupRef.current.position.set(
      modelTransform.position[0],
      modelTransform.position[1],
      modelTransform.position[2]
    );
    modelRootGroupRef.current.rotation.set(
      modelTransform.rotation[0],
      modelTransform.rotation[1],
      modelTransform.rotation[2]
    );
    modelRootGroupRef.current.scale.set(
      modelTransform.scale,
      modelTransform.scale,
      modelTransform.scale
    );
  }, [modelTransform]);

  // 2.7 Đồng bộ TransformControls Gizmo (Xoay 3D / Di chuyển X-Z)
  useEffect(() => {
    if (!transformControlsRef.current || !modelRootGroupRef.current) return;
    if (activeGizmoMode === 'rotate') {
      transformControlsRef.current.setMode('rotate');
      transformControlsRef.current.showX = true;
      transformControlsRef.current.showY = true;
      transformControlsRef.current.showZ = true;
      transformControlsRef.current.attach(modelRootGroupRef.current);
    } else if (activeGizmoMode === 'move') {
      transformControlsRef.current.setMode('translate');
      transformControlsRef.current.showX = true;
      transformControlsRef.current.showY = false;
      transformControlsRef.current.showZ = true;
      transformControlsRef.current.attach(modelRootGroupRef.current);
    } else {
      transformControlsRef.current.detach();
    }
  }, [activeGizmoMode]);

  // 3. Cập nhật vị trí Cắt lớp, Đầu in, Gantry, và Toolpath theo Tiến trình
  useEffect(() => {
    if (!clippingPlaneRef.current || !modelMeshRef.current) return;

    const [dimX, dimY, dimZ] = slicingMetrics.boundingBox.dimensions;
    const progress = Math.min(1.0, Math.max(0.001, simulationState.currentProgress));
    const currentHeightY = progress * dimY;
    // Chỉ xem là Finished khi simulation thực sự hoàn thành và KHÔNG còn phát loop
    const isFinished = simulationState.isCompleted && !simulationState.isPlaying;
    const worldCurrentY = modelTransform.position[1] + (currentHeightY * modelTransform.scale);

    // 3.1 Cắt lớp mô hình tại độ cao hiện tại
    if (isFinished) {
      clippingPlaneRef.current.constant = 1000; // Hiển thị đầy đủ 100% mô hình hoàn thiện
      if (ghostMeshRef.current) ghostMeshRef.current.visible = false;
    } else {
      clippingPlaneRef.current.constant = worldCurrentY;
      if (ghostMeshRef.current) {
        ghostMeshRef.current.visible = true;
        // Nếu ở 0% và chưa bấm in, hiển thị mờ nhẹ nhưng rõ nét để người dùng ngắm mô hình
        if (ghostMeshRef.current.material instanceof THREE.MeshStandardMaterial) {
          ghostMeshRef.current.material.opacity = progress <= 0.005 ? 0.75 : 0.28;
        }
      }
    }

    // 3.2 Vị trí Đầu phun ảo (Virtual Toolhead) & Thanh Gantry
    const [posX, , posZ] = simulationState.toolheadPosition;
    const localVec = new THREE.Vector3(posX, 0, posZ);
    if (modelTransform.rotation[0] !== 0 || modelTransform.rotation[1] !== 0 || modelTransform.rotation[2] !== 0) {
      localVec.applyEuler(new THREE.Euler(
        modelTransform.rotation[0],
        modelTransform.rotation[1],
        modelTransform.rotation[2]
      ));
    }
    const worldTHX = (localVec.x * modelTransform.scale) + modelTransform.position[0];
    const worldTHY = worldCurrentY;
    const worldTHZ = (localVec.z * modelTransform.scale) + modelTransform.position[2];

    if (toolheadGroupRef.current) {
      toolheadGroupRef.current.visible = showToolhead && !isFinished;
      if (toolheadGroupRef.current.visible) {
        // Nếu đang ở chế độ Smooth Timelapse: Đỗ đầu in tại trạm xả Bambu Purge Chute [-110, Y, 105]
        // để camera chụp khung hình không bị vướng đầu in rung giật
        if (isSmoothTimelapseActive) {
          toolheadGroupRef.current.position.set(-110, worldCurrentY + 5, 105);
        } else if (progress <= 0.005 && !simulationState.isPlaying) {
          toolheadGroupRef.current.position.set(-110, 25, -110);
        } else {
          toolheadGroupRef.current.position.set(worldTHX, worldTHY, worldTHZ);
        }

        // Đổi màu vòng LED, thanh trạng thái và giọt nhựa theo profile hoặc render mode
        const ledRing = toolheadGroupRef.current.getObjectByName('led_ring') as THREE.Mesh;
        if (ledRing && ledRing.material instanceof THREE.MeshStandardMaterial) {
          const color = renderMode === 'defects' && activeDefect ? 0xef4444 : profile.materialColor;
          ledRing.material.emissive.set(color);
        }

        const statusLed = toolheadGroupRef.current.getObjectByName('status_led_bar') as THREE.Mesh;
        if (statusLed && statusLed.material instanceof THREE.MeshStandardMaterial) {
          const statusColor = renderMode === 'defects' && activeDefect ? 0xef4444 : 0x00e5ff;
          statusLed.material.emissive.set(statusColor);
        }

        const moltenDot = toolheadGroupRef.current.getObjectByName('molten_dot') as THREE.Mesh;
        if (moltenDot && moltenDot.material instanceof THREE.MeshBasicMaterial) {
          moltenDot.material.color.set(profile.materialColor);
        }
      }
    }

    // Thanh gantry X di chuyển theo cao độ Z
    if (gantryBarRef.current) {
      gantryBarRef.current.visible = showToolhead && !isFinished;
      if (gantryBarRef.current.visible) {
        if (isSmoothTimelapseActive) {
          gantryBarRef.current.position.set(0, worldCurrentY + 25, 105);
        } else if (progress <= 0.005 && !simulationState.isPlaying) {
          gantryBarRef.current.position.set(0, 43, -110);
        } else {
          gantryBarRef.current.position.set(0, worldTHY + 20, worldTHZ - 7);
        }
      }
    }

    // 3.3 Tạo đường Toolpath sinh động trên mặt cắt lớp hiện tại bám chuẩn 100% hình học thực tế
    // Tối ưu hóa: Chỉ tái tạo mesh khi chuyển sang Layer mới hoặc đổi chế độ hiển thị
    if (activeSliceGroupRef.current) {
      if (isFinished) {
        if (lastRenderedLayerRef.current !== -1) {
          while (activeSliceGroupRef.current.children.length > 0) {
            const obj = activeSliceGroupRef.current.children[0];
            activeSliceGroupRef.current.remove(obj);
            if (obj instanceof THREE.Line || obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
              obj.geometry.dispose();
              if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
              else obj.material.dispose();
            }
          }
          lastRenderedLayerRef.current = -1;
        }
      } else if (simulationState.currentLayer !== lastRenderedLayerRef.current) {
        while (activeSliceGroupRef.current.children.length > 0) {
          const obj = activeSliceGroupRef.current.children[0];
          activeSliceGroupRef.current.remove(obj);
          if (obj instanceof THREE.Line || obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        }

        const layerHeightY = ((simulationState.currentLayer - 0.5) / Math.max(1, slicingMetrics.totalLayers)) * dimY;
        const slice = layerSliceCache.getSlice(geometry, simulationState.currentLayer, layerHeightY, profile);
        const toolpathMeshes = createSliceToolpathMeshes(slice, profile, renderMode);
        toolpathMeshes.forEach((m) => activeSliceGroupRef.current?.add(m));
        lastRenderedLayerRef.current = simulationState.currentLayer;
      }
    }

    // 3.3.5 Đồng bộ hóa drawRange cho Filament Preview Group theo Layer hiện tại
    if (fullFilamentGroupRef.current?.userData?.updateLayer) {
      fullFilamentGroupRef.current.userData.updateLayer(
        simulationState.currentLayer,
        simulationState.currentProgress,
        clippingPlaneRef.current || undefined
      );
    }

    // 3.4 Đồng bộ Clipping Plane cho Support structures (Tree Support & Native Lines)
    if (supportGroupRef.current) {
      supportGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.LineSegments).isLineSegments) {
          const obj = child as THREE.Mesh | THREE.LineSegments;
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => {
              mat.clippingPlanes = clippingPlaneRef.current ? [clippingPlaneRef.current] : [];
            });
          } else if (obj.material) {
            obj.material.clippingPlanes = clippingPlaneRef.current ? [clippingPlaneRef.current] : [];
          }
        }
      });
    }
  }, [
    simulationState.currentProgress,
    simulationState.currentLayer,
    simulationState.toolheadPosition,
    simulationState.isPlaying,
    modelTransform,
    slicingMetrics,
    showToolhead,
    profile.materialColor,
    profile.infillType,
    renderMode,
    viewMode,
    activeDefect,
  ]);

  // 3.5 Đồng bộ hóa chế độ hiển thị View Mode (Phôi CAD mượt <-> Sợi In Thực Tế Bambu Preview)
  useEffect(() => {
    const isFilament = viewMode === 'filament_preview';

    if (isFilament && (!fullFilamentGroupRef.current || fullFilamentGroupRef.current.children.length === 0)) {
      loadFullBambuToolpaths(currentModel?.name || currentModel?.id, (currentModel as any)?.path).then((toolpathsData) => {
        if (!modelRootGroupRef.current) return;
        if (toolpathsData && toolpathsData.outerWalls && toolpathsData.outerWalls.length > 0) {
          const filamentGroup = buildFullFilamentPreviewMesh(toolpathsData);
          filamentGroup.visible = true;
          modelRootGroupRef.current.add(filamentGroup);
          fullFilamentGroupRef.current = filamentGroup;
          if (filamentGroup.userData?.updateLayer) {
            filamentGroup.userData.updateLayer(
              simulationState.currentLayer,
              simulationState.currentProgress,
              clippingPlaneRef.current || undefined
            );
          }
          if (modelMeshRef.current) modelMeshRef.current.visible = false;
          if (ghostMeshRef.current) ghostMeshRef.current.visible = false;
          if (supportGroupRef.current) supportGroupRef.current.visible = false;
        }
      });
    }

    const hasFilamentData = !!(fullFilamentGroupRef.current && fullFilamentGroupRef.current.children.length > 0);
    const showFilament = isFilament && hasFilamentData;

    if (fullFilamentGroupRef.current) {
      fullFilamentGroupRef.current.visible = showFilament;
      if (showFilament && fullFilamentGroupRef.current.userData?.updateLayer) {
        fullFilamentGroupRef.current.userData.updateLayer(
          simulationState.currentLayer,
          simulationState.currentProgress,
          clippingPlaneRef.current || undefined
        );
      }
    }
    if (modelMeshRef.current) {
      modelMeshRef.current.visible = !showFilament;
    }
    if (ghostMeshRef.current) {
      ghostMeshRef.current.visible = !showFilament && simulationState.currentProgress < 0.999;
    }
    if (supportGroupRef.current) {
      supportGroupRef.current.visible = !showFilament && showSupport;
    }
    if (activeSliceGroupRef.current) {
      activeSliceGroupRef.current.visible = !showFilament;
    }
  }, [
    viewMode,
    showSupport,
    simulationState.currentLayer,
    simulationState.currentProgress,
    currentModel?.id,
    currentModel?.name,
    (currentModel as any)?.path,
  ]);

  // 4. Đồng bộ Góc nhìn Camera từ Header (Preset Camera Angles)
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;

    const [dimX, dimY, dimZ] = slicingMetrics.boundingBox.dimensions;
    const target = new THREE.Vector3(0, dimY / 2, 0);

    switch (cameraView) {
      case 'top':
        cameraRef.current.position.set(0, Math.max(160, Math.max(dimX, dimZ) * 2.2), 0.001);
        controlsRef.current.target.set(0, 0, 0);
        break;
      case 'front':
        cameraRef.current.position.set(0, target.y, Math.max(150, Math.max(dimX, dimY) * 2.2));
        controlsRef.current.target.copy(target);
        break;
      case 'nozzle':
        if (toolheadGroupRef.current) {
          const thPos = toolheadGroupRef.current.position;
          cameraRef.current.position.set(thPos.x + 30, thPos.y + 25, thPos.z + 35);
          controlsRef.current.target.set(thPos.x, thPos.y, thPos.z);
        }
        break;
      case 'iso':
      default: {
        const maxD = Math.max(dimX, dimY, dimZ);
        const distScale = Math.max(1.0, maxD / 65);
        cameraRef.current.position.set(115 * distScale, Math.max(80, 100 * distScale), 140 * distScale);
        controlsRef.current.target.copy(target);
        break;
      }
    }
    controlsRef.current.update();
  }, [cameraView, slicingMetrics]);

  // Kéo thả file STL / OBJ
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  // Tương tác chuột kéo rê mô hình trực tiếp trên bàn in (Bed Dragging)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !containerRef.current || !cameraRef.current || !modelRootGroupRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mousePosRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mousePosRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(modelRootGroupRef.current.children, true);

    if (intersects.length > 0) {
      isDraggingModelRef.current = true;
      if (controlsRef.current) controlsRef.current.enabled = false;

      const intersectPoint = new THREE.Vector3();
      raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint);
      if (intersectPoint) {
        dragOffsetRef.current.set(
          modelTransform.position[0] - intersectPoint.x,
          0,
          modelTransform.position[2] - intersectPoint.z
        );
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mousePosRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (isDraggingModelRef.current) {
      raycasterRef.current.setFromCamera(mousePosRef.current, cameraRef.current);
      const intersectPoint = new THREE.Vector3();
      raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint);

      if (intersectPoint) {
        const targetX = intersectPoint.x + dragOffsetRef.current.x;
        const targetZ = intersectPoint.z + dragOffsetRef.current.z;

        const clampedX = Math.round(Math.max(-105, Math.min(105, targetX)));
        const clampedZ = Math.round(Math.max(-105, Math.min(105, targetZ)));

        onChangeTransform({
          ...modelTransform,
          position: [clampedX, 0, clampedZ],
        });
      }
    } else if (modelRootGroupRef.current && containerRef.current) {
      raycasterRef.current.setFromCamera(mousePosRef.current, cameraRef.current);
      const hits = raycasterRef.current.intersectObjects(modelRootGroupRef.current.children, true);
      containerRef.current.style.cursor = hits.length > 0 ? 'grab' : 'default';
    }
  };

  const handlePointerUp = () => {
    if (isDraggingModelRef.current) {
      isDraggingModelRef.current = false;
      if (controlsRef.current) controlsRef.current.enabled = true;
      if (containerRef.current) containerRef.current.style.cursor = 'grab';
    }
  };

  const handleExecuteAutoFix = (action: Partial<ISimulationProfile>) => {
    onApplyFix(action);
    setFixedNotice('✓ Đã áp dụng bản vá AI: Bật Tree Support & tối ưu nhiệt độ!');
    setTimeout(() => setFixedNotice(null), 3500);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-[#080a10]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Three.js Canvas Container với sự kiện tương tác kéo thả trên bàn in */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Bảng Điều Khiển Tương Tác Bàn In (Build Plate Toolbar Slicer) */}
      <BuildPlateToolbar
        transform={modelTransform}
        dimensions={slicingMetrics.boundingBox.dimensions}
        onChangeTransform={onChangeTransform}
        onResetTransform={onResetTransform}
        onAutoLayFlat={onAutoLayFlat}
        activeGizmoMode={activeGizmoMode}
        onToggleGizmoMode={setActiveGizmoMode}
      />

      {/* Drag & Drop Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-40 bg-teal-950/80 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-teal-400 m-4 rounded-3xl animate-in fade-in">
          <UploadCloud className="w-16 h-16 text-teal-300 animate-bounce mb-3" />
          <h2 className="text-xl font-black text-white">Thả file STL / OBJ vào đây</h2>
          <p className="text-sm text-teal-200 mt-1">Hệ thống sẽ tự động bóc tách lớp và chạy mô phỏng in 3D ngay</p>
        </div>
      )}

      {/* Vertical Layer Slicer Slider (Bên phải màn hình - Chuẩn Slicer) */}
      <div className="absolute right-4 top-24 bottom-32 z-20 flex flex-col items-center justify-between p-2 rounded-2xl glass-panel border border-white/15 backdrop-blur-xl shadow-2xl pointer-events-auto w-12">
        <button
          onClick={() => onStepLayer(10)}
          className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
          title="Nhảy tới 10 lớp"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* Vertical Range Track */}
        <div className="flex-1 flex flex-col items-center justify-center my-2 relative w-full">
          <input
            data-testid="vertical-layer-slider"
            type="range"
            min="1"
            max={simulationState.totalLayers}
            value={simulationState.currentLayer}
            onChange={(e) => onScrubProgress(Number(e.target.value) / simulationState.totalLayers)}
            className="w-40 -rotate-90 cursor-pointer accent-teal-400"
            title="Kéo trượt dọc để duyệt từng lớp cắt (Layer by Layer)"
          />
        </div>

        <div className="text-center font-mono">
          <div className="text-[10px] text-teal-300 font-black">L{simulationState.currentLayer}</div>
          <div className="text-[8px] text-white/40">/{simulationState.totalLayers}</div>
        </div>

        <button
          onClick={() => onStepLayer(-10)}
          className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer mt-1"
          title="Lùi lại 10 lớp"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Bambu Studio "Slicing Result" Legend Card (Chuẩn xác như màn hình Bambu Studio trong video của người dùng) */}
      <div className="absolute top-20 right-20 z-10 pointer-events-auto select-none transition-all">
        {showSlicingLegend ? (
          <div className="w-64 rounded-2xl glass-panel border border-white/20 bg-slate-950/85 p-3.5 shadow-2xl backdrop-blur-2xl text-xs space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00e050] animate-pulse" />
                <span className="font-black text-white text-xs tracking-wide">Slicing Result</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">Bambu</span>
              </div>
              <button
                onClick={() => setShowSlicingLegend(false)}
                className="text-white/40 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                title="Thu gọn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/50">Color Scheme:</span>
              <span className="font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {viewMode === 'filament_preview' ? 'Filament Lines' : 'Line Type'}
              </span>
            </div>

            {/* Bảng mã màu các loại đường in chuẩn Bambu Studio */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] font-medium pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#00e050] shrink-0" />
                <span className="text-white/90 font-bold truncate">Tường ngoài</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#047857] shrink-0" />
                <span className="text-white/80 truncate">Tường trong</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.6)] shrink-0" />
                <span className="text-amber-300 font-bold truncate">Ruột Infill ({profile.infillDensity}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981] shrink-0" />
                <span className="text-emerald-300 font-bold truncate">Tree Support</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#d946ef] shrink-0" />
                <span className="text-fuchsia-300 truncate">Interface</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#c026d3] shrink-0" />
                <span className="text-purple-300 truncate">Vành Brim</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffffff] ring-1 ring-white/60 shrink-0" />
                <span className="text-white font-bold truncate">Mối nối Seam</span>
              </div>
            </div>

            {/* Thông số tiêu hao nhựa & Thời gian in từ Bambu Studio */}
            <div className="border-t border-white/10 pt-2 space-y-1 font-mono text-[10px]">
              <div className="flex items-center justify-between text-white/70">
                <span>Vật in (Model):</span>
                <span className="text-white font-bold">44.5 g</span>
              </div>
              <div className="flex items-center justify-between text-emerald-400">
                <span>Cây đỡ (Support):</span>
                <span className="font-bold">6.1 g</span>
              </div>
              <div className="flex items-center justify-between text-teal-300 pt-1 border-t border-white/5">
                <span className="font-bold">Tổng Nhựa:</span>
                <span className="font-black text-xs">50.6 g (17.1m)</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowSlicingLegend(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel border border-white/20 bg-slate-950/80 text-white hover:border-teal-400/50 shadow-xl backdrop-blur-xl text-xs font-bold transition-all cursor-pointer"
            title="Mở bảng chú giải màu Bambu Studio"
          >
            <span className="w-2 h-2 rounded-full bg-[#00e050]" />
            <span>Slicing Result</span>
          </button>
        )}
      </div>

      {/* Layer Coordinate & Real-time Nozzle Telemetry HUD (Góc dưới bên trái) */}
      <div className="absolute bottom-24 left-4 z-10 pointer-events-none p-3.5 rounded-2xl glass-panel border border-white/15 max-w-xs space-y-1.5 text-xs shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/60 font-semibold text-[11px]">Cao Độ Trục Z:</span>
          <span className="font-mono font-black text-teal-300 text-sm">
            {(simulationState.currentProgress * slicingMetrics.boundingBox.dimensions[1]).toFixed(2)} mm
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/60 font-semibold text-[11px]">Lớp Đang Đùn:</span>
          <span className="font-mono font-bold text-white text-xs">
            Lớp {simulationState.currentLayer} / {simulationState.totalLayers}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
          <span className="text-white/60 font-semibold text-[11px]">Tác Vụ Hiện Tại:</span>
          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/10 uppercase text-amber-300">
            {simulationState.activeToolpathType === 'perimeter'
              ? 'Tường Ngoài (Wall)'
              : simulationState.activeToolpathType === 'infill'
              ? `Ruột (${profile.infillType})`
              : simulationState.activeToolpathType === 'support'
              ? 'Cột Support'
              : simulationState.activeToolpathType === 'brim'
              ? 'Vành Brim'
              : 'Di Chuyển Nhanh'}
          </span>
        </div>
      </div>

      {/* Live Defect Alert Card (Hiển thị góc dưới bên phải - Hoàn toàn không đè thanh công cụ hay drawer) */}
      {activeDefect && !isDefectDismissed && (
        <div className="absolute bottom-36 right-20 max-w-sm sm:max-w-md z-20 pointer-events-auto p-4 rounded-2xl bg-rose-950/90 border border-rose-500/70 text-white shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/30 text-rose-300 shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-black uppercase text-rose-300 tracking-wide flex items-center gap-1.5">
                  <span>{activeDefect.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/40 text-rose-100">
                    Lớp {activeDefect.layer}
                  </span>
                </div>
                <p className="text-xs text-rose-100/90 mt-1 leading-snug">{activeDefect.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {activeDefect.autoFixAction && (
                <button
                  onClick={() => handleExecuteAutoFix(activeDefect.autoFixAction!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-black font-black text-xs transition-all active:scale-95 shadow-md shadow-emerald-500/30 cursor-pointer"
                  title="AI tự động sửa lỗi và nạp lại cấu hình tối ưu"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>AI Sửa</span>
                </button>
              )}
              <button
                onClick={() => setIsDefectDismissed(true)}
                className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-900/50 transition-all cursor-pointer"
                title="Tạm ẩn cảnh báo lớp này"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Fix Success Notice Toast */}
      {fixedNotice && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full bg-emerald-500/90 text-black font-extrabold text-xs shadow-2xl flex items-center gap-2 animate-in zoom-in-95">
          <CheckCircle2 className="w-4 h-4 fill-current" />
          <span>{fixedNotice}</span>
        </div>
      )}

      {/* Overhang Heatmap Color Scale Indicator (Khi Heatmap hoặc Defects bật) */}
      {(showHeatmap || renderMode === 'defects') && (
        <div className="absolute top-18 right-20 z-10 p-3 rounded-2xl glass-panel-danger border border-rose-500/40 text-xs space-y-2 shadow-2xl backdrop-blur-xl animate-in fade-in">
          <div className="flex items-center gap-1.5 font-bold text-rose-300">
            <Flame className="w-4 h-4 text-rose-400" />
            <span>Thước Đo Khuyết Tật & Lỗi</span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#EF4444] shrink-0" />
              <span>Góc nhô &gt; 50° (Rơi sợi Spaghetti)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#F59E0B] shrink-0" />
              <span>Góc 40° - 50° (Nguy cơ nhăn mép)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#2DD4BF] shrink-0" />
              <span>Góc &lt; 40° (Bề mặt láng mịn)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



/**
 * Tô màu bản đồ nhiệt / tốc độ lưu lượng trên từng đỉnh tam giác
 */
function applyColorMap(geometry: THREE.BufferGeometry, mode: SlicerRenderMode) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  if (!positions || !normals) return;

  const count = positions.count;
  const colors = new Float32Array(count * 3);

  const safeColor = new THREE.Color(0x2dd4bf);
  const warningColor = new THREE.Color(0xf59e0b);
  const dangerColor = new THREE.Color(0xef4444);

  for (let i = 0; i < count; i += 3) {
    const ny = (normals.getY(i) + normals.getY(i + 1) + normals.getY(i + 2)) / 3;

    let chosenColor = safeColor;
    if (ny < -0.76) {
      chosenColor = dangerColor;
    } else if (ny < -0.64) {
      chosenColor = warningColor;
    }

    for (let j = 0; j < 3; j++) {
      colors[(i + j) * 3] = chosenColor.r;
      colors[(i + j) * 3 + 1] = chosenColor.g;
      colors[(i + j) * 3 + 2] = chosenColor.b;
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/**
 * Tạo mô hình bàn in gia nhiệt 256x256mm (Textured PEI Build Plate chuẩn Bambu / Voron)
 */
function createHeatedBedPlate(): THREE.Group {
  const group = new THREE.Group();

  const plateGeom = new THREE.BoxGeometry(256, 2, 256);
  plateGeom.translate(0, -1, 0);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x181e29,
    roughness: 0.7,
    metalness: 0.4,
  });
  const plateMesh = new THREE.Mesh(plateGeom, plateMat);
  plateMesh.receiveShadow = true;
  group.add(plateMesh);

  const borderGeom = new THREE.BoxGeometry(258, 2.2, 258);
  borderGeom.translate(0, -1.2, 0);
  const borderMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
  const borderMesh = new THREE.Mesh(borderGeom, borderMat);
  group.add(borderMesh);

  const gridHelper = new THREE.GridHelper(250, 25, 0x00e5ff, 0x334155);
  gridHelper.position.y = 0.05;
  if (Array.isArray(gridHelper.material)) {
    gridHelper.material.forEach((m) => {
      m.opacity = 0.35;
      m.transparent = true;
    });
  } else {
    gridHelper.material.opacity = 0.35;
    gridHelper.material.transparent = true;
  }
  group.add(gridHelper);

  const purgeGeom = new THREE.BoxGeometry(160, 0.4, 1.2);
  purgeGeom.translate(0, 0.2, 115);
  const purgeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const purgeLine = new THREE.Mesh(purgeGeom, purgeMat);
  group.add(purgeLine);

  const originGeom = new THREE.RingGeometry(1.5, 3.5, 16);
  originGeom.rotateX(-Math.PI / 2);
  originGeom.translate(-120, 0.1, 120);
  const originMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
  const originMesh = new THREE.Mesh(originGeom, originMat);
  group.add(originMesh);

  return group;
}

/**
 * Tạo mô hình Đầu in CoreXY Voron Stealthburner / Bambu Lab cao cấp chân thực
 * Bao gồm: Vỏ bọc carbon fiber, động cơ NEMA direct drive, quạt lồng sóc kép 4010,
 * lá tản nhiệt nhôm CNC, cụm nhiệt Volcano bọc silicon cam, đầu kim đồng thau và đèn LED RGB
 */
function createVirtualToolhead(): THREE.Group {
  const toolhead = new THREE.Group();

  // Vật liệu PBR chuẩn công nghiệp
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.35,
    metalness: 0.6,
  });

  const accentCyanMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Voron/Bambu stealth cyan accent
    roughness: 0.3,
    metalness: 0.4,
  });

  const heatsinkFinsMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // CNC anodized dark slate heatsink
    roughness: 0.2,
    metalness: 0.85,
  });

  const siliconeSockMat = new THREE.MeshStandardMaterial({
    color: 0xea580c, // Bambu vibrant orange silicone heat sock
    roughness: 0.85,
    metalness: 0.05,
  });

  const brassNozzleMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Precision CNC brass
    roughness: 0.15,
    metalness: 0.95,
  });

  const stepperMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.8,
  });

  const chromeSilverMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.1,
    metalness: 0.98,
  });

  // 1. MGN9 / MGN12 Precision Linear Rail Carriage (Gá lưng trượt bi CNC)
  const carriageGeom = new THREE.BoxGeometry(28, 22, 5);
  carriageGeom.translate(0, 20, -7);
  const carriageMesh = new THREE.Mesh(carriageGeom, stepperMetalMat);
  toolhead.add(carriageMesh);

  // Vòng bi trượt bạc inox (Bearing runners)
  [-11, 11].forEach((xOff) => {
    const runnerGeom = new THREE.CylinderGeometry(1.4, 1.4, 20, 8);
    runnerGeom.rotateZ(Math.PI / 2);
    runnerGeom.translate(xOff, 20, -9);
    const runnerMesh = new THREE.Mesh(runnerGeom, chromeSilverMat);
    toolhead.add(runnerMesh);
  });

  // 2. Aerodynamic Stealth Front Cowl / Housing (Vỏ che khí động học carbon fiber)
  const shroudMainGeom = new THREE.BoxGeometry(22, 20, 14);
  shroudMainGeom.translate(0, 18, 0);
  const shroudMain = new THREE.Mesh(shroudMainGeom, carbonMat);
  shroudMain.castShadow = true;
  toolhead.add(shroudMain);

  // Mặt vát trước thể thao CoreXY
  const chamferFaceGeom = new THREE.CylinderGeometry(11, 8, 12, 4);
  chamferFaceGeom.rotateY(Math.PI / 4);
  chamferFaceGeom.translate(0, 18, 6);
  const chamferFace = new THREE.Mesh(chamferFaceGeom, carbonMat);
  toolhead.add(chamferFace);

  // Dải trang trí accent xanh Voron / Stealthburner
  const accentStripeGeom = new THREE.BoxGeometry(18, 2, 0.6);
  accentStripeGeom.translate(0, 24, 7.2);
  const accentStripe = new THREE.Mesh(accentStripeGeom, accentCyanMat);
  toolhead.add(accentStripe);

  // Khe tản nhiệt / Air intake vents
  for (let i = 0; i < 3; i++) {
    const ventGeom = new THREE.BoxGeometry(12, 0.8, 0.5);
    ventGeom.translate(0, 17 + i * 2.2, 7.2);
    const ventMesh = new THREE.Mesh(ventGeom, stepperMetalMat);
    toolhead.add(ventMesh);
  }

  // 3. Multi-Finned Aluminum Heatsink (Cụm lá tản nhiệt CNC đa tầng)
  for (let fin = 0; fin < 6; fin++) {
    const finGeom = new THREE.CylinderGeometry(6.2, 6.2, 0.6, 16);
    finGeom.translate(0, 11 + fin * 1.3, 0);
    const finMesh = new THREE.Mesh(finGeom, heatsinkFinsMat);
    toolhead.add(finMesh);
  }
  const heatsinkCoreGeom = new THREE.CylinderGeometry(3.5, 3.5, 9, 12);
  heatsinkCoreGeom.translate(0, 14.5, 0);
  const heatsinkCore = new THREE.Mesh(heatsinkCoreGeom, heatsinkFinsMat);
  toolhead.add(heatsinkCore);

  // 4. Dual 4010 Centrifugal Part Cooling Blower Ducts (2 Họng gió tản nhiệt hướng mũi kim)
  [-1, 1].forEach((dir) => {
    // Thân quạt ốc sên sò blower
    const fanBodyGeom = new THREE.CylinderGeometry(5.0, 5.0, 3.5, 12);
    fanBodyGeom.rotateZ(Math.PI / 2);
    fanBodyGeom.translate(dir * 11, 17, 0);
    const fanBody = new THREE.Mesh(fanBodyGeom, carbonMat);
    toolhead.add(fanBody);

    // Vành hút gió tròn
    const intakeGeom = new THREE.RingGeometry(1.5, 4.0, 12);
    intakeGeom.rotateY((dir * Math.PI) / 2);
    intakeGeom.translate(dir * 12.8, 17, 0);
    const intakeMesh = new THREE.Mesh(intakeGeom, accentCyanMat);
    toolhead.add(intakeMesh);

    // Họng xả gió thu hẹp hướng chính xác vào đầu kim phun (40 độ)
    const ductNozzleGeom = new THREE.CylinderGeometry(1.2, 2.6, 9, 8);
    ductNozzleGeom.rotateZ(-dir * (Math.PI / 4.2));
    ductNozzleGeom.translate(dir * 6.8, 8.2, 1.5);
    const ductNozzle = new THREE.Mesh(ductNozzleGeom, accentCyanMat);
    toolhead.add(ductNozzle);
  });

  // 5. High-Flow Volcano Heater Block & Silicone Boot (Cục sinh nhiệt bọc silicon)
  const heatblockGeom = new THREE.BoxGeometry(9, 6, 9);
  heatblockGeom.translate(0, 5.0, 0);
  const heatblockMesh = new THREE.Mesh(heatblockGeom, siliconeSockMat);
  toolhead.add(heatblockMesh);

  // Dây cáp cảm biến nhiệt độ & thanh nhiệt
  const wireGeom = new THREE.CylinderGeometry(0.5, 0.5, 6, 6);
  wireGeom.rotateZ(Math.PI / 3);
  wireGeom.translate(4.5, 6.5, -2);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
  const wireMesh = new THREE.Mesh(wireGeom, wireMat);
  toolhead.add(wireMesh);

  // 6. Precision CNC Brass Volcano Nozzle (Kim phun đồng vàng CNC)
  // Cổ lục giác vặn đầu in (Hex Nut Collar)
  const hexNutGeom = new THREE.CylinderGeometry(2.4, 2.4, 2.0, 6);
  hexNutGeom.translate(0, 2.4, 0);
  const hexNutMesh = new THREE.Mesh(hexNutGeom, brassNozzleMat);
  toolhead.add(hexNutMesh);

  // Mũi kim vát nón nhọn (Conical Tip)
  const tipGeom = new THREE.ConeGeometry(1.6, 2.4, 16);
  tipGeom.rotateX(Math.PI);
  tipGeom.translate(0, 0.9, 0);
  const tipMesh = new THREE.Mesh(tipGeom, brassNozzleMat);
  toolhead.add(tipMesh);

  // Giọt nhựa nóng chảy ngay miệng kim (Molten Bead)
  const moltenGeom = new THREE.SphereGeometry(0.55, 8, 8);
  moltenGeom.translate(0, 0.12, 0);
  const moltenMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const moltenDot = new THREE.Mesh(moltenGeom, moltenMat);
  moltenDot.name = 'molten_dot';
  toolhead.add(moltenDot);

  // 7. Top Direct-Drive NEMA 14 Extruder Stepper Motor (Động cơ đùn nhựa trực tiếp trên nóc)
  const motorGeom = new THREE.CylinderGeometry(6.5, 6.5, 8, 16);
  motorGeom.translate(0, 31, 0);
  const motorMesh = new THREE.Mesh(motorGeom, stepperMetalMat);
  toolhead.add(motorMesh);

  // Đĩa nhôm CNC sau motor
  const motorPlateGeom = new THREE.BoxGeometry(13, 1.2, 13);
  motorPlateGeom.translate(0, 35.6, 0);
  const motorPlate = new THREE.Mesh(motorPlateGeom, chromeSilverMat);
  toolhead.add(motorPlate);

  // Bánh răng đùn nhựa knurled gear bằng đồng
  const gearGeom = new THREE.CylinderGeometry(3.0, 3.0, 3.5, 12);
  gearGeom.translate(0, 26, 0);
  const gearMesh = new THREE.Mesh(gearGeom, brassNozzleMat);
  toolhead.add(gearMesh);

  // 8. PTFE Bowden Fitting & Braided Cable Umbilical (Đầu nối khí nén & Dây cáp bọc lưới)
  const couplerGeom = new THREE.CylinderGeometry(2.2, 2.0, 3.0, 8);
  couplerGeom.translate(0, 37.5, 0);
  const couplerMesh = new THREE.Mesh(couplerGeom, chromeSilverMat);
  toolhead.add(couplerMesh);

  // Ống dẫn nhựa Teflon PTFE uốn lượn
  const ptfeGeom = new THREE.CylinderGeometry(1.4, 1.4, 18, 10);
  ptfeGeom.rotateZ(Math.PI / 16);
  ptfeGeom.translate(1.0, 46, -1.5);
  const ptfeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    roughness: 0.15,
  });
  const ptfeMesh = new THREE.Mesh(ptfeGeom, ptfeMat);
  toolhead.add(ptfeMesh);

  // Cáp bọc lưới đen Umbilical
  const umbilicalGeom = new THREE.CylinderGeometry(2.0, 2.0, 16, 10);
  umbilicalGeom.rotateZ(-Math.PI / 12);
  umbilicalGeom.translate(-2.0, 45, -3.5);
  const umbilicalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });
  const umbilicalMesh = new THREE.Mesh(umbilicalGeom, umbilicalMat);
  toolhead.add(umbilicalMesh);

  // 9. Voron-Style Status RGB LED Light Bar (Đèn LED định vị trạng thái)
  const ledBarGeom = new THREE.BoxGeometry(10, 1.2, 1.0);
  ledBarGeom.translate(0, 14, 7.3);
  const ledBarMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0x00e5ff),
    emissiveIntensity: 1.8,
  });
  const ledBarMesh = new THREE.Mesh(ledBarGeom, ledBarMat);
  ledBarMesh.name = 'status_led_bar';
  toolhead.add(ledBarMesh);

  // Vòng LED Halo chiếu sáng bàn in
  const ringGeom = new THREE.TorusGeometry(7.0, 0.7, 8, 20);
  ringGeom.rotateX(Math.PI / 2);
  ringGeom.translate(0, 8.5, 0);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0x00e5ff),
    emissiveIntensity: 1.4,
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.name = 'led_ring';
  toolhead.add(ringMesh);

  // 10. Đèn chiếu rọi tập trung xuống vết in
  const nozzleSpot = new THREE.SpotLight(0xffffff, 3.2);
  nozzleSpot.position.set(0, 12, 0);
  nozzleSpot.angle = Math.PI / 5;
  nozzleSpot.penumbra = 0.4;
  nozzleSpot.decay = 2;
  nozzleSpot.distance = 120;
  nozzleSpot.target = toolhead;
  toolhead.add(nozzleSpot);

  return toolhead;
}

/**
 * Cập nhật cấu trúc Support chuẩn Bambu Lab / Bambu Studio và Vành Brim
 */
function updateSupportStructures(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  profile: ISimulationProfile,
  visible: boolean,
  modelIdentifier?: string,
  modelPath?: string
): THREE.Group | null {
  // Xóa sạch cấu trúc Support cũ và giải phóng bộ nhớ GPU
  const existingSupport =
    parent.getObjectByName('support_structures_group') ||
    parent.getObjectByName('bambu_tree_support_group');
  if (existingSupport) {
    parent.remove(existingSupport);
    existingSupport.traverse((child) => {
      if (
        child instanceof THREE.Mesh ||
        child instanceof THREE.Line ||
        child instanceof THREE.LineSegments
      ) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
  }

  const existingBrim = parent.getObjectByName('brim_skirt_mesh');
  if (existingBrim) {
    parent.remove(existingBrim);
    if (existingBrim instanceof THREE.Mesh) {
      existingBrim.geometry.dispose();
      if (Array.isArray(existingBrim.material)) existingBrim.material.forEach((m) => m.dispose());
      else existingBrim.material.dispose();
    }
  }

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox || new THREE.Box3();
  const dimX = bbox.max.x - bbox.min.x;
  const dimZ = bbox.max.z - bbox.min.z;
  const centerX = (bbox.max.x + bbox.min.x) / 2;
  const centerZ = (bbox.max.z + bbox.min.z) / 2;

  // 1. Vành bám bàn in Brim
  if (profile.brimEnabled) {
    const outerR = Math.max(dimX, dimZ) / 2 + (profile.brimWidthMm || 5);
    const innerR = Math.max(dimX, dimZ) / 2;
    const brimGeom = new THREE.RingGeometry(innerR, outerR, 48);
    brimGeom.rotateX(-Math.PI / 2);
    brimGeom.translate(centerX, 0.1, centerZ);

    const brimMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e, // Xanh lá cây chuẩn Slicer Brim
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const brimMesh = new THREE.Mesh(brimGeom, brimMat);
    brimMesh.name = 'brim_skirt_mesh';
    parent.add(brimMesh);
  }

  // 2. Cấu trúc Tree Support 3D chính thức từ Bambu Studio CLI G-code
  if (profile.supportMode !== 'none' && visible) {
    const supportGroup = new THREE.Group();
    supportGroup.name = 'support_structures_group';
    parent.add(supportGroup);

    const cachedNative = getCachedNativeSupport(modelIdentifier, modelPath);
    if (cachedNative && cachedNative.segments && cachedNative.segments.length > 0) {
      const nativeMesh = buildNativeSupportMesh(cachedNative);
      nativeMesh.name = 'native_bambu_toolpaths';
      supportGroup.add(nativeMesh);
      return supportGroup;
    }

    loadNativeBambuSupport(modelIdentifier, modelPath).then((nativeData) => {
      if (parent.getObjectByName('support_structures_group') !== supportGroup) return;

      while (supportGroup.children.length > 0) {
        const child = supportGroup.children[0];
        supportGroup.remove(child);
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material?.dispose();
        }
      }

      if (nativeData && nativeData.segments && nativeData.segments.length > 0) {
        const nativeMesh = buildNativeSupportMesh(nativeData);
        nativeMesh.name = 'native_bambu_toolpaths';
        supportGroup.add(nativeMesh);
      } else {
        const fallback = generateBambuSupportStructures(geometry, profile);
        while (fallback.children.length > 0) {
          supportGroup.add(fallback.children[0]);
        }
      }
    });

    return supportGroup;
  }

  return null;
}

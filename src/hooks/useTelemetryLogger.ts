import { useEffect, useRef } from 'react';
import { ISimulationProfile } from '@/types/simulator';
import { sendTelemetryEvent } from '@/services/telemetryService';

const TELEMETRY_KEYS: (keyof ISimulationProfile)[] = [
  // Tab 1: Cơ Bản
  'id',
  'material',
  'materialColor',
  'layerHeight',
  'infillDensity',
  'infillType',
  'supportMode',
  'brimEnabled',
  // Tab 2: Vách & Vỏ
  'wallLoops',
  'firstLayerHeight',
  'topShellLayers',
  'bottomShellLayers',
  'seamPosition',
  // Tab 3: Support
  'treeStyle',
  'supportAngleThreshold',
  'supportTopZDistance',
  'supportBranchDiameter',
  'supportBranchAngle',
  'brimWidthMm',
  // Tab 4: Tốc Độ
  'printSpeed',
  'outerWallSpeed',
  'infillSpeed',
  'travelSpeed',
  // Tab 5: Nhiệt Độ
  'nozzleTemp',
  'bedTemp',
  'coolingFanSpeed',
  // Tab 6: Đùn Nhựa
  'flowRateMm3s',
  'retractionDistanceMm',
  'retractionSpeedMmS',
  'zHopMm',
];

/**
 * Hook tự động phát hiện thay đổi tham số cắt lớp (Slicing parameters)
 * và ghi nhận telemetry về Backend FastAPI theo thời gian thực (có debounce 350ms
 * để gom các thao tác kéo thanh trượt liên tục).
 */
export function useTelemetryLogger(profile: ISimulationProfile, currentModelName: string): void {
  const committedProfileRef = useRef<ISimulationProfile>(profile);

  useEffect(() => {
    const prev = committedProfileRef.current;
    if (prev === profile) return;

    const timer = window.setTimeout(() => {
      const baseline = committedProfileRef.current;
      for (const key of TELEMETRY_KEYS) {
        if (baseline[key] !== profile[key]) {
          const paramName = key === 'id' ? 'preset' : String(key);
          sendTelemetryEvent(paramName, baseline[key], profile[key], {
            modelName: currentModelName,
            material: profile.material,
            brimWidthMm: profile.brimWidthMm,
          });
        }
      }
      committedProfileRef.current = profile;
    }, 350);

    return () => window.clearTimeout(timer);
  }, [profile, currentModelName]);
}

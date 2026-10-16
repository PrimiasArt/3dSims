import { useEffect, useRef } from 'react';
import { ISimulationProfile } from '@/types/simulator';
import { sendTelemetryEvent } from '@/services/telemetryService';

/**
 * Hook tự động phát hiện thay đổi tham số cắt lớp (Slicing parameters)
 * và ghi nhận telemetry về Backend FastAPI theo thời gian thực.
 */
export function useTelemetryLogger(profile: ISimulationProfile, currentModelName: string): void {
  const prevProfileRef = useRef<ISimulationProfile>(profile);

  useEffect(() => {
    const prev = prevProfileRef.current;
    if (prev !== profile) {
      // So sánh toàn bộ 29 tham số của 5 tab cấu hình và đùn nhựa
      const keysToTrack: (keyof ISimulationProfile)[] = [
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

      for (const key of keysToTrack) {
        if (prev[key] !== profile[key]) {
          const paramName = key === 'id' ? 'preset' : String(key);
          sendTelemetryEvent(paramName, prev[key], profile[key], {
            modelName: currentModelName,
            material: profile.material,
            brimWidthMm: profile.brimWidthMm,
          });
        }
      }

      prevProfileRef.current = profile;
    }
  }, [profile, currentModelName]);
}

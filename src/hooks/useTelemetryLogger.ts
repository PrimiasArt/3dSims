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
      // So sánh các thuộc tính cốt lõi
      const keysToTrack: (keyof ISimulationProfile)[] = [
        'infillDensity',
        'infillType',
        'layerHeight',
        'nozzleTemp',
        'bedTemp',
        'printSpeed',
        'supportMode',
        'brimEnabled',
        'brimWidthMm',
        'coolingFanSpeed',
        'material',
        'supportAngleThreshold',
        'treeStyle',
        'wallLoops',
        'firstLayerHeight',
        'outerWallSpeed',
        'infillSpeed',
      ];

      for (const key of keysToTrack) {
        if (prev[key] !== profile[key]) {
          sendTelemetryEvent(String(key), prev[key], profile[key], {
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

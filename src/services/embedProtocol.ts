import { ISimulationProfile, IPreflightReport } from '@/types/simulator';

export interface IEmbedMessagePayload {
  action: 'LOAD_MODEL' | 'SET_PROFILE' | 'PLAY' | 'PAUSE' | 'SCRUB_PROGRESS' | 'REQUEST_REPORT';
  modelUrl?: string;
  modelName?: string;
  sampleId?: string;
  profile?: Partial<ISimulationProfile>;
  progress?: number;
}

export class EmbedProtocolService {
  private static instance: EmbedProtocolService;
  private isEmbedded: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.isEmbedded = window.self !== window.top || window.location.search.includes('embed=true');
    }
  }

  public static getInstance(): EmbedProtocolService {
    if (!EmbedProtocolService.instance) {
      EmbedProtocolService.instance = new EmbedProtocolService();
    }
    return EmbedProtocolService.instance;
  }

  public getIsEmbedded(): boolean {
    return this.isEmbedded;
  }

  public notifyReady() {
    this.postToParent('SIMULATOR_READY', {
      version: '1.0.0',
      timestamp: Date.now(),
    });
  }

  public notifyTelemetry(telemetry: {
    progress: number;
    currentLayer: number;
    totalLayers: number;
    elapsedTimeSec: number;
    totalTimeSec: number;
    filamentUsedGrams: number;
  }) {
    this.postToParent('SIMULATOR_TELEMETRY', telemetry);
  }

  public notifyReport(report: IPreflightReport) {
    this.postToParent('SIMULATOR_REPORT', report);
  }

  public syncProfile(profile: ISimulationProfile) {
    this.postToParent('SIMULATOR_SYNC_PROFILE', profile);
  }

  private postToParent(type: string, data: any) {
    if (typeof window !== 'undefined' && this.isEmbedded) {
      window.parent.postMessage(
        {
          source: '3D_PRINT_SIMULATOR',
          type,
          data,
        },
        '*'
      );
    }
  }
}

export const embedProtocol = EmbedProtocolService.getInstance();

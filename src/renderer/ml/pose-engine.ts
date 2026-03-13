import { FACE_LOOP_INTERVAL, LANDMARKS, POSE_LOOP_INTERVAL } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

type PoseCallback = (landmarks: Point[], fps: number) => void;
type StatusCallback = (status: 'active' | 'degraded' | 'inactive') => void;

interface HumanBodyKeypoint {
  position?: [number, number, number?];
  score?: number;
  x?: number;
  y?: number;
  z?: number;
}

interface HumanBodyResult {
  keypoints?: HumanBodyKeypoint[];
}

interface HumanAdapter {
  load: () => Promise<void>;
  warmup: () => Promise<void>;
  detect: (video: HTMLVideoElement) => Promise<{ body?: HumanBodyResult[] }>;
}

const REQUIRED_INDICES = [
  LANDMARKS.NOSE,
  LANDMARKS.LEFT_EAR,
  LANDMARKS.RIGHT_EAR,
  LANDMARKS.LEFT_SHOULDER,
  LANDMARKS.RIGHT_SHOULDER,
  LANDMARKS.LEFT_HIP,
  LANDMARKS.RIGHT_HIP,
];

export class PoseEngine {
  private onPose: PoseCallback | null = null;

  private onStatus: StatusCallback | null = null;

  private running = false;

  private lastLoop = 0;

  private fpsWindowStart = performance.now();

  private fpsFrames = 0;

  private fps = 0;

  private human: HumanAdapter | null = null;

  private fallbackPhase = 0;

  setCallbacks(onPose: PoseCallback, onStatus: StatusCallback): void {
    this.onPose = onPose;
    this.onStatus = onStatus;
  }

  async init(video: HTMLVideoElement): Promise<void> {
    this.running = true;
    try {
      await this.initHuman();
      this.onStatus?.('active');
    } catch (error) {
      // Keep app functional even if model init fails.
      console.error('Pose model init failed, using fallback landmarks', error);
      this.onStatus?.('degraded');
    }

    const tick = async (now: number) => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      if (now - this.lastLoop < POSE_LOOP_INTERVAL) return;
      this.lastLoop = now;
      const landmarks = await this.detectPose(video);
      this.fpsFrames += 1;
      if (now - this.fpsWindowStart >= 1000) {
        this.fps = this.fpsFrames;
        this.fpsFrames = 0;
        this.fpsWindowStart = now;
      }
      this.onPose?.(landmarks, this.fps);
    };

    requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    this.onStatus?.('inactive');
  }

  private async initHuman(): Promise<void> {
    const HumanModule = await import('@vladmandic/human');
    this.human = new HumanModule.Human({
      modelBasePath: 'https://vladmandic.github.io/human/models',
      filter: { enabled: true },
      body: {
        enabled: true,
        maxDetected: 1,
      },
      face: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
    }) as HumanAdapter;
    await this.human.load();
    await this.human.warmup();
  }

  private async detectPose(video: HTMLVideoElement): Promise<Point[]> {
    if (!this.human || !video.videoWidth || !video.videoHeight) {
      return this.syntheticPose();
    }

    try {
      const result = await this.human.detect(video);
      const body: HumanBodyResult | undefined = result?.body?.[0];
      const points = this.toNormalizedLandmarks(body?.keypoints ?? [], video.videoWidth, video.videoHeight);
      if (
        !points.length ||
        !REQUIRED_INDICES.every((index) => {
          const visibility = points[index]?.visibility ?? 0;
          return visibility > 0.15;
        })
      ) {
        return this.syntheticPose();
      }
      return points;
    } catch (error) {
      console.warn('Pose detect failed, using synthetic landmarks', error);
      return this.syntheticPose();
    }
  }

  private toNormalizedLandmarks(
    keypoints: HumanBodyKeypoint[],
    videoWidth: number,
    videoHeight: number,
  ): Point[] {
    if (!keypoints.length) return [];
    return keypoints.map((point) => {
      const px = point.position?.[0] ?? point.x ?? 0;
      const py = point.position?.[1] ?? point.y ?? 0;
      const pz = point.position?.[2] ?? point.z ?? 0;
      return {
        x: videoWidth ? px / videoWidth : 0,
        y: videoHeight ? py / videoHeight : 0,
        z: pz,
        visibility: point.score ?? 1,
      };
    });
  }

  private syntheticPose(): Point[] {
    // Fallback keeps the app interactive when ML models fail to load.
    this.fallbackPhase += FACE_LOOP_INTERVAL / 1000;
    const sway = Math.sin(this.fallbackPhase) * 0.02;
    const base = new Array(33).fill(0).map(() => ({
      x: 0.5 + sway,
      y: 0.5,
      visibility: 1,
    }));

    base[LANDMARKS.NOSE] = { x: 0.5 + sway, y: 0.33, visibility: 1 };
    base[LANDMARKS.LEFT_EAR] = { x: 0.45 + sway, y: 0.34, visibility: 1 };
    base[LANDMARKS.RIGHT_EAR] = { x: 0.55 + sway, y: 0.34, visibility: 1 };
    base[LANDMARKS.LEFT_SHOULDER] = { x: 0.43 + sway, y: 0.43, visibility: 1 };
    base[LANDMARKS.RIGHT_SHOULDER] = { x: 0.57 + sway, y: 0.43, visibility: 1 };
    base[LANDMARKS.LEFT_HIP] = { x: 0.45 + sway, y: 0.62, visibility: 1 };
    base[LANDMARKS.RIGHT_HIP] = { x: 0.55 + sway, y: 0.62, visibility: 1 };
    base[LANDMARKS.LEFT_ELBOW] = { x: 0.39 + sway, y: 0.53, visibility: 1 };
    base[LANDMARKS.RIGHT_ELBOW] = { x: 0.61 + sway, y: 0.53, visibility: 1 };
    base[LANDMARKS.LEFT_WRIST] = { x: 0.35 + sway, y: 0.62, visibility: 1 };
    base[LANDMARKS.RIGHT_WRIST] = { x: 0.65 + sway, y: 0.62, visibility: 1 };
    base[LANDMARKS.LEFT_KNEE] = { x: 0.46 + sway, y: 0.78, visibility: 1 };
    base[LANDMARKS.RIGHT_KNEE] = { x: 0.54 + sway, y: 0.78, visibility: 1 };
    base[LANDMARKS.LEFT_ANKLE] = { x: 0.45 + sway, y: 0.92, visibility: 1 };
    base[LANDMARKS.RIGHT_ANKLE] = { x: 0.55 + sway, y: 0.92, visibility: 1 };
    return base;
  }
}

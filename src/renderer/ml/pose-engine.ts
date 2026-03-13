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

const COCO_TO_MEDIAPIPE_INDEX: Array<[number, number]> = [
  [0, LANDMARKS.NOSE],
  [3, LANDMARKS.LEFT_EAR],
  [4, LANDMARKS.RIGHT_EAR],
  [5, LANDMARKS.LEFT_SHOULDER],
  [6, LANDMARKS.RIGHT_SHOULDER],
  [7, LANDMARKS.LEFT_ELBOW],
  [8, LANDMARKS.RIGHT_ELBOW],
  [9, LANDMARKS.LEFT_WRIST],
  [10, LANDMARKS.RIGHT_WRIST],
  [11, LANDMARKS.LEFT_HIP],
  [12, LANDMARKS.RIGHT_HIP],
  [13, LANDMARKS.LEFT_KNEE],
  [14, LANDMARKS.RIGHT_KNEE],
  [15, LANDMARKS.LEFT_ANKLE],
  [16, LANDMARKS.RIGHT_ANKLE],
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

  private runtimeStatus: 'active' | 'degraded' | 'inactive' = 'inactive';

  setCallbacks(onPose: PoseCallback, onStatus: StatusCallback): void {
    this.onPose = onPose;
    this.onStatus = onStatus;
  }

  async init(video: HTMLVideoElement): Promise<void> {
    this.running = true;
    try {
      await this.initHuman();
      this.setStatus('active');
    } catch (error) {
      // Keep app functional even if model init fails.
      console.error('Pose model init failed, using fallback landmarks', error);
      this.setStatus('degraded');
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
    this.setStatus('inactive');
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
      this.setStatus('degraded');
      return this.syntheticPose();
    }

    try {
      const result = await this.human.detect(video);
      const body: HumanBodyResult | undefined = result?.body?.[0];
      const points = this.toNormalizedLandmarks(body?.keypoints ?? [], video.videoWidth, video.videoHeight);
      const hasRequired = REQUIRED_INDICES.every((index) => {
        const visibility = points[index]?.visibility ?? 0;
        return visibility > 0.15;
      });

      if (!points.length || !hasRequired) {
        this.setStatus('degraded');
        return this.syntheticPose();
      }
      this.setStatus('active');
      return points;
    } catch (error) {
      console.warn('Pose detect failed, using synthetic landmarks', error);
      this.setStatus('degraded');
      return this.syntheticPose();
    }
  }

  private setStatus(status: 'active' | 'degraded' | 'inactive'): void {
    if (this.runtimeStatus === status) return;
    this.runtimeStatus = status;
    this.onStatus?.(status);
  }

  private toNormalizedLandmarks(
    keypoints: HumanBodyKeypoint[],
    videoWidth: number,
    videoHeight: number,
  ): Point[] {
    if (!keypoints.length) return [];
    const normalizePoint = (point: HumanBodyKeypoint): Point => {
      const rawX = point.position?.[0] ?? point.x ?? 0;
      const rawY = point.position?.[1] ?? point.y ?? 0;
      const rawZ = point.position?.[2] ?? point.z ?? 0;
      const x = rawX > 1 ? (videoWidth ? rawX / videoWidth : 0) : rawX;
      const y = rawY > 1 ? (videoHeight ? rawY / videoHeight : 0) : rawY;
      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        z: rawZ,
        visibility: point.score ?? 1,
      };
    };

    // Some Human body models return COCO-17 keypoints. Map to MediaPipe-style indices we use.
    if (keypoints.length >= 17 && keypoints.length < 33) {
      const mapped: Point[] = new Array(33)
        .fill(0)
        .map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
      for (const [src, dest] of COCO_TO_MEDIAPIPE_INDEX) {
        mapped[dest] = normalizePoint(keypoints[src]);
      }
      return mapped;
    }

    return keypoints.map(normalizePoint);
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

import { LANDMARKS, POSE_LOOP_INTERVAL } from '@renderer/lib/constants';
import type { Point, VisionBackend } from '@renderer/lib/types';

type PoseCallback = (landmarks: Point[], fps: number) => void;
type StatusCallback = (status: 'active' | 'degraded' | 'inactive') => void;
type BackendCallback = (backend: VisionBackend) => void;

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

interface MediaPipeLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

interface MediaPipePoseResult {
  landmarks?: MediaPipeLandmark[][];
}

interface MediaPipePoseLandmarkerAdapter {
  detectForVideo: (videoFrame: HTMLVideoElement, timestamp: number) => MediaPipePoseResult;
  close?: () => void;
}

interface FilesetResolverAdapter {
  forVisionTasks: (basePath?: string) => Promise<unknown>;
}

interface PoseLandmarkerFactory {
  createFromOptions: (
    wasmFileset: unknown,
    options: {
      baseOptions: { modelAssetPath: string };
      runningMode: 'VIDEO';
      numPoses: number;
      minPoseDetectionConfidence: number;
      minPosePresenceConfidence: number;
      minTrackingConfidence: number;
    },
  ) => Promise<MediaPipePoseLandmarkerAdapter>;
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

  private mediapipe: MediaPipePoseLandmarkerAdapter | null = null;

  private mediapipeInitTried = false;

  private runtimeStatus: 'active' | 'degraded' | 'inactive' = 'inactive';

  private runtimeBackend: VisionBackend = 'starting';

  private onBackend: BackendCallback | null = null;

  setCallbacks(onPose: PoseCallback, onStatus: StatusCallback, onBackend?: BackendCallback): void {
    this.onPose = onPose;
    this.onStatus = onStatus;
    this.onBackend = onBackend ?? null;
  }

  async init(video: HTMLVideoElement): Promise<void> {
    this.running = true;
    let initialized = false;
    try {
      await this.initHuman();
      initialized = true;
      this.setStatus('active');
      this.setBackend('human');
    } catch (error) {
      console.warn('Pose Human backend init failed', error);
    }

    if (!initialized) {
      try {
        await this.initMediaPipe();
        initialized = true;
        this.setStatus('active');
        this.setBackend('mediapipe');
      } catch (error) {
        console.warn('Pose MediaPipe backend init failed', error);
      }
    }

    if (!initialized) {
      this.setStatus('degraded');
      this.setBackend('unavailable');
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
    this.setBackend('starting');
    this.mediapipe?.close?.();
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

  private async initMediaPipe(): Promise<void> {
    this.mediapipeInitTried = true;
    const visionModule = await import('@mediapipe/tasks-vision');
    const filesetResolver = (visionModule as unknown as { FilesetResolver: FilesetResolverAdapter })
      .FilesetResolver;
    const poseLandmarker = (visionModule as unknown as { PoseLandmarker: PoseLandmarkerFactory })
      .PoseLandmarker;

    const wasmFileset = await filesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm',
    );

    this.mediapipe = await poseLandmarker.createFromOptions(wasmFileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
  }

  private async detectPose(video: HTMLVideoElement): Promise<Point[]> {
    if (!video.videoWidth || !video.videoHeight) {
      this.setStatus('degraded');
      this.setBackend('unavailable');
      return [];
    }

    const humanLandmarks = await this.detectWithHuman(video);
    if (humanLandmarks) {
      this.setStatus('active');
      this.setBackend('human');
      return humanLandmarks;
    }

    if (!this.mediapipe && !this.mediapipeInitTried) {
      try {
        await this.initMediaPipe();
      } catch (error) {
        console.warn('Pose MediaPipe lazy init failed', error);
      }
    }

    const mediapipeLandmarks = this.detectWithMediaPipe(video);
    if (mediapipeLandmarks) {
      this.setStatus('active');
      this.setBackend('mediapipe');
      return mediapipeLandmarks;
    }

    this.setStatus('degraded');
    this.setBackend('unavailable');
    return [];
  }

  private async detectWithHuman(video: HTMLVideoElement): Promise<Point[] | null> {
    if (!this.human) return null;
    try {
      const result = await this.human.detect(video);
      const body: HumanBodyResult | undefined = result?.body?.[0];
      const points = this.toNormalizedLandmarks(body?.keypoints ?? [], video.videoWidth, video.videoHeight);
      if (!this.hasRequiredLandmarks(points)) return null;
      return points;
    } catch (error) {
      console.warn('Pose Human detect failed', error);
      return null;
    }
  }

  private detectWithMediaPipe(video: HTMLVideoElement): Point[] | null {
    if (!this.mediapipe) return null;
    try {
      const result = this.mediapipe.detectForVideo(video, performance.now());
      const landmarks = result.landmarks?.[0];
      if (!landmarks?.length) return null;
      const points = landmarks.slice(0, 33).map((landmark) => ({
        x: Math.max(0, Math.min(1, landmark.x)),
        y: Math.max(0, Math.min(1, landmark.y)),
        z: landmark.z,
        visibility: landmark.visibility ?? 1,
      }));
      if (!this.hasRequiredLandmarks(points)) return null;
      return points;
    } catch (error) {
      console.warn('Pose MediaPipe detect failed', error);
      return null;
    }
  }

  private hasRequiredLandmarks(points: Point[]): boolean {
    if (!points.length) return false;
    return REQUIRED_INDICES.every((index) => {
      const visibility = points[index]?.visibility ?? 0;
      return visibility > 0.15;
    });
  }

  private setStatus(status: 'active' | 'degraded' | 'inactive'): void {
    if (this.runtimeStatus === status) return;
    this.runtimeStatus = status;
    this.onStatus?.(status);
  }

  private setBackend(backend: VisionBackend): void {
    if (this.runtimeBackend === backend) return;
    this.runtimeBackend = backend;
    this.onBackend?.(backend);
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

}

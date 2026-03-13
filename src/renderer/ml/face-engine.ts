import { FACE_LOOP_INTERVAL } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

type FaceCallback = (
  landmarks: Point[],
  emotionState: string,
  emotionConfidence: number,
  fps: number,
) => void;
type StatusCallback = (status: 'active' | 'degraded' | 'inactive') => void;

interface EmotionResult {
  emotion: string;
  score: number;
}

interface HumanAdapter {
  load: () => Promise<void>;
  warmup: () => Promise<void>;
  detect: (video: HTMLVideoElement) => Promise<{
    face?: Array<{ mesh?: number[][]; emotion?: EmotionResult[] }>;
  }>;
}

export class FaceEngine {
  private onFace: FaceCallback | null = null;

  private onStatus: StatusCallback | null = null;

  private running = false;

  private lastLoop = 0;

  private fpsFrames = 0;

  private fpsWindowStart = performance.now();

  private fps = 0;

  private human: HumanAdapter | null = null;

  setCallbacks(onFace: FaceCallback, onStatus: StatusCallback): void {
    this.onFace = onFace;
    this.onStatus = onStatus;
  }

  async init(video: HTMLVideoElement): Promise<void> {
    this.running = true;
    try {
      await this.initHuman();
      this.onStatus?.('active');
    } catch (error) {
      console.error('Face model init failed, using fallback face stream', error);
      this.onStatus?.('degraded');
    }

    const tick = async (now: number) => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      if (now - this.lastLoop < FACE_LOOP_INTERVAL) return;
      this.lastLoop = now;

      const { landmarks, emotionState, emotionConfidence } = await this.detectFace(video);
      this.fpsFrames += 1;
      if (now - this.fpsWindowStart >= 1000) {
        this.fps = this.fpsFrames;
        this.fpsFrames = 0;
        this.fpsWindowStart = now;
      }

      this.onFace?.(landmarks, emotionState, emotionConfidence, this.fps);
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
      body: { enabled: false },
      face: {
        enabled: true,
        detector: { rotation: true },
        mesh: { enabled: true },
        emotion: { enabled: true },
      },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
    }) as HumanAdapter;
    await this.human.load();
    await this.human.warmup();
  }

  private async detectFace(
    video: HTMLVideoElement,
  ): Promise<{ landmarks: Point[]; emotionState: string; emotionConfidence: number }> {
    if (!this.human || !video.videoWidth || !video.videoHeight) {
      return this.syntheticFace();
    }

    try {
      const result = await this.human.detect(video);
      const face = result?.face?.[0];
      const rawMesh: number[][] | undefined = face?.mesh;
      const emotions: EmotionResult[] = face?.emotion ?? [];

      if (!rawMesh?.length) return this.syntheticFace();
      const [dominant] = [...emotions].sort((a, b) => b.score - a.score);
      return {
        landmarks: rawMesh.map((point) => ({
          x: point[0] / video.videoWidth,
          y: point[1] / video.videoHeight,
          z: point[2],
          visibility: 1,
        })),
        emotionState: dominant?.emotion ?? 'neutral',
        emotionConfidence: dominant?.score ?? 0.4,
      };
    } catch (error) {
      console.warn('Face detect failed, using synthetic fallback', error);
      return this.syntheticFace();
    }
  }

  private syntheticFace(): { landmarks: Point[]; emotionState: string; emotionConfidence: number } {
    const points: Point[] = new Array(478).fill(0).map((_, index) => {
      const theta = (Math.PI * 2 * index) / 478;
      return {
        x: 0.5 + Math.cos(theta) * 0.08,
        y: 0.42 + Math.sin(theta) * 0.1,
        visibility: 1,
      };
    });
    return {
      landmarks: points,
      emotionState: 'neutral',
      emotionConfidence: 0.5,
    };
  }
}

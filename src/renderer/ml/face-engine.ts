import { FACE_LOOP_INTERVAL } from '@renderer/lib/constants';
import type { Point, VisionBackend } from '@renderer/lib/types';

type FaceCallback = (
  landmarks: Point[],
  emotionState: string,
  emotionConfidence: number,
  fps: number,
) => void;
type StatusCallback = (status: 'active' | 'degraded' | 'inactive') => void;
type BackendCallback = (backend: VisionBackend) => void;

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

  private detecting = false;

  private lastLoop = 0;

  private fpsFrames = 0;

  private fpsWindowStart = performance.now();

  private fps = 0;

  private human: HumanAdapter | null = null;

  private runtimeStatus: 'active' | 'degraded' | 'inactive' = 'inactive';

  private runtimeBackend: VisionBackend = 'starting';

  private onBackend: BackendCallback | null = null;

  private lastDiagTime = 0;

  setCallbacks(onFace: FaceCallback, onStatus: StatusCallback, onBackend?: BackendCallback): void {
    this.onFace = onFace;
    this.onStatus = onStatus;
    this.onBackend = onBackend ?? null;
  }

  async init(video: HTMLVideoElement): Promise<void> {
    this.running = true;
    try {
      console.log('[FaceEngine] Initializing Human face model...');
      await this.initHuman();
      console.log('[FaceEngine] Face model ready');
      this.setStatus('active');
      this.setBackend('human');
    } catch (error) {
      console.error('[FaceEngine] Face model init failed:', error);
      this.setStatus('degraded');
      this.setBackend('unavailable');
    }

    const tick = async (now: number) => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      if (now - this.lastLoop < FACE_LOOP_INTERVAL) return;
      if (this.detecting) return;
      this.lastLoop = now;
      this.detecting = true;
      try {
        const { landmarks, emotionState, emotionConfidence } = await this.detectFace(video);
        this.fpsFrames += 1;
        if (now - this.fpsWindowStart >= 1000) {
          this.fps = this.fpsFrames;
          this.fpsFrames = 0;
          this.fpsWindowStart = now;
        }
        this.onFace?.(landmarks, emotionState, emotionConfidence, this.fps);
      } finally {
        this.detecting = false;
      }
    };

    requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    this.setStatus('inactive');
    this.setBackend('starting');
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
    console.log('[FaceEngine] Models loaded, warming up...');
    await this.human.warmup();
  }

  private async detectFace(
    video: HTMLVideoElement,
  ): Promise<{ landmarks: Point[]; emotionState: string; emotionConfidence: number }> {
    if (!this.human || !video.videoWidth || !video.videoHeight) {
      this.setStatus('degraded');
      this.setBackend('unavailable');
      return { landmarks: [], emotionState: 'neutral', emotionConfidence: 0 };
    }

    try {
      const result = await this.human.detect(video);
      const face = result?.face?.[0];
      const rawMesh: number[][] | undefined = face?.mesh;
      const emotions: EmotionResult[] = face?.emotion ?? [];

      // Diagnostic logging every 5 seconds
      const now = Date.now();
      if (now - this.lastDiagTime > 5000) {
        this.lastDiagTime = now;
        console.log(
          `[FaceEngine] mesh points: ${rawMesh?.length ?? 0} | emotions: ${emotions.length} | top: ${emotions[0]?.emotion ?? 'none'} (${(emotions[0]?.score ?? 0).toFixed(2)})`,
        );
      }

      if (!rawMesh?.length) {
        this.setStatus('degraded');
        this.setBackend('unavailable');
        return { landmarks: [], emotionState: 'neutral', emotionConfidence: 0 };
      }
      const [dominant] = [...emotions].sort((a, b) => b.score - a.score);
      this.setStatus('active');
      this.setBackend('human');
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
      console.warn('[FaceEngine] Face detect failed:', error);
      this.setStatus('degraded');
      this.setBackend('unavailable');
      return { landmarks: [], emotionState: 'neutral', emotionConfidence: 0 };
    }
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
}

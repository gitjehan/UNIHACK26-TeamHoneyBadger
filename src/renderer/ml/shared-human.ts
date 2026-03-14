interface SharedHumanInstance {
  load: () => Promise<void>;
  warmup: () => Promise<void>;
  detect: (video: HTMLVideoElement) => Promise<{
    body?: Array<{ keypoints?: Array<{ position?: [number, number, number?]; score?: number; x?: number; y?: number; z?: number }> }>;
    face?: Array<{ mesh?: number[][]; emotion?: Array<{ emotion: string; score: number }> }>;
  }>;
}

let instance: SharedHumanInstance | null = null;
let initPromise: Promise<SharedHumanInstance> | null = null;

export async function getSharedHuman(): Promise<SharedHumanInstance> {
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const HumanModule = await import('@vladmandic/human');
    const human = new HumanModule.Human({
      modelBasePath: 'https://vladmandic.github.io/human/models',
      filter: { enabled: true },
      body: { enabled: true, maxDetected: 1 },
      face: {
        enabled: true,
        detector: { rotation: true },
        mesh: { enabled: true },
        emotion: { enabled: true },
      },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
    });
    await human.load();
    await human.warmup();
    instance = human as unknown as SharedHumanInstance;
    return instance;
  })();

  return initPromise;
}

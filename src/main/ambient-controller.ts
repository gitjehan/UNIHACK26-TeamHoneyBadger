import { exec, execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export class AmbientController {
  private currentBrightness = 1;

  private currentWarmth = 0;

  private targetBrightness = 1;

  private targetWarmth = 0;

  private timer: NodeJS.Timeout | null = null;

  private busy = false;

  private step = 0;

  private totalSteps = 40;

  private startBrightness = 1;

  private startWarmth = 0;

  private gammaHelperPath = path.resolve(process.cwd(), 'src/main/gamma-helper');

  setTarget(brightness: number, warmth: number): void {
    this.targetBrightness = clamp(brightness, 0.2, 1);
    this.targetWarmth = clamp(warmth, 0, 1);
    this.restartTransition();
  }

  async reset(): Promise<void> {
    this.clearTimer();
    this.currentBrightness = 1;
    this.currentWarmth = 0;
    await this.applyBrightness(1);
    await this.applyGamma(0);
  }

  private restartTransition(): void {
    this.clearTimer();
    this.step = 0;
    this.startBrightness = this.currentBrightness;
    this.startWarmth = this.currentWarmth;
    this.timer = setInterval(async () => {
      if (this.busy) return;
      this.busy = true;
      try {
        this.step += 1;
        const t = clamp(this.step / this.totalSteps, 0, 1);
        this.currentBrightness = lerp(this.startBrightness, this.targetBrightness, t);
        this.currentWarmth = lerp(this.startWarmth, this.targetWarmth, t);
        await this.applyBrightness(this.currentBrightness);
        await this.applyGamma(this.currentWarmth);
        if (t >= 1) this.clearTimer();
      } finally {
        this.busy = false;
      }
    }, 50);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async applyBrightness(level: number): Promise<void> {
    const safe = clamp(level, 0.2, 1);
    try {
      await execAsync(`brightness ${safe.toFixed(2)}`);
      return;
    } catch (error) {
      // On unsupported displays we keep running without system dimming.
      console.warn('brightness CLI unavailable on this display, skipping applyBrightness', error);
      return;
    }
  }

  private async applyGamma(warmth: number): Promise<void> {
    const safeWarmth = clamp(warmth, 0, 1);
    const red = 1.0;
    const green = clamp(1.0 - safeWarmth * 0.3, 0.5, 1.0);
    const blue = clamp(1.0 - safeWarmth * 0.4, 0.4, 1.0);
    const helperPaths = [
      this.gammaHelperPath,
      path.resolve(process.cwd(), 'src/main/gamma-helper'),
      path.resolve(__dirname, 'gamma-helper'),
    ];

    for (const helperPath of helperPaths) {
      try {
        await execFileAsync(helperPath, [red.toFixed(3), green.toFixed(3), blue.toFixed(3)]);
        return;
      } catch {
        // Keep trying candidate paths.
      }
    }
  }
}

export const ambientController = new AmbientController();

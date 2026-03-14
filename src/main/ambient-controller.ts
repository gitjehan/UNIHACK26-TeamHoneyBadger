import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export class AmbientController {
  private currentWarmth = 0;
  private targetWarmth = 0;
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private step = 0;
  private totalSteps = 40;
  private startWarmth = 0;
  private helperPath: string | null = null;
  private helperResolved = false;
  private lastAppliedWarmth = -1;

  setTarget(_brightness: number, warmth: number): void {
    const newWarmth = clamp(warmth, 0, 1);

    if (Math.abs(newWarmth - this.targetWarmth) < 0.01) return;

    this.targetWarmth = newWarmth;
    this.startWarmth = this.currentWarmth;
    this.step = 0;

    if (!this.timer) {
      this.startTransition();
    }
  }

  async reset(): Promise<void> {
    this.clearTimer();
    this.currentWarmth = 0;
    this.targetWarmth = 0;
    this.lastAppliedWarmth = -1;
    await this.applyWarmth(0);
  }

  private startTransition(): void {
    this.clearTimer();
    this.timer = setInterval(async () => {
      if (this.busy) return;
      this.busy = true;
      try {
        this.step += 1;
        const t = clamp(this.step / this.totalSteps, 0, 1);
        this.currentWarmth = lerp(this.startWarmth, this.targetWarmth, t);
        await this.applyWarmth(this.currentWarmth);
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

  private resolveHelper(): string | null {
    if (this.helperResolved) return this.helperPath;
    this.helperResolved = true;

    const candidates = [
      path.resolve(process.cwd(), 'src', 'main', 'gamma-cg'),
      path.resolve(__dirname, 'gamma-cg'),
      path.resolve(__dirname, '..', 'main', 'gamma-cg'),
      path.resolve(__dirname, '..', '..', 'src', 'main', 'gamma-cg'),
    ];

    for (const candidate of candidates) {
      try {
        const stat = fs.statSync(candidate);
        if (stat.isFile()) {
          this.helperPath = candidate;
          console.log('[Ambient] gamma-cg (Night Shift) found at:', candidate);
          return candidate;
        }
      } catch {
        // not at this path
      }
    }
    console.warn('[Ambient] gamma-cg binary not found. Searched:', candidates);
    return null;
  }

  private async applyWarmth(warmth: number): Promise<void> {
    const rounded = Math.round(warmth * 100) / 100;
    if (rounded === this.lastAppliedWarmth) return;
    this.lastAppliedWarmth = rounded;

    const helper = this.resolveHelper();
    if (!helper) return;

    try {
      await execFileAsync(helper, [rounded.toFixed(2)]);
    } catch (error) {
      console.warn('[Ambient] gamma-cg exec failed:', error);
    }
  }
}

export const ambientController = new AmbientController();

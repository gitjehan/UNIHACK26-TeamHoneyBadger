import {
  BLINK_MAX_FRAMES,
  BLINK_MIN_FRAMES,
  EAR_BLINK_THRESHOLD,
  EAR_NORMAL_RANGE,
  LEFT_EYE,
  RIGHT_EYE,
} from '@renderer/lib/constants';
import { clamp, euclideanDist } from '@renderer/lib/math';
import { RollingAverage, RollingBuffer } from '@renderer/lib/rolling-buffer';
import type { BlinkData, Point } from '@renderer/lib/types';

export interface BlinkFrame extends BlinkData {
  fatigueScore: number;
}

function eyeAspectRatio(landmarks: Point[], eye: typeof LEFT_EYE): number {
  const verticalDists = eye.top.map((topIdx, index) =>
    euclideanDist(landmarks[topIdx], landmarks[eye.bottom[index]]),
  );
  const avgVertical = verticalDists.reduce((acc, distance) => acc + distance, 0) / verticalDists.length;
  const horizontal = euclideanDist(landmarks[eye.left], landmarks[eye.right]);
  if (!horizontal) return 0;
  return avgVertical / horizontal;
}

export class BlinkDetector {
  private blinkTimestamps = new RollingBuffer<number>(400);

  private earBuffer = new RollingAverage(30);

  private prolongedClosures = new RollingBuffer<number>(100);

  private closedFrames = 0;

  update(faceLandmarks: Point[], baselineBlinkRate: number): BlinkFrame {
    const left = eyeAspectRatio(faceLandmarks, LEFT_EYE);
    const right = eyeAspectRatio(faceLandmarks, RIGHT_EYE);
    const ear = (left + right) / 2;
    this.earBuffer.push(ear);

    if (ear < EAR_BLINK_THRESHOLD) {
      this.closedFrames += 1;
    } else if (this.closedFrames > 0) {
      if (this.closedFrames >= BLINK_MIN_FRAMES && this.closedFrames <= BLINK_MAX_FRAMES) {
        this.blinkTimestamps.push(Date.now());
      } else if (this.closedFrames > BLINK_MAX_FRAMES) {
        this.prolongedClosures.push(Date.now());
      }
      this.closedFrames = 0;
    }

    const minuteAgo = Date.now() - 60_000;
    const fiveMinAgo = Date.now() - 300_000;

    const blinkRate = this.blinkTimestamps.items.filter((timestamp) => timestamp >= minuteAgo).length;
    const prolongedClosures = this.prolongedClosures.items.filter(
      (timestamp) => timestamp >= fiveMinAgo,
    ).length;

    const fatigueScore = calculateFatigueScore(
      blinkRate,
      baselineBlinkRate || 17,
      this.earBuffer.average,
      prolongedClosures,
    );

    return {
      rate: blinkRate,
      avgEAR: this.earBuffer.average,
      prolongedClosures,
      fatigueScore,
    };
  }
}

export function calculateFatigueScore(
  currentBlinkRate: number,
  baselineBlinkRate: number,
  avgEAR: number,
  prolongedClosures: number,
): number {
  const safeBaseline = Math.max(1, baselineBlinkRate);
  const blinkDeviation = Math.abs(currentBlinkRate - safeBaseline) / safeBaseline;
  const blinkScore = clamp((1 - blinkDeviation) * 100, 0, 100);
  const earScore = clamp(
    ((avgEAR - EAR_NORMAL_RANGE.drowsy) / (EAR_NORMAL_RANGE.alert - EAR_NORMAL_RANGE.drowsy)) * 100,
    0,
    100,
  );
  const closurePenalty = clamp(prolongedClosures * 15, 0, 50);
  return Math.round(Math.max(0, blinkScore * 0.4 + earScore * 0.4 + (100 - closurePenalty) * 0.2));
}

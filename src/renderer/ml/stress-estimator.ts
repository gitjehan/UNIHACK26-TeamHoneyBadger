import { EMOTION_STRESS_MAP, STRESS_WEIGHTS } from '@renderer/lib/constants';
import { clamp } from '@renderer/lib/math';

export function calculateStressScore(
  emotionState: string,
  emotionConfidence: number,
  postureVariance: number,
  blinkRateDeviation: number,
): number {
  const emotionScore = (EMOTION_STRESS_MAP[emotionState] ?? 50) * clamp(emotionConfidence, 0, 1);
  const fidgetScore = clamp(postureVariance * 5, 0, 100);
  const blinkStress = clamp(blinkRateDeviation * 50, 0, 100);

  return Math.round(
    emotionScore * STRESS_WEIGHTS.emotion +
      fidgetScore * STRESS_WEIGHTS.fidget +
      blinkStress * STRESS_WEIGHTS.blink,
  );
}

import type { Point } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function euclideanDist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function cosineSimilarity(vecA: [number, number], vecB: [number, number]): number {
  const dot = vecA[0] * vecB[0] + vecA[1] * vecB[1];
  const magA = Math.sqrt(vecA[0] ** 2 + vecA[1] ** 2);
  const magB = Math.sqrt(vecB[0] ** 2 + vecB[1] ** 2);
  if (!magA || !magB) return 0;
  return dot / (magA * magB);
}

export function stddev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => {
      const delta = value - mean;
      return sum + delta * delta;
    }, 0) / values.length;
  return Math.sqrt(variance);
}

export function calculateAngle(a: Point, b: Point, c: Point): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

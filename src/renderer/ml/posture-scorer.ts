import { LANDMARKS, POSTURE_WEIGHTS, SHOULDER_SLANT_MAX, SLOUCH_THRESHOLD } from '@renderer/lib/constants';
import { calculateAngle, clamp } from '@renderer/lib/math';
import type { Point, PostureData } from '@renderer/lib/types';

let lastDebugLog = 0;

function isUsable(point: Point | undefined, minVisibility = 0.15): point is Point {
  if (!point) return false;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  return (point.visibility ?? 1) >= minVisibility;
}

function averageAvailable(points: Array<Point | undefined>, fallback: Point): Point {
  const valid = points.filter((point): point is Point => Boolean(point));
  if (!valid.length) return fallback;
  const sum = valid.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / valid.length, y: sum.y / valid.length };
}

function getShoulder(landmarks: Point[]): Point {
  const left = isUsable(landmarks[LANDMARKS.LEFT_SHOULDER]) ? landmarks[LANDMARKS.LEFT_SHOULDER] : undefined;
  const right = isUsable(landmarks[LANDMARKS.RIGHT_SHOULDER]) ? landmarks[LANDMARKS.RIGHT_SHOULDER] : undefined;
  return averageAvailable([left, right], { x: 0.5, y: 0.45 });
}

function getHead(landmarks: Point[], shoulder: Point): Point {
  const leftEar = isUsable(landmarks[LANDMARKS.LEFT_EAR], 0.2) ? landmarks[LANDMARKS.LEFT_EAR] : undefined;
  const rightEar = isUsable(landmarks[LANDMARKS.RIGHT_EAR], 0.2) ? landmarks[LANDMARKS.RIGHT_EAR] : undefined;
  const nose = isUsable(landmarks[LANDMARKS.NOSE], 0.2) ? landmarks[LANDMARKS.NOSE] : undefined;
  const earOnly = [leftEar, rightEar].filter((point): point is Point => Boolean(point));
  if (earOnly.length >= 2) {
    return averageAvailable(earOnly, { x: shoulder.x, y: Math.max(0, shoulder.y - 0.14) });
  }
  return averageAvailable([leftEar, rightEar, nose], { x: shoulder.x, y: Math.max(0, shoulder.y - 0.14) });
}

export function calculatePostureMetrics(
  landmarks: Point[],
): Omit<PostureData, 'score'> {
  const shoulder = getShoulder(landmarks);
  const head = getHead(landmarks, shoulder);
  const torsoAnchor = { x: shoulder.x, y: shoulder.y + 0.15 };

  const rawNeckAngle = calculateAngle(head, shoulder, torsoAnchor);
  const neckAngle = Number.isFinite(rawNeckAngle) ? rawNeckAngle : 170;

  const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
  const shouldersUsable = isUsable(leftShoulder) && isUsable(rightShoulder);

  const shoulderSlant = shouldersUsable
    ? Math.atan2(
        Math.abs(rightShoulder.y - leftShoulder.y),
        Math.abs(rightShoulder.x - leftShoulder.x),
      ) * (180 / Math.PI)
    : 0;

  const now = Date.now();
  if (now - lastDebugLog >= 2000) {
    lastDebugLog = now;
    const lsVis = (landmarks[LANDMARKS.LEFT_SHOULDER]?.visibility ?? 0).toFixed(2);
    const rsVis = (landmarks[LANDMARKS.RIGHT_SHOULDER]?.visibility ?? 0).toFixed(2);
    const leVis = (landmarks[LANDMARKS.LEFT_EAR]?.visibility ?? 0).toFixed(2);
    const reVis = (landmarks[LANDMARKS.RIGHT_EAR]?.visibility ?? 0).toFixed(2);
    console.log(
      `[Posture] neck=${neckAngle.toFixed(1)}° slant=${shoulderSlant.toFixed(1)}° | vis: LS=${lsVis} RS=${rsVis} LE=${leVis} RE=${reVis}`,
    );
  }

  return {
    neckAngle,
    shoulderSlant,
    slumpSeverity: Math.max(
      clamp((SLOUCH_THRESHOLD - neckAngle) / 30, 0, 1),
      clamp((shoulderSlant - 7) / 8, 0, 1),
    ),
  };
}

export function calculatePostureScore(
  neckAngle: number,
  shoulderSlant: number,
): number {
  // Neck: 180° = perfect (100), 130° = terrible (0).
  const neckScore = clamp(((neckAngle - 130) / 50) * 100, 0, 100);
  const shoulderScore = clamp((1 - shoulderSlant / SHOULDER_SLANT_MAX) * 100, 0, 100);

  return Math.round(
    neckScore * POSTURE_WEIGHTS.neck +
      shoulderScore * POSTURE_WEIGHTS.shoulder,
  );
}

export function scorePosture(landmarks: Point[]): PostureData {
  const metrics = calculatePostureMetrics(landmarks);
  return {
    ...metrics,
    score: calculatePostureScore(metrics.neckAngle, metrics.shoulderSlant),
  };
}

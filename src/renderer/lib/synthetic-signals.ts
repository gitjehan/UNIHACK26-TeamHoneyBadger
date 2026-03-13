import { LANDMARKS } from './constants';
import type { Point } from './types';

export type SyntheticPostureState = 'upright' | 'slouch';

function basePose(): Point[] {
  return new Array(33).fill(0).map(() => ({ x: 0.5, y: 0.5, visibility: 1 }));
}

export function createSyntheticPose(state: SyntheticPostureState, tick = 0): Point[] {
  const points = basePose();
  const sway = Math.sin(tick / 8) * 0.01;
  const breathing = Math.sin(tick / 12) * 0.005;

  if (state === 'upright') {
    points[LANDMARKS.NOSE] = { x: 0.5 + sway, y: 0.3, visibility: 1 };
    points[LANDMARKS.LEFT_EAR] = { x: 0.45 + sway, y: 0.31, visibility: 1 };
    points[LANDMARKS.RIGHT_EAR] = { x: 0.55 + sway, y: 0.31, visibility: 1 };
    points[LANDMARKS.LEFT_SHOULDER] = { x: 0.43 + sway, y: 0.43 + breathing, visibility: 1 };
    points[LANDMARKS.RIGHT_SHOULDER] = { x: 0.57 + sway, y: 0.43 - breathing, visibility: 1 };
    points[LANDMARKS.LEFT_HIP] = { x: 0.45 + sway, y: 0.64, visibility: 1 };
    points[LANDMARKS.RIGHT_HIP] = { x: 0.55 + sway, y: 0.64, visibility: 1 };
  } else {
    points[LANDMARKS.NOSE] = { x: 0.6 + sway, y: 0.38, visibility: 1 };
    points[LANDMARKS.LEFT_EAR] = { x: 0.56 + sway, y: 0.39, visibility: 1 };
    points[LANDMARKS.RIGHT_EAR] = { x: 0.66 + sway, y: 0.39, visibility: 1 };
    points[LANDMARKS.LEFT_SHOULDER] = { x: 0.45 + sway, y: 0.47, visibility: 1 };
    points[LANDMARKS.RIGHT_SHOULDER] = { x: 0.58 + sway, y: 0.52, visibility: 1 };
    points[LANDMARKS.LEFT_HIP] = { x: 0.47 + sway, y: 0.69, visibility: 1 };
    points[LANDMARKS.RIGHT_HIP] = { x: 0.58 + sway, y: 0.72, visibility: 1 };
  }

  points[LANDMARKS.LEFT_ELBOW] = { x: points[LANDMARKS.LEFT_SHOULDER].x - 0.05, y: 0.56, visibility: 1 };
  points[LANDMARKS.RIGHT_ELBOW] = { x: points[LANDMARKS.RIGHT_SHOULDER].x + 0.05, y: 0.56, visibility: 1 };
  points[LANDMARKS.LEFT_WRIST] = { x: points[LANDMARKS.LEFT_ELBOW].x - 0.04, y: 0.66, visibility: 1 };
  points[LANDMARKS.RIGHT_WRIST] = { x: points[LANDMARKS.RIGHT_ELBOW].x + 0.04, y: 0.66, visibility: 1 };
  points[LANDMARKS.LEFT_KNEE] = { x: points[LANDMARKS.LEFT_HIP].x, y: 0.82, visibility: 1 };
  points[LANDMARKS.RIGHT_KNEE] = { x: points[LANDMARKS.RIGHT_HIP].x, y: 0.82, visibility: 1 };
  points[LANDMARKS.LEFT_ANKLE] = { x: points[LANDMARKS.LEFT_HIP].x, y: 0.94, visibility: 1 };
  points[LANDMARKS.RIGHT_ANKLE] = { x: points[LANDMARKS.RIGHT_HIP].x, y: 0.94, visibility: 1 };

  return points;
}

export function createSyntheticFace(closedEyes: boolean): Point[] {
  const points: Point[] = new Array(478).fill(0).map((_, index) => {
    const theta = (Math.PI * 2 * index) / 478;
    return {
      x: 0.5 + Math.cos(theta) * 0.08,
      y: 0.42 + Math.sin(theta) * 0.1,
      visibility: 1,
    };
  });

  const leftInner = { x: 0.43, y: 0.43 };
  const leftOuter = { x: 0.5, y: 0.43 };
  const rightInner = { x: 0.58, y: 0.43 };
  const rightOuter = { x: 0.65, y: 0.43 };
  const lidOffset = closedEyes ? 0.001 : 0.016;

  points[33] = { ...leftInner, visibility: 1 };
  points[133] = { ...leftOuter, visibility: 1 };
  points[159] = { x: 0.465, y: 0.43 - lidOffset, visibility: 1 };
  points[158] = { x: 0.455, y: 0.43 - lidOffset, visibility: 1 };
  points[157] = { x: 0.445, y: 0.43 - lidOffset, visibility: 1 };
  points[145] = { x: 0.465, y: 0.43 + lidOffset, visibility: 1 };
  points[144] = { x: 0.455, y: 0.43 + lidOffset, visibility: 1 };
  points[153] = { x: 0.445, y: 0.43 + lidOffset, visibility: 1 };

  points[362] = { ...rightInner, visibility: 1 };
  points[263] = { ...rightOuter, visibility: 1 };
  points[386] = { x: 0.615, y: 0.43 - lidOffset, visibility: 1 };
  points[385] = { x: 0.605, y: 0.43 - lidOffset, visibility: 1 };
  points[384] = { x: 0.595, y: 0.43 - lidOffset, visibility: 1 };
  points[374] = { x: 0.615, y: 0.43 + lidOffset, visibility: 1 };
  points[373] = { x: 0.605, y: 0.43 + lidOffset, visibility: 1 };
  points[380] = { x: 0.595, y: 0.43 + lidOffset, visibility: 1 };

  return points;
}

import { describe, expect, it } from 'vitest';
import { calculateAngle, clamp, cosineSimilarity, stddev } from './math';

describe('math helpers', () => {
  it('clamps values in range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('calculates cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('computes standard deviation', () => {
    expect(stddev([1, 1, 1, 1])).toBe(0);
    expect(stddev([1, 2, 3, 4])).toBeGreaterThan(1);
  });

  it('computes shoulder/neck angle correctly', () => {
    const angle = calculateAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 });
    expect(angle).toBe(180);
  });
});

import { describe, expect, it } from 'vitest';
import { calculateStressScore } from './stress-estimator';

describe('stress estimator', () => {
  it('returns higher stress for angry+high variance', () => {
    const low = calculateStressScore('neutral', 0.8, 2, 0.1);
    const high = calculateStressScore('angry', 0.9, 11, 1.2);
    expect(high).toBeGreaterThan(low);
  });
});

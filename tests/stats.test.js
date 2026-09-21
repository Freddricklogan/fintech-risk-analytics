import { describe, expect, it } from 'vitest';
import { histogram, mean, percentileSorted, sorted, standardError, std, variance } from '../src/stats.js';

describe('moments and percentiles', () => {
  it('computes by hand', () => {
    const xs = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(xs)).toBe(5);
    expect(variance(xs)).toBeCloseTo(32 / 7, 12);
    expect(std(xs)).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(standardError(xs)).toBeCloseTo(Math.sqrt(32 / 7) / Math.sqrt(8), 12);
    expect(mean([])).toBeNaN();
    expect(variance([1])).toBeNaN();
    const s = sorted([10, 20, 30, 40]);
    expect(percentileSorted(s, 0.5)).toBe(25);
    expect(percentileSorted(s, 0)).toBe(10);
    expect(percentileSorted(s, 1)).toBe(40);
    expect(percentileSorted(sorted([]), 0.5)).toBeNaN();
  });
  it('bins histograms', () => {
    const h = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(h.counts).toEqual([2, 2, 2, 2, 3]);
    expect(histogram([], 5)).toEqual({ edges: [], counts: [] });
    expect(histogram([3, 3], 5)).toEqual({ edges: [3, 3], counts: [2] });
  });
});

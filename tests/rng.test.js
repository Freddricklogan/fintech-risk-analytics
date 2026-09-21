import { describe, expect, it } from 'vitest';
import { inverseNormal, makeSampler, mulberry32, normalCdf, normalSource } from '../src/rng.js';
import { mean, std } from '../src/stats.js';

describe('mulberry32', () => {
  it('is deterministic per seed and uniform in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 20000 }, () => a());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(mean(xs)).toBeCloseTo(0.5, 2);
  });
});

describe('inverseNormal / normalCdf', () => {
  it('matches tabulated quantiles to 1e-6 and round-trips', () => {
    expect(inverseNormal(0.5)).toBeCloseTo(0, 9);
    expect(inverseNormal(0.975)).toBeCloseTo(1.959964, 6);
    expect(inverseNormal(0.05)).toBeCloseTo(-1.644854, 6);
    expect(inverseNormal(1e-6)).toBeCloseTo(-4.753424, 5);
    for (const p of [0.001, 0.1, 0.3, 0.7, 0.9, 0.999]) expect(normalCdf(inverseNormal(p))).toBeCloseTo(p, 6);
    expect(normalCdf(0)).toBeCloseTo(0.5, 12);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(normalCdf(-40)).toBe(0);
    expect(normalCdf(8)).toBeCloseTo(1, 12);
    expect(() => inverseNormal(0)).toThrow(RangeError);
  });
});

describe('normalSource and makeSampler', () => {
  it('produces N(0,1) draws within statistical tolerance', () => {
    const normal = normalSource(mulberry32(1));
    const xs = Array.from({ length: 50000 }, () => normal());
    expect(Math.abs(mean(xs))).toBeLessThan(0.02);
    expect(std(xs)).toBeCloseTo(1, 1);
    const s = makeSampler({ seed: 5, dim: 3 });
    expect(s.normals()).toHaveLength(3);
    expect(s.uniforms(2).every((u) => u >= 0 && u < 1)).toBe(true);
    expect(s.method).toBe('pseudo');
  });
});

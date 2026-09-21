import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inverseNormal, makeSampler } from '../src/rng.js';
import { beta, cholesky, correlationMatrix, covariance, expectedShortfall, growthSeries, historicalVar, maxDrawdown, monteCarloVar, parametricVar, portfolioReturns, projectValue, returnsFromCloses, sharpeRatio } from '../src/risk.js';
import { mean, std } from '../src/stats.js';

const market = JSON.parse(readFileSync(new URL('../data/market-data.json', import.meta.url), 'utf8'));
const closes = (s) => market[s].map((d) => d.close);

describe('shipped market data', () => {
  it('has 252 business days per symbol with returns derived from closes', () => {
    for (const [sym, rows] of Object.entries(market)) {
      expect(rows, sym).toHaveLength(252);
      for (const r of rows) expect(new Date(r.date).getUTCDay(), r.date).not.toBe(0);
      const derived = returnsFromCloses(rows.map((d) => d.close));
      derived.forEach((r, i) => expect(rows[i + 1].return).toBeCloseTo(r, 5));
    }
  });
});

describe('VaR family on a known series', () => {
  const rets = [-0.05, -0.02, -0.01, 0, 0.005, 0.01, 0.015, 0.02, 0.03, 0.04];
  it('historical VaR interpolates the 5th percentile; expected shortfall averages the tail', () => {
    // 5th percentile of 10 sorted values at h = 0.45 → -0.05 + 0.45·0.03 = -0.0365
    expect(historicalVar(rets, 0.95)).toBeCloseTo(0.0365, 10);
    expect(expectedShortfall(rets, 0.95)).toBeCloseTo(0.05, 10); // only -0.05 lies beyond -0.0365
  });
  it('parametric VaR is −(μ + z·σ)', () => {
    expect(parametricVar(rets, 0.95)).toBeCloseTo(-(mean(rets) + inverseNormal(0.05) * std(rets)), 12);
  });
  it('Sharpe, drawdown, growth and beta by hand', () => {
    expect(sharpeRatio(rets, 0)).toBeCloseTo((mean(rets) * 252) / (std(rets) * Math.sqrt(252)), 12);
    const dd = maxDrawdown([100, 120, 90, 100, 130, 65]);
    expect(dd.maxDrawdown).toBeCloseTo(0.5, 12);
    expect(dd.series[2]).toBeCloseTo(0.25, 12);
    expect(growthSeries([0.1, -0.5], 100)).toEqual([100, 110.00000000000001, 55.00000000000001]);
    expect(beta([1, 2, 3], [2, 4, 6])).toBeCloseTo(0.5, 12);
    expect(covariance([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 12);
  });
});

describe('portfolioReturns', () => {
  it('renormalises over covered symbols and reports missing ones', () => {
    const r = portfolioReturns({ A: 0.5, B: 0.25, C: 0.25 }, { A: [0.1, 0.2], B: [0, 0.4, 0.9] });
    expect(r.missing).toEqual(['C']);
    expect(r.coveredWeight).toBeCloseTo(0.75, 12);
    expect(r.returns).toHaveLength(2);
    expect(r.returns[1]).toBeCloseTo((0.5 / 0.75) * 0.2 + (0.25 / 0.75) * 0.4, 12);
    expect(() => portfolioReturns({ Z: 1 }, {})).toThrow(/no holding/);
  });
});

describe('cholesky, correlation and Monte Carlo VaR', () => {
  it('cholesky reconstructs and rejects', () => {
    const A = [[4, 2], [2, 3]];
    const L = cholesky(A);
    expect(L[0][0] * L[0][0]).toBeCloseTo(4, 12);
    expect(L[1][0] * L[0][0]).toBeCloseTo(2, 12);
    expect(L[1][0] ** 2 + L[1][1] ** 2).toBeCloseTo(3, 12);
    expect(() => cholesky([[1, 2], [2, 1]])).toThrow(RangeError);
  });
  it('correlation matrix has unit diagonal and |ρ| ≤ 1 on the shipped data', () => {
    const series = ['AAPL', 'MSFT', 'JPM'].map((s) => returnsFromCloses(closes(s)));
    const C = correlationMatrix(series);
    for (let i = 0; i < 3; i += 1) {
      expect(C[i][i]).toBeCloseTo(1, 12);
      for (let j = 0; j < 3; j += 1) expect(Math.abs(C[i][j])).toBeLessThanOrEqual(1 + 1e-12);
    }
    expect(C[0][1]).toBeGreaterThan(C[0][2]); // same-sector pair correlates more than cross-sector, by construction of the generator
  });
  it('Monte Carlo VaR agrees with parametric VaR within 3% for jointly normal draws', () => {
    const symbols = ['AAPL', 'MSFT', 'JPM', 'XOM'];
    const series = symbols.map((s) => returnsFromCloses(closes(s)));
    const weights = [0.4, 0.3, 0.2, 0.1];
    const port = series[0].map((_, t) => weights.reduce((s, w, i) => s + w * series[i][t], 0));
    const pv = parametricVar(port, 0.95);
    const mc = monteCarloVar({ weights, series, n: 40000, c: 0.95 }, makeSampler({ seed: 3, dim: 4 }).normals);
    expect(Math.abs(mc.var - pv) / pv).toBeLessThan(0.03);
    expect(mc.es).toBeGreaterThan(mc.var);
  });
});

describe('projectValue', () => {
  it('bands are ordered, start at the value, and the terminal mean tracks the closed form', () => {
    const p = { value: 1000, annualReturn: 0.1, annualVol: 0.2, days: 126, paths: 4000 };
    const r = projectValue(p, makeSampler({ seed: 8 }).normals);
    expect(r.p50[0]).toBe(1000);
    for (let t = 0; t < r.p5.length; t += 1) {
      expect(r.p5[t]).toBeLessThanOrEqual(r.p50[t]);
      expect(r.p50[t]).toBeLessThanOrEqual(r.p95[t]);
    }
    const closedMean = 1000 * Math.exp(0.1 * (126 / 252));
    expect(Math.abs(mean(r.finals) - closedMean) / closedMean).toBeLessThan(0.01);
    expect(r.sample).toHaveLength(40);
    expect(() => projectValue({ ...p, paths: 0 }, makeSampler().normals)).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';
import { blackScholes, breakEven, normalPdf, payoffCurve, validateOption } from '../src/options.js';

const P = { S: 100, K: 100, T: 0.25, r: 0.05, sigma: 0.2 };

describe('blackScholes', () => {
  it('matches known values for an at-the-money quarter option', () => {
    const { call, put } = blackScholes(P);
    // Hull-style reference: C ≈ 4.6150, P ≈ 3.3728
    expect(call.price).toBeCloseTo(4.615, 3);
    expect(put.price).toBeCloseTo(3.3728, 3);
    expect(call.price - put.price).toBeCloseTo(P.S - P.K * Math.exp(-P.r * P.T), 9);
    expect(call.delta - put.delta).toBeCloseTo(1, 12);
    expect(call.gamma).toBe(put.gamma);
    expect(call.vega).toBe(put.vega);
  });
  it('Greeks agree with finite differences', () => {
    const h = 1e-4;
    const base = blackScholes(P);
    const up = blackScholes({ ...P, S: P.S + h }).call.price;
    const dn = blackScholes({ ...P, S: P.S - h }).call.price;
    expect((up - dn) / (2 * h)).toBeCloseTo(base.call.delta, 6);
    expect((up - 2 * base.call.price + dn) / (h * h)).toBeCloseTo(base.call.gamma, 4);
    const vUp = blackScholes({ ...P, sigma: P.sigma + 0.01 }).call.price;
    expect(vUp - base.call.price).toBeCloseTo(base.call.vega, 2);
    const rUp = blackScholes({ ...P, r: P.r + 0.01 }).call.price;
    expect(rUp - base.call.price).toBeCloseTo(base.call.rho, 2);
    const tDn = blackScholes({ ...P, T: P.T - 1 / 365 }).call.price;
    expect(tDn - base.call.price).toBeCloseTo(base.call.theta, 3);
  });
  it('handles expiry and validates', () => {
    const e = blackScholes({ ...P, T: 0, S: 110 });
    expect(e.call.price).toBe(10);
    expect(e.put.price).toBe(0);
    expect(e.call.delta).toBe(1);
    expect(validateOption({ ...P, sigma: 0 })).toContain('volatility must be positive');
    expect(() => blackScholes({ ...P, K: 0 })).toThrow(RangeError);
    expect(normalPdf(0)).toBeCloseTo(0.3989423, 6);
  });
});

describe('payoff helpers', () => {
  it('payoff curve and break-even', () => {
    const c = payoffCurve('call', 100, 5, [80, 120], 4);
    expect(c.map((p) => p.pnl)).toEqual([-5, -5, -5, 5, 15]);
    expect(breakEven('call', 100, 5)).toBe(105);
    expect(breakEven('put', 100, 5)).toBe(95);
    expect(payoffCurve('put', 100, 5, [80, 120], 4).map((p) => p.pnl)).toEqual([15, 5, -5, -5, -5]);
  });
});

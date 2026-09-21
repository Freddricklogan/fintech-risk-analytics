/** Black–Scholes prices and Greeks with a double-precision normal CDF. */
import { normalCdf } from './rng.js';

export function normalPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function validateOption({ S, K, T, r, sigma }) {
  const problems = [];
  if (!(S > 0)) problems.push('spot must be positive');
  if (!(K > 0)) problems.push('strike must be positive');
  if (!(T >= 0)) problems.push('time to expiry must be >= 0');
  if (!Number.isFinite(r)) problems.push('rate must be a number');
  if (!(sigma > 0)) problems.push('volatility must be positive');
  return problems;
}

/** Price and Greeks for both sides. Theta per calendar day; vega and rho per 1% move. */
export function blackScholes(params) {
  const problems = validateOption(params);
  if (problems.length) throw new RangeError(problems.join('; '));
  const { S, K, T, r, sigma } = params;
  if (T === 0) {
    return {
      call: { price: Math.max(S - K, 0), delta: S > K ? 1 : 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
      put: { price: Math.max(K - S, 0), delta: S < K ? -1 : 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
      d1: NaN,
      d2: NaN
    };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const disc = Math.exp(-r * T);
  const pdf = normalPdf(d1);
  const gamma = pdf / (S * sigma * sqrtT);
  const vega = (S * pdf * sqrtT) / 100;
  const call = {
    price: S * normalCdf(d1) - K * disc * normalCdf(d2),
    delta: normalCdf(d1),
    gamma,
    theta: (-(S * pdf * sigma) / (2 * sqrtT) - r * K * disc * normalCdf(d2)) / 365,
    vega,
    rho: (K * T * disc * normalCdf(d2)) / 100
  };
  const put = {
    price: K * disc * normalCdf(-d2) - S * normalCdf(-d1),
    delta: normalCdf(d1) - 1,
    gamma,
    theta: (-(S * pdf * sigma) / (2 * sqrtT) + r * K * disc * normalCdf(-d2)) / 365,
    vega,
    rho: (-K * T * disc * normalCdf(-d2)) / 100
  };
  return { call, put, d1, d2 };
}

/** Payoff at expiry net of premium over a spot range, for the diagram. */
export function payoffCurve(type, K, premium, [lo, hi], points = 60) {
  const out = [];
  for (let i = 0; i <= points; i += 1) {
    const s = lo + ((hi - lo) * i) / points;
    const intrinsic = type === 'call' ? Math.max(s - K, 0) : Math.max(K - s, 0);
    out.push({ spot: s, pnl: intrinsic - premium });
  }
  return out;
}

/** Break-even spot at expiry for a long option. */
export function breakEven(type, K, premium) {
  return type === 'call' ? K + premium : K - premium;
}

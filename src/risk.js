/** Portfolio risk: three VaR methods side by side, expected shortfall, Sharpe, drawdown, beta, covariance. */
import { inverseNormal } from './rng.js';
import { mean, percentileSorted, sorted, std } from './stats.js';

/** Daily log-free simple returns from a close series. */
export function returnsFromCloses(closes) {
  const out = [];
  for (let i = 1; i < closes.length; i += 1) out.push(closes[i] / closes[i - 1] - 1);
  return out;
}

/** Portfolio daily returns from holdings' market-value weights and each symbol's return series. Symbols without history are reported. */
export function portfolioReturns(weightsBySymbol, returnsBySymbol) {
  const symbols = Object.keys(weightsBySymbol);
  const missing = symbols.filter((s) => !returnsBySymbol[s]);
  const covered = symbols.filter((s) => returnsBySymbol[s]);
  if (covered.length === 0) throw new Error('no holding has a return history');
  const weightSum = covered.reduce((s, sym) => s + weightsBySymbol[sym], 0);
  const n = Math.min(...covered.map((s) => returnsBySymbol[s].length));
  const out = new Array(n).fill(0);
  for (const sym of covered) {
    const w = weightsBySymbol[sym] / weightSum; // renormalised over covered holdings
    const r = returnsBySymbol[sym];
    for (let t = 0; t < n; t += 1) out[t] += w * r[t];
  }
  return { returns: out, missing, coveredWeight: weightSum };
}

export function parametricVar(returns, c = 0.95) {
  return -(mean(returns) + std(returns) * inverseNormal(1 - c));
}

export function historicalVar(returns, c = 0.95) {
  return -percentileSorted(sorted(returns), 1 - c);
}

/** Expected shortfall: mean loss beyond the historical VaR. */
export function expectedShortfall(returns, c = 0.95) {
  const cut = -historicalVar(returns, c);
  const tail = returns.filter((r) => r <= cut);
  return tail.length ? -mean(tail) : -cut;
}

/** Annualised Sharpe from daily returns (252 days), excess over `rf` (annual). */
export function sharpeRatio(returns, rf = 0) {
  const vol = std(returns) * Math.sqrt(252);
  return (mean(returns) * 252 - rf) / vol;
}

export function maxDrawdown(values) {
  let peak = values[0];
  let maxDD = 0;
  const series = [];
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    series.push(dd);
    if (dd > maxDD) maxDD = dd;
  }
  return { maxDrawdown: maxDD, series };
}

export function growthSeries(returns, start = 100) {
  const out = [start];
  for (const r of returns) out.push(out[out.length - 1] * (1 + r));
  return out;
}

export function covariance(a, b) {
  const n = Math.min(a.length, b.length);
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let s = 0;
  for (let i = 0; i < n; i += 1) s += (a[i] - ma) * (b[i] - mb);
  return s / (n - 1);
}

export function beta(asset, market) {
  return covariance(asset, market) / covariance(market, market);
}

export function covarianceMatrix(series) {
  return series.map((a) => series.map((b) => covariance(a, b)));
}

export function correlationMatrix(series) {
  const C = covarianceMatrix(series);
  return C.map((row, i) => row.map((v, j) => v / Math.sqrt(C[i][i] * C[j][j])));
}

/** Cholesky factor of a symmetric positive-definite matrix; throws otherwise. */
export function cholesky(A) {
  const n = A.length;
  const L = A.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = 0;
      for (let k = 0; k < j; k += 1) s += L[i][k] * L[j][k];
      if (i === j) {
        const d = A[i][i] - s;
        if (d <= 0) throw new RangeError('matrix is not positive definite');
        L[i][j] = Math.sqrt(d);
      } else L[i][j] = (A[i][j] - s) / L[j][j];
    }
  }
  return L;
}

/**
 * Monte Carlo VaR: draws jointly normal daily returns from the empirical mean
 * vector and covariance of the holdings (Cholesky), aggregates by weight, and
 * reads the loss quantile. Compare with parametric (same moments, closed form)
 * and historical (no distributional assumption).
 */
export function monteCarloVar({ weights, series, n = 20000, c = 0.95 }, normals) {
  const k = series.length;
  const means = series.map((s) => mean(s));
  const L = cholesky(covarianceMatrix(series));
  const pnl = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const z = normals(k);
    let port = 0;
    for (let a = 0; a < k; a += 1) {
      let cz = 0;
      for (let b = 0; b <= a; b += 1) cz += L[a][b] * z[b];
      port += weights[a] * (means[a] + cz);
    }
    pnl[i] = port;
  }
  const s = sorted(pnl);
  return { var: -percentileSorted(s, 1 - c), es: -mean(Array.from(s.subarray(0, Math.max(1, Math.floor(n * (1 - c)))))), pnl };
}

/** GBM projection of a portfolio value; returns the percentile bands per day and terminal values. */
export function projectValue({ value, annualReturn, annualVol, days, paths }, normals) {
  if (!(paths >= 1 && days >= 1)) throw new RangeError('paths and days must be >= 1');
  const dt = 1 / 252;
  const a = (annualReturn - 0.5 * annualVol * annualVol) * dt;
  const b = annualVol * Math.sqrt(dt);
  const grid = Array.from({ length: days + 1 }, () => new Float64Array(paths));
  for (let p = 0; p < paths; p += 1) {
    let v = value;
    grid[0][p] = v;
    for (let t = 1; t <= days; t += 1) {
      v *= Math.exp(a + b * normals(1)[0]);
      grid[t][p] = v;
    }
  }
  const band = (q) => grid.map((col) => percentileSorted(Float64Array.from(col).sort(), q));
  const finals = Array.from(grid[days]);
  return { p5: band(0.05), p50: band(0.5), p95: band(0.95), finals, sample: Array.from({ length: Math.min(paths, 40) }, (_, p) => grid.map((col) => col[p])) };
}

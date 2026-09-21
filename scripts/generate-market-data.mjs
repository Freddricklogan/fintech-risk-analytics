#!/usr/bin/env node
/**
 * Regenerates data/market-data.json: 252 business days of synthetic daily closes for the 15
 * holdings in data/portfolio.csv, from a seeded correlated GBM with a one-factor sector
 * structure. Returns are derived from closes (r_t = c_t / c_{t-1} − 1) so the file is
 * internally consistent. Nothing here is market data; the page says so.
 *
 *   node scripts/generate-market-data.mjs > data/market-data.json
 */
import { readFileSync } from 'node:fs';
import { mulberry32, normalSource } from '../src/rng.js';
import { parsePortfolioCsv } from '../src/portfolio.js';

const seed = 20260301;
const uniform = mulberry32(seed);
const normal = normalSource(uniform);
const holdings = parsePortfolioCsv(readFileSync(new URL('../data/portfolio.csv', import.meta.url), 'utf8')).holdings;
const SECTOR_VOL = { Technology: 0.3, Financials: 0.24, Healthcare: 0.18, Energy: 0.28, Utilities: 0.14, 'Consumer Staples': 0.13 };
const SECTOR_DRIFT = { Technology: 0.14, Financials: 0.09, Healthcare: 0.06, Energy: 0.05, Utilities: 0.04, 'Consumer Staples': 0.05 };
const dt = 1 / 252;

// Business days ending 2026-02-27, going back 252 rows.
const days = [];
const d = new Date(Date.UTC(2026, 1, 27));
while (days.length < 252) {
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.unshift(d.toISOString().slice(0, 10));
  d.setUTCDate(d.getUTCDate() - 1);
}

const out = {};
const start = {};
for (const h of holdings) {
  // Start 252 days back at a price that lands near the CSV's current price on average.
  const mu = SECTOR_DRIFT[h.sector] ?? 0.06;
  start[h.symbol] = h.current_price / Math.exp(mu);
  out[h.symbol] = [];
}
const prices = { ...start };
for (let t = 0; t < days.length; t += 1) {
  const market = normal();
  const sectorShock = {};
  for (const h of holdings) {
    const mu = SECTOR_DRIFT[h.sector] ?? 0.06;
    const sigma = SECTOR_VOL[h.sector] ?? 0.2;
    sectorShock[h.sector] ??= normal();
    // Correlated shock: 55% market, 30% sector, remainder idiosyncratic (weights squared sum to 1).
    const z = 0.7416 * market + 0.5477 * sectorShock[h.sector] + 0.3873 * normal();
    const prev = prices[h.symbol];
    const next = t === 0 ? prev : prev * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
    const close = Math.round(next * 100) / 100;
    const ret = t === 0 ? 0 : Math.round((close / out[h.symbol][t - 1].close - 1) * 1e6) / 1e6;
    out[h.symbol].push({ date: days[t], close, return: ret });
    prices[h.symbol] = close;
  }
}
process.stdout.write(`${JSON.stringify(out)}\n`);

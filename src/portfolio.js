/** Holdings: CSV parsing with validation, valuation and market-value weights. */

const REQUIRED = ['symbol', 'name', 'shares', 'avg_cost', 'current_price', 'sector'];

/** Minimal RFC-4180 line splitter: handles quoted fields with commas and doubled quotes. */
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Parses a holdings CSV. Rows that fail validation are reported in `warnings`
 * and dropped; nothing is coerced silently. Throws when the header is wrong or
 * no row survives.
 */
export function parsePortfolioCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new Error('CSV is empty');
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`CSV is missing columns: ${missing.join(', ')}`);
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const holdings = [];
  const warnings = [];
  const seen = new Set();
  lines.slice(1).forEach((line, n) => {
    const f = splitCsvLine(line);
    const row = n + 2;
    const symbol = (f[idx.symbol] ?? '').toUpperCase();
    const shares = Number(f[idx.shares]);
    const avgCost = Number(f[idx.avg_cost]);
    const price = Number(f[idx.current_price]);
    if (!/^[A-Z.-]{1,10}$/.test(symbol)) return warnings.push(`row ${row}: bad symbol "${f[idx.symbol] ?? ''}"`);
    if (seen.has(symbol)) return warnings.push(`row ${row}: duplicate symbol ${symbol}`);
    if (!(shares > 0)) return warnings.push(`row ${row}: shares must be positive`);
    if (!(avgCost >= 0)) return warnings.push(`row ${row}: avg_cost must be >= 0`);
    if (!(price > 0)) return warnings.push(`row ${row}: current_price must be positive`);
    seen.add(symbol);
    holdings.push({ symbol, name: f[idx.name] || symbol, shares, avg_cost: avgCost, current_price: price, sector: f[idx.sector] || 'Unclassified' });
    return undefined;
  });
  if (holdings.length === 0) throw new Error('no valid holdings rows');
  return { holdings, warnings };
}

export function valueHoldings(holdings) {
  const rows = holdings.map((h) => {
    const value = h.shares * h.current_price;
    const cost = h.shares * h.avg_cost;
    return { ...h, value, cost, pnl: value - cost, returnPct: cost > 0 ? value / cost - 1 : NaN };
  });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  return {
    rows: rows.map((r) => ({ ...r, weight: r.value / totalValue })),
    totalValue,
    totalCost,
    pnl: totalValue - totalCost,
    returnPct: totalCost > 0 ? totalValue / totalCost - 1 : NaN
  };
}

export function sectorAllocation(valued) {
  const by = new Map();
  for (const r of valued.rows) by.set(r.sector, (by.get(r.sector) ?? 0) + r.value);
  return [...by.entries()].map(([sector, value]) => ({ sector, value, weight: value / valued.totalValue })).sort((a, b) => b.value - a.value);
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePortfolioCsv, sectorAllocation, splitCsvLine, valueHoldings } from '../src/portfolio.js';

const csv = readFileSync(new URL('../data/portfolio.csv', import.meta.url), 'utf8');

describe('splitCsvLine', () => {
  it('handles quotes, embedded commas and doubled quotes', () => {
    expect(splitCsvLine('A,"Smith, John","say ""hi""",3')).toEqual(['A', 'Smith, John', 'say "hi"', '3']);
  });
});

describe('parsePortfolioCsv', () => {
  it('parses the shipped portfolio: 15 holdings, no warnings', () => {
    const { holdings, warnings } = parsePortfolioCsv(csv);
    expect(holdings).toHaveLength(15);
    expect(warnings).toEqual([]);
    expect(holdings[0]).toMatchObject({ symbol: 'AAPL', shares: 150, avg_cost: 142.5, current_price: 178.25, sector: 'Technology' });
  });
  it('drops bad rows with a reason and rejects a bad header or an empty file', () => {
    const text = 'symbol,name,shares,avg_cost,current_price,sector\nAAPL,Apple,10,1,2,Tech\naapl,Dup,1,1,1,Tech\n??,Bad,1,1,1,Tech\nMSFT,Neg,-1,1,1,Tech\nGOOG,Zero,1,1,0,Tech\n';
    const { holdings, warnings } = parsePortfolioCsv(`\uFEFF${text}`);
    expect(holdings.map((h) => h.symbol)).toEqual(['AAPL']);
    expect(warnings).toEqual(['row 3: duplicate symbol AAPL', 'row 4: bad symbol "??"', 'row 5: shares must be positive', 'row 6: current_price must be positive']);
    expect(() => parsePortfolioCsv('symbol,shares\nA,1')).toThrow(/missing columns/);
    expect(() => parsePortfolioCsv('')).toThrow(/empty/);
    expect(() => parsePortfolioCsv('symbol,name,shares,avg_cost,current_price,sector\n??,x,1,1,1,T')).toThrow(/no valid/);
  });
});

describe('valueHoldings and sectorAllocation', () => {
  it('values by market price with weights that sum to 1', () => {
    const v = valueHoldings(parsePortfolioCsv(csv).holdings);
    expect(v.totalValue).toBeCloseTo(v.rows.reduce((s, r) => s + r.shares * r.current_price, 0), 6);
    expect(v.rows.reduce((s, r) => s + r.weight, 0)).toBeCloseTo(1, 12);
    expect(v.pnl).toBeCloseTo(v.totalValue - v.totalCost, 6);
    const aapl = v.rows.find((r) => r.symbol === 'AAPL');
    expect(aapl.value).toBe(150 * 178.25);
    expect(aapl.pnl).toBeCloseTo(150 * (178.25 - 142.5), 6);
    const alloc = sectorAllocation(v);
    expect(alloc[0].sector).toBe('Technology');
    expect(alloc.reduce((s, a) => s + a.weight, 0)).toBeCloseTo(1, 12);
  });
});

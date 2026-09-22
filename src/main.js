/** Wires holdings, risk, projection and options to the page and the Executive Shell. */
import { loadChartLib, makeCharts } from './charts.js';
import { mountExecShell, tokens } from './exec-shell.js';
import { blackScholes, breakEven, payoffCurve } from './options.js';
import { parsePortfolioCsv, sectorAllocation, valueHoldings } from './portfolio.js';
import { makeSampler } from './rng.js';
import { expectedShortfall, growthSeries, historicalVar, maxDrawdown, monteCarloVar, parametricVar, portfolioReturns, projectValue, returnsFromCloses, sharpeRatio } from './risk.js';
import { histogram, mean, percentileSorted, sorted, std } from './stats.js';
import { $, fillTable, fixed, initTabs, int, money, num, pct, setText } from './ui.js';

const state = { holdings: [], valued: null, market: {}, risk: null, mc: null, option: null, optionType: 'call', source: 'shipped CSV' };
let charts = makeCharts(null);
let shell;

// --- Portfolio ------------------------------------------------------------------
function renderPortfolio() {
  const v = valueHoldings(state.holdings);
  state.valued = v;
  setText('portfolio-value', money(v.totalValue));
  setText('portfolio-cost', money(v.totalCost));
  setText('portfolio-pnl', money(v.pnl), v.pnl >= 0 ? 'is-gain' : 'is-loss');
  setText('portfolio-return', pct(v.returnPct), v.returnPct >= 0 ? 'is-gain' : 'is-loss');
  setText('holdings-count', `${v.rows.length} holdings · ${state.source}`);
  fillTable($('holdings-tbody'), v.rows, [
    (r) => r.symbol,
    (r) => r.name,
    (r) => r.shares.toLocaleString(),
    (r) => money(r.avg_cost, 2),
    (r) => money(r.current_price, 2),
    (r) => pct(r.weight, 1),
    (r) => ({ text: money(r.pnl), className: r.pnl >= 0 ? 'is-gain' : 'is-loss' })
  ]);
  const alloc = sectorAllocation(v);
  charts.donut($('allocation-chart'), alloc.map((a) => a.sector), alloc.map((a) => Math.round(a.value)));
}

// --- Risk --------------------------------------------------------------------------
function returnsBySymbol() {
  const out = {};
  for (const [sym, rows] of Object.entries(state.market)) out[sym] = returnsFromCloses(rows.map((d) => d.close));
  return out;
}
function renderRisk() {
  const rb = returnsBySymbol();
  const weights = Object.fromEntries(state.valued.rows.map((r) => [r.symbol, r.weight]));
  let port;
  try {
    port = portfolioReturns(weights, rb);
  } catch (err) {
    setText('risk-note', err.message);
    return;
  }
  const rets = port.returns;
  const covered = state.valued.rows.filter((r) => rb[r.symbol]);
  const series = covered.map((r) => rb[r.symbol]);
  const w = covered.map((r) => r.weight / port.coveredWeight);
  const mc = monteCarloVar({ weights: w, series, n: 20000, c: 0.95 }, makeSampler({ seed: 42, dim: 1 }).normals);
  const value = state.valued.totalValue;
  const risk = {
    varParam: parametricVar(rets, 0.95),
    varHist: historicalVar(rets, 0.95),
    varMc: mc.var,
    es: expectedShortfall(rets, 0.95),
    esMc: mc.es,
    sharpe: sharpeRatio(rets, num('rf') / 100),
    dd: maxDrawdown(growthSeries(rets, 100)),
    days: rets.length,
    missing: port.missing,
    annVol: std(rets) * Math.sqrt(252),
    annRet: mean(rets) * 252
  };
  state.risk = risk;
  setText('var-param', `${pct(risk.varParam)} · ${money(risk.varParam * value)}`);
  setText('var-hist', `${pct(risk.varHist)} · ${money(risk.varHist * value)}`);
  setText('var-mc', `${pct(risk.varMc)} · ${money(risk.varMc * value)}`);
  setText('cvar', `${pct(risk.es)} hist · ${pct(risk.esMc)} MC`);
  setText('sharpe', fixed(risk.sharpe, 2));
  setText('maxdd', pct(risk.dd.maxDrawdown));
  setText('ann-stats', `annualised return ${pct(risk.annRet, 1)} · volatility ${pct(risk.annVol, 1)} · ${risk.days} daily returns`);
  setText('risk-note', risk.missing.length ? `No return history for ${risk.missing.join(', ')}; weights renormalised over the ${pct(port.coveredWeight, 0)} of value with history.` : 'All holdings have a return history in the shipped synthetic dataset.');
  const dates = state.market[covered[0].symbol].slice(1).map((d) => d.date);
  charts.line($('drawdown-chart'), dates, [{ label: 'Drawdown', data: risk.dd.series.slice(1).map((d) => -d * 100), colour: tokens().danger, fill: true }], '', 'Drawdown from peak (%)');
  charts.scatter($('risk-return-chart'), covered.map((r) => ({ symbol: r.symbol, risk: std(rb[r.symbol]) * Math.sqrt(252) * 100, ret: mean(rb[r.symbol]) * 252 * 100 })));
  const pnlSorted = sorted(mc.pnl);
  charts.histogram($('var-chart'), histogram(Array.from(pnlSorted).map((x) => x * 100), 50), 'Simulated daily portfolio return (%)', tokens().danger);
  setText('var-chart-note', `Monte Carlo daily returns from the empirical mean and covariance (20,000 draws, seed 42); 5th percentile ${pct(percentileSorted(pnlSorted, 0.05))}.`);
  shell?.refreshKpis();
}

// --- Monte Carlo projection ----------------------------------------------------
function runProjection() {
  const params = { value: state.valued.totalValue, annualReturn: num('mc-return') / 100, annualVol: num('mc-vol') / 100, days: int('mc-days'), paths: int('mc-num-sims') };
  try {
    const r = projectValue(params, makeSampler({ seed: int('mc-seed') }).normals);
    state.mc = { r, params };
    const labels = Array.from({ length: params.days + 1 }, (_, i) => i);
    charts.line($('mc-paths-chart'), labels, [
      ...r.sample.slice(0, 25).map((p, i) => ({ label: `path ${i + 1}`, data: p, colour: `hsla(${(i * 360) / 25}, 70%, 65%, .35)`, width: 1 })),
      { label: '5th percentile', data: r.p5, colour: tokens().danger, dash: [6, 4] },
      { label: 'Median', data: r.p50, colour: tokens().text },
      { label: '95th percentile', data: r.p95, colour: tokens().ok, dash: [6, 4] }
    ], 'Trading day', 'Portfolio value ($)');
    charts.histogram($('mc-dist-chart'), histogram(r.finals, 40), 'Terminal value ($)', tokens().ok);
    const s = sorted(r.finals);
    setText('mc-mean', money(mean(r.finals)));
    setText('mc-median', money(percentileSorted(s, 0.5)));
    setText('mc-p5', money(percentileSorted(s, 0.05)), 'is-loss');
    setText('mc-p95', money(percentileSorted(s, 0.95)), 'is-gain');
    const closedMean = params.value * Math.exp(params.annualReturn * (params.days / 252));
    setText('mc-note', `${params.paths.toLocaleString()} paths · closed-form expected value ${money(closedMean)} · seed ${int('mc-seed')}`);
  } catch (err) {
    setText('mc-note', err.message);
  }
  shell?.refreshKpis();
}

// --- Options -------------------------------------------------------------------------
function calculateOption() {
  const params = { S: num('bs-spot'), K: num('bs-strike'), T: num('bs-time'), r: num('bs-rate') / 100, sigma: num('bs-vol') / 100 };
  try {
    const bs = blackScholes(params);
    const side = bs[state.optionType];
    state.option = { bs, params };
    const intrinsic = state.optionType === 'call' ? Math.max(params.S - params.K, 0) : Math.max(params.K - params.S, 0);
    setText('bs-price', money(side.price, 4));
    setText('bs-intrinsic', money(intrinsic, 4));
    setText('bs-time-value', money(side.price - intrinsic, 4));
    setText('bs-other', `${state.optionType === 'call' ? 'put' : 'call'} ${money(bs[state.optionType === 'call' ? 'put' : 'call'].price, 4)} · parity C − P = ${fixed(bs.call.price - bs.put.price, 4)} = S − Ke⁻ʳᵀ ${fixed(params.S - params.K * Math.exp(-params.r * params.T), 4)}`);
    setText('greek-delta', fixed(side.delta));
    setText('greek-gamma', fixed(side.gamma));
    setText('greek-theta', fixed(side.theta));
    setText('greek-vega', fixed(side.vega));
    setText('greek-rho', fixed(side.rho));
    setText('bs-breakeven', money(breakEven(state.optionType, params.K, side.price), 2));
    const curve = payoffCurve(state.optionType, params.K, side.price, [params.S * 0.7, params.S * 1.3]);
    charts.line($('payoff-chart'), curve.map((p) => p.spot.toFixed(0)), [{ label: 'P&L at expiry', data: curve.map((p) => p.pnl), colour: tokens().accent, fill: true }], 'Spot at expiry', 'P&L per share');
    setText('bs-note', '');
  } catch (err) {
    setText('bs-note', err.message);
  }
  shell?.refreshKpis();
}
function setOptionType(type) {
  state.optionType = type;
  $('btn-call').classList.toggle('active', type === 'call');
  $('btn-put').classList.toggle('active', type === 'put');
  $('btn-call').setAttribute('aria-pressed', String(type === 'call'));
  $('btn-put').setAttribute('aria-pressed', String(type === 'put'));
  calculateOption();
}

// --- Import ----------------------------------------------------------------------------
async function importCsv(file) {
  const text = await file.text();
  try {
    const { holdings, warnings } = parsePortfolioCsv(text);
    state.holdings = holdings;
    state.source = `${file.name} (${holdings.length} rows${warnings.length ? `, ${warnings.length} dropped` : ''})`;
    setText('import-note', warnings.length ? warnings.join(' · ') : `Imported ${holdings.length} holdings from ${file.name}.`);
    renderPortfolio();
    renderRisk();
  } catch (err) {
    setText('import-note', `Import failed: ${err.message}`);
  }
}

// --- Boot ----------------------------------------------------------------------------
async function boot() {
  const Chart = await loadChartLib();
  charts = makeCharts(Chart);
  if (!Chart) $('chart-notice').hidden = false;
  const selectTab = initTabs();
  const [csvText, market] = await Promise.all([fetch('data/portfolio.csv').then((r) => r.text()), fetch('data/market-data.json').then((r) => r.json())]);
  state.holdings = parsePortfolioCsv(csvText).holdings;
  state.market = market;
  renderPortfolio();
  renderRisk();
  calculateOption();
  $('rf').addEventListener('change', renderRisk);
  $('mc-run').addEventListener('click', runProjection);
  $('btn-call').addEventListener('click', () => setOptionType('call'));
  $('btn-put').addEventListener('click', () => setOptionType('put'));
  $('bs-calc').addEventListener('click', calculateOption);
  for (const id of ['bs-spot', 'bs-strike', 'bs-time', 'bs-rate', 'bs-vol']) $(id).addEventListener('change', calculateOption);
  $('csv-file').addEventListener('change', (e) => e.target.files[0] && importCsv(e.target.files[0]));

  shell = mountExecShell({
  theme: 'signal',
    title: 'FinTech Risk Analytics',
    tagline: 'Portfolio valuation, three Value-at-Risk methods side by side, a seeded Monte Carlo projection and Black–Scholes Greeks — on a synthetic 252-day history shipped with the repository, or your own holdings CSV.',
    repo: 'https://github.com/Freddricklogan/fintech-risk-analytics',
    pagesUrl: 'https://freddricklogan.github.io/fintech-risk-analytics/',
    badges: [{ label: 'VaR ×3', tone: 'accent' }, { label: 'Synthetic data', dot: true }, { label: 'CSV import', dot: true }],
    kpis: [
      { label: 'Portfolio value', compute: () => money(state.valued?.totalValue), tone: 'accent' },
      { label: 'Unrealised P&L', compute: () => (state.valued ? `${money(state.valued.pnl)} (${pct(state.valued.returnPct, 1)})` : '—'), tone: state.valued?.pnl >= 0 ? 'ok' : 'danger' },
      { label: 'VaR 95% hist / param / MC', compute: () => (state.risk ? `${pct(state.risk.varHist)} / ${pct(state.risk.varParam)} / ${pct(state.risk.varMc)}` : '—'), tone: 'danger' },
      { label: 'Sharpe (annualised)', compute: () => (state.risk ? fixed(state.risk.sharpe, 2) : '—') },
      { label: 'Max drawdown', compute: () => (state.risk ? pct(state.risk.dd.maxDrawdown, 1) : '—'), tone: 'warn' }
    ],
    tour: [
      { selector: '#tab-portfolio', title: 'Holdings valued by market price', body: 'Fifteen holdings from the shipped CSV; weights come from market value, not a typed column. Import your own CSV at the bottom of this tab.', action: () => selectTab('portfolio') },
      { selector: '#risk-vars', title: 'Three VaR figures, one portfolio', body: 'Historical (no distribution assumed), parametric (normal from the same moments) and Monte Carlo (jointly normal draws through a Cholesky factor). They should be close on this data; the differences are the method.', action: () => selectTab('risk') },
      { selector: '#tab-montecarlo', title: 'Project the value forward', body: 'A seeded GBM projection with 5th, 50th and 95th percentile bands and the closed-form expected value beside the simulated mean.', action: () => { selectTab('montecarlo'); runProjection(); } },
      { selector: '#tab-options', title: 'Black–Scholes with the Greeks', body: 'Price, intrinsic and time value, break-even, and five Greeks — checked in tests against finite differences. Switching to the put keeps put–call parity on screen.', action: () => { selectTab('options'); setOptionType('put'); } }
    ]
  });
  shell.refreshKpis();
}

boot();

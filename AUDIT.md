# AUDIT — FinTech Risk Analytics (pre-refactor)

Audit of the previous build: `index.html` (page script from line 176),
`js/risk-engine.js` (176 lines), `js/black-scholes.js` (71 lines),
`js/charts.js` (Plotly), `data/portfolio.csv` and `data/market-data.json`.
The engine's formulas were largely right; the findings are about the data
the numbers rested on, two statistical mistakes, and code a strict policy
could not run.

---

## A. Data

### A1 — The shipped "market data" was internally inconsistent and had weekend rows
`data/market-data.json` carried 252 rows per symbol of which 69 fell on a
Saturday or Sunday, and in 93 rows the stored `return` did not equal
`close_t / close_{t−1} − 1` (tolerance 1e-4). Every risk figure was computed
from those stored returns. **Fix:** `scripts/generate-market-data.mjs`
regenerates the file deterministically — 252 business days, a seeded
correlated GBM with a market factor and a sector factor, returns derived
from closes — and `tests/risk.test.js` asserts business days only and
return–close consistency to 1e-5. The page labels the history as synthetic.

### A2 — Two different sets of weights
The portfolio tab valued holdings by `shares × current_price`, but the risk
tab weighted returns by the CSV's typed `weight` column (`index.html:234`).
The two disagreed (Apple was 12% by the column and about 11% by value), so
VaR was computed for a portfolio that was not the one shown. **Fix:**
weights are derived from market value once in `valueHoldings()` and used
everywhere; the `weight` column is ignored.

## B. Statistics

### B1 — Only two VaR methods, and expected shortfall cut at the wrong point
Historical and parametric VaR were shown; the blueprint asked for Monte
Carlo beside them. `calculateCVaR` (`risk-engine.js:31–35`) recomputed
historical VaR internally and, when the tail was empty, returned `−varValue`
— a positive number presented as the shortfall of a loss. **Fix:**
`monteCarloVar()` draws jointly normal returns from the empirical mean and
covariance through a Cholesky factor; the three figures sit side by side
with the dollar amount; `expectedShortfall()` is tested by hand on a
ten-value series; a test requires Monte Carlo and parametric VaR to agree
within 3% on the shipped data (they should, both being normal).

### B2 — Normal CDF accurate to 1.5e-7
`black-scholes.js:8` used the Abramowitz–Stegun 7.1.26 approximation.
Adequate for prices to four decimals, but the Greeks are differences of
such values. **Fix:** Hart's double-precision Φ (West 2005); Greeks are
tested against central finite differences of the price.

### B3 — Unseeded Monte Carlo
`risk-engine.js:133` used `Math.random()`, so no figure on the page was
reproducible. **Fix:** Mulberry32 with a seed shown in the UI; the closed-
form expected terminal value is printed beside the simulated mean.

## C. Security and policy

### C1 — No CSP; inline handlers and the deprecated global `event`
`onclick="switchTab('risk')"` on line 33 and six others; `switchTab` read
`event.target` (line 190) from the deprecated global. No
`Content-Security-Policy`. **Fix:** strict CSP; all handlers attached in
`src/main.js`; tabs are `role="tab"` buttons with `aria-selected`.

### C2 — Holdings rendered with `innerHTML` from CSV fields
`index.html:196` interpolated `h.symbol` and `h.name` into HTML. With the
new CSV import that would have been a stored-XSS path from a user's own
file. **Fix:** `fillTable()` builds cells with `textContent`; the parser
validates symbols against `^[A-Z.-]{1,10}$` and reports rejected rows.

### C3 — Two unpinned CDN libraries without integrity
Plotly 2.27.0 (3.5 MB) and PapaParse 5.4.1 from jsDelivr with no SRI
(lines 9–10). **Fix:** Chart.js 3.9.1 pinned with an integrity hash
computed from the artifact and a vendored fallback; CSV parsing is a
tested 40-line RFC-4180 splitter, no dependency.

## D. Structure and accessibility

### D1 — Logic fused to the DOM; no tests
Every metric was computed inside render functions. **Fix:**
`src/{portfolio,risk,options,rng,stats}.js` are pure and covered by 22
tests; the DOM layer reads forms and writes results.

### D2 — Labels not associated with inputs; `style=` attributes
Line 116 and others. **Fix:** every input has a `for`/`id` pair; no inline
style; html-validate in CI.

### D3 — No CSV import
The blueprint asked for it. **Fix:** a file input parses a holdings CSV in
the browser (nothing uploaded), lists dropped rows, and says which symbols
have no return history in the shipped dataset instead of silently
excluding them.

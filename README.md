# FinTech Risk Analytics Platform

A browser-based financial risk analytics dashboard featuring portfolio analysis, Value at Risk calculations, Monte Carlo simulation, and Black-Scholes options pricing. No server required -- runs entirely in the browser.

## Live Demo

[View Dashboard](https://freddricklogan.github.io/fintech-risk-analytics/)

## Features

### Portfolio Overview
- Real-time portfolio valuation and P&L tracking
- Sector allocation visualization (interactive pie chart)
- Holdings table with cost basis and gain/loss

### Risk Metrics
- **Value at Risk (VaR)** -- parametric and historical simulation at 95% confidence
- **Conditional VaR (CVaR)** -- expected shortfall beyond VaR threshold
- **Sharpe Ratio** -- risk-adjusted return measurement
- **Maximum Drawdown** -- largest peak-to-trough decline
- Risk/return scatter plot comparing individual holdings

### Monte Carlo Simulation
- Configurable simulation parameters (paths, horizon, return, volatility)
- Real-time browser-based computation (up to 5,000 paths)
- Percentile bands (5th, 50th, 95th) overlaid on simulation paths
- Distribution histogram of final portfolio values

### Black-Scholes Options Pricing
- Call and put option pricing
- Full Greeks calculation (Delta, Gamma, Theta, Vega, Rho)
- Interactive payoff diagram
- Intrinsic and time value decomposition

## Tech Stack

| Technology | Purpose |
|:-----------|:--------|
| HTML5 / CSS3 | Structure and styling |
| JavaScript (ES6+) | Application logic and calculations |
| Plotly.js | Interactive chart rendering |
| PapaParse | CSV parsing for portfolio data |

## Risk Metrics Documentation

| Metric | Formula | Description |
|:-------|:--------|:------------|
| Parametric VaR | VaR = -(mu + z * sigma) | Assumes normal distribution of returns |
| Historical VaR | VaR = -Percentile(returns, 1-alpha) | Based on actual return distribution |
| CVaR | E[Loss \| Loss > VaR] | Average loss in the tail |
| Sharpe Ratio | (R_p - R_f) / sigma_p | Annualized risk-adjusted return |
| Max Drawdown | max((Peak - Trough) / Peak) | Largest percentage decline |

## Getting Started

```bash
git clone https://github.com/Freddricklogan/fintech-risk-analytics.git
cd fintech-risk-analytics
python -m http.server 8000
# Open http://localhost:8000
```

## License

MIT License

## Author

**Freddrick Logan**
- [GitHub](https://github.com/Freddricklogan)
- [LinkedIn](https://linkedin.com/in/freddricklogan)

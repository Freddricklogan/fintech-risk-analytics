/* Risk Analytics Engine */

function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function calculateVaR(returns, confidence, method) {
    if (method === 'historical') {
        return -percentile(returns, (1 - confidence) * 100);
    }
    // Parametric (normal distribution)
    const m = mean(returns);
    const s = stddev(returns);
    const z = normalInverse(1 - confidence);
    return -(m + z * s);
}

function calculateCVaR(returns, confidence) {
    const varValue = -calculateVaR(returns, confidence, 'historical');
    const tail = returns.filter(r => r <= varValue);
    return tail.length > 0 ? -mean(tail) : -varValue;
}

function calculateSharpeRatio(returns, riskFreeRate) {
    const annualizedReturn = mean(returns) * 252;
    const annualizedVol = stddev(returns) * Math.sqrt(252);
    return (annualizedReturn - riskFreeRate) / annualizedVol;
}

function calculateMaxDrawdown(prices) {
    let peak = prices[0];
    let maxDD = 0;
    const drawdowns = [];

    for (let i = 0; i < prices.length; i++) {
        if (prices[i] > peak) peak = prices[i];
        const dd = (peak - prices[i]) / peak;
        drawdowns.push(dd);
        if (dd > maxDD) maxDD = dd;
    }
    return { maxDrawdown: maxDD, series: drawdowns };
}

function calculateBeta(stockReturns, marketReturns) {
    const n = Math.min(stockReturns.length, marketReturns.length);
    const mStock = mean(stockReturns.slice(0, n));
    const mMarket = mean(marketReturns.slice(0, n));

    let cov = 0, varMarket = 0;
    for (let i = 0; i < n; i++) {
        const ds = stockReturns[i] - mStock;
        const dm = marketReturns[i] - mMarket;
        cov += ds * dm;
        varMarket += dm * dm;
    }
    return cov / varMarket;
}

function covarianceMatrix(returnsMatrix) {
    const n = returnsMatrix.length;
    const means = returnsMatrix.map(r => mean(r));
    const len = returnsMatrix[0].length;
    const matrix = [];

    for (let i = 0; i < n; i++) {
        matrix[i] = [];
        for (let j = 0; j < n; j++) {
            let cov = 0;
            for (let k = 0; k < len; k++) {
                cov += (returnsMatrix[i][k] - means[i]) * (returnsMatrix[j][k] - means[j]);
            }
            matrix[i][j] = cov / (len - 1);
        }
    }
    return matrix;
}

function correlationMatrix(returnsMatrix) {
    const covMatrix = covarianceMatrix(returnsMatrix);
    const n = covMatrix.length;
    const corr = [];
    for (let i = 0; i < n; i++) {
        corr[i] = [];
        for (let j = 0; j < n; j++) {
            corr[i][j] = covMatrix[i][j] / Math.sqrt(covMatrix[i][i] * covMatrix[j][j]);
        }
    }
    return corr;
}

function portfolioVariance(weights, covMatrix) {
    let variance = 0;
    for (let i = 0; i < weights.length; i++) {
        for (let j = 0; j < weights.length; j++) {
            variance += weights[i] * weights[j] * covMatrix[i][j];
        }
    }
    return variance;
}

function monteCarloSimulation(initialValue, expectedReturn, volatility, days, numSimulations) {
    const dt = 1 / 252;
    const paths = [];

    for (let s = 0; s < numSimulations; s++) {
        const path = [initialValue];
        for (let d = 1; d <= days; d++) {
            const z = boxMullerRandom();
            const drift = (expectedReturn - 0.5 * volatility * volatility) * dt;
            const diffusion = volatility * Math.sqrt(dt) * z;
            path.push(path[d - 1] * Math.exp(drift + diffusion));
        }
        paths.push(path);
    }
    return paths;
}

function boxMullerRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function normalInverse(p) {
    // Rational approximation for the normal quantile function
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
               1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
               6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
               -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

    const pLow = 0.02425, pHigh = 1 - pLow;
    let q, r;

    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
               ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    } else if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
               (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
                ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
}

window.RiskEngine = {
    mean, stddev, percentile, calculateVaR, calculateCVaR,
    calculateSharpeRatio, calculateMaxDrawdown, calculateBeta,
    covarianceMatrix, correlationMatrix, portfolioVariance,
    monteCarloSimulation, normalInverse
};

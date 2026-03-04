/* Black-Scholes Options Pricing Model */

function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function normalCDF(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
}

function d1(S, K, T, r, sigma) {
    return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
}

function d2(S, K, T, r, sigma) {
    return d1(S, K, T, r, sigma) - sigma * Math.sqrt(T);
}

function blackScholesCall(S, K, T, r, sigma) {
    if (T <= 0) return Math.max(S - K, 0);
    const D1 = d1(S, K, T, r, sigma);
    const D2 = d2(S, K, T, r, sigma);
    return S * normalCDF(D1) - K * Math.exp(-r * T) * normalCDF(D2);
}

function blackScholesPut(S, K, T, r, sigma) {
    if (T <= 0) return Math.max(K - S, 0);
    const D1 = d1(S, K, T, r, sigma);
    const D2 = d2(S, K, T, r, sigma);
    return K * Math.exp(-r * T) * normalCDF(-D2) - S * normalCDF(-D1);
}

function calculateGreeks(S, K, T, r, sigma) {
    if (T <= 0) {
        return {
            call: { delta: S > K ? 1 : 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
            put: { delta: S > K ? 0 : -1, gamma: 0, theta: 0, vega: 0, rho: 0 }
        };
    }

    const D1 = d1(S, K, T, r, sigma);
    const D2 = d2(S, K, T, r, sigma);
    const sqrtT = Math.sqrt(T);
    const pdf_d1 = normalPDF(D1);
    const expRT = Math.exp(-r * T);

    const gamma = pdf_d1 / (S * sigma * sqrtT);
    const vega = S * pdf_d1 * sqrtT / 100; // per 1% change

    const callDelta = normalCDF(D1);
    const putDelta = callDelta - 1;

    const callTheta = (-(S * pdf_d1 * sigma) / (2 * sqrtT) - r * K * expRT * normalCDF(D2)) / 365;
    const putTheta = (-(S * pdf_d1 * sigma) / (2 * sqrtT) + r * K * expRT * normalCDF(-D2)) / 365;

    const callRho = K * T * expRT * normalCDF(D2) / 100;
    const putRho = -K * T * expRT * normalCDF(-D2) / 100;

    return {
        call: { delta: callDelta, gamma, theta: callTheta, vega, rho: callRho },
        put: { delta: putDelta, gamma, theta: putTheta, vega, rho: putRho }
    };
}

window.BlackScholes = { blackScholesCall, blackScholesPut, calculateGreeks, normalCDF, normalPDF };

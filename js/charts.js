/* Chart Rendering with Plotly.js */

const darkLayout = {
    paper_bgcolor: 'rgba(0, 19, 39,0)',
    plot_bgcolor: 'rgba(0, 19, 39,0)',
    font: { color: '#adc4e0', family: 'Segoe UI, sans-serif' },
    margin: { t: 30, r: 20, b: 40, l: 50 },
    xaxis: { gridcolor: '#001327', zerolinecolor: '#001327' },
    yaxis: { gridcolor: '#001327', zerolinecolor: '#001327' }
};

function renderAllocationChart(portfolioData) {
    const sectors = {};
    portfolioData.forEach(h => {
        sectors[h.sector] = (sectors[h.sector] || 0) + h.current_price * h.shares;
    });

    Plotly.newPlot('allocation-chart', [{
        values: Object.values(sectors),
        labels: Object.keys(sectors),
        type: 'pie',
        hole: 0.5,
        marker: { colors: ['#35b56a','#35b56a','#c9a44e','#35b56a','#e0705f','#c9a44e','#35b56a','#e0705f'] },
        textinfo: 'label+percent',
        textfont: { size: 11, color: '#f4f3ef' }
    }], {
        ...darkLayout,
        showlegend: false,
        margin: { t: 10, r: 10, b: 10, l: 10 },
        height: 320
    }, { responsive: true });
}

function renderRiskReturnScatter(portfolioData, marketData) {
    const points = portfolioData.map(h => {
        const data = marketData[h.symbol];
        if (!data) return null;
        const returns = data.map(d => d.return);
        const annReturn = RiskEngine.mean(returns) * 252 * 100;
        const annVol = RiskEngine.stddev(returns) * Math.sqrt(252) * 100;
        return { symbol: h.symbol, return: annReturn, risk: annVol };
    }).filter(Boolean);

    Plotly.newPlot('risk-return-chart', [{
        x: points.map(p => p.risk),
        y: points.map(p => p.return),
        text: points.map(p => p.symbol),
        mode: 'markers+text',
        type: 'scatter',
        marker: { size: 12, color: '#35b56a', opacity: 0.8 },
        textposition: 'top center',
        textfont: { size: 10, color: '#adc4e0' }
    }], {
        ...darkLayout,
        xaxis: { ...darkLayout.xaxis, title: { text: 'Annualized Volatility (%)', font: { size: 12 } } },
        yaxis: { ...darkLayout.yaxis, title: { text: 'Annualized Return (%)', font: { size: 12 } } },
        height: 360
    }, { responsive: true });
}

function renderMonteCarloChart(simulations, days) {
    const traces = [];
    const nDisplay = Math.min(simulations.length, 200);
    const xVals = Array.from({ length: days + 1 }, (_, i) => i);

    for (let i = 0; i < nDisplay; i++) {
        traces.push({
            x: xVals, y: simulations[i], type: 'scatter', mode: 'lines',
            line: { width: 0.5, color: 'rgba(53, 181, 106,0.15)' },
            showlegend: false, hoverinfo: 'skip'
        });
    }

    // Percentile bands
    const p5 = [], p50 = [], p95 = [];
    for (let d = 0; d <= days; d++) {
        const vals = simulations.map(s => s[d]);
        p5.push(RiskEngine.percentile(vals, 5));
        p50.push(RiskEngine.percentile(vals, 50));
        p95.push(RiskEngine.percentile(vals, 95));
    }

    traces.push({ x: xVals, y: p5, type: 'scatter', mode: 'lines', name: '5th %ile', line: { color: '#e0705f', width: 2 } });
    traces.push({ x: xVals, y: p50, type: 'scatter', mode: 'lines', name: 'Median', line: { color: '#35b56a', width: 2 } });
    traces.push({ x: xVals, y: p95, type: 'scatter', mode: 'lines', name: '95th %ile', line: { color: '#35b56a', width: 2 } });

    Plotly.newPlot('mc-paths-chart', traces, {
        ...darkLayout,
        xaxis: { ...darkLayout.xaxis, title: { text: 'Trading Days', font: { size: 12 } } },
        yaxis: { ...darkLayout.yaxis, title: { text: 'Portfolio Value ($)', font: { size: 12 } }, tickformat: ',.0f' },
        height: 400
    }, { responsive: true });
}

function renderMonteCarloDistribution(finalValues) {
    Plotly.newPlot('mc-dist-chart', [{
        x: finalValues, type: 'histogram', nbinsx: 50,
        marker: { color: 'rgba(53, 181, 106,0.6)', line: { color: '#35b56a', width: 1 } }
    }], {
        ...darkLayout,
        xaxis: { ...darkLayout.xaxis, title: { text: 'Final Portfolio Value ($)', font: { size: 12 } }, tickformat: ',.0f' },
        yaxis: { ...darkLayout.yaxis, title: { text: 'Frequency', font: { size: 12 } } },
        height: 300
    }, { responsive: true });
}

function renderDrawdownChart(drawdownSeries) {
    Plotly.newPlot('drawdown-chart', [{
        y: drawdownSeries.map(d => -d * 100),
        type: 'scatter', mode: 'lines',
        fill: 'tozeroy',
        fillcolor: 'rgba(224, 112, 95,0.15)',
        line: { color: '#e0705f', width: 1.5 }
    }], {
        ...darkLayout,
        xaxis: { ...darkLayout.xaxis, title: { text: 'Trading Days', font: { size: 12 } } },
        yaxis: { ...darkLayout.yaxis, title: { text: 'Drawdown (%)', font: { size: 12 } } },
        height: 300
    }, { responsive: true });
}

function renderPayoffDiagram(optionType, strike, premium, spotRange) {
    const spots = [];
    const payoffs = [];
    const low = spotRange[0], high = spotRange[1];
    for (let s = low; s <= high; s += (high - low) / 200) {
        spots.push(s);
        if (optionType === 'call') {
            payoffs.push(Math.max(s - strike, 0) - premium);
        } else {
            payoffs.push(Math.max(strike - s, 0) - premium);
        }
    }

    Plotly.newPlot('payoff-chart', [
        { x: spots, y: payoffs, type: 'scatter', mode: 'lines', name: 'P&L', line: { color: '#35b56a', width: 2 } },
        { x: [low, high], y: [0, 0], type: 'scatter', mode: 'lines', name: 'Break-even', line: { color: '#adc4e0', width: 1, dash: 'dash' }, showlegend: false }
    ], {
        ...darkLayout,
        xaxis: { ...darkLayout.xaxis, title: { text: 'Spot Price ($)', font: { size: 12 } } },
        yaxis: { ...darkLayout.yaxis, title: { text: 'Profit / Loss ($)', font: { size: 12 } } },
        height: 300
    }, { responsive: true });
}

window.Charts = { renderAllocationChart, renderRiskReturnScatter, renderMonteCarloChart, renderMonteCarloDistribution, renderDrawdownChart, renderPayoffDiagram };

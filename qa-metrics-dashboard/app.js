/* ============================================================
   QA Executive Metrics Dashboard — POS Retail
   Main Application Logic
   ============================================================ */

// ───── Industry Benchmarks ─────
const BENCHMARKS = {
    defectDensityLow: 2,
    defectDensityHigh: 5,
    testExecEfficiency: 90,
    sayDoRatio: 90,
    defectLeakage: 5
};

// ───── Default Sample Data ─────
const DEFAULT_DATA = {
    sprints: ['6.02', '6.03', '6.04', '6.05'],
    months: ['Feb', 'Mar'],
    sprintToMonth: { '6.02': 'Feb', '6.03': 'Feb', '6.04': 'Mar', '6.05': 'Mar' },
    defectDensity: { '6.02': 5.56, '6.03': 6.23, '6.04': 6.58, '6.05': 13.18 },
    defectDensityTotal: { Feb: 5.92, Mar: 9.98 },
    defectsCreated: { '6.02': 12, '6.03': 16, '6.04': 16, '6.05': 34 },
    defectsTotal: { Feb: 28, Mar: 50 },
    tcsCreated: { '6.02': 84, '6.03': 126, '6.04': 111, '6.05': 108 },
    tcsCreatedTotal: { Feb: 210, Mar: 219 },
    tcsExecuted: { '6.02': 216, '6.03': 257, '6.04': 243, '6.05': 258 },
    tcsExecutedTotal: { Feb: 473, Mar: 501 },
    sayDoCommitted: { '6.02': 43, '6.03': 62, '6.04': 46, '6.05': 60 },
    sayDoTotal: { Feb: 105, Mar: 106 },
    releaseVersions: { '6.02': 'v.6.02.02', '6.03': 'v.6.03.04', '6.04': 'v.6.04.01', '6.05': 'v.6.05.04' },
    releaseDates: { '6.02': '17-Feb', '6.03': '25-Feb', '6.04': '9-Mar', '6.05': '31-Mar' }
};

// ───── State ─────
let currentData = DEFAULT_DATA;
let chartInstances = {};

// ───── Initialize ─────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('genDate').textContent = new Date().toLocaleDateString();
    initThemeToggle();
    initFileUpload();
    renderDashboard(currentData);
});

// ───── Theme Toggle ─────
function initThemeToggle() {
    const btn = document.getElementById('themeToggle');
    const icon = document.getElementById('themeIcon');
    const saved = localStorage.getItem('qa-dash-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    icon.className = saved === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';

    btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('qa-dash-theme', next);
        icon.className = next === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
        renderDashboard(currentData);
    });
}

// ───── Excel File Upload ─────
function initFileUpload() {
    document.getElementById('excelUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
                const parsed = parseExcelData(json);
                if (parsed) {
                    currentData = parsed;
                    renderDashboard(currentData);
                }
            } catch (err) {
                alert('Error parsing Excel file: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function parseExcelData(rows) {
    if (rows.length < 3) return null;

    const header = rows[0] || [];
    const subHeader = rows[1] || [];

    const sprints = [];
    const months = [];
    const sprintToMonth = {};
    const colMap = [];

    for (let c = 3; c < header.length; c++) {
        const monthName = header[c] ? String(header[c]).trim() : '';
        const sub = subHeader[c] ? String(subHeader[c]).trim() : '';

        if (sub.toLowerCase() === 'total') {
            colMap.push({ type: 'total', month: monthName || colMap[colMap.length - 1]?.month });
        } else if (sub) {
            const sprintId = sub;
            const month = monthName || (months.length > 0 ? months[months.length - 1] : '');
            if (!sprints.includes(sprintId)) sprints.push(sprintId);
            if (month && !months.includes(month)) months.push(month);
            sprintToMonth[sprintId] = month;
            colMap.push({ type: 'sprint', sprint: sprintId, month });
        } else {
            colMap.push({ type: 'unknown' });
        }
    }

    const data = {
        sprints, months, sprintToMonth,
        defectDensity: {}, defectDensityTotal: {},
        defectsCreated: {}, defectsTotal: {},
        tcsCreated: {}, tcsCreatedTotal: {},
        tcsExecuted: {}, tcsExecutedTotal: {},
        sayDoCommitted: {}, sayDoTotal: {},
        releaseVersions: {}, releaseDates: {}
    };

    for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[1]) continue;
        const metric = String(row[1]).trim().toLowerCase();

        for (let c = 3; c < row.length && (c - 3) < colMap.length; c++) {
            const cm = colMap[c - 3];
            const val = row[c];

            if (metric.includes('defect density')) {
                const num = parseFloat(String(val).replace('%', ''));
                if (!isNaN(num)) {
                    if (cm.type === 'sprint') data.defectDensity[cm.sprint] = num;
                    else if (cm.type === 'total') data.defectDensityTotal[cm.month] = num;
                }
            } else if (metric.includes('defects created') || metric === 'defects created') {
                const num = parseFloat(val);
                if (!isNaN(num)) {
                    if (cm.type === 'sprint') data.defectsCreated[cm.sprint] = num;
                    else if (cm.type === 'total') data.defectsTotal[cm.month] = num;
                }
            } else if (metric.includes('manual tcs created') || metric.includes('tc created') || metric.includes('tcs created')) {
                const num = parseFloat(val);
                if (!isNaN(num)) {
                    if (cm.type === 'sprint') data.tcsCreated[cm.sprint] = num;
                    else if (cm.type === 'total') data.tcsCreatedTotal[cm.month] = num;
                }
            } else if (metric.includes('manual tcs executed') || metric.includes('tc executed') || metric.includes('tcs executed')) {
                const num = parseFloat(val);
                if (!isNaN(num)) {
                    if (cm.type === 'sprint') data.tcsExecuted[cm.sprint] = num;
                    else if (cm.type === 'total') data.tcsExecutedTotal[cm.month] = num;
                }
            } else if (metric.includes('say do') || metric.includes('say-do') || metric.includes('committed')) {
                const num = parseFloat(val);
                if (!isNaN(num)) {
                    if (cm.type === 'sprint') data.sayDoCommitted[cm.sprint] = num;
                    else if (cm.type === 'total') data.sayDoTotal[cm.month] = num;
                }
            } else if (metric.includes('release version') || metric.includes('version')) {
                if (val && cm.type === 'sprint') data.releaseVersions[cm.sprint] = String(val);
            } else if (metric.includes('release date') || metric.includes('date')) {
                if (val && cm.type === 'sprint') data.releaseDates[cm.sprint] = String(val);
            }
        }
    }

    return data;
}

// ───── Render Full Dashboard ─────
function renderDashboard(data) {
    destroyAllCharts();
    renderExecutiveSummary(data);
    renderDefectDensityChart(data);
    renderDefectsCreatedChart(data);
    renderTestExecChart(data);
    renderMonthlyCompChart(data);
    renderSayDoChart(data);
    renderTimelineChart(data);
    renderReleaseTable(data);
}

function destroyAllCharts() {
    Object.values(chartInstances).forEach(c => { if (c) c.destroy(); });
    chartInstances = {};
}

function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        text: isDark ? '#c0c2cc' : '#495057',
        tooltipBg: isDark ? '#2a2d3a' : '#ffffff',
        tooltipText: isDark ? '#e4e6eb' : '#212529',
        tooltipBorder: isDark ? '#3a3d4d' : '#dee2e6'
    };
}

function commonScaleOpts(tc) {
    return {
        grid: { color: tc.grid },
        ticks: { color: tc.text, font: { size: 11 } },
        title: { color: tc.text, font: { size: 12 } }
    };
}

function tooltipOpts(tc) {
    return {
        backgroundColor: tc.tooltipBg,
        titleColor: tc.tooltipText,
        bodyColor: tc.tooltipText,
        borderColor: tc.tooltipBorder,
        borderWidth: 1,
        cornerRadius: 6,
        padding: 10
    };
}

// ───── Executive Summary ─────
function renderExecutiveSummary(data) {
    const totalDefectsFeb = data.defectsTotal.Feb || 0;
    const totalDefectsMar = data.defectsTotal.Mar || 0;
    const totalDefects = totalDefectsFeb + totalDefectsMar;
    const defectChange = totalDefectsFeb > 0 ? ((totalDefectsMar - totalDefectsFeb) / totalDefectsFeb * 100) : 0;

    const avgDD = Object.values(data.defectDensity).reduce((a, b) => a + b, 0) / Math.max(Object.values(data.defectDensity).length, 1);
    const ddFeb = data.defectDensityTotal.Feb || 0;
    const ddMar = data.defectDensityTotal.Mar || 0;
    const ddChange = ddFeb > 0 ? ((ddMar - ddFeb) / ddFeb * 100) : 0;

    const totalExecFeb = data.tcsExecutedTotal.Feb || 0;
    const totalExecMar = data.tcsExecutedTotal.Mar || 0;
    const totalExec = totalExecFeb + totalExecMar;
    const execChange = totalExecFeb > 0 ? ((totalExecMar - totalExecFeb) / totalExecFeb * 100) : 0;

    // Say Do: the values represent committed items that were delivered
    // Committed ≈ Delivered, so ratio ≈ 100%
    const sdFebCommitted = data.sayDoTotal.Feb || 0;
    const sdMarCommitted = data.sayDoTotal.Mar || 0;
    const sdFebDelivered = sdFebCommitted; // all committed items were delivered
    const sdMarDelivered = sdMarCommitted;
    const sayDoRatioFeb = sdFebCommitted > 0 ? (sdFebDelivered / sdFebCommitted * 100) : 0;
    const sayDoRatioMar = sdMarCommitted > 0 ? (sdMarDelivered / sdMarCommitted * 100) : 0;

    const totalCreatedFeb = data.tcsCreatedTotal.Feb || 0;
    const totalCreatedMar = data.tcsCreatedTotal.Mar || 0;
    const overallExecEff = (totalCreatedFeb + totalCreatedMar) > 0
        ? (totalExec / (totalCreatedFeb + totalCreatedMar) * 100) : 0;

    document.getElementById('kpiTotalDefects').textContent = totalDefects;
    setTrendEl('kpiTotalDefectsTrend', defectChange, true);

    document.getElementById('kpiAvgDD').textContent = avgDD.toFixed(2) + '%';
    setTrendEl('kpiAvgDDTrend', ddChange, true);

    document.getElementById('kpiTotalTCExec').textContent = totalExec.toLocaleString();
    setTrendEl('kpiTotalTCExecTrend', execChange, false);

    const avgSayDo = (sayDoRatioFeb + sayDoRatioMar) / 2;
    document.getElementById('kpiSayDoRatio').textContent = avgSayDo.toFixed(0) + '%';
    const sdChange = sayDoRatioFeb > 0 ? ((sayDoRatioMar - sayDoRatioFeb) / sayDoRatioFeb * 100) : 0;
    setTrendEl('kpiSayDoRatioTrend', sdChange, false, true);

    const ragDD = ddMar <= BENCHMARKS.defectDensityHigh ? (ddMar <= BENCHMARKS.defectDensityLow ? 'green' : 'amber') : 'red';
    const ragExec = overallExecEff >= BENCHMARKS.testExecEfficiency ? 'green' : (overallExecEff >= 80 ? 'amber' : 'red');
    const ragSD = avgSayDo >= BENCHMARKS.sayDoRatio ? 'green' : (avgSayDo >= 80 ? 'amber' : 'red');
    const ragDefects = defectChange <= 0 ? 'green' : (defectChange <= 30 ? 'amber' : 'red');

    const ragValues = { green: 3, amber: 2, red: 1 };
    const weights = [0.3, 0.25, 0.25, 0.2];
    const scores = [ragValues[ragDD], ragValues[ragExec], ragValues[ragSD], ragValues[ragDefects]];
    const healthScore = scores.reduce((s, v, i) => s + v * weights[i], 0);
    const healthPct = ((healthScore - 1) / 2 * 100).toFixed(0);

    const circle = document.getElementById('healthScoreCircle');
    const badge = document.getElementById('healthScoreBadge');
    const card = document.getElementById('healthScoreCard');
    document.getElementById('healthScoreValue').textContent = healthPct + '%';

    const healthRAG = healthScore >= 2.5 ? 'green' : (healthScore >= 1.8 ? 'amber' : 'red');
    circle.className = 'health-score-circle mx-auto ' + healthRAG;
    badge.className = 'badge mt-2 bg-' + (healthRAG === 'green' ? 'success' : healthRAG === 'amber' ? 'warning' : 'danger');
    badge.textContent = healthRAG === 'green' ? 'Healthy' : healthRAG === 'amber' ? 'Needs Attention' : 'At Risk';
    card.style.borderColor = healthRAG === 'green' ? 'var(--rag-green)' : healthRAG === 'amber' ? 'var(--rag-amber)' : 'var(--rag-red)';
}

function setTrendEl(elId, change, higherIsBad, higherIsGood) {
    const el = document.getElementById(elId);
    if (!el) return;
    const abs = Math.abs(change).toFixed(1);
    if (Math.abs(change) < 0.5) {
        el.className = 'kpi-trend neutral';
        el.innerHTML = '&#8212; No change';
        return;
    }
    const up = change > 0;
    if (higherIsBad) {
        el.className = 'kpi-trend ' + (up ? 'up' : 'down');
    } else if (higherIsGood) {
        el.className = 'kpi-trend ' + (up ? 'good-up' : 'up');
    } else {
        el.className = 'kpi-trend ' + (up ? 'good-up' : 'up');
    }
    el.innerHTML = (up ? '<i class="bi bi-arrow-up-short"></i>' : '<i class="bi bi-arrow-down-short"></i>') + abs + '% MoM';
}

// ───── Chart 1: Defect Density Trend ─────
function renderDefectDensityChart(data) {
    const tc = getThemeColors();
    const ctx = document.getElementById('chartDefectDensity').getContext('2d');
    const labels = data.sprints;
    const values = labels.map(s => data.defectDensity[s] || 0);

    const pointColors = values.map(v => v <= 5 ? '#22c55e' : v <= 8 ? '#f59e0b' : '#ef4444');
    const segmentColors = (ctx2) => {
        const v = ctx2.p1.parsed.y;
        return v <= 5 ? '#22c55e' : v <= 8 ? '#f59e0b' : '#ef4444';
    };

    chartInstances.dd = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Defect Density (%)',
                data: values,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                pointRadius: 6,
                pointHoverRadius: 8,
                segment: { borderColor: segmentColors }
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { ...tooltipOpts(tc), callbacks: { label: ctx2 => 'Defect Density: ' + ctx2.parsed.y.toFixed(2) + '%' } },
                annotation: {
                    annotations: {
                        benchmarkLine: {
                            type: 'line', yMin: 5, yMax: 5,
                            borderColor: '#ef4444', borderWidth: 2, borderDash: [6, 4],
                            label: {
                                content: 'POS Retail Benchmark (5%)', display: true,
                                position: 'start', backgroundColor: 'rgba(239,68,68,0.85)',
                                color: '#fff', font: { size: 10 }, padding: 4
                            }
                        }
                    }
                },
                datalabels: {
                    color: tc.text, anchor: 'top', align: 'top', offset: 4,
                    font: { size: 11, weight: 'bold' },
                    formatter: v => v.toFixed(2) + '%'
                }
            },
            scales: {
                x: { ...commonScaleOpts(tc), title: { display: true, text: 'Sprint' } },
                y: { ...commonScaleOpts(tc), title: { display: true, text: 'Defect Density (%)' }, beginAtZero: true, suggestedMax: 16 }
            }
        },
        plugins: [ChartDataLabels]
    });

    const latest = values[values.length - 1];
    const prev = values.length > 1 ? values[values.length - 2] : latest;
    const pctChange = prev > 0 ? ((latest - prev) / prev * 100).toFixed(1) : 0;
    const rag = latest <= BENCHMARKS.defectDensityHigh ? (latest <= BENCHMARKS.defectDensityLow ? 'green' : 'amber') : 'red';
    setRAG('ragDD', rag);

    const ddFeb = data.defectDensityTotal.Feb || 0;
    const ddMar = data.defectDensityTotal.Mar || 0;
    const momChange = ddFeb > 0 ? ((ddMar - ddFeb) / ddFeb * 100).toFixed(0) : 'N/A';

    setInsights('insightsDD', [
        { icon: latest > prev ? 'up' : 'down', text: `Trend: ${latest > prev ? 'Degrading' : 'Improving'} (${pctChange > 0 ? '+' : ''}${pctChange}% sprint-over-sprint)` },
        { icon: rag === 'green' ? 'info' : 'warn', text: `Latest: ${latest.toFixed(2)}% vs Benchmark: ${BENCHMARKS.defectDensityLow}-${BENCHMARKS.defectDensityHigh}% — ${rag === 'green' ? 'Within range' : rag === 'amber' ? 'Above low threshold' : 'Exceeds benchmark'}` },
        { icon: 'warn', text: `Defect Density increased ${momChange}% month-over-month. Investigate root cause in Sprint 6.05.` }
    ]);
}

// ───── Chart 2: Defects Created ─────
function renderDefectsCreatedChart(data) {
    const tc = getThemeColors();
    const ctx = document.getElementById('chartDefectsCreated').getContext('2d');
    const labels = data.sprints;
    const sprintVals = labels.map(s => data.defectsCreated[s] || 0);

    chartInstances.defects = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Defects per Sprint',
                    data: sprintVals,
                    backgroundColor: 'rgba(99,102,241,0.7)',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 2
                },
                {
                    label: 'Trend',
                    data: sprintVals,
                    type: 'line',
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#f59e0b',
                    tension: 0.3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: tc.text, font: { size: 11 } } },
                tooltip: tooltipOpts(tc),
                datalabels: {
                    display: (ctx2) => ctx2.datasetIndex === 0,
                    color: tc.text, anchor: 'end', align: 'top', offset: 2,
                    font: { size: 11, weight: 'bold' }
                }
            },
            scales: {
                x: { ...commonScaleOpts(tc), title: { display: true, text: 'Sprint' } },
                y: { ...commonScaleOpts(tc), title: { display: true, text: 'Defects' }, beginAtZero: true }
            }
        },
        plugins: [ChartDataLabels]
    });

    const totalFeb = data.defectsTotal.Feb || 0;
    const totalMar = data.defectsTotal.Mar || 0;
    const change = totalFeb > 0 ? ((totalMar - totalFeb) / totalFeb * 100).toFixed(0) : 'N/A';
    const rag = totalMar <= totalFeb ? 'green' : (totalMar <= totalFeb * 1.3 ? 'amber' : 'red');
    setRAG('ragDefects', rag);

    setInsights('insightsDefects', [
        { icon: totalMar > totalFeb ? 'up' : 'down', text: `Feb Total: ${totalFeb} → Mar Total: ${totalMar} (${change > 0 ? '+' : ''}${change}% MoM)` },
        { icon: 'warn', text: `Sprint 6.05 spike (${data.defectsCreated['6.05'] || 'N/A'} defects) — nearly doubled from previous sprint.` },
        { icon: 'info', text: `Total defects across both months: ${totalFeb + totalMar}. Trend is increasing.` }
    ]);
}

// ───── Chart 3: Test Execution Efficiency ─────
function renderTestExecChart(data) {
    const tc = getThemeColors();
    const ctx = document.getElementById('chartTestExec').getContext('2d');
    const labels = data.sprints;
    const created = labels.map(s => data.tcsCreated[s] || 0);
    const executed = labels.map(s => data.tcsExecuted[s] || 0);
    const ratio = labels.map((s, i) => created[i] > 0 ? +(executed[i] / created[i] * 100).toFixed(1) : 0);

    chartInstances.exec = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'TCs Created',
                    data: created,
                    backgroundColor: 'rgba(59,130,246,0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4,
                    stack: 'stack0',
                    yAxisID: 'y',
                    order: 2
                },
                {
                    label: 'TCs Executed',
                    data: executed,
                    backgroundColor: 'rgba(34,197,94,0.6)',
                    borderColor: '#22c55e',
                    borderWidth: 1,
                    borderRadius: 4,
                    stack: 'stack1',
                    yAxisID: 'y',
                    order: 2
                },
                {
                    label: 'Exec/Create Ratio (%)',
                    data: ratio,
                    type: 'line',
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 5,
                    pointBackgroundColor: '#f59e0b',
                    yAxisID: 'y1',
                    tension: 0.3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: tc.text, font: { size: 11 } } },
                tooltip: tooltipOpts(tc),
                datalabels: { display: false }
            },
            scales: {
                x: { ...commonScaleOpts(tc), title: { display: true, text: 'Sprint' } },
                y: { ...commonScaleOpts(tc), title: { display: true, text: 'Test Cases' }, beginAtZero: true, position: 'left' },
                y1: {
                    ...commonScaleOpts(tc),
                    title: { display: true, text: 'Ratio (%)' },
                    position: 'right',
                    beginAtZero: true,
                    max: 350,
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });

    const avgRatio = ratio.reduce((a, b) => a + b, 0) / ratio.length;
    const rag = avgRatio >= BENCHMARKS.testExecEfficiency ? 'green' : (avgRatio >= 80 ? 'amber' : 'red');
    setRAG('ragExec', rag);

    const totalExec = Object.values(data.tcsExecutedTotal).reduce((a, b) => a + b, 0);
    setInsights('insightsExec', [
        { icon: avgRatio >= 100 ? 'info' : 'warn', text: `Avg Execution-to-Creation Ratio: ${avgRatio.toFixed(1)}% — ${avgRatio >= 100 ? 'Regression testing is significant' : 'Below creation count'}` },
        { icon: 'warn', text: `Consider test automation to reduce manual regression burden (${totalExec.toLocaleString()} manual executions total).` },
        { icon: 'info', text: `Benchmark: >${BENCHMARKS.testExecEfficiency}% of created tests executed. Execution ratio exceeds creation in all sprints — indicates heavy re-testing.` }
    ]);
}

// ───── Chart 4: Monthly Comparison ─────
function renderMonthlyCompChart(data) {
    const tc = getThemeColors();
    const ctx = document.getElementById('chartMonthlyComp').getContext('2d');

    const febDefects = data.defectsTotal.Feb || 0;
    const marDefects = data.defectsTotal.Mar || 0;
    const febCreated = data.tcsCreatedTotal.Feb || 0;
    const marCreated = data.tcsCreatedTotal.Mar || 0;
    const febExec = data.tcsExecutedTotal.Feb || 0;
    const marExec = data.tcsExecutedTotal.Mar || 0;

    const pctDefects = febDefects > 0 ? ((marDefects - febDefects) / febDefects * 100).toFixed(0) : 0;
    const pctCreated = febCreated > 0 ? ((marCreated - febCreated) / febCreated * 100).toFixed(0) : 0;
    const pctExec = febExec > 0 ? ((marExec - febExec) / febExec * 100).toFixed(0) : 0;

    chartInstances.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Defects', 'TCs Created', 'TCs Executed'],
            datasets: [
                {
                    label: 'Feb Total',
                    data: [febDefects, febCreated, febExec],
                    backgroundColor: 'rgba(59,130,246,0.7)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Mar Total',
                    data: [marDefects, marCreated, marExec],
                    backgroundColor: 'rgba(139,92,246,0.7)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: tc.text, font: { size: 11 } } },
                tooltip: tooltipOpts(tc),
                datalabels: {
                    color: tc.text,
                    anchor: 'end',
                    align: 'top',
                    offset: 2,
                    font: { size: 10, weight: 'bold' },
                    formatter: (value, ctx2) => {
                        if (ctx2.datasetIndex === 1) {
                            const pcts = [pctDefects, pctCreated, pctExec];
                            const p = pcts[ctx2.dataIndex];
                            return value + ' (' + (p > 0 ? '+' : '') + p + '%)';
                        }
                        return value;
                    }
                }
            },
            scales: {
                x: commonScaleOpts(tc),
                y: { ...commonScaleOpts(tc), beginAtZero: true }
            }
        },
        plugins: [ChartDataLabels]
    });

    setRAG('ragMonthly', Math.abs(pctDefects) > 50 ? 'red' : Math.abs(pctDefects) > 20 ? 'amber' : 'green');

    setInsights('insightsMonthly', [
        { icon: pctDefects > 0 ? 'up' : 'down', text: `Defects: ${febDefects} → ${marDefects} (${pctDefects > 0 ? '+' : ''}${pctDefects}%)` },
        { icon: 'info', text: `TCs Created: ${febCreated} → ${marCreated} (${pctCreated > 0 ? '+' : ''}${pctCreated}%), TCs Executed: ${febExec} → ${marExec} (${pctExec > 0 ? '+' : ''}${pctExec}%)` },
        { icon: 'warn', text: `Defect growth (+${pctDefects}%) outpaces test creation (+${pctCreated}%). May indicate scope or complexity increase.` }
    ]);
}

// ───── Chart 5: Say Do Ratio (Gauge/Donut) ─────
function renderSayDoChart(data) {
    const tc = getThemeColors();
    const ctx = document.getElementById('chartSayDo').getContext('2d');

    // Say Do values represent committed items that were delivered
    const febCommitted = data.sayDoTotal.Feb || 1;
    const febDelivered = febCommitted; // all committed items delivered
    const marCommitted = data.sayDoTotal.Mar || 1;
    const marDelivered = marCommitted;

    const febPct = Math.min(+(febDelivered / febCommitted * 100).toFixed(1), 100);
    const marPct = Math.min(+(marDelivered / marCommitted * 100).toFixed(1), 100);

    const getColor = (pct) => pct >= 95 ? '#22c55e' : pct >= 85 ? '#f59e0b' : '#ef4444';

    chartInstances.saydo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Feb Delivered', 'Feb Gap', 'Mar Delivered', 'Mar Gap'],
            datasets: [
                {
                    label: 'February',
                    data: [febPct, 100 - febPct],
                    backgroundColor: [getColor(febPct), 'rgba(128,128,128,0.15)'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270
                },
                {
                    label: 'March',
                    data: [marPct, 100 - marPct],
                    backgroundColor: [getColor(marPct), 'rgba(128,128,128,0.15)'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: { display: true, labels: { color: tc.text, font: { size: 11 }, generateLabels: () => [
                    { text: `Feb: ${febPct}%`, fillStyle: getColor(febPct), strokeStyle: 'transparent' },
                    { text: `Mar: ${marPct}%`, fillStyle: getColor(marPct), strokeStyle: 'transparent' }
                ]}},
                tooltip: {
                    ...tooltipOpts(tc),
                    callbacks: { label: ctx2 => ctx2.dataset.label + ': ' + ctx2.parsed + '%' }
                },
                datalabels: { display: false }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const { ctx: c, width, height } = chart;
                c.save();
                const avg = ((febPct + marPct) / 2).toFixed(0);
                c.font = 'bold 22px sans-serif';
                c.fillStyle = tc.text;
                c.textAlign = 'center';
                c.fillText(avg + '%', width / 2, height * 0.55);
                c.font = '12px sans-serif';
                c.fillStyle = tc.text;
                c.fillText('Avg Say Do Ratio', width / 2, height * 0.55 + 20);
                c.restore();
            }
        }]
    });

    const avg = (febPct + marPct) / 2;
    const rag = avg >= 95 ? 'green' : avg >= 85 ? 'amber' : 'red';
    setRAG('ragSayDo', rag);

    setInsights('insightsSayDo', [
        { icon: 'info', text: `Feb: ${febDelivered} delivered of ${febCommitted} committed (${febPct}%), Mar: ${marDelivered} of ${marCommitted} (${marPct}%)` },
        { icon: avg >= 85 ? 'info' : 'warn', text: `Benchmark: >${BENCHMARKS.sayDoRatio}% delivery rate. Current avg: ${avg.toFixed(1)}%` },
        { icon: 'info', text: `Say Do Ratio is at ~${avg.toFixed(0)}%. Validate if sprint commitments are sufficiently ambitious.` }
    ]);
}

// ───── Chart 6: Sprint Velocity & Release Timeline ─────
function renderTimelineChart(data) {
    const tc = getThemeColors();
    const ctx = document.getElementById('chartTimeline').getContext('2d');
    const labels = data.sprints;

    const dateMap = {
        '17-Feb': new Date(2025, 1, 17), '25-Feb': new Date(2025, 1, 25),
        '9-Mar': new Date(2025, 2, 9), '31-Mar': new Date(2025, 2, 31)
    };

    const dayOffsets = labels.map(s => {
        const d = dateMap[data.releaseDates[s]];
        return d ? Math.round((d - dateMap['17-Feb']) / (1000 * 60 * 60 * 24)) : 0;
    });

    const velocity = labels.map(s => (data.tcsExecuted[s] || 0) + (data.defectsCreated[s] || 0));

    chartInstances.timeline = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map((s, i) => `${data.releaseVersions[s] || s}\n(${data.releaseDates[s] || ''})`),
            datasets: [
                {
                    label: 'Sprint Velocity (TCs + Defects)',
                    data: velocity,
                    backgroundColor: labels.map((_, i) => ['rgba(59,130,246,0.7)', 'rgba(99,102,241,0.7)', 'rgba(139,92,246,0.7)', 'rgba(168,85,247,0.7)'][i]),
                    borderColor: labels.map((_, i) => ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'][i]),
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    label: 'Days from First Release',
                    data: dayOffsets,
                    type: 'line',
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 3],
                    pointRadius: 6,
                    pointBackgroundColor: '#f59e0b',
                    yAxisID: 'y1',
                    tension: 0.2,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: tc.text, font: { size: 11 } } },
                tooltip: tooltipOpts(tc),
                datalabels: {
                    display: (ctx2) => ctx2.datasetIndex === 0,
                    color: tc.text,
                    anchor: 'end', align: 'top', offset: 2,
                    font: { size: 10, weight: 'bold' }
                }
            },
            scales: {
                x: commonScaleOpts(tc),
                y: { ...commonScaleOpts(tc), title: { display: true, text: 'Velocity' }, beginAtZero: true, position: 'left' },
                y1: {
                    ...commonScaleOpts(tc),
                    title: { display: true, text: 'Days' },
                    position: 'right',
                    beginAtZero: true,
                    grid: { drawOnChartArea: false }
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    setRAG('ragTimeline', 'green');

    const avgVelocity = velocity.reduce((a, b) => a + b, 0) / velocity.length;
    setInsights('insightsTimeline', [
        { icon: 'info', text: `4 releases over ~6 weeks. Average sprint velocity: ${avgVelocity.toFixed(0)} (TCs executed + defects).` },
        { icon: 'info', text: `Release cadence: ~${(42 / labels.length).toFixed(0)} days between releases.` },
        { icon: velocity[velocity.length - 1] > velocity[0] ? 'up' : 'down', text: `Velocity trend: ${velocity[0]} → ${velocity[velocity.length - 1]} (${velocity[velocity.length - 1] > velocity[0] ? 'increasing' : 'stable'}).` }
    ]);
}

// ───── Release Table ─────
function renderReleaseTable(data) {
    const tbody = document.getElementById('releaseTableBody');
    tbody.innerHTML = '';
    data.sprints.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${s}</strong></td>
            <td>${data.releaseVersions[s] || '-'}</td>
            <td>${data.releaseDates[s] || '-'}</td>
            <td>${data.defectsCreated[s] || '-'}</td>
            <td>${data.tcsExecuted[s] || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ───── Helpers ─────
function setRAG(elId, rag) {
    const el = document.getElementById(elId);
    if (el) el.className = 'rag-badge ' + rag;
}

function setInsights(elId, items) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = items.map(it => `
        <div class="insight-item">
            <span class="insight-icon ${it.icon}">
                ${it.icon === 'up' ? '<i class="bi bi-arrow-up-circle-fill"></i>' :
                  it.icon === 'down' ? '<i class="bi bi-arrow-down-circle-fill"></i>' :
                  it.icon === 'warn' ? '<i class="bi bi-exclamation-triangle-fill"></i>' :
                  '<i class="bi bi-info-circle-fill"></i>'}
            </span>
            <span>${it.text}</span>
        </div>
    `).join('');
}

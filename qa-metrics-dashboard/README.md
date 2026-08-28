# QA Executive Metrics Dashboard — POS Retail

A standalone, browser-based executive metrics dashboard for QA projects in the POS Retail domain. No build tools or server required — just open `index.html` in any modern browser.

## Quick Start

```bash
# Option 1: Open directly in a browser
open index.html
# or double-click index.html in your file explorer

# Option 2: Serve via a simple HTTP server
python3 -m http.server 8080
# then navigate to http://localhost:8080
```

## Features

- **Executive Summary** — Overall project health score with KPI cards (Total Defects, Avg Defect Density, Total TCs Executed, Say Do Ratio) and month-over-month trend indicators.
- **6 Interactive Charts** — Defect Density Trend, Defects Created per Sprint, Test Execution Efficiency, Monthly Comparison, Say Do Ratio (Gauge), Sprint Velocity & Release Timeline.
- **Auto-Generated Insights** — Each chart includes trend direction, percentage changes, industry benchmark comparisons, and actionable recommendations.
- **RAG Status Indicators** — Red/Amber/Green badges on every metric.
- **Excel Import** — Upload `.xlsx` or `.xls` files to replace sample data with your own project metrics.
- **Dark/Light Theme** — Toggle between themes; preference is saved in `localStorage`.
- **Print-Friendly** — Click the PDF button or use `Ctrl+P` to generate a print-optimized report.
- **Responsive** — Works on desktop, tablet, and large mobile screens.

## File Structure

```
qa-metrics-dashboard/
├── index.html          # Main dashboard page
├── style.css           # Custom styles (themes, print CSS)
├── app.js              # Application logic (charts, parsing, insights)
├── sample_data.xlsx    # Sample Excel file with POS Retail QA data
└── README.md           # This file
```

## Excel File Format

The dashboard expects an Excel file with this column structure:

| S.No | Metrics | Formula | Month1 | | | Month2 | | |
|------|---------|---------|--------|------|-------|--------|------|-------|
| | | | Sprint1 | Sprint2 | Total | Sprint1 | Sprint2 | Total |
| 1 | Defect Density | ... | 5.56% | 6.23% | 5.92% | 6.58% | 13.18% | 9.98% |
| 2 | Defects Created | ... | 12 | 16 | 28 | 16 | 34 | 50 |
| 3 | Manual TCs Created | ... | 84 | 126 | 210 | 111 | 108 | 219 |
| 4 | Manual TCs Executed | ... | 216 | 257 | 473 | 243 | 258 | 501 |
| 5 | Say Do Ratio | ... | 43 | 62 | 105 | 46 | 60 | 106 |
| 6 | Release Versions | | v.6.02.02 | v.6.03.04 | | v.6.04.01 | v.6.05.04 | |
| 7 | Release Dates | | 17-Feb | 25-Feb | | 9-Mar | 31-Mar | |

### Key Rules
- **Row 1**: Month names in merged cells spanning 3 columns each (sprint1, sprint2, total).
- **Row 2**: Sprint identifiers under each month, with "Total" for the aggregated column.
- **Rows 3+**: Metric names in column B are matched by keyword (e.g., "defect density", "defects created", "tcs created", "tcs executed", "say do").
- The parser is flexible — column A (S.No) and column C (Formula) are optional.

## Industry Benchmarks

Default benchmarks (configurable in `app.js` under `BENCHMARKS`):

| Metric | Benchmark | RAG Thresholds |
|--------|-----------|----------------|
| Defect Density | 2–5% | Green ≤2%, Amber 2–5%, Red >5% |
| Test Execution Efficiency | >90% of created tests executed | Green ≥90%, Amber 80–90%, Red <80% |
| Say Do Ratio | >90% delivery rate | Green ≥95%, Amber 85–95%, Red <85% |
| Defect Leakage | <5% | Green <5%, Red ≥5% |

To customize, edit the `BENCHMARKS` object at the top of `app.js`:

```javascript
const BENCHMARKS = {
    defectDensityLow: 2,
    defectDensityHigh: 5,
    testExecEfficiency: 90,
    sayDoRatio: 90,
    defectLeakage: 5
};
```

## Technology Stack

| Library | Version | Loaded via |
|---------|---------|------------|
| Bootstrap 5 | 5.3.3 | CDN |
| Bootstrap Icons | 1.11.3 | CDN |
| Chart.js | 4.4.7 | CDN |
| chartjs-plugin-annotation | 3.1.0 | CDN |
| chartjs-plugin-datalabels | 2.2.0 | CDN |
| SheetJS (xlsx) | 0.18.5 | CDN |

## Screenshots

*Open `index.html` in your browser to see the live dashboard.*

<!-- Add screenshots here -->
<!-- ![Dashboard Light Theme](screenshots/light.png) -->
<!-- ![Dashboard Dark Theme](screenshots/dark.png) -->

## License

Internal use — POS Retail QA Team.

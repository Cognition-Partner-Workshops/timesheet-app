// Helper: create element with class and text
function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

// Render European Countries Grid
function renderCountries() {
    const grid = document.getElementById('countries-grid');
    if (!grid) return;
    europeanCountries.forEach(country => {
        const card = createElement('div', 'country-card');

        const flag = createElement('span', 'country-flag', country.flag);
        const info = createElement('div', 'country-info');
        const countryName = createElement('span', 'country-name', country.name);
        const capital = createElement('span', 'country-capital');
        capital.textContent = country.capital + ' \u2022 ' + country.population + 'M';

        info.appendChild(countryName);
        info.appendChild(capital);
        card.appendChild(flag);
        card.appendChild(info);
        grid.appendChild(card);
    });
}

// Store chart instances for lifecycle management
var charts = [];

// Render Biggest Cities Bar Chart
function renderCitiesChart() {
    const canvas = document.getElementById('citiesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    charts.push(new Chart(ctx, {
        type: 'bar',
        data: {
            labels: biggestCities.map(c => c.name),
            datasets: [{
                label: 'Population (millions)',
                data: biggestCities.map(c => c.population),
                backgroundColor: biggestCities.map((_, i) => {
                    const colors = [
                        'rgba(245, 175, 25, 0.8)',
                        'rgba(192, 192, 192, 0.8)',
                        'rgba(205, 127, 50, 0.8)',
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(17, 153, 142, 0.8)'
                    ];
                    return i < 5 ? colors[i] : 'rgba(102, 126, 234, 0.4)';
                }),
                borderColor: biggestCities.map((_, i) => {
                    const colors = [
                        'rgba(245, 175, 25, 1)',
                        'rgba(192, 192, 192, 1)',
                        'rgba(205, 127, 50, 1)',
                        'rgba(102, 126, 234, 1)',
                        'rgba(17, 153, 142, 1)'
                    ];
                    return i < 5 ? colors[i] : 'rgba(102, 126, 234, 0.6)';
                }),
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 12, 41, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#ccc',
                    borderColor: 'rgba(102, 126, 234, 0.5)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const city = biggestCities[context.dataIndex];
                            return city.population + 'M - ' + city.country;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#888', font: { size: 11 } },
                    title: {
                        display: true,
                        text: 'Population (millions)',
                        color: '#888'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#aaa',
                        font: { size: 11 },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    }));
}

// Helper: create a stat row
function createStatRow(label, value) {
    const row = createElement('div', 'city-stat');
    const labelEl = createElement('span', 'city-stat-label', label);
    const valueEl = createElement('span', 'city-stat-value', value);
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
}

// Helper: create a tag element
function createTag(text, className) {
    const tag = createElement('span', className || 'city-tag', text);
    return tag;
}

// Render Top 5 Cities Detail Cards
function renderTopCities() {
    const container = document.getElementById('top-cities-container');
    if (!container) return;

    topFiveCities.forEach(city => {
        const card = createElement('div', 'city-card');

        // Rank badge
        const rank = createElement('div', 'city-rank city-rank-' + city.rank, String(city.rank));

        // Details section
        const details = createElement('div', 'city-details');

        const nameRow = createElement('div', 'city-name-row');
        nameRow.appendChild(createElement('span', 'city-title', city.name));
        nameRow.appendChild(createElement('span', 'city-country', city.country));
        details.appendChild(nameRow);

        details.appendChild(createElement('p', 'city-description', city.description));

        // Category tags
        const tagsDiv = createElement('div', 'city-tags');
        city.tags.forEach(tag => {
            tagsDiv.appendChild(createTag(tag, 'city-tag'));
        });
        details.appendChild(tagsDiv);

        // Landmark tags
        const landmarksDiv = createElement('div', 'city-tags city-tags-landmarks');
        city.landmarks.forEach(landmark => {
            landmarksDiv.appendChild(createTag(landmark, 'city-tag city-tag-landmark'));
        });
        details.appendChild(landmarksDiv);

        // Stats section
        const stats = createElement('div', 'city-stats');
        stats.appendChild(createStatRow('Population', city.population));
        stats.appendChild(createStatRow('Area', city.area));
        stats.appendChild(createStatRow('Founded', city.founded));
        stats.appendChild(createStatRow('GDP', city.gdp));
        stats.appendChild(createStatRow('Avg Salary', city.stats.avgSalary));

        card.appendChild(rank);
        card.appendChild(details);
        card.appendChild(stats);
        container.appendChild(card);
    });
}

// Helper: create a chart safely
function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    charts.push(new Chart(ctx, config));
}

// Render Comparison Charts
function renderComparisonCharts() {
    const cities = topFiveCities.map(c => c.name);
    const gradientColors = [
        'rgba(245, 175, 25, 0.8)',
        'rgba(192, 192, 192, 0.8)',
        'rgba(205, 127, 50, 0.8)',
        'rgba(102, 126, 234, 0.8)',
        'rgba(17, 153, 142, 0.8)'
    ];

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#888', font: { size: 10 } }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#aaa', font: { size: 10 } }
            }
        }
    };

    // GDP Chart
    createChart('gdpChart', {
        type: 'bar',
        data: {
            labels: cities,
            datasets: [{
                data: [245, 320, 580, 95, 175],
                backgroundColor: gradientColors,
                borderRadius: 6
            }]
        },
        options: chartOptions
    });

    // Cost of Living Chart
    createChart('costChart', {
        type: 'bar',
        data: {
            labels: cities,
            datasets: [{
                data: topFiveCities.map(c => c.stats.costIndex),
                backgroundColor: gradientColors,
                borderRadius: 6
            }]
        },
        options: chartOptions
    });

    // Tourists Chart
    createChart('touristsChart', {
        type: 'bar',
        data: {
            labels: cities,
            datasets: [{
                data: topFiveCities.map(c => c.stats.tourists),
                backgroundColor: gradientColors,
                borderRadius: 6
            }]
        },
        options: chartOptions
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    renderCountries();
    renderCitiesChart();
    renderTopCities();
    renderComparisonCharts();
});

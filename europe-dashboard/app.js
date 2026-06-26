// Render European Countries Grid
function renderCountries() {
    const grid = document.getElementById('countries-grid');
    europeanCountries.forEach(country => {
        const card = document.createElement('div');
        card.className = 'country-card';
        card.innerHTML = `
            <span class="country-flag">${country.flag}</span>
            <div class="country-info">
                <span class="country-name">${country.name}</span>
                <span class="country-capital">${country.capital} &bull; ${country.population}M</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Render Biggest Cities Bar Chart
function renderCitiesChart() {
    const ctx = document.getElementById('citiesChart').getContext('2d');
    new Chart(ctx, {
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
                            return `${city.population}M - ${city.country}`;
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
    });
}

// Render Top 5 Cities Detail Cards
function renderTopCities() {
    const container = document.getElementById('top-cities-container');
    topFiveCities.forEach(city => {
        const card = document.createElement('div');
        card.className = 'city-card';
        card.innerHTML = `
            <div class="city-rank city-rank-${city.rank}">${city.rank}</div>
            <div class="city-details">
                <div class="city-name-row">
                    <span class="city-title">${city.name}</span>
                    <span class="city-country">${city.country}</span>
                </div>
                <p class="city-description">${city.description}</p>
                <div class="city-tags">
                    ${city.tags.map(tag => `<span class="city-tag">${tag}</span>`).join('')}
                </div>
                <div class="city-tags" style="margin-top: 0.5rem;">
                    ${city.landmarks.map(l => `<span class="city-tag" style="background: rgba(17,153,142,0.15); color: #11998e; border-color: rgba(17,153,142,0.25);">${l}</span>`).join('')}
                </div>
            </div>
            <div class="city-stats">
                <div class="city-stat">
                    <span class="city-stat-label">Population</span>
                    <span class="city-stat-value">${city.population}</span>
                </div>
                <div class="city-stat">
                    <span class="city-stat-label">Area</span>
                    <span class="city-stat-value">${city.area}</span>
                </div>
                <div class="city-stat">
                    <span class="city-stat-label">Founded</span>
                    <span class="city-stat-value">${city.founded}</span>
                </div>
                <div class="city-stat">
                    <span class="city-stat-label">GDP</span>
                    <span class="city-stat-value">${city.gdp}</span>
                </div>
                <div class="city-stat">
                    <span class="city-stat-label">Avg Salary</span>
                    <span class="city-stat-value">${city.stats.avgSalary}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
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
    new Chart(document.getElementById('gdpChart').getContext('2d'), {
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
    new Chart(document.getElementById('costChart').getContext('2d'), {
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
    new Chart(document.getElementById('touristsChart').getContext('2d'), {
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
document.addEventListener('DOMContentLoaded', () => {
    renderCountries();
    renderCitiesChart();
    renderTopCities();
    renderComparisonCharts();
});

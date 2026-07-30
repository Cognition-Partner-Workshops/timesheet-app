/**
 * Investment Bot Dashboard - Frontend JavaScript
 */

const API_BASE = '';
const REFRESH_INTERVAL = 300000; // 5 minutes

let currentCategory = 'all';
let allArticles = [];
let autoRefreshTimer = null;

// ─── DOM Elements ────────────────────────────────────────────
const marketGrid = document.getElementById('marketGrid');
const newsFeed = document.getElementById('newsFeed');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdated = document.getElementById('lastUpdated');
const categoryTabs = document.getElementById('categoryTabs');

// ─── Market Data ─────────────────────────────────────────────

const SECTION_LABELS = {
    indices: 'Indices',
    crypto: 'Cryptocurrencies',
    commodities: 'Commodities',
    currencies: 'Currencies'
};

function formatPrice(price, currency) {
    if (price === null || price === undefined) return '—';
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(price);
    } catch {
        return `$${price.toFixed(2)}`;
    }
}

function renderMarketData(data) {
    if (!data || !data.market_data) {
        marketGrid.innerHTML = '<div class="loading-placeholder">Market data unavailable</div>';
        return;
    }

    let html = '';
    for (const [section, items] of Object.entries(data.market_data)) {
        const label = SECTION_LABELS[section] || section;
        html += `<div class="market-section-label">${label}</div>`;

        for (const item of items) {
            const status = item.status || 'unavailable';
            const changeClass = status === 'up' ? 'up' : status === 'down' ? 'down' : '';
            const arrow = status === 'up' ? '&#9650;' : status === 'down' ? '&#9660;' : '';
            const changeText = item.change !== null
                ? `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)} (${item.change_pct >= 0 ? '+' : ''}${item.change_pct.toFixed(2)}%)`
                : 'N/A';

            html += `
                <div class="market-card">
                    <div class="name">${item.name}</div>
                    <div class="price">${formatPrice(item.price, item.currency)}</div>
                    <div class="change ${changeClass}">
                        <span class="arrow">${arrow}</span>
                        ${changeText}
                    </div>
                </div>
            `;
        }
    }

    marketGrid.innerHTML = html;
}

async function loadMarketData() {
    try {
        const resp = await fetch(`${API_BASE}/api/market`);
        const data = await resp.json();
        renderMarketData(data);
    } catch (err) {
        console.error('Failed to load market data:', err);
        marketGrid.innerHTML = '<div class="loading-placeholder">Failed to load market data</div>';
    }
}

// ─── News Feed ───────────────────────────────────────────────

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderNews(articles) {
    if (!articles || articles.length === 0) {
        newsFeed.innerHTML = `
            <div class="no-results">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <p>No articles found</p>
            </div>
        `;
        return;
    }

    let html = '';
    for (const article of articles) {
        const badgeClass = `badge-${article.category || 'markets'}`;
        html += `
            <a class="news-card" href="${article.link}" target="_blank" rel="noopener noreferrer">
                <div class="news-card-header">
                    <div class="title">${escapeHtml(article.title)}</div>
                    <span class="category-badge ${badgeClass}">${article.category || 'general'}</span>
                </div>
                ${article.summary ? `<div class="summary">${escapeHtml(article.summary)}</div>` : ''}
                <div class="meta">
                    <span class="source">${escapeHtml(article.source || '')}</span>
                    <span>${timeAgo(article.published)}</span>
                </div>
            </a>
        `;
    }

    newsFeed.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadNews(category) {
    try {
        let url = `${API_BASE}/api/news?limit=100`;
        if (category && category !== 'all') {
            url += `&category=${encodeURIComponent(category)}`;
        }
        const resp = await fetch(url);
        const data = await resp.json();
        allArticles = data.articles || [];
        renderNews(allArticles);

        if (data.last_updated) {
            const dt = new Date(data.last_updated);
            lastUpdated.textContent = `Updated ${dt.toLocaleTimeString()}`;
        }
    } catch (err) {
        console.error('Failed to load news:', err);
        newsFeed.innerHTML = '<div class="loading-placeholder">Failed to load news. Retrying...</div>';
    }
}

// ─── Search ──────────────────────────────────────────────────

let searchTimeout = null;

async function performSearch(query) {
    if (!query.trim()) {
        loadNews(currentCategory);
        return;
    }

    try {
        const resp = await fetch(`${API_BASE}/api/news/search?q=${encodeURIComponent(query)}&limit=50`);
        const data = await resp.json();
        renderNews(data.articles || []);
    } catch (err) {
        console.error('Search error:', err);
    }
}

searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(e.target.value), 400);
});

// ─── Category Tabs ───────────────────────────────────────────

categoryTabs.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab')) return;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');

    currentCategory = e.target.dataset.category;
    searchInput.value = '';
    loadNews(currentCategory);
});

// ─── Refresh ─────────────────────────────────────────────────

async function refreshAll() {
    refreshBtn.classList.add('spinning');
    await Promise.all([loadMarketData(), loadNews(currentCategory)]);
    setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
}

refreshBtn.addEventListener('click', refreshAll);

// ─── Auto-Refresh ────────────────────────────────────────────

function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(refreshAll, REFRESH_INTERVAL);
}

// ─── Init ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadMarketData();
    loadNews('all');
    startAutoRefresh();
});

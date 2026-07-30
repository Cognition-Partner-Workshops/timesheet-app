"""Investment Bot Dashboard - Main FastAPI application."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.market_data import fetch_market_overview
from app.news_fetcher import fetch_all_news, search_news

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory cache for news and market data
_cache: dict = {
    "news": None,
    "market": None,
    "news_updated": None,
    "market_updated": None,
}

CACHE_TTL_NEWS = 300  # 5 minutes
CACHE_TTL_MARKET = 120  # 2 minutes


async def _refresh_news() -> None:
    """Refresh the news cache."""
    try:
        _cache["news"] = await fetch_all_news()
        _cache["news_updated"] = datetime.now(timezone.utc)
        logger.info(f"News cache refreshed: {_cache['news']['total_count']} articles")
    except Exception as e:
        logger.error(f"Error refreshing news: {e}")


async def _refresh_market() -> None:
    """Refresh market data cache."""
    try:
        _cache["market"] = await fetch_market_overview()
        _cache["market_updated"] = datetime.now(timezone.utc)
        logger.info("Market data cache refreshed")
    except Exception as e:
        logger.error(f"Error refreshing market data: {e}")


async def _background_refresh() -> None:
    """Background task to periodically refresh data."""
    while True:
        await asyncio.gather(
            _refresh_news(),
            _refresh_market(),
            return_exceptions=True,
        )
        await asyncio.sleep(CACHE_TTL_NEWS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Initial data load
    logger.info("Starting Investment Bot Dashboard...")
    await asyncio.gather(_refresh_news(), _refresh_market())
    # Start background refresh task
    task = asyncio.create_task(_background_refresh())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Investment Bot Dashboard",
    description="Real-time financial news aggregator and market dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main dashboard page."""
    with open("static/index.html") as f:
        return HTMLResponse(content=f.read())


@app.get("/api/news")
async def get_news(
    category: str | None = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=200, description="Number of articles"),
):
    """Get aggregated financial news."""
    now = datetime.now(timezone.utc)
    if (
        _cache["news"] is None
        or _cache["news_updated"] is None
        or (now - _cache["news_updated"]).total_seconds() > CACHE_TTL_NEWS
    ):
        await _refresh_news()

    data = _cache["news"]
    if data is None:
        return {"articles": [], "total_count": 0, "error": "News data unavailable"}

    if category and category in data["categorized"]:
        articles = data["categorized"][category][:limit]
        return {
            "articles": articles,
            "total_count": len(articles),
            "category": category,
            "last_updated": data["last_updated"],
        }

    return {
        "articles": data["articles"][:limit],
        "total_count": min(limit, data["total_count"]),
        "last_updated": data["last_updated"],
        "categories": data["categories"],
    }


@app.get("/api/news/search")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
):
    """Search news articles by keyword."""
    if _cache["news"] is None:
        await _refresh_news()
    data = _cache["news"]
    if data is None:
        return {"articles": [], "total_count": 0, "query": q}

    results = await search_news(q, data["articles"])
    return {
        "articles": results[:limit],
        "total_count": len(results[:limit]),
        "query": q,
    }


@app.get("/api/market")
async def get_market():
    """Get market overview data."""
    now = datetime.now(timezone.utc)
    if (
        _cache["market"] is None
        or _cache["market_updated"] is None
        or (now - _cache["market_updated"]).total_seconds() > CACHE_TTL_MARKET
    ):
        await _refresh_market()

    if _cache["market"] is None:
        return {"market_data": {}, "error": "Market data unavailable"}

    return _cache["market"]


@app.get("/api/categories")
async def get_categories():
    """Get available news categories."""
    from app.news_fetcher import RSS_FEEDS

    return {"categories": list(RSS_FEEDS.keys())}


@app.get("/api/status")
async def status():
    """Health check and status endpoint."""
    return {
        "status": "ok",
        "news_articles": _cache["news"]["total_count"] if _cache["news"] else 0,
        "news_last_updated": _cache["news_updated"].isoformat()
        if _cache["news_updated"]
        else None,
        "market_last_updated": _cache["market_updated"].isoformat()
        if _cache["market_updated"]
        else None,
    }

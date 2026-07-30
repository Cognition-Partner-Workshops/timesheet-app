"""News fetcher module - aggregates financial news from multiple RSS feeds."""

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

import feedparser
import httpx
from dateutil import parser as date_parser

logger = logging.getLogger(__name__)

# Financial news RSS feeds organized by category
RSS_FEEDS = {
    "markets": [
        {
            "name": "Yahoo Finance - Markets",
            "url": "https://finance.yahoo.com/news/rssindex",
        },
        {
            "name": "MarketWatch - Top Stories",
            "url": "https://feeds.marketwatch.com/marketwatch/topstories/",
        },
        {
            "name": "Investing.com - Market News",
            "url": "https://www.investing.com/rss/news.rss",
        },
    ],
    "stocks": [
        {
            "name": "Yahoo Finance - Stock Market",
            "url": "https://finance.yahoo.com/news/rssindex",
        },
        {
            "name": "MarketWatch - Stocks",
            "url": "https://feeds.marketwatch.com/marketwatch/marketpulse/",
        },
    ],
    "economy": [
        {
            "name": "Reuters - Business",
            "url": "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
        },
        {
            "name": "CNBC - Economy",
            "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
        },
    ],
    "crypto": [
        {
            "name": "CoinDesk",
            "url": "https://www.coindesk.com/arc/outboundfeeds/rss/",
        },
        {
            "name": "CoinTelegraph",
            "url": "https://cointelegraph.com/rss",
        },
    ],
    "commodities": [
        {
            "name": "MarketWatch - Commodities",
            "url": "https://feeds.marketwatch.com/marketwatch/topstories/",
        },
    ],
    "technology": [
        {
            "name": "CNBC - Technology",
            "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910",
        },
    ],
}

# User-Agent header for RSS requests
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}


def _generate_id(title: str, link: str) -> str:
    """Generate a unique ID for a news article."""
    raw = f"{title}{link}"
    return hashlib.md5(raw.encode()).hexdigest()


def _parse_date(entry: dict) -> Optional[datetime]:
    """Parse date from a feed entry."""
    for field in ("published", "updated", "created"):
        val = entry.get(field)
        if val:
            try:
                return date_parser.parse(val)
            except (ValueError, TypeError):
                continue
    return None


def _clean_summary(summary: str) -> str:
    """Clean HTML tags from summary text."""
    from bs4 import BeautifulSoup

    if not summary:
        return ""
    soup = BeautifulSoup(summary, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    # Truncate to 300 chars
    if len(text) > 300:
        text = text[:297] + "..."
    return text


async def fetch_feed(
    client: httpx.AsyncClient, feed_info: dict, category: str
) -> list[dict]:
    """Fetch and parse a single RSS feed."""
    articles = []
    try:
        response = await client.get(feed_info["url"], headers=HEADERS, timeout=15.0)
        response.raise_for_status()
        feed = feedparser.parse(response.text)

        for entry in feed.entries[:15]:  # Limit to 15 per feed
            title = entry.get("title", "").strip()
            link = entry.get("link", "").strip()
            if not title or not link:
                continue

            published = _parse_date(entry)
            if published and published.tzinfo is None:
                published = published.replace(tzinfo=timezone.utc)

            summary = _clean_summary(entry.get("summary", ""))

            articles.append(
                {
                    "id": _generate_id(title, link),
                    "title": title,
                    "link": link,
                    "summary": summary,
                    "source": feed_info["name"],
                    "category": category,
                    "published": published.isoformat() if published else None,
                    "published_dt": published,
                }
            )
    except Exception as e:
        logger.warning(f"Failed to fetch {feed_info['name']}: {e}")

    return articles


async def fetch_all_news() -> dict:
    """Fetch news from all RSS feeds across all categories."""
    all_articles: list[dict] = []
    seen_ids: set[str] = set()

    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = []
        for category, feeds in RSS_FEEDS.items():
            for feed_info in feeds:
                tasks.append(fetch_feed(client, feed_info, category))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                logger.warning(f"Feed fetch error: {result}")
                continue
            for article in result:
                if article["id"] not in seen_ids:
                    seen_ids.add(article["id"])
                    all_articles.append(article)

    # Sort by published date (newest first)
    all_articles.sort(
        key=lambda x: (
            x.get("published_dt") or datetime.min.replace(tzinfo=timezone.utc)
        ),
        reverse=True,
    )

    # Remove datetime objects (not JSON-serializable)
    for article in all_articles:
        article.pop("published_dt", None)

    # Organize by category
    categorized: dict[str, list[dict]] = {}
    for category in RSS_FEEDS:
        categorized[category] = [a for a in all_articles if a["category"] == category]

    return {
        "articles": all_articles,
        "categorized": categorized,
        "total_count": len(all_articles),
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "categories": list(RSS_FEEDS.keys()),
    }


async def search_news(query: str, articles: list[dict]) -> list[dict]:
    """Search articles by keyword in title and summary."""
    query_lower = query.lower()
    return [
        a
        for a in articles
        if query_lower in a.get("title", "").lower()
        or query_lower in a.get("summary", "").lower()
    ]

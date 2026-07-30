"""Market data module - fetches market indices and stock quotes via Yahoo Finance."""

import asyncio
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

# Major market indices and assets to track
TRACKED_SYMBOLS = {
    "indices": [
        {"symbol": "^GSPC", "name": "S&P 500"},
        {"symbol": "^DJI", "name": "Dow Jones"},
        {"symbol": "^IXIC", "name": "NASDAQ"},
        {"symbol": "^FTSE", "name": "FTSE 100"},
        {"symbol": "^N225", "name": "Nikkei 225"},
    ],
    "crypto": [
        {"symbol": "BTC-USD", "name": "Bitcoin"},
        {"symbol": "ETH-USD", "name": "Ethereum"},
    ],
    "commodities": [
        {"symbol": "GC=F", "name": "Gold"},
        {"symbol": "CL=F", "name": "Crude Oil"},
        {"symbol": "SI=F", "name": "Silver"},
    ],
    "currencies": [
        {"symbol": "EURUSD=X", "name": "EUR/USD"},
        {"symbol": "GBPUSD=X", "name": "GBP/USD"},
        {"symbol": "JPY=X", "name": "USD/JPY"},
    ],
}

# Flat list of all symbols for batch fetch
ALL_SYMBOLS = []
for _section_items in TRACKED_SYMBOLS.values():
    for _item in _section_items:
        ALL_SYMBOLS.append(_item["symbol"])


async def fetch_quotes_batch(client: httpx.AsyncClient) -> dict[str, dict]:
    """Fetch quotes for all symbols using Yahoo Finance v7 batch API."""
    symbols_str = ",".join(ALL_SYMBOLS)
    url = "https://query1.finance.yahoo.com/v7/finance/quote"
    params = {"symbols": symbols_str}
    quotes: dict[str, dict] = {}

    try:
        resp = await client.get(url, params=params, headers=HEADERS, timeout=15.0)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("quoteResponse", {}).get("result", [])
        for item in results:
            symbol = item.get("symbol", "")
            price = item.get("regularMarketPrice", 0)
            prev_close = item.get("regularMarketPreviousClose", 0)
            change = item.get(
                "regularMarketChange", price - prev_close if prev_close else 0
            )
            change_pct = item.get("regularMarketChangePercent", 0)
            quotes[symbol] = {
                "price": round(price, 2),
                "change": round(change, 2),
                "change_pct": round(change_pct, 2),
                "currency": item.get("currency", "USD"),
            }
        logger.info(f"Batch quote fetch succeeded: {len(quotes)} symbols")
    except Exception as e:
        logger.warning(
            f"Batch quote fetch failed: {e}, falling back to individual fetches"
        )
        quotes = await _fetch_quotes_individually(client)

    return quotes


async def _fetch_single_quote(
    client: httpx.AsyncClient, symbol: str
) -> tuple[str, dict | None]:
    """Fetch a single quote from Yahoo Finance v8 API."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {"range": "1d", "interval": "1d"}
    try:
        resp = await client.get(url, params=params, headers=HEADERS, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
        result = data["chart"]["result"][0]
        meta = result["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev_close = meta.get("chartPreviousClose", meta.get("previousClose", 0))
        change = price - prev_close if prev_close else 0
        change_pct = (change / prev_close * 100) if prev_close else 0
        return symbol, {
            "price": round(price, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "currency": meta.get("currency", "USD"),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch quote for {symbol}: {e}")
        return symbol, None


async def _fetch_quotes_individually(client: httpx.AsyncClient) -> dict[str, dict]:
    """Fallback: fetch quotes individually with delays to avoid rate limiting."""
    quotes: dict[str, dict] = {}
    for symbol in ALL_SYMBOLS:
        sym, quote = await _fetch_single_quote(client, symbol)
        if quote:
            quotes[sym] = quote
        await asyncio.sleep(0.5)  # Rate limit buffer
    return quotes


async def fetch_market_overview() -> dict:
    """Fetch market overview data for all tracked symbols."""
    market_data: dict[str, list[dict]] = {}

    async with httpx.AsyncClient(follow_redirects=True) as client:
        quotes = await fetch_quotes_batch(client)

        for section, symbols in TRACKED_SYMBOLS.items():
            section_data = []
            for item in symbols:
                quote = quotes.get(item["symbol"])
                entry = {
                    "symbol": item["symbol"],
                    "name": item["name"],
                    "price": quote["price"] if quote else None,
                    "change": quote["change"] if quote else None,
                    "change_pct": quote["change_pct"] if quote else None,
                    "currency": quote["currency"] if quote else "USD",
                    "status": "up"
                    if quote and quote["change"] >= 0
                    else "down"
                    if quote
                    else "unavailable",
                }
                section_data.append(entry)
            market_data[section] = section_data

    return {
        "market_data": market_data,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }

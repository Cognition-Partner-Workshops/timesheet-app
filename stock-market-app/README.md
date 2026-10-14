# StockPulse — Stock Market Dashboard

A full-stack stock market application that displays the best-performing stocks for each sector daily, using real-time data and a composite scoring algorithm.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Frontend   │────▶│   Backend    │────▶│ PostgreSQL │
│  React/Vite  │     │  Express/TS  │     │   Database  │
│  (port 3000) │     │  (port 3001) │     │  (port 5432)│
└─────────────┘     └──────┬───────┘     └────────────┘
                           │
                    ┌──────┴───────┐     ┌────────────┐
                    │  Scheduler   │     │   Redis     │
                    │  (node-cron) │     │   Cache     │
                    └──────────────┘     │  (port 6379)│
                                         └────────────┘
```

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | Node.js, Express, TypeScript        |
| Frontend   | React 18, TypeScript, Vite          |
| Database   | PostgreSQL 15                       |
| Cache      | Redis 7                             |
| Charts     | Recharts                            |
| State Mgmt | TanStack Query (React Query)       |
| Container  | Docker, Docker Compose              |
| CI/CD      | GitHub Actions                      |
| Data API   | Alpha Vantage (with mock fallback)  |

## Quick Start

### Using Docker Compose (recommended)

```bash
# Clone the repository
git clone <repo-url>
cd stock-market-app

# Start all services (mock data mode, no API key needed)
docker-compose up --build

# The app will be available at:
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
```

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in a separate terminal)
cd frontend
npm install
npm run dev

# Requires PostgreSQL and Redis running locally
# Set DATABASE_URL and REDIS_URL in backend/.env
```

### Database Setup

```bash
cd backend
npm run migrate   # Create tables and indexes
npm run seed      # Populate sectors and stocks with mock data
```

## API Endpoints

| Method | Path                                      | Description                              |
|--------|-------------------------------------------|------------------------------------------|
| GET    | `/api/sectors`                            | List all sectors with stock count        |
| GET    | `/api/sectors/:sectorName/top-stocks`     | Top N stocks for a sector (default: 10)  |
| GET    | `/api/top-stocks`                         | Best single stock from every sector      |
| GET    | `/api/stocks/:symbol`                     | Full detail for one stock                |
| GET    | `/api/stocks/:symbol/price-history?range` | Price history (1d, 7d, 1m, 3m, 1y)      |
| GET    | `/api/daily-digest?date=YYYY-MM-DD`       | Daily digest of top picks per sector     |
| GET    | `/api/search?q=query`                     | Search stocks by ticker or company name  |
| GET    | `/api/health`                             | Health check                             |

## Composite Scoring Algorithm

Each stock is scored 0–100 using a weighted composite of 10 factors, normalized within each sector using min-max normalization:

| Factor               | Weight | Logic                                      |
|----------------------|--------|---------------------------------------------|
| Intraday change %    | 20%    | Higher positive change = higher score       |
| Volume ratio         | 15%    | Above-average volume = bullish signal       |
| RSI (14-day)         | 10%    | Peaks at RSI 50; penalizes extremes         |
| Price vs 50-day MA   | 10%    | Price above MA = positive signal            |
| Price vs 200-day MA  | 10%    | Price above MA = positive signal            |
| P/E ratio            | 10%    | Lower P/E relative to sector = better value |
| EPS growth (YoY)     | 10%    | Higher growth = better                      |
| 52-week position     | 5%     | Closer to 52-week high = stronger momentum  |
| Market cap           | 5%     | Larger = more stable                        |
| Dividend yield       | 5%     | Higher yield = bonus                        |

## Environment Variables

| Variable            | Description                       | Default                                    |
|---------------------|-----------------------------------|--------------------------------------------|
| `DATABASE_URL`      | PostgreSQL connection string      | `postgresql://postgres:postgres@localhost:5432/stockmarket` |
| `REDIS_URL`         | Redis connection string           | `redis://localhost:6379`                   |
| `STOCK_API_KEY`     | Alpha Vantage API key             | (empty)                                    |
| `USE_MOCK_DATA`     | Use generated mock data           | `true`                                     |
| `PORT`              | Backend server port               | `3001`                                     |
| `VITE_API_BASE_URL` | Frontend API base URL             | `/api`                                     |

## Testing

```bash
# Backend unit & integration tests
cd backend && npm test

# Frontend component tests
cd frontend && npm test

# E2E tests (requires running app)
cd frontend && npm run cypress:run
```

## Project Structure

```
stock-market-app/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment, database, Redis config
│   │   ├── migrations/      # DB schema and seed scripts
│   │   ├── routes/          # Express route handlers
│   │   ├── services/        # Scoring engine, data fetcher
│   │   ├── jobs/            # Scheduled data pipeline
│   │   ├── utils/           # Logger and helpers
│   │   └── app.ts           # Express app entry point
│   ├── tests/               # Jest tests
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API client
│   │   ├── context/         # Theme context
│   │   ├── types/           # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── cypress/             # E2E tests
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
├── .github/workflows/ci.yml
└── README.md
```

## Screenshots

*Screenshots will be added after deployment.*

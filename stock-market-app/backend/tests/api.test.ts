import request from 'supertest';
import express from 'express';
import sectorRoutes from '../src/routes/sectors';
import stockRoutes from '../src/routes/stocks';
import searchRoutes from '../src/routes/search';

// Mock the database and redis modules
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

jest.mock('../src/config/redis', () => ({
  getCached: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(undefined),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

const { query } = require('../src/config/database');

const app = express();
app.use(express.json());
app.use('/api/sectors', sectorRoutes);
app.use('/api/search', searchRoutes);
app.use('/api', stockRoutes);

describe('API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/sectors', () => {
    test('returns list of sectors with stock count', async () => {
      query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Technology', description: 'Tech sector', icon_name: 'cpu', stock_count: '10' },
          { id: 2, name: 'Healthcare', description: 'Health sector', icon_name: 'heart-pulse', stock_count: '10' },
        ],
      });

      const res = await request(app).get('/api/sectors');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('name', 'Technology');
      expect(res.body[0]).toHaveProperty('stock_count', 10);
    });
  });

  describe('GET /api/sectors/:sectorName/top-stocks', () => {
    test('returns top stocks for a valid sector', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Technology', description: 'Tech', icon_name: 'cpu' }],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, symbol: 'AAPL', company_name: 'Apple', composite_score: 85 },
            { id: 2, symbol: 'MSFT', company_name: 'Microsoft', composite_score: 82 },
          ],
        });

      const res = await request(app).get('/api/sectors/Technology/top-stocks?limit=10');
      expect(res.status).toBe(200);
      expect(res.body.sector.name).toBe('Technology');
      expect(res.body.stocks).toHaveLength(2);
    });

    test('returns 404 for non-existent sector', async () => {
      query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/sectors/NonExistent/top-stocks');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/top-stocks', () => {
    test('returns best stock from every sector', async () => {
      query.mockResolvedValue({
        rows: [
          { sector_id: 1, sector_name: 'Technology', symbol: 'AAPL', composite_score: 90 },
          { sector_id: 2, sector_name: 'Healthcare', symbol: 'JNJ', composite_score: 85 },
        ],
      });

      const res = await request(app).get('/api/top-stocks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /api/stocks/:symbol', () => {
    test('returns full detail for a valid stock', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1, symbol: 'AAPL', company_name: 'Apple Inc.',
          current_price: 185.50, composite_score: 85,
          sector_name: 'Technology',
        }],
      });

      const res = await request(app).get('/api/stocks/AAPL');
      expect(res.status).toBe(200);
      expect(res.body.symbol).toBe('AAPL');
    });

    test('returns 404 for non-existent stock', async () => {
      query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/stocks/INVALID');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/stocks/:symbol/price-history', () => {
    test('returns price history for valid stock', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-15', open: 180, high: 186, low: 179, close: 185, volume: 5000000 },
            { date: '2024-01-16', open: 185, high: 188, low: 184, close: 187, volume: 4500000 },
          ],
        });

      const res = await request(app).get('/api/stocks/AAPL/price-history?range=7d');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    test('returns 404 for non-existent stock', async () => {
      query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/stocks/INVALID/price-history');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/search', () => {
    test('returns search results matching query', async () => {
      query.mockResolvedValue({
        rows: [
          { symbol: 'AAPL', company_name: 'Apple Inc.', current_price: 185, sector_name: 'Technology' },
        ],
      });

      const res = await request(app).get('/api/search?q=AAPL');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    test('returns empty array for empty query', async () => {
      const res = await request(app).get('/api/search?q=');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });
});

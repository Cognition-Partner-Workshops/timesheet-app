import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/stockmarket',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  stockApi: {
    key: process.env.STOCK_API_KEY || '',
    baseUrl: 'https://www.alphavantage.co/query',
    twelveDataKey: process.env.TWELVE_DATA_API_KEY || 'demo',
  },
  useMockData: process.env.USE_MOCK_DATA === 'true',
  cacheTtl: 300, // 5 minutes in seconds
};

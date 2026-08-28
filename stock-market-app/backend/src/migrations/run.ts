import { pool } from '../config/database';

/**
 * Database migration: creates all tables with proper indexes.
 * Tables: sectors, stocks, price_history, score_history
 */
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Sectors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sectors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        icon_name VARCHAR(50)
      );
    `);

    // Stocks table with all fundamental and technical fields
    await client.query(`
      CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) UNIQUE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        sector_id INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
        market_cap BIGINT,
        current_price NUMERIC(12, 4),
        previous_close NUMERIC(12, 4),
        day_change_pct NUMERIC(8, 4),
        volume BIGINT,
        avg_volume BIGINT,
        pe_ratio NUMERIC(10, 4),
        eps NUMERIC(10, 4),
        eps_growth_yoy NUMERIC(10, 4),
        dividend_yield NUMERIC(8, 4),
        beta NUMERIC(6, 4),
        fifty_two_week_high NUMERIC(12, 4),
        fifty_two_week_low NUMERIC(12, 4),
        rsi_14 NUMERIC(8, 4),
        ma_50 NUMERIC(12, 4),
        ma_200 NUMERIC(12, 4),
        composite_score NUMERIC(8, 4),
        score_breakdown JSONB,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Price history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        open NUMERIC(12, 4),
        high NUMERIC(12, 4),
        low NUMERIC(12, 4),
        close NUMERIC(12, 4),
        volume BIGINT
      );
    `);

    // Score history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS score_history (
        id SERIAL PRIMARY KEY,
        stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        composite_score NUMERIC(8, 4),
        rank_in_sector INTEGER
      );
    `);

    // Indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_stocks_sector_id ON stocks(sector_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_stocks_composite_score ON stocks(composite_score DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_stocks_last_updated ON stocks(last_updated);');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_price_history_stock_date ON price_history(stock_id, date);');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_score_history_stock_date ON score_history(stock_id, date);');

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow running as standalone script
if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch(() => process.exit(1));
}

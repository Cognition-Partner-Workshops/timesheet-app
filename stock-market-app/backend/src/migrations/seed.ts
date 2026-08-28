import { pool } from '../config/database';
import { secureRandom, randomFloat, randomInteger } from '../utils/random';

/**
 * Seed data: 11 sectors and 10+ well-known tickers per sector.
 * Uses compact [symbol, company_name] tuples to minimize duplication.
 */

type StockTuple = [string, string]; // [symbol, company_name]

interface SectorSeed {
  name: string;
  description: string;
  icon_name: string;
  stocks: StockTuple[];
}

const SECTORS: SectorSeed[] = [
  { name: 'Technology', description: 'Software, hardware, semiconductors, and IT services', icon_name: 'cpu',
    stocks: [['AAPL','Apple Inc.'],['MSFT','Microsoft Corporation'],['GOOGL','Alphabet Inc.'],['NVDA','NVIDIA Corporation'],['META','Meta Platforms Inc.'],['TSM','Taiwan Semiconductor'],['AVGO','Broadcom Inc.'],['ORCL','Oracle Corporation'],['CRM','Salesforce Inc.'],['ADBE','Adobe Inc.']] },
  { name: 'Healthcare', description: 'Pharmaceuticals, biotechnology, medical devices, and health services', icon_name: 'heart-pulse',
    stocks: [['JNJ','Johnson & Johnson'],['UNH','UnitedHealth Group'],['PFE','Pfizer Inc.'],['ABBV','AbbVie Inc.'],['MRK','Merck & Co.'],['LLY','Eli Lilly and Company'],['TMO','Thermo Fisher Scientific'],['ABT','Abbott Laboratories'],['DHR','Danaher Corporation'],['BMY','Bristol-Myers Squibb']] },
  { name: 'Finance', description: 'Banks, insurance companies, investment firms, and financial services', icon_name: 'landmark',
    stocks: [['JPM','JPMorgan Chase & Co.'],['BAC','Bank of America Corp.'],['GS','Goldman Sachs Group'],['MS','Morgan Stanley'],['WFC','Wells Fargo & Co.'],['C','Citigroup Inc.'],['BLK','BlackRock Inc.'],['SCHW','Charles Schwab Corp.'],['AXP','American Express Co.'],['USB','U.S. Bancorp']] },
  { name: 'Energy', description: 'Oil, gas, renewable energy, and energy infrastructure', icon_name: 'zap',
    stocks: [['XOM','Exxon Mobil Corporation'],['CVX','Chevron Corporation'],['COP','ConocoPhillips'],['SLB','Schlumberger Limited'],['EOG','EOG Resources Inc.'],['MPC','Marathon Petroleum Corp.'],['PSX','Phillips 66'],['VLO','Valero Energy Corp.'],['OXY','Occidental Petroleum'],['HAL','Halliburton Company']] },
  { name: 'Consumer Discretionary', description: 'Retail, automotive, entertainment, and luxury goods', icon_name: 'shopping-cart',
    stocks: [['AMZN','Amazon.com Inc.'],['TSLA','Tesla Inc.'],['HD','The Home Depot Inc.'],['NKE','Nike Inc.'],['MCD',"McDonald's Corporation"],['SBUX','Starbucks Corporation'],['LOW',"Lowe's Companies Inc."],['TJX','TJX Companies Inc.'],['BKNG','Booking Holdings Inc.'],['CMG','Chipotle Mexican Grill']] },
  { name: 'Industrials', description: 'Aerospace, defense, machinery, and industrial conglomerates', icon_name: 'factory',
    stocks: [['CAT','Caterpillar Inc.'],['BA','Boeing Company'],['HON','Honeywell International'],['UPS','United Parcel Service'],['RTX','RTX Corporation'],['DE','Deere & Company'],['LMT','Lockheed Martin Corp.'],['GE','GE Aerospace'],['MMM','3M Company'],['FDX','FedEx Corporation']] },
  { name: 'Utilities', description: 'Electric, gas, water utilities and renewable energy providers', icon_name: 'lightbulb',
    stocks: [['NEE','NextEra Energy Inc.'],['DUK','Duke Energy Corporation'],['SO','Southern Company'],['D','Dominion Energy Inc.'],['AEP','American Electric Power'],['EXC','Exelon Corporation'],['SRE','Sempra Energy'],['XEL','Xcel Energy Inc.'],['WEC','WEC Energy Group'],['ED','Consolidated Edison']] },
  { name: 'Materials', description: 'Chemicals, metals, mining, and construction materials', icon_name: 'gem',
    stocks: [['LIN','Linde plc'],['APD','Air Products & Chemicals'],['SHW','Sherwin-Williams Co.'],['FCX','Freeport-McMoRan Inc.'],['NEM','Newmont Corporation'],['ECL','Ecolab Inc.'],['DOW','Dow Inc.'],['NUE','Nucor Corporation'],['DD','DuPont de Nemours'],['VMC','Vulcan Materials Co.']] },
  { name: 'Real Estate', description: 'REITs, real estate services, and property development', icon_name: 'building',
    stocks: [['PLD','Prologis Inc.'],['AMT','American Tower Corp.'],['CCI','Crown Castle Inc.'],['EQIX','Equinix Inc.'],['PSA','Public Storage'],['SPG','Simon Property Group'],['O','Realty Income Corp.'],['WELL','Welltower Inc.'],['DLR','Digital Realty Trust'],['AVB','AvalonBay Communities']] },
  { name: 'Communication Services', description: 'Telecom, media, entertainment, and interactive services', icon_name: 'radio',
    stocks: [['GOOG','Alphabet Inc. Class C'],['DIS','Walt Disney Company'],['NFLX','Netflix Inc.'],['CMCSA','Comcast Corporation'],['T','AT&T Inc.'],['VZ','Verizon Communications'],['TMUS','T-Mobile US Inc.'],['CHTR','Charter Communications'],['EA','Electronic Arts Inc.'],['TTWO','Take-Two Interactive']] },
  { name: 'Consumer Staples', description: 'Food, beverages, household products, and personal care', icon_name: 'package',
    stocks: [['PG','Procter & Gamble Co.'],['KO','Coca-Cola Company'],['PEP','PepsiCo Inc.'],['COST','Costco Wholesale Corp.'],['WMT','Walmart Inc.'],['PM','Philip Morris Intl.'],['MO','Altria Group Inc.'],['CL','Colgate-Palmolive Co.'],['KMB','Kimberly-Clark Corp.'],['GIS','General Mills Inc.']] },
];

/** Generate realistic random stock data for mock/demo mode */
function randomStockData() {
  const basePrice = randomFloat(50, 500);
  const prevClose = basePrice * (1 + (secureRandom() - 0.5) * 0.02);
  const volume = randomInteger(1e6, 5e7);
  return {
    market_cap: randomInteger(1e10, 2e12),
    current_price: +basePrice.toFixed(4),
    previous_close: +prevClose.toFixed(4),
    day_change_pct: +(((basePrice - prevClose) / prevClose) * 100).toFixed(4),
    volume,
    avg_volume: Math.floor(volume * randomFloat(0.7, 1.3)),
    pe_ratio: +randomFloat(10, 50).toFixed(4),
    eps: +randomFloat(1, 21).toFixed(4),
    eps_growth_yoy: +randomFloat(-10, 40).toFixed(4),
    dividend_yield: +randomFloat(0, 5).toFixed(4),
    beta: +randomFloat(0.5, 2.0).toFixed(4),
    fifty_two_week_high: +(basePrice * randomFloat(1.1, 1.5)).toFixed(4),
    fifty_two_week_low: +(basePrice * randomFloat(0.5, 0.8)).toFixed(4),
    rsi_14: +randomFloat(20, 80).toFixed(4),
    ma_50: +(basePrice * randomFloat(0.95, 1.05)).toFixed(4),
    ma_200: +(basePrice * randomFloat(0.9, 1.05)).toFixed(4),
  };
}

const STOCK_INSERT = `INSERT INTO stocks (
  symbol, company_name, sector_id, market_cap, current_price,
  previous_close, day_change_pct, volume, avg_volume, pe_ratio,
  eps, eps_growth_yoy, dividend_yield, beta, fifty_two_week_high,
  fifty_two_week_low, rsi_14, ma_50, ma_200, composite_score, last_updated
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,0,NOW())
ON CONFLICT (symbol) DO UPDATE SET
  company_name=$2, sector_id=$3, market_cap=$4, current_price=$5,
  previous_close=$6, day_change_pct=$7, volume=$8, avg_volume=$9,
  pe_ratio=$10, eps=$11, eps_growth_yoy=$12, dividend_yield=$13,
  beta=$14, fifty_two_week_high=$15, fifty_two_week_low=$16,
  rsi_14=$17, ma_50=$18, ma_200=$19, last_updated=NOW()`;

const PRICE_INSERT = `INSERT INTO price_history (stock_id, date, open, high, low, close, volume)
  VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`;

export async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const sector of SECTORS) {
      const { rows: [{ id: sectorId }] } = await client.query(
        `INSERT INTO sectors (name, description, icon_name)
         VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET description = $2, icon_name = $3
         RETURNING id`,
        [sector.name, sector.description, sector.icon_name]
      );

      for (const [symbol, companyName] of sector.stocks) {
        const d = randomStockData();
        await client.query(STOCK_INSERT, [
          symbol, companyName, sectorId,
          d.market_cap, d.current_price, d.previous_close, d.day_change_pct,
          d.volume, d.avg_volume, d.pe_ratio, d.eps, d.eps_growth_yoy,
          d.dividend_yield, d.beta, d.fifty_two_week_high, d.fifty_two_week_low,
          d.rsi_14, d.ma_50, d.ma_200,
        ]);

        const { rows: [{ id: stockId }] } = await client.query(
          'SELECT id FROM stocks WHERE symbol = $1', [symbol]
        );

        // Generate 30 days of price history
        let price = d.current_price;
        for (let i = 30; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          price *= 1 + (secureRandom() - 0.48) * 0.03;
          await client.query(PRICE_INSERT, [
            stockId, date.toISOString().split('T')[0],
            +(price * (1 + (secureRandom() - 0.5) * 0.01)).toFixed(4),
            +(price * (1 + secureRandom() * 0.02)).toFixed(4),
            +(price * (1 - secureRandom() * 0.02)).toFixed(4),
            +price.toFixed(4),
            Math.floor(d.avg_volume * (0.5 + secureRandom())),
          ]);
        }
      }
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow running as standalone script
if (require.main === module) {
  seed()
    .then(() => pool.end())
    .catch(() => process.exit(1));
}

describe('Stock Market Dashboard - Main Flow', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/top-stocks', {
      statusCode: 200,
      body: [
        {
          sector_id: 1, sector_name: 'Technology', icon_name: 'cpu',
          id: 1, symbol: 'AAPL', company_name: 'Apple Inc.',
          current_price: 185.50, day_change_pct: 2.35,
          composite_score: 85, score_breakdown: {},
          last_updated: new Date().toISOString(),
        },
      ],
    }).as('getTopStocks');

    cy.intercept('GET', '/api/sectors/Technology/top-stocks*', {
      statusCode: 200,
      body: {
        sector: { id: 1, name: 'Technology', description: 'Tech companies', icon_name: 'cpu' },
        stocks: [
          {
            id: 1, symbol: 'AAPL', company_name: 'Apple Inc.', sector_id: 1,
            current_price: 185.50, day_change_pct: 2.35, volume: 55000000,
            pe_ratio: 29.5, rsi_14: 55, composite_score: 85, score_breakdown: {},
            market_cap: 2800000000000, avg_volume: 50000000, previous_close: 183,
            eps: 6.28, eps_growth_yoy: 12.3, dividend_yield: 0.52, beta: 1.28,
            fifty_two_week_high: 199, fifty_two_week_low: 124, ma_50: 178, ma_200: 165,
            last_updated: new Date().toISOString(),
          },
        ],
      },
    }).as('getSectorStocks');

    cy.intercept('GET', '/api/stocks/AAPL', {
      statusCode: 200,
      body: {
        id: 1, symbol: 'AAPL', company_name: 'Apple Inc.', sector_id: 1,
        sector_name: 'Technology', current_price: 185.50, day_change_pct: 2.35,
        composite_score: 85, market_cap: 2800000000000, pe_ratio: 29.5,
        eps: 6.28, eps_growth_yoy: 12.3, dividend_yield: 0.52, beta: 1.28,
        volume: 55000000, avg_volume: 50000000, previous_close: 183,
        fifty_two_week_high: 199, fifty_two_week_low: 124, rsi_14: 55,
        ma_50: 178, ma_200: 165,
        score_breakdown: {
          intraday_change: 90, volume_ratio: 75, rsi: 80, price_vs_ma50: 70,
          price_vs_ma200: 65, pe_ratio: 60, eps_growth: 85, week52_position: 72,
          market_cap: 95, dividend_yield: 30,
        },
        last_updated: new Date().toISOString(),
      },
    }).as('getStockDetail');

    cy.intercept('GET', '/api/stocks/AAPL/price-history*', {
      statusCode: 200,
      body: [
        { date: '2024-01-15', open: 180, high: 186, low: 179, close: 185, volume: 5000000 },
        { date: '2024-01-16', open: 185, high: 188, low: 184, close: 187, volume: 4500000 },
      ],
    }).as('getPriceHistory');
  });

  it('loads landing page and displays sector cards', () => {
    cy.visit('/');
    cy.wait('@getTopStocks');
    cy.contains('Market Overview').should('be.visible');
    cy.contains('Technology').should('be.visible');
    cy.contains('AAPL').should('be.visible');
  });

  it('navigates to sector detail and shows stock table', () => {
    cy.visit('/');
    cy.wait('@getTopStocks');
    cy.contains('Technology').click();
    cy.wait('@getSectorStocks');
    cy.contains('Top 10 Stocks').should('be.visible');
    cy.contains('AAPL').should('be.visible');
  });

  it('navigates to stock detail and shows chart and metrics', () => {
    cy.visit('/stocks/AAPL');
    cy.wait('@getStockDetail');
    cy.wait('@getPriceHistory');
    cy.contains('AAPL').should('be.visible');
    cy.contains('Apple Inc.').should('be.visible');
    cy.contains('$185.50').should('be.visible');
    cy.contains('Key Metrics').should('be.visible');
  });

  it('full flow: landing → sector → stock detail', () => {
    cy.visit('/');
    cy.wait('@getTopStocks');

    // Click sector card
    cy.contains('Technology').click();
    cy.wait('@getSectorStocks');
    cy.contains('Top 10 Stocks').should('be.visible');

    // Click stock row
    cy.contains('tr', 'AAPL').click();
    cy.wait('@getStockDetail');
    cy.wait('@getPriceHistory');

    // Verify detail page
    cy.contains('Key Metrics').should('be.visible');
    cy.contains('Score Breakdown').should('be.visible');
  });
});

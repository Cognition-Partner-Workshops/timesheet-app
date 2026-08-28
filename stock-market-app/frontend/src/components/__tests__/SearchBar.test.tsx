import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { SearchBar } from '../SearchBar';

vi.mock('../../services/api', () => ({
  searchStocks: vi.fn().mockResolvedValue([
    { symbol: 'AAPL', company_name: 'Apple Inc.', current_price: 185, day_change_pct: 1.5, composite_score: 85, sector_name: 'Technology' },
  ]),
}));

describe('SearchBar', () => {
  test('renders search input', () => {
    render(
      <BrowserRouter>
        <SearchBar />
      </BrowserRouter>
    );
    expect(screen.getByPlaceholderText('Search ticker or company...')).toBeDefined();
  });

  test('accepts user input', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SearchBar />
      </BrowserRouter>
    );
    const input = screen.getByPlaceholderText('Search ticker or company...');
    await user.type(input, 'AAPL');
    expect(input).toHaveValue('AAPL');
  });
});

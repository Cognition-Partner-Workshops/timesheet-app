import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StockTable } from '../StockTable';
import { MOCK_STOCKS } from './fixtures';

vi.mock('../../services/api', () => ({
  fetchPriceHistory: vi.fn().mockResolvedValue([]),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('StockTable', () => {
  test('renders table with column headers', () => {
    renderWithProviders(<StockTable stocks={MOCK_STOCKS} />);
    expect(screen.getByText('Rank')).toBeDefined();
    expect(screen.getByText('Ticker')).toBeDefined();
    expect(screen.getByText('Company')).toBeDefined();
    expect(screen.getByText('Price')).toBeDefined();
    expect(screen.getByText('Score')).toBeDefined();
  });

  test('renders stock rows with correct data', () => {
    renderWithProviders(<StockTable stocks={MOCK_STOCKS} />);
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.getByText('MSFT')).toBeDefined();
    expect(screen.getByText('$185.50')).toBeDefined();
    expect(screen.getByText('$405.20')).toBeDefined();
  });

  test('displays correct rank numbers', () => {
    renderWithProviders(<StockTable stocks={MOCK_STOCKS} />);
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });
});

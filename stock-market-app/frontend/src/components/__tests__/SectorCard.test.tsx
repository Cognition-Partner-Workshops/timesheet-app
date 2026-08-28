import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SectorCard } from '../SectorCard';
import { MOCK_TOP_STOCK } from './fixtures';

describe('SectorCard', () => {
  test('renders sector name and stock info', () => {
    render(
      <BrowserRouter>
        <SectorCard stock={MOCK_TOP_STOCK} />
      </BrowserRouter>
    );
    expect(screen.getByText('Technology')).toBeDefined();
    expect(screen.getByText('AAPL')).toBeDefined();
  });

  test('displays current price', () => {
    render(
      <BrowserRouter>
        <SectorCard stock={MOCK_TOP_STOCK} />
      </BrowserRouter>
    );
    expect(screen.getByText('$185.50')).toBeDefined();
  });

  test('shows composite score', () => {
    render(
      <BrowserRouter>
        <SectorCard stock={MOCK_TOP_STOCK} />
      </BrowserRouter>
    );
    expect(screen.getByText('85')).toBeDefined();
  });
});

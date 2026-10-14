import axios from 'axios';
import type { Sector, Stock, PriceHistory, TopStock, SectorDetail, SearchResult } from '../types';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Network error';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

export async function fetchSectors(): Promise<Sector[]> {
  const { data } = await api.get<Sector[]>('/sectors');
  return data;
}

export async function fetchTopStocks(): Promise<TopStock[]> {
  const { data } = await api.get<TopStock[]>('/top-stocks');
  return data;
}

export async function fetchSectorTopStocks(sectorName: string, limit = 10): Promise<SectorDetail> {
  const { data } = await api.get<SectorDetail>(`/sectors/${encodeURIComponent(sectorName)}/top-stocks`, {
    params: { limit },
  });
  return data;
}

export async function fetchStockDetail(symbol: string): Promise<Stock> {
  const { data } = await api.get<Stock>(`/stocks/${symbol.toUpperCase()}`);
  return data;
}

export async function fetchPriceHistory(symbol: string, range = '7d'): Promise<PriceHistory[]> {
  const { data } = await api.get<PriceHistory[]>(`/stocks/${symbol.toUpperCase()}/price-history`, {
    params: { range },
  });
  return data;
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  const { data } = await api.get<SearchResult[]>('/search', {
    params: { q: query },
  });
  return data;
}

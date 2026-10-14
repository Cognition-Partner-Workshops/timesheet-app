import { useQuery } from '@tanstack/react-query';
import { fetchPriceHistory } from '../services/api';

export function usePriceHistory(symbol: string, range = '7d') {
  return useQuery({
    queryKey: ['price-history', symbol, range],
    queryFn: () => fetchPriceHistory(symbol, range),
    enabled: !!symbol,
    staleTime: 2 * 60 * 1000,
  });
}

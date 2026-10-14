import { useQuery } from '@tanstack/react-query';
import { fetchStockDetail } from '../services/api';

export function useStockDetail(symbol: string) {
  return useQuery({
    queryKey: ['stock-detail', symbol],
    queryFn: () => fetchStockDetail(symbol),
    enabled: !!symbol,
    staleTime: 2 * 60 * 1000,
  });
}

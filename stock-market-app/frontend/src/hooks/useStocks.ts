import { useQuery } from '@tanstack/react-query';
import { fetchTopStocks, fetchSectorTopStocks } from '../services/api';

export function useTopStocks() {
  return useQuery({
    queryKey: ['top-stocks'],
    queryFn: fetchTopStocks,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSectorStocks(sectorName: string, limit = 10) {
  return useQuery({
    queryKey: ['sector-stocks', sectorName, limit],
    queryFn: () => fetchSectorTopStocks(sectorName, limit),
    enabled: !!sectorName,
    staleTime: 2 * 60 * 1000,
  });
}

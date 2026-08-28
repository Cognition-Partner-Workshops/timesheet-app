import { useQuery } from '@tanstack/react-query';
import { fetchSectors } from '../services/api';

export function useSectors() {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: fetchSectors,
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    staleTime: 2 * 60 * 1000,
  });
}

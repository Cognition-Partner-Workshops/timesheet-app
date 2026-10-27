import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

export function useWeeklySummary(weekStart: string) {
  return useQuery({
    queryKey: ['weeklySummary', weekStart],
    queryFn: () => apiClient.getWeeklyReport(weekStart),
  });
}

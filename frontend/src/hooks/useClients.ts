import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { Client } from '../types/api';

export const useClients = () =>
  useQuery<{ clients: Client[] }>({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type {
  Client,
  CreateProjectRequest,
  ProjectStatus,
  UpdateProjectRequest,
} from '../types/api';

export const PROJECTS_QUERY_KEY = ['projects'] as const;

export const useProjects = (filters: { clientId?: number; status?: ProjectStatus } = {}) =>
  useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, filters],
    queryFn: () => apiClient.getProjects(filters),
    select: (data) => data.projects,
  });

export const useProjectClients = () =>
  useQuery({
    queryKey: ['clients'],
    queryFn: (): Promise<{ clients: Client[] }> => apiClient.getClients(),
    select: (data) => data.clients,
  });

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectRequest) => apiClient.createProject(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectRequest }) =>
      apiClient.updateProject(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
  });
};

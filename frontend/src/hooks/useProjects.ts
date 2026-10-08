import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { CreateProjectRequest, UpdateProjectRequest } from '../types/api';

export const projectsQueryKey = ['projects'] as const;

export const useProjects = () =>
  useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => apiClient.getProjects(),
  });

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectRequest) => apiClient.createProject(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectRequest }) => apiClient.updateProject(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.deleteProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
  });
};

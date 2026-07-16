import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (email: string, password: string) =>
  api.post('/api/auth/login', { email, password });

export const register = (data: any) =>
  api.post('/api/auth/register', data);

// Dashboard
export const getDashboardStats = () =>
  api.get('/api/dashboard/stats');

// Users
export const getUsers = (role?: string) =>
  api.get('/api/users/', { params: role ? { role } : {} });

export const getUser = (id: number) =>
  api.get(`/api/users/${id}`);

// Interviews
export const getInterviews = (params?: any) =>
  api.get('/api/interviews/', { params });

export const getInterview = (id: number) =>
  api.get(`/api/interviews/${id}`);

export const createInterview = (data: any) =>
  api.post('/api/interviews/', data);

export const updateInterview = (id: number, data: any) =>
  api.put(`/api/interviews/${id}`, data);

export const deleteInterview = (id: number) =>
  api.delete(`/api/interviews/${id}`);

// Questions
export const getQuestions = (params?: any) =>
  api.get('/api/questions/', { params });

export const getQuestion = (id: number) =>
  api.get(`/api/questions/${id}`);

export const createQuestion = (data: any) =>
  api.post('/api/questions/', data);

export const updateQuestion = (id: number, data: any) =>
  api.put(`/api/questions/${id}`, data);

export const deleteQuestion = (id: number) =>
  api.delete(`/api/questions/${id}`);

// Feedback
export const getFeedbacks = (interviewId?: number) =>
  api.get('/api/feedback/', { params: interviewId ? { interview_id: interviewId } : {} });

export const createFeedback = (data: any) =>
  api.post('/api/feedback/', data);

// Code
export const runCode = (language: string, code: string) =>
  api.post('/api/code/run', { language, code });

export const submitCode = (data: any) =>
  api.post('/api/code/submit', data);

export const getSubmissions = (interviewId: number) =>
  api.get(`/api/code/submissions/${interviewId}`);

// Users (create)
export const createUser = (data: any) =>
  api.post('/api/users/', data);

// Panels
export const getPanels = () =>
  api.get('/api/panels/');

export const getPanel = (id: number) =>
  api.get(`/api/panels/${id}`);

export const createPanel = (data: any) =>
  api.post('/api/panels/', data);

export const updatePanel = (id: number, data: any) =>
  api.put(`/api/panels/${id}`, data);

export const deletePanel = (id: number) =>
  api.delete(`/api/panels/${id}`);

export default api;

export const apiClient = {
  // Auth
  login: vi.fn(),
  getCurrentUser: vi.fn(),

  // Clients
  getClients: vi.fn(),
  getClient: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  deleteAllClients: vi.fn(),

  // Work Entries
  getWorkEntries: vi.fn(),
  getWorkEntry: vi.fn(),
  createWorkEntry: vi.fn(),
  updateWorkEntry: vi.fn(),
  deleteWorkEntry: vi.fn(),

  // Reports
  getClientReport: vi.fn(),
  exportClientReportCsv: vi.fn(),
  exportClientReportPdf: vi.fn(),

  // Health
  healthCheck: vi.fn(),
};

export default apiClient;

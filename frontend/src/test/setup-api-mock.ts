import apiClient from '../api/client';
import { mockClients, mockWorkEntries, mockClientReport } from './mock-data';

export function setupClientsMock(data = mockClients) {
  vi.mocked(apiClient.getClients).mockResolvedValue(data);
}

export function setupWorkEntriesMock(data = mockWorkEntries) {
  vi.mocked(apiClient.getWorkEntries).mockResolvedValue(data);
}

export function setupClientReportMock(data = mockClientReport) {
  vi.mocked(apiClient.getClientReport).mockResolvedValue(data);
}

export function setupEmptyClients() {
  vi.mocked(apiClient.getClients).mockResolvedValue({ clients: [] });
}

export function setupEmptyWorkEntries() {
  vi.mocked(apiClient.getWorkEntries).mockResolvedValue({ workEntries: [] });
}

export function setupPendingClients() {
  vi.mocked(apiClient.getClients).mockReturnValue(new Promise(() => {}));
}

export function setupPendingWorkEntries() {
  vi.mocked(apiClient.getWorkEntries).mockReturnValue(new Promise(() => {}));
}

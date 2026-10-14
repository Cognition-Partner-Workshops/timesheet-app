export const mockClients = {
  clients: [
    {
      id: 1,
      name: 'Acme Corp',
      department: 'Engineering',
      email: 'contact@acme.com',
      description: 'Main client',
      created_at: '2024-01-15T00:00:00.000Z',
      updated_at: '2024-01-15T00:00:00.000Z',
    },
    {
      id: 2,
      name: 'Globex Inc',
      department: null,
      email: null,
      description: null,
      created_at: '2024-02-01T00:00:00.000Z',
      updated_at: '2024-02-01T00:00:00.000Z',
    },
    {
      id: 3,
      name: 'Initech',
      department: 'Finance',
      email: 'info@initech.com',
      description: 'Secondary client',
      created_at: '2024-03-01T00:00:00.000Z',
      updated_at: '2024-03-01T00:00:00.000Z',
    },
  ],
};

export const mockWorkEntries = {
  workEntries: [
    { id: 1, client_id: 1, client_name: 'Acme Corp', hours: 8.5, date: '2024-01-10', description: 'Development work', created_at: '2024-01-10', updated_at: '2024-01-10' },
    { id: 2, client_id: 2, client_name: 'Globex Inc', hours: 10, date: '2024-01-11', description: 'Testing', created_at: '2024-01-11', updated_at: '2024-01-11' },
    { id: 3, client_id: 1, client_name: 'Acme Corp', hours: 6, date: '2024-01-12', description: 'Code review', created_at: '2024-01-12', updated_at: '2024-01-12' },
    { id: 4, client_id: 3, client_name: 'Initech', hours: 12, date: '2024-01-13', description: 'Deployment', created_at: '2024-01-13', updated_at: '2024-01-13' },
    { id: 5, client_id: 2, client_name: 'Globex Inc', hours: 6, date: '2024-01-14', description: 'Bug fixes', created_at: '2024-01-14', updated_at: '2024-01-14' },
  ],
};

export const mockClientReport = {
  client: mockClients.clients[0],
  workEntries: [
    { id: 1, client_id: 1, hours: 5, date: '2024-03-10', description: 'Dev work', created_at: '2024-03-10', updated_at: '2024-03-10' },
    { id: 2, client_id: 1, hours: 3, date: '2024-03-11', description: 'Testing', created_at: '2024-03-11', updated_at: '2024-03-11' },
  ],
  totalHours: 8,
  entryCount: 2,
};

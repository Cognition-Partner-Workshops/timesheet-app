/**
 * Central registry of TanStack Query keys so that queries and the mutations
 * that invalidate them always agree on the same key.
 */
export const queryKeys = {
  clients: ['clients'] as const,
  workEntries: ['workEntries'] as const,
  clientReport: (clientId: number) => ['clientReport', clientId] as const,
};

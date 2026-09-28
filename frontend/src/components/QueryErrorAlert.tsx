import React from 'react';
import { Alert } from '@mui/material';

interface QueryErrorAlertProps {
  /** The `error` value returned by a TanStack `useQuery` call. */
  error: Error | null;
  /** Message shown to the user when the query has failed. */
  message: string;
}

/**
 * Shows an error alert when a data-loading query has failed, and nothing otherwise.
 * Use alongside `useQuery` so a failed fetch is not mistaken for an empty result.
 */
const QueryErrorAlert: React.FC<QueryErrorAlertProps> = ({ error, message }) => {
  if (!error) {
    return null;
  }

  return (
    <Alert severity="error" sx={{ mb: 2 }}>
      {message}
    </Alert>
  );
};

export default QueryErrorAlert;

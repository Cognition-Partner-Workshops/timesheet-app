import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Client } from '../types/api';

interface StartTimerDialogProps {
  open: boolean;
  onClose: () => void;
  onStart: (clientId: number, description?: string) => Promise<void>;
}

const StartTimerDialog: React.FC<StartTimerDialogProps> = ({ open, onClose, onStart }) => {
  const [clientId, setClientId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
    enabled: open,
  });

  const clients: Client[] = clientsData?.clients ?? [];

  const handleStart = async () => {
    if (!clientId) return;
    setIsStarting(true);
    setError(null);
    try {
      await onStart(clientId, description || undefined);
      setClientId('');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start timer';
      setError(message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleClose = () => {
    if (isStarting) return;
    setClientId('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Start Timer</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {clientsLoading ? (
          <CircularProgress />
        ) : clients.length === 0 ? (
          <Alert severity="info">No clients found. Create a client first.</Alert>
        ) : (
          <>
            <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
              <InputLabel id="timer-client-label">Client</InputLabel>
              <Select
                labelId="timer-client-label"
                value={clientId}
                label="Client"
                onChange={(e) => setClientId(e.target.value as number)}
              >
                {clients.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isStarting}>
          Cancel
        </Button>
        <Button
          onClick={handleStart}
          variant="contained"
          disabled={!clientId || isStarting || clientsLoading}
          startIcon={isStarting ? <CircularProgress size={16} /> : null}
        >
          Start
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StartTimerDialog;

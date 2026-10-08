import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { type Client, type CreateClientRequest, type UpdateClientRequest } from '../types/api';
import { centsToInput, formatMoney, parseMoneyInput } from '../utils/money';

const EMPTY_FORM = {
  name: '',
  description: '',
  department: '',
  email: '',
  hourlyRate: '',
  currency: '',
  billingEmail: '',
  billingAddress: '',
  paymentTermsDays: '',
};

const ClientsPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient.getClients(),
  });

  const createMutation = useMutation({
    mutationFn: (clientData: CreateClientRequest) =>
      apiClient.createClient(clientData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to create client');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateClientRequest }) =>
      apiClient.updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to update client');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to delete client');
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => apiClient.deleteAllClients(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to delete all clients');
    },
  });

  const clients = clientsData?.clients || [];

  const handleOpen = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({ 
        name: client.name, 
        description: client.description || '',
        department: client.department || '',
        email: client.email || '',
        hourlyRate: centsToInput(client.hourly_rate_cents),
        currency: client.currency || '',
        billingEmail: client.billing_email || '',
        billingAddress: client.billing_address || '',
        paymentTermsDays: client.payment_terms_days != null ? String(client.payment_terms_days) : '',
      });
    } else {
      setEditingClient(null);
      setFormData(EMPTY_FORM);
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingClient(null);
    setFormData(EMPTY_FORM);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Client name is required');
      return;
    }

    const billing = {
      hourlyRateCents: parseMoneyInput(formData.hourlyRate),
      currency: formData.currency.trim() ? formData.currency.trim().toUpperCase() : null,
      billingEmail: formData.billingEmail || null,
      billingAddress: formData.billingAddress || null,
      paymentTermsDays: formData.paymentTermsDays !== '' ? Number(formData.paymentTermsDays) : null,
    };

    if (editingClient) {
      updateMutation.mutate({
        id: editingClient.id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          department: formData.department || undefined,
          email: formData.email || undefined,
          ...billing,
        },
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        description: formData.description || undefined,
        department: formData.department || undefined,
        email: formData.email || undefined,
        ...billing,
      });
    }
  };

  const handleDelete = (client: Client) => {
    if (window.confirm(`Are you sure you want to delete "${client.name}"?`)) {
      deleteMutation.mutate(client.id);
    }
  };

  const handleDeleteAll = () => {
    if (window.confirm('Are you sure you want to delete ALL clients? This action cannot be undone.')) {
      deleteAllMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Clients</Typography>
        <Box display="flex" gap={2}>
          {clients.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={handleDeleteAll}
              disabled={deleteAllMutation.isPending}
            >
              {deleteAllMutation.isPending ? 'Clearing...' : 'Clear All'}
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Add Client
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Rate</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.length > 0 ? (
                clients.map((client: Client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {client.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {client.department ? (
                        <Typography variant="body2" color="text.secondary">
                          {client.department}
                        </Typography>
                      ) : (
                        <Chip label="-" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {client.email ? (
                        <Typography variant="body2" color="text.secondary">
                          {client.email}
                        </Typography>
                      ) : (
                        <Chip label="-" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {client.description ? (
                        <Typography variant="body2" color="text.secondary">
                          {client.description}
                        </Typography>
                      ) : (
                        <Chip label="No description" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {client.hourly_rate_cents != null
                        ? `${formatMoney(client.hourly_rate_cents, client.currency || 'USD')}/h`
                        : <Chip label="Not set" size="small" variant="outlined" />}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(client.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={() => handleOpen(client)}
                        color="primary"
                        size="small"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDelete(client)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>
                      No clients found. Create your first client to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingClient ? 'Edit Client' : 'Add New Client'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Client Name"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <TextField
              margin="dense"
              label="Department"
              fullWidth
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <TextField
              margin="dense"
              label="Email"
              fullWidth
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <TextField
              margin="dense"
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <Typography variant="subtitle2" sx={{ mt: 2 }}>Billing</Typography>
            <Box display="flex" gap={2}>
              <TextField margin="dense" label="Hourly rate" type="number" inputProps={{ min: 0, step: 0.01 }}
                value={formData.hourlyRate} onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })} disabled={createMutation.isPending || updateMutation.isPending} />
              <TextField margin="dense" label="Currency" placeholder="USD" inputProps={{ maxLength: 3 }}
                value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} disabled={createMutation.isPending || updateMutation.isPending} />
              <TextField margin="dense" label="Payment terms (days)" type="number" inputProps={{ min: 0, max: 365 }}
                value={formData.paymentTermsDays} onChange={(e) => setFormData({ ...formData, paymentTermsDays: e.target.value })} disabled={createMutation.isPending || updateMutation.isPending} />
            </Box>
            <TextField margin="dense" label="Billing email" type="email" fullWidth
              value={formData.billingEmail} onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })} disabled={createMutation.isPending || updateMutation.isPending} />
            <TextField margin="dense" label="Billing address" fullWidth multiline rows={2}
              value={formData.billingAddress} onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })} disabled={createMutation.isPending || updateMutation.isPending} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <CircularProgress size={24} />
              ) : (
                editingClient ? 'Update' : 'Create'
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ClientsPage;

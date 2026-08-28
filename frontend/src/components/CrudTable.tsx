import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Typography,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

export interface ColumnDef<T> {
  label: string;
  render: (item: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface CrudTableProps<T> {
  items: T[];
  columns: ColumnDef<T>[];
  keyField: keyof T;
  emptyMessage: string;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
}

function CrudTable<T>({ items, columns, keyField, emptyMessage, onEdit, onDelete }: CrudTableProps<T>) {
  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((col, i) => (
                <TableCell key={i} align={col.align}>{col.label}</TableCell>
              ))}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length > 0 ? (
              items.map((item) => (
                <TableRow key={String(item[keyField])}>
                  {columns.map((col, i) => (
                    <TableCell key={i} align={col.align}>{col.render(item)}</TableCell>
                  ))}
                  <TableCell align="right">
                    <IconButton onClick={() => onEdit(item)} color="primary" size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => onDelete(item)} color="error" size="small">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default CrudTable;

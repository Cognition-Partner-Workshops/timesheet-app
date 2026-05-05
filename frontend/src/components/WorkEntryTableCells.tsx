import React from 'react';
import { TableCell, Typography, Chip } from '@mui/material';
import { displayLocalDate } from '../utils/dateUtils';

interface WorkEntryTableCellsProps {
  date: string;
  hours: number;
  description?: string | null;
}

const WorkEntryTableCells: React.FC<WorkEntryTableCellsProps> = ({ date, hours, description }) => (
  <>
    <TableCell>
      <Typography variant="body2">
        {displayLocalDate(date)}
      </Typography>
    </TableCell>
    <TableCell>
      <Chip
        label={`${hours} hours`}
        color="primary"
        variant="outlined"
      />
    </TableCell>
    <TableCell>
      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : (
        <Chip label="No description" size="small" variant="outlined" />
      )}
    </TableCell>
  </>
);

export default WorkEntryTableCells;

import React from 'react';
import { Chip, TableCell, Typography } from '@mui/material';
import { formatCalendarDate } from '../utils/date';

interface WorkEntryCellsProps {
  date: string;
  hours: number;
  description?: string | null;
}

const WorkEntryCells: React.FC<WorkEntryCellsProps> = ({ date, hours, description }) => (
  <>
    <TableCell>
      <Typography variant="body2">{formatCalendarDate(date)}</Typography>
    </TableCell>
    <TableCell>
      <Chip label={`${hours} hours`} color="primary" variant="outlined" />
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

export default WorkEntryCells;

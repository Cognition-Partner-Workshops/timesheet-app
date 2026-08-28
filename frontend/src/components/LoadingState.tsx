import React from 'react';
import { Box, CircularProgress } from '@mui/material';

const LoadingState: React.FC = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
    <CircularProgress />
  </Box>
);

export default LoadingState;

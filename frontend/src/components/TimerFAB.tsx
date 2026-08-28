import React, { useState } from 'react';
import {
  Fab,
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Delete as DiscardIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { useTimer } from '../hooks/useTimer';
import StartTimerDialog from './StartTimerDialog';

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const TimerFAB: React.FC = () => {
  const { state, startTimer, stopTimer, discardTimer } = useTimer();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await stopTimer();
    } catch (err) {
      console.error('Failed to stop timer:', err);
    } finally {
      setIsStopping(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    try {
      await discardTimer();
    } catch (err) {
      console.error('Failed to discard timer:', err);
    } finally {
      setIsDiscarding(false);
    }
  };

  if (!state.isRunning) {
    return (
      <>
        <Tooltip title="Start Timer" placement="left">
          <Fab
            color="primary"
            onClick={() => setDialogOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1300,
            }}
          >
            <PlayIcon />
          </Fab>
        </Tooltip>
        <StartTimerDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onStart={startTimer}
        />
      </>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1300,
      }}
    >
      <Collapse in={state.isRunning}>
        <Paper
          elevation={6}
          sx={{
            p: 2,
            borderRadius: 3,
            minWidth: 220,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimerIcon color="error" fontSize="small" />
            <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1 }}>
              {state.timer?.client_name}
            </Typography>
          </Box>
          {state.timer?.description && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {state.timer.description}
            </Typography>
          )}
          <Typography variant="h5" fontFamily="monospace" textAlign="center" sx={{ my: 0.5 }}>
            {formatElapsed(state.elapsedSeconds)}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
            <Tooltip title="Stop & Save">
              <span>
                <IconButton
                  color="error"
                  onClick={handleStop}
                  disabled={isStopping || isDiscarding}
                  size="large"
                >
                  <StopIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Discard">
              <span>
                <IconButton
                  onClick={handleDiscard}
                  disabled={isStopping || isDiscarding}
                  size="large"
                >
                  <DiscardIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Paper>
      </Collapse>
    </Box>
  );
};

export default TimerFAB;

import React, { useEffect } from 'react';
import {
  Box,
  Fab,
  Drawer,
  Typography,
  TextField,
  IconButton,
  Chip,
  Divider,
} from '@mui/material';
import {
  SmartToy as BotIcon,
  Send as SendIcon,
  Close as CloseIcon,
  AutoFixHigh as FixIcon,
} from '@mui/icons-material';
import ChatMessageList from './ChatMessageList';
import { useChat } from '../hooks/useChat';

const SUGGESTED_QUESTIONS = [
  'Why is my data disappearing?',
  'How does authentication work?',
  'Help me fix a report export error',
  'Explain the API rate limiting',
];

const ChatBot: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const {
    messages,
    input,
    setInput,
    isLoading,
    botAvailable,
    messagesEndRef,
    checkBotStatus,
    sendMessage,
    handleKeyPress,
  } = useChat();

  useEffect(() => {
    if (open && botAvailable === null) {
      checkBotStatus();
    }
  }, [open, botAvailable, checkBotStatus]);

  return (
    <>
      <Fab
        color="primary"
        aria-label="chat assistant"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1300,
          display: open ? 'none' : 'flex',
        }}
      >
        <BotIcon />
      </Fab>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 420 }, maxWidth: '100vw' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box
            sx={{
              p: 2,
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <FixIcon />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Issue Assistant
            </Typography>
            <Chip
              label={botAvailable ? 'AI Powered' : 'Basic Mode'}
              size="small"
              sx={{
                bgcolor: botAvailable ? 'success.light' : 'warning.light',
                color: 'white',
                fontSize: '0.7rem',
              }}
            />
            <IconButton color="inherit" onClick={() => setOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, bgcolor: 'grey.50' }}>
            {messages.length === 0 && (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <BotIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  Hi! I can help you understand and fix issues in this application.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Describe your problem or try one of these:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <Chip
                      key={q}
                      label={q}
                      variant="outlined"
                      size="small"
                      onClick={() => setInput(q)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <ChatMessageList
              messages={messages}
              isLoading={isLoading}
              messagesEndRef={messagesEndRef}
            />
          </Box>

          <Divider />

          <Box sx={{ p: 2, bgcolor: 'white' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                size="small"
                placeholder="Describe your issue..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                variant="outlined"
              />
              <IconButton
                color="primary"
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
              >
                <SendIcon />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Powered by Claude AI
            </Typography>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default ChatBot;

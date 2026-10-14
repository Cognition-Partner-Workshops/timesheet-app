import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  AutoFixHigh as FixIcon,
  BugReport as BugIcon,
  Architecture as ArchIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import ChatMessageList from '../components/ChatMessageList';
import { useChat } from '../hooks/useChat';

const QUICK_ACTIONS = [
  { label: 'Diagnose a bug', icon: <BugIcon fontSize="small" />, prompt: 'I have a bug where' },
  { label: 'Suggest a fix', icon: <FixIcon fontSize="small" />, prompt: 'How can I fix the issue with' },
  { label: 'Explain architecture', icon: <ArchIcon fontSize="small" />, prompt: 'Explain how the application handles' },
  { label: 'General help', icon: <HelpIcon fontSize="small" />, prompt: 'Help me understand' },
];

const AssistantPage: React.FC = () => {
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
    checkBotStatus();
  }, [checkBotStatus]);

  return (
    <Box sx={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <BotIcon color="primary" />
        <Typography variant="h5">Issue Assistant</Typography>
        <Chip
          label={botAvailable ? 'AI Powered (Claude)' : 'Basic Mode'}
          size="small"
          color={botAvailable ? 'success' : 'warning'}
          variant="outlined"
        />
      </Box>

      <Paper
        elevation={0}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'grey.200',
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <BotIcon sx={{ fontSize: 64, color: 'primary.light', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              How can I help you today?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
              I can analyze issues in this time tracking application, suggest fixes,
              explain the architecture, and help you debug problems using the codebase,
              database schema, and API knowledge.
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', mb: 4 }}>
              {QUICK_ACTIONS.map((action) => (
                <Card
                  key={action.label}
                  sx={{
                    cursor: 'pointer',
                    width: 180,
                    '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
                    transition: 'all 0.2s',
                  }}
                  onClick={() => setInput(action.prompt)}
                >
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    {action.icon}
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {action.label}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>

            {botAvailable === false && (
              <Paper sx={{ p: 2, bgcolor: 'warning.light', maxWidth: 400, mx: 'auto' }}>
                <Typography variant="body2">
                  Running in basic mode. Set the <code>ANTHROPIC_API_KEY</code> environment
                  variable on the backend to enable full AI-powered analysis.
                </Typography>
              </Paper>
            )}
          </Box>
        )}

        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
          maxWidth="75%"
        />
      </Paper>

      <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Describe your issue or ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isLoading}
          variant="outlined"
          size="small"
        />
        <IconButton
          color="primary"
          onClick={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&:disabled': { bgcolor: 'grey.300' } }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default AssistantPage;

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
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
import apiClient from '../api/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [botStatus, setBotStatus] = useState<{ available: boolean; features: string[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkStatus = async () => {
    try {
      const status = await apiClient.getChatStatus();
      setBotStatus(status);
    } catch {
      setBotStatus({ available: false, features: [] });
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await apiClient.sendChatMessage(text, history);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to get response';
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errMsg}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: 'Diagnose a bug', icon: <BugIcon fontSize="small" />, prompt: 'I have a bug where' },
    { label: 'Suggest a fix', icon: <FixIcon fontSize="small" />, prompt: 'How can I fix the issue with' },
    { label: 'Explain architecture', icon: <ArchIcon fontSize="small" />, prompt: 'Explain how the application handles' },
    { label: 'General help', icon: <HelpIcon fontSize="small" />, prompt: 'Help me understand' },
  ];

  return (
    <Box sx={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column' }}>
      {/* Status Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <BotIcon color="primary" />
        <Typography variant="h5">Issue Assistant</Typography>
        <Chip
          label={botStatus?.available ? 'AI Powered (Claude)' : 'Basic Mode'}
          size="small"
          color={botStatus?.available ? 'success' : 'warning'}
          variant="outlined"
        />
      </Box>

      {/* Messages Area */}
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
              {quickActions.map((action) => (
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

            {botStatus && !botStatus.available && (
              <Paper sx={{ p: 2, bgcolor: 'warning.light', maxWidth: 400, mx: 'auto' }}>
                <Typography variant="body2">
                  Running in basic mode. Set the <code>ANTHROPIC_API_KEY</code> environment
                  variable on the backend to enable full AI-powered analysis.
                </Typography>
              </Paper>
            )}
          </Box>
        )}

        {messages.map((msg, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              mb: 2,
            }}
          >
            <Paper
              elevation={1}
              sx={{
                p: 2,
                maxWidth: '75%',
                bgcolor: msg.role === 'user' ? 'primary.main' : 'white',
                color: msg.role === 'user' ? 'white' : 'text.primary',
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.content}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 1, opacity: 0.7, textAlign: 'right' }}
              >
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Paper>
          </Box>
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Analyzing your issue...
            </Typography>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Paper>

      {/* Input Area */}
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

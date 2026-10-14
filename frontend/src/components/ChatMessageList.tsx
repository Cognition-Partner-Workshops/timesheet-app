import React from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  maxWidth?: string;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isLoading,
  messagesEndRef,
  maxWidth = '85%',
}) => {
  return (
    <>
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
              p: 1.5,
              maxWidth,
              bgcolor: msg.role === 'user' ? 'primary.main' : 'white',
              color: msg.role === 'user' ? 'white' : 'text.primary',
              borderRadius: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {msg.content}
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 0.5, opacity: 0.7, textAlign: 'right' }}
            >
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Paper>
        </Box>
      ))}

      {isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Analyzing...
          </Typography>
        </Box>
      )}

      <div ref={messagesEndRef} />
    </>
  );
};

export default ChatMessageList;

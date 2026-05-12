import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import apiClient from '../api/client';
import { type ChatMessage } from '../components/ChatMessageList';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [botAvailable, setBotAvailable] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkBotStatus = useCallback(async () => {
    try {
      const status = await apiClient.getChatStatus();
      setBotAvailable(status.available);
      return status;
    } catch {
      setBotAvailable(false);
      return { available: false, features: [] };
    }
  }, []);

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
      let content = 'Sorry, something went wrong. Please try again.';

      if (axios.isAxiosError(error) && error.response?.data) {
        const data = error.response.data;
        if (data.fallback && data.response) {
          content = data.response;
        } else if (data.details) {
          content = data.details;
        }
      } else if (error instanceof Error) {
        content = `Sorry, I encountered an error: ${error.message}. Please try again.`;
      }

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content,
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

  return {
    messages,
    input,
    setInput,
    isLoading,
    botAvailable,
    messagesEndRef,
    checkBotStatus,
    sendMessage,
    handleKeyPress,
  };
}

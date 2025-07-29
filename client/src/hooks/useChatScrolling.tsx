// src/components/chat/hooks/useChatScrolling.tsx

import { Message } from '@/lib/models/chat.types';
import { useRef, useEffect } from 'react';

export const useChatScrolling = (messages: Message[]) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return { messagesEndRef, scrollToBottom };
};
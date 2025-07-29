// src/components/chat/AIChatProvider.tsx

import { useChat } from '@/hooks/useChat';
import { AIChatContextType } from '@/lib/models/chat.types';
import React, { createContext, useContext } from 'react';

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

interface AIChatProviderProps {
  children: React.ReactNode;
}

export const AIChatProvider: React.FC<AIChatProviderProps> = ({ children }) => {
  const chatState = useChat();

  return (
    <AIChatContext.Provider value={chatState}>
      {children}
    </AIChatContext.Provider>
  );
};

export const useAIChatContext = (): AIChatContextType => {
  const context = useContext(AIChatContext);
  if (context === undefined) {
    throw new Error('useAIChatContext must be used within an AIChatProvider');
  }
  return context;
};
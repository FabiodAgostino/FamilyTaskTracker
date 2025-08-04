// src/components/chat/ui/ChatButton.tsx

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { ChatButtonProps } from '@/lib/models/chat.types';
import { CHAT_COLORS, CHAT_LABELS } from '@/lib/const/chat.constants';
import { useIsMobile } from '@/hooks/use-mobile';

export const ChatButton: React.FC<ChatButtonProps> = ({ onClick, isVisible, hide }) => {
  const isMobile = useIsMobile();
  
  // Posizionamento originale mobile: bottom-28 right-4
  // Posizionamento desktop: bottom-4 right-4
  const positionClasses = isMobile 
    ? 'fixed bottom-28 right-4 z-50' 
    : 'fixed bottom-4 right-4 z-50';

  return !hide &&(
    
    <div 
      className={`${positionClasses} transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-10 translate-x-3'
      }`}
    >
      <button
        onClick={onClick}
        className="group relative overflow-hidden rounded-full p-2 shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95"
        style={{ 
          background: CHAT_COLORS.primary,
          color: CHAT_COLORS.white
        }}
        aria-label={CHAT_LABELS.buttonAriaLabel}
      >
        {/* Effetto hover */}
        <div className="absolute inset-0 bg-white opacity-0 transition-opacity duration-300 group-hover:opacity-10" />
        
        {/* Icona con animazione */}
        <MessageCircle 
          size={18} 
          className="transition-transform duration-300 group-hover:rotate-12" 
        />
        
        {/* Indicatore notifica */}
        <div 
          className="absolute -top-1 -right-1 h-3 w-3 rounded-full animate-pulse" 
          style={{ backgroundColor: CHAT_COLORS.accent }} 
        />
      </button>
    </div>
  );
};
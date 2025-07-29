import React from 'react';
import { Mic } from 'lucide-react';
import { ChatMessageProps } from '@/lib/models/chat.types';
import { CHAT_COLORS } from '@/lib/const/chat.constants';

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  // 💡 Gestisci i messaggi di sistema separatamente
  if (message.isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-4 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
          {message.text}
        </div>
      </div>
    );
  }

  // Renderizza i normali messaggi utente/assistente
  return (
    <div className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs px-3 py-2 rounded-xl shadow-sm ${
          message.isUser
            ? 'text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
        style={message.isUser ? { 
          background: CHAT_COLORS.primary 
        } : {}}
      >
        <div className="flex items-start space-x-2">
          {message.isVoice && (
            <Mic 
              size={14} 
              className={`mt-1 flex-shrink-0 ${
                message.isUser ? 'text-white opacity-80' : 'text-gray-500'
              }`} 
            />
          )}
          <div className="flex-1">
            <p className="text-sm leading-relaxed">{message.text}</p>
            <p className={`text-xs mt-1 flex items-center ${
              message.isUser ? 'text-white text-opacity-70' : 'text-gray-500'
            }`}>
              {message.isVoice && (
                <span className="mr-1 text-xs">🎤</span>
              )}
              {message.timestamp.toLocaleTimeString('it-IT', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

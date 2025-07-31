import React from 'react';
import { Mic } from 'lucide-react';
import { ChatMessageProps } from '@/lib/models/chat.types';
import { CHAT_COLORS } from '@/lib/const/chat.constants';

/**
 * Componente per visualizzare un singolo messaggio nella chat.
 * Gestisce i messaggi dell'utente, dell'assistente, di sistema e l'indicatore "sta scrivendo".
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isTyping }) => {
  // 1. Indicatore "sta scrivendo..." per l'assistente
  // Se 'isTyping' è true, mostra un'animazione e interrompe l'esecuzione.
  if (isTyping) {
    return (
      <div className="flex justify-start">
        <div className="max-w-xs px-4 py-3 rounded-xl rounded-bl-sm bg-gray-100 text-gray-800">
          <div className="flex items-center justify-center space-x-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }}></span>
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '200ms' }}></span>
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '400ms' }}></span>
          </div>
        </div>
      </div>
    );
  }

  // Destrutturiamo le proprietà del messaggio per un codice più pulito
  const { isSystem, isUser, isVoice, text, timestamp } = message;

  // 2. Messaggi di sistema (es. "Azione completata")
  // Vengono mostrati al centro con uno stile neutro.
  if (isSystem) {
    return (
      <div className="my-2 flex justify-center">
        <div className="rounded-full bg-gray-100 px-4 py-1 text-xs text-gray-500">
          {text}
        </div>
      </div>
    );
  }

  // 3. Logica di rendering per messaggi Utente e Assistente
  // Calcoliamo classi e stili in anticipo per rendere il JSX più leggibile.
  const bubbleAlignment = isUser ? 'justify-end' : 'justify-start';
  const bubbleStyles = isUser
    ? 'rounded-br-sm text-white'
    : 'rounded-bl-sm bg-gray-100 text-gray-800';
  const dynamicBgStyle = isUser ? { background: CHAT_COLORS.primary } : {};
  const iconClasses = isUser ? 'text-white opacity-80' : 'text-gray-500';
  const timestampClasses = isUser ? 'text-white text-opacity-70' : 'text-gray-500';

  return (
    <div className={`flex ${bubbleAlignment}`}>
      <div
        className={`max-w-xs rounded-xl px-3 py-2 shadow-sm ${bubbleStyles}`}
        style={dynamicBgStyle}
      >
        <div className="flex items-start space-x-2">
          {/* Icona opzionale per i messaggi vocali */}
          {isVoice && (
            <Mic size={14} className={`mt-1 flex-shrink-0 ${iconClasses}`} />
          )}

          <div className="flex-1">
            {/* Testo del messaggio */}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>

            {/* Timestamp e indicatore vocale emoji */}
            <p className={`mt-1 flex items-center text-xs ${timestampClasses}`}>
              {isVoice && <span className="mr-1.5">🎤</span>}
              {timestamp.toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
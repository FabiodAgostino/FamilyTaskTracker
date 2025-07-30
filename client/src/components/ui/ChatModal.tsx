import React from 'react';
import { MessageCircle, Send, X, Mic, MicOff, Loader2, Check, XCircle, Sparkles } from 'lucide-react'; // Importa Check e XCircle
import { ChatMessage } from './ChatMessage';
import { useChatScrolling } from '@/hooks/useChatScrolling';
import { CHAT_COLORS, CHAT_LABELS } from '@/lib/const/chat.constants';
import { ChatModalProps } from '@/lib/models/chat.types'; // Assicurati che ChatModalProps sia importato

// Componente VoiceRecorder integrato (rimane invariato)
const VoiceRecorder: React.FC<{
  isRecording: boolean;
  isTranscribing: boolean;
  onStart: () => void;
  onStop: () => void;
}> = ({ isRecording, isTranscribing, onStart, onStop }) => {
  // ... (codice VoiceRecorder esistente)
  if (isTranscribing) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 size={24} className="text-blue-600 animate-spin" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-blue-300 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping animation-delay-200" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Trascrizione in corso...</p>
            <p className="text-xs text-gray-500">Elaborazione del parlato</p>
          </div>
        </div>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative">
            <button
              onClick={onStop}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors duration-200 z-10 relative"
            >
              <MicOff size={24} className="text-white" />
            </button>

            <div className="absolute inset-0 rounded-full bg-red-200 animate-pulse" />
            <div className="absolute -inset-2 rounded-full bg-red-100 animate-ping opacity-75" />
            <div className="absolute -inset-4 rounded-full bg-red-50 animate-ping opacity-50 animation-delay-300" />

            <div className="absolute -inset-6 flex items-center justify-center">
              <div className="flex space-x-1">
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '16px', animationDelay: '0ms' }} />
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '24px', animationDelay: '150ms' }} />
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '20px', animationDelay: '300ms' }} />
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '28px', animationDelay: '450ms' }} />
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '16px', animationDelay: '600ms' }} />
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm font-medium text-red-600">Registrazione in corso...</p>
            <p className="text-xs text-gray-500">Tocca per interrompere</p>
          </div>

          <div className="flex items-end space-x-1 h-8">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="w-1 bg-red-300 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 20 + 8}px`,
                  animationDelay: `${i * 50}ms`,
                  animationDuration: `${800 + Math.random() * 400}ms`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
};


export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  messages,
  isTyping,
  inputText,
  isRecording,
  isTranscribing,
  onInputChange,
  onSendMessage,
  onStartRecording,
  onStopRecording,
  // ⭐ NUOVE PROPS DESTRUTTURATE
  pendingAction,
  onConfirmPendingAction,
  onCancelPendingAction,
  error // Anche l'errore
}) => {
  const { messagesEndRef } = useChatScrolling(messages);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      {/* Overlay scuro */}
      <div
        className="absolute inset-0 bg-black bg-opacity-30 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Container Chat - struttura migliorata */}
      <div
        className="relative w-full max-w-sm mx-4 sm:mb-4 bg-white rounded-t-2xl sm:rounded-2xl shadow-xl transition-all duration-300 transform flex flex-col"
        style={{ height: 'calc(70vh - 2rem)', maxHeight: '500px', bottom:"7vh" }}
      >
        {/* Header Chat - rimane fisso */}
        <div
          className="flex items-center justify-between p-3 rounded-t-2xl text-white flex-shrink-0"
          style={{ background: CHAT_COLORS.primary }}
        >
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
              <Sparkles size={14} />
            </div>
            <div>
              <h3 className="font-medium text-sm">{CHAT_LABELS.assistantName}</h3>
              <p className="text-xs opacity-80">{CHAT_LABELS.statusOnline}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200"
            aria-label={CHAT_LABELS.closeAriaLabel}
          >
            <X size={16} />
          </button>
        </div>

        {/* Area Messaggi o Registrazione Vocale - cresce per riempire spazio */}
        {isRecording || isTranscribing ? (
          <div className="flex-1 flex items-center justify-center">
            <VoiceRecorder
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              onStart={onStartRecording}
              onStop={onStopRecording}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* ⭐ NUOVO BLOCCO PER L'AZIONE PENDENTE */}
            {pendingAction && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg shadow-sm flex flex-col space-y-3 mb-3">
                <p className="font-semibold text-sm">
                  {CHAT_LABELS.actionConfirmationPrompt}
                </p>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={onCancelPendingAction}
                    className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-300 transition-colors duration-200 shadow-sm"
                  >
                    <XCircle size={16} className="mr-1" />
                    {CHAT_LABELS.cancelAction}
                  </button>
                  <button
                    onClick={onConfirmPendingAction}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors duration-200 shadow-md"
                  >
                    <Check size={16} className="mr-1" />
                    {CHAT_LABELS.confirmAction}
                  </button>
                </div>
              </div>
            )}

            {/* Indicatore typing */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            {/* ⭐ Visualizzazione errori (opzionale, ma utile) */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative text-sm mt-2" role="alert">
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area - rimane fisso in basso */}
        {!isRecording && !isTranscribing && (
          <div className="p-3 border-t border-gray-200 flex-shrink-0">
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <textarea
                  value={inputText}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={CHAT_LABELS.inputPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all duration-200 text-sm"
                  style={{
                    borderColor: inputText ? CHAT_COLORS.primaryText : undefined
                  }}
                  rows={1}
                  disabled={isTyping || !!pendingAction} // Disabilita input se c'è un'azione pendente
                />
              </div>

              {/* Pulsante Microfono */}
              <button
                onClick={onStartRecording}
                disabled={isTyping || !!pendingAction} // Disabilita se c'è un'azione pendente
                className="p-2.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 border-2 border-gray-300 hover:border-blue-400 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: isRecording ? '#ef4444' : 'white',
                  color: isRecording ? 'white' : CHAT_COLORS.primaryText
                }}
                aria-label="Registra messaggio vocale"
              >
                <Mic size={16} />
              </button>

              {/* Pulsante Invio */}
              <button
                onClick={onSendMessage}
                disabled={!inputText.trim() || isTyping || !!pendingAction} // Disabilita se c'è un'azione pendente
                className="p-2.5 rounded-full text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: inputText.trim() && !isTyping && !pendingAction
                    ? CHAT_COLORS.primary
                    : CHAT_COLORS.gray[300]
                }}
                aria-label={CHAT_LABELS.sendAriaLabel}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
// src/components/ui/ChatModal.tsx (VERSIONE FINALE con fix al pulsante di stop)

import React from 'react';
import { Send, X, Mic, MicOff, Loader2, XCircle, Sparkles, Phone } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { PiWaveformBold } from 'react-icons/pi';

import { ChatMessage } from './ChatMessage';
import { useChatScrolling } from '@/hooks/useChatScrolling';
import { CHAT_COLORS, CHAT_LABELS } from '@/lib/const/chat.constants';
import { useIsMobile } from '@/hooks/use-mobile';

// =================================================================================
// SEZIONE 1: DEFINIZIONE DELLA UI VOCALE DA INTEGRARE
// =================================================================================

interface EmbeddedVoiceUIProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  onClose: () => void;
}

const PulsingRing: React.FC<{ delay: number; color: string }> = ({ delay, color }) => (
  <motion.div
    className={`absolute inset-0 rounded-full border-2 ${color}`}
    initial={{ scale: 0.5, opacity: 0 }}
    animate={{ scale: 2.2, opacity: [0, 0.7, 0] }}
    transition={{ duration: 3, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut', delay }}
  />
);

const coreVariants: Variants = {
  idle: { scale: 1, boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.08)' },
  listening: { scale: 1.1, boxShadow: '0px 10px 30px rgba(59, 130, 246, 0.3)' },
  speaking: { scale: 1.05, boxShadow: '0px 10px 30px rgba(34, 197, 94, 0.3)' },
  processing: { scale: 1, boxShadow: '0px 10px 30px rgba(249, 115, 22, 0.3)', rotate: [0, 360] },
};

const EmbeddedVoiceUI: React.FC<EmbeddedVoiceUIProps> = ({ isListening, isSpeaking, isProcessing, onClose }) => {
  let statusText = "Tocca per parlare";
  let animationState = 'idle';
  let ringColor = 'border-gray-300';
  let iconColor = 'text-gray-400';

  if (isListening) { statusText = 'Ascoltando...'; animationState = 'listening'; ringColor = 'border-blue-400/80'; iconColor = 'text-blue-500'; }
  else if (isProcessing) { statusText = 'Elaboro...'; animationState = 'processing'; ringColor = 'border-orange-400/80'; iconColor = 'text-orange-500'; }
  else if (isSpeaking) { statusText = 'Sto parlando...'; animationState = 'speaking'; ringColor = 'border-green-400/80'; iconColor = 'text-green-500'; }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 overflow-hidden">
      <div className="relative flex items-center justify-center w-56 h-56">
        {(isListening || isSpeaking) && (
          <>
            <PulsingRing delay={0} color={ringColor} />
            <PulsingRing delay={1} color={ringColor} />
            <PulsingRing delay={2} color={ringColor} />
          </>
        )}
        <motion.div
          className="absolute w-40 h-40 rounded-full bg-white border border-gray-200 flex items-center justify-center"
          variants={coreVariants}
          animate={animationState}
        >
          <PiWaveformBold size={56} className={iconColor} style={{ transition: 'color 0.5s' }} />
        </motion.div>
      </div>
      <motion.p key={statusText} className="mt-8 text-xl font-light text-gray-700 text-center" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {statusText}
      </motion.p>
      <button onClick={onClose} className="mt-auto flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-full text-base font-medium hover:bg-red-700 transition-all duration-300 shadow-lg transform hover:scale-105" aria-label="Termina conversazione">
        <Phone size={20} />
        Termina
      </button>
    </div>
  );
};


// =================================================================================
// SEZIONE 2: COMPONENTI SECONDARI E PRINCIPALE
// =================================================================================

const VoiceRecorder: React.FC<{
  isRecording: boolean;
  isTranscribing: boolean;
  onStart: () => void;
  onStop: () => void;
}> = ({ isRecording, isTranscribing, onStart, onStop }) => {
  if (isTranscribing) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative"><div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center"><Loader2 size={24} className="text-blue-600 animate-spin" /></div><div className="absolute inset-0 rounded-full border-2 border-blue-300 animate-ping" /></div>
          <div className="text-center"><p className="text-sm font-medium text-gray-700">Trascrizione in corso...</p><p className="text-xs text-gray-500">Elaborazione del parlato</p></div>
        </div>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative">
            {/* ✨ BUG FIX QUI: Aggiunto 'relative' per far funzionare z-10 */}
            <button onClick={onStop} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors duration-200 z-10 relative">
              <MicOff size={24} className="text-white" />
            </button>
            <div className="absolute inset-0 rounded-full bg-red-200 animate-pulse" />
          </div>
          <div className="text-center"><p className="text-sm font-medium text-red-600">Registrazione in corso...</p><p className="text-xs text-gray-500">Tocca per interrompere</p></div>
        </div>
      </div>
    );
  }
  return null;
};

export interface ChatModalProps {
  isOpen: boolean; onClose: () => void; messages: any[]; isTyping: boolean; inputText: string; isRecording: boolean; isTranscribing: boolean; onInputChange: (text: string) => void; onSendMessage: () => void; onStartRecording: () => void; onStopRecording: () => void; pendingAction: any; onConfirmPendingAction: () => void; onCancelPendingAction: () => void; error: string | null; isVoiceChatActive: boolean; isListening: boolean; isSpeaking: boolean; isProcessing: boolean; onToggleVoiceChat: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen, onClose, messages, isTyping, inputText, isRecording, isTranscribing, onInputChange, onSendMessage, onStartRecording, onStopRecording, pendingAction, onConfirmPendingAction, onCancelPendingAction, error, isVoiceChatActive, isListening, isSpeaking, isProcessing, onToggleVoiceChat
}) => {
  const { messagesEndRef } = useChatScrolling(messages);
  const isMobile = useIsMobile();

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage(); }
  };

  if (!isOpen) return null;

  const showVoiceChat = isVoiceChatActive;
  const showSingleRecording = !isVoiceChatActive && (isRecording || isTranscribing);
  const showNormalChat = !isVoiceChatActive && !showSingleRecording;

  // Posizionamento originale mobile: items-end justify-center sm:items-center
  // Posizionamento desktop: items-end justify-end
  const containerClasses = isMobile 
    ? 'fixed inset-0 z-40 flex items-end justify-center sm:items-center'
    : 'fixed inset-0 z-40 flex items-end justify-end sm:items-end sm:justify-end';
    
  const modalClasses = isMobile
    ? 'relative w-full max-w-sm mx-4 sm:mb-4 bg-white rounded-t-2xl sm:rounded-2xl shadow-xl transition-all duration-300 transform flex flex-col'
    : 'relative w-full max-w-sm sm:mr-1 bg-white rounded-t-2xl sm:rounded-2xl shadow-xl transition-all duration-300 transform flex flex-col';
    
  const modalStyle = isMobile 
    ? { height: 'calc(70vh - 2rem)', maxHeight: '500px', bottom: "7vh" }
    : { height: 'calc(70vh - 2rem)', maxHeight: '500px' };

  return (
    <div className={containerClasses}>
      <div className="absolute inset-0 bg-black bg-opacity-30 transition-opacity duration-300" onClick={onClose} />
      <div className={modalClasses} style={modalStyle}>
        <div className="flex items-center justify-between p-3 rounded-t-2xl text-white flex-shrink-0" style={{ background: CHAT_COLORS.primary }}>
          <div className="flex items-center space-x-2"><div className="w-6 h-6 rounded-full bg-white bg-opacity-20 flex items-center justify-center"><Sparkles size={14} /></div><div><h3 className="font-medium text-sm">{CHAT_LABELS.assistantName}</h3><p className="text-xs opacity-80">{isVoiceChatActive ? 'Conversazione vocale' : isTyping ? 'Sta scrivendo...' : CHAT_LABELS.statusOnline}</p></div></div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200" aria-label={CHAT_LABELS.closeAriaLabel}><X size={16} /></button>
        </div>
        
        {showVoiceChat && (<EmbeddedVoiceUI isListening={isListening} isSpeaking={isSpeaking} isProcessing={isProcessing} onClose={onToggleVoiceChat} />)}
        {showSingleRecording && (<VoiceRecorder isRecording={isRecording} isTranscribing={isTranscribing} onStart={onStartRecording} onStop={onStopRecording} />)}
        {showNormalChat && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (<ChatMessage key={index} message={msg} />))}
            {isTyping && <ChatMessage message={{id: 'typing', text: '...', isUser: false, timestamp: new Date()}} isTyping />}
            <div ref={messagesEndRef} />
          </div>
        )}

        {showNormalChat && (
          <div className="flex-shrink-0 p-3 border-t border-gray-200 bg-white">
            {error && (<div className="mb-2 p-2 text-xs text-red-700 bg-red-100 rounded-md flex items-center gap-2"><XCircle size={14} /><span>{error}</span></div>)}
            {pendingAction ? (
              <div className="p-2 border border-blue-200 rounded-lg bg-blue-50">
                <p className="text-sm text-blue-800 mb-2">{`Sei sicuro di voler eseguire l'azione?`}</p>
                <div className="flex justify-end space-x-2"><button onClick={onCancelPendingAction} className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Annulla</button><button onClick={onConfirmPendingAction} className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Conferma</button></div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <textarea value={inputText} onChange={(e) => onInputChange(e.target.value)} onKeyPress={handleKeyPress} placeholder="Scrivi un messaggio..." className="w-full h-10 px-3 pr-10 py-2 text-sm border-gray-300 rounded-full focus:ring-blue-500 focus:border-blue-500 transition resize-none" rows={1} />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    {inputText ? (<button onClick={onSendMessage} className="p-2 text-white rounded-full" style={{backgroundColor: CHAT_COLORS.primary}}><Send size={16} /></button>) : (<button onClick={onStartRecording} className="p-2 text-gray-500 hover:text-blue-600"><Mic size={18} /></button>)}
                  </div>
                </div>
                <button onClick={onToggleVoiceChat} className="p-2.5 text-white rounded-full transition-colors bg-cambridge-newStyle" style={{backgroundColor: CHAT_COLORS.primary}} aria-label="Avvia chat vocale">
                  <PiWaveformBold size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
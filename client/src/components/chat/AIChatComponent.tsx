// src/components/chat/AIChatComponent.tsx (CON WAKE WORD GARIBALDI)

import React, { useEffect, useState } from 'react';
import { useButtonVisibility } from '@/hooks/useButtonVisibility';
import { useAuthContext } from '@/contexts/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useGaribaldiWakeWord } from '../../hooks/useWakeWord'; // 🆕 NUOVO HOOK
import { ChatButton } from '../ui/ChatButton';
import { ChatModal } from '../ui/ChatModal';
import { useFirestore } from '@/hooks/useFirestore';
import { ShoppingFood } from '@/lib/models/food';
import { Reminder } from '@/lib/models/reminder';
import { CalendarEvent, Note } from '@/lib/models/types';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ==================== COMPONENTE INDICATORE WAKE WORD ====================
interface WakeWordIndicatorProps {
  isListening: boolean;
  isSupported: boolean;
  hasPermission: boolean | null;
  onToggle: () => void;
  onRequestPermission: () => void;
}

const WakeWordIndicator: React.FC<WakeWordIndicatorProps> = ({ 
  isListening, 
  isSupported, 
  hasPermission, 
  onToggle, 
  onRequestPermission 
}) => {
  if (!isSupported) return null;

  let statusText = '';
  let statusColor = '';
  let icon = <MicOff size={16} />;

  if (hasPermission === null) {
    statusText = 'Permessi richiesti';
    statusColor = 'bg-yellow-500';
    icon = <Volume2 size={16} />;
  } else if (hasPermission === false) {
    statusText = 'Permessi negati';
    statusColor = 'bg-red-500';
    icon = <MicOff size={16} />;
  } else if (isListening) {
    statusText = 'Ascoltando "Garibaldi"';
    statusColor = 'bg-green-500';
    icon = <Mic size={16} />;
  } else {
    statusText = 'Wake word pausa (chat aperta)'; // 🆕 TESTO AGGIORNATO
    statusColor = 'bg-blue-400'; // 🆕 COLORE BLU PER "PAUSA"
    icon = <MicOff size={16} />;
  }

  const handleClick = () => {
    if (hasPermission === false) {
      onRequestPermission();
    } else {
      onToggle();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 left-4 z-30"
    >
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-white text-sm font-medium shadow-lg transition-all duration-300 hover:scale-105 ${statusColor}`}
        title={statusText}
      >
        {icon}
        <span className="hidden sm:inline">{statusText}</span>
        
        {/* Animazione pulsante quando sta ascoltando */}
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-white"
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </button>
    </motion.div>
  );
};

// ==================== COMPONENTE PRINCIPALE ====================
const AIChatComponent: React.FC = () => {
  const isButtonVisible = useButtonVisibility();
  const { user } = useAuthContext();
  
  // ==================== FIRESTORE HOOKS ====================
  const { add: addCalendarEvent } = useFirestore<CalendarEvent>('calendar_events');
  const { add: addReminder } = useFirestore<Reminder>('reminders');
  const { add: addNote } = useFirestore<Note>('notes');
  const { add: addShoppingFood } = useFirestore<ShoppingFood>('shopping_food');

  // ==================== CHAT HOOK ====================
  const {
    // Stati esistenti
    messages,
    isOpen,
    isTyping,
    inputText,
    isRecording,
    isTranscribing,
    isVoiceChatActive,
    isListening,
    isSpeaking,
    isProcessing,
    // Azioni esistenti
    openChat,
    closeChat,
    setInputText,
    handleSendMessage,
    startRecording,
    stopRecording,
    toggleVoiceChat,
    startVoiceChat, // 🆕 Necessario per wake word
    // Smart Assistant
    error,
    pendingAction,
    confirmPendingAction,
    cancelPendingAction,
  } = useChat({
    username: user?.username || 'user',
    enableSmartAssistant: true,
    onAddCalendarEvent: addCalendarEvent,
    onAddReminder: addReminder,
    onAddNote: addNote,
    onAddShoppingFood: addShoppingFood,
  });

  // ==================== WAKE WORD HOOK "GARIBALDI" 🎯 ====================
  const {
    isListeningForWakeWord,
    isSupported: wakeWordSupported,
    hasPermission,
    startListening: startWakeWordListener,
    stopListening: stopWakeWordListener,
    requestPermission
  } = useGaribaldiWakeWord(
    () => {
      // 🚀 CALLBACK QUANDO "GARIBALDI" È RILEVATO
      console.log('🎯 GARIBALDI RILEVATO! Avvio chat vocale...');
      
      // Se la chat non è aperta, aprila
      if (!isOpen) {
        openChat();
      }
      
      // Avvia la chat vocale automaticamente
      setTimeout(() => {
        startVoiceChat();
      }, 500); // Piccolo ritardo per assicurarsi che la chat sia aperta
    },
    !isOpen && !isVoiceChatActive // 🆕 DISABILITA ANCHE QUANDO VOICE CHAT È ATTIVA
  );

  // ==================== GESTIONE STATO WAKE WORD ====================
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);

  const toggleWakeWord = () => {
    if (wakeWordEnabled) {
      stopWakeWordListener();
      setWakeWordEnabled(false);
    } else {
      startWakeWordListener();
      setWakeWordEnabled(true);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      startWakeWordListener();
      setWakeWordEnabled(true);
    }
  };

  // ==================== AUTO-AVVIO WAKE WORD ====================
  useEffect(() => {
    // Avvia automaticamente il wake word quando il componente si monta
    if (wakeWordSupported && hasPermission === true) {
      startWakeWordListener();
      setWakeWordEnabled(true);
    }
  }, [wakeWordSupported, hasPermission, startWakeWordListener]);

  // ==================== CLEANUP ====================
  useEffect(() => {
    return () => {
      // Cleanup quando il componente viene smontato
      stopWakeWordListener();
    };
  }, [stopWakeWordListener]);

  return (
    <>
      {/* ==================== INDICATORE WAKE WORD ====================*/}
      <WakeWordIndicator
        isListening={isListeningForWakeWord}
        isSupported={wakeWordSupported}
        hasPermission={hasPermission}
        onToggle={toggleWakeWord}
        onRequestPermission={handleRequestPermission}
      />

      {/* ==================== PULSANTE CHAT FLOATING ==================== */}
      <ChatButton 
        onClick={openChat}
        isVisible={isButtonVisible}
        hide={isOpen}
      />

      {/* ==================== MODAL CHAT ==================== */}
      <ChatModal
        // Props esistenti (compatibili con ChatModal precedente)
        isOpen={isOpen}
        onClose={closeChat}
        messages={messages}
        isTyping={isTyping}
        inputText={inputText}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        onInputChange={setInputText}
        onSendMessage={handleSendMessage}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onConfirmPendingAction={confirmPendingAction}
        onCancelPendingAction={cancelPendingAction}
        pendingAction={pendingAction}
        error={error}
        // Props chat vocale
        isVoiceChatActive={isVoiceChatActive}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isProcessing={isProcessing}
        onToggleVoiceChat={toggleVoiceChat}
      />

    </>
  );
};

export default AIChatComponent;
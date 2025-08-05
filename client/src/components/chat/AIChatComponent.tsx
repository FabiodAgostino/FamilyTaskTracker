// src/components/chat/AIChatComponent.tsx (CON WAKE WORD GARIBALDI)

import { useEffect, useState } from 'react';
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
import { motion } from 'framer-motion';

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

 

  const handleClick = () => {
    if (hasPermission === false) {
      onRequestPermission();
    } else {
      onToggle();
    }
  };

}
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
    !isOpen && !isVoiceChatActive && !isListening && !isSpeaking && !isProcessing // 🆕 DISABILITA DURANTE QUALSIASI ATTIVITÀ VOCALE
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
    if (wakeWordSupported && hasPermission === true && !isVoiceChatActive) {
      startWakeWordListener();
      setWakeWordEnabled(true);
    }
  }, [wakeWordSupported, hasPermission, startWakeWordListener, isVoiceChatActive]);

  // ==================== GESTIONE CONFLITTI SPEECH RECOGNITION ====================
  useEffect(() => {
    // Ferma il wake word quando la voice chat è attiva
    if (isVoiceChatActive && wakeWordEnabled) {
      console.log('🔄 Voice Chat attiva - sospendo wake word');
      stopWakeWordListener();
    }
    // Riavvia il wake word quando la voice chat si disattiva
    else if (!isVoiceChatActive && !wakeWordEnabled && hasPermission === true && wakeWordSupported) {
      console.log('🔄 Voice Chat disattiva - riattivo wake word');
      setTimeout(() => {
        startWakeWordListener();
        setWakeWordEnabled(true);
      }, 1000); // Delay per evitare conflitti
    }
  }, [isVoiceChatActive, wakeWordEnabled, hasPermission, wakeWordSupported, startWakeWordListener, stopWakeWordListener]);

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
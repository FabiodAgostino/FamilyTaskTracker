// src/components/chat/AIChatComponent.tsx

import React from 'react';
import { useButtonVisibility } from '@/hooks/useButtonVisibility';
import { useAuthContext } from '@/contexts/AuthContext';
import { useChat } from '../../hooks/useChat'; // 🔄 Hook aggiornato
import { ChatButton } from '../ui/ChatButton';
import { ChatModal } from '../ui/ChatModal';
import { useFirestore } from '@/hooks/useFirestore';
import { ShoppingFood } from '@/lib/models/food';
import { Reminder } from '@/lib/models/reminder';
import { CalendarEvent, Note } from '@/lib/models/types';

const AIChatComponent: React.FC = () => {
  const isButtonVisible = useButtonVisibility();
  const { user } = useAuthContext();
  const { add: addCalendarEvent } = useFirestore<CalendarEvent>('calendar_events');
  const { add: addReminder } = useFirestore<Reminder>('reminders');
  const { add: addNote } = useFirestore<Note>('notes');
  const { add: addShoppingFood } = useFirestore<ShoppingFood>('shopping_food'); 
  // ==================== HOOK SMART ASSISTANT ====================
  
  const {
    // 📊 Stati esistenti (compatibili con il tuo codice precedente)
    messages,
    isOpen,
    isTyping,
    inputText,
    isRecording,
    isTranscribing,
    
    // 🆕 Nuovi stati Smart Assistant
    error,
    pendingAction,
    
    // 🔧 Azioni esistenti (compatibili)
    openChat,
    closeChat,
    setInputText,
    handleSendMessage,
    startRecording,
    stopRecording,
    
    // 🆕 Nuove azioni Smart Assistant
    confirmPendingAction,
    cancelPendingAction,
    clearConversation,
    
    toggleSmartAssistant
  } = useChat({
    username: user?.username || 'user',
    enableSmartAssistant: true,
    onAddCalendarEvent: addCalendarEvent,
    onAddReminder: addReminder,
    onAddNote: addNote,
    onAddShoppingFood: addShoppingFood,
  });

  return (
    <>
      {/* ==================== PULSANTE CHAT FLOATING ==================== */}
      <ChatButton 
        onClick={openChat}
        isVisible={isButtonVisible}
      />

      {/* ==================== MODAL CHAT ==================== */}
      <ChatModal
        // 📊 Props esistenti (compatibili con ChatModal precedente)
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
        onCancelPendingAction={cancelPendingAction} pendingAction={pendingAction} error={null}      />
    </>
  );
};

export default AIChatComponent;
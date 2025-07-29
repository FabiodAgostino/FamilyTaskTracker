// src/components/chat/types/chat.types.ts

import { IntegratedChatResponse } from "@/services/integratedChat.service";

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isVoice?: boolean; // Indica se il messaggio è stato creato tramite input vocale
}

export interface ChatState {
  messages: Message[];
  isOpen: boolean;
  isTyping: boolean;
  inputText: string;
  isRecording: boolean; // Nuovo stato per registrazione vocale
  isTranscribing: boolean; // Nuovo stato per trascrizione
}

export interface ChatActions {
  sendMessage: (text: string, isVoice?: boolean) => Promise<void>;
  openChat: () => void;
  closeChat: () => void;
  setInputText: (text: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
}

export interface ChatButtonProps {
  onClick: () => void;
  isVisible: boolean;
}

export interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isTyping: boolean;
  inputText: string;
  isRecording: boolean;
  isTranscribing: boolean;
  onInputChange: (text: string) => void;
  onSendMessage: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  pendingAction: IntegratedChatResponse['actionRequired'] | null;
  onConfirmPendingAction: () => Promise<void>;
  onCancelPendingAction: () => void;
  error: string | null; // Aggiungi anche l'errore per visualizzarlo nella modal
}

export interface ChatMessageProps {
  message: Message;
}

export interface VoiceRecorderProps {
  isRecording: boolean;
  isTranscribing: boolean;
  onStart: () => void;
  onStop: () => void;
}

export interface AIChatContextType extends ChatState, ChatActions {}
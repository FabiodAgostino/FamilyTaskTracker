// src/components/chat/types/chat.types.ts

import { IntegratedChatResponse } from "@/services/integratedChat.service";

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isVoice?: boolean; // Indica se il messaggio è stato creato tramite input vocale
  isSystem?: boolean; 
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
  hide:boolean;
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
  isTyping?: boolean;
}

export interface VoiceRecorderProps {
  isRecording: boolean;
  isTranscribing: boolean;
  onStart: () => void;
  onStop: () => void;
}


export interface SearchCriteria {
  entityType: "shopping_food" | "reminders" | "notes" | "calendar_events";
  searchText?: string;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  filters?: {
    title?: string;
    createdBy?: string;
    isCompleted?: boolean;
    isActive?: boolean;
    category?: string;
    reminderType?: string;
    eventType?: string;
    isPublic?: boolean;
    isPinned?: boolean;
    isAllDay?: boolean;
  };
  limit?: number;
}



export interface DeleteOperation {
  entityType: "shopping_food" | "reminders" | "notes" | "calendar_events";
  searchCriteria: SearchCriteria;
  confirmationRequired: boolean;
  deleteType: "single" | "multiple" | "all_matching";
}

export interface SearchResult {
  id: string;
  title?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  [key: string]: any; // per altri campi specifici del tipo
}

export interface SearchConfig {
  collection: string;
  titleField: string;
  searchableFields: string[];
  dateField: string;
  filterMappings: Record<string, string>;
}

export interface UpdateOperation {
  entityType: "shopping_food" | "reminders" | "notes" | "calendar_events";
  searchCriteria: SearchCriteria;
  updates: {
    // Campi comuni
    title?: string;
    isPublic?: boolean;
    
    // Per Shopping Food
    items?: {
      action: "add" | "remove" | "update";
      items: string[] | { id: string; text: string }[];
    };
    
    // Per Reminders
    scheduledTime?: Date;
    message?: string;
    reminderType?: string;
    isActive?: boolean;
    priority?: "low" | "medium" | "high";
    
    // Per Notes
    content?: string;
    isPinned?: boolean;
    color?: string;
    
    // Per Calendar Events
    startDate?: Date;
    endDate?: Date;
    eventType?: string;
    isAllDay?: boolean;
    reminderMinutes?: number;
    description?: string;
    location?: string;
  };
  confirmationRequired: boolean;
}

export interface AIChatContextType extends ChatState, ChatActions {}
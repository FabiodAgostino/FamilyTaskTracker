// src/components/chat/constants/chat.constants.ts

export const CHAT_COLORS = {
  primary: 'linear-gradient(50deg, #536DFE 0%, #663EF3 100%)',
  primaryText: '#663EF3',
  accent: '#ff6b35',
  white: '#ffffff',
  gray: {
    100: '#f3f4f6',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    800: '#1f2937',
  }
} as const;

export const CHAT_CONFIG = {
  maxHeight: '20rem', // h-80 in Tailwind - più compatto
  buttonPosition: {
    bottom: '7rem', // bottom-28
    right: '1rem',  // right-4
  },
  animations: {
    duration: 300,
    bounce: {
      delay: {
        first: '0ms',
        second: '150ms', 
        third: '300ms'
      }
    }
  }
} as const;

export const AI_RESPONSES = [
  'Interessante domanda! Lascia che ci pensi un momento...',
  'Capisco quello che mi stai chiedendo. Ecco la mia risposta:',
  'Ottima osservazione! Ti posso aiutare con questo.',
  'Grazie per la domanda. Ecco quello che penso:',
  'È un argomento complesso, ma proverò a spiegarti nel modo più chiaro possibile.',
  'Perfetto! Ho proprio quello che fa al caso tuo.',
  'Interessante punto di vista. Lascia che ti spieghi meglio.',
  'Ottima richiesta! Ecco la mia analisi:'
] as const;

export const CHAT_LABELS = {
  buttonAriaLabel: 'Apri chat AI',
  closeAriaLabel: 'Chiudi chat',
  minimizeAriaLabel: 'Minimizza chat',
  sendAriaLabel: 'Invia messaggio',
  voiceAriaLabel: 'Registra messaggio vocale',
  inputPlaceholder: 'Scrivi il tuo messaggio...',
  assistantName: 'Task AI',
  statusOnline: 'Online',
  welcomeMessage: 'Ciao! Sono il tuo Garibaldi. Come posso aiutarti oggi?',
  voiceRecording: 'Registrazione in corso...',
  voiceTranscribing: 'Trascrizione in corso...',
  voiceStopHint: 'Tocca per interrompere',
  voiceProcessing: 'Elaborazione del parlato',
  actionConfirmationPrompt: "Ho rilevato un'azione. Vuoi confermare?",
  confirmAction: "Conferma",
  cancelAction: "Annulla",
} as const;
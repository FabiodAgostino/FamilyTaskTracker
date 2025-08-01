import { useCallback, useEffect, useRef, useState } from 'react';

// ✅ CUSTOM HOOK PER SPEECH SYNTHESIS (no dipendenze esterne!)
export const useSpeechSynthesis = () => {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ✅ CONTROLLA SUPPORTO E CARICA VOCI
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSupported(true);
      
      const loadVoices = () => {
        const availableVoices = speechSynthesis.getVoices();
        setVoices(availableVoices);
      };

      // Carica voci immediatamente
      loadVoices();
      
      // Su alcuni browser le voci si caricano in modo asincrono
      speechSynthesis.onvoiceschanged = loadVoices;
      
      return () => {
        speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // ✅ TROVA LA MIGLIORE VOCE ITALIANA
  const getItalianVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    // Priorità: voci italiane native > voci che contengono "italian" > default
    const italianVoices = voices.filter(voice => 
      voice.lang.startsWith('it-IT') || 
      voice.lang.startsWith('it')
    );
    
    if (italianVoices.length > 0) {
      // Preferisci voci Google/Microsoft se disponibili
      const premiumVoice = italianVoices.find(voice => 
        voice.name.toLowerCase().includes('google')
      );
      
      if (premiumVoice) return premiumVoice;
      return italianVoices[0];
    }

    // Fallback: cerca voci che contengono "italian"
    const italianNameVoices = voices.filter(voice =>
      voice.name.toLowerCase().includes('italian') ||
      voice.name.toLowerCase().includes('italia')
    );
    
    return italianNameVoices.length > 0 ? italianNameVoices[0] : null;
  }, [voices]);

  // ✅ FUNZIONE SPEAK PRINCIPALE
  const speak = useCallback((options: {
    text: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice | null;
    onEnd?: () => void;
    onError?: (error: any) => void;
    onStart?: () => void;
  }) => {
    if (!supported) {
      console.warn('Speech Synthesis non supportato in questo browser');
      options.onError?.('Speech Synthesis non supportato');
      return;
    }

    if (!options.text.trim()) {
      console.warn('Testo vuoto fornito a Speech Synthesis');
      return;
    }

    // Ferma eventuali sintesi precedenti
    cancel();

    try {
      const utterance = new SpeechSynthesisUtterance(options.text.trim());
      
      // ✅ CONFIGURA VOCE (italiana se possibile)
      const targetVoice = options.voice || getItalianVoice();
      if (targetVoice) {
        utterance.voice = targetVoice;
        console.log(`🗣️ Uso voce: ${targetVoice.name} (${targetVoice.lang})`);
      } else {
        console.log('⚠️ Voce italiana non trovata, uso voce di default');
      }

      // ✅ CONFIGURA PARAMETRI
      utterance.rate = options.rate || 1.3;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      // ✅ EVENT HANDLERS
      utterance.onstart = () => {
        console.log('🔊 Speech Synthesis: Started');
        setSpeaking(true);
        options.onStart?.();
      };

      utterance.onend = () => {
        console.log('✅ Speech Synthesis: Completed');
        setSpeaking(false);
        utteranceRef.current = null;
        options.onEnd?.();
      };

      utterance.onerror = (error) => {
        console.error('❌ Speech Synthesis Error:', error);
        setSpeaking(false);
        utteranceRef.current = null;
        options.onError?.(error);
      };

      utterance.onpause = () => {
        console.log('⏸️ Speech Synthesis: Paused');
      };

      utterance.onresume = () => {
        console.log('▶️ Speech Synthesis: Resumed');
      };

      // ✅ SALVA RIFERIMENTO E INIZIA SINTESI
      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('❌ Speech Synthesis Exception:', error);
      setSpeaking(false);
      options.onError?.(error);
    }
  }, [supported, getItalianVoice]);

  // ✅ FUNZIONE CANCEL
  const cancel = useCallback(() => {
    if (supported) {
      speechSynthesis.cancel();
      setSpeaking(false);
      utteranceRef.current = null;
      console.log('🛑 Speech Synthesis: Cancelled');
    }
  }, [supported]);

  // ✅ FUNZIONE PAUSE
  const pause = useCallback(() => {
    if (supported && speaking) {
      speechSynthesis.pause();
      console.log('⏸️ Speech Synthesis: Paused');
    }
  }, [supported, speaking]);

  // ✅ FUNZIONE RESUME
  const resume = useCallback(() => {
    if (supported) {
      speechSynthesis.resume();
      console.log('▶️ Speech Synthesis: Resumed');
    }
  }, [supported]);

  // ✅ CLEANUP AUTOMATICO
  useEffect(() => {
    return () => {
      if (supported && speaking) {
        speechSynthesis.cancel();
      }
    };
  }, [supported, speaking]);

  return {
    speak,
    cancel,
    pause,
    resume,
    speaking,
    supported,
    voices,
    getItalianVoice
  };
};

export default useSpeechSynthesis;
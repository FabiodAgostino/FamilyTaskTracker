import { useState, useCallback, useRef } from 'react';

interface VoiceChatConfig {
  ttsEndpoint: string; // Il tuo endpoint Google Cloud TTS
  onTranscript?: (text: string) => void;
  onTTSStart?: () => void;
  onTTSEnd?: () => void;
  onError?: (error: string) => void;
}

export const useVoiceChat = (config: VoiceChatConfig) => {
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  // 👇 MODIFICA QUI: Sostituisci NodeJS.Timeout con number
  const processingTimeoutRef = useRef<number | null>(null);
  // Funzione per iniziare l'ascolto
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      config.onError?.('Speech Recognition non supportato');
      return;
    }

    // Ferma riconoscimento precedente
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'it-IT';

    recognition.onstart = () => {
      console.log('🎤 Ascolto iniziato');
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('📝 Trascritto:', transcript);
      
      setIsListening(false);
      setIsProcessing(true);
      
      config.onTranscript?.(transcript);

      // Timeout di sicurezza per il processing
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      
      // La funzione setTimeout del browser restituisce un number
      processingTimeoutRef.current = window.setTimeout(() => {
        setIsProcessing(false);
        if (isVoiceChatActive) {
          startListening(); // Riprova se non arriva risposta
        }
      }, 10000); // 10 secondi di timeout
    };

    recognition.onerror = (event) => {
      console.error('❌ Speech Recognition Error:', event.error);
      setIsListening(false);
      
      if (event.error === 'no-speech') {
        // Nessun parlato rilevato - riprova automaticamente
        if (isVoiceChatActive) {
          setTimeout(() => {
            startListening();
          }, 1000);
        }
      } else {
        config.onError?.(`Errore riconoscimento: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('🏁 Speech Recognition terminato');
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isVoiceChatActive, config]);
  // Converte base64 in blob audio
  const base64ToBlob = useCallback((base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }, []);

  // Funzione per far parlare l'AI
  const speakText = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    setIsSpeaking(true);
    config.onTTSStart?.();

    try {
      console.log('🔊 TTS: Invio richiesta per:', text.substring(0, 50));

      const response = await fetch(config.ttsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text.trim() })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Ferma audio precedente se presente
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          URL.revokeObjectURL(currentAudioRef.current.src);
        }

        // Crea nuovo audio
        const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3');
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        currentAudioRef.current = audio;

        return new Promise((resolve, reject) => {
          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            config.onTTSEnd?.();
            
            // 🎯 RIATTIVA AUTOMATICAMENTE L'ASCOLTO
            if (isVoiceChatActive) {
              setTimeout(() => {
                startListening();
              }, 500); // Piccola pausa prima di riattivare
            }
            
            resolve();
          };
          
          audio.onerror = (err) => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            config.onError?.('Errore riproduzione audio');
            reject(err);
          };
          
          audio.play().catch(reject);
        });
      } else {
        throw new Error(data.error || 'Errore TTS');
      }
    } catch (error) {
      setIsSpeaking(false);
      const errorMessage = error instanceof Error ? error.message : 'Errore TTS';
      config.onError?.(errorMessage);
      console.error('❌ TTS Error:', error);
    }
  }, [config, isVoiceChatActive, base64ToBlob, startListening]); // Aggiunto startListening alle dipendenze



  // Inizia chat vocale
  const startVoiceChat = useCallback(() => {
    console.log('🚀 Avvio chat vocale');
    setIsVoiceChatActive(true);
    startListening();
  }, [startListening]);

  // Ferma chat vocale
  const stopVoiceChat = useCallback(() => {
    console.log('⏹️ Stop chat vocale');
    setIsVoiceChatActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);

    // Ferma riconoscimento
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Ferma audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      URL.revokeObjectURL(currentAudioRef.current.src);
      currentAudioRef.current = null;
    }

    // Cancella timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  // Funzione per rispondere all'utente (chiamata quando l'AI ha una risposta)
  const respondWithVoice = useCallback(async (responseText: string) => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    setIsProcessing(false);
    
    if (isVoiceChatActive && responseText.trim()) {
      await speakText(responseText);
    }
  }, [isVoiceChatActive, speakText]);

  return {
    // Stati
    isVoiceChatActive,
    isListening,
    isSpeaking,
    isProcessing,
    
    // Azioni
    startVoiceChat,
    stopVoiceChat,
    respondWithVoice,
    speakText
  };
};
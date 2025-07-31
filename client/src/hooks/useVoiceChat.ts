import { useState, useCallback, useRef } from 'react';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface VoiceChatConfig {
  ttsEndpoint: string;
  onTranscript?: (text: string) => void;
  onTTSStart?: () => void;
  onTTSEnd?: () => void;
  onError?: (error: string) => void;
  onInfo?: (message: string) => void; // ✅ Aggiunto per notifiche fallback
}

export const useVoiceChat = (config: VoiceChatConfig) => {
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const isVoiceChatActiveRef = useRef(false);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const processingTimeoutRef = useRef<number | null>(null);

  // ✅ USA L'HOOK SPEECH SYNTHESIS ALL'INIZIO
  const { 
    speak: speechSynthesize, 
    cancel: speechCancel, 
    speaking: speechSpeaking,
    supported: speechSupported,
    getItalianVoice
  } = useSpeechSynthesis();

  // ✅ FUNZIONE HELPER PER FALLBACK CON SPEECH SYNTHESIS NATIVO
  const speakWithNativeSynthesis = useCallback(async (text: string, reason: string): Promise<void> => {
    if (!speechSupported) {
      console.error('❌ Speech Synthesis non supportato in questo browser');
      config.onError?.('Sintesi vocale non supportata dal browser');
      setIsSpeaking(false);
      return;
    }

    console.log(`🔄 Fallback a Speech Synthesis nativo (${reason}):`, text.substring(0, 50));
    
    try {
      setIsSpeaking(true);
      config.onTTSStart?.();
      
      speechSynthesize({
        text: text.trim(),
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        voice: getItalianVoice(),
        onStart: () => {
          console.log('🗣️ Speech Synthesis: Avviato');
        },
        onEnd: () => {
          console.log('✅ Speech Synthesis: Completato');
          setIsSpeaking(false);
          config.onTTSEnd?.();
          
          // 🎯 RIATTIVA AUTOMATICAMENTE L'ASCOLTO
          if (isVoiceChatActive) {
            setTimeout(() => {
              startListening();
            }, 500);
          }
        },
        onError: (error) => {
          console.error('❌ Speech Synthesis Error:', error);
          setIsSpeaking(false);
          config.onError?.('Errore sintesi vocale nativa');
        }
      });
      
    } catch (error) {
      console.error('❌ Fallback Speech Synthesis failed:', error);
      setIsSpeaking(false);
      config.onError?.('Errore fallback sintesi vocale');
    }
  }, [speechSynthesize, speechSupported, getItalianVoice, config, isVoiceChatActive]);

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

  // ✅ FUNZIONE speakText CORRETTA CON FALLBACK
  const speakText = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    setIsSpeaking(true);
    config.onTTSStart?.();

    try {
      console.log('🔊 TTS: Tentativo con endpoint cloud:', text.substring(0, 50));

      const response = await fetch(config.ttsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text.trim() })
      });
      // ✅ CONTROLLA SE LA RISPOSTA È OK
      if (!response.ok) {
        console.log(`⚠️ HTTP Error ${response.status}, using native Speech Synthesis`);
        config.onInfo?.(`Servizio cloud non disponibile (${response.status}), uso sintesi nativa`);
        await speakWithNativeSynthesis(text, `HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      
      // ✅ CONTROLLA SUCCESS E GESTISCI QUOTA EXCEEDED
      if (data.success && data.audioContent) {
        console.log('✅ TTS Cloud: Sintesi riuscita');
        
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

        return new Promise((resolve) => {
          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            config.onTTSEnd?.();
            
            // 🎯 RIATTIVA AUTOMATICAMENTE L'ASCOLTO
            if (isVoiceChatActive) {
              setTimeout(() => {
                startListening();
              }, 500);
            }
            
            resolve();
          };
          
          audio.onerror = (err) => {
            console.log('❌ Audio playback failed, using native Speech Synthesis');
            URL.revokeObjectURL(audioUrl);
            // Fallback se anche la riproduzione audio fallisce
            speakWithNativeSynthesis(text, 'audio playback error');
            resolve(); // Non reject, usiamo fallback
          };
          
          audio.play().catch((playError) => {
            console.log('❌ Audio play failed, using native Speech Synthesis:', playError);
            URL.revokeObjectURL(audioUrl);
            // Fallback se play() fallisce
            speakWithNativeSynthesis(text, 'audio play error');
            resolve(); // Non reject, usiamo fallback
          });
        });
        
      } else {
        // ✅ SERVIZIO RISPONDE MA CON ERRORE (quota, etc.)
        const errorReason = data.reason || 'service_error';
        const errorMessage = data.error || 'Errore TTS';
        
        console.log(`⚠️ TTS Cloud fallito: ${errorMessage}`);
        
        if (errorReason === 'QUOTA_EXCEEDED') {
          console.log('📊 Quota mensile raggiunta, uso Speech Synthesis nativo');
          config.onInfo?.('Quota cloud raggiunta, uso sintesi nativa del browser');
        } else {
          console.log('🔄 Servizio TTS non disponibile, uso Speech Synthesis nativo');
          config.onInfo?.('Servizio cloud non disponibile, uso sintesi nativa');
        }
        
        await speakWithNativeSynthesis(text, errorReason);
      }
      
    } catch (error) {
      // ✅ ERRORE RETE/CONNESSIONE - USA FALLBACK
      console.log('🌐 Errore connessione TTS Cloud, uso Speech Synthesis nativo:', error);
      config.onInfo?.('Connessione non disponibile, uso sintesi nativa del browser');
      await speakWithNativeSynthesis(text, 'network error');
    }
  }, [config, isVoiceChatActive, base64ToBlob, startListening, speakWithNativeSynthesis]);

  // Inizia chat vocale
  const startVoiceChat = useCallback(() => {
    console.log('🚀 Avvio chat vocale');
    setIsVoiceChatActive(true);
    isVoiceChatActiveRef.current = true;
    startListening();
  }, [startListening]);

  // ✅ FERMA CHAT VOCALE MIGLIORATA
  const stopVoiceChat = useCallback(() => {
    console.log('⏹️ Stop chat vocale');
    isVoiceChatActiveRef.current = false;
    setIsVoiceChatActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);

    // Ferma riconoscimento
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Ferma audio cloud
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      URL.revokeObjectURL(currentAudioRef.current.src);
      currentAudioRef.current = null;
    }

    // ✅ FERMA ANCHE SPEECH SYNTHESIS NATIVO
    speechCancel();

    // Cancella timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, [speechCancel]);

  // Funzione per rispondere all'utente
  const respondWithVoice = useCallback(async (responseText: string) => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    const cleanText = responseText
      .replace(/[\u{1F000}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .trim();
    
    setIsProcessing(false);
    await speakText(cleanText);
  }, [speakText]);

  // ✅ CONTROLLA SE QUALSIASI TIPO DI SINTESI È ATTIVA
  const isCurrentlySpeaking = isSpeaking || speechSpeaking;

  return {
    // Stati
    isVoiceChatActive,
    isListening,
    isSpeaking: isCurrentlySpeaking, // ✅ Include anche Speech Synthesis nativo
    isProcessing,
    isVoiceChatActiveRef,
    // Azioni
    startVoiceChat,
    stopVoiceChat,
    respondWithVoice,
    speakText,
    // ✅ Nuove info utili
    speechSupported,
    hasCloudTTS: true,
    hasNativeTTS: speechSupported
  };
};
// src/hooks/useVoiceChat.ts (VERSIONE MIGLIORATA - COMPATIBILE CON WAKE WORD)

import { useState, useCallback, useRef } from 'react';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface VoiceChatConfig {
  ttsEndpoint: string;
  onTranscript?: (text: string) => void;
  onTTSStart?: () => void;
  onTTSEnd?: () => void;
  onError?: (error: string) => void;
  onInfo?: (message: string) => void;
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
  const instanceIdRef = useRef(Math.random().toString(36).substr(2, 9)); // 🆕 ID PER DEBUG

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
    const instanceId = instanceIdRef.current;
    
    if (!speechSupported) {
      console.error(`❌ Voice Chat [${instanceId}]: Speech Synthesis non supportato`);
      config.onError?.('Sintesi vocale non supportata dal browser');
      setIsSpeaking(false);
      return;
    }

    console.log(`🔄 Voice Chat [${instanceId}]: Fallback Speech Synthesis (${reason}):`, text.substring(0, 50));
    
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
          console.log(`🗣️ Voice Chat [${instanceId}]: Speech Synthesis avviato`);
        },
        onEnd: () => {
          console.log(`✅ Voice Chat [${instanceId}]: Speech Synthesis completato`);
          setIsSpeaking(false);
          config.onTTSEnd?.();
          
          // 🎯 RIATTIVA AUTOMATICAMENTE L'ASCOLTO SOLO SE VOICE CHAT È ATTIVA
          if (isVoiceChatActiveRef.current) {
            setTimeout(() => {
              startListening();
            }, 500);
          }
        },
        onError: (error) => {
          console.error(`❌ Voice Chat [${instanceId}]: Speech Synthesis Error:`, error);
          setIsSpeaking(false);
          config.onError?.('Errore sintesi vocale nativa');
        }
      });
      
    } catch (error) {
      console.error(`❌ Voice Chat [${instanceId}]: Fallback Speech Synthesis failed:`, error);
      setIsSpeaking(false);
      config.onError?.('Errore fallback sintesi vocale');
    }
  }, [speechSynthesize, speechSupported, getItalianVoice, config]);

  // 🆕 FUNZIONE PER INIZIARE L'ASCOLTO (CON PROTEZIONI)
  const startListening = useCallback(() => {
    const instanceId = instanceIdRef.current;

    // 🚫 NON AVVIARE SE VOICE CHAT NON È ATTIVA
    if (!isVoiceChatActiveRef.current) {
      console.log(`⏸️ Voice Chat [${instanceId}]: Voice chat non attiva, ignoro startListening`);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error(`❌ Voice Chat [${instanceId}]: Speech Recognition non supportato`);
      config.onError?.('Speech Recognition non supportato');
      return;
    }

    // Ferma riconoscimento precedente
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    console.log(`🎤 Voice Chat [${instanceId}]: Avvio ascolto per chat vocale`);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'it-IT';

    recognition.onstart = () => {
      if (!isVoiceChatActiveRef.current) {
        console.log(`⏸️ Voice Chat [${instanceId}]: Voice chat non più attiva, ferma ascolto`);
        recognition.stop();
        return;
      }
      console.log(`✅ Voice Chat [${instanceId}]: Ascolto ATTIVO per chat vocale`);
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      if (!isVoiceChatActiveRef.current) return;
      
      const transcript = event.results[0][0].transcript;
      console.log(`📝 Voice Chat [${instanceId}]: Trascritto:`, transcript);
      
      setIsListening(false);
      setIsProcessing(true);
      
      config.onTranscript?.(transcript);

      // Timeout di sicurezza per il processing
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      
      processingTimeoutRef.current = window.setTimeout(() => {
        if (isVoiceChatActiveRef.current) {
          console.log(`⏰ Voice Chat [${instanceId}]: Timeout processing, riprovo ascolto`);
          setIsProcessing(false);
          startListening(); // Riprova se non arriva risposta
        }
      }, 10000); // 10 secondi di timeout
    };

    recognition.onerror = (event) => {
      console.error(`❌ Voice Chat [${instanceId}]: Speech Recognition Error:`, event.error);
      setIsListening(false);
      
      if (event.error === 'no-speech') {
        // Nessun parlato rilevato - riprova automaticamente SOLO se voice chat è attiva
        if (isVoiceChatActiveRef.current) {
          console.log(`🔄 Voice Chat [${instanceId}]: No-speech, riprovo in 500ms`);
          setTimeout(() => {
            if (isVoiceChatActiveRef.current) {
              startListening();
            }
          }, 500); // 500ms delay per evitare spam
        }
      } else if (event.error === 'aborted') {
        console.log(`⚪ Voice Chat [${instanceId}]: Riconoscimento interrotto (normale)`);
      } else {
        console.warn(`⚠️ Voice Chat [${instanceId}]: Errore riconoscimento ${event.error}`);
        config.onError?.(`Errore riconoscimento: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log(`🏁 Voice Chat [${instanceId}]: Riconoscimento terminato`);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [config]);

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
    const instanceId = instanceIdRef.current;
    
    if (!text.trim()) return;
    
    // 🚫 NON PARLARE SE VOICE CHAT NON È ATTIVA
    if (!isVoiceChatActiveRef.current) {
      console.log(`⏸️ Voice Chat [${instanceId}]: Voice chat non attiva, ignoro speakText`);
      return;
    }

    setIsSpeaking(true);
    config.onTTSStart?.();

    try {
      console.log(`🔊 Voice Chat [${instanceId}]: TTS Cloud tentativo:`, text.substring(0, 50));
      
      var response:Response 
      = await fetch(config.ttsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text.trim() })
      });

      if (!response.ok) {
        console.log(`⚠️ Voice Chat [${instanceId}]: HTTP Error ${response.status}, uso fallback`);
        config.onInfo?.(`Servizio cloud non disponibile (${response.status}), uso sintesi nativa`);
        await speakWithNativeSynthesis(text, `HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      
      if (data.success && data.audioContent) {
        console.log(`✅ Voice Chat [${instanceId}]: TTS Cloud riuscito`);
        
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
            
            // 🎯 RIATTIVA AUTOMATICAMENTE L'ASCOLTO SOLO SE VOICE CHAT È ATTIVA
            if (isVoiceChatActiveRef.current) {
              setTimeout(() => {
                startListening();
              }, 500);
            }
            
            resolve();
          };
          
          audio.onerror = (err) => {
            console.log(`❌ Voice Chat [${instanceId}]: Audio playback failed, uso fallback`);
            URL.revokeObjectURL(audioUrl);
            speakWithNativeSynthesis(text, 'audio playback error');
            resolve(); // Non reject, usiamo fallback
          };
          
          audio.play().catch((playError) => {
            console.log(`❌ Voice Chat [${instanceId}]: Audio play failed, uso fallback:`, playError);
            URL.revokeObjectURL(audioUrl);
            speakWithNativeSynthesis(text, 'audio play error');
            resolve(); // Non reject, usiamo fallback
          });
        });
        
      } else {
        // Servizio risponde ma con errore
        const errorReason = data.reason || 'service_error';
        const errorMessage = data.error || 'Errore TTS';
        
        console.log(`⚠️ Voice Chat [${instanceId}]: TTS Cloud fallito: ${errorMessage}`);
        
        if (errorReason === 'QUOTA_EXCEEDED') {
          console.log(`📊 Voice Chat [${instanceId}]: Quota raggiunta, uso fallback`);
          config.onInfo?.('Quota cloud raggiunta, uso sintesi nativa del browser');
        } else {
          console.log(`🔄 Voice Chat [${instanceId}]: Servizio non disponibile, uso fallback`);
          config.onInfo?.('Servizio cloud non disponibile, uso sintesi nativa');
        }
        
        await speakWithNativeSynthesis(text, errorReason);
      }
      
    } catch (error) {
      console.log(`🌐 Voice Chat [${instanceId}]: Errore rete, uso fallback:`, error);
      config.onInfo?.('Connessione non disponibile, uso sintesi nativa del browser');
      await speakWithNativeSynthesis(text, 'network error');
    }
  }, [config, base64ToBlob, startListening, speakWithNativeSynthesis]);

  // 🆕 AVVIA CHAT VOCALE (MIGLIORATO)
  const startVoiceChat = useCallback(() => {
    const instanceId = instanceIdRef.current;
    console.log(`🚀 Voice Chat [${instanceId}]: Avvio chat vocale`);
    
    setIsVoiceChatActive(true);
    isVoiceChatActiveRef.current = true;
    
    // Piccolo delay per assicurarsi che il wake word si sia disattivato
    setTimeout(() => {
      if (isVoiceChatActiveRef.current) {
        startListening();
      }
    }, 200);
  }, [startListening]);

  // ✅ FERMA CHAT VOCALE (MIGLIORATO)
  const stopVoiceChat = useCallback(() => {
    const instanceId = instanceIdRef.current;
    console.log(`⏹️ Voice Chat [${instanceId}]: Stop chat vocale`);
    
    // Prima ferma tutto
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

    // Ferma speech synthesis nativo
    speechCancel();

    // Cancella timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    console.log(`✅ Voice Chat [${instanceId}]: Chat vocale completamente fermata`);
  }, [speechCancel]);

  // Funzione per rispondere all'utente
  const respondWithVoice = useCallback(async (responseText: string) => {
    const instanceId = instanceIdRef.current;
    
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    const cleanText = responseText
      .replace(/[\u{1F000}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .trim();
    
    console.log(`🎙️ Voice Chat [${instanceId}]: Risposta vocale:`, cleanText.substring(0, 50));
    setIsProcessing(false);
    await speakText(cleanText);
  }, [speakText]);

  // ✅ CONTROLLA SE QUALSIASI TIPO DI SINTESI È ATTIVA
  const isCurrentlySpeaking = isSpeaking || speechSpeaking;

  return {
    // Stati
    isVoiceChatActive,
    isListening,
    isSpeaking: isCurrentlySpeaking,
    isProcessing,
    isVoiceChatActiveRef,
    // Azioni
    startVoiceChat,
    stopVoiceChat,
    respondWithVoice,
    speakText,
    // Info utili
    speechSupported,
    hasCloudTTS: true,
    hasNativeTTS: speechSupported
  };
};
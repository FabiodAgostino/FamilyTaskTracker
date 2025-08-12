// src/hooks/useWakeWord.ts (VERSIONE ULTRA-ROBUSTA - RISOLVE LOOP INFINITO)

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseWakeWordConfig {
  wakeWord?: string;
  onWakeWordDetected?: () => void;
  onError?: (error: string) => void;
  onPermissionDenied?: () => void;
  confidence?: number;
  autoStart?: boolean;
  enabled?: boolean; // 🆕 CONTROLLO DINAMICO ABILITAZIONE
  playConfirmationSound?: boolean; // 🆕 SUONO DI CONFERMA
}

interface UseWakeWordReturn {
  isListeningForWakeWord: boolean;
  isSupported: boolean;
  hasPermission: boolean | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  requestPermission: () => Promise<boolean>;
}

export const useWakeWord = (config: UseWakeWordConfig): UseWakeWordReturn => {
  const {
    wakeWord = 'garibaldi',
    onWakeWordDetected,
    onError,
    onPermissionDenied,
    confidence = 0.7,
    autoStart = false,
    enabled = true, // 🆕 DEFAULT ABILITATO
    playConfirmationSound = true // 🆕 DEFAULT SUONO ATTIVO
  } = config;

  // ==================== STATI ====================
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  // ==================== REFS PROTETTI ====================
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const isStartingRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const lastStartTimeRef = useRef(0); // 🆕 PROTEZIONE ANTI-SPAM
  const instanceIdRef = useRef(Math.random().toString(36).substr(2, 9)); // 🆕 ID ISTANZA
  const mountedRef = useRef(true); // 🆕 CONTROLLO MOUNTED
  
  const maxConsecutiveErrors = 3;
  const minTimeBetweenStarts = 2000; // 🆕 Minimo 2 secondi tra avvii

  // ==================== SUPPORTO BROWSER ====================
  const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ==================== SUONO DI CONFERMA ====================
  const playWakeWordSound = useCallback(() => {
    if (!playConfirmationSound) return;

    try {
      // 🎵 GENERA SUONO PROGRAMMATICAMENTE (compatibile con tutti i browser)
      const audioContext = new (window.AudioContext)();
      
      // Suono di conferma: due beep crescenti
      const playBeep = (frequency: number, duration: number, delay: number = 0) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        }, delay);
      };
      // Suono: Do-Mi (C4-E4) - suono piacevole di attivazione
      playBeep(261.63, 0.15, 0);    // Do4
      playBeep(329.63, 0.15, 100);  // Mi4
      
      console.log('🎵 Wake Word: Suono di conferma riprodotto');
      
    } catch (error) {
      console.warn('⚠️ Wake Word: Impossibile riprodurre il suono:', error);
    }
  }, [playConfirmationSound]);

  // ==================== PROTEZIONE ANTI-SPAM ====================
  const canStart = useCallback(() => {
    const now = Date.now();
    const timeSinceLastStart = now - lastStartTimeRef.current;
    
    if (timeSinceLastStart < minTimeBetweenStarts) {
      console.log(`⏳ Wake Word [${instanceIdRef.current}]: Anti-spam attivo - aspetto ${minTimeBetweenStarts - timeSinceLastStart}ms`);
      return false;
    }
    
    return true;
  }, [minTimeBetweenStarts]);

  // ==================== RICHIESTA PERMESSI ====================
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!mountedRef.current) return false;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      if (mountedRef.current) {
        setHasPermission(true);
      }
      return true;
    } catch (error) {
      console.error('❌ Permesso microfono negato:', error);
      if (mountedRef.current) {
        setHasPermission(false);
        onPermissionDenied?.();
      }
      return false;
    }
  }, [onPermissionDenied]);

  // ==================== CLEANUP SICURO ====================
  const safeCleanup = useCallback(() => {
    const instanceId = instanceIdRef.current;
    console.log(`🧹 Wake Word [${instanceId}]: Cleanup sicuro`);
    
    // Ferma timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    // Ferma riconoscimento
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Ignora errori durante cleanup
      }
      recognitionRef.current = null;
    }

    // Reset stati solo se ancora mounted
    if (mountedRef.current) {
      isActiveRef.current = false;
      isStartingRef.current = false;
      setIsListeningForWakeWord(false);
    }
    
    consecutiveErrorsRef.current = 0;
  }, []);

  // ==================== RESTART CONTROLLATO ====================
  const scheduleRestart = useCallback(() => {
    const instanceId = instanceIdRef.current;
    
    if (!mountedRef.current || !isActiveRef.current) {
      console.log(`⏸️ Wake Word [${instanceId}]: Non più attivo, annullo restart`);
      return;
    }

    // 🆕 CONTROLLO AGGIUNTIVO: NON RIAVVIARE SE DISABILITATO
    if (!enabled) {
      console.log(`🚫 Wake Word [${instanceId}]: Disabilitato, annullo restart`);
      return;
    }

    if (consecutiveErrorsRef.current >= maxConsecutiveErrors) {
      console.log(`🚫 Wake Word [${instanceId}]: Troppi errori, interrompo definitivamente`);
      safeCleanup();
      onError?.('Troppi errori consecutivi. Wake word disattivato.');
      return;
    }

    const delay = Math.min(3000 + (consecutiveErrorsRef.current * 1000), 10000);
    console.log(`🔄 Wake Word [${instanceId}]: Schedule restart in ${delay}ms (errori: ${consecutiveErrorsRef.current})`);
    
    restartTimeoutRef.current = window.setTimeout(() => {
      // 🆕 DOPPIO CONTROLLO PRIMA DEL RESTART
      if (mountedRef.current && isActiveRef.current && !isStartingRef.current && canStart() && enabled) {
        console.log(`⚡ Wake Word [${instanceId}]: Esecuzione restart programmato`);
        startRecognitionInternal().catch(error => {
          console.error(`❌ Wake Word [${instanceId}]: Errore restart:`, error);
        });
      } else {
        console.log(`⏸️ Wake Word [${instanceId}]: Restart annullato (enabled=${enabled}, active=${isActiveRef.current})`);
      }
    }, delay);
  }, [safeCleanup, onError, canStart, enabled]); // 🆕 AGGIUNTO ENABLED ALLE DIPENDENZE

  // ==================== AVVIO RICONOSCIMENTO INTERNO ====================
  const startRecognitionInternal = useCallback(async () => {
    const instanceId = instanceIdRef.current;
    
    if (!mountedRef.current) {
      console.log(`💀 Wake Word [${instanceId}]: Componente unmounted, interrompo`);
      return;
    }

    if (isStartingRef.current) {
      console.log(`⏳ Wake Word [${instanceId}]: Avvio già in corso, ignoro`);
      return;
    }

    if (!canStart()) {
      return;
    }

    if (!isSupported) {
      console.log(`❌ Wake Word [${instanceId}]: Speech Recognition non supportato`);
      onError?.('Speech Recognition non supportato');
      return;
    }

    isStartingRef.current = true;
    lastStartTimeRef.current = Date.now();
    console.log(`🚀 Wake Word [${instanceId}]: Avvio riconoscimento (tentativo)`);

    try {
      // Cleanup precedente
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      // 🆕 CONTROLLO AGGIUNTIVO: VERIFICA SE ALTRI SISTEMI STANNO USANDO SPEECH RECOGNITION
      // Aspetta un po' per lasciare che altri sistemi si disconnettano
      await new Promise(resolve => setTimeout(resolve, 100));

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'it-IT';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (!mountedRef.current) return;
        
        console.log(`✅ Wake Word [${instanceId}]: Riconoscimento ATTIVO per "${wakeWord}"`);
        setIsListeningForWakeWord(true);
        isStartingRef.current = false;
        consecutiveErrorsRef.current = 0;
      };

      recognition.onresult = (event) => {
        if (!mountedRef.current) return;
        
        const results = event.results;
        for (let i = event.resultIndex; i < results.length; i++) {
          const result = results[i];
          if (result.isFinal) {
            const transcript = result[0].transcript.toLowerCase().trim();
            const detectedConfidence = result[0].confidence || 1;
            
            console.log(`🎯 Wake Word [${instanceId}]: Rilevato "${transcript}" (confidence: ${detectedConfidence})`);
            
            if (transcript.includes(wakeWord.toLowerCase()) && detectedConfidence >= confidence) {
              console.log(`🎉 Wake Word [${instanceId}]: "${wakeWord}" CONFERMATO! 🚀`);
              consecutiveErrorsRef.current = 0;
              
              // 🎵 RIPRODUCI SUONO DI CONFERMA
              playWakeWordSound();
              
              // 🎯 CALLBACK DOPO IL SUONO
              setTimeout(() => {
                onWakeWordDetected?.();
              }, 50); // Piccolo delay per far partire il suono prima
            }
          }
        }
      };

      recognition.onerror = (event) => {
        if (!mountedRef.current) return;
        
        console.error(`❌ Wake Word [${instanceId}]: Error ${event.error}`);
        isStartingRef.current = false;
        
        if (event.error === 'not-allowed') {
          setHasPermission(false);
          onPermissionDenied?.();
          safeCleanup();
          return;
        }
        
        if (event.error === 'no-speech' || event.error === 'aborted') {
          console.log(`⚪ Wake Word [${instanceId}]: ${event.error} (normale)`);
          return;
        }

        consecutiveErrorsRef.current++;
        console.warn(`⚠️ Wake Word [${instanceId}]: Errore ${event.error} (consecutivi: ${consecutiveErrorsRef.current})`);
        
        if (consecutiveErrorsRef.current >= maxConsecutiveErrors) {
          onError?.(`Errore wake word: ${event.error}`);
          safeCleanup();
        }
      };

      recognition.onend = () => {
        if (!mountedRef.current) return;
        
        console.log(`🏁 Wake Word [${instanceId}]: Riconoscimento terminato`);
        setIsListeningForWakeWord(false);
        isStartingRef.current = false;
        
        // 🆕 CONTROLLO ENABLED PRIMA DEL RESTART
        if (isActiveRef.current && consecutiveErrorsRef.current < maxConsecutiveErrors && enabled) {
          scheduleRestart();
        } else {
          console.log(`⏸️ Wake Word [${instanceId}]: Non riavvio (enabled=${enabled}, active=${isActiveRef.current})`);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (error) {
      console.error(`❌ Wake Word [${instanceId}]: Errore creazione:`, error);
      isStartingRef.current = false;
      consecutiveErrorsRef.current++;
      
      if (consecutiveErrorsRef.current >= maxConsecutiveErrors) {
        onError?.('Errore inizializzazione wake word');
        safeCleanup();
      } else {
        scheduleRestart();
      }
    }
  }, [isSupported, wakeWord, confidence, onWakeWordDetected, onPermissionDenied, onError, safeCleanup, scheduleRestart, canStart]);

  // ==================== API PUBBLICA ====================
  const startListening = useCallback(async () => {
    const instanceId = instanceIdRef.current;
    
    if (!mountedRef.current) {
      console.log(`💀 Wake Word [${instanceId}]: Componente unmounted, ignoro startListening`);
      return;
    }

    if (!isSupported) {
      onError?.('Speech Recognition non supportato in questo browser');
      return;
    }

    // 🆕 CONTROLLO ENABLED PRIMA DI AVVIARE
    if (!enabled) {
      console.log(`🚫 Wake Word [${instanceId}]: Disabilitato, ignoro startListening`);
      return;
    }

    if (isActiveRef.current) {
      console.log(`⚡ Wake Word [${instanceId}]: Già attivo, ignoro startListening`);
      return;
    }

    console.log(`🎯 Wake Word [${instanceId}]: START richiesto per "${wakeWord}"`);

    // Controlla permessi
    if (hasPermission === null) {
      const granted = await requestPermission();
      if (!granted || !mountedRef.current || !enabled) return; // 🆕 CONTROLLO ENABLED ANCHE QUI
    } else if (hasPermission === false) {
      onPermissionDenied?.();
      return;
    }

    // Cleanup e attiva
    safeCleanup();
    isActiveRef.current = true;
    
    // Avvia con delay per evitare conflitti
    setTimeout(() => {
      if (mountedRef.current && isActiveRef.current && enabled) { // 🆕 CONTROLLO ENABLED NEL TIMEOUT
        startRecognitionInternal().catch(error => {
          console.error(`❌ Wake Word [${instanceId}]: Errore avvio:`, error);
        });
      }
    }, 500);

  }, [isSupported, hasPermission, requestPermission, wakeWord, onError, onPermissionDenied, safeCleanup, startRecognitionInternal, enabled]); // 🆕 AGGIUNTO ENABLED

  const stopListening = useCallback(() => {
    const instanceId = instanceIdRef.current;
    console.log(`⏹️ Wake Word [${instanceId}]: STOP richiesto`);
    safeCleanup();
  }, [safeCleanup]);

  // ==================== EFFETTI CONTROLLATI ====================
  
  // 🔒 AUTO-START E GESTIONE ENABLED
  // useEffect(() => {
  //   if (autoStart && isSupported && mountedRef.current && enabled) {
  //     console.log(`🚀 Wake Word [${instanceIdRef.current}]: Auto-start attivato`);
  //     startListening();
  //   }

  //   // Cleanup finale solo su unmount
  //   return () => {
  //     mountedRef.current = false;
  //     console.log(`💀 Wake Word [${instanceIdRef.current}]: Componente unmounted - cleanup finale`);
      
  //     // Cleanup immediato su unmount
  //     if (restartTimeoutRef.current) {
  //       clearTimeout(restartTimeoutRef.current);
  //     }
  //     if (recognitionRef.current) {
  //       try {
  //         recognitionRef.current.stop();
  //       } catch (error) {
  //         // Ignora
  //       }
  //     }
  //   };
  // }, []); // 🎯 DIPENDENZE VUOTE - NESSUN RE-TRIGGER

  // ==================== GESTIONE DINAMICA ENABLED/DISABLED ====================
  // useEffect(() => {
  //   if (!mountedRef.current) return;
    
  //   const instanceId = instanceIdRef.current;
    
  //   if (!enabled && isActiveRef.current) {
  //     console.log(`⏸️ Wake Word [${instanceId}]: Disabilitato - ferma ascolto (enabled=${enabled})`);
  //     safeCleanup();
  //   } else if (enabled && !isActiveRef.current && hasPermission === true) {
  //     console.log(`▶️ Wake Word [${instanceId}]: Riabilitato - riavvia ascolto (enabled=${enabled})`);
  //     // 🆕 DELAY PIÙ LUNGO PER EVITARE CONFLITTI CON VOICE CHAT
  //     setTimeout(async () => {
  //       if (mountedRef.current && enabled && !isActiveRef.current) {
  //         console.log(`🔄 Wake Word [${instanceId}]: Eseguo riavvio differito (enabled=${enabled})`);
  //         try {
  //           await startListening();
  //         } catch (error) {
  //           console.error(`❌ Wake Word [${instanceId}]: Errore riavvio differito:`, error);
  //         }
  //       } else {
  //         console.log(`❌ Wake Word [${instanceId}]: Riavvio differito annullato (mounted=${mountedRef.current}, enabled=${enabled}, active=${isActiveRef.current})`);
  //       }
  //     }, 1500); // Delay aumentato a 1.5 secondi per sicurezza
  //   }
  // }, [enabled, hasPermission, startListening]); // 🆕 AGGIUNTE DIPENDENZE NECESSARIE

  return {
    isListeningForWakeWord,
    isSupported,
    hasPermission,
    startListening,
    stopListening,
    requestPermission
  };
};

// ==================== HOOK WRAPPER GARIBALDI ====================
export const useGaribaldiWakeWord = (
  onWakeWordDetected?: () => void,
  enabled: boolean = true // 🆕 PARAMETRO ENABLED
) => {
  return useWakeWord({
    wakeWord: 'garibaldi',
    onWakeWordDetected,
    confidence: 0.6,
    autoStart: true,
    enabled, // 🆕 PASSA IL PARAMETRO
    playConfirmationSound: true,
    onError: (error) => {
      console.error('🔴 Garibaldi Wake Word Error:', error);
    },
    onPermissionDenied: () => {
      console.warn('⚠️ Permessi microfono negati per Garibaldi Wake Word');
    }
  });
};
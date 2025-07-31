// hooks/useTTSService.ts
import { useState, useCallback, useRef, useEffect } from 'react';

// 🔧 Tipi TypeScript
interface TTSResponse {
  success: boolean;
  audioContent: string;
  metadata: {
    voice: string;
    languageCode: string;
    audioEncoding: string;
    textLength: number;
    estimatedCost: string;
  };
  timestamp: string;
  error?: string;
}

interface TTSStatus {
  isLoading: boolean;
  isPlaying: boolean;
  hasError: boolean;
  error: string | null;
  lastPlayedText: string;
  canPlay: boolean;
  canStop: boolean;
  canToggle: boolean;
}

const TTS_ENDPOINT = 'https://europe-west1-familytasktracker-c2dfe.cloudfunctions.net/textToSpeech';

export const useTTSService = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPlayedText, setLastPlayedText] = useState<string>('');
  
  // Ref per controllare l'audio corrente
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  /**
   * 🔊 Sintetizza e riproduce il testo
   */
  const speak = useCallback(async (text: string): Promise<boolean> => {
    // Validazione input
    if (!text || typeof text !== 'string' || !text.trim()) {
      setError('Il testo è obbligatorio');
      return false;
    }

    if (text.length > 5000) {
      setError('Il testo non può superare i 5000 caratteri');
      return false;
    }

    // Stop audio precedente se presente
    stopAudio();

    setIsLoading(true);
    setError(null);
    setIsPlaying(false);

    try {
      console.log('🔊 TTS Service: Invio richiesta...', text.substring(0, 50));

      const response = await fetch(TTS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text.trim() })
      });

      if (!response.ok) {
        const errorData: TTSResponse = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: TTSResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore sconosciuto dalla API');
      }

      console.log('✅ TTS Service: Audio ricevuto, avvio riproduzione...');

      // Converte base64 in blob e crea URL
      const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Salva riferimenti per cleanup
      audioUrlRef.current = audioUrl;
      
      // Crea e configura elemento audio
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      // Setup event listeners
      audio.onloadstart = () => {
        console.log('🎵 TTS Service: Caricamento audio...');
      };

      audio.oncanplay = () => {
        console.log('🎵 TTS Service: Audio pronto per riproduzione');
      };

      audio.onplay = () => {
        setIsPlaying(true);
        setLastPlayedText(text.trim());
        console.log('🎵 TTS Service: Riproduzione iniziata');
      };

      audio.onended = () => {
        setIsPlaying(false);
        cleanupAudio();
        console.log('🎵 TTS Service: Riproduzione completata');
      };

      audio.onerror = (err) => {
        console.error('❌ TTS Service: Errore riproduzione audio:', err);
        setError('Errore nella riproduzione audio');
        setIsPlaying(false);
        cleanupAudio();
      };

      audio.onpause = () => {
        setIsPlaying(false);
        console.log('⏸️ TTS Service: Riproduzione in pausa');
      };

      // Avvia riproduzione
      await audio.play();
      
      return true;

    } catch (err) {
      console.error('❌ TTS Service: Errore:', err);
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(errorMessage);
      setIsPlaying(false);
      cleanupAudio();
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * ⏹️ Ferma riproduzione corrente
   */
  const stopAudio = useCallback((): void => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setIsPlaying(false);
    cleanupAudio();
    console.log('⏹️ TTS Service: Audio fermato');
  }, []);

  /**
   * ⏸️ Pausa/riprendi riproduzione
   */
  const togglePlayback = useCallback((): void => {
    if (currentAudioRef.current) {
      if (isPlaying) {
        currentAudioRef.current.pause();
      } else {
        currentAudioRef.current.play();
      }
    }
  }, [isPlaying]);

  /**
   * 🧹 Cleanup risorse audio
   */
  const cleanupAudio = useCallback((): void => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  /**
   * 🔄 Reset errori
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * 📊 Ottieni info sullo stato
   */
  const getStatus = useCallback((): TTSStatus => {
    return {
      isLoading,
      isPlaying,
      hasError: !!error,
      error,
      lastPlayedText,
      canPlay: !isLoading && !isPlaying,
      canStop: isPlaying,
      canToggle: !!currentAudioRef.current
    };
  }, [isLoading, isPlaying, error, lastPlayedText]);

  // Cleanup al unmount
  useEffect(() => {
    return () => {
      stopAudio();
      cleanupAudio();
    };
  }, [stopAudio, cleanupAudio]);

  return {
    // Azioni principali
    speak,
    stopAudio,
    togglePlayback,
    clearError,
    
    // Stato
    isLoading,
    isPlaying,
    error,
    lastPlayedText,
    
    // Utilities
    getStatus
  };
};

/**
 * 🔧 Utility: Converte base64 in Blob
 */
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * 📱 Hook semplificato per uso base
 */
export const useSimpleTTS = () => {
  const { speak, isLoading, isPlaying, error } = useTTSService();
  
  const speakText = useCallback(async (text: string): Promise<boolean> => {
    return await speak(text);
  }, [speak]);

  return {
    speakText,
    isLoading,
    isPlaying,
    error
  };
};

// 🔧 Export dei tipi per uso esterno
export type { TTSStatus, TTSResponse };
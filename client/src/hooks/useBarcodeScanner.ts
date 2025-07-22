import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  NotFoundException,
  Result,
  Exception,
} from '@zxing/library';

// ==========================================================
// ==== TIPI E INTERFACCE
// ==========================================================

/**
 * Stato dei permessi della fotocamera.
 */
type CameraPermission = 'unknown' | 'granted' | 'denied';

/**
 * Interfaccia per descrivere una fotocamera disponibile.
 */
interface CameraDevice {
  id: string;
  label: string;
}

/**
 * Props per l'hook useBarcodeScanner.
 */
interface UseBarcodeScannerProps {
  /** Callback eseguita in caso di scansione riuscita. */
  onScanSuccess: (result: Result) => void;
  /** Callback eseguita in caso di errore durante la scansione. */
  onScanError: (error: unknown) => void;
  /** Flag per attivare o disattivare lo scanner. */
  isActive?: boolean;
}

// ==========================================================
// ==== HOOK
// ==========================================================

/**
 * Hook custom per gestire la logica dello scanner di codici a barre con ZXing.
 * Incapsula la gestione dei permessi, la selezione della fotocamera e il processo di scansione.
 * @param props - Le proprietà per configurare l'hook.
 */
export const useBarcodeScanner = ({
  onScanSuccess,
  onScanError,
  isActive = true,
}: UseBarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [permission, setPermission] = useState<CameraPermission>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  const selectedDeviceId = cameras[currentCameraIndex]?.id;
  const hasMultipleCameras = cameras.length > 1;

  // Funzione per cambiare fotocamera
  const switchCamera = useCallback(() => {
    if (hasMultipleCameras) {
      console.log('🔄 Cambio fotocamera');
      setCurrentCameraIndex(prev => (prev + 1) % cameras.length);
    }
  }, [hasMultipleCameras, cameras.length]);

  // 1. Effetto: Inizializzazione e gestione permessi
  useEffect(() => {
    if (!isActive) {
        setIsLoading(false);
        return;
    }

    const initialize = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Controlla e richiede i permessi
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Rilascia subito lo stream
        setPermission('granted');
        console.log('✅ Permessi camera ottenuti');

        // Enumera i dispositivi video
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices: CameraDevice[] = devices
          .filter(device => device.kind === 'videoinput')
          .map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Camera ${index + 1}`,
          }));
        
        if (videoDevices.length === 0) {
            throw new Error("Nessuna fotocamera trovata.");
        }

        console.log(`📱 Trovate ${videoDevices.length} fotocamere.`);
        setCameras(videoDevices);

        // Prova a preselezionare la fotocamera posteriore
        const rearCameraIndex = videoDevices.findIndex(d =>
          /back|rear|environment/i.test(d.label)
        );
        setCurrentCameraIndex(rearCameraIndex !== -1 ? rearCameraIndex : 0);

      } catch (err) {
        console.error('❌ Errore inizializzazione camera:', err);
        setPermission('denied');
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Impossibile accedere alla fotocamera: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [isActive]);

  // 2. Effetto: Gestione dello scanner ZXing
  useEffect(() => {
    // Condizioni per non avviare lo scanner
    if (!isActive || permission !== 'granted' || !videoRef.current || !selectedDeviceId) {
      return;
    }
    
    // Inizializza il reader se non esiste
    if (!readerRef.current) {
        const hints = new Map();
        const formats = [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8];
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
        readerRef.current = new BrowserMultiFormatReader(hints);
        console.log('🚀 Reader ZXing inizializzato.');
    }

    const reader = readerRef.current;
    let isEffectActive = true;
    
    const startScan = async () => {
      try {
        console.log(`📹 Avvio scansione sul dispositivo: ${selectedDeviceId}`);
        setIsScanning(true);
        await reader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result: Result | undefined, err: Exception | undefined) => {
            if (!isEffectActive) return;

            if (result) {
              console.log(`🎉 BARCODE LETTO: ${result.getText()}`);
              onScanSuccess(result);
            } else if (err && !(err instanceof NotFoundException)) {
              console.warn('⚠️ Errore durante la scansione:', err);
              onScanError(err);
            }
          }
        );
      } catch (err) {
        console.error('❌ Errore critico avvio scansione:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Errore scanner: ${errorMessage}`);
        setIsScanning(false);
      }
    };

    startScan();

    // Funzione di cleanup
    return () => {
      isEffectActive = false;
      if (readerRef.current) {
        console.log('🛑 Stop scanning e reset reader.');
        readerRef.current.reset();
      }
      setIsScanning(false);
    };
  }, [isActive, permission, selectedDeviceId, onScanSuccess, onScanError]);


  return {
    videoRef,
    isLoading,
    error,
    permission,
    isScanning,
    hasMultipleCameras,
    switchCamera,
  };
};

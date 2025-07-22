import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scan,
  Lock,
  Camera,
  RotateCcw,
  Edit,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Plus,
  Palette,
  Zap,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, viewImage } from '@/lib/utils';
import { supermarketData, type SupermarketKey, suggestedColors } from './walletConstants';

// ==========================================================
// ==== ZXING IMPORTS E TIPI
// ==========================================================
import { 
  BrowserMultiFormatReader, 
  DecodeHintType, 
  BarcodeFormat, 
  Result,
  NotFoundException 
} from '@zxing/library';

// ==========================================================
// ==== INTERFACCE TYPESCRIPT PER ZXING
// ==========================================================
interface ZXingControls {
  stop: () => void;
}

interface ZXingScanResult {
  codeResult: {
    code: string;
    format: BarcodeFormat;
  };
}

// ==========================================================
// ==== HOOK CUSTOM PER ZXING SCANNER OTTIMIZZATO
// ==========================================================
const useZXingScanner = ({
  videoRef,
  onScanSuccess,
  onScanError,
  selectedDeviceId,
  isActive = true
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  onScanSuccess: (result: Result) => void;
  onScanError: (error: any) => void;
  selectedDeviceId?: string;
  isActive: boolean;
}) => {
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const scanCount = useRef(0);
  const lastScanTime = useRef(0);

  // Configurazione ZXing ULTRA-FLUIDA con TUTTI i formati barcode
  const getOptimizedHints = useCallback(() => {
    const hints = new Map();
    
    // 🎯 TUTTI I FORMATI BARCODE SUPPORTATI da ZXing v0.21.3
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      // === 1D BARCODES ===
      BarcodeFormat.CODE_39,       // Carte fedeltà più comune
      BarcodeFormat.CODE_128,      // Spedizioni, logistica  
      BarcodeFormat.CODE_93,       // Postale canadese
      BarcodeFormat.EAN_13,        // Prodotti retail (GTIN-13)
      BarcodeFormat.EAN_8,         // Prodotti piccoli (GTIN-8)
      BarcodeFormat.UPC_A,         // Prodotti USA/Canada (GTIN-12)
      BarcodeFormat.UPC_E,         // UPC compresso
      BarcodeFormat.ITF,           // Interleaved 2 of 5 (logistica)
      BarcodeFormat.CODABAR,       // Biblioteche, banche sangue
      BarcodeFormat.RSS_14,        // GS1 DataBar
      BarcodeFormat.RSS_EXPANDED,  // GS1 DataBar Expanded
      
      // === 2D BARCODES ===
      BarcodeFormat.QR_CODE,       // QR Code ubiquitario
      BarcodeFormat.DATA_MATRIX,   // Industria, elettronica
      BarcodeFormat.PDF_417,       // Documenti, trasporti
      BarcodeFormat.AZTEC,         // Biglietti trasporti
      BarcodeFormat.MAXICODE       // UPS, logistica
    ]);
    
    // 🚀 CONFIGURAZIONE ULTRA-PERFORMANCE E FLUIDITÀ
    hints.set(DecodeHintType.TRY_HARDER, true);           // Abilitato per accuratezza massima
    hints.set(DecodeHintType.PURE_BARCODE, false);        // Per immagini reali
    hints.set(DecodeHintType.ASSUME_GS1, false);          // Non assumere GS1 per default
    hints.set(DecodeHintType.RETURN_CODABAR_START_END, true); // Info complete Codabar
    
    return hints;
  }, []);

  // Inizializzazione reader
  useEffect(() => {
    if (!isActive) return;

    console.log('🚀 Inizializzazione ZXing Scanner...');
    
    const hints = getOptimizedHints();
    const reader = new BrowserMultiFormatReader(hints);
    
    // Configurazione timing ULTRA-FLUIDA (da 1 FPS a 5 FPS!)
    reader.timeBetweenDecodingAttempts = 200; // Da 1000ms a 200ms = 5 scansioni/secondo!
    
    readerRef.current = reader;
    setIsInitialized(true);
    
    console.log('✅ ZXing Reader inizializzato');

    return () => {
      console.log('🧹 Cleanup ZXing Reader');
      if (readerRef.current) {
        try {
          readerRef.current.reset();
        } catch (err) {
          console.warn('⚠️ Errore durante cleanup reader:', err);
        }
        readerRef.current = null;
      }
      setIsInitialized(false);
      setIsScanning(false);
    };
  }, [isActive, getOptimizedHints]);

  // Avvio scanning con device specifico
  useEffect(() => {
    if (!isInitialized || !readerRef.current || !videoRef.current || !isActive) {
      return;
    }

    let isCurrentEffectActive = true;

    const startScanning = async () => {
      try {
        console.log('🎯 Avvio scanning ZXing...');
        
        // Configurazione constraints ULTRA-FLUIDA
        const constraints = {
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            facingMode: selectedDeviceId ? undefined : 'environment',
            width: { ideal: 1280, min: 640 },    // Risoluzione più alta per precisione
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 15 },   // 30 FPS per fluidità massima
            focusMode: 'continuous',             // Autofocus continuo
            exposureMode: 'continuous',          // Esposizione automatica
            whiteBalanceMode: 'continuous'       // Bilanciamento automatico
          }
        };

        const controls = await readerRef.current!.decodeFromConstraints(
          constraints,
          videoRef.current!,
          (result, error) => {
            if (!isCurrentEffectActive) return;

            if (result) {
              const now = Date.now();
              
              // Debounce ULTRA-RIDOTTO per fluidità (da 2s a 0.5s)
              if (now - lastScanTime.current < 500) {
                console.log('🔄 Scansione troppo ravvicinata, ignorata');
                return;
              }

              lastScanTime.current = now;
              scanCount.current++;
              
              const code = result.getText();
              const format = result.getBarcodeFormat();
              
              console.log(`🎉 BARCODE LETTO: ${code} (formato: ${format}, scan #${scanCount.current})`);
              
              onScanSuccess(result);
            } else if (error && !(error instanceof NotFoundException)) {
              // Logga solo errori significativi, non i "non trovato"
              console.log('⚠️ Errore scanning (normale):', error.message);
              onScanError(error);
            }
          }
        ) as ZXingControls | undefined;

        if (isCurrentEffectActive) {
          setIsScanning(true);
          console.log('✅ Scanning ZXing avviato');
        }

        // Cleanup per questo specifico avvio
        return () => {
          console.log('🛑 Stop scanning ZXing');
          try {
            if (controls && typeof controls.stop === 'function') {
              controls.stop();
            }
          } catch (err) {
            console.warn('⚠️ Errore stop scanning:', err instanceof Error ? err.message : String(err));
          }
          if (isCurrentEffectActive) {
            setIsScanning(false);
          }
        };

      } catch (err) {
        console.error('❌ Errore avvio scanning:', err instanceof Error ? err.message : String(err));
        if (isCurrentEffectActive) {
          setIsScanning(false);
          onScanError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    const cleanupPromise = startScanning();

    return () => {
      isCurrentEffectActive = false;
      cleanupPromise.then(cleanup => cleanup?.());
    };
  }, [isInitialized, selectedDeviceId, isActive, onScanSuccess, onScanError, videoRef]);

  return { isScanning, isInitialized };
};

// ==========================================================
// ==== COMPONENTE SCANNER ZXING OTTIMIZZATO
// ==========================================================
const BarcodeScanner = ({
  onScanSuccess,
  onScanError
}: {
  onScanSuccess: (result: any) => void;
  onScanError: (error: any) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Gestione risultati scansione
  const handleScanSuccess = useCallback((result: Result) => {
    const code = result.getText();
    console.log(`🎉 SUCCESSO SCANSIONE ZXing: ${code}`);
    
    // Trasforma il risultato ZXing nel formato atteso dal componente parent
    const quaggaCompatibleResult: ZXingScanResult = {
      codeResult: {
        code: code,
        format: result.getBarcodeFormat()
      }
    };
    
    onScanSuccess(quaggaCompatibleResult);
  }, [onScanSuccess]);

  const handleScanError = useCallback((error: any) => {
    console.log('⚠️ Errore scansione ZXing:', error.message);
    onScanError(error);
  }, [onScanError]);

  // Hook ZXing
  const { isScanning, isInitialized } = useZXingScanner({
    videoRef,
    onScanSuccess: handleScanSuccess,
    onScanError: handleScanError,
    selectedDeviceId: cameras[currentCameraIndex]?.id,
    isActive: permissionGranted && !error
  });

  // ==========================================================
  // ==== RILEVAMENTO FOTOCAMERE E PERMESSI
  // ==========================================================
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        console.log('📱 Richiesta permessi camera...');
        
        // Richiesta permessi
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        
        // Ferma il stream temporaneo
        stream.getTracks().forEach(track => track.stop());
        
        console.log('✅ Permessi camera ottenuti');
        setPermissionGranted(true);

        // Enumera dispositivi
        console.log('🔍 Rilevamento fotocamere...');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices
          .filter(device => device.kind === 'videoinput')
          .map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Camera ${index + 1}`
          }));

        console.log('📱 Fotocamere trovate:', videoDevices.length);
        setCameras(videoDevices);

        // Preferenza per fotocamera posteriore
        const rearCameraIndex = videoDevices.findIndex(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        
        if (rearCameraIndex !== -1) {
          setCurrentCameraIndex(rearCameraIndex);
          console.log('📷 Camera posteriore selezionata');
        }

      } catch (err) {
        console.error('❌ Errore inizializzazione camera:', err instanceof Error ? err.message : String(err));
        setError(`Impossibile accedere alla fotocamera: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };

    initializeCamera();
  }, []);

  // ==========================================================
  // ==== CONTROLLI CAMERA
  // ==========================================================
  const switchCamera = useCallback(() => {
    if (cameras.length > 1) {
      console.log('🔄 Cambio fotocamera ZXing');
      setCurrentCameraIndex(prev => (prev + 1) % cameras.length);
    }
  }, [cameras.length]);

  // ==========================================================
  // ==== RENDERING CON STATI DIVERSI
  // ==========================================================
  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        <div className="w-full bg-gray-200 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-center">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2 animate-bounce" />
            <p className="text-sm text-gray-500">🚀 Caricamento Ultra-Scanner ZXing...</p>
            <p className="text-xs text-gray-400 mt-1">HD • 5fps • Multi-format</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full space-y-3">
        <div className="w-full bg-red-50 border border-red-200 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-center p-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 font-medium">Errore Scanner</p>
            <p className="text-xs text-red-500 mt-1">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3"
              onClick={() => {
                setError(null);
                setIsLoading(true);
                window.location.reload();
              }}
            >
              Riprova
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Area scanner ULTRA-FLUIDA e più ampia */}
      <div className="relative w-full bg-black rounded-lg overflow-hidden shadow-lg">
        <video 
          ref={videoRef}
          className="w-full object-cover transition-all duration-300"
          style={{ 
            height: '320px',  // Aumentata da 250px a 320px
            maxWidth: '100%'
          }}
          playsInline
          muted
          autoPlay
        />
        
        {/* Overlay di scanning ULTRA-FLUIDO */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Linea di scanning animata più fluida */}
          {isScanning && (
            <>
              <div className="absolute inset-x-4 top-1/2 transform -translate-y-1/2 h-0.5 bg-red-500 shadow-lg animate-pulse" />
              <div className="absolute inset-x-4 top-1/2 transform -translate-y-1/2 h-px bg-red-300 animate-ping" />
            </>
          )}
          
          {/* Cornice di targeting migliorata */}
          <div className="absolute inset-4 border-2 border-white/80 rounded-lg shadow-lg">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg animate-pulse" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg animate-pulse" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg animate-pulse" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg animate-pulse" />
          </div>
          
          {/* Indicatori di scanning attivo */}
          {isScanning && (
            <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg" />
          )}
        </div>
        
        {/* Overlay con stato ULTRA-PERFORMANCE */}
        <div className="absolute top-2 left-2 right-2 bg-black/80 text-white text-xs p-2 rounded text-center backdrop-blur-sm">
          {isScanning ? (
            <span className="text-green-300 flex items-center justify-center gap-1">
              🚀 ULTRA-FLUIDO: 5 scansioni/sec - TUTTI i formati barcode
            </span>
          ) : isInitialized ? (
            <span className="text-yellow-300">🟡 Inizializzazione camera HD...</span>
          ) : (
            <span className="text-blue-300">🔵 Caricamento ZXing Ultra...</span>
          )}
        </div>
      </div>

      {/* Controlli */}
      <div className="flex justify-center items-center gap-3 p-2 bg-gray-100 rounded-lg">
        {cameras.length > 1 && (
          <Button 
            variant="outline" 
            size="icon" 
            onClick={switchCamera} 
            title="Cambia fotocamera"
            disabled={!isScanning}
          >
            <RotateCcw size={20} />
          </Button>
        )}
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Zap size={14} className="text-green-500" />
          {cameras.length > 0 ? (
            <span className="font-medium">
              Ultra-ZXing: {cameras[currentCameraIndex]?.label} | 5fps | HD
            </span>
          ) : (
            'Nessuna camera'
          )}
        </div>
      </div>

      {/* Pannello informativo ULTRA-PERFORMANCE */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3">
        <h4 className="text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
          <Zap size={16} className="text-green-600" />
          🚀 ZXing ULTRA-FLUIDO v0.21.3:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-green-700">
          <div className="space-y-1">
            <div>• <strong>5 FPS</strong> - Ultra-reattivo (0.2s intervallo)</div>
            <div>• <strong>HD 1280x720</strong> - Qualità massima</div>
            <div>• <strong>30 FPS camera</strong> - Fluidità perfetta</div>
            <div>• <strong>0.5s debounce</strong> - Risposta immediata</div>
          </div>
          <div className="space-y-1">
            <div>• <strong>16+ formati</strong> - Tutti i barcode supportati</div>
            <div>• <strong>1D & 2D</strong> - Code39, QR, DataMatrix, PDF417</div>
            <div>• <strong>TRY_HARDER</strong> - Accuratezza massima</div>
            <div>• <strong>AutoFocus</strong> - Messa a fuoco continua</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-600 bg-white/50 rounded p-2">
          💡 <strong>Pro tip:</strong> Funziona con carte fedeltà, prodotti retail, QR code, documenti e qualsiasi barcode!
        </div>
      </div>
    </div>
  );
};

// ==========================================================
// ==== RESTO DEL COMPONENTE IDENTICO ALL'ORIGINALE
// ==========================================================
export const AddCardModal = ({ isOpen, onClose, onSave }: any) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketKey | null>(null);
  const [scannedData, setScannedData] = useState('');
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [selectedColor, setSelectedColor] = useState('#536DFE');
  
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try { 
        const stream = await navigator.mediaDevices.getUserMedia({ video: true }); 
        stream.getTracks().forEach(track => track.stop());
        setCameraPermission('granted'); 
      } catch { 
        setCameraPermission('denied'); 
      }
    })();
  }, [isOpen]);

  const resetModal = useCallback(() => {
    setCurrentStep(1);
    setSelectedSupermarket(null);
    setScannedData('');
    setCameraPermission('unknown');
    setSelectedColor('#536DFE');
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const nextStep = () => setCurrentStep(s => Math.min(s + 1, 3));
  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1));

  const handleScanSuccess = useCallback((result: any) => {
    const decodedText = result.codeResult.code;
    console.log(`🎉 SUCCESSO SCANSIONE FINALE: ${decodedText}`);
    setScannedData(decodedText);
  }, []);

  const handleScanError = useCallback((error: any) => {
    // Gestione silenziosa degli errori
    console.log('⚠️ Errore scansione (normale):', error);
  }, []);

  const handleManualInput = () => {
    const code = prompt('Inserisci il codice manualmente:');
    if (code && code.trim()) {
      setScannedData(code.trim());
    }
  };
  
  const saveCard = () => {
    if (!selectedSupermarket) return;
    const m = supermarketData[selectedSupermarket];
    const formatted = scannedData.length > 12 ? scannedData.replace(/(.{4})/g, '$1 ').trim() : scannedData;
    onSave({
      name: `${m.name} ${m.type}`, 
      number: formatted, 
      brand: m.name, 
      logo: m.logo, 
      barcode: scannedData, 
      color: selectedSupermarket === 'altro' ? selectedColor : m.color,
    });
    handleClose();
  };
  
  const SupermarketSelection = () => (
    <div className="space-y-4">
      <Label className="text-base font-semibold text-gray-700">Seleziona il Negozio</Label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(supermarketData).map(([key, market]) => {
          if (market.name === "ALTRO") {
            return (
              <button key={key} onClick={() => setSelectedSupermarket(key as SupermarketKey)} className={cn("flex flex-col items-center justify-center w-full p-4 min-h-[6rem] bg-gray-100 rounded-lg border-2 border-dashed transition-all duration-300", selectedSupermarket === key ? "border-solid bg-indigo-50 border-[#663EF3]" : "border-gray-300 hover:border-gray-400 hover:bg-gray-200")}>
                <Plus className="w-6 h-6 mb-1 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">Altro</span>
              </button>
            )
          }
          return (
            <Card key={key} style={{ backgroundColor: market.color }} className={cn("cursor-pointer transform transition-all duration-300 hover:scale-105 rounded-xl overflow-hidden border-2", selectedSupermarket === key ? "ring-2 ring-offset-2 ring-[#663EF3] border-white" : "border-transparent")} onClick={() => setSelectedSupermarket(key as SupermarketKey)}>
              <CardContent className="flex flex-col items-center justify-center p-2 text-center min-h-[6rem] text-white">
                <img src={viewImage(market.logo)} alt={`${market.name} Logo`} className="h-10 w-auto object-contain mb-2 drop-shadow-md" />
                <div className="font-bold text-xs drop-shadow-sm">{market.name}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {selectedSupermarket === 'altro' && (
        <div className="space-y-3 bg-gray-50 p-4 rounded-lg border">
            <Label className="font-semibold text-gray-700 flex items-center gap-2"><Palette/> Personalizza Colore</Label>
            <div className="flex items-center gap-4">
                 <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-14 h-14 p-0 bg-transparent border-none rounded-lg cursor-pointer"/>
                 <div className="grid grid-cols-7 gap-2 flex-1">
                   {suggestedColors.map((color) => (
                     <button key={color} type="button" className={cn("w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110", selectedColor === color ? "ring-2 ring-offset-2 ring-[#663EF3] border-white" : "border-gray-300")} style={{ backgroundColor: color }} onClick={() => setSelectedColor(color)}/>
                   ))}
                 </div>
            </div>
        </div>
      )}
      <div className="flex gap-4 pt-4">
        <Button variant="ghost" onClick={handleClose} className="w-full">Annulla</Button>
        <Button onClick={nextStep} disabled={!selectedSupermarket} className="w-full text-white" style={{ background: 'var(--burnt-newStyle)' }}>
          Continua <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const ScannerStep = () => (
    <div className="flex flex-col gap-4 text-center">
      <div className="text-sm text-gray-500">Inquadra il codice a barre della tua carta fedeltà.</div>
      {cameraPermission === 'granted' ? (
        scannedData ? (
          <div className="p-4 bg-green-50 text-green-800 rounded-lg flex flex-col items-center gap-3 border border-green-200">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="font-semibold text-lg">Codice Acquisito!</p>
            <p className="font-mono bg-white p-2 rounded">{scannedData}</p>
            <Button variant="link" size="sm" onClick={() => setScannedData('')}>Scansiona di nuovo</Button>
          </div>
        ) : <BarcodeScanner onScanSuccess={handleScanSuccess} onScanError={handleScanError}/>
      ) : cameraPermission === 'denied' ? (
        <div className="p-4 bg-red-50 text-red-800 rounded-lg flex flex-col items-center gap-2 border border-red-200">
          <Lock className="w-8 h-8 text-red-500" />
          <p className="font-semibold">Accesso alla fotocamera negato</p>
        </div>
      ) : <div className="aspect-video bg-gray-200 animate-pulse rounded-lg flex items-center justify-center"><Camera className="w-12 h-12 text-gray-400"/></div>}
      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-gray-200"></div>
        <span className="flex-shrink mx-4 text-xs text-gray-400">OPPURE</span>
        <div className="flex-grow border-t border-gray-200"></div>
      </div>
      <Button variant="outline" onClick={handleManualInput}><Edit className="w-4 h-4 mr-2" /> Inserisci Manualmente</Button>
      <div className="flex gap-4 pt-4">
        <Button variant="ghost" onClick={prevStep} className="w-full"><ArrowLeft className="w-4 h-4 mr-2" /> Indietro</Button>
        <Button onClick={nextStep} disabled={!scannedData} className="w-full text-white" style={{ background: 'var(--burnt-newStyle)' }}>
          Continua <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const ConfirmationStep = () => {
    if (!selectedSupermarket) return null;
    const m = supermarketData[selectedSupermarket];
    const cardColor = selectedSupermarket === 'altro' ? selectedColor : m.color;
    const formatted = scannedData.length > 12 ? scannedData.replace(/(.{4})/g, '$1 ').trim() : scannedData;
    
    return (
      <div className="space-y-6 text-center">
        <p className="text-gray-600">Controlla i dati e salva la tua carta.</p>
        <Card className="mx-auto max-w-xs shadow-lg" style={{ backgroundColor: cardColor }}>
          <CardContent className="text-center text-white p-6 space-y-3">
            <img src={viewImage(m.logo)} className="h-14 mx-auto drop-shadow-lg" alt={m.name} />
            <h3 className="text-xl font-bold">{m.name} {m.type}</h3>
            <p className="font-mono text-lg bg-white/20 px-2 py-1 rounded-md">{formatted}</p>
          </CardContent>
        </Card>
        <div className="flex gap-4 pt-4">
          <Button variant="ghost" onClick={prevStep} className="w-full"><ArrowLeft className="w-4 h-4 mr-2" /> Indietro</Button>
          <Button onClick={saveCard} className="w-full text-white bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-4 h-4 mr-2"/> Salva Carta
          </Button>
        </div>
      </div>
    );
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
             <div className="p-2 rounded-lg" style={{ background: 'var(--burnt-newStyle)' }}><Scan className="w-6 h-6 text-white" /></div>
            Aggiungi Carta Fedeltà
          </DialogTitle>
          <DialogDescription>Passo {currentStep} di 3 - Seleziona, scansiona e conferma.</DialogDescription>
        </DialogHeader>
        {currentStep === 1 && <SupermarketSelection />}
        {currentStep === 2 && <ScannerStep />}
        {currentStep === 3 && <ConfirmationStep />}
      </DialogContent>
    </Dialog>
  );
};
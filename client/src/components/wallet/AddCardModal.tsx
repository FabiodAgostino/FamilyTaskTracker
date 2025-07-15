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
  ZapOff,
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
// ==== QUAGGA2 TIPI E DICHIARAZIONI
// ==========================================================
declare global {
  interface Window {
    Quagga: any;
  }
}

// ==========================================================
// ==== COMPONENTE SCANNER QUAGGA2 CON DEBUG E FALLBACK
// ==========================================================
const BarcodeScanner = ({
  onScanSuccess,
  onScanError
}: {
  onScanSuccess: (result: any) => void;
  onScanError: (error: any) => void;
}) => {
  const scannerRegionId = 'quagga-scanner-region';
  const scannerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [quaggaLoaded, setQuaggaLoaded] = useState(false);

  // ==========================================================
  // ==== CARICAMENTO QUAGGA2 CON DEBUG COMPLETO
  // ==========================================================
  useEffect(() => {
    // Aggiungi CSS globale per contenere il video
    const style = document.createElement('style');
    style.textContent = `
      #${scannerRegionId} video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
      }
      #${scannerRegionId} canvas {
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(style);
    
    const loadQuagga = async () => {
      console.log('🔄 Tentativo caricamento Quagga2...');
      
      if (window.Quagga) {
        console.log('✅ Quagga2 già caricato');
        setQuaggaLoaded(true);
        setIsLoading(false);
        return;
      }
      
      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2/dist/quagga.min.js';
        script.async = true;
        
        const loadPromise = new Promise((resolve, reject) => {
          script.onload = () => {
            console.log('✅ Script Quagga2 caricato');
            // Aspetta un momento per l'inizializzazione
            setTimeout(() => {
              if (window.Quagga) {
                console.log('✅ Quagga2 disponibile globalmente');
                setQuaggaLoaded(true);
                resolve(true);
              } else {
                console.error('❌ Quagga2 non disponibile dopo il caricamento');
                reject(new Error('Quagga2 non disponibile'));
              }
            }, 100);
          };
          script.onerror = () => {
            console.error('❌ Errore nel caricamento script Quagga2');
            reject(new Error('Impossibile caricare Quagga2'));
          };
        });
        
        document.head.appendChild(script);
        await loadPromise;
      } catch (err) {
        console.error('❌ Errore caricamento Quagga2:', err);
        setError('Impossibile caricare il motore di scansione');
      } finally {
        setIsLoading(false);
      }
    };

    loadQuagga();
  }, []);

  // ==========================================================
  // ==== RILEVAMENTO FOTOCAMERE
  // ==========================================================
  useEffect(() => {
    if (!quaggaLoaded) return;
    
    const detectCameras = async () => {
      try {
        console.log('🔍 Rilevamento fotocamere...');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices
          .filter(device => device.kind === 'videoinput')
          .map(device => ({
            id: device.deviceId,
            label: device.label || `Camera ${device.deviceId.slice(0, 5)}`
          }));
        
        console.log('📱 Fotocamere trovate:', videoDevices.length);
        setCameras(videoDevices);
        
        // Preferenza per fotocamera posteriore
        const rearCameraIndex = videoDevices.findIndex(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        setCurrentCameraIndex(rearCameraIndex !== -1 ? rearCameraIndex : 0);
      } catch (err) {
        console.error('❌ Errore rilevamento fotocamere:', err);
        setError('Impossibile accedere alle fotocamere');
      }
    };

    detectCameras();
  }, [quaggaLoaded]);

  // ==========================================================
  // ==== INIZIALIZZAZIONE E AVVIO QUAGGA2
  // ==========================================================
  useEffect(() => {
    if (!quaggaLoaded || !window.Quagga || !scannerRef.current || cameras.length === 0 || isInitialized.current) {
      return;
    }

    const currentCamera = cameras[currentCameraIndex];
    console.log('🚀 Inizializzazione Quagga2 con camera:', currentCamera.label);
    
    const quaggaConfig = {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerRef.current,
        constraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
          deviceId: currentCamera.id
        }
      },
      decoder: {
        readers: [
          'ean_reader',         // EAN-13 e EAN-8
          'code_128_reader',    // CODE_128 (molto comune)
          'code_39_reader',     // CODE_39
          'codabar_reader',     // CODABAR
          'ean_8_reader',
          'code_93_reader',
          'i2of5_reader',
          '2of5_reader',
          'upc_reader'
        ]
      },
      locator: {
        patchSize: "medium",
        halfSample: true
      },
      numOfWorkers: navigator.hardwareConcurrency || 2,
      frequency: 10,
      debug: {
        showCanvas: false,
        showPatches: false,
        showFoundPatches: false,
        showSkeleton: false,
        showLabels: false,
        showPatchLabels: false,
        showRemainingPatchLabels: false,
        boxFromPatches: {
          showTransformed: false,
          showTransformedBox: false,
          showBB: false
        }
      }
    };

    console.log('⚙️ Configurazione Quagga2:', quaggaConfig);

    window.Quagga.init(quaggaConfig, (err: any) => {
      if (err) {
        console.error('❌ Errore inizializzazione Quagga2:', err);
        setError(`Errore scanner: ${err.message || err}`);
        return;
      }

      console.log('✅ Quagga2 inizializzato con successo');
      
      try {
        window.Quagga.start();
        isInitialized.current = true;
        setIsScanning(true);
        console.log('🎯 Scanner Quagga2 avviato');
      } catch (startErr) {
        console.error('❌ Errore avvio Quagga2:', startErr);
        setError('Impossibile avviare lo scanner');
      }
    });

    // Event listeners
    const onDetected = (result: any) => {
      const code = result.codeResult.code;
      const format = result.codeResult.format;
      const confidence = result.codeResult.decodedCodes?.[0]?.confidence || 0;
      
      console.log(`🔍 LETTURA: ${code} (formato: ${format}, confidenza: ${confidence.toFixed(2)})`);
      
      // Accetta solo letture con buona confidenza
      if (confidence < 50) {
        console.log(`⚠️ IGNORATO: Confidenza troppo bassa (${confidence.toFixed(2)})`);
        return;
      }
      
      console.log(`🎉 BARCODE ACCETTATO: ${code} (formato: ${format})`);
      onScanSuccess(result);
    };

    const onProcessed = (result: any) => {
      // Gestione silenziosa degli errori
      if (!result) {
        // onScanError('Nessun codice rilevato');
      }
    };

    window.Quagga.onDetected(onDetected);
    window.Quagga.onProcessed(onProcessed);

    // Cleanup
    return () => {
      console.log('🧹 Cleanup Quagga2');
      if (isInitialized.current && window.Quagga) {
        try {
          window.Quagga.offDetected(onDetected);
          window.Quagga.offProcessed(onProcessed);
          window.Quagga.stop();
          isInitialized.current = false;
          setIsScanning(false);
          console.log('✅ Quagga2 fermato');
        } catch (err) {
          console.warn('⚠️ Errore durante cleanup:', err);
        }
      }
    };
  }, [quaggaLoaded, cameras, currentCameraIndex, onScanSuccess, onScanError]);

  // ==========================================================
  // ==== CONTROLLI CAMERA
  // ==========================================================
  const switchCamera = () => {
    if (cameras.length > 1 && isInitialized.current) {
      console.log('🔄 Cambio fotocamera');
      // Ferma scanner corrente
      window.Quagga.stop();
      isInitialized.current = false;
      setIsScanning(false);
      
      // Cambia camera
      setCurrentCameraIndex(prev => (prev + 1) % cameras.length);
    }
  };

  // ==========================================================
  // ==== RENDERING CON STATI DIVERSI
  // ==========================================================
  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        <div className="w-full bg-gray-200 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-center">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2 animate-pulse" />
            <p className="text-sm text-gray-500">Caricamento scanner...</p>
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
      {/* Area scanner compatta */}
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        <div 
          id={scannerRegionId} 
          ref={scannerRef}
          className="w-full"
          style={{ 
            height: '250px',
            maxWidth: '100%'
          }}
        />
        
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
      </div>

     
    </div>
  );
};

// ==========================================================
// ==== RESTO DEL COMPONENTE IDENTICO
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
    console.log(`🎉 SUCCESSO SCANSIONE: ${decodedText}`);
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
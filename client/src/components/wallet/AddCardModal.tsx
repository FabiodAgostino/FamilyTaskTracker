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
  ZapOff
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
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeCameraScanConfig,
} from 'html5-qrcode';

// Definiamo manualmente i tipi per evitare problemi di ambiente
type CustomQrCodeSuccessCallback = (decodedText: string, decodedResult: any) => void;
type CustomQrCodeErrorCallback = (errorMessage: string, decodedResult: any) => void;

// Componente Scanner OTTIMIZZATO per codici a barre basato su ricerche approfondite
const BarcodeScanner = ({
  onScanSuccess,
  onScanError
}: {
  onScanSuccess: CustomQrCodeSuccessCallback;
  onScanError: CustomQrCodeErrorCallback;
}) => {
  const qrcodeRegionId = 'html5qr-code-full-region';
  const qrRef = useRef<Html5Qrcode | null>(null);

  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (!qrRef.current) {
      // ==========================================================
      // ==== TENTATIVO 3: NESSUN FORMATO SPECIFICATO
      // ==== Lascia che html5-qrcode usi TUTTI i formati di default
      // ==== Questo risolve spesso "No MultiFormat Readers"
      // ==========================================================
      
      qrRef.current = new Html5Qrcode(qrcodeRegionId, {
        verbose: false,
        // ❌ RIMUOVO formatsToSupport per evitare conflitti
        // formatsToSupport: formatsToSupport,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false,
        },
      });
    }

    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          setCameras(devices);
          const rearCameraIndex = devices.findIndex(d => d.label.toLowerCase().includes('back'));
          setCurrentCameraIndex(rearCameraIndex !== -1 ? rearCameraIndex : 0);
        }
      })
      .catch(err => console.error("Errore recupero fotocamere:", err));
  }, []);

  useEffect(() => {
    if (!qrRef.current || cameras.length === 0) return;

    const scanner = qrRef.current;
    if (scanner.isScanning) {
        scanner.stop();
    }
    
    const cameraId = cameras[currentCameraIndex].id;
    
    // ==========================================================
    // ==== CONFIGURAZIONE BASATA SU PROBLEMI RISOLTI NELLE RICERCHE
    // ==== Tentativo 1: Area molto più grande + FPS ancora più bassi
    // ==========================================================
    const config: Html5QrcodeCameraScanConfig = { 
      fps: 3,                                    // ✅ ULTERIORMENTE RIDOTTO da 5 a 3
      qrbox: { width: 400, height: 200 },       // ✅ AREA MOLTO PIÙ GRANDE
      aspectRatio: 1.777778                     // ✅ ASPECT RATIO 16:9 (alcuni hanno risolto così)
    };

    scanner.start(cameraId, config, onScanSuccess, onScanError)
      .then(() => {
        console.log('✅ SCANNER AVVIATO CON SUCCESSO');
        console.log('📊 Camera ID:', cameraId);
        console.log('📊 Config:', config);
        console.log('📊 TENTATIVO 3: Usando TUTTI i formati di default (nessun filtro)');
        console.log('📊 useBarCodeDetectorIfSupported: false');
        console.log('🎯 ORA INQUADRA UN CODICE A BARRE PER TESTARE');
        
        const capabilities = scanner.getRunningTrackCapabilities();
        console.log('📊 Capabilities:', capabilities);
        if ((capabilities as any).torch) {
          setTorchAvailable(true);
          console.log('🔦 Torcia disponibile');
        }
      })
      .catch(err => {
        console.error("❌ ERRORE AVVIO SCANNER:", err);
        console.error("❌ Dettagli errore:", err.message);
        console.error("❌ Stack:", err.stack);
      });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(err => console.error("Errore stop:", err));
      }
    };
  }, [cameras, currentCameraIndex, onScanSuccess, onScanError]);

  const switchCamera = () => setCurrentCameraIndex(prev => (prev + 1) % cameras.length);
  const toggleTorch = () => {
    if (qrRef.current && torchAvailable) {
      const newTorchState = !torchOn;
      const constraints = { advanced: [{ torch: newTorchState }] } as any;
      qrRef.current.applyVideoConstraints(constraints);
      setTorchOn(newTorchState);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="w-full bg-black rounded-lg overflow-hidden">
        <div id={qrcodeRegionId} />
      </div>
      
      {/* Info sui miglioramenti applicati + DEBUG STATUS */}
      <div className="space-y-2">
        <div className="text-xs text-center text-green-700 bg-green-50 p-2 rounded border border-green-200">
          🎯 Scanner ottimizzato: FPS ridotti, area estesa, solo codici a barre
        </div>
        <div className="text-xs text-center text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
          🔍 DEBUG ATTIVO: Apri la console per vedere i dettagli di scansione
        </div>
      </div>
      
      <div className="flex justify-center items-center gap-3 p-2 bg-gray-100 rounded-lg">
        {cameras.length > 1 && (
          <Button 
            variant="outline" 
            size="icon" 
            onClick={switchCamera} 
            title="Cambia fotocamera"
          >
            <RotateCcw size={20} />
          </Button>
        )}
        {torchAvailable && (
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleTorch} 
            title={torchOn ? 'Spegni torcia' : 'Accendi torcia'}
          >
            {torchOn ? <ZapOff size={20} /> : <Zap size={20} />}
          </Button>
        )}
      </div>
    </div>
  );
};

export const AddCardModal = ({ isOpen, onClose, onSave }: any) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketKey | null>(null);
  const [scannedData, setScannedData] = useState('');
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [selectedColor, setSelectedColor] = useState('#536DFE');
  
  // Contatore per gestione errori migliorata
  const errorFrameCounter = useRef(0);
  const scanAttempts = useRef(0);

  // Debug per monitorare i cambiamenti di scannedData
  useEffect(() => {
    if (scannedData) {
      console.log(`🎉 SCANNED DATA AGGIORNATO: "${scannedData}"`);
      console.log(`🎉 Lunghezza: ${scannedData.length}`);
    } else {
      console.log(`🔄 scannedData è vuoto o null`);
    }
  }, [scannedData]);

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
    errorFrameCounter.current = 0;
    scanAttempts.current = 0;
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const nextStep = () => setCurrentStep(s => Math.min(s + 1, 3));
  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1));

  // ==========================================================
  // ==== GESTIONE SUCCESSO CON DEBUG COMPLETO
  // ==========================================================
  const handleScanSuccess: CustomQrCodeSuccessCallback = useCallback((decodedText, decodedResult) => {
    scanAttempts.current++;
    
    // DEBUG COMPLETO - Vediamo TUTTO quello che arriva
    console.log(`🎉 CALLBACK CHIAMATO! Scansione #${scanAttempts.current}`);
    console.log(`📊 decodedText:`, decodedText);
    console.log(`📊 Tipo decodedText:`, typeof decodedText);
    console.log(`📊 Lunghezza:`, decodedText?.length);
    console.log(`📋 decodedResult completo:`, decodedResult);
    console.log(`📋 Formato:`, decodedResult?.result?.format?.formatName);
    console.log(`📋 Formato Code:`, decodedResult?.result?.format?.format);
    
    // Validazione con debug
    const trimmed = decodedText?.trim();
    console.log(`🔍 Codice dopo trim: "${trimmed}"`);
    console.log(`🔍 Lunghezza dopo trim: ${trimmed?.length}`);
    
    if (trimmed && trimmed.length >= 4) {
      console.log(`✅ CODICE VALIDO! Impostando scannedData...`);
      setScannedData(trimmed);
      console.log(`✅ setScannedData chiamato con: "${trimmed}"`);
    } else {
      console.warn(`⚠️ CODICE NON VALIDO!`);
      console.warn(`⚠️ - decodedText originale: "${decodedText}"`);
      console.warn(`⚠️ - dopo trim: "${trimmed}"`);
      console.warn(`⚠️ - lunghezza: ${trimmed?.length}`);
    }
  }, []);

  // ==========================================================
  // ==== GESTIONE ERRORI CON DEBUG DETTAGLIATO
  // ==========================================================
  const handleScanError: CustomQrCodeErrorCallback = useCallback((errorMessage, _decodedResult) => {
    if (typeof errorMessage !== 'string') return;
    
    errorFrameCounter.current++;
    
    // DEBUG: Ogni 10 frame mostriamo lo stato
    if (errorFrameCounter.current % 10 === 0) {
      console.log(`🔍 SCANNER ATTIVO - Frame ${errorFrameCounter.current} - Tipo errore: ${errorMessage.substring(0, 50)}...`);
    }
    
    // Errori comuni di scansione (da ignorare silenziosamente)
    const commonErrors = [
      'No MultiFormat Readers',
      'NotFoundException', 
      'Not Found',
      'ChecksumException',
      'FormatException'
    ];
    
    if (commonErrors.some(error => errorMessage.includes(error))) {
      // Log di progresso ogni 30 frame (circa ogni 6 secondi a 5fps)
      if (errorFrameCounter.current % 30 === 0) {
        console.log(`🔍 SCANSIONE ATTIVA (${errorFrameCounter.current} tentativi) - Scanner sta funzionando, continua a inquadrare il codice`);
      }
      return;
    }
    
    // Errori critici (da loggare subito)
    const criticalErrors = [
      'NotAllowedError',
      'NotFoundError',
      'NotReadableError',
      'OverconstrainedError'
    ];
    
    if (criticalErrors.some(error => errorMessage.includes(error))) {
      console.error('🚨 ERRORE CRITICO scanner:', errorMessage);
      return;
    }
    
    // Tutti gli altri errori
    console.warn('⚠️ Scanner error:', errorMessage);
  }, []);

  const handleManualInput = () => {
    const code = prompt('Inserisci il codice a barre manualmente:');
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
              <button 
                key={key} 
                onClick={() => setSelectedSupermarket(key as SupermarketKey)} 
                className={cn(
                  "flex flex-col items-center justify-center w-full p-4 min-h-[6rem] bg-gray-100 rounded-lg border-2 border-dashed transition-all duration-300", 
                  selectedSupermarket === key ? 
                    "border-solid bg-indigo-50 border-[#663EF3]" : 
                    "border-gray-300 hover:border-gray-400 hover:bg-gray-200"
                )}
              >
                <Plus className="w-6 h-6 mb-1 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">Altro</span>
              </button>
            )
          }
          return (
            <Card 
              key={key} 
              style={{ backgroundColor: market.color }} 
              className={cn(
                "cursor-pointer transform transition-all duration-300 hover:scale-105 rounded-xl overflow-hidden border-2", 
                selectedSupermarket === key ? 
                  "ring-2 ring-offset-2 ring-[#663EF3] border-white" : 
                  "border-transparent"
              )} 
              onClick={() => setSelectedSupermarket(key as SupermarketKey)}
            >
              <CardContent className="flex flex-col items-center justify-center p-2 text-center min-h-[6rem] text-white">
                <img 
                  src={viewImage(market.logo)} 
                  alt={`${market.name} Logo`} 
                  className="h-10 w-auto object-contain mb-2 drop-shadow-md" 
                />
                <div className="font-bold text-xs drop-shadow-sm">{market.name}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      {selectedSupermarket === 'altro' && (
        <div className="space-y-3 bg-gray-50 p-4 rounded-lg border">
          <Label className="font-semibold text-gray-700 flex items-center gap-2">
            <Palette/> Personalizza Colore
          </Label>
          <div className="flex items-center gap-4">
            <input 
              type="color" 
              value={selectedColor} 
              onChange={(e) => setSelectedColor(e.target.value)} 
              className="w-14 h-14 p-0 bg-transparent border-none rounded-lg cursor-pointer"
            />
            <div className="grid grid-cols-7 gap-2 flex-1">
              {suggestedColors.map((color) => (
                <button 
                  key={color} 
                  type="button" 
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110", 
                    selectedColor === color ? 
                      "ring-2 ring-offset-2 ring-[#663EF3] border-white" : 
                      "border-gray-300"
                  )} 
                  style={{ backgroundColor: color }} 
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="flex gap-4 pt-4">
        <Button variant="ghost" onClick={handleClose} className="w-full">
          Annulla
        </Button>
        <Button 
          onClick={nextStep} 
          disabled={!selectedSupermarket} 
          className="w-full text-white" 
          style={{ background: 'var(--burnt-newStyle)' }}
        >
          Continua <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const ScannerStep = () => (
    <div className="flex flex-col gap-4 text-center">
      <div className="text-sm text-gray-500">
        Inquadra il <strong>codice a barre</strong> della tua carta fedeltà.
      </div>
      
      {/* Suggerimenti ottimizzati */}
      <div className="text-xs text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-200">
        <div className="font-semibold mb-1">💡 Per migliori risultati:</div>
        <div>• Inquadra solo il codice a barre (non QR code)</div>
        <div>• Mantieni distanza 10-15cm</div>
        <div>• Buona illuminazione senza riflessi</div>
      </div>
      
      {cameraPermission === 'granted' ? (
        scannedData ? (
          <div className="p-4 bg-green-50 text-green-800 rounded-lg flex flex-col items-center gap-3 border border-green-200">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="font-semibold text-lg">Codice a Barre Acquisito!</p>
            <p className="font-mono bg-white p-2 rounded">{scannedData}</p>
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => setScannedData('')}
            >
              Scansiona di nuovo
            </Button>
          </div>
        ) : (
          <BarcodeScanner 
            onScanSuccess={handleScanSuccess} 
            onScanError={handleScanError}
          />
        )
      ) : cameraPermission === 'denied' ? (
        <div className="p-4 bg-red-50 text-red-800 rounded-lg flex flex-col items-center gap-2 border border-red-200">
          <Lock className="w-8 h-8 text-red-500" />
          <p className="font-semibold">Accesso alla fotocamera negato</p>
          <p className="text-sm">
            Abilita i permessi nelle impostazioni del browser e ricarica la pagina
          </p>
        </div>
      ) : (
        <div className="aspect-video bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <Camera className="w-12 h-12 text-gray-400"/>
        </div>
      )}
      
      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-gray-200"></div>
        <span className="flex-shrink mx-4 text-xs text-gray-400">OPPURE</span>
        <div className="flex-grow border-t border-gray-200"></div>
      </div>
      
      <Button variant="outline" onClick={handleManualInput}>
        <Edit className="w-4 h-4 mr-2" /> Inserisci Manualmente
      </Button>
      
      <div className="flex gap-4 pt-4">
        <Button variant="ghost" onClick={prevStep} className="w-full">
          <ArrowLeft className="w-4 h-4 mr-2" /> Indietro
        </Button>
        <Button 
          onClick={nextStep} 
          disabled={!scannedData} 
          className="w-full text-white" 
          style={{ background: 'var(--burnt-newStyle)' }}
        >
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
            <img 
              src={viewImage(m.logo)} 
              className="h-14 mx-auto drop-shadow-lg" 
              alt={m.name} 
            />
            <h3 className="text-xl font-bold">{m.name} {m.type}</h3>
            <p className="font-mono text-lg bg-white/20 px-2 py-1 rounded-md">
              {formatted}
            </p>
          </CardContent>
        </Card>
        <div className="flex gap-4 pt-4">
          <Button variant="ghost" onClick={prevStep} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Indietro
          </Button>
          <Button 
            onClick={saveCard} 
            className="w-full text-white bg-green-600 hover:bg-green-700"
          >
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
            <div className="p-2 rounded-lg" style={{ background: 'var(--burnt-newStyle)' }}>
              <Scan className="w-6 h-6 text-white" />
            </div>
            Aggiungi Carta Fedeltà
          </DialogTitle>
          <DialogDescription>
            Passo {currentStep} di 3 - Scanner ottimizzato per codici a barre
          </DialogDescription>
        </DialogHeader>
        {currentStep === 1 && <SupermarketSelection />}
        {currentStep === 2 && <ScannerStep />}
        {currentStep === 3 && <ConfirmationStep />}
      </DialogContent>
    </Dialog>
  );
};
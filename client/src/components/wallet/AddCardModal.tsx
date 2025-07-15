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
  Upload
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

// Definiamo manualmente i tipi per essere indipendenti dall'ambiente
type CustomQrCodeSuccessCallback = (decodedText: string, decodedResult: any) => void;
type CustomQrCodeErrorCallback = (errorMessage: string, decodedResult: any) => void;

// Componente Scanner con log di debug aggiunti
const BarcodeScanner = ({
  onScanSuccess,
  onScanError
}: {
  onScanSuccess: CustomQrCodeSuccessCallback;
  onScanError: CustomQrCodeErrorCallback;
}) => {
  console.log('[Scanner Debug] Componente BarcodeScanner renderizzato.');
  const qrcodeRegionId = 'html5qr-code-full-region';
  const qrRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    console.log('[Scanner Debug] Primo useEffect eseguito.');
    if (!qrRef.current) {
      const formats: Html5QrcodeSupportedFormats[] = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.EAN_8,
      ];
      console.log('[Scanner Debug] Creazione istanza Html5Qrcode con formati:', formats);
      qrRef.current = new Html5Qrcode(qrcodeRegionId, {
        verbose: false,
        formatsToSupport: formats,
      });
    }

    console.log('[Scanner Debug] Richiesta fotocamere...');
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          console.log('[Scanner Debug] Fotocamere trovate:', devices);
          setCameras(devices);
          const rearCameraIndex = devices.findIndex(d => d.label.toLowerCase().includes('back'));
          console.log(`[Scanner Debug] Fotocamera posteriore trovata all'indice: ${rearCameraIndex}`);
          setCurrentCameraIndex(rearCameraIndex !== -1 ? rearCameraIndex : 0);
        } else {
          console.log('[Scanner Debug] Nessuna fotocamera trovata.');
        }
      })
      .catch(err => console.error("[Scanner Debug] Errore nel recuperare le fotocamere:", err));
  }, []);

  useEffect(() => {
    console.log(`[Scanner Debug] Secondo useEffect eseguito. Prerequisiti: qrRef=${!!qrRef.current}, num_cameras=${cameras.length}`);
    if (!qrRef.current || cameras.length === 0) return;

    const scanner = qrRef.current;
    if (scanner.isScanning) {
      console.log('[Scanner Debug] Lo scanner è già attivo, lo fermo prima di riavviarlo.');
      scanner.stop();
    }
    
    const cameraId = cameras[currentCameraIndex].id;
    const config: Html5QrcodeCameraScanConfig = { fps: 10, qrbox: { width: 280, height: 150 } };
    
    console.log(`[Scanner Debug] Avvio scanner sulla fotocamera ID: ${cameraId}`, config);
    scanner.start(cameraId, config, onScanSuccess, onScanError)
      .then(() => {
        console.log('[Scanner Debug] Scanner avviato con successo.');
        try {
          const capabilities = scanner.getRunningTrackCapabilities();
          console.log('[Scanner Debug] Capacità della fotocamera:', capabilities);
          if ((capabilities as any).torch) {
            console.log('[Scanner Debug] La torcia è disponibile.');
            setTorchAvailable(true);
          }
        } catch (err) {
          console.warn('[Scanner Debug] Impossibile ottenere le capacità della fotocamera (normale su alcuni browser).', err);
        }
      })
      .catch(err => console.error("[Scanner Debug] ERRORE CRITICO all'avvio dello scanner:", err));

    return () => {
      console.log('[Scanner Debug] Eseguita funzione di pulizia (cleanup).');
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(err => console.error("[Scanner Debug] Errore durante lo stop nella pulizia:", err));
      }
    };
  }, [cameras, currentCameraIndex, onScanSuccess, onScanError]);

  const switchCamera = () => {
    console.log('[Scanner Debug] Cambio fotocamera...');
    setCurrentCameraIndex(prev => (prev + 1) % cameras.length);
  };

  const toggleTorch = () => {
    if (qrRef.current && torchAvailable) {
      const newTorchState = !torchOn;
      console.log(`[Scanner Debug] Attivazione torcia: ${newTorchState}`);
      const constraints = { advanced: [{ torch: newTorchState }] } as any;
      qrRef.current.applyVideoConstraints(constraints)
        .then(() => setTorchOn(newTorchState))
        .catch(err => console.error('[Scanner Debug] Errore attivazione torcia:', err));
    }
  };
  
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[Scanner Debug] Tentativo di scansione da file.');
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        const decodedText = await qrRef.current?.scanFile(file, false);
        if (decodedText) { onScanSuccess(decodedText, undefined); }
      } catch (err: any) { onScanError(err.message, undefined); }
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        <div id={qrcodeRegionId} style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="flex justify-center items-center gap-3 p-2 bg-gray-100 rounded-lg">
        {cameras.length > 1 && <Button variant="outline" size="icon" onClick={switchCamera} title="Cambia fotocamera"><RotateCcw size={20} /></Button>}
        {torchAvailable && <Button variant="outline" size="icon" onClick={toggleTorch} title={torchOn ? 'Spegni torcia' : 'Accendi torcia'}>{torchOn ? <ZapOff size={20} /> : <Zap size={20} />}</Button>}
        <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} title="Scansiona da file"><Upload size={20} /></Button>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileScan} className="hidden" />
      </div>
    </div>
  );
};


// Componente Modale principale completo
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

  const handleScanSuccess: CustomQrCodeSuccessCallback = useCallback((decodedText, decodedResult) => {
    console.log(`%c[Scanner Debug] SUCCESSO! Dati: ${decodedText}`, 'color: green; font-weight: bold;', decodedResult);
    setScannedData(decodedText);
  }, []);

  const handleScanError: CustomQrCodeErrorCallback = useCallback((errorMessage, _decodedResult) => {
    // Non loggare l'errore più comune per non intasare la console
    if (errorMessage.includes('No MultiFormat Readers')) return;
    
    // Logga solo gli errori di scansione inaspettati
    console.warn('[Scanner Debug] Errore di scansione:', errorMessage);
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
      <div className="text-sm text-gray-500">Inquadra il codice a barre o QR della tua carta fedeltà.</div>
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
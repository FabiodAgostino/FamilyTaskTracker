import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scan,
  Globe,
  Lock,
  Camera,
  RotateCcw,
  Edit,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Plus,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, viewImage } from '@/lib/utils';
import { supermarketData, type SupermarketKey, suggestedColors } from './walletConstants'; // Assicurati che questi dati siano corretti
import { Html5Qrcode } from 'html5-qrcode';


const Html5QrcodePlugin = ({
  onScanSuccess,
  onScanError,
  cameraPermission
}: {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  cameraPermission: 'granted';
}) => {
  const qrcodeRegionId = 'html5qr-code-full-region';
  const qrRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  useEffect(() => {
    // Questa parte rimane invariata
    if (cameraPermission !== 'granted' || qrRef.current) return;
    qrRef.current = new Html5Qrcode(qrcodeRegionId, { verbose: false });
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          setCameras(devices);
          const rearCameraIndex = devices.findIndex(device =>
            device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment')
          );
          setCurrentCameraIndex(rearCameraIndex !== -1 ? rearCameraIndex : 0);
        }
      })
      .catch(err => console.error("Errore nel recuperare le fotocamere:", err));
  }, [cameraPermission]);

  useEffect(() => {
    if (!qrRef.current || cameras.length === 0 || qrRef.current.isScanning) return;
    
    // ===============================================
    // ==== LA MODIFICA È QUI DENTRO =================
    // ===============================================
    
    // 1. Definiamo un oggetto di configurazione
    const config = {
      fps: 10,
      qrbox: { width: 280, height: 150 },
      // 2. Aggiungiamo la lista dei formati da scansionare
      formatsToScan: [
        (window as any).Html5QrcodeSupportedFormats.QR_CODE,
        (window as any).Html5QrcodeSupportedFormats.EAN_13,
        (window as any).Html5QrcodeSupportedFormats.CODE_128,
        (window as any).Html5QrcodeSupportedFormats.EAN_8,
        (window as any).Html5QrcodeSupportedFormats.CODE_39,
      ]
    };
    
    const cameraId = cameras[currentCameraIndex].id;
    
    // 3. Passiamo il nuovo oggetto 'config' alla funzione start
    qrRef.current.start(
      cameraId,
      config, // <-- Usiamo la configurazione completa
      onScanSuccess,
      onScanError
    ).catch(err => console.error("Impossibile avviare lo scanner:", err));

    return () => {
      if (qrRef.current?.isScanning) {
        qrRef.current.stop().catch(err => console.error("Errore durante lo stop:", err));
      }
    };
  }, [cameras, currentCameraIndex, onScanSuccess, onScanError]);

  const switchCamera = async () => {
    // Questa parte rimane invariata
    if (!qrRef.current || cameras.length < 2 || !qrRef.current.isScanning) return;
    try {
      await qrRef.current.stop();
      setCurrentCameraIndex(prevIndex => (prevIndex + 1) % cameras.length);
    } catch (err) {
      console.error("Errore nello switch della fotocamera:", err);
      setCurrentCameraIndex(prevIndex => (prevIndex + 1) % cameras.length);
    }
  };

  return (
    // Questa parte rimane invariata
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <div id={qrcodeRegionId} style={{ width: '100%', height: '100%' }} />
      {cameras.length > 1 && (
        <Button
          variant="outline"
          size="icon"
          onClick={switchCamera}
          className="absolute top-3 right-3 bg-black/40 text-white border-white/40 hover:bg-black/60 hover:text-white"
        >
          <RotateCcw size={20} />
        </Button>
      )}
    </div>
  );
};

export const AddCardModal = ({ isOpen, onClose, onSave }: any) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketKey | null>(null);
  const [scannedData, setScannedData] = useState('');
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  
  // Stati per lo Step 1 (reintrodotti)
  const [selectedColor, setSelectedColor] = useState('#536DFE');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);


  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
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
    setIsColorPickerOpen(false);
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const nextStep = () => setCurrentStep(s => Math.min(s + 1, 3));
  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1));

  const handleScanSuccess = useCallback((decodedText: string) => {
    setScannedData(decodedText);
  }, []);

  const handleScanError = useCallback((error: string) => {
    if (!error.includes('No MultiFormat Readers')) {
      console.warn('Scan error', error);
    }
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
  
  // ===========================================
  // STEP 1: SELEZIONE SUPERMERCATO (REINTRODOTTO)
  // ===========================================
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
                  selectedSupermarket === key
                    ? "border-solid bg-indigo-50 border-[#663EF3]"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-200"
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
                selectedSupermarket === key
                  ? "ring-2 ring-offset-2 ring-[#663EF3] border-white"
                  : "border-transparent"
              )}
              onClick={() => setSelectedSupermarket(key as SupermarketKey)}
            >
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
                         selectedColor === color ? "ring-2 ring-offset-2 ring-[#663EF3] border-white" : "border-gray-300"
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
        <Button variant="ghost" onClick={handleClose} className="w-full">Annulla</Button>
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

  // ===========================================
  // STEP 2: SCANNER (GIÀ CORRETTO)
  // ===========================================
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
        ) : (
          <Html5QrcodePlugin onScanSuccess={handleScanSuccess} onScanError={handleScanError} cameraPermission={cameraPermission} />
        )
      ) : cameraPermission === 'denied' ? (
        <div className="p-4 bg-red-50 text-red-800 rounded-lg flex flex-col items-center gap-2 border border-red-200">
          <Lock className="w-8 h-8 text-red-500" />
          <p className="font-semibold">Accesso alla fotocamera negato</p>
          <p className="text-sm">Abilita i permessi dal tuo browser per usare lo scanner.</p>
        </div>
      ) : (
        <div className="aspect-video bg-gray-200 animate-pulse rounded-lg flex items-center justify-center"><Camera className="w-12 h-12 text-gray-400"/></div>
      )}
      <Button variant="outline" onClick={handleManualInput}><Edit className="w-4 h-4 mr-2" /> Inserisci Manualmente</Button>
      <div className="flex gap-4 pt-4">
        <Button variant="ghost" onClick={prevStep} className="w-full"><ArrowLeft className="w-4 h-4 mr-2" /> Indietro</Button>
        <Button onClick={nextStep} disabled={!scannedData} className="w-full text-white" style={{ background: 'var(--burnt-newStyle)' }}>
          Continua <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  // ===========================================
  // STEP 3: CONFERMA (REINTRODOTTO)
  // ===========================================
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
             <div className="p-2 rounded-lg" style={{ background: 'var(--burnt-newStyle)' }}>
                 <Scan className="w-6 h-6 text-white" />
             </div>
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
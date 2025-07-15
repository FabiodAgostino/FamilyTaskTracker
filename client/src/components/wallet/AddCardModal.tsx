import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scan,
  Lock,
  Camera,
  RotateCcw,
  Edit,
  CheckCircle,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, viewImage } from '@/lib/utils';
import { supermarketData, type SupermarketKey } from './walletConstants'; // Assumendo che i dati siano qui
import { Html5Qrcode } from 'html5-qrcode';

// Plugin scanner aggiornato e migliorato
const Html5QrcodePlugin = ({
  onScanSuccess,
  onScanError,
  cameraPermission
}: {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  cameraPermission: 'granted'; // Lavoriamo solo quando i permessi sono garantiti
}) => {
  const qrcodeRegionId = 'html5qr-code-full-region';
  const qrRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  // 1. Inizializza e ottieni le fotocamere, preferendo quella posteriore
  useEffect(() => {
    if (cameraPermission !== 'granted' || qrRef.current) return;

    qrRef.current = new Html5Qrcode(qrcodeRegionId, { verbose: false });

    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          setCameras(devices);
          // Cerca la fotocamera posteriore
          const rearCameraIndex = devices.findIndex(device =>
            device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment')
          );
          // Se la trova, la imposta come default, altrimenti usa la prima (index 0)
          setCurrentCameraIndex(rearCameraIndex !== -1 ? rearCameraIndex : 0);
        }
      })
      .catch(err => console.error("Errore nel recuperare le fotocamere:", err));

  }, [cameraPermission]);

  // 2. Avvia lo scanner quando le fotocamere sono caricate o l'indice cambia
  useEffect(() => {
    if (!qrRef.current || cameras.length === 0 || qrRef.current.isScanning) return;

    const cameraId = cameras[currentCameraIndex].id;
    qrRef.current.start(
      cameraId,
      // 2. Area di scansione rettangolare
      { fps: 10, qrbox: { width: 280, height: 150 } },
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
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <div id={qrcodeRegionId} style={{ width: '100%', height: '100%' }} />

      {/* 3. Overlay e guida visiva per la scansione */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[280px] h-[150px] relative">
          <div className="absolute inset-0" style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)' }}></div>
          <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-white/80 rounded-tl-lg"></div>
          <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-white/80 rounded-tr-lg"></div>
          <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-white/80 rounded-bl-lg"></div>
          <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-white/80 rounded-br-lg"></div>
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/70 animate-pulse"></div>
        </div>
      </div>

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
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

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
    setIsScanning(false);
    setCameraPermission('unknown');
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const nextStep = () => setCurrentStep(s => Math.min(s + 1, 3));
  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1));

  const handleScanSuccess = useCallback((decodedText: string) => {
    setScannedData(decodedText);
    setIsScanning(false); // Ferma la visualizzazione dello scanner e mostra il risultato
  }, []);

  const handleScanError = useCallback((error: string) => {
    // Evitiamo il logging continuo dell'errore "no code found"
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
    // Logica di salvataggio...
    handleClose();
  };

  const ScannerStep = () => (
    <div className="flex flex-col gap-4 text-center">
      <div className="text-sm text-gray-500">
        Inquadra il codice a barre o QR della tua carta fedeltà.
      </div>

      {cameraPermission === 'granted' && (
        scannedData ? (
          <div className="p-4 bg-green-50 text-green-800 rounded-lg flex flex-col items-center gap-3 border border-green-200">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="font-semibold text-lg">Codice Acquisito!</p>
            <p className="font-mono bg-white p-2 rounded">{scannedData}</p>
            <Button variant="link" size="sm" onClick={() => setScannedData('')}>
              Scansiona di nuovo
            </Button>
          </div>
        ) : (
          <Html5QrcodePlugin
            onScanSuccess={handleScanSuccess}
            onScanError={handleScanError}
            cameraPermission={cameraPermission}
          />
        )
      )}

      {cameraPermission === 'denied' && (
         <div className="p-4 bg-red-50 text-red-800 rounded-lg flex flex-col items-center gap-2 border border-red-200">
            <Lock className="w-8 h-8 text-red-500" />
            <p className="font-semibold">Accesso alla fotocamera negato</p>
            <p className="text-sm">Abilita i permessi dal tuo browser per usare lo scanner.</p>
        </div>
      )}
      
      {cameraPermission === 'unknown' && (
        <div className="aspect-video bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
            <Camera className="w-12 h-12 text-gray-400"/>
        </div>
      )}

      <Button variant="outline" onClick={handleManualInput}>
        <Edit className="w-4 h-4 mr-2" />
        Inserisci Manualmente
      </Button>

      <div className="flex gap-4 pt-4">
        <Button variant="ghost" onClick={prevStep} className="w-full">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Indietro
        </Button>
        <Button
          onClick={nextStep}
          disabled={!scannedData}
          className="w-full text-white"
          style={{ background: 'var(--burnt-newStyle)' }}
        >
          Continua
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
       {/* 3. Modale leggermente più larga */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
             <div className="p-2 rounded-lg" style={{ background: 'var(--burnt-newStyle)' }}>
                 <Scan className="w-6 h-6 text-white" />
             </div>
            Aggiungi Carta Fedeltà
          </DialogTitle>
          <DialogDescription>
            Passo {currentStep} di 3 - Seleziona, scansiona e conferma.
          </DialogDescription>
        </DialogHeader>
        
        {currentStep === 1 && <div>{/* Il tuo componente SupermarketSelection qui */}</div>}
        {currentStep === 2 && <ScannerStep />}
        {currentStep === 3 && <div>{/* Il tuo componente ConfirmationStep qui */}</div>}

      </DialogContent>
    </Dialog>
  );
};
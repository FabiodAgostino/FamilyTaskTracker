import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scan,
  Globe,
  Lock,
  Camera,
  RotateCcw
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
import { supermarketData, type SupermarketKey, suggestedColors } from './walletConstants';
import { Html5Qrcode } from 'html5-qrcode';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cardData: any) => void;
}

// Carica dinamicamente la libreria html5-qrcode
const useHtml5QrcodeLoader = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.async = true;

    script.onload = () => {
      setIsLoaded(true);
      setIsLoading(false);
    };
    script.onerror = () => {
      setError('Errore caricamento libreria scanner');
      setIsLoading(false);
    };

    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return { isLoaded, isLoading, error };
};

// Plugin scanner minimal
const Html5QrcodePlugin = ({
  onScanSuccess,
  onScanError,
  cameraPermission
}: {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  cameraPermission: 'unknown' | 'granted' | 'denied';
}) => {
  const qrcodeRegionId = 'html5qr-code-full-region';
  const qrRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  // STEP 1: Inizializza l'istanza e ottieni le fotocamere una sola volta
  useEffect(() => {
    if (cameraPermission !== 'granted' || qrRef.current) return;

    // Crea l'istanza una sola volta
    qrRef.current = new Html5Qrcode(qrcodeRegionId, {
      verbose: false // Opzionale: riduce i log in console
    });

    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          setCameras(devices);
        }
      })
      .catch(err => {
        console.error("Errore nel recuperare le fotocamere:", err);
      });
  }, [cameraPermission]);

  // STEP 2: Avvia lo scanner quando le fotocamere sono state caricate
  useEffect(() => {
    if (!qrRef.current || cameras.length === 0 || qrRef.current.isScanning) return;

    const cameraId = cameras[currentCameraIndex].id;
    qrRef.current.start(
      cameraId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      onScanError
    ).catch(err => {
      console.error("Impossibile avviare lo scanner:", err);
    });

    // Funzione di pulizia per quando il componente viene smontato
    return () => {
      if (qrRef.current?.isScanning) {
        qrRef.current.stop().catch(err => console.error("Errore durante lo stop:", err));
      }
    };
  }, [cameras, currentCameraIndex]); // Si attiva solo se cambiano le fotocamere o l'indice

  // STEP 3: Funzione dedicata e asincrona per il cambio fotocamera
  const switchCamera = async () => {
    if (!qrRef.current || cameras.length < 2) return;

    // Assicurati che lo scanner sia in esecuzione prima di fermarlo
    if (qrRef.current.isScanning) {
      try {
        // Ferma lo scanner e ATTENDI che l'operazione sia completata
        await qrRef.current.stop();

        // Calcola il nuovo indice e aggiorna lo stato
        const newIndex = (currentCameraIndex + 1) % cameras.length;
        setCurrentCameraIndex(newIndex);
        
        // Lo useEffect [cameras, currentCameraIndex] si occuperà di riavviare lo scanner
        
      } catch (err) {
        console.error("Errore nello switch della fotocamera:", err);
        // Se lo stop fallisce, prova comunque a riavviare lo scanner
        const newIndex = (currentCameraIndex + 1) % cameras.length;
        setCurrentCameraIndex(newIndex);
      }
    }
  };

  return (
    <div className="relative w-full">
      <div id={qrcodeRegionId} style={{ width: '100%' }} />
      {cameras.length > 1 && (
        <button
          onClick={switchCamera} // Usa la nuova funzione
          className="absolute top-2 right-2 bg-white bg-opacity-50 p-2 rounded-full"
        >
          <RotateCcw size={20} color="black" /> {/* Icona più chiara */}
        </button>
      )}
    </div>
  );
};

export const AddCardModal = ({ isOpen, onClose, onSave }: AddCardModalProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketKey | null>(null);
  const [scannedData, setScannedData] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366F1');
  const [isCardPublic, setIsCardPublic] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const { isLoaded, isLoading, error: loadError } = useHtml5QrcodeLoader();

  // Richiedi permessi all'apertura
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

  const resetModal = () => {
    setCurrentStep(1);
    setSelectedSupermarket(null);
    setScannedData('');
    setSelectedColor('#6366F1');
    setIsCardPublic(false);
    setIsColorPickerOpen(false);
    setIsScanning(false);
    setCameraPermission('unknown');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const nextStep = () => setCurrentStep(s => Math.min(s + 1, 3));
  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1));

  const handleScanSuccess = useCallback((decodedText: string) => {
    setScannedData(decodedText);
    setIsScanning(false);
  }, []);

  const handleScanError = useCallback((error: string) => {
    console.warn('Scan error', error);
  }, []);

  // Avvia scanner automaticamente allo step 2
  useEffect(() => {
    if (currentStep === 2 && isLoaded && !isScanning && cameraPermission === 'granted') {
      setIsScanning(true);
    }
  }, [currentStep, isLoaded, cameraPermission]);

  const handleManualInput = () => {
    const code = prompt('Inserisci il codice manualmente:');
    if (code) {
      setScannedData(code.trim());
      setIsScanning(false);
    }
  };

  const saveCard = () => {
    if (!selectedSupermarket) return;
    const m = supermarketData[selectedSupermarket];
    const formatted = scannedData.length > 12
      ? scannedData.replace(/(.{4})/g, '$1 ').trim()
      : scannedData;
    onSave({
      name: `${m.name} ${m.type}`,
      number: formatted,
      brand: m.name,
      logo: m.logo,
      barcode: scannedData,
      priority: 0,
      lastUsed: new Date(),
      color: selectedSupermarket === 'altro' ? selectedColor : m.color,
      isPublic: isCardPublic
    });
    handleClose();
  };

  const SupermarketSelection = () => (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold mb-4 block text-gray-800">Seleziona il Negozio</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(supermarketData).map(([key, market]) => (
            market.name !== "ALTRO" ? (
              <Card
                key={key}
                style={{ backgroundColor: market.color }}
                className={cn(
                  "cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-lg rounded-xl overflow-hidden border-2",
                  selectedSupermarket === key
                    ? "ring-4 ring-blue-400 border-blue-400 shadow-xl scale-105"
                    : "border-transparent hover:border-white/30"
                )}
                onClick={() => setSelectedSupermarket(key as SupermarketKey)}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center min-h-[7rem] text-white">
                  <img
                    src={viewImage(market.logo)}
                    alt={`${market.name} Logo`}
                    className="h-12 w-auto object-contain mb-2 drop-shadow-md"
                  />
                  <div className="font-bold text-sm drop-shadow-sm">{market.name}</div>
                </CardContent>
              </Card>
            ) : (
              <button
                key={key}
                onClick={() => setSelectedSupermarket(key as SupermarketKey)}
                className={cn(
                  "flex flex-col items-center justify-center w-full p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl border-2 border-dashed transition-all duration-300",
                  selectedSupermarket === key 
                    ? "border-blue-400 bg-blue-50 ring-4 ring-blue-400 shadow-xl" 
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-200"
                )}
              >
                <div className="text-2xl mb-2">{market.logo}</div>
                <span className="text-sm font-semibold text-gray-700">Altro Negozio</span>
              </button>
            )
          ))}
        </div>
      </div>

      {/* Color picker per "altro" */}
      {selectedSupermarket === 'altro' && (
        <div className="space-y-4 bg-gray-50 p-6 rounded-xl border">
          <Label className="text-lg font-semibold text-gray-800">Personalizza Colore</Label>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="w-20 h-20 p-0 border-4 border-gray-300 rounded-xl hover:border-blue-400 transition-all duration-300"
              style={{ backgroundColor: selectedColor }}
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
            >
              <div className="w-full h-full rounded-lg shadow-inner" style={{ backgroundColor: selectedColor }}></div>
            </Button>

            {isColorPickerOpen && (
              <div className="absolute z-50 mt-32 w-96 p-6 bg-white border-2 rounded-xl shadow-2xl">
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-gray-800">Seleziona Colore</div>
                  
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full h-16 rounded-lg border-2 cursor-pointer"
                  />
                  
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-600">Colori Popolari</div>
                    <div className="grid grid-cols-7 gap-2">
                      {suggestedColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={cn(
                            "w-8 h-8 rounded-lg border-2 transition-all duration-200 hover:scale-110",
                            selectedColor === color 
                              ? "ring-4 ring-blue-400 border-blue-400 scale-110" 
                              : "border-gray-300 hover:border-gray-500"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setSelectedColor(color)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={() => setIsColorPickerOpen(false)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2"
                    >
                      Conferma
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-700 mb-1">
                Colore Selezionato
              </div>
              <div className="text-xs text-gray-500 font-mono bg-white px-3 py-1 rounded border">
                {selectedColor.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="text-center pt-4">
            <div className="text-sm font-medium text-gray-600 mb-3">Anteprima Carta</div>
            <div 
              className="mx-auto w-32 h-20 rounded-lg border-2 border-white flex items-center justify-center text-white font-bold text-2xl shadow-lg"
              style={{ backgroundColor: selectedColor }}
            >
              ❓
            </div>
          </div>
        </div>
      )}
      
      <div className="flex gap-4 pt-4">
        <Button variant="outline" onClick={handleClose} className="flex-1 py-3">
          Annulla
        </Button>
        <Button 
          onClick={nextStep}
          disabled={!selectedSupermarket}
          className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
        >
          Continua →
        </Button>
      </div>
    </div>
  );

  const ScannerStep = () => (
    <div className="space-y-6">
      <Card className="bg-gray-900 text-white">
        <CardContent className="p-0">
          {isLoading && <div className="h-64 flex items-center justify-center">Caricamento...</div>}
          {loadError && <div className="h-64 flex items-center justify-center text-red-400">{loadError}</div>}
          {!loadError && (
            <div className="relative h-64">
              {isScanning
                ? <Html5QrcodePlugin onScanSuccess={handleScanSuccess} onScanError={handleScanError} cameraPermission={cameraPermission} />
                : <div className="h-full flex items-center justify-center text-blue-400"><Camera className="w-12 h-12 animate-pulse" /></div>
              }
            </div>
          )}
        </CardContent>
      </Card>
      {scannedData && (
        <div className="p-4 bg-green-50 text-green-800 rounded">{scannedData}</div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>← Indietro</Button>
        <Button onClick={nextStep} disabled={!scannedData}>Continua →</Button>
      </div>
    </div>
  );

  const ConfirmationStep = () => {
    if (!selectedSupermarket) return null;
    const m = supermarketData[selectedSupermarket];
    const formatted = scannedData.length > 12
      ? scannedData.replace(/(.{4})/g, '$1 ').trim()
      : scannedData;
    return (
      <div className="space-y-6">
        <Card className="mx-auto" style={{ backgroundColor: selectedSupermarket === 'altro' ? selectedColor : m.color }}>
          <CardContent className="text-center text-white p-6">
            <img src={viewImage(m.logo)} className="h-16 mx-auto mb-4" alt={m.name} />
            <h3 className="text-xl font-bold">{m.name} {m.type}</h3>
            <p className="font-mono">{formatted}</p>
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>← Indietro</Button>
          <Button onClick={saveCard} className="bg-green-600 text-white">Salva Carta</Button>
        </div>
      </div>
    );
  };
return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aggiungi Carta Fedeltà</DialogTitle>
          <DialogDescription>Scanner QR e barcode</DialogDescription>
        </DialogHeader>
        <div className="my-4 flex justify-center space-x-4">
          {[1,2,3].map(step => (
            <div key={step} className={cn('h-2 w-2 rounded-full', currentStep===step ? 'bg-blue-500':'bg-gray-300')} />
          ))}
        </div>
        {currentStep===1 && <SupermarketSelection />}
        {currentStep===2 && <ScannerStep />}
        {currentStep===3 && <ConfirmationStep />}
      </DialogContent>
    </Dialog>
  );
};


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

// Definizioni TypeScript per html5-qrcode
declare global {
  interface Window {
    Html5QrcodeScanner?: new (
      elementId: string,
      config?: any,
      verbose?: boolean
    ) => any;
    Html5QrcodeSupportedFormats?: {
      QR_CODE: number;
      CODE_128: number;
      EAN_13: number;
      UPC_A: number;
      UPC_E: number;
      EAN_8: number;
      CODE_39: number;
      CODE_93: number;
      CODABAR: number;
      ITF: number;
      PDF_417: number;
      DATA_MATRIX: number;
    };
    Html5QrcodeScanType?: {
      SCAN_TYPE_CAMERA: number;
      SCAN_TYPE_FILE: number;
    };
  }
}

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cardData: any) => void;
}

// Hook per caricare html5-qrcode
const useHtml5QrcodeLoader = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verifica se già caricato
    if (typeof window !== 'undefined' && window.Html5QrcodeScanner) {
      setIsLoaded(true);
      return;
    }

    // Polyfill per globalThis (risolve problemi versione 2.3.8)
    if (typeof globalThis === 'undefined') {
      (window as any).globalThis = window;
    }

    setIsLoading(true);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.async = true;

    script.onload = () => {
      console.log('✅ html5-qrcode library loaded successfully');
      setIsLoaded(true);
      setIsLoading(false);
    };

    script.onerror = () => {
      console.error('❌ Failed to load html5-qrcode library');
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

// Componente Scanner ottimizzato
  const Html5QrcodePlugin = ({ 
    onScanSuccess,
    onScanError,
    cameraPermission
  }: {
    onScanSuccess: (decodedText: string, decodedResult: any) => void;
    onScanError?: (error: string) => void;
    cameraPermission: 'unknown' | 'granted' | 'denied';
  }) => {
  const qrcodeRegionId = "html5qr-code-full-region";
  const html5QrcodeScannerRef = useRef<any>(null);
  const initializationStateRef = useRef<'idle' | 'initializing' | 'initialized'>('idle');

  // Callback memoization per prevenire re-render
  const handleScanSuccess = useCallback((decodedText: string, decodedResult: any) => {
    console.log('✅ Scan success:', decodedText);
    onScanSuccess(decodedText, decodedResult);
  }, [onScanSuccess]);

  const handleScanError = useCallback((error: string) => {
    // Filtra errori comuni durante la scansione
    if (error.includes('No QR code found') || 
        error.includes('couldn\'t find enough finder patterns') ||
        error.includes('NotFoundException')) {
      return;
    }
    if (onScanError) {
      onScanError(error);
    }
  }, [onScanError]);

  useEffect(() => {
    // Prevenire doppia inizializzazione in React Strict Mode
    if (initializationStateRef.current !== 'idle') {
      return;
    }

    if (typeof window === 'undefined' || !window.Html5QrcodeScanner) {
      console.error('Html5QrcodeScanner not available');
      return;
    }

    initializationStateRef.current = 'initializing';

    try {
      // Configurazione ottimizzata per barcode retail
      const config = {
        fps: 10,
        qrbox: { width: 420, height: 300 }, // Dimensioni ottimali per barcode
        aspectRatio: 1.0,
        disableFlip: false,
        formatsToSupport: window.Html5QrcodeSupportedFormats ? [
          window.Html5QrcodeSupportedFormats.QR_CODE,
          window.Html5QrcodeSupportedFormats.CODE_128,
          window.Html5QrcodeSupportedFormats.EAN_13,
          window.Html5QrcodeSupportedFormats.UPC_A,
          window.Html5QrcodeSupportedFormats.UPC_E,
          window.Html5QrcodeSupportedFormats.EAN_8
        ] : undefined,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        supportedScanTypes: window.Html5QrcodeScanType ? 
          [window.Html5QrcodeScanType.SCAN_TYPE_CAMERA] : undefined,
        rememberLastUsedCamera: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

    if (cameraPermission !== 'granted') {
      console.warn('Camera permission non valida, skip scanner init');
      return;
    }
    // Se non ho il permesso, non inizializzo
    if (cameraPermission !== 'granted') {
      console.warn('Camera permission non valida, skip scanner init');
      return;
    }
    html5QrcodeScannerRef.current = new window.Html5QrcodeScanner(
      qrcodeRegionId,
      config,
      false // verbose
    );
    html5QrcodeScannerRef.current.render(handleScanSuccess, handleScanError);
      initializationStateRef.current = 'initialized';
      console.log('✅ Html5QrcodeScanner initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Html5QrcodeScanner:', error);
      initializationStateRef.current = 'idle';
    }

    return () => {
      if (html5QrcodeScannerRef.current && initializationStateRef.current === 'initialized') {
        html5QrcodeScannerRef.current.clear()
          .then(() => {
            console.log('✅ Html5QrcodeScanner cleaned up successfully');
            initializationStateRef.current = 'idle';
          })
          .catch((error: any) => {
            console.error('Failed to clear html5QrcodeScanner:', error);
            initializationStateRef.current = 'idle';
          });
      }
    };
  }, [handleScanSuccess, handleScanError]);

  return <div id={qrcodeRegionId} style={{ width: '100%' }} />;
};

export const AddCardModal = ({ isOpen, onClose, onSave }: AddCardModalProps) => {


  // Stati base
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketKey | null>(null);
  const [scannedData, setScannedData] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366F1');
  const [isCardPublic, setIsCardPublic] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
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

  // Hook per caricare libreria
  const { isLoaded, isLoading, error: loadError } = useHtml5QrcodeLoader();

 const checkCameraPermission = useCallback(async () => {
   // Usiamo direttamente lo stato già calcolato
   return cameraPermission === 'granted';
   }, [cameraPermission]);


  // Reset modal
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

  // Gestori eventi
  const handleClose = () => {
    resetModal();
    onClose();
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Callbacks scanner
  const handleScanSuccess = useCallback((decodedText: string, decodedResult: any) => {
    setScannedData(decodedText);
    setIsScanning(false);
  }, []);

  const handleScanError = useCallback((error: string) => {
    // console.warn('Scan error:', error);
  }, []);

  // Avvia scanner
  const startScanner = async () => {
    if (!isLoaded) return;
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) {
      alert('Permesso fotocamera necessario per la scansione.');
      return;
    }
    setIsScanning(true);
  };
  // Inserimento manuale
  const handleManualInput = () => {
    const code = prompt('Inserisci il codice manualmente:');
    if (code?.trim()) {
      setScannedData(code.trim());
      setIsScanning(false);
    }
  };

  // Salva carta
  const saveCard = () => {
    if (!selectedSupermarket) return;

    const marketData = supermarketData[selectedSupermarket];
    const formattedNumber = scannedData.length > 12 ? 
      scannedData.replace(/(.{4})/g, '$1 ').trim() : 
      scannedData;
    
    const cardData = {
      name: `${marketData.name} ${marketData.type}`,
      number: formattedNumber,
      brand: marketData.name,
      logo: marketData.logo,
      barcode: scannedData,
      priority: 0,
      lastUsed: new Date(),
      color: selectedSupermarket === 'altro' ? selectedColor : marketData.color,
      isPublic: isCardPublic
    };

    onSave(cardData);
    handleClose();
  };

  // STEP 1: Selezione Supermercato
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
  useEffect(() => {
    if (currentStep === 2 && isLoaded && !isScanning) {
      startScanner();
    }
  }, [currentStep, isLoaded]);
  // STEP 2: Scanner
  const ScannerStep = () => (
    <div className="space-y-6">
      <div className="relative mx-auto w-full max-w-md">
        <Card className="bg-gradient-to-br from-gray-900 to-black text-white border-2">
          <CardContent className="text-center">
            {/* Container per scanner */}
            <div className="relative w-full bg-gray-900 rounded-xl overflow-hidden border-4 border-blue-400/50">
              
              {/* Gestione stati */}
              {isLoading && (
                <div className="flex items-center justify-center h-[300px] text-blue-400 text-center p-8">
                  <div>
                    <Camera className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                    <div className="text-lg font-semibold">Caricamento Libreria...</div>
                    <div className="text-sm opacity-75 mt-2">Attendere prego</div>
                  </div>
                </div>
              )}

              {loadError && (
                <div className="flex items-center justify-center h-[300px] text-red-400 text-center p-8">
                  <div>
                    <div className="text-lg font-semibold">❌ Errore Caricamento</div>
                    <div className="text-sm opacity-75 mt-2">{loadError}</div>
                  </div>
                </div>
              )}

              {!isLoading && !loadError && !scannedData && (
                <div className="w-full min-h-[300px]">
                  {isScanning && isLoaded ? (
                    <Html5QrcodePlugin
                      onScanSuccess={handleScanSuccess}
                      onScanError={handleScanError} cameraPermission={cameraPermission}                    />
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-blue-400 text-center p-8">
                      <div>
                        <Camera className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                        <div className="text-lg font-semibold">Scanner Pronto</div>
                        <div className="text-sm opacity-75 mt-2">
                          {!isLoaded ? 'Libreria non caricata' : 
                           cameraPermission === 'denied' ? 'Permessi camera negati' :
                           'Premi "Avvia Scanner"'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Risultato scansione */}
      {scannedData && (
        <div className="text-center p-6 bg-green-50 rounded-xl border-2 border-green-200">
          <div className="text-lg font-semibold text-green-800 mb-3">✅ Codice Rilevato</div>
          <div className="font-mono text-xl font-bold text-green-900 bg-white px-4 py-2 rounded border break-all">
            {scannedData}
          </div>
        </div>
      )}
      
      {/* Controlli scanner */}
      <div className="flex gap-3 justify-center">
        {/* {!isScanning && !scannedData && isLoaded && !loadError && (
          <Button 
            onClick={startScanner}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3"
          >
            <Camera className="w-5 h-5 mr-2" />
            Avvia Scanner
          </Button>
        )} */}
        
        {/* {isScanning && (
          <Button 
            variant="outline"
            onClick={() => setIsScanning(false)}
            className="px-6 py-3"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Ferma Scanner
          </Button>
        )} */}
        
        {isLoaded && !loadError && (
          <Button 
            variant="outline" 
            onClick={handleManualInput}
            className="px-6 py-3"
          >
            ✏️ Inserisci Manualmente
          </Button>
        )}
      </div>
      
      <div className="flex gap-4 pt-4">
        <Button variant="outline" onClick={prevStep} className="flex-1 py-3">
          ← Indietro
        </Button>
        <Button 
          onClick={nextStep}
          disabled={!scannedData}
          className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
        >
          Continua →
        </Button>
      </div>
    </div>
  );

  // STEP 3: Conferma
  const ConfirmationStep = () => {
    if (!selectedSupermarket) return null;
    
    const marketData = supermarketData[selectedSupermarket];
    const formattedNumber = scannedData.length > 12 ? 
      scannedData.replace(/(.{4})/g, '$1 ').trim() : 
      scannedData;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <Label className="text-lg font-semibold mb-4 block text-gray-800">Anteprima Carta</Label>
          <Card 
            className="mx-auto w-full max-w-sm border-2 shadow-xl"
            style={{ 
              backgroundColor: selectedSupermarket === 'altro' ? selectedColor : marketData.color,
              aspectRatio: '3/2'
            }}
          >
            <CardContent className="p-6 h-full flex flex-col justify-center items-center text-white">
              {marketData.logo.startsWith('/') ? (
                <img
                  src={viewImage(marketData.logo)}
                  alt={`${marketData.name} Logo`}
                  className="h-16 w-auto object-contain mb-3 drop-shadow-lg"
                />
              ) : (
                <div className="text-5xl mb-3 drop-shadow-lg">{marketData.logo}</div>
              )}
              <div className="font-bold text-xl uppercase drop-shadow-md">{marketData.name}</div>
              <div className="text-sm opacity-90 font-medium mt-1">{marketData.type}</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-gray-700">Nome Carta</Label>
            <Input 
              value={`${marketData?.name} ${marketData?.type}`} 
              readOnly 
              className="mt-2 bg-gray-50 font-semibold"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700">Numero Carta</Label>
            <Input 
              value={formattedNumber} 
              readOnly 
              className="mt-2 bg-gray-50 font-mono font-bold text-lg"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700">Tipo</Label>
            <Input 
              value={marketData?.type} 
              readOnly 
              className="mt-2 bg-gray-50"
            />
          </div>

          <div className="flex flex-row items-center justify-between rounded-xl border-2 p-6 bg-gray-50">
            <div className="space-y-1">
              <Label className="text-base font-semibold flex items-center">
                {isCardPublic ? (
                  <>
                    <Globe className="mr-3 h-5 w-5 text-green-600" />
                    Carta Pubblica
                  </>
                ) : (
                  <>
                    <Lock className="mr-3 h-5 w-5 text-orange-600" />
                    Carta Privata
                  </>
                )}
              </Label>
              <p className="text-sm text-gray-600">
                {isCardPublic 
                  ? 'Visibile a tutti i membri della famiglia'
                  : 'Visibile solo a te'
                }
              </p>
            </div>
            <Switch
              checked={isCardPublic}
              onCheckedChange={setIsCardPublic}
              className="data-[state=checked]:bg-green-500 scale-125"
            />
          </div>
        </div>
        
        <div className="flex gap-4 pt-6">
          <Button variant="outline" onClick={prevStep} className="flex-1 py-3">
            ← Indietro
          </Button>
          <Button 
            onClick={saveCard}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            ✅ Salva Carta
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-2xl font-bold text-gray-800">
            🎫 Aggiungi Carta Fedeltà
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Scanner professionale per QR codes e codici a barre
          </DialogDescription>
        </DialogHeader>

        {/* Indicatore step */}
        <div className="flex justify-center items-center space-x-3 my-6">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
                  step < currentStep 
                    ? "bg-green-500 text-white" 
                    : step === currentStep
                    ? "bg-blue-500 text-white ring-4 ring-blue-200"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {step < currentStep ? '✓' : step}
              </div>
              {step < 3 && (
                <div
                  className={cn(
                    "w-12 h-1 mx-2 transition-all duration-300",
                    step < currentStep ? "bg-green-500" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Contenuto step */}
        <div className="min-h-[400px]">
          {currentStep === 1 && <SupermarketSelection />}
          {currentStep === 2 && <ScannerStep />}
          {currentStep === 3 && <ConfirmationStep />}
        </div>
      </DialogContent>
    </Dialog>
  );
};
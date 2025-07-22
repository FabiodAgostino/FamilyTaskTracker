import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  AlertCircle,
  Globe,
  Search,
  Tag // Aggiunta icona Tag
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
  BrowserMultiFormatReader, 
  DecodeHintType, 
  BarcodeFormat, 
  Result,
  NotFoundException 
} from '@zxing/library';
import { Switch } from '@/components/ui/switch';

// ==========================================================
// ==== INTERFACCE E TIPI
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

// Tipi per le props dei componenti estratti
type SupermarketSelectionProps = {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  selectedSupermarket: SupermarketKey | null;
  setSelectedSupermarket: React.Dispatch<React.SetStateAction<SupermarketKey | null>>;
  selectedColor: string;
  setSelectedColor: React.Dispatch<React.SetStateAction<string>>;
  handleClose: () => void;
  nextStep: () => void;
};

type ScannerStepProps = {
  cameraPermission: 'unknown' | 'granted' | 'denied';
  scannedData: string;
  setScannedData: React.Dispatch<React.SetStateAction<string>>;
  handleScanSuccess: (result: ZXingScanResult) => void;
  handleScanError: (error: unknown) => void;
  handleManualInput: () => void;
  prevStep: () => void;
  nextStep: () => void;
};

type ConfirmationStepProps = {
  selectedSupermarket: SupermarketKey | null;
  scannedData: string;
  selectedColor: string;
  isPublic: boolean;
  setIsPublic: React.Dispatch<React.SetStateAction<boolean>>;
  tag: string; // Aggiunto prop tag
  setTag: React.Dispatch<React.SetStateAction<string>>; // Aggiunto prop setTag
  prevStep: () => void;
  saveCard: () => void;
};


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
  onScanError: (error: unknown) => void;
  selectedDeviceId?: string;
  isActive: boolean;
}) => {
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const scanCount = useRef(0);
  const lastScanTime = useRef(0);

  const getOptimizedHints = useCallback(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8
    ]);
    hints.set(DecodeHintType.TRY_HARDER, false);
    hints.set(DecodeHintType.PURE_BARCODE, false);
    return hints;
  }, []);

  useEffect(() => {
    if (!isActive) return;

    console.log('🚀 Inizializzazione ZXing Scanner...');
    const hints = getOptimizedHints();
    const reader = new BrowserMultiFormatReader(hints);
    reader.timeBetweenDecodingAttempts = 300;
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

  useEffect(() => {
    if (!isInitialized || !readerRef.current || !videoRef.current || !isActive) {
      return;
    }

    let isCurrentEffectActive = true;

    const startScanning = async () => {
      try {
        const constraints = {
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            facingMode: selectedDeviceId ? undefined : 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15, max: 30 }
          }
        };

        const controls = await readerRef.current!.decodeFromConstraints(
          constraints,
          videoRef.current!,
          (result, error) => {
            if (!isCurrentEffectActive) return;

            if (result) {
              const now = Date.now();
              if (now - lastScanTime.current < 2000) {
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
              console.log('⚠️ Errore scanning (normale):', error.message);
              onScanError(error);
            }
          }
        ) as ZXingControls | undefined;

        if (isCurrentEffectActive) {
          setIsScanning(true);
          console.log('✅ Scanning ZXing avviato');
        }

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
  onScanSuccess: (result: ZXingScanResult) => void;
  onScanError: (error: unknown) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const handleScanSuccess = useCallback((result: Result) => {
    const code = result.getText();
    console.log(`🎉 SUCCESSO SCANSIONE ZXing: ${code}`);
    const quaggaCompatibleResult: ZXingScanResult = {
      codeResult: {
        code: code,
        format: result.getBarcodeFormat()
      }
    };
    onScanSuccess(quaggaCompatibleResult);
  }, [onScanSuccess]);

  const handleScanErrorCB = useCallback((error: any) => {
    console.log('⚠️ Errore scansione ZXing:', error.message);
    onScanError(error);
  }, [onScanError]);

  const { isScanning } = useZXingScanner({
    videoRef,
    onScanSuccess: handleScanSuccess,
    onScanError: handleScanErrorCB,
    selectedDeviceId: cameras[currentCameraIndex]?.id,
    isActive: permissionGranted && !error
  });

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        console.log('📱 Richiesta permessi camera...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Permessi camera ottenuti');
        setPermissionGranted(true);

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

  const switchCamera = useCallback(() => {
    if (cameras.length > 1) {
      console.log('🔄 Cambio fotocamera ZXing');
      setCurrentCameraIndex(prev => (prev + 1) % cameras.length);
    }
  }, [cameras.length]);

  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        <div className="w-full bg-gray-200 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-center">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2 animate-pulse" />
            <p className="text-sm text-gray-500">Inizializzazione scanner...</p>
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
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full object-cover"
          style={{
            height: '250px',
            maxWidth: '100%'
          }}
          playsInline
          muted
        />
        <div className="absolute inset-0 pointer-events-none">
          {isScanning && (
            <div className="absolute inset-x-4 top-1/2 transform -translate-y-1/2 h-0.5 bg-red-500 shadow-lg animate-pulse" />
          )}
          <div className="absolute inset-4 border-2 border-white/70 rounded-lg">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-red-500 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-red-500 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-red-500 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-red-500 rounded-br-lg" />
          </div>
        </div>
      </div>
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
// ==== COMPONENTE STEP 1: SupermarketSelection
// ==========================================================
const SupermarketSelection = ({
    searchQuery,
    setSearchQuery,
    selectedSupermarket,
    setSelectedSupermarket,
    selectedColor,
    setSelectedColor,
    handleClose,
    nextStep
}: SupermarketSelectionProps) => {
    const filteredMarkets = useMemo(() => {
        return Object.entries(supermarketData).filter(([key, market]) => {
            if (key === 'altro') return true; 
            return market.name.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [searchQuery]);

    return (
        <div className="flex flex-col" style={{ height: '77vh' }}>
            <div className="flex-shrink-0 space-y-4 pb-4 border-b border-gray-200">
                <Label className="text-base font-semibold text-gray-700">Seleziona il Negozio</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cerca negozio..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#663EF3] focus:border-transparent"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-72 mx-auto">
                    {filteredMarkets.map(([key, market]) => {
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
                                    <img
                                        src={viewImage(market.logo)}
                                        alt={`${market.name} Logo`}
                                        className="h-16 w-auto object-contain mb-1 drop-shadow-md"
                                    />
                                    <span className="text-xs font-semibold truncate w-full">{market.name}</span>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
                {filteredMarkets.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Nessun negozio trovato per "{searchQuery}"</p>
                    </div>
                )}
                {selectedSupermarket === 'altro' && (
                    <div className="mt-4 space-y-3 bg-gray-50 p-4 rounded-lg border">
                        <Label className="font-semibold text-gray-700 flex items-center gap-2">
                            <Palette /> Personalizza Colore
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
                                            selectedColor === color
                                                ? "ring-2 ring-offset-2 ring-[#663EF3] border-white"
                                                : "border-gray-300"
                                        )}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setSelectedColor(color)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 flex gap-4 pt-4 border-t border-gray-200">
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
};


// ==========================================================
// ==== COMPONENTE STEP 2: ScannerStep
// ==========================================================
const ScannerStep = ({
    cameraPermission,
    scannedData,
    setScannedData,
    handleScanSuccess,
    handleScanError,
    handleManualInput,
    prevStep,
    nextStep
}: ScannerStepProps) => (
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
            ) : <BarcodeScanner onScanSuccess={handleScanSuccess} onScanError={handleScanError} />
        ) : cameraPermission === 'denied' ? (
            <div className="p-4 bg-red-50 text-red-800 rounded-lg flex flex-col items-center gap-2 border border-red-200">
                <Lock className="w-8 h-8 text-red-500" />
                <p className="font-semibold">Accesso alla fotocamera negato</p>
            </div>
        ) : <div className="aspect-video bg-gray-200 animate-pulse rounded-lg flex items-center justify-center"><Camera className="w-12 h-12 text-gray-400" /></div>}
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


// ==========================================================
// ==== COMPONENTE STEP 3: ConfirmationStep
// ==========================================================
const ConfirmationStep = ({
    selectedSupermarket,
    scannedData,
    selectedColor,
    isPublic,
    setIsPublic,
    tag,
    setTag,
    prevStep,
    saveCard
}: ConfirmationStepProps) => {
    if (!selectedSupermarket) {
        return null;
    }
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

            {/* Nuovo Input per il Tag */}
            <div className="w-full space-y-1 text-left">
                <Label htmlFor="card-tag" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tag (Opzionale)
                </Label>
                <input
                    id="card-tag"
                    type="text"
                    placeholder="Es. Carta Famiglia, Lavoro..."
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#663EF3] focus:border-transparent"
                />
            </div>

            <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-gray-50">
                <div className="space-y-0.5 text-left">
                    <Label className="text-base flex items-center">
                        {isPublic ? (
                            <>
                                <Globe className="mr-2 h-4 w-4 text-green-600" />
                                Carta Pubblica
                            </>
                        ) : (
                            <>
                                <Lock className="mr-2 h-4 w-4 text-orange-600" />
                                Carta Privata
                            </>
                        )}
                    </Label>
                    <p className="text-xs text-gray-600">
                        {isPublic
                            ? 'Questa carta sarà visibile a tutti i membri della famiglia'
                            : 'Questa carta sarà visibile solo a te'
                        }
                    </p>
                </div>
                <Switch
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                />
            </div>
            <div className="flex gap-4 pt-4">
                <Button variant="ghost" onClick={prevStep} className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Indietro
                </Button>
                <Button onClick={saveCard} className="w-full text-white bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-4 h-4 mr-2" /> Salva Carta
                </Button>
            </div>
        </div>
    )
};


// ==========================================================
// ==== COMPONENTE PRINCIPALE: AddCardModal
// ==========================================================
export const AddCardModal = ({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (card: any) => void; }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketKey | null>(null);
    const [scannedData, setScannedData] = useState('');
    const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
    const [selectedColor, setSelectedColor] = useState('#536DFE');
    const [isPublic, setIsPublic] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tag, setTag] = useState(''); // Stato per il nuovo input

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
        setSearchQuery('');
        setIsPublic(false);
        setTag(''); // Reset del tag
    }, []);

    const handleClose = () => {
        resetModal();
        onClose();
    };

    const nextStep = () => setCurrentStep(s => Math.min(s + 1, 3));

    const prevStep = () => {
        setCurrentStep(s => {
            const newStep = Math.max(s - 1, 1);
            if (s === 2 && newStep === 1) {
                setScannedData('');
                console.log('🔄 Reset codice scansionato - torno indietro dal scanner');
            }
            return newStep;
        });
    };

    const handleScanSuccess = useCallback((result: ZXingScanResult) => {
        const decodedText = result.codeResult.code;
        console.log(`🎉 SUCCESSO SCANSIONE FINALE: ${decodedText}`);
        setScannedData(decodedText);
    }, []);

    const handleScanError = useCallback((error: unknown) => {
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
            isPublic: isPublic,
            tag: tag
        });
        handleClose();
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
                {currentStep === 1 &&
                    <SupermarketSelection
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        selectedSupermarket={selectedSupermarket}
                        setSelectedSupermarket={setSelectedSupermarket}
                        selectedColor={selectedColor}
                        setSelectedColor={setSelectedColor}
                        handleClose={handleClose}
                        nextStep={nextStep}
                    />
                }
                {currentStep === 2 &&
                    <ScannerStep
                        cameraPermission={cameraPermission}
                        scannedData={scannedData}
                        setScannedData={setScannedData}
                        handleScanSuccess={handleScanSuccess}
                        handleScanError={handleScanError}
                        handleManualInput={handleManualInput}
                        prevStep={prevStep}
                        nextStep={nextStep}
                    />
                }
                {currentStep === 3 &&
                    <ConfirmationStep
                        selectedSupermarket={selectedSupermarket}
                        scannedData={scannedData}
                        selectedColor={selectedColor}
                        isPublic={isPublic}
                        setIsPublic={setIsPublic}
                        tag={tag}
                        setTag={setTag}
                        prevStep={prevStep}
                        saveCard={saveCard}
                    />
                }
            </DialogContent>
        </Dialog>
    );
};

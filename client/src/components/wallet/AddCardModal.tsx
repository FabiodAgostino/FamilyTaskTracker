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
  Tag,
  Upload // Aggiunta icona Upload
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
  NotFoundException,
  Exception,
} from '@zxing/library';
import { Switch } from '@/components/ui/switch';

// ==========================================================
// ==== TIPI E INTERFACCE GLOBALI
// ==========================================================

/**
 * Formato del risultato della scansione utilizzato nell'applicazione.
 */
interface AppScanResult {
  codeResult: {
    code: string;
    format: BarcodeFormat;
  };
}

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
  onScanSuccess: (result: Result) => void;
  onScanError: (error: unknown) => void;
  isActive?: boolean;
}

// ==========================================================
// ==== HOOK CUSTOM PER LO SCANNER
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

  const switchCamera = useCallback(() => {
    if (hasMultipleCameras) {
      console.log('🔄 Cambio fotocamera');
      setCurrentCameraIndex(prev => (prev + 1) % cameras.length);
    }
  }, [hasMultipleCameras, cameras.length]);

  useEffect(() => {
    if (!isActive) {
      setIsLoading(false);
      return;
    }

    const initialize = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setPermission('granted');
        console.log('✅ Permessi camera ottenuti');

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

  useEffect(() => {
    if (!isActive || permission !== 'granted' || !videoRef.current || !selectedDeviceId) {
      return;
    }
    
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
              onScanSuccess(result);
            } else if (err && !(err instanceof NotFoundException)) {
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

    return () => {
      isEffectActive = false;
      if (readerRef.current) {
        readerRef.current.reset();
      }
      setIsScanning(false);
    };
  }, [isActive, permission, selectedDeviceId, onScanSuccess, onScanError]);

  return { videoRef, isLoading, error, permission, isScanning, hasMultipleCameras, switchCamera };
};

// ==========================================================
// ==== COMPONENTE SCANNER (UI)
// ==========================================================

interface BarcodeScannerProps {
  onScanSuccess: (result: AppScanResult) => void;
  onScanError: (error: unknown) => void;
  isActive: boolean;
}

const BarcodeScanner = ({ onScanSuccess, onScanError, isActive }: BarcodeScannerProps) => {
  const handleSuccessAdapter = useCallback((result: Result) => {
    const appResult: AppScanResult = {
      codeResult: {
        code: result.getText(),
        format: result.getBarcodeFormat(),
      },
    };
    onScanSuccess(appResult);
  }, [onScanSuccess]);

  const {
    videoRef,
    isLoading,
    error,
    permission,
    isScanning,
    hasMultipleCameras,
    switchCamera,
  } = useBarcodeScanner({
    onScanSuccess: handleSuccessAdapter,
    onScanError: onScanError,
    isActive,
  });

  if (isLoading) {
    return (
      <div className="w-full bg-gray-200 rounded-lg aspect-video flex items-center justify-center">
        <div className="text-center">
          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-gray-500">Inizializzazione scanner...</p>
        </div>
      </div>
    );
  }

  if (permission === 'denied' || error) {
    return (
      <div className="w-full bg-red-50 border border-red-200 rounded-lg aspect-video flex items-center justify-center">
        <div className="text-center p-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 font-medium">Errore Scanner</p>
          <p className="text-xs text-red-500 mt-1">{error || 'Accesso alla fotocamera negato.'}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        <video ref={videoRef} className="w-full object-cover" style={{ height: '250px' }} playsInline muted />
        <div className="absolute inset-0 pointer-events-none">
          {isScanning && <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-lg animate-pulse" />}
          <div className="absolute inset-4 border-2 border-white/70 rounded-lg">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-red-500 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-red-500 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-red-500 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-red-500 rounded-br-lg" />
          </div>
        </div>
      </div>
      <div className="flex justify-center items-center gap-3">
        {hasMultipleCameras && (
          <Button variant="outline" size="icon" onClick={switchCamera} title="Cambia fotocamera" disabled={!isScanning}>
            <RotateCcw size={20} />
          </Button>
        )}
      </div>
    </div>
  );
};

// ==========================================================
// ==== COMPONENTI DEGLI STEP
// ==========================================================

type SupermarketSelectionProps = {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedSupermarket: SupermarketKey | null;
  setSelectedSupermarket: (key: SupermarketKey | null) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  handleClose: () => void;
  nextStep: () => void;
};

const SupermarketSelection = ({ searchQuery, setSearchQuery, selectedSupermarket, setSelectedSupermarket, selectedColor, setSelectedColor, handleClose, nextStep }: SupermarketSelectionProps) => {
    const filteredMarkets = useMemo(() => 
        Object.entries(supermarketData).filter(([key, market]) => 
            key === 'altro' || market.name.toLowerCase().includes(searchQuery.toLowerCase())
        ), [searchQuery]);

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

type ScannerStepProps = {
  scannedData: string;
  setScannedData: (data: string) => void;
  handleScanSuccess: (result: AppScanResult) => void;
  handleManualInput: () => void;
  prevStep: () => void;
  nextStep: () => void;
  scanStepError: string | null;
  setScanStepError: (error: string | null) => void;
};

const ScannerStep = ({ 
    scannedData, 
    setScannedData, 
    handleScanSuccess, 
    handleManualInput, 
    prevStep, 
    nextStep,
    scanStepError,
    setScanStepError
}: ScannerStepProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageDecode = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setScanStepError(null);
        
        // **FIX**: Create a reader with the same hints as the video scanner
        const hints = new Map();
        const formats = [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8];
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
        const reader = new BrowserMultiFormatReader(hints);
        
        const imageUrl = URL.createObjectURL(file);

        try {
            const result = await reader.decodeFromImageUrl(imageUrl);
            const appResult: AppScanResult = {
                codeResult: {
                    code: result.getText(),
                    format: result.getBarcodeFormat(),
                },
            };
            handleScanSuccess(appResult);
        } catch (error) {
            console.error("Errore durante la decodifica dell'immagine:", error);
            setScanStepError("Nessun codice a barre trovato. Riprova con un'altra immagine.");
        } finally {
            URL.revokeObjectURL(imageUrl);
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    return (
        <div className="flex flex-col gap-4 text-center">
            <div className="text-sm text-gray-500">Inquadra il codice, caricalo da un file o inseriscilo a mano.</div>
            {scannedData ? (
                <div className="p-4 bg-green-50 text-green-800 rounded-lg flex flex-col items-center gap-3 border border-green-200">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                    <p className="font-semibold text-lg">Codice Acquisito!</p>
                    <p className="font-mono bg-white p-2 rounded">{scannedData}</p>
                    <Button variant="link" size="sm" onClick={() => setScannedData('')}>Scansiona di nuovo</Button>
                </div>
            ) : (
                <BarcodeScanner 
                    onScanSuccess={handleScanSuccess} 
                    onScanError={(err) => setScanStepError(err instanceof Error ? err.message : 'Si è verificato un errore durante la scansione.')} 
                    isActive={!scannedData} 
                />
            )}

            {scanStepError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    {scanStepError}
                </div>
            )}

            <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-200" />
                <span className="flex-shrink mx-4 text-xs text-gray-400">OPPURE</span>
                <div className="flex-grow border-t border-gray-200" />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Carica File
                </Button>
                <Button variant="outline" onClick={handleManualInput}>
                    <Edit className="w-4 h-4 mr-2" /> Inserisci a Mano
                </Button>
            </div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageDecode}
                accept="image/*"
                className="hidden"
            />

            <div className="flex gap-4 pt-4">
                <Button variant="ghost" onClick={prevStep} className="w-full"><ArrowLeft className="w-4 h-4 mr-2" /> Indietro</Button>
                <Button onClick={nextStep} disabled={!scannedData} className="w-full text-white" style={{ background: 'var(--burnt-newStyle)' }}>
                    Continua <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );
};

type ConfirmationStepProps = {
  selectedSupermarket: SupermarketKey | null;
  scannedData: string;
  selectedColor: string;
  isPublic: boolean;
  setIsPublic: (isPublic: boolean) => void;
  tag: string;
  setTag: (tag: string) => void;
  prevStep: () => void;
  saveCard: () => void;
};

const ConfirmationStep = ({ selectedSupermarket, scannedData, selectedColor, isPublic, setIsPublic, tag, setTag, prevStep, saveCard }: ConfirmationStepProps) => {
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
    );
};

// ==========================================================
// ==== COMPONENTE PRINCIPALE (MODALE)
// ==========================================================

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (card: any) => void;
}

export const AddCardModal = ({ isOpen, onClose, onSave }: AddCardModalProps) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketKey | null>(null);
    const [scannedData, setScannedData] = useState('');
    const [selectedColor, setSelectedColor] = useState('#536DFE');
    const [isPublic, setIsPublic] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tag, setTag] = useState('');
    const [scanStepError, setScanStepError] = useState<string | null>(null);


    const resetModal = useCallback(() => {
        setCurrentStep(1);
        setSelectedSupermarket(null);
        setScannedData('');
        setSelectedColor('#536DFE');
        setSearchQuery('');
        setIsPublic(false);
        setTag('');
        setScanStepError(null);
    }, []);

    const handleClose = () => {
        resetModal();
        onClose();
    };

    const nextStep = () => {
        setScanStepError(null);
        setCurrentStep(s => Math.min(s + 1, 3));
    }
    const prevStep = () => {
        resetModal();
        setScanStepError(null);
        setCurrentStep(s => Math.max(s - 1, 1));
    }

    const handleScanSuccess = useCallback((result: AppScanResult) => {
        setScanStepError(null);
        let code = result.codeResult.code;
        const format = result.codeResult.format;

        // Workaround per codici a barre EAN-13 che a volte vengono restituiti come UPC-A a 12 cifre
        if (format === BarcodeFormat.EAN_13 && code.length === 12) {
            console.log("Rilevato EAN-13 a 12 cifre. Aggiungo '0' iniziale.");
            code = '0' + code;
        }
        
        setScannedData(code);
    }, []);

    const handleManualInput = () => {
        const code = prompt('Inserisci il codice manualmente:');
        if (code?.trim()) {
            setScanStepError(null);
            setScannedData(code.trim());
        }
    };

    const saveCard = () => {
        if (!selectedSupermarket || !scannedData) return;
        const m = supermarketData[selectedSupermarket];
        onSave({
            name: `${m.name} ${m.type}`,
            number: scannedData,
            brand: m.name,
            logo: m.logo,
            barcode: scannedData,
            color: selectedSupermarket === 'altro' ? selectedColor : m.color,
            isPublic: isPublic,
            tag: tag,
        });
        handleClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'var(--burnt-newStyle)' }}><Scan className="w-6 h-6 text-white" /></div>
                        Aggiungi Carta Fedeltà
                    </DialogTitle>
                    <DialogDescription>Passo {currentStep} di 3 - Seleziona, scansiona e conferma.</DialogDescription>
                </DialogHeader>
                
                {currentStep === 1 && <SupermarketSelection {...{ searchQuery, setSearchQuery, selectedSupermarket, setSelectedSupermarket, selectedColor, setSelectedColor, handleClose, nextStep }} />}
                {currentStep === 2 && <ScannerStep {...{ scannedData, setScannedData, handleScanSuccess, handleManualInput, prevStep, nextStep, scanStepError, setScanStepError }} />}
                {currentStep === 3 && <ConfirmationStep {...{ selectedSupermarket, scannedData, selectedColor, isPublic, setIsPublic, tag, setTag, prevStep, saveCard }} />}

            </DialogContent>
        </Dialog>
    );
};

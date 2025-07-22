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
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  Star,
  Store,
  Trash2 // Aggiunto per il pulsante elimina
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, viewImage } from '@/lib/utils';
import { supermarketData, type SupermarketKey, suggestedColors } from './walletConstants';
import { FidelityCard } from '@/lib/models/FidelityCard';
import { 
  BrowserMultiFormatReader, 
  DecodeHintType, 
  BarcodeFormat, 
  Result,
  NotFoundException 
} from '@zxing/library';
import { Switch } from '@/components/ui/switch';
import JsBarcode from 'jsbarcode';


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

// Tipi per le props dei componenti
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
  tag: string;
  setTag: React.Dispatch<React.SetStateAction<string>>;
  prevStep: () => void;
  saveCard: () => void;
};

interface WalletStatsProps {
  stats: {
    totalCards: number;
    publicCards: number;
    privateCards: number;
    myCards: number;
    newCards: number;
    popularCards: number;
    brands: string[];
  };
  isMobile: boolean;
}

interface FilterPanelProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  brandFilter: string;
  setBrandFilter: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  showNewCards: boolean;
  setShowNewCards: (value: boolean) => void;
  isFiltersExpanded: boolean;
  toggleFilters: () => void;
  activeFiltersCount: number;
  handleClearFilters: () => void;
  isMobile: boolean;
  brands: string[];
}

interface CompactFidelityCardProps {
  card: FidelityCard;
  onCardClick: (card: FidelityCard) => void;
}

interface CardDetailModalProps {
  selectedCard: FidelityCard | null;
  isDetailModalOpen: boolean;
  showCardBack: boolean;
  handleCloseDetail: () => void;
  toggleCardView: () => void;
  handleDeleteCard: (cardId: string) => void;
}


// ==========================================================
// ==== HOOKS
// ==========================================================

// Hook per rilevare l'orientamento dello schermo
const useOrientation = (): 'portrait' | 'landscape' => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    window.matchMedia("(orientation: portrait)").matches ? 'portrait' : 'landscape'
  );

  useEffect(() => {
    const portraitMql = window.matchMedia("(orientation: portrait)");

    const handleOrientationChange = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? 'portrait' : 'landscape');
    };

    portraitMql.addEventListener('change', handleOrientationChange);

    return () => {
      portraitMql.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  return orientation;
};

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
// ==== UTILITY
// ==========================================================
const generateBarcodeDataURL = (code: string, format: string = 'CODE128'): string => {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, code, {
      format: format,
      width: 4,
      height: 200,
      displayValue: true,
      fontSize: 28,
      textAlign: 'center',
      textPosition: 'bottom',
      background: '#ffffff',
      lineColor: '#000000',
      margin: 20,
    });
    return canvas.toDataURL();
  } catch (error) {
    console.error('Errore nella generazione barcode:', error);
    return ''; // Ritorna stringa vuota in caso di errore
  }
};


// ==========================================================
// ==== COMPONENTI
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
    const quaggaCompatibleResult: ZXingScanResult = {
      codeResult: { code, format: result.getBarcodeFormat() }
    };
    onScanSuccess(quaggaCompatibleResult);
  }, [onScanSuccess]);

  const handleScanErrorCB = useCallback((error: any) => {
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop());
        setPermissionGranted(true);
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices
          .filter(device => device.kind === 'videoinput')
          .map((device, index) => ({ id: device.deviceId, label: device.label || `Camera ${index + 1}` }));
        setCameras(videoDevices);
        const rearCameraIndex = videoDevices.findIndex(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
        if (rearCameraIndex !== -1) setCurrentCameraIndex(rearCameraIndex);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };
    initializeCamera();
  }, []);

  const switchCamera = useCallback(() => {
    if (cameras.length > 1) setCurrentCameraIndex(prev => (prev + 1) % cameras.length);
  }, [cameras.length]);

  if (isLoading) return <div className="text-center p-4">Inizializzazione...</div>;
  if (error) return <div className="text-center p-4 text-red-500">Errore: {error}</div>;

  return (
    <div className="w-full space-y-3">
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        <video ref={videoRef} className="w-full object-cover" style={{ height: '250px' }} playsInline muted />
        {isScanning && <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500 animate-pulse" />}
      </div>
      {cameras.length > 1 && <Button onClick={switchCamera} disabled={!isScanning}>Cambia Camera</Button>}
    </div>
  );
};

const SupermarketSelection = ({
    searchQuery, setSearchQuery, selectedSupermarket, setSelectedSupermarket,
    selectedColor, setSelectedColor, handleClose, nextStep
}: SupermarketSelectionProps) => {
    const filteredMarkets = useMemo(() => Object.entries(supermarketData).filter(([key, market]) => 
        key === 'altro' || market.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [searchQuery]);

    return (
        <div className="flex flex-col" style={{ height: '77vh' }}>
            <div className="flex-shrink-0 space-y-4 pb-4 border-b">
                <Label>Seleziona il Negozio</Label>
                <Input placeholder="Cerca negozio..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-72 mx-auto">
                    {filteredMarkets.map(([key, market]) => (
                        <Card key={key} onClick={() => setSelectedSupermarket(key as SupermarketKey)} className={cn("cursor-pointer", selectedSupermarket === key && "ring-2 ring-blue-500")}>
                            <CardContent className="p-2 text-center">
                                <img src={viewImage(market.logo)} alt={market.name} className="h-16 mx-auto" />
                                <span>{market.name}</span>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                {selectedSupermarket === 'altro' && (
                    <div className="mt-4">
                        <Label>Personalizza Colore</Label>
                        <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} />
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 flex gap-4 pt-4 border-t">
                <Button variant="ghost" onClick={handleClose}>Annulla</Button>
                <Button onClick={nextStep} disabled={!selectedSupermarket}>Continua</Button>
            </div>
        </div>
    );
};

const ScannerStep = ({
    cameraPermission, scannedData, setScannedData, handleScanSuccess, handleScanError,
    handleManualInput, prevStep, nextStep
}: ScannerStepProps) => (
    <div>
        {cameraPermission === 'granted' ? (
            scannedData ? (
                <div>
                    <p>Codice Acquisito: {scannedData}</p>
                    <Button onClick={() => setScannedData('')}>Scansiona di nuovo</Button>
                </div>
            ) : <BarcodeScanner onScanSuccess={handleScanSuccess} onScanError={handleScanError} />
        ) : <p>Accesso alla fotocamera negato.</p>}
        <Button onClick={handleManualInput}>Inserisci Manualmente</Button>
        <Button onClick={prevStep}>Indietro</Button>
        <Button onClick={nextStep} disabled={!scannedData}>Continua</Button>
    </div>
);

const ConfirmationStep = ({
    selectedSupermarket, scannedData, selectedColor, isPublic, setIsPublic,
    tag, setTag, prevStep, saveCard
}: ConfirmationStepProps) => {
    if (!selectedSupermarket) return null;
    const m = supermarketData[selectedSupermarket];
    const cardColor = selectedSupermarket === 'altro' ? selectedColor : m.color;
    return (
        <div className="space-y-4">
            <Card style={{ backgroundColor: cardColor }} className="text-white p-4">
                <h3>{m.name} {m.type}</h3>
                <p>{scannedData}</p>
            </Card>
            <Input placeholder="Tag (Opzionale)" value={tag} onChange={(e) => setTag(e.target.value)} />
            <div className="flex items-center space-x-2">
                <Switch id="public-switch" checked={isPublic} onCheckedChange={setIsPublic} />
                <Label htmlFor="public-switch">Rendi Pubblica</Label>
            </div>
            <Button onClick={prevStep}>Indietro</Button>
            <Button onClick={saveCard}>Salva Carta</Button>
        </div>
    );
};

const WalletStats = ({ stats, isMobile }: WalletStatsProps) => (
  <div className={cn("flex flex-wrap gap-4", isMobile && "mb-4")}>
    <Badge variant="outline">{stats.totalCards} carte</Badge>
    <Badge variant="outline"><Globe className="w-3 h-3 mr-1" />{stats.publicCards} pubbliche</Badge>
    <Badge variant="outline"><Lock className="w-3 h-3 mr-1" />{stats.privateCards} private</Badge>
  </div>
);

const FilterPanel = ({
  searchTerm, setSearchTerm, brandFilter, setBrandFilter, sortBy, setSortBy,
  showNewCards, setShowNewCards, isFiltersExpanded, toggleFilters, activeFiltersCount,
  handleClearFilters, isMobile, brands
}: FilterPanelProps) => (
  <Card className="mb-4">
    <CardContent className="p-4">
      {isMobile && (
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium">Filtri</span>
          <Button variant="ghost" size="sm" onClick={toggleFilters}>
            {isFiltersExpanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      )}
      <div className={cn(isMobile && !isFiltersExpanded ? "hidden" : "block")}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input placeholder="Cerca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i brand</SelectItem>
              {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger><SelectValue placeholder="Ordina per" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priorità</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center space-x-2">
            <Switch id="new-cards" checked={showNewCards} onCheckedChange={setShowNewCards} />
            <Label htmlFor="new-cards">Includi nuove</Label>
          </div>
          {activeFiltersCount > 0 && <Button variant="ghost" onClick={handleClearFilters}>Pulisci</Button>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const CompactFidelityCard = ({ card, onCardClick }: CompactFidelityCardProps) => (
  <Card 
    className="relative overflow-hidden cursor-pointer group"
    style={{ backgroundColor: card.color || '#6B7280', aspectRatio: '3/2' }}
    onClick={() => onCardClick(card)}
  >
    <CardContent className="p-4 h-full flex justify-center items-center">
      <img src={viewImage(card.logo)} alt="Logo" className="max-h-16 w-auto" />
    </CardContent>
    {card.tag && (
      <Badge className="absolute bottom-2 left-2"><Tag className="w-3 h-3 mr-1" />{card.tag}</Badge>
    )}
  </Card>
);

const CardDetailModal = ({
  selectedCard, isDetailModalOpen, showCardBack, handleCloseDetail,
  toggleCardView, handleDeleteCard
}: CardDetailModalProps) => {
  const orientation = useOrientation();

  if (!selectedCard || !isDetailModalOpen) return null;

  // Vista Landscape: solo barcode con linguetta superiore
  if (orientation === 'landscape') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white animate-in fade-in-0">
        {/* Linguetta colorata solo in alto */}
        <div 
          className="h-4 w-full flex-shrink-0"
          style={{ backgroundColor: selectedCard.color || '#6B7280' }}
        />
        {/* Contenitore per il barcode */}
        <div className="flex-grow flex items-center justify-center p-4 relative">
          <img 
            src={generateBarcodeDataURL(selectedCard.barcode || '123456789')}
            alt={`Barcode per ${selectedCard.brand}`}
            className="max-w-full max-h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
         <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-400 animate-pulse">
            Ruota il dispositivo per tornare alla visualizzazione normale
        </p>
      </div>
    );
  }
  
  // Vista Portrait: card con flip
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseDetail} />
      
      <div 
        className="relative bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200/80 overflow-hidden"
      >
        <div className="p-6">
          <div className="grid grid-flow-col justify-items-end mb-4">
            <Button variant="ghost" size="icon" onClick={handleCloseDetail} className="h-8 w-8 text-gray-500 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="space-y-6">
            <div style={{ perspective: '1200px' }}>
              <div 
                className="cursor-pointer transition-transform duration-700 w-full"
                style={{ transformStyle: 'preserve-3d', transform: showCardBack ? 'rotateY(180deg)' : 'rotateY(0deg)', aspectRatio: '1.58' }}
                onClick={toggleCardView}
              >
                {/* Fronte */}
                <div className="absolute w-full h-full p-6 rounded-lg flex flex-col justify-between text-white shadow-lg" style={{ backgroundColor: selectedCard.color, backfaceVisibility: 'hidden' }}>
                  <img src={viewImage(selectedCard.logo)} alt="Logo" className="h-16 w-auto object-contain self-center" />
                  <p className="text-center text-xl font-mono tracking-widest">{selectedCard.brand}</p>
                </div>
                
                {/* Retro con nuovo stile */}
                <div className="absolute w-full h-full rounded-lg bg-gray-100" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <div 
                    className="bg-white rounded-md h-full w-full flex items-center justify-center border border-gray-200 shadow-inner overflow-hidden"
                    style={{ borderTop: `12px solid ${selectedCard.color || '#6B7280'}`, borderRadius:'14px' }}
                  >
                    <img src={generateBarcodeDataURL(selectedCard.barcode || '123456789')} alt="Barcode" className="w-full h-auto object-contain px-2" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-gray-500">
              {showCardBack ? "Mostra questo codice alla cassa" : "Clicca sulla carta per girarla"}
            </p>
          </div>
        </div>
        
        {/* Footer con pulsante Elimina */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 mt-6">
          <div className="flex justify-end">
            <Button 
              variant="destructive" 
              onClick={() => handleDeleteCard(selectedCard.id)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Elimina Carta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
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
    const [tag, setTag] = useState('');

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
        setTag('');
    }, []);

    const handleClose = () => {
        resetModal();
        onClose();
    };

    const nextStep = () => setCurrentStep(s => Math.min(s + 1, 3));
    const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1));

    const handleScanSuccess = useCallback((result: ZXingScanResult) => {
        setScannedData(result.codeResult.code);
    }, []);

    const handleScanError = useCallback((error: unknown) => {
        console.error('Scan Error:', error);
    }, []);

    const handleManualInput = () => {
        const code = prompt('Inserisci il codice manualmente:');
        if (code) setScannedData(code.trim());
    };

    const saveCard = () => {
        if (!selectedSupermarket) return;
        const m = supermarketData[selectedSupermarket];
        onSave({
            name: `${m.name} ${m.type}`,
            number: scannedData,
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Aggiungi Carta Fedeltà</DialogTitle>
                    <DialogDescription>Passo {currentStep} di 3</DialogDescription>
                </DialogHeader>
                {currentStep === 1 &&
                    <SupermarketSelection
                        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                        selectedSupermarket={selectedSupermarket} setSelectedSupermarket={setSelectedSupermarket}
                        selectedColor={selectedColor} setSelectedColor={setSelectedColor}
                        handleClose={handleClose} nextStep={nextStep}
                    />
                }
                {currentStep === 2 &&
                    <ScannerStep
                        cameraPermission={cameraPermission} scannedData={scannedData}
                        setScannedData={setScannedData} handleScanSuccess={handleScanSuccess}
                        handleScanError={handleScanError} handleManualInput={handleManualInput}
                        prevStep={prevStep} nextStep={nextStep}
                    />
                }
                {currentStep === 3 &&
                    <ConfirmationStep
                        selectedSupermarket={selectedSupermarket} scannedData={scannedData}
                        selectedColor={selectedColor} isPublic={isPublic} setIsPublic={setIsPublic}
                        tag={tag} setTag={setTag}
                        prevStep={prevStep} saveCard={saveCard}
                    />
                }
            </DialogContent>
        </Dialog>
    );
};

// Export aggregato per un utilizzo più semplice
export const WalletComponents = {
  WalletStats,
  FilterPanel,
  CompactFidelityCard,
  CardDetailModal,
  AddCardModal
};

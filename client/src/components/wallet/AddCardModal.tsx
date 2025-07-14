import { useState, useRef } from 'react';
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
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { supermarketData, type SupermarketKey, suggestedColors } from './walletConstants';

interface QRScanner {
  stop: () => void;
}

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cardData: any) => void;
}

export const AddCardModal = ({ isOpen, onClose, onSave }: AddCardModalProps) => {
  // Stati del componente
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketKey | null>(null);
  const [scannedData, setScannedData] = useState('');
  const [qrStatus, setQrStatus] = useState('Clicca "Avvia Scanner" per iniziare');
  const [selectedColor, setSelectedColor] = useState('#6366F1');
  const [isCardPublic, setIsCardPublic] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const qrScannerRef = useRef<QRScanner | null>(null);

  // Reset completo del modal
  const resetModal = () => {
    setCurrentStep(1);
    setSelectedSupermarket(null);
    setScannedData('');
    setQrStatus('Clicca "Avvia Scanner" per iniziare');
    setSelectedColor('#6366F1');
    setIsCardPublic(false);
    setIsColorPickerOpen(false);
    setIsScanning(false);
    stopScanner();
  };

  // Ferma lo scanner e pulisce le risorse
  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current = null;
    }
    setIsScanning(false);
    
    // Nascondi il video
    const video = document.getElementById('barcode-scanner-video') as HTMLVideoElement;
    if (video) {
      video.style.display = 'none';
    }
  };

  // Gestori eventi
  const handleClose = () => {
    stopScanner();
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
      if (currentStep === 2) {
        stopScanner();
      }
      setCurrentStep(currentStep - 1);
    }
  };

  // Inserimento manuale del codice
  const handleManualInput = () => {
    const manualCode = prompt('Inserisci il codice manualmente:');
    if (manualCode && manualCode.trim()) {
      setScannedData(manualCode.trim());
      setQrStatus('✅ Codice inserito manualmente!');
      stopScanner();
    }
  };

  // Scanner ZXing semplice e funzionante
  const startBarcodeScanner = () => {
    try {
      setIsScanning(true);
      setQrStatus('🔄 Inizializzazione scanner...');

      // Crea il code reader con configurazione ottimizzata
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.CODABAR,
        BarcodeFormat.CODE_93,
        BarcodeFormat.ITF
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      
      const codeReader = new BrowserMultiFormatReader(hints);
      
      console.log('✅ Scanner inizializzato');
      setQrStatus('📹 Avvio camera...');
      
      // Scansione continua dalla camera (null = auto-selezione camera posteriore)
      codeReader.decodeFromVideoDevice(null, 'barcode-scanner-video', (result, error) => {
        if (result) {
          const scannedCode = result.getText();
          console.log('✅ Codice trovato:', scannedCode);
          
          setScannedData(scannedCode);
          setQrStatus('✅ Codice scansionato con successo!');
          
          // Ferma lo scanner
          codeReader.reset();
          
          // Nascondi il video
          const video = document.getElementById('barcode-scanner-video') as HTMLVideoElement;
          if (video) video.style.display = 'none';
          
          setIsScanning(false);
          return;
        }
        
        // 🚫 IMPORTANTE: Ignora completamente i NotFoundException (sono normali!)
        if (error && !error.name.includes('NotFoundException')) {
          console.error('❌ Errore scanner reale:', error);
          
          // Gestisci solo errori reali
          if (error.name.includes('NotAllowed')) {
            setQrStatus('❌ Permessi camera negati. Abilita la camera nelle impostazioni del browser.');
          } else if (error.name.includes('NotFound')) {
            setQrStatus('❌ Camera non trovata. Verifica che sia collegata.');
          } else if (error.name.includes('NotReadable')) {
            setQrStatus('❌ Camera occupata da altra app. Chiudi altre applicazioni.');
          } else {
            setQrStatus('❌ Errore scanner. Riprova o usa inserimento manuale.');
          }
          
          setIsScanning(false);
        }
        // NotFoundException vengono completamente ignorati senza log
      });
      
      // Mostra il video
      const video = document.getElementById('barcode-scanner-video') as HTMLVideoElement;
      if (video) {
        video.style.display = 'block';
        setQrStatus('📹 Camera attiva - Inquadra il codice');
      }
      
      // Salva il riferimento per poter fermare lo scanner
      qrScannerRef.current = {
        stop: () => {
          codeReader.reset();
          setIsScanning(false);
          const video = document.getElementById('barcode-scanner-video') as HTMLVideoElement;
          if (video) video.style.display = 'none';
        }
      };
      
    } catch (error) {
      console.error('❌ Errore inizializzazione scanner:', error);
      setQrStatus('❌ Impossibile avviare lo scanner. Verifica i permessi della camera.');
      setIsScanning(false);
    }
  };

  // Salva la carta
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

            {/* Color picker avanzato */}
            {isColorPickerOpen && (
              <div className="absolute z-50 mt-32 w-96 p-6 bg-white border-2 rounded-xl shadow-2xl">
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-gray-800">Seleziona Colore</div>
                  
                  {/* Color picker nativo */}
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full h-16 rounded-lg border-2 cursor-pointer"
                  />
                  
                  {/* Colori predefiniti */}
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

          {/* Anteprima carta */}
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

  // STEP 2: Scanner
  const BarcodeScanner = () => (
    <div className="space-y-6">
      <div className="relative mx-auto w-full max-w-md">
        <Card className="bg-gradient-to-br from-gray-900 to-black text-white border-2">
          <CardContent className="p-8 text-center">
            <Scan className="mx-auto h-16 w-16 mb-4 text-blue-400" />
            <h3 className="text-xl font-bold mb-6">Scanner Codici a Barre</h3>
            
            {/* Container video scanner */}
            <div className="relative w-full h-56 bg-gray-900 rounded-xl overflow-hidden border-4 border-blue-400/50">
              
              {/* Placeholder animato quando scanner non attivo */}
              {!isScanning && !scannedData && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <div className="text-blue-400 text-center">
                    <Camera className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                    <div className="text-lg font-semibold">Premi "Avvia Scanner"</div>
                    <div className="text-sm opacity-75 mt-2">per iniziare la scansione</div>
                  </div>
                </div>
              )}
              
              {/* Video element per scanner reale */}
              <video 
                id="barcode-scanner-video" 
                className="hidden w-full h-full object-cover rounded-lg"
                autoPlay 
                playsInline
                muted
              />
              
              {/* Linea di scansione animata quando attivo */}
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-4/5 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse shadow-lg"></div>
                </div>
              )}
              
              {/* Angoli del mirino */}
              <div className="absolute top-4 left-4 w-8 h-8 border-l-4 border-t-4 border-blue-400"></div>
              <div className="absolute top-4 right-4 w-8 h-8 border-r-4 border-t-4 border-blue-400"></div>
              <div className="absolute bottom-4 left-4 w-8 h-8 border-l-4 border-b-4 border-blue-400"></div>
              <div className="absolute bottom-4 right-4 w-8 h-8 border-r-4 border-b-4 border-blue-400"></div>

              {/* Stato scanner overlay */}
              {isScanning && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  🔍 Scansione in corso...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Status message */}
      <div className={cn(
        "text-center font-semibold text-lg px-4 py-3 rounded-lg",
        scannedData ? "text-green-700 bg-green-100" : 
        qrStatus.includes('❌') ? "text-red-700 bg-red-100" : 
        "text-blue-700 bg-blue-100"
      )}>
        {qrStatus}
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
        {!isScanning && !scannedData && (
          <Button 
            onClick={startBarcodeScanner}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3"
          >
            <Camera className="w-5 h-5 mr-2" />
            Avvia Scanner
          </Button>
        )}
        
        {isScanning && (
          <Button 
            variant="outline"
            onClick={stopScanner}
            className="px-6 py-3"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Ferma Scanner
          </Button>
        )}
        
        <Button 
          variant="outline" 
          onClick={handleManualInput}
          className="px-6 py-3"
        >
          ✏️ Inserisci Manualmente
        </Button>
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

  // STEP 3: Conferma finale
  const ConfirmationStep = () => {
    if (!selectedSupermarket) return null;
    
    const marketData = supermarketData[selectedSupermarket];
    const formattedNumber = scannedData.length > 12 ? 
      scannedData.replace(/(.{4})/g, '$1 ').trim() : 
      scannedData;

    return (
      <div className="space-y-6">
        {/* Anteprima carta */}
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

        {/* Dettagli carta */}
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

          {/* Switch Visibilità */}
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
            Seleziona il negozio e scansiona il codice a barre della tua carta
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

        {/* Contenuto dei step */}
        <div className="min-h-[400px]">
          {currentStep === 1 && <SupermarketSelection />}
          {currentStep === 2 && <BarcodeScanner />}
          {currentStep === 3 && <ConfirmationStep />}
        </div>
      </DialogContent>
    </Dialog>
  );
};
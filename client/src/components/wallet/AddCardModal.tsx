import { useState, useRef } from 'react';
import { 
  Scan,
  Globe,
  Lock
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
import { cn } from '@/lib/utils';
import { BrowserMultiFormatReader } from '@zxing/library';
import { supermarketData, type SupermarketKey, suggestedColors } from './walletConstants';

// Tipi
interface QRScanner {
  stop: () => void;
}

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cardData: any) => void;
}

export const AddCardModal = ({ isOpen, onClose, onSave }: AddCardModalProps) => {
  // Stati modal
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketKey | null>(null);
  const [scannedData, setScannedData] = useState('');
  const [qrStatus, setQrStatus] = useState('Inquadra il codice a barre della carta');
  const [selectedColor, setSelectedColor] = useState('#6366F1');
  const [isCardPublic, setIsCardPublic] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  
  const qrScannerRef = useRef<QRScanner | null>(null);

  // Reset modal
  const resetModal = () => {
    setCurrentStep(1);
    setSelectedSupermarket(null);
    setScannedData('');
    setQrStatus('Inquadra il codice a barre della carta');
    setSelectedColor('#6366F1');
    setIsCardPublic(false);
    setIsColorPickerOpen(false);
  };

  // Handlers
  const handleClose = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current = null;
    }
    resetModal();
    onClose();
  };

  const nextStep = () => {
    if (currentStep < 3) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      if (newStep === 2) startBarcodeScanner();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      if (currentStep === 2 && qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current = null;
      }
      setCurrentStep(currentStep - 1);
    }
  };

  // Scanner con libreria @zxing/library
  const startBarcodeScanner = () => {
    try {
      const codeReader = new BrowserMultiFormatReader();
      
      codeReader.decodeFromVideoDevice(null, 'barcode-scanner-video', (result, err) => {
        if (result) {
          const scannedCode = result.getText();
          setScannedData(scannedCode);
          setQrStatus('✅ Codice a barre scansionato con successo!');
          
          codeReader.reset();
          
          const video = document.getElementById('barcode-scanner-video') as HTMLVideoElement;
          if (video) video.style.display = 'none';
        }
        
        if (err && err.name !== 'NotFoundException') {
          console.error('Errore scansione:', err);
          setQrStatus('❌ Errore nella scansione. Riprova.');
        }
      });
      
      const video = document.getElementById('barcode-scanner-video') as HTMLVideoElement;
      if (video) video.style.display = 'block';
      
      qrScannerRef.current = {
        stop: () => codeReader.reset()
      };
      
    } catch (error) {
      console.error('Errore inizializzazione scanner:', error);
      setQrStatus('❌ Impossibile avviare lo scanner. Verifica i permessi della camera.');
    }
  };

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
  };

  // Componente selezione supermercato
  const SupermarketSelection = () => (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium mb-3 block">Seleziona il Negozio</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
         {Object.entries(supermarketData).map(([key, market]) => (
            market.name !== "ALTRO" ? (
              <Card
                key={key}
                style={{ backgroundColor: market.color }}
                className={cn(
                  "cursor-pointer transform transition-transform duration-200 hover:-translate-y-1 hover:shadow-md rounded-lg overflow-hidden",
                  selectedSupermarket === key
                    ? "ring-2 ring-cambridge-newStyle bg-cambridge-newStyle/5"
                    : "hover:ring-1 hover:ring-gray-300"
                )}
                onClick={() => setSelectedSupermarket(key as SupermarketKey)}
              >
                <CardContent className="flex items-center justify-center p-4 text-center min-h-[8rem]">
                  <img
                    src={market.logo}
                    alt={`${market.name} Logo`}
                    className="h-12 w-auto object-contain"
                  />
                </CardContent>
              </Card>
            ) : (
              <button
                key={key}
                onClick={() => setSelectedSupermarket(key as SupermarketKey)}
                className="flex items-center justify-center w-full p-4 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-200 transition"
              >
                <span className="text-xl font-medium">+ Aggiungi supermercato</span>
              </button>
            )
          ))}

        </div>
      </div>

      {/* Color picker per "altro" */}
      {selectedSupermarket === 'altro' && (
        <div className="space-y-4">
          <Label className="text-sm font-medium">Scegli Colore Carta</Label>
          
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
            <Button
              variant="outline"
              className="w-16 h-16 p-0 border-2 border-gray-300 rounded-lg hover:border-cambridge-newStyle"
              style={{ backgroundColor: selectedColor }}
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
            >
              <div className="w-full h-full rounded-lg" style={{ backgroundColor: selectedColor }}></div>
            </Button>

            {/* Picker custom che appare sotto */}
            {isColorPickerOpen && (
              <div 
                className="absolute z-50 mt-20 w-80 p-4 bg-white border rounded-lg shadow-lg"
                onClick={(e) => e.stopPropagation()} // ✅ Impedisce chiusura modal
                onMouseDown={(e) => e.stopPropagation()} // ✅ Impedisce chiusura durante drag
              >
                <div className="space-y-4">
                  <div className="text-sm font-medium">Selettore Colore Avanzato</div>
                  
                  <div className="space-y-3">
                    {/* Color Picker Nativo */}
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-12 rounded border cursor-pointer"
                    />
                    
                    {/* RGB Sliders */}
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500">Controlli RGB</div>
                      
                      {/* Red Slider */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-4 text-red-600 font-bold">R</span>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={parseInt(selectedColor.slice(1, 3), 16)}
                          onInput={(e) => {
                            // ✅ SOLUZIONE: Usa onInput invece di onChange per fluidità
                            const r = parseInt(e.currentTarget.value).toString(16).padStart(2, '0');
                            const g = selectedColor.slice(3, 5);
                            const b = selectedColor.slice(5, 7);
                            setSelectedColor(`#${r}${g}${b}`);
                          }}
                          onPointerDown={(e) => e.stopPropagation()} // ✅ Usa pointer events
                          onPointerMove={(e) => e.stopPropagation()} // ✅ Evita interferenze durante drag
                          onPointerUp={(e) => e.stopPropagation()}   // ✅ Evita interferenze al rilascio
                          className="flex-1 h-2 rounded appearance-none cursor-pointer"
                          style={{ 
                            background: `linear-gradient(to right, #000000, #ff0000)`,
                            // ✅ SOLUZIONE: Forza pointer-events su auto per override Radix
                            pointerEvents: 'auto'
                          }}
                        />
                        <span className="text-xs w-8 text-right font-mono">{parseInt(selectedColor.slice(1, 3), 16)}</span>
                      </div>
                      
                      {/* Green Slider */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-4 text-green-600 font-bold">G</span>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={parseInt(selectedColor.slice(3, 5), 16)}
                          onInput={(e) => {
                            // ✅ SOLUZIONE: Usa onInput invece di onChange per fluidità
                            const r = selectedColor.slice(1, 3);
                            const g = parseInt(e.currentTarget.value).toString(16).padStart(2, '0');
                            const b = selectedColor.slice(5, 7);
                            setSelectedColor(`#${r}${g}${b}`);
                          }}
                          onPointerDown={(e) => e.stopPropagation()} // ✅ Usa pointer events
                          onPointerMove={(e) => e.stopPropagation()} // ✅ Evita interferenze durante drag
                          onPointerUp={(e) => e.stopPropagation()}   // ✅ Evita interferenze al rilascio
                          className="flex-1 h-2 rounded appearance-none cursor-pointer"
                          style={{ 
                            background: `linear-gradient(to right, #000000, #00ff00)`,
                            // ✅ SOLUZIONE: Forza pointer-events su auto per override Radix
                            pointerEvents: 'auto'
                          }}
                        />
                        <span className="text-xs w-8 text-right font-mono">{parseInt(selectedColor.slice(3, 5), 16)}</span>
                      </div>
                      
                      {/* Blue Slider */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-4 text-blue-600 font-bold">B</span>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={parseInt(selectedColor.slice(5, 7), 16)}
                          onInput={(e) => {
                            // ✅ SOLUZIONE: Usa onInput invece di onChange per fluidità
                            const r = selectedColor.slice(1, 3);
                            const g = selectedColor.slice(3, 5);
                            const b = parseInt(e.currentTarget.value).toString(16).padStart(2, '0');
                            setSelectedColor(`#${r}${g}${b}`);
                          }}
                          onPointerDown={(e) => e.stopPropagation()} // ✅ Usa pointer events
                          onPointerMove={(e) => e.stopPropagation()} // ✅ Evita interferenze durante drag
                          onPointerUp={(e) => e.stopPropagation()}   // ✅ Evita interferenze al rilascio
                          className="flex-1 h-2 rounded appearance-none cursor-pointer"
                          style={{ 
                            background: `linear-gradient(to right, #000000, #0000ff)`,
                            // ✅ SOLUZIONE: Forza pointer-events su auto per override Radix
                            pointerEvents: 'auto'
                          }}
                        />
                        <span className="text-xs w-8 text-right font-mono">{parseInt(selectedColor.slice(5, 7), 16)}</span>
                      </div>
                    </div>
                    
                    {/* Input Hex */}
                    <div className="flex gap-2">
                      <span className="text-sm text-gray-500 font-mono self-center">#</span>
                      <Input
                        type="text"
                        value={selectedColor.slice(1)}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          if (value.match(/^[0-9A-F]{0,6}$/)) {
                            setSelectedColor(`#${value}`);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()} // ✅ Evita chiusura
                        placeholder="6366F1"
                        className="font-mono text-sm"
                        maxLength={6}
                      />
                    </div>
                  </div>

                  {/* Colori Suggeriti */}
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">Colori Popolari</div>
                    <div className="grid grid-cols-7 gap-2">
                      {suggestedColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={cn(
                            "w-8 h-8 rounded border transition-all duration-200 hover:scale-110",
                            selectedColor === color 
                              ? "ring-2 ring-cambridge-newStyle border-cambridge-newStyle" 
                              : "border-gray-300 hover:border-gray-500"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={(e) => {
                            e.stopPropagation(); // ✅ Evita chiusura
                            setSelectedColor(color);
                          }}
                          onMouseDown={(e) => e.stopPropagation()} // ✅ Evita chiusura durante click
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      size="sm" 
                      onClick={() => setIsColorPickerOpen(false)}
                      className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90"
                    >
                      Conferma
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-1">
                Colore Selezionato
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {selectedColor.toUpperCase()}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Clicca il quadrato per il selettore avanzato
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-gray-500 mb-2">Anteprima Carta</div>
            <div 
              className="mx-auto w-24 h-16 rounded-lg border-2 border-gray-300 flex items-center justify-center text-white font-bold text-xl shadow-lg"
              style={{ backgroundColor: selectedColor }}
            >
              
            </div>
          </div>
        </div>
      )}
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleClose} className="flex-1">
          Annulla
        </Button>
        <Button 
          onClick={nextStep}
          disabled={!selectedSupermarket}
          className="flex-1 bg-cambridge-newStyle hover:bg-cambridge-newStyle/90"
        >
          Continua
        </Button>
      </div>
    </div>
  );

  // Scanner step
  const BarcodeScanner = () => (
    <div className="space-y-6">
      <div className="relative mx-auto w-full max-w-sm">
        <Card className="bg-black text-white">
          <CardContent className="p-8 text-center">
            <Scan className="mx-auto h-16 w-16 mb-4 text-cambridge-newStyle" />
            <p className="text-lg font-medium mb-2">Scanner Barcode Avanzato</p>
            
            {/* Video placeholder per scanner */}
            <div className="w-64 h-48 mx-auto border-2 border-cambridge-newStyle rounded-lg flex items-center justify-center bg-gray-900 relative overflow-hidden">
              {/* Linea di scansione animata */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-0.5 bg-cambridge-newStyle animate-pulse shadow-lg shadow-cambridge-newStyle/50"></div>
              </div>
              
              {/* Angoli del mirino */}
              <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-cambridge-newStyle"></div>
              <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-cambridge-newStyle"></div>
              <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-cambridge-newStyle"></div>
              <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-cambridge-newStyle"></div>
              
              <div className="text-cambridge-newStyle text-xs">
                {scannedData ? '✅ Codice acquisito!' : '🔍 Scanning...'}
              </div>
            </div>
            
            {/* Video element per scanner reale */}
            <video 
              id="barcode-scanner-video" 
              className="hidden w-64 h-48 mx-auto border-2 border-cambridge-newStyle rounded-lg object-cover"
              autoPlay 
              playsInline
              muted
            ></video>
          </CardContent>
        </Card>
      </div>
      
      <div className={cn(
        "text-center font-medium",
        scannedData ? "text-green-600" : "text-gray-600"
      )}>
        {qrStatus}
      </div>
      
      {scannedData && (
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">Codice rilevato:</div>
          <div className="font-mono text-lg font-bold text-green-700">{scannedData}</div>
        </div>
      )}
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={prevStep} className="flex-1">
          Indietro
        </Button>
        <Button 
          onClick={nextStep}
          disabled={!scannedData}
          className="flex-1 bg-cambridge-newStyle hover:bg-cambridge-newStyle/90"
        >
          Continua
        </Button>
      </div>
    </div>
  );

  // Conferma finale
  const ConfirmationStep = () => {
    if (!selectedSupermarket) return null;
    
    const marketData = supermarketData[selectedSupermarket];
    const formattedNumber = scannedData.length > 12 ? 
      scannedData.replace(/(.{4})/g, '$1 ').trim() : 
      scannedData;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <Label className="text-sm font-medium mb-3 block">Anteprima Carta</Label>
          <Card 
            className="mx-auto w-full max-w-xs"
            style={{ 
              backgroundColor: selectedSupermarket === 'altro' ? selectedColor : marketData.color,
              aspectRatio: '3/2'
            }}
          >
            <CardContent className="p-4 h-full flex flex-col justify-center items-center text-white">
              <div className="text-3xl mb-2">{marketData.logo}</div>
              <div className="font-bold text-sm uppercase">{marketData.name}</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Nome Carta</Label>
            <Input 
              value={`${marketData?.name} ${marketData?.type}`} 
              readOnly 
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Numero Carta</Label>
            <Input 
              value={formattedNumber} 
              readOnly 
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Tipo</Label>
            <Input 
              value={marketData?.type} 
              readOnly 
              className="mt-1"
            />
          </div>

          {/* Switch Visibilità */}
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center">
                {isCardPublic ? (
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
                {isCardPublic 
                  ? 'Questa carta sarà visibile a tutti i membri della famiglia'
                  : 'Questa carta sarà visibile solo a te'
                }
              </p>
            </div>
            <Switch
              checked={isCardPublic}
              onCheckedChange={setIsCardPublic}
              className="data-[state=checked]:bg-cambridge-newStyle"
            />
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={prevStep} className="flex-1">
            Indietro
          </Button>
          <Button 
            onClick={saveCard}
            className="flex-1 bg-cambridge-newStyle hover:bg-cambridge-newStyle/90"
          >
            Salva Carta
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          // ✅ SOLUZIONE: Previeni chiusura automatica durante drag
          e.preventDefault();
        }}
        onInteractOutside={(e) => {
          // ✅ SOLUZIONE: Previeni chiusura durante qualsiasi interazione esterna
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-cambridge-newStyle">Aggiungi Carta Fedeltà</DialogTitle>
          <DialogDescription>
            Seleziona il negozio e scansiona il codice a barre della carta
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center space-x-2 my-4">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={cn(
                "w-3 h-3 rounded-full transition-colors",
                step <= currentStep 
                  ? "bg-cambridge-newStyle" 
                  : "bg-gray-200"
              )}
            />
          ))}
        </div>

        {currentStep === 1 && <SupermarketSelection />}
        {currentStep === 2 && <BarcodeScanner />}
        {currentStep === 3 && <ConfirmationStep />}
      </DialogContent>
    </Dialog>
  );
};
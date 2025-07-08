// ===== FIXED FILE: src/components/shopping/PriceSelectorModal.tsx =====

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Euro, 
  ExternalLink, 
  Code, 
  CheckCircle2, 
  Circle,
  AlertTriangle,
  Loader2,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Interfaces che corrispondono al tuo modello
interface DetectedPrice {
  value: string;
  numericValue: number;
  cssSelector: string;
  parentClasses?: string[];
  elementText: string;
  confidence?: number; // 🔧 FIX: Reso opzionale
  position?: {
    index: number;
    depth: number;
  };
  context?: {
    nearbyText?: string;
    isProminent?: boolean;
  };
}

interface PendingPriceItem {
  id: string;
  name?: string;
  link: string;
  createdBy: string;
  priceSelection?: {
    status: string;
    detectedPrices: DetectedPrice[];
  };
  createdAt: any;
  category: string;
}

interface PriceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PendingPriceItem | null;
  onPriceSelected: (itemId: string, priceIndex: number) => Promise<boolean>;
  onSkip?: (itemId: string) => void;
}

export function PriceSelectionModal({ 
  isOpen, 
  onClose, 
  item, 
  onPriceSelected,
  onSkip 
}: PriceSelectionModalProps) {
  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!item || !item.priceSelection?.detectedPrices) {
    return null;
  }

  const detectedPrices = item.priceSelection.detectedPrices;
  // 🔧 DEBUG: Verifica confidence per ogni prezzo
  detectedPrices.forEach((price, index) => {
      });

  const handleConfirm = async () => {
    if (selectedPriceIndex === null) return;
    
    setIsLoading(true);
    try {
      const success = await onPriceSelected(item.id, selectedPriceIndex);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Errore selezione prezzo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip(item.id);
    }
    onClose();
  };

  // 🔧 FIX: Gestione sicura della confidence
  const getConfidenceBadge = (confidence?: number) => {
    // Se confidence è undefined o null, usa un valore di default
    const safeConfidence = confidence != null ? confidence : 0.5;
    const percentage = Math.round(safeConfidence * 100);
    
    if (safeConfidence >= 0.7) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Alta ({percentage}%)</Badge>;
    } else if (safeConfidence >= 0.4) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Media ({percentage}%)</Badge>;
    } else {
      return <Badge variant="outline" className="bg-red-100 text-red-800">Bassa ({percentage}%)</Badge>;
    }
  };

  // 🔧 FIX: Gestione sicura del prezzo numerico
  const formatNumericPrice = (numericValue?: number, fallbackValue?: string) => {
    if (numericValue != null && !isNaN(numericValue)) {
      return `${numericValue.toFixed(2)} €`;
    }
    
    // Se non c'è numericValue, prova a estrarre da fallbackValue
    if (fallbackValue) {
      const match = fallbackValue.match(/(\d+[.,]\d{2})/);
      if (match) {
        const extracted = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(extracted)) {
          return `${extracted.toFixed(2)} €`;
        }
      }
    }
    
    return fallbackValue || 'N/A';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Euro className="h-6 w-6 text-blue-600" />
            Seleziona il prezzo corretto
          </DialogTitle>
          <DialogDescription>
            Sono stati rilevati più prezzi in questa pagina. Seleziona quello del prodotto che vuoi monitorare.
          </DialogDescription>
        </DialogHeader>

        {/* Informazioni prodotto */}
        <div className="border-b pb-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{item.name || 'Prodotto'}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                <ExternalLink className="h-4 w-4" />
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate max-w-md"
                >
                  {item.link}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Lista prezzi rilevati */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {detectedPrices.map((price, index) => (
            <Card 
              key={index}
              className={cn(
                "cursor-pointer transition-all border-2",
                selectedPriceIndex === index 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-gray-200 hover:border-gray-300"
              )}
              onClick={() => setSelectedPriceIndex(index)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  
                  {/* Prezzo principale */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-6 h-6">
                      {selectedPriceIndex === index ? (
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-gray-900">
                          {price.value}
                        </span>
                        <span className="text-lg text-gray-600">
                          ({formatNumericPrice(price.numericValue, price.value)})
                        </span>
                        
                        {/* Badge prominenza */}
                        {price.context?.isProminent && (
                          <Badge variant="default" className="bg-orange-100 text-orange-800">
                            <Star className="h-3 w-3 mr-1" />
                            Prominente
                          </Badge>
                        )}
                        
                        {/* Badge confidence - 🔧 FIX qui */}
                        {getConfidenceBadge(price.confidence)}
                      </div>
                      
                      {/* Contesto */}
                      {price.context?.nearbyText && (
                        <div className="text-sm text-gray-600 mb-2">
                          <strong>Contesto:</strong> "{price.context.nearbyText}"
                        </div>
                      )}
                      
                      {/* Testo elemento */}
                      <div className="text-sm text-gray-500 mb-2 bg-gray-50 p-2 rounded font-mono">
                        <strong>HTML:</strong> {(price.elementText || '').substring(0, 100)}
                        {(price.elementText || '').length > 100 && '...'}
                      </div>
                      
                      {/* CSS Selector collassabile */}
                      <details className="text-sm">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800 flex items-center gap-1">
                          <Code className="h-3 w-3" />
                          CSS Selector
                        </summary>
                        <div className="mt-2 p-2 bg-gray-900 text-green-400 rounded font-mono text-xs break-all">
                          {price.cssSelector || 'N/A'}
                        </div>
                        {price.parentClasses && price.parentClasses.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            <strong>Parent classes:</strong> {price.parentClasses.slice(0, 5).join(', ')}
                            {price.parentClasses.length > 5 && ` +${price.parentClasses.length - 5} altre`}
                          </div>
                        )}
                      </details>
                    </div>
                  </div>
                  
                  {/* Indicatore selezione */}
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 transition-colors",
                    selectedPriceIndex === index
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-300"
                  )} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Warning se nessuna selezione */}
        {selectedPriceIndex === null && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              Seleziona un prezzo per continuare
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-500">
            {detectedPrices.length} prezzi rilevati
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isLoading}
            >
              Salta per ora
            </Button>
            
            <Button
              onClick={handleConfirm}
              disabled={selectedPriceIndex === null || isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Conferma'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente helper per preview prezzi (opzionale) - 🔧 FIX anche qui
export function PricePreview({ price }: { price: DetectedPrice }) {
  const safeConfidence = price.confidence != null ? price.confidence : 0.5;
  
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
      <span className="font-semibold">{price.value}</span>
      <Badge variant="outline" className="text-xs">
        {Math.round(safeConfidence * 100)}%
      </Badge>
      {price.context?.isProminent && (
        <Star className="h-3 w-3 text-orange-500" />
      )}
    </div>
  );
}
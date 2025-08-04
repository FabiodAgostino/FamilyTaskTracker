// URLImageModal.tsx - Modale per inserimento URL immagine
import React, { useState, useEffect } from 'react';
import { 
  Link, 
  AlertCircle, 
  Check,
  Loader2,
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface URLImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  productName: string;
  brandName?: string;
}

export const URLImageModal: React.FC<URLImageModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  productName,
  brandName
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isValid, setIsValid] = useState(false);

  // Reset stato quando si apre/chiude la modale
  useEffect(() => {
    if (isOpen) {
      setImageUrl('');
      setPreviewImage('');
      setError('');
      setIsValid(false);
      setIsValidating(false);
    }
  }, [isOpen]);

  // Valida URL immagine
  const validateImageUrl = async (url: string) => {
    if (!url.trim()) {
      setError('');
      setPreviewImage('');
      setIsValid(false);
      return;
    }

    // Controllo formato URL
    try {
      new URL(url);
    } catch {
      setError('URL non valido');
      setPreviewImage('');
      setIsValid(false);
      return;
    }

    // Controllo se è un'immagine valida
    const isValidImageUrl = (url: string) => {
      // 1. URL con estensione immagine esplicita
      const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url);
      
      // 2. URL da CDN comuni per immagini (anche senza estensione)
      const isFromImageCDN = /(?:cdn|images?|media|static|assets)[^/]*.*\/.*(?:image|photo|picture|gallery)/i.test(url);
      
      // 3. Path che indica chiaramente immagini
      const hasImagePath = /\/(?:image|img|photo|picture|gallery|media|upload)[s]?[\/\w-]/i.test(url);
      
      // 4. CDN noti per immagini con parametri
      const isKnownImageCDN = /(?:cloudinary|imgix|amazonaws|cloudfront|akamai|fastly|thron|shopify|wix|squarespace)\.com/i.test(url);
      
      // 5. Parametri che indicano formato immagine
      const hasImageParams = /[?&](?:format|f)=(?:auto|jpg|jpeg|png|webp|gif)/i.test(url);
      
      return hasImageExtension || isFromImageCDN || hasImagePath || isKnownImageCDN || hasImageParams;
    };

    if (!isValidImageUrl(url)) {
      setError('L\'URL deve puntare a un\'immagine. Supportati: file con estensione immagine, CDN di immagini, o path che indicano immagini.');
      setPreviewImage('');
      setIsValid(false);
      return;
    }

    setIsValidating(true);
    setError('');

    // Test caricamento immagine
    const img = new Image();
    
    img.onload = () => {
      setPreviewImage(url);
      setIsValid(true);
      setIsValidating(false);
      setError('');
    };

    img.onerror = () => {
      setError('Impossibile caricare l\'immagine da questo URL');
      setPreviewImage('');
      setIsValid(false);
      setIsValidating(false);
    };

    img.src = url;
  };

  // Debounce validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (imageUrl.trim()) {
        validateImageUrl(imageUrl);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [imageUrl]);

  const handleUrlChange = (value: string) => {
    setImageUrl(value);
    if (!value.trim()) {
      setError('');
      setPreviewImage('');
      setIsValid(false);
      setIsValidating(false);
    }
  };

  const handleConfirm = () => {
    if (isValid && previewImage) {
      onSelectImage(previewImage);
      onClose();
    }
  };

  const handleCancel = () => {
    setImageUrl('');
    setPreviewImage('');
    setError('');
    setIsValid(false);
    setIsValidating(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent 
        className="max-w-2xl"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <DialogHeader onClick={(e) => e.stopPropagation()}>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-blue-600" />
            Carica immagine da URL
          </DialogTitle>
          <DialogDescription>
            Inserisci l'URL di un'immagine per <span className="font-medium">{productName}</span>
            {brandName && <span className="text-gray-500"> di {brandName}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6" onClick={(e) => e.stopPropagation()}>
          {/* Input URL */}
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <Label htmlFor="image-url">URL Immagine</Label>
            <div className="relative">
              <Input
                id="image-url"
                type="url"
                placeholder="https://esempio.com/immagine.jpg"
                value={imageUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className={`pr-10 ${
                  error ? 'border-red-500 focus:border-red-500' : 
                  isValid ? 'border-green-500 focus:border-green-500' : ''
                }`}
              />
              
              {/* Icona stato */}
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : error ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : isValid ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : null}
              </div>
            </div>

            {/* Messaggio di errore */}
            {error && (
              <Alert variant="destructive" onClick={(e) => e.stopPropagation()}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Suggerimenti */}
            {!imageUrl.trim() && (
              <div className="text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                <p className="mb-1">💡 Suggerimenti:</p>
                <ul className="space-y-1 ml-4">
                  <li>• URL con estensione: .jpg, .png, .gif, .webp</li>
                  <li>• CDN di immagini: cloudinary, imgix, thron, etc.</li>
                  <li>• Path immagini: /image/, /photo/, /gallery/</li>
                  <li>• Parametri formato: ?format=auto, ?f=jpg</li>
                  <li>• Verifica che l'immagine sia pubblicamente accessibile</li>
                </ul>
              </div>
            )}
          </div>

          {/* Anteprima immagine */}
          {isValidating && (
            <div 
              className="flex items-center justify-center p-8 bg-gray-50 rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-blue-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Verifica immagine in corso...</span>
              </div>
            </div>
          )}

          {previewImage && !isValidating && (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <Label>Anteprima</Label>
              <div className="relative bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-center">
                  <img
                    src={previewImage}
                    alt="Anteprima immagine"
                    className="max-w-full max-h-48 object-contain rounded shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                    onError={() => {
                      setError('Errore nel caricamento dell\'anteprima');
                      setPreviewImage('');
                      setIsValid(false);
                    }}
                  />
                </div>
                
                {/* Badge successo */}
                <div className="absolute top-2 right-2">
                  <div className="bg-green-500 text-white rounded-full p-1.5 shadow-lg">
                    <Check className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div 
            className="flex items-center justify-between pt-4 border-t"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm text-gray-500">
              {isValid ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Immagine valida
                </span>
              ) : imageUrl.trim() ? (
                <span className="text-gray-500">Inserisci un URL valido</span>
              ) : (
                <span className="text-gray-500">Inserisci l'URL di un'immagine</span>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
              >
                Annulla
              </Button>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirm();
                }}
                disabled={!isValid || isValidating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Conferma URL
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
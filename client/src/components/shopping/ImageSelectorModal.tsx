// src/components/shopping/ImageSelectorModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  Check, 
  AlertCircle, 
  Search,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ProcessedImageResult } from '@/lib/models/types';

interface ImageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  productName: string;
  brandName?: string;
  images: ProcessedImageResult[];
  isLoading: boolean;
  error?: string;
}

interface ImageCardProps {
  image: ProcessedImageResult;
  isSelected: boolean;
  onSelect: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, isSelected, onSelect }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  return (
    <Card 
      className={`
        relative overflow-hidden cursor-pointer transition-all duration-300 group
        hover:shadow-lg hover:scale-[1.02]
        ${isSelected ? 'ring-2 ring-blue-500 shadow-xl' : 'hover:shadow-md'}
      `}
      onClick={onSelect}
    >
      {/* Immagine */}
      <div className="relative aspect-square bg-gray-100">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="w-full h-full" />
          </div>
        )}
        
        {imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-500">
            <AlertCircle className="h-8 w-8 mb-2" />
            <span className="text-xs text-center px-2">Errore caricamento</span>
          </div>
        ) : (
          <img
            src={image.url}
            alt={image.title}
            className={`
              w-full h-full object-cover transition-all duration-300
              ${imageLoading ? 'opacity-0' : 'opacity-100'}
              ${isSelected ? 'brightness-110' : 'group-hover:brightness-105'}
            `}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        )}

        {/* Overlay con informazioni */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300">
          {/* Badge selezione */}
          {isSelected && (
            <div className="absolute top-2 right-2">
              <div className="bg-blue-500 text-white rounded-full p-1.5 shadow-lg">
                <Check className="h-4 w-4" />
              </div>
            </div>
          )}

          {/* Link sorgente in basso */}
          <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs truncate">
              <div className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{new URL(image.contextLink).hostname}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Informazioni immagine */}
      <div className="p-3">
        <p className="text-xs text-gray-600 truncate" title={image.title}>
          {image.title}
        </p>
        <div className="flex items-center justify-between mt-1">
          <Badge variant="outline" className="text-xs">
            {image.width} × {image.height}
          </Badge>
        </div>
      </div>
    </Card>
  );
};

export const ImageSelectorModal: React.FC<ImageSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  productName,
  brandName,
  images,
  isLoading,
  error
}) => {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');

  // ✅ Reset selezione quando si apre la modale
  useEffect(() => {
    if (isOpen) {
      setSelectedImageUrl('');
    }
  }, [isOpen]);

  const handleConfirmSelection = () => {
    if (selectedImageUrl) {
      onSelectImage(selectedImageUrl);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedImageUrl('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                Seleziona un'immagine
              </DialogTitle>
              <DialogDescription className="mt-1">
                Scegli l'immagine per <span className="font-medium">{productName}</span>
                {brandName && <span className="text-gray-500"> di {brandName}</span>}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenuto */}
        <div className="flex-1 overflow-hidden">
          {/* Loading State */}
          {isLoading && (
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <Search className="h-5 w-5 animate-spin" />
                  <span>Ricerca immagini in corso...</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-3">
                      <Skeleton className="h-3 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-6">
              <div className="flex flex-col items-center justify-center text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Errore durante la ricerca
                </h3>
                <p className="text-gray-600 mb-4 max-w-md">
                  {error}
                </p>
                <Button onClick={handleCancel} variant="outline">
                  Chiudi
                </Button>
              </div>
            </div>
          )}

          {/* Images Grid */}
          {!isLoading && !error && (
            <ScrollArea className="h-[60vh]">
              <div className="p-6">
                {images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8">
                    <ImageIcon className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Nessuna immagine trovata
                    </h3>
                    <p className="text-gray-600 mb-4 max-w-md">
                      Non siamo riusciti a trovare immagini per questo prodotto. 
                      Prova a modificare il nome del prodotto o riprova più tardi.
                    </p>
                    <Button onClick={handleCancel} variant="outline">
                      Chiudi
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {images.map((image) => (
                        <ImageCard
                          key={image.id}
                          image={image}
                          isSelected={selectedImageUrl === image.url}
                          onSelect={() => setSelectedImageUrl(image.url)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        {!isLoading && !error && images.length > 0 && (
          <div className="border-t p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedImageUrl ? (
                  <span className="text-green-600 font-medium">
                    ✓ Immagine selezionata
                  </span>
                ) : (
                  'Seleziona un\'immagine per continuare'
                )}
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                >
                  Annulla
                </Button>
                <Button 
                  onClick={handleConfirmSelection}
                  disabled={!selectedImageUrl}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Conferma selezione
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
// ShoppingImageCard.tsx - AGGIORNATO con storico prezzi e tag cambiamento prezzo
import { useState } from 'react';
import { 
  Edit, 
  Trash2, 
  User, 
  Clock, 
  Check, 
  ArrowUp,
  Globe,
  Lock,
  Award,
  Zap,
  Sparkles,
  Eye,
  RefreshCw,
  Loader2,
  Info,
  Link,
  Activity, // ✅ NUOVO: Icona per storico prezzi
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDistanceToNow, isValid } from 'date-fns';
import { it } from 'date-fns/locale';
import { Category, ProcessedImageResult } from '@/lib/models/types';
import { googleSearchService } from '@/services/googleSearchService';
import { ImageSelectorModal } from './ImageSelectorModal';
import { PriceHistoryModal } from './PriceHistoryModal'; // ✅ NUOVO: Import modale storico prezzi
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ShoppingItem } from '@/lib/models/shopping-item';
import { URLImageModal } from './UrlImageModal';

interface ShoppingImageCardProps {
  item: ShoppingItem;
  categories: Category[];
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onUpdate?: (updatedItem: ShoppingItem) => void;
  onClick?: (item: ShoppingItem) => void;
  viewMode?: 'compact' | 'images';
}

export function ShoppingImageCard({ 
  item, 
  categories, 
  onEdit, 
  onDelete, 
  onComplete,
  onUpdate,
  onClick,
  viewMode = 'images'
}: ShoppingImageCardProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isCompleting, setIsCompleting] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Stati per rigenerazione immagine
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [searchedImages, setSearchedImages] = useState<ProcessedImageResult[]>([]);
  const [searchError, setSearchError] = useState<string>('');
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  // Stati per modali
  const [showURLModal, setShowURLModal] = useState(false);
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false); // ✅ NUOVO: Stato modale storico prezzi

  const canEdit = user?.username === item.createdBy || user?.role === 'admin' || item.isPublic;
  const canRegenerateImage = canEdit && item.canUpdateImage();

  const isClickEnabled = !isMobile && viewMode === 'images';

  // ✅ NUOVO: Funzioni per calcolare il cambiamento di prezzo
  const getPriceChangeInfo = () => {
    const history = item.historicalPriceWithDates || [];
    if (history.length === 0) return null;

    // Trova l'ultimo cambiamento che non sia 'initial'
    const lastChange = history
      .filter(entry => entry.changeType !== 'initial')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!lastChange) return null;

    const isIncrease = lastChange.changeType === 'increase';
    const isDecrease = lastChange.changeType === 'decrease';

    if (!isIncrease && !isDecrease) return null;

    // Calcola percentuale se disponibile oldPrice
    let percentage = null;
    if (lastChange.oldPrice) {
      percentage = ((lastChange.price - lastChange.oldPrice) / lastChange.oldPrice) * 100;
    }

    return {
      type: lastChange.changeType,
      isIncrease,
      isDecrease,
      percentage,
      fromPrice: lastChange.oldPrice,
      toPrice: lastChange.price
    };
  };

  const priceChangeInfo = getPriceChangeInfo();

  // Controlla se ha storico prezzi
  const hasPriceHistory = item.historicalPriceWithDates && item.historicalPriceWithDates.length > 0;

  // Funzione per troncare il titolo
  const truncateTitle = (title: string, maxLength: number = 35): { display: string; isTruncated: boolean } => {
    if (!title || title.length <= maxLength) {
      return { display: title || 'Prodotto senza nome', isTruncated: false };
    }
    return { 
      display: title.substring(0, maxLength) + '...', 
      isTruncated: true 
    };
  };

  const titleData = truncateTitle(item.name || 'Prodotto senza nome');
  
  const isAIProcessing = item.scrapingData && item.scrapingData.scrapingSuccess !== true;
  const hasAIData = item.scrapingData && item.scrapingData.scrapingSuccess === true;

  const formatSafeDate = (date: Date | undefined): string => {
    if (!date || !isValid(date)) {
      return 'Data non disponibile';
    }
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: it });
    } catch (error) {
      return 'Data non valida';
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete(item.id);
      toast({
        title: 'Elemento Archiviato',
        description: 'Elemento Shopping segnato come Archiviato!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: "Impossibile segnare l'elemento come Archiviato",
        variant: 'destructive',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(item.id);
      toast({
        title: 'Elemento eliminato',
        description: 'Elemento della Shopping eliminato con successo!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: "Impossibile eliminare l'elemento",
        variant: 'destructive',
      });
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('a') ||
      (e.target as HTMLElement).closest('[role="button"]')
    ) {
      return;
    }
    
    if (!isClickEnabled) {
      return;
    }

    if (item.completed) {
    setShowUnarchiveModal(true);
    return;
  }
    
    if (onClick) {
      onClick(item);
    }
  };

  const handleDetailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(item);
    }
  };

  const handleUnarchive = async () => {
  setIsUnarchiving(true);
  try {
    await onComplete(item.id); // Usa la stessa funzione che togglea lo stato
    toast({
      title: 'Elemento ripristinato',
      description: 'Elemento rimesso nella lista shopping!',
    });
    setShowUnarchiveModal(false);
  } catch (error) {
    toast({
      title: 'Errore',
      description: "Impossibile ripristinare l'elemento",
      variant: 'destructive',
    });
  } finally {
    setIsUnarchiving(false);
  }
};

  // Handler per rigenerare immagine
  const handleRegenerateImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!canRegenerateImage) {
      toast({
        title: 'Operazione non consentita',
        description: 'L\'immagine di questo prodotto è stata bloccata e non può essere modificata.',
        variant: 'destructive',
      });
      return;
    }

    if (!item.name?.trim()) {
      toast({
        title: 'Nome prodotto richiesto',
        description: 'È necessario specificare un nome per il prodotto per cercare le immagini.',
        variant: 'destructive',
      });
      return;
    }

    setIsSearchingImages(true);
    setSearchError('');
    setSearchedImages([]);

    try {
      const images = await googleSearchService.searchProductImages(
        item.link,
        item.name,item.brandName!,
        10
      );
      if (images.length === 0) {
        toast({
          title: 'Nessuna immagine trovata',
          description: 'Non sono state trovate immagini per questo prodotto. Prova a modificare il nome.',
          variant: 'destructive',
        });
        return;
      }

      setSearchedImages(images);
      setShowImageSelector(true);

      toast({
        title: 'Ricerca completata',
        description: `Trovate ${images.length} immagini. Seleziona quella che preferisci.`,
      });

    } catch (error) {
      console.error('❌ Errore ricerca immagini:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      setSearchError(errorMessage);
      
      toast({
        title: 'Errore ricerca immagini',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSearchingImages(false);
    }
  };

  // Handler per aprire modale URL
  const handleOpenURLModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!canRegenerateImage) {
      toast({
        title: 'Operazione non consentita',
        description: 'L\'immagine di questo prodotto è stata bloccata e non può essere modificata.',
        variant: 'destructive',
      });
      return;
    }

    setShowURLModal(true);
  };

  // ✅ NUOVO: Handler per aprire modale storico prezzi
  const handleOpenPriceHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPriceHistoryModal(true);
  };

  // Handler comune per aggiornare l'immagine (da ricerca o URL)
  const handleSelectImage = async (imageUrl: string) => {
    try {
      const itemRef = doc(db, 'shopping_items', item.id);
      await updateDoc(itemRef, {
        imageUrl: imageUrl,
        imageUpdated: true,
        updatedAt: new Date()
      });

      if (onUpdate) {
        const updatedItem = Object.assign(Object.create(Object.getPrototypeOf(item)), item, {
        imageUrl,
        imageUpdated: true,
        updatedAt: new Date()
      });
        onUpdate(updatedItem);
      }

      // Chiudi entrambe le modali
      setShowImageSelector(false);
      setShowURLModal(false);
      setSearchedImages([]);
      setSearchError('');

      toast({
        title: 'Immagine aggiornata',
        description: 'L\'immagine del prodotto è stata aggiornata con successo!',
      });

    } catch (error) {
      console.error('❌ Errore aggiornamento immagine:', error);
      toast({
        title: 'Errore aggiornamento',
        description: 'Impossibile aggiornare l\'immagine del prodotto.',
        variant: 'destructive',
      });
    }
  };

  const formatPrice = (price: number | string): string => {
    if (typeof price === 'string') {
      return price;
    }
    return price.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  };

  // Trova la categoria per styling
  const categoryData = categories?.find(cat => cat.name === item.category);

  // Controlla se abbiamo un'immagine valida
  const hasValidImage = item.imageUrl && !imageError;

  return (
    <TooltipProvider>
      <Card 
        className={`
          transition-all duration-300 hover:shadow-xl border group relative overflow-hidden
          ${item.completed ? 'opacity-60' : ''} 
          ${item.priority === 'high' ? 'ring-2 ring-red-400 dark:ring-red-500' : ''}
          ${isAIProcessing ? 'ring-2 ring-blue-400' : ''}
          ${isClickEnabled ? 'cursor-pointer' : 'cursor-default'}
        `}
        onClick={handleCardClick}
      >
        
        {/* IMMAGINE PRODOTTO - Con overlay sempre presente */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
          {hasValidImage ? (
            <>
              <img
                src={item.imageUrl}
                alt={item.name || 'Prodotto'}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => setImageError(true)}
                loading="lazy"
              />
              
              {item.estimatedPrice && (
                <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm rounded-md px-2 py-1 shadow-md">
                  <span className="font-bold text-green-600 text-sm">
                    {formatPrice(item.estimatedPrice)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">
                <div className="text-center">
                  <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nessuna immagine</p>
                </div>
              </div>
              
              {item.estimatedPrice && (
                <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm rounded-md px-2 py-1 shadow-md">
                  <span className="font-bold text-green-600 text-sm">
                    {formatPrice(item.estimatedPrice)}
                  </span>
                </div>
              )}
            </>
          )}

          {/* OVERLAY CON AZIONI - Sempre presente su hover */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300">
            {/* Azioni in alto a destra */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {/* Link prodotto */}
              {item.link && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-md"
                      onClick={(e) => e.stopPropagation()}
                      asChild
                    >
                      <a href={item.link} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4 text-gray-500 dark:text-black-300" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Vedi prodotto</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Azioni solo se si può modificare */}
              {canEdit && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(item);
                        }}
                        className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-md"
                      >
                       <Edit className="h-4 w-4 text-gray-500 dark:text-black-300" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Modifica</p>
                    </TooltipContent>
                  </Tooltip>
                  {item.priceSelection?.selectedCssSelector=="[data-json-price]"? "ciaooo" : ""}
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 p-0 bg-white/90 hover:bg-red-100 shadow-md text-red-600"
                          >
                            <Trash2 className="h-4 w-4 text-gray-500 dark:text-black-300" />
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Elimina</p>
                      </TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare "{item.name || 'questo elemento'}"? Questa azione non può essere annullata.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>

            {/* ✅ AGGIORNATO: Bottoni per gestione immagini e storico prezzi - Con spazio tra loro */}
            {canEdit && (
              <div className="absolute bottom-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {/* Bottone Rigenera Immagine */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRegenerateImage}
                      disabled={isSearchingImages || !canRegenerateImage}
                      className={`
                        h-8 w-8 p-0 bg-white/90 shadow-md transition-colors
                        ${!canRegenerateImage 
                          ? 'hover:bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'hover:bg-blue-100 text-blue-600'
                        }
                      `}
                    >
                      {isSearchingImages ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {!canRegenerateImage 
                        ? 'Immagine bloccata' 
                        : isSearchingImages 
                          ? 'Ricerca in corso...' 
                          : 'Rigenera immagine'
                      }
                    </p>
                  </TooltipContent>
                </Tooltip>

                {/* Bottone Carica da URL */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleOpenURLModal}
                      disabled={!canRegenerateImage}
                      className={`
                        h-8 w-8 p-0 bg-white/90 shadow-md transition-colors
                        ${!canRegenerateImage 
                          ? 'hover:bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'hover:bg-purple-100 text-purple-600'
                        }
                      `}
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {!canRegenerateImage 
                        ? 'Immagine bloccata' 
                        : 'Carica da URL'
                      }
                    </p>
                  </TooltipContent>
                </Tooltip>

                {/* ✅ NUOVO: Bottone Storico Prezzi */}
                {hasPriceHistory && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleOpenPriceHistory}
                        className="h-8 w-8 p-0 bg-white/90 shadow-md transition-colors hover:bg-green-100 text-green-600"
                      >
                        <Activity className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Storico prezzi</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
          
          {/* ✅ AGGIORNATO: Badge priorità e status nell'immagine - Con tag cambiamento prezzo */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {item.priority === 'high' && (
              <Badge variant="outline" className="bg-red-500 text-white border-red-500 text-xs">
                <ArrowUp className="h-2 w-2 mr-1" />
                Urgente
              </Badge>
            )}
            
            {isAIProcessing && (
              <Badge variant="outline" className="bg-blue-500 text-white border-blue-500 text-xs animate-pulse">
                <Sparkles className="h-2 w-2 mr-1" />
                AI
              </Badge>
            )}
            
            {hasAIData && (
              <Badge variant="outline" className="bg-purple-500 text-white border-purple-500 text-xs">
                <Zap className="h-2 w-2 mr-1" />
                AI
              </Badge>
            )}

            {item.imageUpdated && (
              <Badge variant="outline" className="bg-orange-500 text-white border-orange-500 text-xs">
                <Lock className="h-2 w-2 mr-1" />
                IMG
              </Badge>
            )}

            {/* ✅ NUOVO: Tag cambiamento prezzo */}
            {priceChangeInfo && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge 
                    variant="outline" 
                    className={`text-white text-xs ${
                      priceChangeInfo.isIncrease 
                        ? 'bg-red-500 border-red-500' 
                        : 'bg-green-500 border-green-500'
                    }`}
                  >
                    {priceChangeInfo.isIncrease ? (
                      <TrendingUp className="h-2 w-2 mr-1" />
                    ) : (
                      <TrendingDown className="h-2 w-2 mr-1" />
                    )}
                    {priceChangeInfo.percentage && Math.abs(priceChangeInfo.percentage) > 0 
                      ? `${priceChangeInfo.percentage > 0 ? '+' : ''}${priceChangeInfo.percentage.toFixed(1)}%`
                      : priceChangeInfo.isIncrease ? '↑' : '↓'
                    }
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Prezzo {priceChangeInfo.isIncrease ? 'aumentato' : 'diminuito'}
                    {priceChangeInfo.fromPrice && ` da ${formatPrice(priceChangeInfo.fromPrice)}`}
                    {` a ${formatPrice(priceChangeInfo.toPrice)}`}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Overlay di caricamento durante la ricerca */}
          {isSearchingImages && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-4 flex items-center gap-3 shadow-lg">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium">Ricerca immagini...</span>
              </div>
            </div>
          )}
        </div>

        {/* CONTENUTO CARD */}
        <CardContent className="p-4">
          {/* Header con titolo e brand */}
          <div className="mb-2">
            {item.brandName && (
              <p className="text-xs text-gray-500 mb-1 truncate">{item.brandName}</p>
            )}
            
            {titleData.isTruncated ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className={`font-medium text-sm leading-tight cursor-help ${item.completed ? 'line-through' : ''}`}>
                    {titleData.display}
                  </h3>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{item.name}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <h3 className={`font-medium text-sm leading-tight ${item.completed ? 'line-through' : ''}`}>
                {titleData.display}
              </h3>
            )}
          </div>

          {/* Badge categoria e visibilità */}
          <div className="flex items-center justify-between mb-3">
            <Badge 
              variant="outline"
              className="text-xs px-2 py-0.5"
              style={categoryData ? { 
                backgroundColor: `${categoryData.color}20`, 
                color: categoryData.color, 
                borderColor: categoryData.color 
              } : undefined}
            >
              {categoryData?.icon && <span className="mr-1 text-xs">{categoryData.icon}</span>}
              {item.category}
            </Badge>
            
            <div className="flex items-center gap-1">
              {item.isPublic ? (
                <Globe className="w-3 h-3 text-green-600" />
              ) : (
                <Lock className="w-3 h-3 text-orange-600" />
              )}
            </div>
          </div>

          {/* Footer compatto - Solo icone */}
          <div className="space-y-2">
            {/* Icone info compatte */}
            <div className="flex items-center justify-between">
              {/* Autore */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-3 w-3 text-blue-600" />
                    </div>
                    <span className="text-xs text-gray-600 truncate max-w-[60px]">
                      {item.createdBy}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Creato da: {item.createdBy}</p>
                </TooltipContent>
              </Tooltip>
              
              {/* Data */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                    <Clock className="h-3 w-3 text-gray-600" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{formatSafeDate(item.createdAt)}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {!item.completed && (
              <div className={`flex gap-2 ${!isClickEnabled ? 'w-full' : ''}`}>
                {/* Bottone Dettaglio solo quando il click è disabilitato */}
                {!isClickEnabled && onClick && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleDetailClick}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
                      >
                        {isMobile ? (
                          <Info className="h-4 w-4" />
                        ) : (
                          <>
                            <Info className="mr-1 h-3 w-3" />
                            Dettaglio
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    {isMobile && (
                      <TooltipContent>
                        <p>Dettaglio</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                )}
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplete();
                      }}
                      disabled={isCompleting}
                      variant="outline"
                      size="sm"
                      className={`${!isClickEnabled ? 'flex-1' : 'w-full'} h-8 bg-green-50 hover:bg-green-100 text-green-700 border-green-300`}
                    >
                      {isCompleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isMobile ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Archivia
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  {isMobile && (
                    <TooltipContent>
                      <p>{isCompleting ? 'Archiviando...' : 'Archivia'}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            )}
          </div>
        </CardContent>

        {/* ✅ AGGIORNATO: Tutte le modali */}
        {/* Modale per selezione immagini da ricerca */}
        <ImageSelectorModal
          isOpen={showImageSelector}
          onClose={() => setShowImageSelector(false)}
          onSelectImage={handleSelectImage}
          productName={item.name || 'Prodotto'}
          brandName={item.brandName}
          images={searchedImages}
          isLoading={isSearchingImages}
          error={searchError}
        />

        {/* Modale per inserimento URL */}
        <URLImageModal
          isOpen={showURLModal}
          onClose={() => setShowURLModal(false)}
          onSelectImage={handleSelectImage}
          productName={item.name || 'Prodotto'}
          brandName={item.brandName}
        />

        <AlertDialog open={showUnarchiveModal} onOpenChange={setShowUnarchiveModal}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Ripristina elemento</AlertDialogTitle>
      <AlertDialogDescription>
        Vuoi rimettere "{item.name || 'questo elemento'}" nella lista shopping attiva?
        L'elemento tornerà visibile nella lista principale.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isUnarchiving}>
        Annulla
      </AlertDialogCancel>
      <AlertDialogAction
        onClick={handleUnarchive}
        disabled={isUnarchiving}
        className="bg-blue-600 hover:bg-blue-700"
      >
        {isUnarchiving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Ripristinando...
          </>
        ) : (
          'Ripristina'
        )}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

        {/* ✅ NUOVO: Modale storico prezzi */}
        <PriceHistoryModal
          isOpen={showPriceHistoryModal}
          onClose={() => setShowPriceHistoryModal(false)}
          item={item}
        />
      </Card>
    </TooltipProvider>
  );
}
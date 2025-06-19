// ShoppingImageCard.tsx - AGGIORNATO con Rigenerazione Immagini
import React, { useState } from 'react';
import { 
  Edit, 
  Trash2, 
  ExternalLink, 
  User, 
  Clock, 
  Check, 
  Euro,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Globe,
  Lock,
  Award,
  Zap,
  Sparkles,
  Heart,
  Eye,
  RefreshCw,
  Loader2
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
import { formatDistanceToNow, isValid } from 'date-fns';
import { it } from 'date-fns/locale';
import { ShoppingItem, Category, ProcessedImageResult } from '@/lib/models/types';
import { googleSearchService } from '@/services/googleSearchService';
import { ImageSelectorModal } from './ImageSelectorModal';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ShoppingImageCardProps {
  item: ShoppingItem;
  categories: Category[];
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onUpdate?: (updatedItem: ShoppingItem) => void; // ✅ NUOVO: Callback per aggiornamenti
}

export function ShoppingImageCard({ 
  item, 
  categories, 
  onEdit, 
  onDelete, 
  onComplete,
  onUpdate 
}: ShoppingImageCardProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // ✅ NUOVO: Stati per rigenerazione immagine
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [searchedImages, setSearchedImages] = useState<ProcessedImageResult[]>([]);
  const [searchError, setSearchError] = useState<string>('');

  const canEdit = user?.username === item.createdBy || user?.role === 'admin';

  // ✅ NUOVO: Verifica se l'immagine può essere modificata
  const canRegenerateImage = canEdit && item.canUpdateImage();

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
        title: 'Elemento completato',
        description: 'Elemento della lista della spesa segnato come completato!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: "Impossibile segnare l'elemento come completato",
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
        description: 'Elemento della lista della spesa eliminato con successo!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: "Impossibile eliminare l'elemento",
        variant: 'destructive',
      });
    }
  };

  // ✅ NUOVO: Handler per rigenerare immagine
  const handleRegenerateImage = async () => {
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
      console.log('🔍 Avvio ricerca immagini per:', item.name, 'Brand:', item.brandName);
      
      const images = await googleSearchService.searchProductImages(
        item.link,
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

      // ✅ Filtra le immagini valide
      
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

  // ✅ NUOVO: Handler per selezionare l'immagine
  const handleSelectImage = async (imageUrl: string) => {
    try {
      console.log('💾 Aggiornamento immagine per item:', item.id, 'URL:', imageUrl);

      // ✅ Aggiorna Firestore
      const itemRef = doc(db, 'shopping_items', item.id);
      await updateDoc(itemRef, {
        imageUrl: imageUrl,
        imageUpdated: true, // ✅ Blocca future modifiche
        updatedAt: new Date()
      });

      // ✅ Aggiorna l'oggetto locale se il callback è disponibile
      if (onUpdate) {
        const updatedItem = Object.assign(Object.create(Object.getPrototypeOf(item)), item, {
        imageUrl,
        imageUpdated: true,
        updatedAt: new Date()
      });
        onUpdate(updatedItem);
      }

      // ✅ Reset stati
      setShowImageSelector(false);
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
  
  // Configurazione priorità
  const priorityConfig = {
    high: { 
      icon: ArrowUp, 
      label: 'Alta', 
      color: 'text-red-600',
      className: 'border-red-200 bg-red-50'
    },
    medium: { 
      icon: ArrowRight, 
      label: 'Media', 
      color: 'text-yellow-600',
      className: 'border-yellow-200 bg-yellow-50'
    },
    low: { 
      icon: ArrowDown, 
      label: 'Bassa', 
      color: 'text-green-600',
      className: 'border-green-200 bg-green-50'
    }
  };

  const priorityDisplay = priorityConfig[item.priority];
  const PriorityIcon = priorityDisplay.icon;

  // ✅ Controlla se abbiamo un'immagine valida
  const hasValidImage = item.imageUrl && !imageError;

  return (
    <TooltipProvider>
      <Card className={`
        transition-all duration-300 hover:shadow-xl border group relative overflow-hidden
        ${item.completed ? 'opacity-60' : ''} 
        ${item.priority === 'high' ? 'ring-2 ring-red-400 dark:ring-red-500' : ''}
        ${isAIProcessing ? 'ring-2 ring-blue-400' : ''}
      `}>
        
        {/* ✅ IMMAGINE PRODOTTO - Con overlay sempre presente */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
          {hasValidImage ? (
            <>
              {/* Immagine esistente */}
              <img
                src={item.imageUrl}
                alt={item.name || 'Prodotto'}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => setImageError(true)}
                loading="lazy"
              />
              
              {/* Prezzo sovrapposto */}
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
              {/* Placeholder quando non c'è immagine */}
              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">
                <div className="text-center">
                  <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nessuna immagine</p>
                </div>
              </div>
              
              {/* Prezzo anche nel placeholder */}
              {item.estimatedPrice && (
                <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm rounded-md px-2 py-1 shadow-md">
                  <span className="font-bold text-green-600 text-sm">
                    {formatPrice(item.estimatedPrice)}
                  </span>
                </div>
              )}
            </>
          )}

          {/* ✅ OVERLAY CON AZIONI - Sempre presente su hover */}
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
                      asChild
                    >
                      <a href={item.link} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
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
                        onClick={() => onEdit(item)}
                        className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-md"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Modifica</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 w-8 p-0 bg-white/90 hover:bg-red-100 shadow-md text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
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

            {/* ✅ NUOVO: Bottone Rigenera Immagine con stati */}
            {canEdit && (
              <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
              </div>
            )}
          </div>
          
          {/* Badge priorità e status nell'immagine */}
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

            {/* ✅ NUOVO: Badge per immagine bloccata */}
            {item.imageUpdated && (
              <Badge variant="outline" className="bg-orange-500 text-white border-orange-500 text-xs">
                <Lock className="h-2 w-2 mr-1" />
                IMG
              </Badge>
            )}
          </div>

          {/* ✅ NUOVO: Overlay di caricamento durante la ricerca */}
          {isSearchingImages && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-4 flex items-center gap-3 shadow-lg">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium">Ricerca immagini...</span>
              </div>
            </div>
          )}
        </div>

        {/* ✅ CONTENUTO CARD */}
        <CardContent className="p-4">
          {/* Header con titolo e brand */}
          <div className="mb-2">
            {/* Brand */}
            {item.brandName && (
              <p className="text-xs text-gray-500 mb-1 truncate">{item.brandName}</p>
            )}
            
            {/* Nome prodotto con tooltip se troncato */}
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

          {/* Footer con autore e bottone completamento */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center min-w-0 flex-1">
                <User className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
                <span className="truncate">{item.createdBy}</span>
              </div>
              <div className="flex items-center ml-2 flex-shrink-0">
                <Clock className="h-2.5 w-2.5 mr-1" />
                <span className="truncate">{formatSafeDate(item.createdAt)}</span>
              </div>
            </div>

            {!item.completed && (
              <Button
                onClick={handleComplete}
                disabled={isCompleting}
                variant="outline"
                size="sm"
                className="w-full h-8 bg-green-50 hover:bg-green-100 text-green-700 border-green-300 text-xs"
              >
                {isCompleting ? (
                  'Segnando...'
                ) : (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Completato
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>

        {/* ✅ NUOVO: Modale per selezione immagini */}
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
      </Card>
    </TooltipProvider>
  )};
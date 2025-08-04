// src/components/shopping/ShoppingItemCard.tsx - AGGIORNATO con tutte le funzionalità
import { useState } from 'react';
import { 
  Edit, 
  Trash2, 
  ExternalLink, 
  User, 
  Clock, 
  Check, 
  ArrowUp,
  ArrowRight,
  ArrowDown,
  StickyNote,
  Globe,
  Lock,
  Award,
  Zap,
  Sparkles,
  Activity, // ✅ NUOVO: Icona per storico prezzi
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { it } from 'date-fns/locale';
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
import { Category } from '@/lib/models/types';
import { ShoppingItem } from '@/lib/models/shopping-item';
import { PriceHistoryModal } from './PriceHistoryModal'; // ✅ NUOVO: Import modale storico prezzi

interface ShoppingItemCardProps {
  item: ShoppingItem;
  categories: Category[];
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onUpdate?: (updatedItem: ShoppingItem) => void;
  onClick?: (item: ShoppingItem) => void;
}

export function ShoppingItemCard({ 
  item, 
  categories, 
  onEdit, 
  onDelete, 
  onComplete,
  _onUpdate, // ✅ NUOVO: Supporto per aggiornamenti
  onClick
}: ShoppingItemCardProps) {
  
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);

  // ✅ NUOVO: Stato per modale storico prezzi
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);

  const canEdit = user?.username === item.createdBy || user?.role === 'admin' || item.isPublic;

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
  const truncateTitle = (title: string, maxLength: number = 32): { display: string; isTruncated: boolean } => {
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

  // Funzione sicura per formattare le date
  const formatSafeDate = (date: Date | undefined): string => {
    if (!date || !isValid(date)) {
      return 'Data non disponibile';
    }
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: it });
    } catch (error) {
      console.warn('Error formatting date:', error);
      return 'Data non valida';
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete(item.id);
      toast({
        title: 'Elemento archiviato',
        description: 'Elemento Shopping segnato come archiviato!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile archiviare l\'elemento',
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
        description: 'L\'elemento è stato rimosso da Shopping',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare l\'elemento',
        variant: 'destructive',
      });
    }
  };

  // Handler per il click sulla card
  const handleCardClick = (e: React.MouseEvent) => {
    // Evita il click se si sta cliccando sui pulsanti di azione
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('a') ||
      (e.target as HTMLElement).closest('[role="button"]')
    ) {
      return;
    }
    
    if (onClick) {
      onClick(item);
    }
  };

  // ✅ NUOVO: Handler per aprire modale storico prezzi
  const handleOpenPriceHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPriceHistoryModal(true);
  };

  // Trova i dati della categoria
  const categoryData = categories?.find(cat => cat.name === item.category);

  // Configurazione priorità
  const priorityConfig = {
    high: { 
      label: 'Alta', 
      icon: ArrowUp, 
      color: 'text-red-600', 
      className: 'border-red-200 bg-red-50' 
    },
    medium: { 
      label: 'Media', 
      icon: ArrowRight, 
      color: 'text-yellow-600', 
      className: 'border-yellow-200 bg-yellow-50' 
    },
    low: { 
      label: 'Bassa', 
      icon: ArrowDown, 
      color: 'text-green-600', 
      className: 'border-green-200 bg-green-50' 
    }
  };

  const priorityDisplay = priorityConfig[item.priority] || priorityConfig.medium;
  const PriorityIcon = priorityDisplay.icon;

  // Formato prezzo con gestione valute dinamiche
  const formatPrice = (price: number | string): string => {
    if (typeof price === 'string') {
      // Se è già una stringa, la restituisco così com'è (può contenere $ o € già formattati)
      return price;
    }
    
    // Controllo per NaN e valori non validi
    if (isNaN(price) || price === null || price === undefined) {
      return 'N/A';
    }
    
    // Per numeri, aggiungo sempre € dopo la cifra
    return price.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  };

  return (
    <TooltipProvider>
      <Card 
        className={`
          hover:shadow-md transition-all duration-200 
          ${item.completed ? 'opacity-60 bg-gray-50' : 'bg-white hover:bg-gray-50'} 
          border-l-4 border-l-cambridge-blue
          cursor-pointer
        `}
        onClick={handleCardClick}
      >
        <CardContent className="p-4 h-full flex flex-col">
          {/* HEADER COMPATTO con AI indicators + Azioni inline */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1 min-w-0">
              {/* Prima riga: Titolo + indicatori AI e cambiamento prezzo */}
              <div className="flex items-center gap-2 mb-1">
                {/* Titolo con tooltip se troncato */}
                {titleData.isTruncated ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h3 className={`font-semibold text-card-foreground text-sm leading-tight ${
                        item.completed ? 'line-through' : ''
                      }`}>
                        {titleData.display}
                      </h3>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{item.name}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <h3 className={`font-semibold text-card-foreground text-sm leading-tight ${
                    item.completed ? 'line-through' : ''
                  }`}>
                    {titleData.display}
                  </h3>
                )}

                {/* ✅ AGGIORNATO: Indicatori AI compatti */}
                {isAIProcessing && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Zap className="h-3 w-3 text-blue-500 animate-pulse" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Analisi AI in corso...</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {hasAIData && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Sparkles className="h-3 w-3 text-purple-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Dati elaborati da AI</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* ✅ NUOVO: Tag cambiamento prezzo */}
                {priceChangeInfo && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge 
                        variant="outline" 
                        className={`text-white text-xs px-1 py-0 h-4 ${
                          priceChangeInfo.isIncrease 
                            ? 'bg-red-500 border-red-500' 
                            : 'bg-green-500 border-green-500'
                        }`}
                      >
                        {priceChangeInfo.isIncrease ? (
                          <TrendingUp className="h-2 w-2 mr-0.5" />
                        ) : (
                          <TrendingDown className="h-2 w-2 mr-0.5" />
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

              {/* Brand se presente */}
              {item.brandName && (
                <div className="flex items-center text-xs text-gray-600 mb-1">
                  <Award className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
                  <span className="font-medium truncate">{item.brandName}</span>
                </div>
              )}
            </div>
            
            {/* AZIONI INLINE + PREZZO */}
            <div className="flex items-start space-x-1 ml-2 flex-shrink-0">
              {/* Prezzo compatto */}
              {item.estimatedPrice && (
                <div className="flex items-center text-green-600 dark:text-green-400 font-semibold text-sm">
                  {formatPrice(item.estimatedPrice)}
                </div>
              )}
              
              {/* ✅ NUOVO: Bottone storico prezzi se disponibile */}
              {hasPriceHistory && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenPriceHistory}
                      className="text-gray-400 hover:text-green-600 h-6 w-6 p-0"
                    >
                      <Activity className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Storico prezzi</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Bottoni azione compatti inline */}
              {canEdit && (
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(item);
                    }}
                    className="text-gray-400 hover:text-cambridge-newStyle h-6 w-6 p-0"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 hover:text-red-500 h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare "{item.name || 'questo elemento'}"? 
                          Questa azione non può essere annullata.
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
                </div>
              )}
            </div>
          </div>

          {/* ✅ AGGIORNATO: BADGES COMPATTI in linea con tooltip categoria corretto */}
          <div className="flex flex-wrap gap-1 mb-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={categoryData?.color ? undefined : 'outline'}
                  className="text-xs px-2 py-0 h-5 cursor-help"
                  style={categoryData?.color ? { 
                    backgroundColor: `${categoryData.color}20`, 
                    color: categoryData.color, 
                    borderColor: categoryData.color 
                  } : undefined}
                >
                  {categoryData?.icon && <span className="mr-1 text-xs">{categoryData.icon}</span>}
                  {item.category}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Categoria: {item.category}</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline"
                  className={`${priorityDisplay.color} border-current ${priorityDisplay.className} text-xs px-2 py-0 h-5 cursor-help`}
                >
                  <PriorityIcon className="h-2.5 w-2.5 mr-1" />
                  {priorityDisplay.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Priorità: {priorityDisplay.label}</p>
              </TooltipContent>
            </Tooltip>

            {/* ✅ NUOVO: Badge visibilità */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline"
                  className={`text-xs px-2 py-0 h-5 cursor-help ${
                    item.isPublic 
                      ? 'text-green-600 border-green-300 bg-green-50' 
                      : 'text-orange-600 border-orange-300 bg-orange-50'
                  }`}
                >
                  {item.isPublic ? (
                    <Globe className="h-2.5 w-2.5 mr-1" />
                  ) : (
                    <Lock className="h-2.5 w-2.5 mr-1" />
                  )}
                  {item.isPublic ? 'Pubblico' : 'Privato'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Visibilità: {item.isPublic ? 'Pubblico' : 'Privato'}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* NOTE COMPATTE - se disponibili */}
          {item.notes && (
            <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-md flex-grow">
              <div className="flex items-start">
                <StickyNote className="h-3 w-3 mr-1.5 text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">{item.notes}</p>
              </div>
            </div>
          )}

          {/* LINK COMPATTO - se disponibile */}
          {item.link && (
            <div className="mb-3">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center text-xs text-cambridge-newStyle hover:text-cambridge-newStyle/80 hover:underline"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Vedi prodotto
              </a>
            </div>
          )}

          {/* FOOTER COMPATTO con info - Autore + Data inline */}
          <div className="flex justify-between items-center text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
            <div className="flex items-center min-w-0 flex-1">
              <User className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
              <span className="truncate">{item.createdBy}</span>
            </div>
            <div className="flex items-center ml-2 flex-shrink-0">
              <Clock className="h-2.5 w-2.5 mr-1" />
              <span className="truncate">{formatSafeDate(item.createdAt)}</span>
            </div>
          </div>

          {/* PULSANTE COMPLETAMENTO COMPATTO - Bottom fixed */}
          {!item.completed && (
            <div className="flex justify-center mt-3">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleComplete();
                }}
                disabled={isCompleting}
                variant="outline"
                size="sm"
                className="w-full h-8 bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800 text-xs"
              >
                {isCompleting ? (
                  'Segnando...'
                ) : (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Archivia
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>

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
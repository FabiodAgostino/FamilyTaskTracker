// ===== NUOVO FILE: src/components/notifications/NotificationCenter.tsx =====

import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  BellRing,
  X,
  Euro,
  ShoppingCart,
  AlertTriangle,
  Clock,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthContext } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { ShoppingItem } from '@/lib/models/shopping-item';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
// ✅ NUOVO: Import del componente modale
import { PriceSelectionModal } from '@/components/shopping/PriceSelectorModal';

// Tipi di notifiche
interface NotificationItem {
  id: string;
  type: 'price_selection' | 'price_change' | 'expired_item' | 'system';
  title: string;
  description: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
  data?: any; // Dati specifici per il tipo di notifica
  actionLabel?: string;
  onAction?: () => void;
}

interface NotificationCenterProps {
  variant?: 'desktop' | 'mobile';
}

export function NotificationCenter({ variant = 'desktop' }: NotificationCenterProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  
  // ✅ NUOVO: Stati per la modale di selezione prezzo
  const [selectedItemForPrice, setSelectedItemForPrice] = useState<ShoppingItem | null>(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  
  // Hooks per dati
  const { data: shoppingItems, update: updateShoppingItem } = useFirestore<ShoppingItem>('shopping_items');

  // ✅ Genera tutte le notifiche
  const notifications = useMemo(() => {
    if (!shoppingItems || !user) return [];
    
    const items: NotificationItem[] = [];
    const userItems = shoppingItems.filter(item => 
      item.createdBy === user.username || user.role === 'admin'
    );

    // 🔍 DEBUG: Log tutti gli items per capire la struttura
        userItems.forEach(item => {
      if (item.needsPriceSelection || item.priceSelection) {
              }
    });

    // 1. PREZZI SALTATI - Items che necessitano selezione prezzo (LOGICA CORRETTA)
    const skippedPriceItems = userItems.filter(item => {
      // Caso 1: Items esplicitamente skippati (anche se needsPriceSelection = false)
      const isExplicitlySkipped = item.priceSelection?.status === 'skipped' && !item.completed;
      
      // Caso 2: Items che necessitano ancora selezione (needsPriceSelection = true)
      const needsSelection = item.needsPriceSelection === true && !item.completed;
      
      // Caso 3: Items con prezzi rilevati ma non processati (status !== 'selected' e senza selectedPriceIndex)
      const hasUnprocessedPrices = item.priceSelection?.detectedPrices?.length && item.priceSelection?.detectedPrices?.length > 0 && 
                                   !item.priceSelection?.selectedPriceIndex && 
                                   item.priceSelection?.status !== 'selected' &&
                                   !item.completed;
      
      // ✅ ESCLUDI items che hanno già un prezzo selezionato
      const alreadyProcessed = item.priceSelection?.status === 'selected' || 
                               (item.priceSelection?.selectedPriceIndex !== undefined && 
                                item.priceSelection?.selectedPriceIndex !== null);
      
      const shouldInclude = (isExplicitlySkipped || needsSelection || hasUnprocessedPrices) && !alreadyProcessed;
      
      return shouldInclude;
    });

        userItems.forEach(item => {
      if (item.priceSelection?.status === 'skipped' || item.needsPriceSelection || item.priceSelection?.detectedPrices?.length && item.priceSelection?.detectedPrices?.length > 0) {
        const isExplicitlySkipped = item.priceSelection?.status === 'skipped' && !item.completed;
        const needsSelection = item.needsPriceSelection === true && !item.completed;
        const hasUnprocessedPrices = item.priceSelection?.detectedPrices?.length && item.priceSelection?.detectedPrices?.length > 0 && 
                                     !item.priceSelection?.selectedPriceIndex && 
                                     item.priceSelection?.status !== 'selected' &&
                                     !item.completed;
        const alreadyProcessed = item.priceSelection?.status === 'selected' || 
                                 (item.priceSelection?.selectedPriceIndex !== undefined && 
                                  item.priceSelection?.selectedPriceIndex !== null);
        const shouldInclude = (isExplicitlySkipped || needsSelection || hasUnprocessedPrices) && !alreadyProcessed;
        
              }
    });

    
    skippedPriceItems.forEach(item => {
      const detectedPricesCount = item.priceSelection?.detectedPrices?.length || 0;
      const isSkipped = item.priceSelection?.status === 'skipped';
      
      items.push({
        id: `price_skipped_${item.id}`,
        type: 'price_selection',
        title: isSkipped ? 'Prezzo saltato - richiede attenzione' : 'Selezione prezzo richiesta',
        description: `"${item.name || 'Prodotto'}" ${detectedPricesCount > 0 ? `ha ${detectedPricesCount} prezzi rilevati` : 'necessita analisi prezzi'}`,
        timestamp: item.updatedAt || item.createdAt,
        priority: isSkipped ? 'medium' : 'high',
        data: { item },
        actionLabel: isSkipped ? 'Rivaluta prezzo' : 'Seleziona prezzo',
        onAction: () => handlePriceSelection(item)
      });
    });

    // 2. ITEMS CON ERRORI DI SCRAPING
    const scrapingErrorItems = userItems.filter(item => 
      item.scrapingData?.scrapingSuccess === false &&
      item.scrapingData?.errors &&
      !item.completed
    );

    
    scrapingErrorItems.forEach(item => {
      items.push({
        id: `scraping_error_${item.id}`,
        type: 'system',
        title: 'Errore estrazione dati',
        description: `"${item.name || 'Prodotto'}" - ${item.scrapingData?.errors || 'Errore sconosciuto'}`,
        timestamp: item.scrapingData?.lastScraped || item.updatedAt || item.createdAt,
        priority: 'medium',
        data: { item },
        actionLabel: 'Riprova',
        onAction: () => handleRetryScrapingItem(item)
      });
    });

    // 3. CAMBIAMENTI DI PREZZO RECENTI
    const recentPriceChanges = userItems.filter(item => {
      const history = item.historicalPriceWithDates || [];
      if (history.length === 0) return false;
      
      const lastChange = history[history.length - 1];
      const isRecent = lastChange.date && 
        new Date().getTime() - new Date(lastChange.date).getTime() < 24 * 60 * 60 * 1000; // 24 ore
      
      return isRecent && lastChange.changeType !== 'initial';
    });

    recentPriceChanges.forEach(item => {
      const lastChange = item.historicalPriceWithDates![item.historicalPriceWithDates!.length - 1];
      const isIncrease = lastChange.changeType === 'increase';
      
      items.push({
        id: `price_change_${item.id}`,
        type: 'price_change',
        title: `Prezzo ${isIncrease ? 'aumentato' : 'diminuito'}`,
        description: `"${item.name || 'Prodotto'}" - ${lastChange.price.toFixed(2)}€`,
        timestamp: new Date(lastChange.date),
        priority: isIncrease ? 'high' : 'medium',
        data: { item, change: lastChange },
        actionLabel: 'Visualizza',
        onAction: () => handleViewItem(item)
      });
    });

    // 5. ITEMS VECCHI NON COMPLETATI (più di 30 giorni)
    const oldItems = userItems.filter(item => {
      if (item.completed) return false;
      const daysDiff = (new Date().getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 30;
    });

    oldItems.forEach(item => {
      const daysDiff = Math.floor((new Date().getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      
      items.push({
        id: `old_item_${item.id}`,
        type: 'expired_item',
        title: 'Articolo non completato',
        description: `"${item.name || 'Prodotto'}" aggiunto ${daysDiff} giorni fa`,
        timestamp: item.createdAt,
        priority: 'low',
        data: { item },
        actionLabel: 'Completa',
        onAction: () => handleCompleteItem(item)
      });
    });

    // Ordina per priorità e timestamp
    const sortedItems = items.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

        sortedItems.forEach(item => {
          });

    return sortedItems;
  }, [shoppingItems, user]);

  // Handlers
  const handlePriceSelection = (item: ShoppingItem) => {
        setSelectedItemForPrice(item);
    setIsPriceModalOpen(true);
    setIsOpen(false); // Chiudi il notification center
  };

  // ✅ NUOVO: Handler per la selezione del prezzo dalla modale
  const handlePriceSelected = async (itemId: string, priceIndex: number): Promise<boolean> => {
    try {
            
      const item = shoppingItems?.find(i => i.id === itemId);
      if (!item?.priceSelection?.detectedPrices) {
        throw new Error('Item o prezzi non trovati');
      }

      const detectedPrices = item.priceSelection.detectedPrices as any[];
      if (priceIndex < 0 || priceIndex >= detectedPrices.length) {
        throw new Error('Indice prezzo non valido');
      }

      const selectedPrice = detectedPrices[priceIndex];
      const now = new Date();

      // Aggiornamento Firestore
      const updateData = {
        estimatedPrice: selectedPrice.numericValue || 0,
        priceSelection: {
          status: 'selected',
          detectedPrices: detectedPrices,
          selectedPriceIndex: priceIndex,
          selectedCssSelector: selectedPrice.cssSelector || '',
          selectionTimestamp: now,
          lastDetectionAttempt: item.priceSelection.lastDetectionAttempt || now
        },
        needsPriceSelection: false,
        historicalPrice: [...(item.historicalPrice || []), selectedPrice.numericValue || 0],
        historicalPriceWithDates: [
          ...(item.historicalPriceWithDates || []),
          {
            price: selectedPrice.numericValue || 0,
            date: now,
            changeType: 'initial' as const
          }
        ],
        updatedAt: now
      };

      await updateShoppingItem(itemId, updateData as ShoppingItem);
      
      toast({
        title: "Prezzo selezionato",
        description: `Il prezzo ${selectedPrice.value || selectedPrice.numericValue} è stato salvato.`,
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Errore selezione prezzo:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio.",
        variant: "destructive"
      });
      return false;
    }
  };

  // ✅ NUOVO: Handler per saltare un item
  const handleSkipItem = async (itemId: string) => {
    try {
      await updateShoppingItem(itemId, {
        needsPriceSelection: false,
        priceSelection: {
          status: 'skipped',
          detectedPrices: []
        }
      });
      
      toast({
        title: "Item saltato",
        description: "L'item è stato saltato.",
      });
    } catch (error) {
      console.error('❌ Errore skip item:', error);
      toast({
        title: "Errore",
        description: "Impossibile saltare l'item.",
        variant: "destructive"
      });
    }
  };

  const handleViewItem = (item: ShoppingItem) => {
    // Naviga ai dettagli dell'item o apri una modale
    window.open(item.link, '_blank');
    setIsOpen(false);
  };

  const handleRetryScrapingItem = async (item: ShoppingItem) => {
    // Handler per riprovare lo scraping
    toast({
      title: 'Riprova scraping',
      description: `Riprovando estrazione dati per "${item.name || 'Prodotto'}"`,
    });
    setIsOpen(false);
    // TODO: Implementa retry scraping
  };

  const handleCompleteItem = async (item: ShoppingItem) => {
    try {
      await updateShoppingItem(item.id, { 
        completed: true, 
        updatedAt: new Date() 
      } as ShoppingItem);
      toast({
        title: 'Articolo completato',
        description: `"${item.name || 'Prodotto'}" è stato segnato come completato`,
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile completare l\'articolo',
        variant: 'destructive',
      });
    }
  };

  const handleDismissNotification = (notificationId: string) => {
    // Per ora non implementato - potresti salvare dismissals in localStorage
    toast({
      title: 'Notifica ignorata',
      description: 'La notifica è stata rimossa temporaneamente',
    });
  };

  // Conta per priorità
  const counts = useMemo(() => {
    const high = notifications.filter(n => n.priority === 'high').length;
    const medium = notifications.filter(n => n.priority === 'medium').length;
    const low = notifications.filter(n => n.priority === 'low').length;
    return { high, medium, low, total: notifications.length };
  }, [notifications]);

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'price_selection':
      case 'price_change':
        return <Euro className="h-4 w-4 text-cambridge-newStyle" />;
      case 'expired_item':
        return <Clock className="h-4 w-4 bg-icons-newStyle" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-cambridge-newStyle" />;
    }
  };

  const getPriorityColor = (priority: NotificationItem['priority']) => {
    switch (priority) {
      case 'high': return 'bg-icons-newStyle text-white border-red-200';
      case 'medium': return 'text-burnt-newStyle bg-purple-50 border-cambridge-newStyle';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Contenuto delle notifiche
  const NotificationContent = () => (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Avvisi</h3>
          <p className="text-sm text-gray-600">
            {counts.total === 0 ? 'Nessun avviso' : `${counts.total} avvisi totali`}
          </p>
        </div>
        
        {counts.total > 0 && (
          <div className="flex items-center gap-2">
            {counts.high > 0 && (
              <Badge className="text-xs bg-icons-newStyle text-white border-none">
                {counts.high} urgenti
              </Badge>
            )}
            {counts.medium > 0 && (
              <Badge variant="secondary" className="text-xs bg-purple-100 text-burnt-newStyle border-cambridge-newStyle">
                {counts.medium} medi
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Lista notifiche */}
      <ScrollArea className="h-96">
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-cambridge-newStyle mx-auto mb-3" />
              <p className="text-gray-600">Tutto a posto!</p>
              <p className="text-sm text-gray-500">Nessun avviso al momento</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={`border-l-4 ${getPriorityColor(notification.priority)}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getNotificationIcon(notification.type)}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm text-gray-900 truncate">
                            {notification.title}
                          </h4>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getPriorityColor(notification.priority)}`}
                          >
                            {notification.priority}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          {notification.description}
                        </p>
                        
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true, locale: it })}
                        </p>
                        
                        {notification.actionLabel && notification.onAction && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs border-cambridge-newStyle text-burnt-newStyle hover:bg-purple-50"
                            onClick={notification.onAction}
                          >
                            {notification.actionLabel}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      onClick={() => handleDismissNotification(notification.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Se non ci sono notifiche, non mostrare il badge
  if (counts.total === 0) {
    return null;
  }

  // Versione mobile (Sheet)
  if (variant === 'mobile' || isMobile) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="default" className="relative p-2">
              {counts.total > 0 ? (
                <BellRing className="h-5 w-5 bg-icons-newStyle" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
              {counts.total > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center bg-icons-newStyle text-white border-none"
                >
                  {counts.total > 99 ? '99+' : counts.total}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-96">
            <SheetHeader className="sr-only">
              <SheetTitle>Avvisi</SheetTitle>
              <SheetDescription>Lista degli avvisi e notifiche</SheetDescription>
            </SheetHeader>
            <NotificationContent />
          </SheetContent>
        </Sheet>

        {/* ✅ NUOVO: Modale di selezione prezzo anche per mobile */}
        <PriceSelectionModal
          isOpen={isPriceModalOpen}
          onClose={() => {
            setIsPriceModalOpen(false);
            setSelectedItemForPrice(null);
          }}
          item={selectedItemForPrice}
          onPriceSelected={handlePriceSelected}
          onSkip={handleSkipItem}
        />
      </>
    );
  }

  // Versione desktop (Popover)
  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="relative p-2">
            {counts.total > 0 ? (
              <BellRing className="h-5 w-5 bg-icons-newStyle" />
            ) : (
              <Bell className="h-5 w-5" />
            )}
            {counts.total > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-4 w-4 text-xs p-0 flex items-center justify-center bg-icons-newStyle text-white border-none"
              >
                {counts.total > 99 ? '99+' : counts.total}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="p-4">
            <NotificationContent />
          </div>
        </PopoverContent>
      </Popover>

      {/* ✅ NUOVO: Modale di selezione prezzo */}
      <PriceSelectionModal
        isOpen={isPriceModalOpen}
        onClose={() => {
          setIsPriceModalOpen(false);
          setSelectedItemForPrice(null);
        }}
        item={selectedItemForPrice}
        onPriceSelected={handlePriceSelected}
        onSkip={handleSkipItem}
      />
    </>
  );
}

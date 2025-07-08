// src/hooks/use-price-selection.ts - VERSIONE COMPLETA E PULITA

import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/hooks/useFirestore';
import { ShoppingItem } from '@/lib/models/shopping-item';

export interface PendingPriceItem {
  id: string;
  name?: string;
  link: string;
  createdBy: string;
  priceSelection?: any;
  createdAt: any;
  category: string;
}

// 🔧 FUNZIONE HELPER per fixare i detectedPrices
function fixDetectedPrices(item: ShoppingItem): ShoppingItem {
  if (item.priceSelection?.detectedPrices) {
    const rawPrices = item.priceSelection.detectedPrices as any;
    
    // Caso 1: Array normale di prezzi
    if (Array.isArray(rawPrices) && rawPrices.length > 0 && 
        typeof rawPrices[0] === 'object' && rawPrices[0]?.value) {
      return item; // È già corretto
    }
    
    // Caso 2: Array strano ["status", "message", [actualPrices]]
    if (Array.isArray(rawPrices) && rawPrices.length === 3 && Array.isArray(rawPrices[2])) {
      (item.priceSelection as any).detectedPrices = rawPrices[2];
            return item;
    }
    
    // Caso 3: Array misto [Array, Object, String] - estrai tutti i prezzi validi
    if (Array.isArray(rawPrices) && rawPrices.length > 0) {
      const validPrices: any[] = [];
      
      rawPrices.forEach((element, index) => {
                
        // Se è un array, estrai i prezzi ricorsivamente
        if (Array.isArray(element)) {
          const arrayPrices = element.filter(p => p && typeof p === 'object' && p.value && p.numericValue);
          validPrices.push(...arrayPrices);
                  }
        // Se è un oggetto con prezzo valido
        else if (typeof element === 'object' && element !== null && element.value && element.numericValue) {
          validPrices.push(element);
                  }
        // Ignora stringhe, null, undefined
        else {
                  }
      });
      
      if (validPrices.length > 0) {
        // 🔧 BONUS: Rimuovi prezzi duplicati basandoti su numericValue e value
        const uniquePrices = validPrices.filter((price, index, arr) => 
          arr.findIndex(p => 
            p.numericValue === price.numericValue && 
            p.value === price.value
          ) === index
        );
        
        (item.priceSelection as any).detectedPrices = uniquePrices;
                return item;
      }
    }
    
    // Caso 4: Oggetto invece di array
    if (!Array.isArray(rawPrices) && typeof rawPrices === 'object') {
      const detectedPricesArray = Object.values(rawPrices);
      (item.priceSelection as any).detectedPrices = detectedPricesArray;
            return item;
    }
  }
  return item;
}

// 🔧 HELPER per contare i prezzi in modo sicuro
function getDetectedPricesCount(item: ShoppingItem): number {
  const prices = item.priceSelection?.detectedPrices;
  if (!prices) return 0;
  if (Array.isArray(prices)) return prices.length;
  if (typeof prices === 'object') return Object.keys(prices).length;
  return 0;
}

export function usePriceSelection() {
  const [currentItem, setCurrentItem] = useState<PendingPriceItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuthContext();
  const { toast } = useToast();
  
  // ✅ Hook useFirestore esistente
  const { data: allItems, update: updateItem } = useFirestore<ShoppingItem>('shopping_items');

  // 🔧 Applica il fix a tutti gli items
  const fixedItems = allItems?.map(fixDetectedPrices) || [];

  // ✅ Filtra items che necessitano selezione prezzo
  const pendingItems = (() => {
    if (!fixedItems) {
            return [];
    }

    const filtered = fixedItems.filter(item => {
      const needsSelection = item.needsPriceSelection === true;
      const notCompleted = item.completed === false;
      const userCanAccess = user?.username === item.createdBy || user?.role === 'admin';
      const pricesCount = getDetectedPricesCount(item);
      const hasDetectedPrices = pricesCount > 0;
      
      // 🔍 DEBUG per ogni item che necessita selezione
      if (needsSelection) {
                                                              }
      
      return needsSelection && notCompleted && userCanAccess && hasDetectedPrices;
    });

        return filtered;
  })();

  // 🔍 DEBUG: Log pendingItems
  useEffect(() => {
            if (pendingItems.length > 0) {
                }
  }, [pendingItems]);

  /**
   * ✅ Auto-apri modale se ci sono item pending
   */
  useEffect(() => {
    console.group('🎯 Auto-open logic');
                
    const shouldOpen = pendingItems.length > 0 && !isModalOpen && !currentItem;
        
    if (shouldOpen) {
            setCurrentItem(pendingItems[0]);
      setIsModalOpen(true);
      
    }
    console.groupEnd();
  }, [pendingItems, isModalOpen, currentItem]);

  /**
   * ✅ Seleziona un prezzo per un item
   */
  const selectPrice = useCallback(async (itemId: string, priceIndex: number): Promise<boolean> => {
    try {
            
      // Trova l'item (con fix applicato)
      const item = fixedItems?.find(i => i.id === itemId);
      if (!item?.priceSelection?.detectedPrices) {
        throw new Error('Item o prezzi non trovati');
      }

      const detectedPrices = item.priceSelection.detectedPrices as any[];
      if (priceIndex < 0 || priceIndex >= detectedPrices.length) {
        throw new Error('Indice prezzo non valido');
      }

      const selectedPrice = detectedPrices[priceIndex];
      const now = new Date();

      // ✅ AGGIORNAMENTO DIRETTO FIRESTORE (oggetto completamente nuovo)
      const updateData = {
        // Imposta il prezzo principale
        estimatedPrice: selectedPrice.numericValue || 0,
        
        // 🔧 FIX: Crea un nuovo oggetto priceSelection senza spread
        priceSelection: {
          status: 'selected',
          detectedPrices: detectedPrices,
          selectedPriceIndex: priceIndex,
          selectedCssSelector: selectedPrice.cssSelector || '',
          selectionTimestamp: now,
          lastDetectionAttempt: item.priceSelection.lastDetectionAttempt || now
          // NON include detectionErrors o altri campi undefined
        },
        
        // Non necessita più selezione
        needsPriceSelection: false,
        
        // Aggiunge al historical price
        historicalPrice: [...(item.historicalPrice || []), selectedPrice.numericValue || 0],
        historicalPriceWithDates: [
          ...(item.historicalPriceWithDates || []),
          {
            price: selectedPrice.numericValue || 0,
            date: now,
            changeType: 'initial' as const
          }
        ],
        
        // Aggiorna timestamp
        updatedAt: now
      };

            await updateItem(itemId, updateData as ShoppingItem);
      
      toast({
        title: "Prezzo selezionato",
        description: `Il prezzo ${selectedPrice.value || selectedPrice.numericValue} è stato salvato e il monitoraggio è attivo.`,
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
  }, [fixedItems, updateItem, toast]);

  /**
   * ✅ Chiudi modale e passa al prossimo item se disponibile
   */
  const closeModalAndNext = useCallback(() => {
        setIsModalOpen(false);
    setCurrentItem(null);
    
    // Se ci sono altri item, mostra il prossimo dopo un delay
    const remainingItems = pendingItems.filter(item => item.id !== currentItem?.id);
        
    if (remainingItems.length > 0) {
      setTimeout(() => {
                setCurrentItem(remainingItems[0]);
        setIsModalOpen(true);
      }, 1000);
    }
  }, [pendingItems, currentItem]);

  /**
   * ✅ Salta un item (nascondilo temporaneamente)
   */
  const skipItem = useCallback(async (itemId: string) => {
    try {
            
      // Aggiorna l'item per nasconderlo temporaneamente
      await updateItem(itemId, {
        needsPriceSelection: false,
        priceSelection: {
          status: 'skipped',
          detectedPrices: []
        }
      });
      
      closeModalAndNext();
      
      toast({
        title: "Item saltato",
        description: "L'item è stato temporaneamente nascosto dalla lista.",
      });
    } catch (error) {
      console.error('❌ Errore skip item:', error);
      toast({
        title: "Errore",
        description: "Impossibile saltare l'item.",
        variant: "destructive"
      });
    }
  }, [updateItem, closeModalAndNext, toast]);

  const returnValue = {
    pendingItems,
    currentItem,
    isModalOpen,
    loading: false,
    selectPrice,
    closeModalAndNext,
    skipItem,
    hasPendingItems: pendingItems.length > 0
  };

  // 🔍 DEBUG: Log return value
  
  return returnValue;
}
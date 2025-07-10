// ===== HOOK SEMPLIFICATO - SENZA AUTO-OPENING =====

import { useState, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/hooks/useFirestore';
import { ShoppingItem, DetectedPrice, PriceSelectionData } from '@/lib/models/shopping-item';

export interface PendingPriceItem {
  id: string;
  name?: string;
  link: string;
  createdBy: string;
  priceSelection?: PriceSelectionData;
  createdAt: any;
  category: string;
}

export function usePriceSelection() {
  const [currentItem, setCurrentItem] = useState<PendingPriceItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuthContext();
  const { toast } = useToast();
  
  // Hook useFirestore per i dati
  const { data: allItems, update: updateItem } = useFirestore<ShoppingItem>('shopping_items');

  // ✅ SEMPLIFICATO: Filtra items che necessitano selezione prezzo
  const pendingItems = (() => {
    if (!allItems) {
      return [];
    }

    return allItems.filter(item => {
      const needsSelection = item.needsPriceSelection === true;
      const notSkipped = item.priceSelection?.status !== "skipped";
      const notCompleted = item.completed === false;
      const userCanAccess = user?.username === item.createdBy || user?.role === 'admin';
      
      const priceSelection = item.priceSelection;
      const hasDetectedPrices = priceSelection?.detectedPrices && 
                               Array.isArray(priceSelection.detectedPrices) && 
                               priceSelection.detectedPrices.length > 0;
      
      const hasValidPrices = hasDetectedPrices && 
                             priceSelection!.detectedPrices!.some((price: DetectedPrice) => 
                               price && 
                               typeof price.value === 'string' && 
                               typeof price.numericValue === 'number' && 
                               price.numericValue > 0
                             );

      return needsSelection && notSkipped && notCompleted && userCanAccess && hasValidPrices;
    });
  })();

  /**
   * ✅ NUOVO: Apri modale per un item specifico (SOLO MODALITÀ MANUALE)
   */
  const openPriceSelection = useCallback((itemId: string) => {
    console.log(`🎯 Opening price selection for item: ${itemId}`);
    
    // Trova l'item
    const item = allItems?.find(i => i.id === itemId);
    if (!item) {
      console.error(`❌ Item ${itemId} not found`);
      return;
    }
    
    // Controlla se ha prezzi validi
    if (!item.priceSelection?.detectedPrices?.length) {
      toast({
        title: "Errore",
        description: "Nessun prezzo rilevato per questo item.",
        variant: "destructive"
      });
      return;
    }
    
    setCurrentItem(item);
    setIsModalOpen(true);
  }, [allItems, toast]);

  /**
   * ✅ CHIUDI MODALE (SEMPLIFICATO)
   */
  const closeModal = useCallback(() => {
    console.log(`🚪 Closing price selection modal`);
    setIsModalOpen(false);
    setCurrentItem(null);
  }, []);

  /**
   * ✅ SELEZIONA PREZZO
   */
  const selectPrice = useCallback(async (itemId: string, priceIndex: number): Promise<boolean> => {
    try {
      console.log(`💰 Selecting price ${priceIndex} for item ${itemId}`);
      
      const item = allItems?.find(i => i.id === itemId);
      if (!item?.priceSelection?.detectedPrices) {
        throw new Error('Item o prezzi non trovati');
      }

      const detectedPrices = item.priceSelection.detectedPrices as DetectedPrice[];
      if (priceIndex < 0 || priceIndex >= detectedPrices.length) {
        throw new Error('Indice prezzo non valido');
      }

      const selectedPrice = detectedPrices[priceIndex];
      
      if (!selectedPrice || typeof selectedPrice.numericValue !== 'number' || selectedPrice.numericValue <= 0) {
        throw new Error('Prezzo selezionato non valido');
      }

      // Crea istanza ShoppingItem e usa i suoi metodi
      const shoppingItemInstance = ShoppingItem.fromFirestore({
        ...item,
        id: item.id
      });
      
      shoppingItemInstance.selectPrice(priceIndex);
      const firestoreData = shoppingItemInstance.toFirestore();

      await updateItem(itemId, firestoreData);
      
      toast({
        title: "Prezzo selezionato",
        description: `Il prezzo ${selectedPrice.value} è stato salvato.`,
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Errore selezione prezzo:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      
      toast({
        title: "Errore",
        description: `Errore durante il salvataggio: ${errorMessage}`,
        variant: "destructive"
      });
      return false;
    }
  }, [allItems, updateItem, toast]);

  /**
   * ✅ SALTA ITEM
   */
  const skipItem = useCallback(async (itemId: string) => {
    try {
      console.log(`⏭️ Skipping item ${itemId}`);
      
      const item = allItems?.find(i => i.id === itemId);
      if (!item) {
        throw new Error('Item non trovato');
      }
      
      const shoppingItemInstance = ShoppingItem.fromFirestore({
        ...item,
        id: item.id
      });
      
      if (shoppingItemInstance.priceSelection) {
        shoppingItemInstance.priceSelection.status = 'skipped';
      }
      shoppingItemInstance.needsPriceSelection = true;
      shoppingItemInstance.updatedAt = new Date();
      
      const firestoreData = shoppingItemInstance.toFirestore();
      await updateItem(itemId, firestoreData);
      
      toast({
        title: "Item saltato",
        description: "L'item è stato saltato temporaneamente.",
      });
      
    } catch (error) {
      console.error('❌ Errore skip item:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      
      toast({
        title: "Errore",
        description: `Impossibile saltare l'item: ${errorMessage}`,
        variant: "destructive"
      });
    }
  }, [allItems, updateItem, toast]);

  /**
   * ✅ RIAPRI ITEM SALTATO
   */
  const reopenSkippedItem = useCallback(async (itemId: string) => {
    try {
      console.log(`🔄 Reopening skipped item ${itemId}`);
      
      const item = allItems?.find(i => i.id === itemId);
      if (!item) {
        throw new Error('Item non trovato');
      }
      
      const shoppingItemInstance = ShoppingItem.fromFirestore({
        ...item,
        id: item.id
      });
      
      if (shoppingItemInstance.priceSelection) {
        shoppingItemInstance.priceSelection.status = 'needs_selection';
      }
      shoppingItemInstance.needsPriceSelection = true;
      shoppingItemInstance.updatedAt = new Date();
      
      const firestoreData = shoppingItemInstance.toFirestore();
      await updateItem(itemId, firestoreData);
      
      // Apri immediatamente la modale per questo item
      openPriceSelection(itemId);
      
      toast({
        title: "Item riaperto",
        description: "L'item è stato riaggiunto per la selezione prezzo.",
      });
      
    } catch (error) {
      console.error('❌ Errore reopening item:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      
      toast({
        title: "Errore",
        description: `Impossibile riaprire l'item: ${errorMessage}`,
        variant: "destructive"
      });
    }
  }, [allItems, updateItem, openPriceSelection, toast]);

  /**
   * ✅ HELPER: Ottieni prezzi dell'item corrente
   */
  const getCurrentItemPrices = useCallback(() => {
    if (!currentItem?.priceSelection?.detectedPrices) {
      return [];
    }
    return currentItem.priceSelection.detectedPrices as DetectedPrice[];
  }, [currentItem]);

  /**
   * ✅ HELPER: Ottieni summary selezione prezzi
   */
  const getPriceSelectionSummary = useCallback((item: ShoppingItem) => {
    if (!item.priceSelection) return 'Nessun dato prezzi';
    
    const pricesCount = item.priceSelection.detectedPrices?.length || 0;
    switch (item.priceSelection.status) {
      case 'needs_selection':
        return `${pricesCount} prezzi trovati - necessita selezione`;
      case 'selected':
        return `Prezzo selezionato`;
      case 'single_price':
        return `Prezzo unico rilevato`;
      case 'skipped':
        return `Saltato dall'utente`;
      case 'error':
        return `Errore rilevamento prezzi`;
      default:
        return 'Stato sconosciuto';
    }
  }, []);

  // ✅ RITORNA SOLO QUELLO CHE SERVE
  return {
    // Dati
    pendingItems,
    currentItem,
    isModalOpen,
    loading: false,
    
    // Azioni principali
    openPriceSelection,
    closeModal,
    selectPrice,
    skipItem,
    reopenSkippedItem,
    
    // Helper
    getCurrentItemPrices,
    getPriceSelectionSummary,
    hasPendingItems: pendingItems.length > 0,
    
    // Statistiche
    stats: {
      totalPending: pendingItems.length,
      currentIndex: currentItem ? pendingItems.findIndex(item => item.id === currentItem.id) + 1 : 0
    }
  };
}
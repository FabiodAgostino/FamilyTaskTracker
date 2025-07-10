// ===== GESTORE UNICO DELLE MODALI DI SELEZIONE PREZZI =====

import React from 'react';
import { PriceSelectionModal } from './PriceSelectorModal';
import { usePriceSelection } from '@/hooks/use-price-selection';

/**
 * ✅ COMPONENTE UNICO CHE GESTISCE TUTTE LE MODALI DI SELEZIONE PREZZI
 * - Da usare UNA SOLA VOLTA in App.tsx o layout principale
 * - Fornisce il servizio per il NotificationCenter
 */
export function PriceSelectionManager() {
  const {
    currentItem,
    isModalOpen,
    selectPrice,
    closeModal,
    skipItem,
    openPriceSelection,
    reopenSkippedItem
  } = usePriceSelection();

  // ✅ ESPONE IL SERVIZIO PER ALTRI COMPONENTI
  React.useEffect(() => {
    // Registra il servizio globalmente per il NotificationCenter
    (window as any).priceSelectionService = {
      openPriceSelection,
      reopenSkippedItem
    };
    
    return () => {
      delete (window as any).priceSelectionService;
    };
  }, [openPriceSelection, reopenSkippedItem]);

  // ✅ RENDERIZZA LA MODALE SOLO SE NECESSARIO
  if (!isModalOpen || !currentItem) {
    return null;
  }

  return (
    <PriceSelectionModal
      isOpen={isModalOpen}
      onClose={closeModal}
      item={currentItem}
      onPriceSelected={selectPrice}
      onSkip={skipItem}
    />
  );
}

/**
 * ✅ HOOK PERSONALIZZATO PER USARE IL SERVIZIO
 */
export function usePriceSelectionService() {
  const service = (window as any).priceSelectionService;
  
  if (!service) {
    console.warn('PriceSelectionService non disponibile. Assicurati di aver incluso PriceSelectionManager.');
  }
  
  return service || {
    openPriceSelection: (itemId: string) => console.warn('PriceSelectionService non disponibile:', itemId),
    reopenSkippedItem: (itemId: string) => console.warn('PriceSelectionService non disponibile:', itemId)
  };
}

/**
 * ✅ COMPONENTE BADGE PER MOSTRARE PENDING ITEMS
 */
export function PriceNotificationBadge({ 
  variant = 'default' 
}: { 
  variant?: 'default' | 'compact' 
}) {
  const { pendingItems, hasPendingItems } = usePriceSelection();

  if (!hasPendingItems) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className="relative">
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {pendingItems.length}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
      <span>
        {pendingItems.length} {pendingItems.length === 1 ? 'prodotto necessita' : 'prodotti necessitano'} selezione prezzo
      </span>
    </div>
  );
}
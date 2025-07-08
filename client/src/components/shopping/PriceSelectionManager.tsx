// ===== NUOVO FILE: src/components/shopping/PriceSelectionManager.tsx =====

import React, { useEffect } from 'react';
import { PriceSelectionModal } from './PriceSelectorModal';
import { usePriceSelection } from '@/hooks/use-price-selection';

/**
 * Componente che gestisce automaticamente la modale di selezione prezzi
 * - Monitora automaticamente gli item che necessitano selezione
 * - Mostra la modale quando necessario
 * - Gestisce il flusso di selezione automatico
 */
export function PriceSelectionManager() {
  const {
    pendingItems,
    currentItem,
    isModalOpen,
    selectPrice,
    closeModalAndNext,
    skipItem,
    hasPendingItems
  } = usePriceSelection();

  // Debug logging (rimuovi in produzione)


  // Non renderizza nulla se non ci sono item pending
  if (!hasPendingItems || !currentItem) {
    return null;
  }

  return (
    <PriceSelectionModal
      isOpen={isModalOpen}
      onClose={closeModalAndNext}
      item={currentItem}
      onPriceSelected={selectPrice}
      onSkip={skipItem}
    />
  );
}

// Componente opzionale: Badge per notificare item pending nella navbar
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
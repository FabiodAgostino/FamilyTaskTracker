// src/hooks/useShoppingPreferences.ts
import { useState, useEffect } from 'react';
import { useUserPreferences, ViewMode } from '@/contexts/UserPreferencesContext';

export interface ShoppingFilters {
  searchTerm: string;
  categoryFilter: string;
  priorityFilter: string;
  visibilityFilter: string;
  showCompleted: boolean;
}

export interface ShoppingViewSettings {
  viewMode: ViewMode;
  sortBy: 'name' | 'category' | 'priority' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  itemsPerPage: number;
}

const DEFAULT_FILTERS: ShoppingFilters = {
  searchTerm: '',
  categoryFilter: 'all',
  priorityFilter: 'all',
  visibilityFilter: 'all',
  showCompleted: false,
};

const DEFAULT_VIEW_SETTINGS: ShoppingViewSettings = {
  viewMode: 'images',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  itemsPerPage: 20,
};

export function useShoppingPreferences() {
  const { preferences, updatePreference } = useUserPreferences();
  
  // Stato locale per filtri (non persistiti)
  const [filters, setFilters] = useState<ShoppingFilters>({
    ...DEFAULT_FILTERS,
    categoryFilter: preferences.defaultCategory,
    priorityFilter: preferences.defaultPriority,
    showCompleted: preferences.showCompleted,
  });

  // Impostazioni di visualizzazione (persistite)
  const [viewSettings, setViewSettings] = useState<ShoppingViewSettings>({
    ...DEFAULT_VIEW_SETTINGS,
    viewMode: preferences.viewMode,
    itemsPerPage: preferences.itemsPerPage,
  });

  // Sincronizza filtri con preferenze default quando cambiano
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      categoryFilter: preferences.defaultCategory,
      priorityFilter: preferences.defaultPriority,
      showCompleted: preferences.showCompleted,
    }));
  }, [preferences.defaultCategory, preferences.defaultPriority, preferences.showCompleted]);

  // Sincronizza view settings con preferenze
  useEffect(() => {
    setViewSettings(prev => ({
      ...prev,
      viewMode: preferences.viewMode,
      itemsPerPage: preferences.itemsPerPage,
    }));
  }, [preferences.viewMode, preferences.itemsPerPage]);

  // Aggiorna singolo filtro
  const updateFilter = <K extends keyof ShoppingFilters>(
    key: K,
    value: ShoppingFilters[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // Se è un filtro default, salva nelle preferenze
    if (key === 'categoryFilter') {
      updatePreference('defaultCategory', value as string);
    } else if (key === 'priorityFilter') {
      updatePreference('defaultPriority', value as string);
    } else if (key === 'showCompleted') {
      updatePreference('showCompleted', value as boolean);
    }
  };

  // Aggiorna view mode (persiste automaticamente)
  const updateViewMode = (mode: ViewMode) => {
    updatePreference('viewMode', mode);
    setViewSettings(prev => ({ ...prev, viewMode: mode }));
  };

  // Aggiorna ordinamento
  const updateSort = (sortBy: ShoppingViewSettings['sortBy'], sortOrder?: 'asc' | 'desc') => {
    const newSortOrder = sortOrder || (viewSettings.sortBy === sortBy && viewSettings.sortOrder === 'asc' ? 'desc' : 'asc');
    const newViewSettings = { 
      ...viewSettings, 
      sortBy, 
      sortOrder: newSortOrder 
    };
    setViewSettings(newViewSettings);
  };

  // Reset filtri ai default
  const resetFilters = () => {
    const resetFilters = {
      ...DEFAULT_FILTERS,
      categoryFilter: preferences.defaultCategory,
      priorityFilter: preferences.defaultPriority,
      showCompleted: preferences.showCompleted,
    };
    setFilters(resetFilters);
  };

  // Reset view settings ai default
  const resetViewSettings = () => {
    const resetSettings = {
      ...DEFAULT_VIEW_SETTINGS,
      viewMode: preferences.viewMode,
      itemsPerPage: preferences.itemsPerPage,
    };
    setViewSettings(resetSettings);
  };

  // Aggiorna items per pagina
  const updateItemsPerPage = (count: number) => {
    updatePreference('itemsPerPage', count);
    setViewSettings(prev => ({ ...prev, itemsPerPage: count }));
  };

  // Funzioni di comodo per ViewMode
  const isImagesView = viewSettings.viewMode === 'images';
  const isCompactView = viewSettings.viewMode === 'compact';

  // Toggle rapido tra modalità
  const toggleViewMode = () => {
    const newMode: ViewMode = isImagesView ? 'compact' : 'images';
    updateViewMode(newMode);
  };

  return {
    // Stato attuale
    filters,
    viewSettings,
    
    // Getter di comodo
    isImagesView,
    isCompactView,
    
    // Aggiornamenti filtri
    updateFilter,
    resetFilters,
    
    // Aggiornamenti visualizzazione
    updateViewMode,
    toggleViewMode,
    updateSort,
    updateItemsPerPage,
    resetViewSettings,
    
    // Accesso diretto alle preferenze globali
    preferences,
  };
}

// Hook per gestire solo il ViewMode (versione semplificata)
export function useShoppingViewMode() {
  const { preferences, updatePreference } = useUserPreferences();
  
  const setViewMode = (mode: ViewMode) => {
    updatePreference('viewMode', mode);
      };

  const toggleViewMode = () => {
    const newMode: ViewMode = preferences.viewMode === 'images' ? 'compact' : 'images';
    setViewMode(newMode);
  };

  return {
    viewMode: preferences.viewMode,
    setViewMode,
    toggleViewMode,
    isImagesView: preferences.viewMode === 'images',
    isCompactView: preferences.viewMode === 'compact',
  };
}

// Utility per applicare filtri agli items
export function applyShoppingFilters<T extends { 
  name?: string; 
  brandName?: string; 
  notes?: string;
  category?: string;
  priority?: string;
  isPublic?: boolean;
  completed?: boolean;
  createdBy?: string;
}>(
  items: T[], 
  filters: ShoppingFilters,
  currentUser?: { username: string; role: string }
): T[] {
  return items.filter(item => {
    // Filtro visibilità
    const canView = item.isPublic || 
                   item.createdBy === currentUser?.username || 
                   currentUser?.role === 'admin';
    if (!canView) return false;

    // Filtro ricerca
    const matchesSearch = !filters.searchTerm || 
      item.name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      item.brandName?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      item.notes?.toLowerCase().includes(filters.searchTerm.toLowerCase());

    // Filtro categoria
    const matchesCategory = filters.categoryFilter === 'all' || 
                           item.category === filters.categoryFilter;

    // Filtro priorità
    const matchesPriority = filters.priorityFilter === 'all' || 
                           item.priority === filters.priorityFilter;

    // Filtro visibilità (pubblico/privato)
    const matchesVisibility = filters.visibilityFilter === 'all' || 
      (filters.visibilityFilter === 'public' && item.isPublic) ||
      (filters.visibilityFilter === 'private' && !item.isPublic);

    // Filtro completati
    const matchesCompleted = filters.showCompleted ? true : !item.completed;

    return matchesSearch && matchesCategory && matchesPriority && 
           matchesVisibility && matchesCompleted;
  });
}

// Utility per ordinare items
export function sortShoppingItems<T extends Record<string, any>>(
  items: T[],
  sortBy: ShoppingViewSettings['sortBy'],
  sortOrder: 'asc' | 'desc'
): T[] {
  return [...items].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    // Gestione date
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      aValue = aValue?.toDate ? aValue.toDate() : new Date(aValue);
      bValue = bValue?.toDate ? bValue.toDate() : new Date(bValue);
    }

    // Gestione stringhe
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    let comparison = 0;
    if (aValue < bValue) comparison = -1;
    if (aValue > bValue) comparison = 1;

    return sortOrder === 'desc' ? comparison * -1 : comparison;
  });
}
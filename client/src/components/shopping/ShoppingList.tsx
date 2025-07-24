// ==========================================
// ShoppingList.tsx - AGGIORNATO con Layout Responsive + Modali di Dettaglio
// Partendo dal codice originale dell'utente + modifiche responsive + dettaglio click
// ==========================================

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  List, 
  ShoppingCart, 
  TrendingUp, 
  Euro,
  Globe,
  Lock,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShoppingItemCard } from './ShoppingItemCard';
import { ShoppingImageCard } from './ShoppingImageCard';
import { ShoppingItemDetail } from './ShoppingItemDetail'; // ✅ NUOVO: Import del modale di dettaglio
import { AddItemForm } from './AddItemForm';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/hooks/useFirestore';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useDynamicCategories } from '@/hooks/useDynamicCategories';
import { CategorySelectWithAdd } from '../common/CategorySelectWithAdd';
import { ShoppingItem } from '@/lib/models/shopping-item';
import { FaShoppingBag } from 'react-icons/fa';
import { LoadingScreen, useLoadingTransition } from '../ui/loading-screen';
import { navigate } from 'wouter/use-browser-location';

export function ShoppingList() {

    
  const { user } = useAuthContext();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // ✅ NUOVO: Stato per filtri collassabili (chiusi di default su mobile)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(!isMobile);
  
  // ✅ NUOVO: Usa preferenze persistenti invece di useState locale
  const { 
    preferences, 
    updatePreference 
  } = useUserPreferences();
  
  // ✅ SOSTITUITO: viewMode ora viene dalle preferenze salvate
  const viewMode = preferences.viewMode;
  const setViewMode = (mode: 'compact' | 'images') => {
    updatePreference('viewMode', mode);
  };
  
  // Modal e filtri (questi rimangono locali, non persistenti)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  
  // ✅ NUOVO: Stati per il modale di dettaglio
  const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // ✅ AGGIORNATO: Filtri con valori iniziali dalle preferenze salvate
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(preferences.defaultCategory);
  const [priorityFilter, setPriorityFilter] = useState(preferences.defaultPriority);
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(preferences.showCompleted);
  const [localItems, setLocalItems] = useState<ShoppingItem[]>([]);

  // ✅ NUOVO: Aggiorna stato filtri quando cambia mobile/desktop
  React.useEffect(() => {
    setIsFiltersExpanded(!isMobile);
  }, [isMobile]);

  // ✅ Sincronizza filtri con preferenze quando cambiano
  React.useEffect(() => {
    setCategoryFilter(preferences.defaultCategory);
    setPriorityFilter(preferences.defaultPriority);
    setShowCompleted(preferences.showCompleted);
  }, [preferences.defaultCategory, preferences.defaultPriority, preferences.showCompleted]);

  // ✅ FIX 1: Hooks Firebase PRIMA di usare items
  const { 
    data: items, 
    loading: itemsLoading, 
    add: addItem, 
    update: updateItem, 
    remove: deleteItem 
  } = useFirestore<ShoppingItem>('shopping_items');

const { data: categories } = useDynamicCategories();


  // ✅ FIX 2: Callback dopo la dichiarazione di items
  const handleUpdateItem = React.useCallback((updatedItem: ShoppingItem) => {
    setLocalItems(prevItems => 
      prevItems.map(item => 
        item.id === updatedItem.id ? updatedItem : item
      )
    );
  }, []);

  // ✅ FIX 3: useEffect dopo la dichiarazione di items
  React.useEffect(() => {
  setLocalItems(items || []);
  
}, [items, itemsLoading]);

const {showLoading } = useLoadingTransition(itemsLoading, items);

  // ✅ CORRETTO: Filtri con logica di visibilità
  const { filteredItems, visibleItems } = useMemo(() => {
    if (!localItems) return { filteredItems: [], visibleItems: [] };
    
    // Prima filtra per visibilità (elementi che l'utente può vedere)
    const visible = localItems.filter(item => 
      item.isPublic || item.createdBy === user?.username || user?.role === 'admin'
    );
    
    // Poi applica i filtri di ricerca sui visibili
    const filtered = visible.filter(item => {
      const matchesSearch = !searchTerm || 
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brandName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesVisibility = visibilityFilter === 'all' || 
        (visibilityFilter === 'public' && item.isPublic) ||
        (visibilityFilter === 'private' && !item.isPublic);
      const matchesCompleted = showCompleted ? item.completed : !item.completed;
      
      return matchesSearch && matchesCategory && matchesPriority && matchesVisibility && matchesCompleted;
    });

    return { filteredItems: filtered, visibleItems: visible };
  }, [localItems, searchTerm, categoryFilter, priorityFilter, visibilityFilter, showCompleted, user]);

  // ✅ CORRETTO: Statistiche complete come nel codice originale
  const stats = useMemo(() => {
    if (!visibleItems || !filteredItems) {
      return {
        // Per badge header (tutti gli elementi visibili)
        totalPending: 0,
        totalCompleted: 0,
        totalVisible: 0,
        publicItems: 0,
        privateItems: 0,
        myItems: 0,
        highPriority: 0,
        totalCost: 0,
        
        // Per visualizzazione sezioni (elementi filtrati)
        pending: 0,
        completed: 0,
        pendingItems: [],
        completedItems: []
      };
    }
    
    // Statistiche per badge (da TUTTI gli elementi visibili)
    const allPending = visibleItems.filter(item => !item.completed);
    const allCompleted = visibleItems.filter(item => item.completed);
    
    // Statistiche per visualizzazione (da elementi FILTRATI)
    const displayedPending = filteredItems.filter(item => !item.completed);
    const displayedCompleted = filteredItems.filter(item => item.completed);
    
    return {
      // Per badge header (conta TUTTI gli elementi visibili)
      totalPending: allPending.length,
      totalCompleted: allCompleted.length,
      totalVisible: visibleItems.length,
      publicItems: visibleItems.filter(item => item.isPublic).length,
      privateItems: visibleItems.filter(item => !item.isPublic).length,
      myItems: visibleItems.filter(item => item.createdBy === user?.username).length,
      highPriority: allPending.filter(item => item.priority === 'high').length,
      totalCost: allPending.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0),
      
      // Per visualizzazione sezioni (conta solo elementi FILTRATI)
      pending: displayedPending.length,
      completed: displayedCompleted.length,
      pendingItems: displayedPending,
      completedItems: displayedCompleted
    };
  }, [visibleItems, filteredItems, user]);

  // ✅ AGGIORNATO: Reset filtri + salva preferenze
  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setVisibilityFilter('all');
    setShowCompleted(false);
    
    // ✅ NUOVO: Aggiorna anche le preferenze salvate
    updatePreference('defaultCategory', 'all');
    updatePreference('defaultPriority', 'all');
    updatePreference('showCompleted', false);
  };

  const activeFiltersCount = [
    searchTerm.length > 0,
    categoryFilter !== 'all',
    priorityFilter !== 'all',
    visibilityFilter !== 'all',
    showCompleted
  ].filter(Boolean).length;

  // ✅ NUOVO: Handlers per il modale di dettaglio
  const handleItemClick = (item: ShoppingItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedItem(null);
  };

  // Handlers
  const handleOpenModal = (item?: ShoppingItem) => {
    setEditingItem(item || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSaveItem = async (itemData: ShoppingItem) => {
    try {
      if (editingItem) {
        await updateItem(editingItem.id, itemData);
        toast({
          title: 'Elemento aggiornato',
          description: 'Elemento aggiornato con successo!',
        });
      } else {
        await addItem(itemData);
        toast({
          title: 'Elemento aggiunto',
          description: 'Nuovo elemento aggiunto alla lista!',
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      toast({
        title: 'Errore',
        description: editingItem ? 'Impossibile aggiornare l\'elemento' : 'Impossibile aggiungere l\'elemento',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteItem(id);
      toast({
        title: 'Elemento eliminato',
        description: 'Elemento eliminato con successo!',
      });
    } catch (error) {
      console.error('Errore nell\'eliminazione:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare l\'elemento',
        variant: 'destructive',
      });
    }
  };

  // ✅ FIX 4: Corretto il tipo di updatedData usando Object.assign
  const handleToggleComplete = async (id: string) => {
    const item = localItems?.find(i => i.id === id);
    if (!item) return;

    try {
      // ✅ Crea un nuovo oggetto ShoppingItem corretto
      const updatedItem = Object.assign(Object.create(Object.getPrototypeOf(item)), item, {
        completed: !item.completed,
        completedBy: !item.completed ? user?.username : undefined,
        completedAt: !item.completed ? new Date() : undefined,
        updatedAt: new Date()
      });

      await updateItem(id, updatedItem);
      
      // ✅ Aggiorna anche lo stato locale
      handleUpdateItem(updatedItem);
      
      toast({
        title: updatedItem.completed ? 'Elemento completato' : 'Elemento ripristinato',
        description: updatedItem.completed 
          ? 'Elemento segnato come completato!' 
          : 'Elemento ripristinato nella lista!',
      });
    } catch (error) {
      console.error('Errore nel toggle complete:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare l\'elemento',
        variant: 'destructive',
      });
    }
  };

  // ✅ CORRETTO: Grid class ottimizzata per entrambe le visualizzazioni
  const getGridClass = () => {
    if (viewMode === 'images') {
      // Grid per immagini stile Zalando: meno colonne, card più grandi
      return "grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5";
    }
    // Grid compatta originale
    return "grid gap-4 md:grid-cols-2 lg:grid-cols-3";
  };

  // ✅ AGGIORNATO: Funzione per renderizzare la card giusta con onClick
  const renderShoppingCard = (item: ShoppingItem) => {
    const commonProps = {
      item,
      categories: categories || [],
      onEdit: () => handleOpenModal(item),
      onDelete: handleDeleteItem,
      onComplete: handleToggleComplete,
      onUpdate: handleUpdateItem,
      onClick: handleItemClick // ✅ NUOVO: Aggiungi onClick handler
    };

    return viewMode === 'images' ? (
      <ShoppingImageCard key={item.id} {...commonProps} viewMode={viewMode}/>
    ) : (
      <ShoppingItemCard key={item.id} {...commonProps} />
    );
  };

  // ✅ NUOVO: Handler per cambio categoria con salvataggio preferenze
  const handleCategoryFilterChange = (value: string) => {
  const normalizedValue = value || 'all';
  setCategoryFilter(normalizedValue);
  updatePreference('defaultCategory', normalizedValue);
};

  // ✅ NUOVO: Handler per cambio priorità con salvataggio preferenze
  const handlePriorityFilterChange = (value: string) => {
    setPriorityFilter(value);
    updatePreference('defaultPriority', value);
  };

  // ✅ NUOVO: Handler per cambio completati con salvataggio preferenze
  const handleShowCompletedChange = (checked: boolean) => {
    setShowCompleted(checked);
    updatePreference('showCompleted', checked);
  };

  // ✅ NUOVO: Toggle filtri
  const toggleFilters = () => setIsFiltersExpanded(!isFiltersExpanded);

  // Loading state
return (
  <LoadingScreen
    isVisible={showLoading}
    title="Caricamento Shopping"
    subtitle="Preparazione della lista..."
  >
      <div className="container mx-auto p-6 max-w-7xl">
      {/* ✅ HEADER RESPONSIVE - MODIFICATO */}
      <div className={cn(
        "flex justify-between items-start gap-6 mb-8",
        isMobile ? "flex-col" : "lg:flex-row lg:items-center"
      )}>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <FaShoppingBag className="h-8 w-8 text-cambridge-newStyle" />
            <h1 className="text-3xl font-bold text-delft-blue">Shopping</h1>
            
            {/* ✅ NUOVO: Bottone piccolo a fianco del titolo su mobile */}
            {isMobile && (
              <Button
                onClick={() => handleOpenModal()}
                size="sm"
                className="ml-auto bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white p-2"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* ✅ BADGE STATISTICI con più spazio su mobile */}
          <div className={cn(
            "flex flex-wrap gap-4",
            isMobile && "mb-4"
          )}>
            <Badge variant="outline" className="text-cambridge-newStyle border-cambridge-newStyle">
              {stats.totalVisible} {stats.totalVisible === 1 ? 'articolo' : 'articoli'}
            </Badge>
            <Badge variant="outline" className="text-cambridge-newStyle border-cambridge-newStyle">
              {stats.totalPending} da comprare
            </Badge>
            <Badge variant="outline" className="text-green-600 border-green-300">
              {stats.totalCompleted} archiviati
            </Badge>
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              <Globe className="w-3 h-3 mr-1" />
              {stats.publicItems} pubblici
            </Badge>
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              <Lock className="w-3 h-3 mr-1" />
              {stats.privateItems} privati
            </Badge>
            <Badge variant="outline" className="text-purple-600 border-purple-300">
              {stats.myItems} miei
            </Badge>
            {stats.highPriority > 0 && (
              <Badge variant="destructive" className="bg-red-100 text-red-700">
                <TrendingUp className="w-3 h-3 mr-1" />
                {stats.highPriority} urgenti
              </Badge>
            )}
            {stats.totalCost > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <Euro className="w-3 h-3 mr-1" />
                €{stats.totalCost.toFixed(2)} stimati
              </Badge>
            )}
            {/* ✅ NUOVO: Badge indicatore preferenze salvate */}
            <Badge variant="outline" className="text-indigo-600 border-indigo-300 bg-indigo-50">
              💾 {viewMode === 'images' ? 'Immagini' : 'Compatta'} (salvata)
            </Badge>
          </div>
        </div>
        
        {/* ✅ CONTROLLI DESKTOP - solo su schermi grandi */}
        {!isMobile && (
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <List className={`h-4 w-4 ${viewMode === 'compact' ? 'text-cambridge-newStyle' : 'text-gray-400'}`} />
              <Switch
                id="view-mode"
                checked={viewMode === 'images'}
                onCheckedChange={(checked) => setViewMode(checked ? 'images' : 'compact')}
                className="data-[state=checked]:bg-cambridge-newStyle"
              />
              <LayoutGrid className={`h-4 w-4 ${viewMode === 'images' ? 'text-cambridge-newStyle' : 'text-gray-400'}`} />
              <Label htmlFor="view-mode" className="text-sm font-medium cursor-pointer">
                {viewMode === 'images' ? 'Vista Immagini' : 'Vista Compatta'}
              </Label>
            </div>

            <Button
              onClick={() => handleOpenModal()}
              className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi Articolo
            </Button>
          </div>
        )}
      </div>

      {/* ✅ FILTRI COLLASSABILI - MODIFICATO */}
      <Card className={cn("mb-8", isMobile && "mb-6")}>
        <CardContent className={cn("p-6", isMobile && "p-4")}>
          
          {/* ✅ NUOVO: Header dei filtri su mobile */}
          {isMobile && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-cambridge-newStyle" />
                <span className="font-medium text-sm">Filtri di ricerca</span>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="bg-cambridge-newStyle/10 text-cambridge-newStyle text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFilters}
                className="p-1"
              >
                {isFiltersExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {/* ✅ CONTENUTO FILTRI - Collassabile su mobile */}
          <div className={cn(
            isMobile && !isFiltersExpanded ? "hidden" : "block"
          )}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ricerca
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Cerca articoli, brand, note..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Categoria
                  </label>
                  <CategorySelectWithAdd
                    value={categoryFilter}
                    onValueChange={handleCategoryFilterChange}
                    categories={categories || []}
                    placeholder="Tutte le categorie"
                    className={cn("w-[140px]", isMobile && "w-full")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priorità
                  </label>
                  {/* ✅ AGGIORNATO: Select priorità con salvataggio */}
                  <Select value={priorityFilter} onValueChange={handlePriorityFilterChange}>
                    <SelectTrigger className={cn("w-[120px]", isMobile && "w-full")}>
                      <SelectValue placeholder="Tutte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="low">Bassa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Visibilità
                  </label>
                  <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                    <SelectTrigger className={cn("w-[120px]", isMobile && "w-full")}>
                      <SelectValue placeholder="Tutte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="public">Pubbliche</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Controlli aggiuntivi - con Vista inline */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-completed"
                    checked={showCompleted}
                    onCheckedChange={handleShowCompletedChange}
                    className="data-[state=checked]:bg-cambridge-newStyle"
                  />
                  <Label htmlFor="show-completed" className="text-sm font-medium cursor-pointer">
                    Mostra archiviati
                  </Label>
                </div>

                {/* ✅ NUOVO: Vista toggle inline con filtri */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                  <List className={`h-4 w-4 ${viewMode === 'compact' ? 'text-cambridge-newStyle' : 'text-gray-400'}`} />
                  <Switch
                    checked={viewMode === 'images'}
                    onCheckedChange={(checked) => setViewMode(checked ? 'images' : 'compact')}
                    className="data-[state=checked]:bg-cambridge-newStyle"
                  />
                  <LayoutGrid className={`h-4 w-4 ${viewMode === 'images' ? 'text-cambridge-newStyle' : 'text-gray-400'}`} />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {viewMode === 'images' ? 'Immagini' : 'Compatta'}
                  </span>
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleClearFilters}
                  size="sm"
                  className={cn("text-gray-500", isMobile && "w-full")}
                >
                  Pulisci ({activeFiltersCount})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ LISTA ELEMENTI con grid corretta e padding responsivo */}
      {!itemsLoading && (
  <div className={cn("space-y-8", isMobile && "px-1")}>
        {/* Elementi da comprare */}
        {stats.pendingItems.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold text-delft-blue">Da Comprare</h2>
              <Badge variant="secondary">{stats.pending}</Badge>
            </div>
            <div className={getGridClass()}>
              {stats.pendingItems
                .sort((a, b) => {
                  // Prima ordina per data (più recenti prima)
                  const dateA = new Date(a.createdAt).getTime();
                  const dateB = new Date(b.createdAt).getTime();
                  const dateDiff = dateB - dateA;
                  
                  // Se le date sono uguali, ordina per priorità
                  if (dateDiff === 0) {
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                  }
                  
                  return dateDiff;
                })
                .map(renderShoppingCard)}
            </div>
          </div>
        )}

        {/* Elementi completati */}
        {showCompleted && stats.completedItems.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-600">Completati</h2>
              <Badge variant="outline" className="text-green-600">
                {stats.completed}
              </Badge>
            </div>
            <div className={`${getGridClass()} opacity-75`}>
              {stats.completedItems
                .sort((a, b) => {
                  // Ordina per data di completamento (più recenti prima)
                  const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                  const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                  return dateB - dateA;
                })
                .map(renderShoppingCard)}
            </div>
          </div>
        )}

      {stats.pendingItems.length === 0 && stats.completedItems.length === 0 && !showLoading && (
          <Card className="text-center py-16">
            <CardContent>
              <ShoppingCart className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">
                Nessun elemento trovato
              </h3>
              <p className="text-gray-500 mb-4">
                {activeFiltersCount > 0 
                  ? "Prova a modificare i filtri di ricerca."
                  : "Inizia aggiungendo il tuo primo articolo shopping."
                }
              </p>
              {activeFiltersCount > 0 ? (
                <Button onClick={handleClearFilters} variant="outline">
                  Pulisci Filtri
                </Button>
              ) : (
                <Button onClick={() => handleOpenModal()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Aggiungi Primo Articolo
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* ✅ NUOVO: Modale di dettaglio elemento shopping */}
      <ShoppingItemDetail
        item={selectedItem}
        categories={categories || []}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        onEdit={(item) => {
          handleCloseDetail(); // Chiudi il dettaglio
          handleOpenModal(item); // Apri l'editor
        }}
        onComplete={handleToggleComplete}
      />

      {/* Modal di aggiunta/modifica */}
      <AddItemForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAdd={handleSaveItem}
        editItem={editingItem}
      />
      
    </div>
  </LoadingScreen>
);

}
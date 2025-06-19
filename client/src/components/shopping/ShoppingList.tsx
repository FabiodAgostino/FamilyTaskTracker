// ==========================================
// ShoppingList.tsx - CORRETTO con Badge Header Completi e Layout + Fix TypeScript
// ==========================================

import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  ShoppingCart, 
  TrendingUp, 
  Euro,
  Globe,
  Lock,
  Eye
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
import { AddItemForm } from './AddItemForm';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/hooks/useFirestore';
import { ShoppingItem, Category } from '@/lib/models/types';

export function ShoppingList() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  
  // ✅ State per la visualizzazione
  const [viewMode, setViewMode] = useState<'compact' | 'images'>('compact');
  
  // Modal e filtri
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [localItems, setLocalItems] = useState<ShoppingItem[]>([]);

  // ✅ FIX 1: Hooks Firebase PRIMA di usare items
  const { 
    data: items, 
    loading: itemsLoading, 
    add: addItem, 
    update: updateItem, 
    remove: deleteItem 
  } = useFirestore<ShoppingItem>('shopping_items');
  
  const { data: categories } = useFirestore<Category>('categories');

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
  }, [items]);

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

  // ✅ Reset filtri
  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setVisibilityFilter('all');
    setShowCompleted(false);
  };

  const activeFiltersCount = [
    searchTerm.length > 0,
    categoryFilter !== 'all',
    priorityFilter !== 'all',
    visibilityFilter !== 'all',
    showCompleted
  ].filter(Boolean).length;

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

  // ✅ Funzione per renderizzare la card giusta
  const renderShoppingCard = (item: ShoppingItem) => {
    const commonProps = {
      key: item.id,
      item,
      categories: categories || [],
      onEdit: () => handleOpenModal(item),
      onDelete: handleDeleteItem,
      onComplete: handleToggleComplete,
      onUpdate: handleUpdateItem // ✅ NUOVO: Aggiungi questo prop
    };

    return viewMode === 'images' ? (
      <ShoppingImageCard {...commonProps} />
    ) : (
      <ShoppingItemCard {...commonProps} />
    );
  };

  // Loading state
  if (itemsLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cambridge-blue"></div>
          <span className="ml-3 text-gray-600">Caricamento lista della spesa...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* ✅ HEADER COMPLETO con tutti i badge come nel codice originale */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <ShoppingCart className="h-8 w-8 text-cambridge-blue" />
            <h1 className="text-3xl font-bold text-delft-blue">Lista della Spesa</h1>
          </div>
          
          {/* ✅ TUTTI I BADGE STATISTICI come nel codice originale */}
          <div className="flex flex-wrap gap-4">
            <Badge variant="outline" className="text-cambridge-blue border-cambridge-blue">
              {stats.totalVisible} {stats.totalVisible === 1 ? 'articolo' : 'articoli'}
            </Badge>
            <Badge variant="outline" className="text-cambridge-blue border-cambridge-blue">
              {stats.totalPending} da comprare
            </Badge>
            <Badge variant="outline" className="text-green-600 border-green-300">
              {stats.totalCompleted} completati
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
          </div>
        </div>
        
        {/* ✅ SWITCH VISUALIZZAZIONE + BOTTONE AGGIUNGI */}
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <List className="h-4 w-4 text-gray-500" />
            <Switch
              id="view-mode"
              checked={viewMode === 'images'}
              onCheckedChange={(checked) => setViewMode(checked ? 'images' : 'compact')}
            />
            <LayoutGrid className="h-4 w-4 text-gray-500" />
            <Label htmlFor="view-mode" className="text-sm font-medium">
              {viewMode === 'images' ? 'Vista Immagini' : 'Vista Compatta'}
            </Label>
          </div>

          <Button
            onClick={() => handleOpenModal()}
            className="bg-cambridge-blue hover:bg-cambridge-blue/90 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Aggiungi Articolo
          </Button>
        </div>
      </div>

      {/* ✅ FILTRI COMPLETI come nel codice originale */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.icon} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Priorità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Bassa</SelectItem>
                </SelectContent>
              </Select>

              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Visibilità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="public">Pubbliche</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={showCompleted ? "default" : "outline"}
                onClick={() => setShowCompleted(!showCompleted)}
                size="sm"
              >
                {showCompleted ? '✅' : '⬜'} Completati
              </Button>

              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleClearFilters}
                  size="sm"
                  className="text-gray-500"
                >
                  Pulisci ({activeFiltersCount})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ LISTA ELEMENTI con grid corretta */}
      <div className="space-y-8">
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

        {/* Stato vuoto */}
        {stats.pendingItems.length === 0 && stats.completedItems.length === 0 && (
          <Card className="text-center py-16">
            <CardContent>
              <ShoppingCart className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">
                Nessun elemento trovato
              </h3>
              <p className="text-gray-500 mb-4">
                {activeFiltersCount > 0 
                  ? "Prova a modificare i filtri di ricerca."
                  : "Inizia aggiungendo il tuo primo articolo alla lista della spesa."
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

      {/* Modal */}
      <AddItemForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAdd={handleSaveItem}
        editItem={editingItem}
      />
    </div>
  );
}
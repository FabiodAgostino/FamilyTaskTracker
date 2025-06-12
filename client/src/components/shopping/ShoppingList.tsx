// src/components/shopping/ShoppingList.tsx
import { useState, useMemo } from 'react';
import { Plus, Search, Filter, ShoppingCart, TrendingUp, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShoppingItemCard } from './ShoppingItemCard';
import { AddItemForm } from './AddItemForm';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/hooks/useFirestore';
import { ShoppingItem, Category } from '@/lib/models/types';

export function ShoppingList() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  
  // ✅ SEMPLIFICATO: Un solo modal per add/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  
  // ✅ Filtri semplificati
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);

  // ✅ Hooks Firebase
  const { 
    data: items, 
    loading, 
    add: addItem, 
    update: updateItem, 
    remove: deleteItem 
  } = useFirestore<ShoppingItem>('shopping_items');
  
  const { data: categories } = useFirestore<Category>('categories');

  // ✅ MIGLIORATO: Filtri con useMemo per performance
  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    return items.filter(item => {
      // Filtro utente (solo i propri elementi + pubblici per admin)
      const canView = item.createdBy === user?.username || user?.role === 'admin';
      if (!canView) return false;

      // Filtro ricerca
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(searchLower);
        const matchesNotes = item.notes?.toLowerCase().includes(searchLower);
        const matchesCategory = item.category.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesNotes && !matchesCategory) return false;
      }

      // Filtro categoria
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Filtro priorità
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;

      // Filtro completamento
      if (!showCompleted && item.completed) return false;

      return true;
    });
  }, [items, user, searchTerm, categoryFilter, priorityFilter, showCompleted]);

  // ✅ NUOVO: Statistiche calcolate
  const stats = useMemo(() => {
    const pending = filteredItems.filter(item => !item.completed);
    const completed = filteredItems.filter(item => item.completed);
    const highPriority = pending.filter(item => item.priority === 'high').length;
    const totalCost = pending.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0);
    
    return {
      pending: pending.length,
      completed: completed.length,
      highPriority,
      totalCost,
      pendingItems: pending,
      completedItems: completed
    };
  }, [filteredItems]);

  // ✅ SEMPLIFICATO: Gestori delle azioni
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
        // ✅ MIGLIORATO: Usa updateItem con l'oggetto completo
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

  const handleToggleComplete = async (id: string) => {
    try {
      const item = items?.find(i => i.id === id);
      if (!item) return;

      // ✅ CORRETTO: Crea nuovi dati invece di modificare l'oggetto
      const updatedData = {
        ...item,
        completed: !item.completed,
        completedBy: !item.completed ? user?.username : undefined,
        completedAt: !item.completed ? new Date() : undefined,
        updatedAt: new Date()
      };

      await updateItem(id, updatedData);
      
      toast({
        title: updatedData.completed ? 'Elemento completato' : 'Elemento ripristinato',
        description: updatedData.completed 
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

  // ✅ NUOVO: Reset filtri
  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setShowCompleted(false);
  };

  const activeFiltersCount = [
    searchTerm.length > 0,
    categoryFilter !== 'all',
    priorityFilter !== 'all',
    showCompleted
  ].filter(Boolean).length;

  // ✅ LOADING STATE
  if (loading) {
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
      {/* ✅ HEADER con statistiche */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <ShoppingCart className="h-8 w-8 text-cambridge-blue" />
            <h1 className="text-3xl font-bold text-delft-blue">Lista della Spesa</h1>
          </div>
          
          {/* ✅ Statistiche visuali */}
          <div className="flex flex-wrap gap-4">
            <Badge variant="outline" className="text-cambridge-blue border-cambridge-blue">
              {stats.pending} da comprare
            </Badge>
            <Badge variant="outline" className="text-green-600 border-green-300">
              {stats.completed} completati
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
        
<Button
  onClick={() => handleOpenModal()}
  className="bg-cambridge-blue hover:bg-cambridge-blue/90 text-white dark:text-black shadow-lg"
  size="lg"
>
  <Plus className="mr-2 h-5 w-5" />
  Aggiungi elemento
</Button>
      </div>

      {/* ✅ FILTRI compatti */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Ricerca */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cerca elementi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filtri */}
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🛍️ Tutte le categorie</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.icon || '🏷️'} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priorità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="high">🔴 Alta</SelectItem>
                  <SelectItem value="medium">🟡 Media</SelectItem>
                  <SelectItem value="low">🟢 Bassa</SelectItem>
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

      {/* ✅ LISTA ELEMENTI */}
      <div className="space-y-8">
        {/* Elementi da comprare */}
        {stats.pendingItems.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold text-delft-blue">Da Comprare</h2>
              <Badge variant="secondary">{stats.pending}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stats.pendingItems
                .sort((a, b) => {
                  const priorityOrder = { high: 3, medium: 2, low: 1 };
                  return priorityOrder[b.priority] - priorityOrder[a.priority];
                })
                .map(item => (
                  <ShoppingItemCard
                    key={item.id}
                    item={item}
                    categories={categories || []}
                    onEdit={() => handleOpenModal(item)}
                    onDelete={handleDeleteItem}
                    onComplete={handleToggleComplete}
                  />
                ))}
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-75">
              {stats.completedItems.map(item => (
                <ShoppingItemCard
                  key={item.id}
                  item={item}
                  categories={categories || []} // ✅ CORRETTO: Passa le categorie
                  onEdit={() => handleOpenModal(item)}
                  onDelete={handleDeleteItem}
                  onComplete={handleToggleComplete}
                />
              ))}
            </div>
          </div>
        )}

        {/* ✅ STATO VUOTO migliorato */}
        {filteredItems.length === 0 && (
          <Card className="text-center py-16">
            <CardContent>
              <ShoppingCart className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">
                {activeFiltersCount > 0 
                  ? 'Nessun elemento trovato'
                  : 'Lista vuota'
                }
              </h3>
              <p className="text-gray-500 mb-6">
                {activeFiltersCount > 0
                  ? 'Prova a modificare i filtri di ricerca'
                  : 'Inizia aggiungendo il tuo primo elemento alla lista'
                }
              </p>
              <Button
                onClick={() => handleOpenModal()}
                className="bg-cambridge-blue hover:bg-cambridge-blue/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi elemento
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ✅ MODAL UNIFICATO */}
      <AddItemForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAdd={handleSaveItem}
        editItem={editingItem}
      />
    </div>
  );
}
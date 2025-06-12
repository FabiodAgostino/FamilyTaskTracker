// src/components/shopping/ShoppingList.tsx
import { useState, useEffect } from 'react';
import { Plus, Search, Filter, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShoppingItemCard } from './ShoppingItemCard'; // Il tuo componente esistente
import { AddItemForm } from './AddItemForm'; // Il tuo componente esistente 
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/hooks/useFirestore'; // Assumo tu abbia questo hook
import { RouteComponentProps } from 'wouter';
import { ShoppingItem as ShoppingItemType, Category } from '@/lib/models/types';

interface ShoppingListProps extends RouteComponentProps<any> {
  // Wouter passerà automaticamente i parametri, ma li rendiamo opzionali
}

const defaultCategories = [
  { value: 'all', label: 'Tutte le categorie', emoji: '🛍️' },
  { value: 'groceries', label: 'Alimentari', emoji: '🛒' },
  { value: 'electronics', label: 'Elettronica', emoji: '📱' },
  { value: 'household', label: 'Casa', emoji: '🏠' },
  { value: 'clothing', label: 'Abbigliamento', emoji: '👕' },
  { value: 'personal-care', label: 'Cura Personale', emoji: '🧴' },
  { value: 'automotive', label: 'Auto', emoji: '🚗' },
  { value: 'books', label: 'Libri', emoji: '📚' },
  { value: 'sports', label: 'Sport', emoji: '⚽' },
];

const priorityFilters = [
  { value: 'all', label: 'Tutte le priorità' },
  { value: 'high', label: 'Alta priorità' },
  { value: 'medium', label: 'Media priorità' },
  { value: 'low', label: 'Bassa priorità' },
];

export function ShoppingList(props: ShoppingListProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  
  // Usa il tuo hook Firebase esistente
  const { 
    data: items, 
    loading, 
    add: addItem, 
    update: updateItem, 
    remove: deleteItem 
  } = useFirestore<ShoppingItemType>('shopping_items');
  
  const { data: categories } = useFirestore<Category>('categories');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItemType | null>(null);

  // Filtri per gli elementi
  const filteredItems = items?.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    const matchesCompletion = showCompleted || !item.completed;
    
    return matchesSearch && matchesCategory && matchesPriority && matchesCompletion;
  }) || [];

  const pendingItems = filteredItems.filter(item => !item.completed);
  const completedItems = filteredItems.filter(item => item.completed);

  // Statistiche utili
  const highPriorityPending = pendingItems.filter(item => item.priority === 'high').length;
  const totalEstimatedCost = pendingItems.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0);

  // Gestori per le azioni sugli elementi
  const handleEdit = (item: ShoppingItemType) => {
    setEditingItem(item);
  };

  const handleCloseEdit = () => {
    setEditingItem(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem(id);
      toast({
        title: 'Elemento eliminato',
        description: 'Elemento della lista della spesa eliminato con successo!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare l\'elemento',
        variant: 'destructive',
      });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const item = items?.find(i => i.id === id);
      if (item) {
        if (item.completed) {
          item.uncomplete();
        } else {
          item.complete(user?.username || 'unknown');
        }
        await updateItem(id, item.toFirestore());
        
        toast({
          title: item.completed ? 'Elemento completato' : 'Elemento ripristinato',
          description: item.completed 
            ? 'Elemento segnato come completato!' 
            : 'Elemento ripristinato nella lista!',
        });
      }
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare l\'elemento',
        variant: 'destructive',
      });
    }
  };

  const handleAddItem = async (newItem: ShoppingItemType) => {
    try {
      await addItem(newItem);
      toast({
        title: 'Elemento aggiunto',
        description: 'Nuovo elemento aggiunto alla lista della spesa!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile aggiungere l\'elemento',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateItem = async (updatedItem: ShoppingItemType) => {
    try {
      await updateItem(updatedItem.id, updatedItem.toFirestore());
      toast({
        title: 'Elemento aggiornato',
        description: 'Elemento aggiornato con successo!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare l\'elemento',
        variant: 'destructive',
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setShowCompleted(true);
  };

  const activeFiltersCount = [
    searchTerm.length > 0,
    categoryFilter !== 'all',
    priorityFilter !== 'all',
    !showCompleted
  ].filter(Boolean).length;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header con titolo e statistiche */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="h-8 w-8 text-cambridge-blue" />
            <h1 className="text-3xl font-bold text-delft-blue">Lista della Spesa</h1>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>{pendingItems.length} elementi da comprare</span>
            <span>{completedItems.length} completati</span>
            {highPriorityPending > 0 && (
              <span className="text-red-600 font-medium">
                {highPriorityPending} alta priorità
              </span>
            )}
            {totalEstimatedCost > 0 && (
              <span className="text-green-600 font-medium">
                ~€{totalEstimatedCost.toFixed(2)} stimati
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-cambridge-blue hover:bg-cambridge-blue/90 text-white shadow-lg"
          size="lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Aggiungi elemento
        </Button>
      </div>

      {/* Filtri e ricerca */}
      <Card className="mb-6 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cerca per nome o note..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {defaultCategories.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center space-x-2">
                        <span>{category.emoji}</span>
                        <span>{category.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                  {categories?.filter(cat => 
                    !defaultCategories.some(def => def.value === cat.name)
                  ).map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      <div className="flex items-center space-x-2">
                        <span>🏷️</span>
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priorità" />
                </SelectTrigger>
                <SelectContent>
                  {priorityFilters.map(priority => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={showCompleted ? "default" : "outline"}
                onClick={() => setShowCompleted(!showCompleted)}
                className="whitespace-nowrap"
              >
                {showCompleted ? 'Nascondi' : 'Mostra'} completati
              </Button>

              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Pulisci filtri ({activeFiltersCount})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cambridge-blue"></div>
          <span className="ml-3 text-gray-600">Caricamento...</span>
        </div>
      )}

      {/* Lista degli elementi */}
      {!loading && (
        <div className="space-y-8">
          {/* Elementi da comprare */}
          {pendingItems.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-semibold text-delft-blue">Da Comprare</h2>
                <Badge variant="secondary" className="bg-cambridge-blue/20 text-cambridge-blue">
                  {pendingItems.length}
                </Badge>
                {highPriorityPending > 0 && (
                  <Badge variant="destructive" className="bg-red-100 text-red-700">
                    {highPriorityPending} urgenti
                  </Badge>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingItems.map(item => (
                  <ShoppingItemCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Elementi completati */}
          {showCompleted && completedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-semibold text-gray-600">Completati</h2>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {completedItems.length}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedItems.map(item => (
                  <ShoppingItemCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Messaggio lista vuota */}
          {filteredItems.length === 0 && !loading && (
            <Card className="text-center py-16 shadow-sm">
              <CardContent>
                <div className="text-gray-500 mb-6 text-lg">
                  {searchTerm || categoryFilter !== 'all' || priorityFilter !== 'all'
                    ? 'Nessun elemento corrisponde ai tuoi filtri'
                    : 'La tua lista della spesa è vuota'
                  }
                </div>
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  variant="outline"
                  size="lg"
                  className="text-cambridge-blue border-cambridge-blue hover:bg-cambridge-blue hover:text-white"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Aggiungi il tuo primo elemento
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modal per aggiungere nuovo elemento */}
      <AddItemForm
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddItem}
      />

      {/* Modal per modificare elemento */}
      <AddItemForm
        isOpen={!!editingItem}
        onClose={handleCloseEdit}
        onAdd={handleUpdateItem}
        editItem={editingItem}
      />
    </div>
  );
}

export default ShoppingList;
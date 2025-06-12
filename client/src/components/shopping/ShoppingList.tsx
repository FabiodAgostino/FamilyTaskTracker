// src/components/shopping/ShoppingList.tsx
import { useState, useEffect } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
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
import { ShoppingItemCard } from './ShoppingItemCard'; // ✅ Nuovo import
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { RouteComponentProps } from 'wouter';
import { ShoppingItem } from '@/lib/models/types';

// Props del componente ShoppingList (compatibile con Wouter)
interface ShoppingListProps extends RouteComponentProps<any> {
  // Wouter passerà automaticamente params, ma li rendiamo opzionali
}


const categories = ['all', 'groceries', 'electronics', 'household', 'clothing'];

export function ShoppingList(props: ShoppingListProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  
  const [items, setItems] = useState<ShoppingItem[]>([
    new ShoppingItem(
      '1',
      'Wireless Headphones',
      'electronics',
      'john_doe',
      new Date('2024-06-10T10:00:00Z'),
      false,
      'https://example.com/headphones'
    ),
    new ShoppingItem(
      '2',
      'Organic Milk',
      'groceries',
      'jane_smith',
      new Date('2024-06-11T14:30:00Z'),
      false,
      ''
    ),
    new ShoppingItem(
      '3',
      'Cleaning Supplies',
      'household',
      'john_doe',
      new Date('2024-06-09T08:15:00Z'),
      true,
      'https://example.com/cleaning'
    ),
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Filtri per gli elementi
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesCompletion = showCompleted || !item.completed;
    
    return matchesSearch && matchesCategory && matchesCompletion;
  });

  const pendingItems = filteredItems.filter(item => !item.completed);
  const completedItems = filteredItems.filter(item => item.completed);

  // Handlers per le azioni sugli elementi
  const handleEdit = async (item: ShoppingItem) => {
    // Qui implementeresti la logica per aprire un modal/form di modifica
    toast({
      title: 'Edit item',
      description: `Editing ${item.name} - implement edit modal here`,
    });
  };

  const handleDelete = async (id: string) => {
    setIsLoading(true);
    try {
      // Simula chiamata API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setItems(prevItems => prevItems.filter(item => item.id !== id));
      
      toast({
        title: 'Item deleted',
        description: 'Shopping item deleted successfully!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (id: string) => {
    setIsLoading(true);
    try {
      // Simula chiamata API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setItems(prevItems =>
        prevItems.map(item => {
          if (item.id === id) {
            if (item.completed) {
              item.uncomplete();
            } else {
              item.complete(user?.username || 'unknown');
            }
          }
          return item;
        })
      );
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNew = () => {
    // Implementa logica per aprire modal di creazione
    toast({
      title: 'Add new item',
      description: 'Implement add new item modal here',
    });
  };

  // Carica dati all'inizializzazione
  useEffect(() => {
    // Qui faresti la chiamata API per caricare gli elementi
    // loadShoppingItems();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header con titolo e azioni */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-delft-blue mb-2">Shopping List</h1>
          <p className="text-gray-600">
            {pendingItems.length} items to buy, {completedItems.length} completed
          </p>
        </div>
        <Button
          onClick={handleAddNew}
          className="bg-cambridge-blue hover:bg-cambridge-blue/90 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Filtri e ricerca */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showCompleted ? "default" : "outline"}
                onClick={() => setShowCompleted(!showCompleted)}
                className="whitespace-nowrap"
              >
                {showCompleted ? 'Hide' : 'Show'} Completed
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista degli elementi */}
      <div className="space-y-8">
        {/* Elementi da comprare */}
        {pendingItems.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold text-delft-blue">To Buy</h2>
              <Badge variant="secondary" className="bg-cambridge-blue/20 text-cambridge-blue">
                {pendingItems.length}
              </Badge>
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
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-600">Completed</h2>
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
        {filteredItems.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-gray-500 mb-4">
                {searchTerm || categoryFilter !== 'all' 
                  ? 'No items match your filters'
                  : 'Your shopping list is empty'
                }
              </div>
              <Button
                onClick={handleAddNew}
                variant="outline"
                className="text-cambridge-blue border-cambridge-blue hover:bg-cambridge-blue hover:text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add your first item
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cambridge-blue"></div>
              <span>Processing...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export di default per facilitare l'import
export default ShoppingList;
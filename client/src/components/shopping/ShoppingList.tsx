import { useState, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingItem } from './ShoppingItem';
import { AddItemForm } from './AddItemForm';
import { ShoppingItem as ShoppingItemType, Category } from '@shared/schema';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';

export function ShoppingList() {
  const { user } = useAuthContext();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ShoppingItemType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const { 
    data: shoppingItems, 
    loading, 
    add: addItem, 
    update: updateItem, 
    remove: deleteItem 
  } = useFirestore<ShoppingItemType>('shopping_items');

  const { data: categories } = useFirestore<Category>('categories');

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let filtered = shoppingItems.filter(item => {
      // Check if user can see this item (creator + admin rule)
      const canView = item.createdBy === user?.username || user?.role === 'admin';
      if (!canView) return false;

      // Apply search filter
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Apply category filter
      if (selectedCategory && selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      return true;
    });

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'category':
        filtered.sort((a, b) => a.category.localeCompare(b.category));
        break;
      default: // newest
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  }, [shoppingItems, user, searchTerm, selectedCategory, sortBy]);

  const handleAddItem = async (itemData: any) => {
    if (editItem) {
      await updateItem(editItem.id, itemData);
      setEditItem(null);
    } else {
      await addItem(itemData);
    }
    setIsAddModalOpen(false);
  };

  const handleEditItem = (item: ShoppingItemType) => {
    setEditItem(item);
    setIsAddModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem(id);
  };

  const handleCompleteItem = async (id: string) => {
    await updateItem(id, { completed: true });
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditItem(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-sienna"></div>
        <span className="ml-3 text-delft-blue font-medium">Loading...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-delft-blue">Lista della Spesa</h2>
            <p className="text-gray-600 mt-1">Gestisci le necessità di spesa della famiglia</p>
          </div>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 sm:mt-0 bg-burnt-sienna hover:bg-burnt-sienna/90 text-white font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Aggiungi Articolo
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-delft-blue mb-2">Cerca Articoli</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cerca per nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-delft-blue mb-2">Filtra per Categoria</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutte le Categorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le Categorie</SelectItem>
                  <SelectItem value="groceries">Alimentari</SelectItem>
                  <SelectItem value="electronics">Elettronica</SelectItem>
                  <SelectItem value="household">Casa</SelectItem>
                  <SelectItem value="clothing">Abbigliamento</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-delft-blue mb-2">Ordina per</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Più Recenti</SelectItem>
                  <SelectItem value="oldest">Più Vecchi</SelectItem>
                  <SelectItem value="name">Nome A-Z</SelectItem>
                  <SelectItem value="category">Categoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shopping Items Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <ShoppingItem
              key={item.id}
              item={item}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onComplete={handleCompleteItem}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-delft-blue mb-2">Nessun articolo nella lista della spesa</h3>
          <p className="text-gray-600 mb-6">Aggiungi il primo articolo per iniziare a gestire la spesa di famiglia.</p>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-burnt-sienna hover:bg-burnt-sienna/90 text-white font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Aggiungi Primo Articolo
          </Button>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      <AddItemForm
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        onAdd={handleAddItem}
        editItem={editItem}
      />
    </div>
  );
}

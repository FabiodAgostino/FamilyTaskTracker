// ==============================================================================
// SHOPPING FOOD COMPONENT - Versione Semplificata e Corretta
// ==============================================================================

import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Store, 
  Tag, 
  Trash2, 
  Edit, 
  Check, 
  X,
  Globe,
  Lock,
  MoreVertical,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ShoppingFood, CategoryFood, Supermarket, ShoppingFoodItem } from '@/lib/models/food';
import { FaCartShopping } from 'react-icons/fa6';
import { DeepSeekCategorizationClient } from '@/lib/deepseek-client';
import { LoadingScreen, useLoadingTransition } from '../ui/loading-screen';

interface ShoppingFoodComponentProps {
  className?: string;
}


export function ShoppingFoodComponent({ className }: ShoppingFoodComponentProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Firestore hooks
const { 
  data: shoppingLists, 
  loading: listsLoading, 
  add: addList, 
  update: updateList, 
  remove: removeList 
} = useFirestore<ShoppingFood>('shopping_food');
  
  const { 
    data: categories, 
    add: addCategory 
  } = useFirestore<CategoryFood>('food_categories');
  
  const { 
    data: supermarkets, 
    add: addSupermarket 
  } = useFirestore<Supermarket>('supermarkets');

const { 
  data: allListsForCategorization 
} = useFirestore<ShoppingFood>('shopping_food', { includeDeleted: true });
const { 
  data: trashedLists
} = useFirestore<ShoppingFood>('shopping_food', { onlyDeleted: true });


const {showLoading } = useLoadingTransition(listsLoading, shoppingLists);


  // Stati principali - semplificati
  const [selectedList, setSelectedList] = useState<ShoppingFood | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isCategorizingWithAI, setIsCategorizingWithAI] = useState(false);
  const [expandedTrashItems, setExpandedTrashItems] = useState<Set<string>>(new Set());


  // Filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSupermarket, setFilterSupermarket] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(!isMobile);
  
  // Dialoghi
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showSupermarketDialog, setShowSupermarketDialog] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [showTrashDialog, setShowTrashDialog] = useState(false);

  // Form states
  const [newListForm, setNewListForm] = useState({
    title: '',
    supermarketId: 'none',
    isPublic: false
  });
  
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: '',
    description: '',
    color: '#81B29A',
    icon: '📦'
  });

  const [newSupermarketForm, setNewSupermarketForm] = useState({
    name: '',
    address: '',
    color: '#E07A5F'
  });


  // Computed values
  const filteredLists = shoppingLists?.filter(list => {
    if (!list) return false;
    
    const matchesSearch = list.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (list.items || []).some(item => item.text.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = filterCategory === 'all' || 
      (list.items || []).some(item => item.category === filterCategory);
    
    const matchesSupermarket = filterSupermarket === 'all' || 
      list.supermarketId === filterSupermarket;
    
    return matchesSearch && matchesCategory && matchesSupermarket;
  }) || [];

  // Stats
  const stats = {
    total: filteredLists.length,
    completed: filteredLists.filter(list => list.areAllItemsCompleted()).length
  };

  // ===== HANDLERS SEMPLIFICATI =====
const handleChangeItemCategory = async (itemId: string, newCategory: string) => {
  if (!selectedList) return;
  
  try {
    // Usa il metodo helper della classe
    selectedList.updateItemCategory(itemId, newCategory);
    
    // Aggiorna direttamente l'oggetto
    await updateList(selectedList.id, selectedList);
    
    toast({
      title: "Categoria aggiornata",
      description: "Categoria modificata con successo",
    });
  } catch (error) {
    console.error('Errore cambio categoria:', error);
    toast({
      title: "Errore",
      description: "Impossibile aggiornare la categoria",
      variant: "destructive"
    });
  }
};
  const handleAddItem = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !newItemText.trim() || !selectedList) return;
    
    try {
      // Usa il metodo helper della classe
      selectedList.addItem(newItemText.trim());
      
      // Aggiorna direttamente l'oggetto
      await updateList(selectedList.id, selectedList);

      setNewItemText('');
      
      toast({
        title: "Prodotto aggiunto",
        description: `"${newItemText.trim()}" aggiunto alla lista`,
      });
    } catch (error) {
      console.error('Errore aggiunta item:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiungere il prodotto",
        variant: "destructive"
      });
    }
  };

  const handleToggleItem = async (itemId: string) => {
    if (!selectedList || !user) return;
    
    try {
      // Usa il metodo helper della classe
      selectedList.toggleItemCompleted(itemId, user.username);
      
      // Aggiorna direttamente l'oggetto
      await updateList(selectedList.id, selectedList);
    } catch (error) {
      console.error('Errore toggle item:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'elemento",
        variant: "destructive"
      });
    }
  };
  


  const handleRemoveItem = async (itemId: string) => {
    if (!selectedList) return;
    
    try {
      // Usa il metodo helper della classe
      selectedList.removeItem(itemId);
      
      // Aggiorna direttamente l'oggetto
      await updateList(selectedList.id, selectedList);
    } catch (error) {
      console.error('Errore rimozione item:', error);
      toast({
        title: "Errore",
        description: "Impossibile rimuovere l'elemento",
        variant: "destructive"
      });
    }
  };


// Ottieni tutte le liste esistenti per il confronto (incluse quelle cancellate)

const handleAICategorization = async (list: ShoppingFood) => {
  if (!user || !categories || categories.length === 0) {
        return;
  }

  // Filtra solo items senza categoria valida
  const uncategorizedItems = list.items.filter(item => 
    !item.category || 
    item.category === 'Altro' || 
    item.category.trim() === ''
  );

  if (uncategorizedItems.length === 0) {
        toast({
      title: "Categorizzazione",
      description: "Tutti i prodotti hanno già una categoria",
    });
    return;
  }

    setIsCategorizingWithAI(true);

  try {
    // STEP 1: Controlla nella collezione shopping_food per prodotti già categorizzati
    let locallyUpdatedCount = 0;
    const remainingItems: typeof uncategorizedItems = [];

    // Ottieni tutte le liste esistenti per il confronto
    // ✅ Usa hook separato per ottenere TUTTE le liste (incluse quelle cancellate)
    // Ottieni tutte le liste esistenti per il confronto (incluse quelle cancellate)
    if (allListsForCategorization && allListsForCategorization.length > 0) {
      uncategorizedItems.forEach(uncategorizedItem => {
        let foundMatch = false;
        
        // Cerca in tutte le liste esistenti un prodotto con lo stesso nome
        allListsForCategorization.forEach(existingList => {
          if (foundMatch) return; // Già trovato match
          
          existingList.items.forEach(existingItem => {
            if (foundMatch) return; // Già trovato match
            
            // Confronto case-insensitive del nome prodotto
            if (existingItem.text.toLowerCase().trim() === uncategorizedItem.text.toLowerCase().trim() &&
                existingItem.category && 
                existingItem.category !== 'Altro' && 
                existingItem.category.trim() !== '') {
              
                            
              // Aggiorna la categoria dall'item esistente
              uncategorizedItem.category = existingItem.category;
              uncategorizedItem.assignedAutomatically = true;
              foundMatch = true;
              locallyUpdatedCount++;
            }
          });
        });

        // Se non trovato match locale, aggiungi alla lista per DeepSeek
        if (!foundMatch) {
          remainingItems.push(uncategorizedItem);
        }
      });
    } else {
      // Se non ci sono liste esistenti, tutti gli item vanno a DeepSeek
      remainingItems.push(...uncategorizedItems);
    }

    // Salva gli aggiornamenti locali se ci sono stati match
    if (locallyUpdatedCount > 0) {
            list.updatedAt = new Date();
      await updateList(list.id, list);
      
      toast({
        title: `📚 ${locallyUpdatedCount} prodotti categorizzati`,
        description: "Categorie trovate da prodotti esistenti",
      });
    }

    // STEP 2: Se rimangono prodotti non categorizzati, usa DeepSeek
    if (remainingItems.length === 0) {
            return;
    }

    
    // Prepara i dati per DeepSeek (solo prodotti non risolti localmente)
    const itemsForAI = remainingItems.map(item => ({
      text: item.text,
      category: item.category
    }));

    const categoriesForAI = categories.map(cat => ({
      name: cat.name,
      description: cat.description || ''
    }));

        
    // Chiama DeepSeek per la categorizzazione
    const categorizationResults = await DeepSeekCategorizationClient.categorizeProducts(
      itemsForAI,
      categoriesForAI
    );

    
    // Applica i risultati DeepSeek
    let aiUpdatedCount = 0;
    
    categorizationResults.forEach(result => {
      // Trova l'item corrispondente nella lista dei rimanenti
      const itemToUpdate = remainingItems.find(item => 
        item.text.toLowerCase().trim() === result.productText.toLowerCase().trim()
      );
      
      if (itemToUpdate) {
        // Verifica che la categoria suggerita esista
        const categoryExists = categories.find(cat => 
          cat.name === result.suggestedCategory
        );
        
        if (categoryExists) {
                    
          // Aggiorna la categoria dell'item
          itemToUpdate.category = result.suggestedCategory;
          itemToUpdate.assignedAutomatically = true;
          
          aiUpdatedCount++;
        } else {
          console.warn(`⚠️ Categoria "${result.suggestedCategory}" non trovata per "${result.productText}"`);
          // Fallback a "Altro" se categoria non riconosciuta
          itemToUpdate.category = 'Altro';
          itemToUpdate.assignedAutomatically = true;
        }
      } else {
        console.warn(`⚠️ Prodotto "${result.productText}" non trovato nella lista rimanente`);
      }
    });

    // Salva la lista aggiornata su Firestore se ci sono stati aggiornamenti da AI
    if (aiUpdatedCount > 0) {
            
      // Aggiorna timestamp della lista
      list.updatedAt = new Date();
      
      await updateList(list.id, list);
    }

    // Toast finale con riepilogo
    const totalUpdated = locallyUpdatedCount + aiUpdatedCount;
    if (totalUpdated > 0) {
      toast({
        title: "🤖 Categorizzazione Completata",
        description: `${totalUpdated} prodotti categorizzati (${locallyUpdatedCount} da database, ${aiUpdatedCount} da AI)`,
      });
    } else {
            
      toast({
        title: "Categorizzazione",
        description: "Nessun prodotto necessitava di categorizzazione",
      });
    }

  } catch (error: unknown) {
    console.error('❌ Errore durante categorizzazione:', error);
    
    // Gestione errori user-friendly
    let errorMessage = 'Errore durante la categorizzazione automatica';
    
    // Type guard per verificare se error è un Error object
    if (error instanceof Error) {
      if (error.name === 'DeepSeekCategorizationError') {
        errorMessage = error.message;
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Errore di connessione. Verifica la tua connessione internet';
      } else if (error.message.includes('API key')) {
        errorMessage = 'Configurazione AI non valida';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Troppe richieste. Riprova tra qualche minuto';
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
      
    toast({
      title: "Errore Categorizzazione",
      description: errorMessage,
      variant: "destructive"
    });

  } finally {
    setIsCategorizingWithAI(false);
      }
};
  const handleCreateList = async () => {
 if (!user) return;
 
 setIsCreatingList(true); // ✅ Mostra loading overlay
 
 try {
   const title = newListForm.title.trim() || `Spesa del ${new Date().toLocaleDateString('it-IT')}`;
   
   const newList = new ShoppingFood(
     `shopping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
     title,
     [],
     user.username,
     new Date(),
     newListForm.supermarketId === 'none' ? undefined : newListForm.supermarketId,
     newListForm.isPublic,
     false,
     undefined,
     undefined,
     undefined,
     undefined,
     [],
     new Date(),
     false
   );

   const firestoreId = await addList(newList);
   
   // ✅ ASPETTA che useFirestore aggiorni la lista
   // Trova la lista appena creata nella lista sincronizzata
   const findCreatedList = () => {
     return shoppingLists?.find(list => list.id === firestoreId);
   };

   // Polling con timeout per trovare la lista
   let attempts = 0;
   const maxAttempts = 10;
   
   const waitForSync = async () => {
  const foundList = findCreatedList();
  if (foundList) {
    setSelectedList(foundList);
    setIsEditing(true);  // ✅ Entra subito in modalità editing
    setIsCreatingList(false);
  } else if (attempts < maxAttempts) {
    attempts++;
    setTimeout(waitForSync, 100);
  } else {
    newList.id = firestoreId;
    setSelectedList(newList);
    setIsEditing(true);
    if (isMobile) setShowMobileDetail(true);
    setIsCreatingList(false);
  }
};
   
   waitForSync();
   
   setShowCreateDialog(false);
   setNewListForm({ title: '', supermarketId: 'none', isPublic: false });
   
   toast({
     title: "Lista creata",
     description: `"${title}" creata con successo`,
   });
 } catch (error) {
   setIsCreatingList(false); // ✅ Nascondi loading overlay anche in caso di errore
   toast({
     title: "Errore",
     description: "Impossibile creare la lista",
     variant: "destructive"
   });
 }
};
const handleSaveList = async () => {
  if (isEditing && selectedList) {
    // ✅ Se era in editing, chiama DeepSeek prima di salvare
    const uncategorizedItems = selectedList.items.filter(item => 
      !item.category || item.category === 'Altro' || item.category.trim() === ''
    );
    
    if (uncategorizedItems.length > 0 && categories && categories.length > 0) {
            await handleAICategorization(selectedList);
    }
  }
  
  // ✅ Poi cambia modalità editing
  setIsEditing(!isEditing);
};

const handleRestoreList = async (listId: string) => {
  const listToRestore = trashedLists?.find(l => l.id === listId);
  if (!listToRestore) return;
  
  try {
    listToRestore.isDeleted = false;
    listToRestore.updatedAt = new Date();
    
    await updateList(listId, listToRestore);
    
    toast({
      title: "Lista ripristinata",
      description: `"${listToRestore.title}" ripristinata dal cestino`,
    });
  } catch (error) {
    toast({
      title: "Errore",
      description: "Impossibile ripristinare la lista",
      variant: "destructive"
    });
  }
};

const handlePermanentDelete = async (listId: string) => {
  const listToDelete = trashedLists?.find(l => l.id === listId);
  if (!listToDelete || !window.confirm(`Eliminare definitivamente "${listToDelete.title}"? Questa azione non può essere annullata.`)) return;
  
  try {
    await removeList(listId);
    
    toast({
      title: "Lista eliminata definitivamente",
      description: `"${listToDelete.title}" eliminata per sempre`,
    });
  } catch (error) {
    toast({
      title: "Errore",
      description: "Impossibile eliminare la lista definitivamente",
      variant: "destructive"
    });
  }
};

  const handleDeleteList = async (listId: string) => {
  const listToDelete = shoppingLists?.find(l => l.id === listId);
  if (!listToDelete || !window.confirm(`Eliminare "${listToDelete.title}"?`)) return;
  
  try {
    // ✅ Cancellazione logica invece che fisica
    listToDelete.isDeleted = true;
    listToDelete.updatedAt = new Date();
    
    await updateList(listId, listToDelete);
    
    if (selectedList?.id === listId) {
      setSelectedList(null);
      setIsEditing(false);
      setNewItemText('');
      setShowMobileDetail(false);
    }
    
    toast({
      title: "Lista eliminata",
      description: `"${listToDelete.title}" spostata nel cestino`,
    });
  } catch (error) {
    toast({
      title: "Errore",
      description: "Impossibile eliminare la lista",
      variant: "destructive"
    });
  }
};

  const handleCreateCategory = async () => {
    if (!user || !newCategoryForm.name.trim()) return;
    
    try {
      const newCategory = new CategoryFood(
        `cat_${newCategoryForm.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        newCategoryForm.name.trim(),
        user.username,
        new Date(),
        newCategoryForm.description.trim() || undefined,
        newCategoryForm.color,
        newCategoryForm.icon,
        (categories?.length || 0) + 1,
        new Date()
      );

      await addCategory(newCategory);
      setNewCategoryForm({ name: '', description: '', color: '#81B29A', icon: '📦' });
      setShowCategoryDialog(false);
      
      toast({
        title: "Categoria creata",
        description: `"${newCategoryForm.name}" creata con successo`,
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile creare la categoria",
        variant: "destructive"
      });
    }
  };

  const handleCreateSupermarket = async () => {
    if (!user || !newSupermarketForm.name.trim()) return;
    
    try {
      const newSupermarket = new Supermarket(
        `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        newSupermarketForm.name.trim(),
        user.username,
        new Date(),
        newSupermarketForm.address.trim() || undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        newSupermarketForm.color,
        true,
        new Date()
      );

      await addSupermarket(newSupermarket);
      setNewSupermarketForm({ name: '', address: '', color: '#E07A5F' });
      setShowSupermarketDialog(false);
      
      toast({
        title: "Supermercato creato",
        description: `"${newSupermarketForm.name}" creato con successo`,
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile creare il supermercato",
        variant: "destructive"
      });
    }
  };

  // ===== HELPER FUNCTIONS =====
  
  const getCompletionStats = () => {
    if (!selectedList) return { completed: 0, total: 0, percentage: 0 };
    return selectedList.getCompletionStats();
  };

  // Loading state
return (
  <LoadingScreen
    isVisible={showLoading}
    title="Caricamento Lista della spesa"
    subtitle="Recupero degli articoli..."
  >
      <div className={cn("container mx-auto p-6 max-w-7xl", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <FaCartShopping className="h-8 w-8 text-cambridge-newStyle" />
            <h1 className="text-3xl font-bold text-delft-blue">Spesa</h1>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Badge variant="outline" className="text-cambridge-newStyle border-cambridge-newStyle">
              {stats.total} {stats.total === 1 ? 'lista' : 'liste'}
            </Badge>
            {stats.completed > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-200">
                {stats.completed} completate
              </Badge>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isMobile ? '' : 'Nuova Lista'}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowCategoryDialog(true)}>
                <Tag className="h-4 w-4 mr-2" />
                Gestisci Categorie
                
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => setShowSupermarketDialog(true)}>
                <Store className="h-4 w-4 mr-2" />
                Gestisci Supermercati
              </DropdownMenuItem>
              
            <DropdownMenuItem onClick={() => setShowTrashDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Cestino ({trashedLists?.length || 0})
            </DropdownMenuItem>
          </DropdownMenuContent>
            
          </DropdownMenu>
          
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-cambridge-newStyle" />
              <span className="font-medium text-delft-blue">Filtri di ricerca</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowFilters(!showFilters)}
              size="sm"
            >
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {!showFilters && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca nelle liste..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <Tag className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le categorie</SelectItem>
                    {categories?.map(category => (
                      <SelectItem key={category.id} value={category.name}>
                        <div className="flex items-center gap-2">
                          <span>{category.icon}</span>
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterSupermarket} onValueChange={setFilterSupermarket}>
                  <SelectTrigger>
                    <Store className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Supermercato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i supermercati</SelectItem>
                    {supermarkets?.map(market => (
                      <SelectItem key={market.id} value={market.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: market.color }}
                          />
                          {market.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lists */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-delft-blue">
            Le tue liste ({filteredLists.length})
          </h2>
          
          {filteredLists.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nessuna lista della spesa trovata
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredLists.map(list => {
                const supermarket = supermarkets?.find(s => s.id === list.supermarketId);
                const stats = list.getCompletionStats();
                
                return (
                  <Card 
                    key={list.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      selectedList?.id === list.id ? 'ring-2 ring-burnt-sienna border-burnt-newStyle' : ''
                    )}
                    onClick={() => {
                      setSelectedList(list);
                      setIsEditing(false);
                      setNewItemText('');
                      if (isMobile) setShowMobileDetail(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-medium text-delft-blue truncate flex-1">
                          {list.title}
                        </h3>
                        <div className="flex items-center gap-1 ml-2">
                          {list.isPublic ? (
                            <Globe className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteList(list.id);
                            }}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {supermarket && (
                        <div className="flex items-center gap-2 mb-2">
                          <Store className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {supermarket.name}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {stats.completed}/{stats.total} completati
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(list.createdAt, { 
                            addSuffix: true, 
                            locale: it 
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail - Desktop Only */}
        {!isMobile && (
          <div className="lg:col-span-2">
            {selectedList ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl text-delft-blue">
                      {selectedList.title}
                    </CardTitle>
                    <Button
                      variant={isEditing ? "default" : "outline"}
                      size="sm"
                      onClick={handleSaveList}
                      className={isEditing ? "bg-burnt-newStyle hover:bg-burnt-newStyle/90" : ""}
                    >
                      {isEditing ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                      {isEditing ? 'Salva' : 'Modifica'}
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Add Item Input */}
                  {isEditing && (
                    <div>
                      <Label htmlFor="new-item">Aggiungi prodotto (premi Enter)</Label>
                      <Input
                        id="new-item"
                        placeholder="Scrivi qui un prodotto..."
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={handleAddItem}
                      />
                    </div>
                  )}

                  {/* Items List */}
                  {selectedList.items.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {isEditing 
                          ? "Inizia a scrivere i prodotti!" 
                          : "Questa lista è vuota."}
                      </p>
                    </div>
                  ) : isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {selectedList.sortItemsByDate()
                        .map(item => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-white"
                          >
                            <Circle className="h-5 w-5 text-gray-300" />
                            <span className="flex-1">{item.text}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      }
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="space-y-6">
                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Progresso spesa</span>
                          <span className="text-muted-foreground">
                            {getCompletionStats().completed}/{getCompletionStats().total}
                          </span>
                        </div>
                        <Progress value={getCompletionStats().percentage} className="h-3" />
                      </div>

                    {/* Items by Category */}
<div className="space-y-6 max-h-96 overflow-y-auto">
  {(() => {
    // Ordina le categorie per order (ASC)
    const sortedCategories = (categories || []).sort((a, b) => a.order - b.order);
    const grouped = selectedList.getItemsByCategory();
    const orderedEntries: [string, ShoppingFoodItem[]][] = [];
    
    // Aggiungi categorie in ordine
    sortedCategories.forEach(category => {
      if (grouped.has(category.name)) {
        orderedEntries.push([category.name, grouped.get(category.name)!]);
      }
    });
    
    // Aggiungi categorie non riconosciute alla fine
    for (const [categoryName, items] of grouped.entries()) {
      if (!sortedCategories.find(c => c.name === categoryName)) {
        orderedEntries.push([categoryName, items]);
      }
    }
    
    return orderedEntries.map(([categoryName, items], index) => (
      <div key={categoryName}>
        {index > 0 && <hr className="border-gray-200 my-4" />}
        
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                item.completed 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-white hover:bg-gray-50'
              )}
            >
              <button
                onClick={() => handleToggleItem(item.id)}
                className="flex-shrink-0"
              >
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
              
              <span className={cn("flex-1", item.completed && 'line-through')}>
                {item.text}
              </span>
              
              {/* Select per categoria */}
              <Select
                value={item.category || 'Altro'}
                onValueChange={(value) => handleChangeItemCategory(item.id, value)}
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map(category => (
                    <SelectItem key={category.id} value={category.name}>
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{category.icon}</span>
                        <span className="text-xs">{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="Altro">
                    <div className="flex items-center gap-1">
                      <span className="text-xs">📋</span>
                      <span className="text-xs">Altro</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    ));
  })()}
</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-delft-blue mb-2">
                    Seleziona una lista della spesa
                  </h3>
                  <p className="text-muted-foreground">
                    Scegli una lista dalla colonna di sinistra per visualizzarla e modificarla
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Mobile Detail Dialog */}
      {isMobile && (
        <Dialog open={showMobileDetail} onOpenChange={setShowMobileDetail}>
          <DialogContent className="sm:max-w-full h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-4 border-b">
              <div className="flex items-center justify-between">
                <DialogTitle>{selectedList?.title}</DialogTitle>
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  onClick={handleSaveList} 
                >
                  {isEditing ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                </Button>
              </div>
            </DialogHeader>
            
            {selectedList && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Add Item */}
                {isEditing && (
                  <div className="p-4 border-b bg-gray-50">
                    <Input
                      placeholder="Aggiungi prodotto (Enter)"
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      onKeyDown={handleAddItem}
                    />
                  </div>
                )}

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedList.items.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground text-sm">
                        {isEditing ? "Inizia a scrivere!" : "Lista vuota"}
                      </p>
                    </div>
                  ) : isEditing ? (
                    <div className="space-y-2">
                      {selectedList.sortItemsByDate()
                        .map(item => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 bg-white rounded-lg border"
                          >
                            <Circle className="h-4 w-4 text-gray-300" />
                            <span className="flex-1 text-sm">{item.text}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 h-6 w-6 text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      }
                    </div>
                  ) : (
                   <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">Progresso</span>
                        <span className="text-muted-foreground">
                          {getCompletionStats().completed}/{getCompletionStats().total}
                        </span>
                      </div>
                      <Progress value={getCompletionStats().percentage} className="h-2" />
                    </div>

                    {(() => {
                      // Ordina le categorie per order (ASC) - stesso codice del desktop
                      const sortedCategories = (categories || []).sort((a, b) => a.order - b.order);
                      const grouped = selectedList.getItemsByCategory();
                      const orderedEntries: [string, ShoppingFoodItem[]][] = [];
                      
                      sortedCategories.forEach(category => {
                        if (grouped.has(category.name)) {
                          orderedEntries.push([category.name, grouped.get(category.name)!]);
                        }
                      });
                      
                      for (const [categoryName, items] of grouped.entries()) {
                        if (!sortedCategories.find(c => c.name === categoryName)) {
                          orderedEntries.push([categoryName, items]);
                        }
                      }
                      
                      return orderedEntries.map(([categoryName, items], index) => (
                        <div key={categoryName}>
                          {index > 0 && <hr className="border-gray-200 my-3" />}
                          
                          {items.map(item => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex flex-col gap-2 p-3 rounded-lg border text-sm mb-2",
                                item.completed 
                                  ? 'bg-green-50 border-green-200 text-green-700' 
                                  : 'bg-white'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleItem(item.id)}
                                  className="flex-shrink-0"
                                >
                                  {item.completed ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                                
                                <span className={cn("flex-1", item.completed && 'line-through')}>
                                  {item.text}
                                </span>
                              </div>
                              
                              {/* Select per categoria mobile */}
                              <Select
                                value={item.category || 'Altro'}
                                onValueChange={(value) => handleChangeItemCategory(item.id, value)}
                              >
                                <SelectTrigger className="w-full h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories?.map(category => (
                                    <SelectItem key={category.id} value={category.name}>
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs">{category.icon}</span>
                                        <span className="text-xs">{category.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="Altro">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs">📋</span>
                                      <span className="text-xs">Altro</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                  )}
                </div>

                <div className="p-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => setShowMobileDetail(false)}
                    className="w-full"
                  >
                    Chiudi
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Create List Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crea Nuova Lista</DialogTitle>
            <DialogDescription>
              Crea una nuova lista della spesa personalizzata.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titolo (opzionale)</Label>
              <Input
                placeholder={`Spesa del ${new Date().toLocaleDateString('it-IT')}`}
                value={newListForm.title}
                onChange={(e) => setNewListForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Supermercato (opzionale)</Label>
              <Select 
                value={newListForm.supermarketId} 
                onValueChange={(value) => setNewListForm(prev => ({ ...prev, supermarketId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona supermercato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessun supermercato</SelectItem>
                  {supermarkets?.map(market => (
                    <SelectItem key={market.id} value={market.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: market.color }}
                        />
                        {market.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={newListForm.isPublic}
                onCheckedChange={(checked) => setNewListForm(prev => ({ ...prev, isPublic: checked }))}
              />
              <Label className="flex items-center gap-2">
                {newListForm.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {newListForm.isPublic ? 'Lista pubblica' : 'Lista privata'}
              </Label>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateList} className="flex-1 bg-burnt-newStyle hover:bg-burnt-newStyle/90">
                Crea Lista
              </Button>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1">
                Annulla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crea Nuova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome categoria *</Label>
              <Input
                placeholder="Nome categoria"
                value={newCategoryForm.name}
                onChange={(e) => setNewCategoryForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Icona</Label>
              <div className="flex gap-2 flex-wrap mt-2">
                {['📦', '🛒', '🍽️', '🥘', '☕', '🧾'].map(icon => (
                  <button
                    key={icon}
                    className={cn(
                      "p-2 border rounded-md hover:bg-gray-50",
                      newCategoryForm.icon === icon ? 'border-burnt-newStyle bg-burnt-newStyle/10' : ''
                    )}
                    onClick={() => setNewCategoryForm(prev => ({ ...prev, icon }))}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCreateCategory}
                disabled={!newCategoryForm.name.trim()}
                className="flex-1 bg-burnt-newStyle hover:bg-burnt-newStyle/90"
              >
                Crea Categoria
              </Button>
              <Button variant="outline" onClick={() => setShowCategoryDialog(false)} className="flex-1">
                Annulla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Supermarket Dialog */}
      <Dialog open={showSupermarketDialog} onOpenChange={setShowSupermarketDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crea Nuovo Supermercato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome supermercato *</Label>
              <Input
                placeholder="Nome supermercato"
                value={newSupermarketForm.name}
                onChange={(e) => setNewSupermarketForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Indirizzo</Label>
              <Input
                placeholder="Indirizzo (opzionale)"
                value={newSupermarketForm.address}
                onChange={(e) => setNewSupermarketForm(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCreateSupermarket}
                disabled={!newSupermarketForm.name.trim()}
                className="flex-1 bg-burnt-newStyle hover:bg-burnt-newStyle/90"
              >
                Crea Supermercato
              </Button>
              <Button variant="outline" onClick={() => setShowSupermarketDialog(false)} className="flex-1">
                Annulla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isCreatingList} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md" 
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-center">Creazione Lista in Corso</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cambridge-newStyle mb-4"></div>
            <p className="text-muted-foreground text-center">
              Sto sincronizzando la nuova lista...
            </p>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Questo richiederà solo qualche secondo
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategorizingWithAI} onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🤖 Categorizzazione AI in Corso</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p>DeepSeek sta analizzando i prodotti...</p>
        </div>
      </DialogContent>
    </Dialog>

    {/* ✅ Modale Cestino Migliorata */}
<Dialog open={showTrashDialog} onOpenChange={setShowTrashDialog}>
  <DialogContent className="sm:max-w-2xl w-[95vw] h-[85vh] flex flex-col p-0">
    {/* Header fisso */}
    <DialogHeader className="p-4 border-b bg-white">
      <DialogTitle className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-red-500" />
        Cestino ({trashedLists?.length || 0} liste)
      </DialogTitle>
      <DialogDescription className="text-sm">
        Le liste eliminate possono essere ripristinate o eliminate definitivamente.
      </DialogDescription>
    </DialogHeader>
    
    {/* Area scrollabile */}
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {!trashedLists || trashedLists.length === 0 ? (
        <div className="text-center py-12">
          <Trash2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-delft-blue mb-2">
            Cestino vuoto
          </h3>
          <p className="text-muted-foreground text-sm">
            Non ci sono liste eliminate
          </p>
        </div>
      ) : (
        trashedLists.map(list => {
          const supermarket = supermarkets?.find(s => s.id === list.supermarketId);
          const stats = list.getCompletionStats();
          const isExpanded = expandedTrashItems.has(list.id);
            const toggleExpanded = () => {
              const newExpanded = new Set(expandedTrashItems);
              if (isExpanded) {
                newExpanded.delete(list.id);
              } else {
                newExpanded.add(list.id);
              }
              setExpandedTrashItems(newExpanded);
            };
          
          return (
            <Card key={list.id} className="border-red-200">
              <CardContent className="p-3">
                {/* Header collassabile */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-delft-blue text-sm truncate">
                        {list.title}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded()}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{stats.total} prodotti</span>
                      {supermarket && (
                        <span className="flex items-center gap-1">
                          <Store className="h-2 w-2" />
                          {supermarket.name}
                        </span>
                      )}
                      <span>
                        {formatDistanceToNow(list.updatedAt || list.createdAt, { 
                          addSuffix: true, 
                          locale: it 
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Anteprima compatta quando NON espanso */}
                {!isExpanded && list.items.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {list.items.slice(0, 4).map(item => (
                        <Badge 
                          key={item.id} 
                          variant="secondary" 
                          className={cn(
                            "text-xs py-0 px-1",
                            item.completed ? "bg-green-100 text-green-700" : ""
                          )}
                        >
                          {item.completed && <Check className="h-2 w-2 mr-1" />}
                          {item.text}
                        </Badge>
                      ))}
                      {list.items.length > 4 && (
                        <Badge variant="outline" className="text-xs py-0 px-1">
                          +{list.items.length - 4}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stats.completed}/{stats.total} completati ({stats.percentage}%)
                    </div>
                  </div>
                )}

                {/* Vista espansa con tutti gli items */}
                {isExpanded && list.items.length > 0 && (
                  <div className="mb-3 border-t pt-2">
                    <div className="text-xs font-medium text-delft-blue mb-2">
                      Tutti i prodotti ({list.items.length}):
                    </div>
                    <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                      {list.items.map(item => (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center gap-2 p-1 rounded text-xs",
                            item.completed 
                              ? "bg-green-50 text-green-700" 
                              : "bg-gray-50"
                          )}
                        >
                          {item.completed ? (
                            <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                          ) : (
                            <Circle className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          )}
                          <span className={cn(
                            "flex-1 truncate",
                            item.completed && "line-through"
                          )}>
                            {item.text}
                          </span>
                          {item.category && item.category !== 'Altro' && (
                            <Badge variant="outline" className="text-xs py-0 px-1">
                              {item.category}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Azioni responsive */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreList(list.id)}
                    className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 text-xs"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Ripristina
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePermanentDelete(list.id)}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Elimina
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
    
    {/* Footer fisso */}
    <div className="border-t p-4 bg-white">
      <Button
        variant="secondary"
        onClick={() => setShowTrashDialog(false)}
        className="w-full"
      >
        Chiudi
      </Button>
    </div>
  </DialogContent>
</Dialog>
        </div>
  </LoadingScreen>
);

}
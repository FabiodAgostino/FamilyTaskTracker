import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ShoppingCart, Loader2, Link as LinkIcon, Tag, Euro, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShoppingItem, Category, ModelFactory, Priority, ValidationError } from '@/lib/models/types';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Tipo semplice per il form - la validazione è gestita dalle classi
interface ShoppingItemFormData {
  name: string;
  link?: string;
  category: string;
  createdBy: string;
  completed: boolean;
  priority: Priority;
  estimatedPrice?: number;
  notes?: string;
}

interface AddItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: ShoppingItem) => Promise<void>;
  editItem?: ShoppingItem | null;
}

export function AddItemForm({ isOpen, onClose, onAdd, editItem }: AddItemFormProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const { data: categories, add: addCategory } = useFirestore<Category>('categories');

  const form = useForm<ShoppingItemFormData>({
    // Nessun resolver - la validazione è gestita dalle classi
    defaultValues: {
      name: '',
      link: '',
      category: '',
      createdBy: user?.username || '',
      completed: false,
      priority: 'medium',
      estimatedPrice: undefined,
      notes: '',
    },
  });

  useEffect(() => {
    if (editItem) {
      form.reset({
        name: editItem.name,
        link: editItem.link || '',
        category: editItem.category,
        createdBy: editItem.createdBy,
        completed: editItem.completed,
        priority: editItem.priority,
        estimatedPrice: editItem.estimatedPrice,
        notes: editItem.notes || '',
      });
    } else {
      form.reset({
        name: '',
        link: '',
        category: '',
        createdBy: user?.username || '',
        completed: false,
        priority: 'medium',
        estimatedPrice: undefined,
        notes: '',
      });
    }
  }, [editItem, form, user]);

  const onSubmit = async (data: ShoppingItemFormData) => {
    setIsLoading(true);
    
    try {
      // Aggiungi nuova categoria se necessario
      if (newCategory && !categories?.find(c => c.name.toLowerCase() === newCategory.toLowerCase())) {
        try {
          const newCat = ModelFactory.createCategory({
            id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: newCategory,
            createdBy: user?.username || '',
            createdAt: new Date(),
          });
          await addCategory(newCat);
          data.category = newCategory;
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Errore di validazione categoria',
              description: validationError.errors.join(', '),
              variant: 'destructive',
            });
            return;
          }
          throw validationError;
        }
      }

      let shoppingItem: ShoppingItem;
      
      if (editItem) {
        // Aggiorna articolo esistente usando metodi della classe
        shoppingItem = editItem;
        try {
          // Usa i metodi della classe che includono validazione automatica
          shoppingItem.updateName(data.name);
          shoppingItem.link = data.link;
          shoppingItem.category = data.category;
          shoppingItem.priority = data.priority;
          shoppingItem.estimatedPrice = data.estimatedPrice;
          shoppingItem.notes = data.notes;
          shoppingItem.updatedAt = new Date();
          
          // Ri-valida l'intero oggetto dopo le modifiche
          shoppingItem.validate();
          
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Errore di validazione',
              description: validationError.errors.join(', '),
              variant: 'destructive',
            });
            return;
          }
          throw validationError;
        }
      } else {
        // Crea nuovo articolo usando ModelFactory (con validazione automatica)
        try {
          shoppingItem = ModelFactory.createShoppingItem({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: data.name,
            link: data.link,
            category: data.category,
            createdBy: data.createdBy,
            completed: data.completed,
            priority: data.priority,
            estimatedPrice: data.estimatedPrice,
            notes: data.notes,
          });
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Errore di validazione',
              description: validationError.errors.join(', '),
              variant: 'destructive',
            });
            return;
          }
          throw validationError;
        }
      }

      await onAdd(shoppingItem);
      
      toast({
        title: editItem ? 'Articolo aggiornato' : 'Articolo aggiunto',
        description: editItem ? 'Articolo aggiornato con successo!' : 'Articolo aggiunto con successo!',
      });
      
      onClose();
      form.reset();
      setNewCategory('');
    } catch (error) {
      console.error('Errore durante il salvataggio dell\'articolo:', error);
      toast({
        title: 'Errore',
        description: editItem ? 'Impossibile aggiornare l\'articolo' : 'Impossibile aggiungere l\'articolo',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategorySelect = (value: string) => {
    if (value === 'new') {
      // Non impostare il valore nel form, lascia che l'utente scriva la nuova categoria
      return;
    }
    form.setValue('category', value);
    setNewCategory('');
  };

  const priorityOptions = [
    { value: 'low' as Priority, label: 'Bassa', color: '#10B981', icon: '⬇️' },
    { value: 'medium' as Priority, label: 'Media', color: '#F59E0B', icon: '➡️' },
    { value: 'high' as Priority, label: 'Alta', color: '#EF4444', icon: '⬆️' },
  ];

  const defaultCategories = [
    { value: 'groceries', label: 'Alimentari', icon: '🛒' },
    { value: 'electronics', label: 'Elettronica', icon: '📱' },
    { value: 'household', label: 'Casa', icon: '🏠' },
    { value: 'clothing', label: 'Abbigliamento', icon: '👕' },
    { value: 'personal-care', label: 'Cura Personale', icon: '🧴' },
    { value: 'automotive', label: 'Auto', icon: '🚗' },
    { value: 'books', label: 'Libri', icon: '📚' },
    { value: 'sports', label: 'Sport', icon: '⚽' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-delft-blue flex items-center">
            <ShoppingCart className="mr-2 h-6 w-6" />
            {editItem ? 'Modifica Articolo' : 'Aggiungi Articolo'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Nome Prodotto *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Inserisci nome prodotto"
                      maxLength={100}
                      className="text-base"
                    />
                  </FormControl>
                  <p className="text-xs text-gray-500">
                    {field.value.length}/100 caratteri
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    URL Prodotto (Opzionale)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="url" 
                      placeholder="https://esempio.com/prodotto"
                    />
                  </FormControl>
                  {field.value && (
                    <p className="text-xs text-blue-600">
                      <a href={field.value} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        🔗 Apri link
                      </a>
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <Tag className="mr-2 h-4 w-4" />
                    Categoria *
                  </FormLabel>
                  <Select onValueChange={handleCategorySelect} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona o inserisci nuova categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {defaultCategories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center space-x-2">
                            <span>{category.icon}</span>
                            <span>{category.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                      {categories?.filter(cat => !defaultCategories.some(def => def.value === cat.name)).map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          <div className="flex items-center space-x-2">
                            <span>🏷️</span>
                            <span>{category.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="new">
                        <div className="flex items-center space-x-2 text-burnt-sienna font-medium">
                          <span>➕</span>
                          <span>Aggiungi Nuova Categoria</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Oppure inserisci nuova categoria"
                    value={newCategory}
                    onChange={(e) => {
                      setNewCategory(e.target.value);
                      form.setValue('category', e.target.value);
                    }}
                    className="mt-2"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-delft-blue">Priorità</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Priorità" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorityOptions.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            <div className="flex items-center space-x-2">
                              <span>{priority.icon}</span>
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: priority.color }}
                              />
                              <span>{priority.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimatedPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                      <Euro className="mr-2 h-4 w-4" />
                      Prezzo (€)
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value ? parseFloat(value) : undefined);
                        }}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <StickyNote className="mr-2 h-4 w-4" />
                    Note (Opzionale)
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Note aggiuntive per l'articolo (es. marca preferita, dimensioni, colore...)"
                      rows={3}
                      className="resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Anteprima priorità selezionata */}
            {form.watch('priority') && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600 mb-2">Anteprima:</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{form.watch('name') || 'Nome prodotto'}</span>
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                      style={{ 
                        borderColor: priorityOptions.find(p => p.value === form.watch('priority'))?.color,
                        color: priorityOptions.find(p => p.value === form.watch('priority'))?.color
                      }}
                    >
                      {priorityOptions.find(p => p.value === form.watch('priority'))?.label}
                    </Badge>
                  </div>
                  {form.watch('estimatedPrice') && (
                    <span className="text-sm font-medium text-green-600">
                      €{form.watch('estimatedPrice')?.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => { onClose(); form.reset(); setNewCategory(''); }} disabled={isLoading}>
                Annulla
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : (editItem ? 'Aggiorna' : 'Aggiungi')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

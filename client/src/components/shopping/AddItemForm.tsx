import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { insertShoppingItemSchema, ShoppingItem, Category } from '@shared/schema';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AddItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: any) => Promise<void>;
  editItem?: ShoppingItem | null;
}

export function AddItemForm({ isOpen, onClose, onAdd, editItem }: AddItemFormProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const { data: categories, add: addCategory } = useFirestore<Category>('categories');

  const form = useForm({
    resolver: zodResolver(insertShoppingItemSchema),
    defaultValues: {
      name: '',
      link: '',
      category: '',
      createdBy: user?.username || '',
      completed: false,
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
      });
    } else {
      form.reset({
        name: '',
        link: '',
        category: '',
        createdBy: user?.username || '',
        completed: false,
      });
    }
  }, [editItem, form, user]);

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      // Add new category if needed
      if (newCategory && !categories.find(c => c.name.toLowerCase() === newCategory.toLowerCase())) {
        await addCategory({
          name: newCategory,
          createdBy: user?.username || '',
          createdAt: new Date(),
        });
        data.category = newCategory;
      }

      await onAdd(data);
      
      toast({
        title: editItem ? 'Item updated' : 'Item added',
        description: editItem ? 'Shopping item updated successfully!' : 'Shopping item added successfully!',
      });
      
      onClose();
      form.reset();
      setNewCategory('');
    } catch (error) {
      toast({
        title: 'Error',
        description: editItem ? 'Failed to update item' : 'Failed to add item',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategorySelect = (value: string) => {
    if (value === 'new') {
      // Don't set the form value, let user type new category
      return;
    }
    form.setValue('category', value);
    setNewCategory('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-delft-blue">
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
                    <Input {...field} placeholder="Inserisci nome prodotto" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    URL Prodotto (Opzionale)
                  </FormLabel>
                  <FormControl>
                    <Input {...field} type="url" placeholder="https://esempio.com/prodotto" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">Categoria</FormLabel>
                  <Select onValueChange={handleCategorySelect} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona o inserisci nuova categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="groceries">Alimentari</SelectItem>
                      <SelectItem value="electronics">Elettronica</SelectItem>
                      <SelectItem value="household">Casa</SelectItem>
                      <SelectItem value="clothing">Abbigliamento</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">+ Aggiungi Nuova Categoria</SelectItem>
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

            <div className="flex space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-burnt-sienna hover:bg-burnt-sienna/90 text-white"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editItem ? 'Aggiorna Articolo' : 'Aggiungi Articolo'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

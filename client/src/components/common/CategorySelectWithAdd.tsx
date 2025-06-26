// src/components/common/CategorySelectWithAdd.tsx
import { useState } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Category } from '@/lib/models/types';
import { cn } from '@/lib/utils';

interface NewCategoryData {
  name: string;
  icon: string;
  description: string;
  color: string;
}

interface CategorySelectWithAddProps {
  value: string;
  onValueChange: (value: string) => void;
  categories: Category[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CategorySelectWithAdd({
  value,
  onValueChange,
  categories,
  placeholder = "Seleziona categoria",
  className,
  disabled
}: CategorySelectWithAddProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const { 
    add: addCategory, 
    remove: deleteCategory, 
    loading: isAddingCategory 
  } = useFirestore<Category>('categories');

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [promotingCategory, setPromotingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<NewCategoryData>({
    defaultValues: {
      name: '',
      icon: '',
      description: '',
      color: '#6B7280'
    },
  });

  // Colori predefiniti per le nuove categorie
  const colorOptions = [
    '#E07A5F', '#3D5A80', '#98C1D9', '#EE9B00', 
    '#BB3E03', '#005577', '#0A9396', '#94D2BD',
    '#F9C74F', '#F8961E', '#F3722C', '#277DA1'
  ];

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteCategory(categoryToDelete.id);
      
      // Se la categoria eliminata era selezionata, resetta la selezione
      if (value === categoryToDelete.name) {
        onValueChange('');
      }
      
      toast({
        title: 'Categoria eliminata',
        description: `La categoria "${categoryToDelete.name}" è stata eliminata con successo.`,
      });
      
    } catch (error) {
      console.error('Errore nell\'eliminazione della categoria:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare la categoria',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setCategoryToDelete(null);
    }
  };

  const handlePromoteCategory = (dynamicCategory: Category) => {
    // Pre-compila il form con i dati della categoria dinamica
    form.reset({
      name: dynamicCategory.name,
      icon: dynamicCategory.icon || '',
      description: `Categoria ${dynamicCategory.name}`,
      color: dynamicCategory.color
    });
    
    setPromotingCategory(dynamicCategory);
    setShowAddCategoryModal(true);
  };

  const handleAddCategory = async (data: NewCategoryData) => {
    try {
      const newCategory = new Category(
        `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data.name.trim(),
        user?.username || 'system',
        new Date(),
        data.description.trim() || `Categoria ${data.name}`,
        data.color,
        data.icon.trim() || undefined,
        false,
        0,
        new Date()
      );

      await addCategory(newCategory);
      
      // Seleziona automaticamente la nuova categoria
      onValueChange(data.name);
      
      // Reset e chiudi
      form.reset();
      setPromotingCategory(null);
      setShowAddCategoryModal(false);
      
      const actionText = promotingCategory ? 'promossa' : 'creata';
      toast({
        title: `Categoria ${actionText}`,
        description: `La categoria "${data.name}" è stata ${actionText} con successo!`,
      });

    } catch (error) {
      console.error('Errore nell\'aggiunta della categoria:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile aggiungere la categoria',
        variant: 'destructive',
      });
    }
  };

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === '__add_new__') {
      setShowAddCategoryModal(true);
    } else {
      onValueChange(selectedValue);
    }
  };

  // Raggruppa categorie: prima statiche, poi dinamiche
  const staticCategories = categories.filter(cat => !cat.id.startsWith('dynamic_'));
  const dynamicCategories = categories.filter(cat => cat.id.startsWith('dynamic_'));

  return (
    <>
      <Select value={value} onValueChange={handleSelectChange} disabled={disabled}>
        <SelectTrigger className={cn("w-full", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {/* Opzione per aggiungere nuova categoria */}
          <SelectItem value="__add_new__" className="text-cambridge-blue font-medium">
            <div className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi nuova categoria
            </div>
          </SelectItem>
          
          {/* Separatore */}
          <div className="px-2 py-1">
            <div className="h-px bg-gray-200" />
          </div>
          
          {/* Categorie statiche */}
          {staticCategories.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Categorie Principali
              </div>
              {staticCategories.map((category) => (
                <div key={category.id} className="relative">
                  <SelectItem value={category.name}>
                    <div className="flex items-center justify-between w-full pr-8">
                      <div className="flex items-center flex-1">
                        {category.icon && <span className="mr-2">{category.icon}</span>}
                        <span>{category.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {category.itemCount}
                        </Badge>
                      </div>
                    </div>
                  </SelectItem>
                  
                  {/* Pulsante elimina sempre visibile per categorie statiche */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 p-0 z-10 opacity-100 hover:bg-red-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCategoryToDelete(category);
                    }}
                    title="Elimina categoria"
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </>
          )}
          
          {/* Categorie dinamiche */}
          {dynamicCategories.length > 0 && (
            <>
              <div className="px-2 py-1">
                <div className="h-px bg-gray-200" />
              </div>
              <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Categorie Automatiche
              </div>
              {dynamicCategories.map((category) => (
                <div key={category.id} className="relative">
                  <SelectItem value={category.name}>
                    <div className="flex items-center justify-between w-full pr-8">
                      <div className="flex items-center flex-1">
                        {category.icon && <span className="mr-2">{category.icon}</span>}
                        <span>{category.name}</span>
                        <Badge variant="secondary" className="ml-2 text-xs bg-gray-100">
                          {category.itemCount}
                        </Badge>
                      </div>
                    </div>
                  </SelectItem>
                  
                  {/* Pulsante + sempre visibile */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 p-0 z-10 opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePromoteCategory(category);
                    }}
                    title="Promuovi a categoria principale"
                  >
                    <Plus className="h-3 w-3 text-cambridge-blue" />
                  </Button>
                </div>
              ))}
            </>
          )}
        </SelectContent>
      </Select>

      {/* Modal per aggiungere/promuovere categoria */}
      <Dialog open={showAddCategoryModal} onOpenChange={setShowAddCategoryModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-lg text-cambridge-blue">
              <Plus className="mr-2 h-5 w-5" />
              {promotingCategory ? `Promuovi "${promotingCategory.name}"` : 'Aggiungi Nuova Categoria'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddCategory)} className="space-y-4">
              {/* Nome categoria */}
              <FormField
                control={form.control}
                name="name"
                rules={{ 
                  required: 'Il nome è obbligatorio',
                  minLength: { value: 2, message: 'Minimo 2 caratteri' },
                  maxLength: { value: 30, message: 'Massimo 30 caratteri' }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Nome Categoria *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="es. Elettronica, Casa, Sport..."
                        maxLength={30}
                        disabled={!!promotingCategory} // Disabilita se stiamo promuovendo
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Emoji */}
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Emoji (opzionale)
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="🏷️"
                        maxLength={4}
                        className="text-lg"
                      />
                    </FormControl>
                    <div className="text-xs text-gray-500">
                      Inserisci un'emoji per rappresentare la categoria
                    </div>
                  </FormItem>
                )}
              />

              {/* Descrizione */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Descrizione (opzionale)
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Breve descrizione della categoria..."
                        rows={2}
                        maxLength={100}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Colore */}
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Colore
                    </FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <Button
                          key={color}
                          type="button"
                          variant="outline"
                          className={`w-8 h-8 p-0 border-2 ${
                            field.value === color ? 'border-gray-800' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => field.onChange(color)}
                        >
                          {field.value === color && (
                            <Check className="h-4 w-4 text-white" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              {/* Pulsanti */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setPromotingCategory(null);
                    form.reset();
                  }}
                  disabled={isAddingCategory}
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={isAddingCategory}
                  className="bg-cambridge-blue hover:bg-cambridge-blue/90"
                >
                  {isAddingCategory ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      {promotingCategory ? 'Promozione...' : 'Creazione...'}
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      {promotingCategory ? 'Promuovi Categoria' : 'Crea Categoria'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal di conferma eliminazione categoria */}
      <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare la categoria "{categoryToDelete?.name}"?
              <br />
              <br />
              <strong>Attenzione:</strong> Questa azione non può essere annullata. Gli articoli che usano questa categoria manterranno il nome della categoria, ma essa non sarà più disponibile nella lista delle categorie principali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Eliminazione...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Elimina Categoria
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
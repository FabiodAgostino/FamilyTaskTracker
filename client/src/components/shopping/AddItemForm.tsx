import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
  ShoppingCart, 
  Loader2, 
  Link as LinkIcon, 
  Tag, 
  Euro, 
  StickyNote, 
  Plus,
  Smile,
  Check,
  Globe,
  Lock,
  Zap,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingItem, Category, ModelFactory, Priority, ValidationError } from '@/lib/models/types';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Emoji picker semplice per le icone
const EMOJI_OPTIONS = [
  '🛒', '📱', '🏠', '👕', '🧴', '🚗', '📚', '⚽', 
  '💊', '🎮', '🍕', '🧽', '💰', '🎨', '🔧', '📦'
];

interface ShoppingItemFormData {
  name?: string;
  link: string;               
  category?: string;          
  createdBy: string;
  completed: boolean;
  priority: Priority;
  estimatedPrice?: number;
  notes?: string;
  isPublic: boolean;
}

interface NewCategoryData {
  name: string;
  icon: string;
  description?: string;
  color: string;
}

interface AddItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: ShoppingItem) => Promise<void>;
  onUpdate: (item: ShoppingItem) => Promise<void>; // NUOVO: per aggiornare dopo scraping
  editItem?: ShoppingItem | null;
}

export function AddItemForm({ isOpen, onClose, onAdd, onUpdate, editItem }: AddItemFormProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  
  const { data: categories, add: addCategory, loading: categoriesLoading } = useFirestore<Category>('categories');

  // URL dell'endpoint di scraping
  const SCRAPING_ENDPOINT = 'https://europe-west1-familytasktracker-c2dfe.cloudfunctions.net/onShoppingItemCreated';

  // Form per il nuovo elemento
  const form = useForm<ShoppingItemFormData>({
    defaultValues: {
      name: '',
      link: '',
      category: '',
      createdBy: user?.username || '',
      completed: false,
      priority: 'medium',
      estimatedPrice: undefined,
      notes: '',
      isPublic: true,
    },
  });

  // Form separato per la nuova categoria
  const [newCategory, setNewCategory] = useState<NewCategoryData>({
    name: '',
    icon: '🏷️',
    description: '',
    color: '#6B7280'
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
        isPublic: editItem.isPublic !== undefined ? editItem.isPublic : true,
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
        isPublic: true,
      });
    }
  }, [editItem, form, user]);

  // NUOVO: Funzione per scraping asincrono DOPO il salvataggio
  const performAsyncScraping = async (url: string, itemId: string) => {
    try {
      console.log(`🔗 Avvio scraping asincrono per: ${url}`);
      
      const response = await fetch(SCRAPING_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url,
          updateFirestore: true,  // Aggiorna direttamente Firestore
          collectionName: 'shopping_items'
        })
      });

      if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ Scraping completato per ${url}:`, result.data);
        
        // Mostra notifica di successo
        toast({
          title: 'Prodotto aggiornato!',
          description: `Informazioni estratte automaticamente per "${result.data.nameProduct}"`,
        });
        
        // NOTA: L'aggiornamento in Firestore è già avvenuto nell'endpoint,
        // quindi il componente si aggiornerà automaticamente tramite useFirestore
        
      } else {
        console.warn('Scraping parzialmente riuscito:', result);
        toast({
          title: 'Scraping completato',
          description: 'Alcuni dati potrebbero non essere stati estratti completamente',
        });
      }
      
    } catch (error) {
      console.error('Errore durante lo scraping asincrono:', error);
      toast({
        title: 'Scraping fallito',
        description: 'Non è stato possibile estrarre automaticamente i dati del prodotto',
        variant: 'destructive',
      });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      toast({
        title: 'Errore',
        description: 'Il nome della categoria è obbligatorio',
        variant: 'destructive',
      });
      return;
    }

    if (categories?.find(c => c.name.toLowerCase() === newCategory.name.toLowerCase())) {
      toast({
        title: 'Errore',
        description: 'Una categoria con questo nome esiste già',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingCategory(true);
    
    try {
      const categoryData = ModelFactory.createCategory({
        id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newCategory.name.trim(),
        createdBy: user?.username || '',
        createdAt: new Date(),
        description: newCategory.description || undefined,
        color: newCategory.color,
        icon: newCategory.icon,
        isDefault: false,
        itemCount: 0
      });

      await addCategory(categoryData);
      
      form.setValue('category', newCategory.name);
      
      setNewCategory({
        name: '',
        icon: '🏷️',
        description: '',
        color: '#6B7280'
      });
      
      setShowNewCategoryForm(false);
      
      toast({
        title: 'Categoria aggiunta',
        description: `La categoria "${newCategory.name}" è stata aggiunta con successo`,
      });
      
    } catch (validationError) {
      if (validationError instanceof ValidationError) {
        toast({
          title: 'Errore di validazione categoria',
          description: validationError.errors.join(', '),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Errore',
          description: 'Impossibile aggiungere la categoria',
          variant: 'destructive',
        });
      }
    } finally {
      setIsAddingCategory(false);
    }
  };

  const onSubmit = async (data: ShoppingItemFormData) => {
    // Validazione URL obbligatorio
    if (!data.link || !data.link.startsWith('http')) {
      toast({
        title: 'URL richiesto',
        description: 'L\'URL del prodotto è obbligatorio e deve iniziare con http:// o https://',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      let shoppingItem: ShoppingItem;
      
      if (editItem) {
        // Modalità modifica
        shoppingItem = editItem;
        try {
          shoppingItem.name = data.name || editItem.name;
          shoppingItem.link = data.link;
          shoppingItem.category = data.category || editItem.category;
          shoppingItem.priority = data.priority;
          shoppingItem.estimatedPrice = data.estimatedPrice;
          shoppingItem.notes = data.notes;
          shoppingItem.isPublic = data.isPublic;
          shoppingItem.updatedAt = new Date();
          
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
        // Modalità creazione - SALVA SUBITO con dati minimi
        try {
          shoppingItem = ModelFactory.createShoppingItem({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            category: data.category || 'Articoli',    // Default se non specificato
            createdBy: data.createdBy,
            link: data.link,
            name: data.name || 'Prodotto',            // Default se non specificato
            createdAt: new Date(),
            completed: data.completed,
            priority: data.priority,
            estimatedPrice: data.estimatedPrice,
            notes: data.notes,
            isPublic: data.isPublic,
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

      // 1. SALVA L'ARTICOLO IMMEDIATAMENTE
      await onAdd(shoppingItem);
      
      toast({
        title: editItem ? 'Articolo aggiornato' : 'Articolo aggiunto',
        description: editItem 
          ? 'Articolo aggiornato con successo!' 
          : 'Articolo aggiunto! Estrazione automatica dei dati in corso...',
      });
      
      // 2. CHIUDI IL DIALOG SUBITO
      onClose();
      form.reset();
      setNewCategory({
        name: '',
        icon: '🏷️',
        description: '',
        color: '#6B7280'
      });
      setShowNewCategoryForm(false);
      
      // 3. AVVIA SCRAPING ASINCRONO SOLO PER NUOVI ELEMENTI
      if (!editItem) {
        // Non aspettare - vai in background
        performAsyncScraping(data.link, shoppingItem.id).catch(error => {
          console.error('Errore scraping asincrono:', error);
        });
      }
      
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
      setShowNewCategoryForm(true);
      return;
    }
    form.setValue('category', value);
  };

  const priorityOptions = [
    { value: 'low' as Priority, label: 'Bassa', color: '#10B981', icon: '⬇️' },
    { value: 'medium' as Priority, label: 'Media', color: '#F59E0B', icon: '➡️' },
    { value: 'high' as Priority, label: 'Alta', color: '#EF4444', icon: '⬆️' },
  ];

  const defaultCategories = [
    { name:"Tutte le categorie",value: 'all', label: 'Tutte le categorie', icon: '🛍️' },
  ];

  const colorOptions = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', 
    '#84CC16', '#22C55E', '#10B981', '#14B8A6',
    '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
    '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'
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
            
            {/* URL Prodotto (obbligatorio) */}
            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    URL Prodotto *
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

            {/* Alert informativo */}
            <Alert className="border-blue-200 bg-blue-50">
              <Zap className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Nuovo!</strong> Dopo il salvataggio, i dati del prodotto verranno estratti automaticamente in background.
              </AlertDescription>
            </Alert>

            {/* Nome Prodotto (opzionale) */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Nome Prodotto (Opzionale)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Inserisci nome prodotto o lascia vuoto per estrazione automatica"
                      maxLength={100}
                      className="text-base"
                    />
                  </FormControl>
                  <p className="text-xs text-gray-500">
                    {(field.value || '').length}/100 caratteri • Se vuoto, verrà estratto automaticamente
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Categoria (opzionale) */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <Tag className="mr-2 h-4 w-4" />
                    Categoria (Opzionale)
                  </FormLabel>
                  
                  <Select onValueChange={handleCategorySelect} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona categoria o lascia vuoto per estrazione automatica" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* Categorie predefinite */}
                      {defaultCategories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center space-x-2">
                            <span>{category.icon}</span>
                            <span>{category.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                      
                      {/* Categorie personalizzate */}
                      {categories?.filter(cat => !defaultCategories.some(def => def.value === cat.name)).map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          <div className="flex items-center space-x-2">
                            <span>{category.icon || '🏷️'}</span>
                            <span>{category.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                      
                      {/* Opzione per aggiungere nuova categoria */}
                      <SelectItem value="new">
                        <div className="flex items-center space-x-2 text-burnt-sienna font-medium">
                          <Plus className="h-4 w-4" />
                          <span>Aggiungi Nuova Categoria</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Form per nuova categoria (stesso di prima) */}
                  {showNewCategoryForm && (
                    <div className="mt-4 p-4 border rounded-lg bg-gray-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Nuova Categoria</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNewCategoryForm(false)}
                        >
                          ✕
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Nome *</label>
                          <Input
                            value={newCategory.name}
                            onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Nome categoria"
                            maxLength={50}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-600">Icona</label>
                          <div className="flex items-center space-x-2">
                            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" className="w-12 h-10">
                                  {newCategory.icon}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2">
                                <div className="grid grid-cols-8 gap-1">
                                  {EMOJI_OPTIONS.map((emoji) => (
                                    <Button
                                      key={emoji}
                                      type="button"
                                      variant="ghost"
                                      className="w-8 h-8 p-0"
                                      onClick={() => {
                                        setNewCategory(prev => ({ ...prev, icon: emoji }));
                                        setEmojiPickerOpen(false);
                                      }}
                                    >
                                      {emoji}
                                    </Button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                            <Input
                              value={newCategory.icon}
                              onChange={(e) => setNewCategory(prev => ({ ...prev, icon: e.target.value }))}
                              placeholder="🏷️"
                              className="w-20"
                              maxLength={2}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-600">Colore</label>
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-6 h-6 rounded border"
                              style={{ backgroundColor: newCategory.color }}
                            />
                            <div className="flex space-x-1">
                              {colorOptions.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={`w-5 h-5 rounded-full border-2 ${newCategory.color === color ? 'border-gray-800' : 'border-gray-300'}`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setNewCategory(prev => ({ ...prev, color }))}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-600">Descrizione (opzionale)</label>
                          <Input
                            value={newCategory.description}
                            onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Breve descrizione"
                            maxLength={100}
                          />
                        </div>

                        <Button
                          type="button"
                          onClick={handleAddCategory}
                          disabled={!newCategory.name.trim() || isAddingCategory}
                          className="w-full"
                          size="sm"
                        >
                          {isAddingCategory ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          {isAddingCategory ? 'Aggiungendo...' : 'Aggiungi Categoria'}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priorità e Prezzo */}
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

            {/* Note */}
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

            {/* Visibilità Pubblica/Privata */}
            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center cursor-pointer">
                      {field.value ? (
                        <>
                          <Globe className="mr-2 h-4 w-4 text-green-600" />
                          Articolo Pubblico
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4 text-orange-600" />
                          Articolo Privato
                        </>
                      )}
                    </FormLabel>
                    <p className="text-xs text-gray-600">
                      {field.value 
                        ? 'Questo articolo sarà visibile a tutti i membri della famiglia'
                        : 'Questo articolo sarà visibile solo a te'
                      }
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Alert se manca URL */}
            {!form.watch('link') && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  L'URL del prodotto è <strong>obbligatorio</strong>. Inserisci un link valido per procedere.
                </AlertDescription>
              </Alert>
            )}

            {/* Pulsanti */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="secondary" 
                onClick={() => { 
                  onClose(); 
                  form.reset(); 
                  setNewCategory({
                    name: '',
                    icon: '🏷️',
                    description: '',
                    color: '#6B7280'
                  });
                  setShowNewCategoryForm(false);
                }} 
                disabled={isLoading}
              >
                Annulla
              </Button>
              <Button 
                type="submit" 
                disabled={
                  isLoading || 
                  !form.watch('link') || 
                  !form.watch('link').startsWith('http')
                }
                className="min-w-[120px]"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                ) : (
                  editItem ? 'Aggiorna' : 'Aggiungi'
                )}
                {isLoading 
                  ? (editItem ? 'Aggiornando...' : 'Aggiungendo...') 
                  : (editItem ? 'Aggiorna' : 'Aggiungi')
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
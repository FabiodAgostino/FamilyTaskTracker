import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { 
  ShoppingCart, 
  Loader2, 
  Link as LinkIcon, 
  Tag, 
  Euro, 
  StickyNote, 
  Plus,
  Check,
  Globe,
  Lock,
  Zap,
  AlertCircle,
  Award,
  Sparkles,
  Save
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
import { Category, ModelFactory, Priority, ValidationError } from '@/lib/models/types';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ShoppingItem } from '@/lib/models/shopping-item';

// Emoji picker semplice per le icone
const EMOJI_OPTIONS = [
  '🛒', '📱', '🏠', '👕', '🧴', '🚗', '📚', '⚽', 
  '💊', '🎮', '🍕', '🧽', '💰', '🎨', '🔧', '📦'
];

interface ShoppingItemFormData {
  name?: string;
  link: string;               
  category?: string;
  brandName?: string;
  createdBy: string;
  completed: boolean;
  priority: Priority;
  estimatedPrice?: number;
  notes?: string;
  isPublic: boolean;
  useAI: boolean;
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
  editItem?: ShoppingItem | null;
}

export function AddItemForm({ isOpen, onClose, onAdd, editItem }: AddItemFormProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  
  // ✅ Hooks Firebase
  const { data: categories, add: addCategory } = useFirestore<Category>('categories');
  const { data: existingItems } = useFirestore<ShoppingItem>('shopping_items');

  // URL dell'endpoint di scraping
  const SCRAPING_ENDPOINT = 'https://europe-west1-familytasktracker-c2dfe.cloudfunctions.net/onShoppingItemCreated';

  // Form per il nuovo elemento
  const form = useForm<ShoppingItemFormData>({
    defaultValues: {
      name: '',
      link: '',
      category: '',
      brandName: '',
      createdBy: user?.username || '',
      completed: false,
      priority: 'medium',
      estimatedPrice: undefined,
      notes: '',
      isPublic: true,
      useAI: true,
    },
  });

  // Form separato per la nuova categoria
  const [newCategory, setNewCategory] = useState<NewCategoryData>({
    name: '',
    icon: '🏷️',
    description: '',
    color: '#6B7280'
  });

  // ✅ NUOVO: Variabile per determinare se usare la vista compatta
  const isCompactMode = !editItem && form.watch('useAI');

  // ✅ Controllo URL duplicati
  const isDuplicateUrl = useMemo(() => {
    const currentUrl = form.watch('link');
    if (!currentUrl || !currentUrl.startsWith('http')) return false;
    
    // Se stiamo modificando, ignora l'elemento corrente
    const itemsToCheck = existingItems?.filter(item => 
      editItem ? item.id !== editItem.id : true
    ) || [];
    
    return itemsToCheck.some(item => item.link === currentUrl);
  }, [form.watch('link'), existingItems, editItem]);

  // ✅ Messaggio di errore per URL duplicato
  const duplicateUrlError = useMemo(() => {
    if (!isDuplicateUrl) return null;
    
    const existingItem = existingItems?.find(item => 
      item.link === form.watch('link') && 
      (editItem ? item.id !== editItem.id : true)
    );
    
    return existingItem 
      ? `Questo URL è già stato aggiunto per "${existingItem.name || 'un altro prodotto'}"` 
      : 'Questo URL è già stato aggiunto';
  }, [isDuplicateUrl, existingItems, form.watch('link'), editItem]);

  useEffect(() => {
    if (editItem) {
      form.reset({
        name: editItem.name,
        link: editItem.link || '',
        category: editItem.category,
        brandName: editItem.brandName || '',
        createdBy: editItem.createdBy,
        completed: editItem.completed,
        priority: editItem.priority,
        estimatedPrice: editItem.estimatedPrice,
        notes: editItem.notes || '',
        isPublic: editItem.isPublic !== undefined ? editItem.isPublic : true,
        useAI: false,
      });
    } else {
      form.reset({
        name: '',
        link: '',
        category: '',
        brandName: '',
        createdBy: user?.username || '',
        completed: false,
        priority: 'medium',
        estimatedPrice: undefined,
        notes: '',
        isPublic: true,
        useAI: true,
      });
    }
  }, [editItem, form, user]);

  // ✅ Funzione per scraping asincrono
  const performAsyncScraping = async (url: string) => {
    try {
      const response = await fetch(SCRAPING_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url,
          updateFirestore: true,
          collectionName: 'shopping_items'
        })
      });

      if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const productName = result.data.nameProduct || result.data.name || 'il prodotto';
        
        toast({
          title: 'Prodotto aggiornato!',
          description: `Informazioni estratte automaticamente per "${productName}"`,
        });
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

  const handleCategorySelect = (value: string) => {
    if (value === 'add_new') {
      setShowNewCategoryForm(true);
    } else {
      form.setValue('category', value);
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
    // Controllo iniziale per evitare submit inutili
    if (!data.link || !data.link.startsWith('http')) {
      if (data.link && data.link.trim().length > 0) {
        toast({
          title: 'URL richiesto',
          description: 'L\'URL del prodotto è obbligatorio e deve iniziare con http:// o https://',
          variant: 'destructive',
        });
      }
      return;
    }

    // Controllo URL duplicato
    if (isDuplicateUrl) {
      toast({
        title: 'URL duplicato',
        description: duplicateUrlError || 'Questo URL è già stato aggiunto',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      let shoppingItem: ShoppingItem;
      
      if (editItem) {
        // MODALITÀ MODIFICA - Mai scraping
        shoppingItem = editItem;
        try {
          shoppingItem.name = data.name || editItem.name;
          shoppingItem.link = data.link;
          shoppingItem.category = data.category || editItem.category;
          shoppingItem.brandName = data.brandName || editItem.brandName;
          shoppingItem.priority = data.priority;
          shoppingItem.estimatedPrice = data.estimatedPrice;
          shoppingItem.notes = data.notes;
          shoppingItem.isPublic = data.isPublic;
          shoppingItem.updatedAt = new Date();
          
          await onAdd(shoppingItem);
          
          toast({
            title: 'Elemento aggiornato',
            description: 'Le modifiche sono state salvate con successo!',
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
      } else {
        // MODALITÀ INSERIMENTO - Scraping basato su switch
        try {
          const scrapingData = data.useAI ? {
            lastScraped: new Date(),
            scrapingMode: 'pending',
            scrapingSuccess: false,
            scrapingText: undefined,
            errors: undefined
          } : undefined;

          shoppingItem = ModelFactory.createShoppingItem({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            category: data.category || 'Articoli',
            createdBy: data.createdBy,
            link: data.link,
            name: data.name,
            brandName: data.brandName,
            completed: data.completed,
            priority: data.priority,
            estimatedPrice: data.estimatedPrice,
            notes: data.notes,
            isPublic: data.isPublic,
            createdAt: new Date(),
            updatedAt: new Date(),
            scrapingData: scrapingData
          });

          await onAdd(shoppingItem);
          
          // Scraping asincrono basato su switch
          if (data.useAI) {
            performAsyncScraping(data.link);
            
            toast({
              title: 'Elemento aggiunto!',
              description: 'Analisi AI in corso...',
            });
          } else {
            toast({
              title: 'Elemento aggiunto!',
              description: 'Elemento salvato senza analisi AI.',
            });
          }
          
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

      // Reset form e chiudi modal
      form.reset();
      setNewCategory({
        name: '',
        icon: '🏷️',
        description: '',
        color: '#6B7280'
      });
      setShowNewCategoryForm(false);
      onClose();
      
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile salvare l\'elemento',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${
        isCompactMode ? 'sm:max-w-md' : 'sm:max-w-2xl'
      }`}>
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl text-delft-blue">
            <ShoppingCart className="mr-3 h-6 w-6" />
            {editItem ? 'Modifica Articolo' : isCompactMode ? 'Aggiungi con AI' : 'Aggiungi Articolo'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* URL Prodotto (sempre presente) */}
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
                      className="text-base"
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

            {/* Switch Analisi AI (solo in modalità inserimento) */}
            {!editItem && (
              <FormField
                control={form.control}
                name="useAI"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 dark:border-gray-700">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center text-gray-900 dark:text-gray-100">
                        {field.value ? (
                          <>
                            <Zap className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                            Analisi AI Attiva
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4 text-gray-600 dark:text-gray-400" />
                            Inserimento Manuale
                          </>
                        )}
                      </FormLabel>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {field.value 
                          ? 'I dati del prodotto verranno estratti automaticamente'
                          : 'Inserimento rapido senza analisi automatica'
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
            )}

            {/* Switch visibilità (sempre presente) */}
            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center">
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

            {/* CAMPI COMPLETI (solo se NON è modalità compatta AI) */}
            {!isCompactMode && (
              <>
                {/* Nome Prodotto */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-delft-blue">
                        Nome Prodotto
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
                        {(field.value || '').length}/100 caratteri
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Campo Brand */}
                <FormField
                  control={form.control}
                  name="brandName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                        <Award className="mr-2 h-4 w-4" />
                        Brand
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Inserisci il brand del prodotto"
                          maxLength={50}
                          className="text-base"
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500">
                        {(field.value || '').length}/50 caratteri
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Categoria */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                        <Tag className="mr-2 h-4 w-4" />
                        Categoria
                      </FormLabel>
                      
                      <Select onValueChange={handleCategorySelect} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              <div className="flex items-center">
                                <span className="mr-2">{category.icon || '🏷️'}</span>
                                <span>{category.name}</span>
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {category.itemCount}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                          
                          <SelectItem value="add_new">
                            <div className="flex items-center text-cambridge-newStyle">
                              <Plus className="mr-2 h-4 w-4" />
                              <span>Aggiungi nuova categoria</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Form per nuova categoria */}
                {showNewCategoryForm && (
                  <div className="p-4 border border-cambridge-newStyle/20 rounded-lg bg-cambridge-newStyle/5">
                    <h4 className="font-medium text-delft-blue mb-3 flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      Nuova Categoria
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Nome *</label>
                        <Input
                          value={newCategory.name}
                          onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Nome categoria"
                          maxLength={50}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700">Icona</label>
                        <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <span className="mr-2">{newCategory.icon}</span>
                              Seleziona icona
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64">
                            <div className="grid grid-cols-8 gap-2">
                              {EMOJI_OPTIONS.map((emoji) => (
                                <Button
                                  key={emoji}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setNewCategory(prev => ({ ...prev, icon: emoji }));
                                    setEmojiPickerOpen(false);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  {emoji}
                                </Button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">Descrizione</label>
                        <Input
                          value={newCategory.description}
                          onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Descrizione opzionale"
                          maxLength={100}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700">Colore</label>
                        <Input
                          type="color"
                          value={newCategory.color}
                          onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                          className="h-10"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewCategoryForm(false)}
                        disabled={isAddingCategory}
                      >
                        Annulla
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddCategory}
                        disabled={isAddingCategory || !newCategory.name.trim()}
                      >
                        {isAddingCategory ? (
                          <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        {isAddingCategory ? 'Aggiungendo...' : 'Aggiungi'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Priorità */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-delft-blue">
                        Priorità
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona priorità" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                              Bassa
                            </div>
                          </SelectItem>
                          <SelectItem value="medium">
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                              Media
                            </div>
                          </SelectItem>
                          <SelectItem value="high">
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                              Alta
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Prezzo stimato */}
                <FormField
                  control={form.control}
                  name="estimatedPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                        <Euro className="mr-2 h-4 w-4" />
                        Prezzo Stimato (€)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          placeholder="Aggiungi note o dettagli aggiuntivi..."
                          rows={3}
                          maxLength={500}
                        />
                        </FormControl>
                      <p className="text-xs text-gray-500">
                        {(field.value || '').length}/500 caratteri
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Alert URL duplicato (sempre presente) */}
            {isDuplicateUrl && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>URL duplicato!</strong> {duplicateUrlError}
                </AlertDescription>
              </Alert>
            )}

            {/* Alert se manca URL (sempre presente) */}
            {!form.watch('link') && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  L'URL del prodotto è <strong>obbligatorio</strong>. Inserisci un link valido per procedere.
                </AlertDescription>
              </Alert>
            )}

            {/* Alert informativo per modalità AI compatta */}
            {isCompactMode && (
              <Alert className="border-blue-200 bg-blue-50">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Modalità AI attiva:</strong> Nome, categoria, brand e prezzo verranno estratti automaticamente dall'URL. 
                  {form.watch('link') && ' Puoi modificare questi dettagli dopo l\'inserimento.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Pulsanti di azione */}
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
                  !form.watch('link').startsWith('http') ||
                  isDuplicateUrl
                }
                className={`min-w-[140px] ${
                  isCompactMode
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' 
                    : ''
                }`}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                ) : isCompactMode ? (
                  <Zap className="h-5 w-5 mr-2" />
                ) : (
                  <Save className="h-5 w-5 mr-2" />
                )}
                {isLoading 
                  ? (editItem ? 'Aggiornando...' : 'Salvando...') 
                  : editItem 
                    ? 'Aggiorna' 
                    : isCompactMode 
                      ? 'Salva con AI' 
                      : 'Salva'
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
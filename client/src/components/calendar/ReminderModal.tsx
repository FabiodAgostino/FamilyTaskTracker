import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Globe, Lock, Calendar as CalendarIcon, Bell, Clock, Plus, X, Trash2, Repeat, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addHours, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Tipi temporanei - sostituire con il modello Reminder
interface ReminderFormData {
  title: string;
  message: string;
  scheduledTime: Date;
  createdBy: string;
  isActive: boolean;
  isPublic: boolean;
  isRecurring: boolean;
  reminderType: 'personal' | 'family' | 'work' | 'health' | 'shopping' | 'event' | 'other';
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  notes?: string;
  recurrencePattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
    maxOccurrences?: number;
  };
}

interface Reminder {
  id: string;
  title: string;
  message: string;
  scheduledTime: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isPublic: boolean;
  isRecurring: boolean;
  reminderType: 'personal' | 'family' | 'work' | 'health' | 'shopping' | 'event' | 'other';
  priority: 'low' | 'medium' | 'high';
  notificationSent: boolean;
  tags?: string[];
  notes?: string;
  snoozeUntil?: Date;
  completedAt?: Date;
  recurrencePattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
    maxOccurrences?: number;
  };
}

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: ReminderFormData) => Promise<void>;
  onDelete?: (reminderId: string) => Promise<void>;
  editReminder?: Reminder | null;
}

export function ReminderModal({ isOpen, onClose, onSave, onDelete, editReminder }: ReminderModalProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Tipi di promemoria con colori e icone
  const reminderTypes = [
    { value: 'personal' as const, label: 'Personale', color: '#81B29A', icon: '👤' },
    { value: 'family' as const, label: 'Famiglia', color: '#E07A5F', icon: '👨‍👩‍👧‍👦' },
    { value: 'work' as const, label: 'Lavoro', color: '#3D405B', icon: '💼' },
    { value: 'health' as const, label: 'Salute', color: '#F4A261', icon: '🏥' },
    { value: 'shopping' as const, label: 'Shopping', color: '#2A9D8F', icon: '🛒' },
    { value: 'event' as const, label: 'Evento', color: '#E76F51', icon: '🎉' },
    { value: 'other' as const, label: 'Altro', color: '#6C757D', icon: '📝' },
  ];

  // Quick time presets
  const quickTimes = [
    { label: 'Tra 15 minuti', minutes: 15 },
    { label: 'Tra 30 minuti', minutes: 30 },
    { label: 'Tra 1 ora', minutes: 60 },
    { label: 'Tra 2 ore', minutes: 120 },
    { label: 'Domani mattina', hours: 24, setTime: '09:00' },
    { label: 'Domani sera', hours: 24, setTime: '20:00' },
  ];

  const form = useForm<ReminderFormData>({
    defaultValues: {
      title: '',
      message: '',
      scheduledTime: addHours(new Date(), 1), // Default: tra 1 ora
      createdBy: user?.username || '',
      isActive: true,
      isPublic: false,
      isRecurring: false,
      reminderType: 'personal',
      priority: 'medium',
      tags: [],
      notes: '',
    },
  });

  const watchedIsRecurring = form.watch('isRecurring');

  // Controllo permessi per delete
  const canDelete = editReminder && (user?.username === editReminder.createdBy || user?.role === 'admin');

  // Reset form quando cambia promemoria
  useEffect(() => {
    if (isOpen) {
      if (editReminder) {
        form.reset({
          title: editReminder.title,
          message: editReminder.message,
          scheduledTime: editReminder.scheduledTime,
          createdBy: editReminder.createdBy,
          isActive: editReminder.isActive,
          isPublic: editReminder.isPublic,
          isRecurring: editReminder.isRecurring,
          reminderType: editReminder.reminderType,
          priority: editReminder.priority,
          tags: editReminder.tags || [],
          notes: editReminder.notes || '',
          recurrencePattern: editReminder.recurrencePattern,
        });
      } else {
        const defaultTime = addHours(new Date(), 1);
        form.reset({
          title: '',
          message: '',
          scheduledTime: defaultTime,
          createdBy: user?.username || '',
          isActive: true,
          isPublic: false,
          isRecurring: false,
          reminderType: 'personal',
          priority: 'medium',
          tags: [],
          notes: '',
        });
      }
      setTagInput('');
    }
  }, [editReminder, form, user, isOpen]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      form.reset();
      setTagInput('');
    }, 150);
  };

  // Funzione delete con conferma
  const handleDelete = async () => {
    if (!editReminder || !onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(editReminder.id);
      toast({
        title: 'Promemoria eliminato',
        description: 'Il promemoria è stato eliminato con successo!',
      });
      handleClose();
    } catch (error) {
      console.error('Errore nell\'eliminare il promemoria:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare il promemoria',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (data: ReminderFormData) => {
    if (!data.title.trim()) {
      toast({
        title: 'Errore',
        description: 'Il titolo del promemoria è obbligatorio',
        variant: 'destructive',
      });
      return;
    }

    if (!data.message.trim()) {
     data.message="Non specificato";
    }

    if (data.scheduledTime <= new Date()) {
      toast({
        title: 'Errore',
        description: 'L\'orario del promemoria deve essere nel futuro',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const reminderData = {
        ...data,
        title: data.title.trim(),
        message: data.message.trim(),
        notes: data.notes?.trim(),
        tags: data.tags.filter(tag => tag.trim() !== ''),
        updatedAt: new Date(),
      };

      await onSave(reminderData);
      handleClose();
    } catch (error) {
      console.error('Errore nel salvare il promemoria:', error);
      toast({
        title: 'Errore',
        description: editReminder ? 'Impossibile aggiornare il promemoria' : 'Impossibile creare il promemoria',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Quick time handlers
  const handleQuickTime = (preset: typeof quickTimes[0]) => {
    const now = new Date();
    let newTime: Date;

    if (preset.setTime) {
      // Imposta orario specifico (es. domani mattina alle 09:00)
      newTime = addHours(now, preset.hours || 0);
      const [hours, minutes] = preset.setTime.split(':');
      newTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else if (preset.hours) {
      newTime = addHours(now, preset.hours);
    } else {
      newTime = addMinutes(now, preset.minutes || 0);
    }

    form.setValue('scheduledTime', newTime);
  };

  // Tag management
  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag) {
      const currentTags = form.getValues('tags');
      if (!currentTags.includes(trimmedTag) && currentTags.length < 10) {
        form.setValue('tags', [...currentTags, trimmedTag]);
        setTagInput('');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags');
    form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && tagInput === '' && form.getValues('tags').length > 0) {
      const tags = form.getValues('tags');
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-delft-blue flex items-center">
              {editReminder ? (
                <>
                  <Bell className="mr-3 h-6 w-6 text-burnt-newStyle" />
                  Modifica Promemoria
                </>
              ) : (
                <>
                  <Plus className="mr-3 h-6 w-6 text-burnt-newStyle" />
                  Crea Nuovo Promemoria
                </>
              )}
            </DialogTitle>
            
            {/* Pulsante Delete in alto a destra */}
            {editReminder && canDelete && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    disabled={isLoading || isDeleting}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sei sicuro di voler eliminare il promemoria "{editReminder.title}"? 
                      Questa azione non può essere annullata.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Annulla
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Eliminando...
                        </>
                      ) : (
                        'Elimina'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Titolo */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Titolo Promemoria *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Es. Prendere le medicine, Chiamare il medico..."
                      maxLength={100}
                      className="text-lg"
                    />
                  </FormControl>
                  <div className="text-xs text-gray-500 mt-1">
                    {field.value?.length || 0}/100 caratteri
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Messaggio */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Messaggio *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Descrivi cosa devi ricordare..."
                      rows={3}
                      maxLength={500}
                      className="resize-y"
                    />
                  </FormControl>
                  <div className="text-xs text-gray-500 mt-1">
                    {field.value?.length || 0}/500 caratteri
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quick Time Presets */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-delft-blue">
                Scorciatoie Tempo
              </label>
              <div className="flex flex-wrap gap-2">
                {quickTimes.map((preset, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickTime(preset)}
                    className="text-xs"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Data e Ora Programmata */}
            <FormField
              control={form.control}
              name="scheduledTime"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Data e Ora Promemoria *
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP 'alle' p", { locale: it })
                          ) : (
                            <span>Seleziona data e ora</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          if (date) {
                            const newDate = new Date(date);
                            const currentTime = field.value;
                            if (currentTime) {
                              newDate.setHours(currentTime.getHours(), currentTime.getMinutes());
                            }
                            field.onChange(newDate);
                          }
                        }}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                      <div className="p-3 border-t">
                        <Input
                          type="time"
                          value={field.value ? format(field.value, "HH:mm") : ""}
                          onChange={(e) => {
                            if (field.value && e.target.value) {
                              const [hours, minutes] = e.target.value.split(':');
                              const newDate = new Date(field.value);
                              newDate.setHours(parseInt(hours), parseInt(minutes));
                              field.onChange(newDate);
                            }
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo e Priorità */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reminderType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-delft-blue">
                      Tipo di Promemoria
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona il tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {reminderTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center space-x-3">
                              <span className="text-lg">{type.icon}</span>
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: type.color }}
                              />
                              <span className="font-medium">{type.label}</span>
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-delft-blue">
                      Priorità
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona priorità" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span>Bassa</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <span>Media</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span>Alta</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-delft-blue">
                Tag {form.watch('tags').length > 0 && 
                  <span className="text-xs text-gray-500">({form.watch('tags').length}/10)</span>
                }
              </label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Aggiungi tag per organizzare..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyPress}
                  className="flex-1"
                  disabled={form.watch('tags').length >= 10}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTag}
                  disabled={!tagInput.trim() || form.watch('tags').length >= 10}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {form.watch('tags').length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.watch('tags').map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-cambridge-newStyle/10 text-cambridge-newStyle px-3 py-1 border border-cambridge-newStyle/20"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-cambridge-newStyle hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Note aggiuntive */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Note Aggiuntive
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Note o dettagli aggiuntivi (opzionale)..."
                      rows={2}
                      className="resize-y"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ricorrenza */}
            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center cursor-pointer">
                      <Repeat className="mr-2 h-4 w-4" />
                      Promemoria Ricorrente
                    </FormLabel>
                    <p className="text-xs text-gray-600">
                      Il promemoria si ripeterà automaticamente
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

            {/* Opzioni ricorrenza */}
            {watchedIsRecurring && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <Repeat className="h-4 w-4" />
                  Configurazione Ricorrenza
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="recurrencePattern.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Frequenza</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || 'daily'}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona frequenza" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Giornaliera</SelectItem>
                            <SelectItem value="weekly">Settimanale</SelectItem>
                            <SelectItem value="monthly">Mensile</SelectItem>
                            <SelectItem value="yearly">Annuale</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recurrencePattern.interval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Ogni</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString() || '1'}>
                          <SelectTrigger>
                            <SelectValue placeholder="Intervallo" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                              <SelectItem key={num} value={num.toString()}>
                                {num} {
                                  form.watch('recurrencePattern.type') === 'daily' ? (num === 1 ? 'giorno' : 'giorni') :
                                  form.watch('recurrencePattern.type') === 'weekly' ? (num === 1 ? 'settimana' : 'settimane') :
                                  form.watch('recurrencePattern.type') === 'monthly' ? (num === 1 ? 'mese' : 'mesi') :
                                  (num === 1 ? 'anno' : 'anni')
                                }
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <p className="text-xs text-yellow-800">
                    I promemoria ricorrenti creeranno automaticamente nuove istanze secondo la frequenza impostata.
                  </p>
                </div>
              </div>
            )}

            {/* Visibilità */}
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
                          Promemoria Pubblico
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4 text-orange-600" />
                          Promemoria Privato
                        </>
                      )}
                    </FormLabel>
                    <p className="text-xs text-gray-600">
                      {field.value 
                        ? 'Questo promemoria sarà visibile a tutti i membri della famiglia'
                        : 'Questo promemoria sarà visibile solo a te'
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

            {/* Pulsanti Azione */}
            <div className="flex gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isLoading || isDeleting}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isDeleting}
                className="flex-1 bg-burnt-newStyle hover:bg-burnt-newStyle/90 text-white font-semibold"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editReminder ? 'Aggiorna Promemoria' : 'Crea Promemoria'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
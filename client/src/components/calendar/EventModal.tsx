import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Globe, Lock, Calendar as CalendarIcon, MapPin, Clock, Plus, Trash2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CalendarEvent, ModelFactory, ValidationError, EventType } from '@/lib/models/types';

interface EventFormData {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  isPublic: boolean;
  createdBy: string;
  eventType: EventType;
  color: string;
  location?: string;
  attendees: string[];
  reminderMinutes?: number; // NUOVO CAMPO
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>; // Aggiunta funzione delete
  editEvent?: CalendarEvent | null;
  selectedDate?: Date;
}

export function EventModal({ isOpen, onClose, onSave, onDelete, editEvent, selectedDate }: EventModalProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // Stato per delete
  const [attendeeInput, setAttendeeInput] = useState('');

  // Tipi di evento tradotti in italiano
  const eventTypes = [
    { value: 'personal' as EventType, label: 'Personale', color: '#81B29A', icon: '👤' },
    { value: 'family' as EventType, label: 'Famiglia', color: '#E07A5F', icon: '👨‍👩‍👧‍👦' },
    { value: 'work' as EventType, label: 'Lavoro', color: '#3D405B', icon: '💼' },
    { value: 'appointment' as EventType, label: 'Appuntamento', color: '#F4A261', icon: '📅' },
  ];

 const form = useForm<EventFormData>({
  defaultValues: {
    title: '',
    description: '',
    startDate: selectedDate || new Date(),
    endDate: selectedDate || new Date(),
    isAllDay: false,
    isPublic: false,
    createdBy: user?.username || '',
    eventType: 'personal',
    color: '#E07A5F',
    location: '',
    attendees: [],
    reminderMinutes: undefined, // NUOVO CAMPO
  },
});

  const watchedStartDate = form.watch('startDate');
  const watchedIsAllDay = form.watch('isAllDay');

  // Controllo permessi per delete
  const canDelete = editEvent && (user?.username === editEvent.createdBy || user?.role === 'admin');

  // Reset form quando cambia evento o data selezionata
  useEffect(() => {
    if (isOpen) {
      if (editEvent) {
        form.reset({
          title: editEvent.title,
          description: editEvent.description || '',
          startDate: editEvent.startDate,
          endDate: editEvent.endDate,
          isAllDay: editEvent.isAllDay,
          isPublic: editEvent.isPublic,
          createdBy: editEvent.createdBy,
          eventType: editEvent.eventType,
          color: editEvent.color,
          location: editEvent.location || '',
          attendees: editEvent.attendees || [],
          reminderMinutes: editEvent.reminderMinutes || undefined, // NUOVO CAMPO
        });
              } else {
        const defaultDate = selectedDate || new Date();
        const endDate = new Date(defaultDate);
        endDate.setHours(defaultDate.getHours() + 1);
        
        form.reset({
          title: '',
          description: '',
          startDate: defaultDate,
          endDate: endDate,
          isAllDay: false,
          isPublic: false,
          createdBy: user?.username || '',
          eventType: 'personal',
          color: '#E07A5F',
          location: '',
          attendees: [],
          reminderMinutes: undefined
        });
      }
      setAttendeeInput('');
    }
  }, [editEvent, selectedDate, form, user, isOpen]);

  // Aggiusta automaticamente la data di fine quando cambia quella di inizio
  useEffect(() => {
    const currentEndDate = form.getValues('endDate');
    if (watchedStartDate && currentEndDate <= watchedStartDate) {
      const newEndDate = new Date(watchedStartDate);
      newEndDate.setHours(watchedStartDate.getHours() + 1);
      form.setValue('endDate', newEndDate);
    }
  }, [watchedStartDate, form]);

  // Aggiusta automaticamente gli orari per eventi giornata intera
  useEffect(() => {
    if (watchedIsAllDay) {
      const startDate = new Date(form.getValues('startDate'));
      const endDate = new Date(form.getValues('endDate'));
      
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      form.setValue('startDate', startDate);
      form.setValue('endDate', endDate);
    }
  }, [watchedIsAllDay, form]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      form.reset();
      setAttendeeInput('');
    }, 150);
  };

  // Funzione delete con conferma
  const handleDelete = async () => {
    if (!editEvent || !onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(editEvent.id);
      toast({
        title: 'Evento eliminato',
        description: 'L\'evento è stato eliminato con successo!',
      });
      handleClose();
    } catch (error) {
      console.error('Errore nell\'eliminare l\'evento:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare l\'evento',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (data: EventFormData) => {
    if (!data.title.trim()) {
      toast({
        title: 'Errore',
        description: 'Il titolo dell\'evento è obbligatorio',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const eventData = {
        ...data,
        title: data.title.trim(),
        description: data.description?.trim(),
        location: data.location?.trim(),
        attendees: data.attendees.filter(a => a.trim() !== ''),
      };

      let calendarEvent: CalendarEvent;
      
      if (editEvent) {
        calendarEvent = editEvent;
        try {
          calendarEvent.title = eventData.title;
          calendarEvent.description = eventData.description;
          calendarEvent.updateDates(eventData.startDate, eventData.endDate);
          calendarEvent.isAllDay = eventData.isAllDay;
          calendarEvent.isPublic = eventData.isPublic;
          calendarEvent.eventType = eventData.eventType;
          calendarEvent.color = eventData.color;
          calendarEvent.location = eventData.location;
          calendarEvent.attendees = eventData.attendees;
          calendarEvent.updatedAt = new Date();
          calendarEvent.reminderMinutes = eventData.reminderMinutes;
          
          calendarEvent.validate();
          
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Errore di Validazione',
              description: validationError.errors.join(', '),
              variant: 'destructive',
            });
            return;
          }
          throw validationError;
        }
      } else {
        try {
          calendarEvent = ModelFactory.createCalendarEvent({
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: eventData.title,
            description: eventData.description,
            startDate: eventData.startDate,
            endDate: eventData.endDate,
            isAllDay: eventData.isAllDay,
            isPublic: eventData.isPublic,
            createdBy: eventData.createdBy,
            eventType: eventData.eventType,
            color: eventData.color,
            location: eventData.location,
            attendees: eventData.attendees,
            reminderMinutes: eventData.reminderMinutes
          });
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Errore di Validazione',
              description: validationError.errors.join(', '),
              variant: 'destructive',
            });
            return;
          }
          throw validationError;
        }
      }

      await onSave(calendarEvent);
      
      toast({
        title: editEvent ? 'Evento aggiornato' : 'Evento creato',
        description: editEvent ? 'L\'evento è stato aggiornato con successo!' : 'L\'evento è stato creato con successo!',
      });
      
      handleClose();
    } catch (error) {
      console.error('Errore nel salvare l\'evento:', error);
      toast({
        title: 'Errore',
        description: editEvent ? 'Impossibile aggiornare l\'evento' : 'Impossibile creare l\'evento',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventTypeChange = (eventType: string) => {
    const type = eventTypes.find(t => t.value === eventType);
    if (type) {
      form.setValue('eventType', eventType as EventType);
      form.setValue('color', type.color);
    }
  };

    const handleSetReminder = (reminder: string) => {
    const value = reminder === 'none' ? undefined : parseInt(reminder);
    if(value)
    {
      form.setValue('reminderMinutes',value);
      var startDate=form.getValues("startDate");

      var dateReminder = new Date();
      dateReminder.setMinutes(new Date().getMinutes()+value)
      if(startDate<=dateReminder)
      {
        var newDate = new Date(dateReminder);
        newDate.setMinutes(newDate.getMinutes()+value);
        form.setValue("startDate",newDate);
        toast({
        title: 'Ora inizio cambiata',
        description: 'Ho spostato di '+value+" minuti l'ora inizio per adattare il promemoria.",
      });
      }
    }
  };

  const _addAttendee = () => {
    const trimmedAttendee = attendeeInput.trim();
    if (trimmedAttendee) {
      const currentAttendees = form.getValues('attendees');
      if (!currentAttendees.includes(trimmedAttendee) && currentAttendees.length < 20) {
        form.setValue('attendees', [...currentAttendees, trimmedAttendee]);
        setAttendeeInput('');
      }
    }
  };

  const _removeAttendee = (attendeeToRemove: string) => {
    const currentAttendees = form.getValues('attendees');
    form.setValue('attendees', currentAttendees.filter(a => a !== attendeeToRemove));
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-delft-blue flex items-center">
              {editEvent ? (
                <>
                  <CalendarIcon className="mr-3 h-6 w-6 text-burnt-newStyle" />
                  Modifica Evento
                </>
              ) : (
                <>
                  <Plus className="mr-3 h-6 w-6 text-burnt-newStyle" />
                  Crea Nuovo Evento
                </>
              )}
            </DialogTitle>
            
            {/* Pulsante Delete in alto a destra */}
            {editEvent && canDelete && onDelete && (
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
                      Sei sicuro di voler eliminare l'evento "{editEvent.title}"? 
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
                    Titolo Evento *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Inserisci il titolo dell'evento..."
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

            {/* Descrizione */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Descrizione
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Descrizione dell'evento (opzionale)..."
                      rows={4}
                      className="resize-y"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Evento giornata intera */}
            <FormField
              control={form.control}
              name="isAllDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center cursor-pointer">
                      <Clock className="mr-2 h-4 w-4" />
                      Evento Giornata Intera
                    </FormLabel>
                    <p className="text-xs text-gray-600">
                      L'evento dura tutto il giorno
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

            {/* Date e Orari */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium text-delft-blue">
                      Data e Ora Inizio
                    </FormLabel>
                        <Calendar
                          mode="single"
                          selected={field.value}
                          isAllDay={watchedIsAllDay}
                          minTime={new Date()}
                          onSelect={(date: Date | undefined) => {
                            if (date) {
                              if (!watchedIsAllDay) {
                                const newDate = new Date(date);
                                field.onChange(newDate);
                              } else {
                                field.onChange(date);
                              }
                              console.log(field)

                            }
                          }}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium text-delft-blue">
                      Data e Ora Fine
                    </FormLabel>
                        <Calendar
                          mode="single"
                          selected={field.value}
                          isAllDay={watchedIsAllDay}
                          minTime={new Date()}
                          onSelect={(date: Date | undefined) => {
                            if (date) {
                              if (!watchedIsAllDay) {
                                const newDate = new Date(date);
                                field.onChange(newDate);
                              } else {
                                field.onChange(date);
                              }
                            }
                          }}
                          disabled={(date) => {
                            const startDate = form.getValues('startDate');
                            return date < startDate;
                          }}
                          initialFocus
                        />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tipo Evento */}
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Tipo di Evento
                  </FormLabel>
                  <Select 
                    onValueChange={handleEventTypeChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona il tipo di evento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {eventTypes.map((type) => (
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

            {/* Campo Notifica - NUOVO */}
            <FormField
              control={form.control}
              name="reminderMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <Bell className="mr-2 h-4 w-4" />
                    Notifica Prima dell'Evento
                  </FormLabel>
                  <Select 
                    onValueChange={handleSetReminder}
                    value={field.value?.toString() || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona quando ricevere la notifica" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nessuna notifica</SelectItem>
                      <SelectItem value="5">5 minuti prima</SelectItem>
                      <SelectItem value="15">15 minuti prima</SelectItem>
                      <SelectItem value="30">30 minuti prima</SelectItem>
                      <SelectItem value="60">1 ora prima</SelectItem>
                      <SelectItem value="120">2 ore prima</SelectItem>
                      <SelectItem value="1440">1 giorno prima</SelectItem>
                      <SelectItem value="10080">1 settimana prima</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Luogo */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <MapPin className="mr-2 h-4 w-4" />
                    Luogo (Opzionale)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Inserisci il luogo dell'evento..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                          Evento Pubblico
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4 text-orange-600" />
                          Evento Privato
                        </>
                      )}
                    </FormLabel>
                    <p className="text-xs text-gray-600">
                      {field.value 
                        ? 'Questo evento sarà visibile a tutti i membri della famiglia'
                        : 'Questo evento sarà visibile solo a te'
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
                {editEvent ? 'Aggiorna Evento' : 'Crea Evento'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
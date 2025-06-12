import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Globe, Lock, Calendar as CalendarIcon, MapPin, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarEvent, ModelFactory, ValidationError, EventType } from '@/lib/models/types';

// Tipo semplice per il form - la validazione è gestita dalle classi
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
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => Promise<void>;
  editEvent?: CalendarEvent | null;
  selectedDate?: Date;
}

export function EventModal({ isOpen, onClose, onSave, editEvent, selectedDate }: EventModalProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [attendeeInput, setAttendeeInput] = useState('');

  const eventTypes = [
    { value: 'personal' as EventType, label: 'Personal', color: '#81B29A', icon: '👤' },
    { value: 'family' as EventType, label: 'Family', color: '#E07A5F', icon: '👨‍👩‍👧‍👦' },
    { value: 'work' as EventType, label: 'Work', color: '#3D405B', icon: '💼' },
    { value: 'appointment' as EventType, label: 'Appointment', color: '#F4A261', icon: '📅' },
    { value: 'reminder' as EventType, label: 'Reminder', color: '#2A9D8F', icon: '⏰' },
  ];

  const form = useForm<EventFormData>({
    // Nessun resolver - la validazione è gestita dalle classi
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
    },
  });

  // Watch per gestire la sincronizzazione delle date
  const watchedStartDate = form.watch('startDate');
  const watchedIsAllDay = form.watch('isAllDay');

  useEffect(() => {
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
      });
    } else {
      const defaultDate = selectedDate || new Date();
      const endDate = new Date(defaultDate);
      endDate.setHours(defaultDate.getHours() + 1); // Default 1 hour duration
      
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
      });
    }
  }, [editEvent, selectedDate, form, user]);

  // Auto-adjust end date when start date changes
  useEffect(() => {
    const currentEndDate = form.getValues('endDate');
    if (watchedStartDate && currentEndDate <= watchedStartDate) {
      const newEndDate = new Date(watchedStartDate);
      newEndDate.setHours(watchedStartDate.getHours() + 1);
      form.setValue('endDate', newEndDate);
    }
  }, [watchedStartDate, form]);

  // Auto-adjust times for all-day events
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

  const onSubmit = async (data: EventFormData) => {
    setIsLoading(true);
    
    try {
      let calendarEvent: CalendarEvent;
      
      if (editEvent) {
        // Aggiornamento evento esistente
        calendarEvent = editEvent;
        try {
          // Usa i metodi della classe che includono validazione automatica
          calendarEvent.title = data.title;
          calendarEvent.description = data.description;
          calendarEvent.updateDates(data.startDate, data.endDate);
          calendarEvent.isAllDay = data.isAllDay;
          calendarEvent.isPublic = data.isPublic;
          calendarEvent.eventType = data.eventType;
          calendarEvent.color = data.color;
          calendarEvent.location = data.location;
          calendarEvent.attendees = data.attendees;
          calendarEvent.updatedAt = new Date();
          
          // Ri-valida l'intero oggetto dopo le modifiche
          calendarEvent.validate();
          
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Validation Error',
              description: validationError.errors.join(', '),
              variant: 'destructive',
            });
            return;
          }
          throw validationError;
        }
      } else {
        // Creazione nuovo evento usando ModelFactory (con validazione automatica)
        try {
          calendarEvent = ModelFactory.createCalendarEvent({
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: data.title,
            description: data.description,
            startDate: data.startDate,
            endDate: data.endDate,
            isAllDay: data.isAllDay,
            isPublic: data.isPublic,
            createdBy: data.createdBy,
            eventType: data.eventType,
            color: data.color,
            location: data.location,
            attendees: data.attendees,
          });
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Validation Error',
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
        title: editEvent ? 'Event updated' : 'Event created',
        description: editEvent ? 'Event updated successfully!' : 'Event created successfully!',
      });
      
      onClose();
      form.reset();
      setAttendeeInput('');
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: editEvent ? 'Failed to update event' : 'Failed to create event',
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

  const addAttendee = () => {
    if (attendeeInput.trim()) {
      const currentAttendees = form.getValues('attendees');
      if (!currentAttendees.includes(attendeeInput.trim())) {
        form.setValue('attendees', [...currentAttendees, attendeeInput.trim()]);
        setAttendeeInput('');
      }
    }
  };

  const removeAttendee = (attendeeToRemove: string) => {
    const currentAttendees = form.getValues('attendees');
    form.setValue('attendees', currentAttendees.filter(a => a !== attendeeToRemove));
  };

  const handleAttendeeInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAttendee();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-delft-blue">
            {editEvent ? 'Edit Event' : 'Add Event'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Event Title *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Enter event title"
                      maxLength={100}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Event description (optional)"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isAllDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                      <Clock className="mr-2 h-4 w-4" />
                      All Day Event
                    </FormLabel>
                    <p className="text-sm text-gray-600">
                      Event lasts the entire day
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium text-delft-blue">Start Date & Time</FormLabel>
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
                              format(field.value, watchedIsAllDay ? "PPP" : "PPP p")
                            ) : (
                              <span>Pick a date</span>
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
                              if (!watchedIsAllDay) {
                                // Preserve time for non-all-day events
                                const newDate = new Date(date);
                                const currentTime = field.value;
                                if (currentTime) {
                                  newDate.setHours(currentTime.getHours(), currentTime.getMinutes());
                                }
                                field.onChange(newDate);
                              } else {
                                field.onChange(date);
                              }
                            }
                          }}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                        {!watchedIsAllDay && (
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
                        )}
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium text-delft-blue">End Date & Time</FormLabel>
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
                              format(field.value, watchedIsAllDay ? "PPP" : "PPP p")
                            ) : (
                              <span>Pick a date</span>
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
                              if (!watchedIsAllDay) {
                                // Preserve time for non-all-day events
                                const newDate = new Date(date);
                                const currentTime = field.value;
                                if (currentTime) {
                                  newDate.setHours(currentTime.getHours(), currentTime.getMinutes());
                                }
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
                        {!watchedIsAllDay && (
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
                        )}
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">Event Type</FormLabel>
                  <Select 
                    onValueChange={handleEventTypeChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {eventTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{type.icon}</span>
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: type.color }}
                            />
                            <span>{type.label}</span>
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
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <MapPin className="mr-2 h-4 w-4" />
                    Location (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Enter event location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <label className="text-sm font-medium text-delft-blue mb-2 block flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Attendees (Optional)
              </label>
              <div className="flex space-x-2 mb-2">
                <Input
                  placeholder="Add attendee email or name..."
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  onKeyPress={handleAttendeeInputKeyPress}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAttendee}
                  disabled={!attendeeInput.trim()}
                >
                  Add
                </Button>
              </div>
              {form.watch('attendees').length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.watch('attendees').map((attendee, index) => (
                    <div
                      key={index}
                      className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {attendee}
                      <button
                        type="button"
                        onClick={() => removeAttendee(attendee)}
                        className="ml-2 text-gray-500 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                      {field.value ? (
                        <>
                          <Globe className="mr-2 h-4 w-4" />
                          Public Event
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Private Event
                        </>
                      )}
                    </FormLabel>
                    <p className="text-sm text-gray-600">
                      {field.value 
                        ? 'This event will be visible to all family members'
                        : 'This event will only be visible to you'
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

            <div className="flex space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-burnt-sienna hover:bg-burnt-sienna/90 text-white"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editEvent ? 'Update Event' : 'Add Event'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
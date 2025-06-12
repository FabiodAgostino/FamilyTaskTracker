import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Globe, Lock, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { insertCalendarEventSchema, CalendarEvent } from '@shared/schema';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: any) => Promise<void>;
  editEvent?: CalendarEvent | null;
  selectedDate?: Date;
}

export function EventModal({ isOpen, onClose, onSave, editEvent, selectedDate }: EventModalProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const eventTypes = [
    { value: 'personal', label: 'Personal', color: '#81B29A' },
    { value: 'family', label: 'Family', color: '#E07A5F' },
    { value: 'work', label: 'Work', color: '#3D405B' },
  ];

  const form = useForm({
    resolver: zodResolver(insertCalendarEventSchema),
    defaultValues: {
      title: '',
      description: '',
      startDate: selectedDate || new Date(),
      endDate: selectedDate || new Date(),
      isPublic: false,
      createdBy: user?.username || '',
      eventType: 'personal' as const,
      color: '#E07A5F',
    },
  });

  useEffect(() => {
    if (editEvent) {
      form.reset({
        title: editEvent.title,
        description: editEvent.description || '',
        startDate: editEvent.startDate,
        endDate: editEvent.endDate,
        isPublic: editEvent.isPublic,
        createdBy: editEvent.createdBy,
        eventType: editEvent.eventType,
        color: editEvent.color,
      });
    } else {
      const defaultDate = selectedDate || new Date();
      form.reset({
        title: '',
        description: '',
        startDate: defaultDate,
        endDate: defaultDate,
        isPublic: false,
        createdBy: user?.username || '',
        eventType: 'personal',
        color: '#E07A5F',
      });
    }
  }, [editEvent, selectedDate, form, user]);

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      await onSave(data);
      
      toast({
        title: editEvent ? 'Event updated' : 'Event created',
        description: editEvent ? 'Event updated successfully!' : 'Event created successfully!',
      });
      
      onClose();
      form.reset();
    } catch (error) {
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
      form.setValue('eventType', eventType as any);
      form.setValue('color', type.color);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                    <Input {...field} placeholder="Enter event title" />
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium text-delft-blue">Start Date</FormLabel>
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
                              format(field.value, "PPP")
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
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
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
                    <FormLabel className="text-sm font-medium text-delft-blue">End Date</FormLabel>
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
                              format(field.value, "PPP")
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
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
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

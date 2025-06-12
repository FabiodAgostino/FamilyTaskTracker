import { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EventModal } from './EventModal';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { CalendarEvent } from '@/lib/models/types';

export function Calendar() {
  const { user } = useAuthContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const {
    data: events,
    loading,
    add: addEvent,
    update: updateEvent,
    remove: deleteEvent,
  } = useFirestore<CalendarEvent>('calendar_events');

  const visibleEvents = useMemo(() => {
    return events.filter(
      (event) =>
        event.isPublic ||
        event.createdBy === user?.username ||
        user?.role === 'admin'
    );
  }, [events, user]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return visibleEvents
      .filter((event) => event.startDate >= now)
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      )
      .slice(0, 5);
  }, [visibleEvents]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = 'd';
  const rows = [];
  let days = [];
  let day = startDate;

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const dayEvents = visibleEvents.filter(
        (event) =>
          isSameDay(event.startDate, cloneDay) ||
          (event.startDate <= cloneDay && event.endDate >= cloneDay)
      );

      days.push(
        <div
          key={day.toString()}
          className={`p-2 text-center text-sm cursor-pointer hover:bg-gray-50 transition-colors relative ${
            !isSameMonth(day, monthStart)
              ? 'text-gray-400'
              : isToday(day)
              ? 'bg-delft-blue text-white rounded'
              : 'text-gray-900'
          }`}
          onClick={() => {
            setSelectedDate(cloneDay);
            setIsEventModalOpen(true);
          }}
        >
          {format(day, dateFormat)}
          {dayEvents.length > 0 && (
            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex space-x-1">
              {dayEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: event.color }}
                />
              ))}
              {dayEvents.length > 3 && (
                <div className="w-1 h-1 rounded-full bg-gray-400" />
              )}
            </div>
          )}
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div key={day.toString()} className="grid grid-cols-7 gap-1">
        {days}
      </div>
    );
    days = [];
  }

  const handleSaveEvent = async (eventData: any) => {
    if (editEvent) {
      await updateEvent(editEvent.id, eventData);
      setEditEvent(null);
    } else {
      await addEvent(eventData);
    }
    setIsEventModalOpen(false);
    setSelectedDate(undefined);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditEvent(event);
    setIsEventModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEventModalOpen(false);
    setEditEvent(null);
    setSelectedDate(undefined);
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-sienna"></div>
        <span className="ml-3 text-delft-blue font-medium">Caricamento...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Intestazione */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-delft-blue">Calendario Familiare</h2>
            <p className="text-gray-600 mt-1">Tieni traccia di eventi e appuntamenti importanti</p>
          </div>
          <Button
            onClick={() => setIsEventModalOpen(true)}
            className="mt-4 sm:mt-0 bg-burnt-sienna hover:bg-burnt-sienna/90 text-white font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Aggiungi Evento
          </Button>
        </div>
      </div>

      {/* Vista Calendario */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-delft-blue">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={prevMonth} className="p-2">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth} className="p-2">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Giorni della settimana */}
          <div className="space-y-1">
            <div className="grid grid-cols-7 gap-1">
              {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            {rows}
          </div>
        </CardContent>
      </Card>

      {/* Eventi in arrivo */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-delft-blue mb-4">Prossimi Eventi</h3>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center space-x-4 p-4 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ backgroundColor: `${event.color}20` }}
                  onClick={() => handleEditEvent(event)}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-delft-blue truncate">{event.title}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Clock className="mr-1 h-3 w-3" />
                      {format(event.startDate, 'd MMM yyyy')}
                      {!isSameDay(event.startDate, event.endDate) && (
                        <span> - {format(event.endDate, 'd MMM yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="capitalize text-xs"
                    style={{
                      borderColor: event.color,
                      color: event.color,
                    }}
                  >
                    {event.eventType}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Nessun evento in arrivo</p>
              <p className="text-sm text-gray-500 mt-1">Aggiungi un evento per iniziare</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Evento */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveEvent}
        editEvent={editEvent}
        selectedDate={selectedDate}
      />
    </div>
  );
}

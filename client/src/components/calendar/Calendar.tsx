// client/src/components/notes/NotesList.tsx - VERSIONE CORRETTA E AGGIORNATA
import React, { useState, useMemo, useRef, useEffect } from 'react'; // Importato useEffect
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
  Filter,
  Bell,
  Globe, // Import aggiunto per l'icona
  Lock,  // Import aggiunto per l'icona
  User,  // Import aggiunto per l'icona
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // Importato DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EventModal } from './EventModal';
import { RemindersTab } from './RemindersTab'; // Nuovo componente
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
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
  getDay,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarEvent } from '@/lib/models/types';
import { FaCalendar } from 'react-icons/fa';
import { LoadingScreen, useLoadingTransition } from '../ui/loading-screen';
import { LuChartColumnBig } from "react-icons/lu"; // ✅ NUOVO: Import dell'icona LuChartColumnBig

export function Calendar() {
  const { user } = useAuthContext();
  const isMobile = useIsMobile();

  // ✅ NUOVO: Stato per tab attivo
  const [activeTab, setActiveTab] = useState('calendar');

  // ✅ NUOVO: Stato per filtri collassabili (chiusi di default su mobile)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(!isMobile);

  // ✅ NUOVO: Stato per il popup dei badge
  const [isBadgesPopupOpen, setIsBadgesPopupOpen] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);

  // ✅ NUOVO: Filtri
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const remindersTabRef = useRef<{ openModal: () => void }>(null);


  // ✅ NUOVO: Aggiorna stato filtri quando cambia mobile/desktop
  React.useEffect(() => {
    setIsFiltersExpanded(!isMobile);
  }, [isMobile]);

  const {
    data: events,
    loading,
    add: addEvent,
    update: updateEvent,
    remove: deleteEvent,
  } = useFirestore<CalendarEvent>('calendar_events');

  const { showLoading } = useLoadingTransition(loading, events);


  // ✅ MODIFICATO: Filtri applicati
  const visibleEvents = useMemo(() => {
    const visible = events.filter(
      (event) =>
        event.isPublic ||
        event.createdBy === user?.username ||
        user?.role === 'admin'
    );

    // Applica filtri aggiuntivi
    return visible.filter(event => {
      const matchesType = eventTypeFilter === 'all' || event.eventType === eventTypeFilter;
      const matchesVisibility = visibilityFilter === 'all' ||
        (visibilityFilter === 'public' && event.isPublic) ||
        (visibilityFilter === 'private' && !event.isPublic);

      return matchesType && matchesVisibility;
    });
  }, [events, user, eventTypeFilter, visibilityFilter]);

  // Statistiche eventi
  const stats = useMemo(() => {
    const total = visibleEvents.length;
    const publicEvents = visibleEvents.filter(event => event.isPublic).length;
    const privateEvents = visibleEvents.filter(event => !event.isPublic).length;
    const myEvents = visibleEvents.filter(event => event.createdBy === user?.username).length;

    return { total, publicEvents, privateEvents, myEvents };
  }, [visibleEvents, user]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return visibleEvents
      .filter((event) => {
        // Converte startDate in oggetto Date se è una stringa
        const eventStartDate = event.startDate instanceof Date
          ? event.startDate
          : new Date(event.startDate);

        // Include eventi futuri E eventi di oggi non ancora conclusi
        return eventStartDate >= now ||
          (event.endDate && (event.endDate instanceof Date
            ? event.endDate
            : new Date(event.endDate)) >= now);
      })
      .sort(
        (a, b) => {
          const dateA = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
          const dateB = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
          return dateA.getTime() - dateB.getTime();
        }
      );
  }, [visibleEvents]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Inizia da lunedì
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = 'd';
  const rows = [];
  let days = [];
  let day = startDate;

  // Giorni della settimana in italiano con weekend in rosso
  const weekDays = [
    { name: 'Lun', isWeekend: false },
    { name: 'Mar', isWeekend: false },
    { name: 'Mer', isWeekend: false },
    { name: 'Gio', isWeekend: false },
    { name: 'Ven', isWeekend: false },
    { name: 'Sab', isWeekend: true },
    { name: 'Dom', isWeekend: true },
  ];

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const dayEvents = visibleEvents.filter(
        (event) =>
          isSameDay(event.startDate, cloneDay) ||
          (event.startDate <= cloneDay && event.endDate >= cloneDay)
      );

      const isWeekendDay = getDay(cloneDay) === 0 || getDay(cloneDay) === 6; // Domenica o Sabato

      days.push(
        <div
          key={day.toString()}
          className={`p-2 text-center text-sm cursor-pointer transition-all duration-200 relative h-16 border border-gray-200 dark:border-gray-600 flex flex-col justify-between ${
            !isSameMonth(day, monthStart)
              ? 'text-gray-300 dark:text-gray-600 bg-gray-50 dark:bg-gray-800/50'
              : isToday(day)
              ? 'bg-burnt-newStyle text-white font-bold shadow-md dark:bg-burnt-newStyle dark:text-white'
              : isWeekendDay
              ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'
              : 'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 hover:bg-cambridge-newStyle/10 dark:hover:bg-cambridge-newStyle/20'
          }`}
          onClick={() => {
            if (dayEvents.length > 0) {
              setSelectedDayEvents(dayEvents);
              setSelectedDate(cloneDay);
              setIsDayDetailOpen(true);
            } else {
              setSelectedDate(cloneDay);
              setIsEventModalOpen(true);
            }
          }}
        >
          <div className="font-semibold text-xs">{format(day, dateFormat)}</div>
          {dayEvents.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {dayEvents.slice(0, isMobile ? 1 : 2).map((event) => (
                <div
                  key={event.id}
                  className="w-1.5 h-1.5 rounded-full shadow-sm"
                  style={{ backgroundColor: event.color }}
                  title={event.title}
                />
              ))}
              {dayEvents.length > (isMobile ? 1 : 2) && (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-gray-400"></div>
              )}
            </div>
          )}
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div key={day.toString()} className="grid grid-cols-7 flex-1">
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

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent(eventId);
      setIsEventModalOpen(false);
      setEditEvent(null);
      setSelectedDate(undefined);
    } catch (error) {
      console.error('Errore nell\'eliminare l\'evento:', error);
      throw error; // Rilancia l'errore per permettere al modal di gestirlo
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditEvent(event);
    setIsEventModalOpen(true);
    setIsDayDetailOpen(false);
  };

  const handleCloseModal = () => {
    setIsEventModalOpen(false);
    setEditEvent(null);
    setSelectedDate(undefined);
  };

  const handleCloseDayDetail = () => {
    setIsDayDetailOpen(false);
    setSelectedDayEvents([]);
    setSelectedDate(undefined);
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  // ✅ NUOVO: Toggle filtri con debug
  const toggleFilters = () => {
    setIsFiltersExpanded(!isFiltersExpanded);
  };

  const getEventTypeInfo = (eventType: string) => {
    const types: Record<string, { label: string; icon: string }> = {
      'personal': { label: 'Personale', icon: '👤' },
      'family': { label: 'Famiglia', icon: '👨‍👩‍👧‍👦' },
      'work': { label: 'Lavoro', icon: '💼' },
      'appointment': { label: 'Appuntamento', icon: '📅' },
      'reminder': { label: 'Promemoria', icon: '⏰' },
    };
    return types[eventType] || { label: eventType, icon: '📅' };
  };

  return (
    <LoadingScreen
      isVisible={showLoading}
      title="Caricamento Calendario"
      subtitle="Sincronizzazione eventi..."
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ✅ HEADER RESPONSIVE - MODIFICATO con TABS */}
        <div className={cn("mb-8", isMobile && "mb-6")}>
          <div className={cn(
            "flex sm:items-center sm:justify-between",
            isMobile ? "flex-col space-y-3" : "flex-row"
          )}>
            <div className={cn("flex items-center gap-3", isMobile ? "w-full" : "")}>
              <FaCalendar className="h-8 w-8 text-cambridge-newStyle" />
              <h1 className="text-3xl font-bold text-delft-blue">
                {activeTab === 'calendar' ? 'Eventi' : 'Promemoria'}
              </h1>

              {/* ✅ Bottoni piccolo per popup badge e "Plus" su mobile, spostati a destra */}
              {isMobile && (
                <div className="flex items-center gap-2 ml-auto"> {/* Modificato: ml-auto per spingere a destra */}
                  <Button
                    onClick={() => setIsBadgesPopupOpen(true)} // ✅ Apre il popup dei badge
                    size="sm"
                    variant="outline"
                    className="border-cambridge-newStyle" // ✅ Stile come richiesto
                  >
                    <LuChartColumnBig className="h-4 w-4 text-cambridge-newStyle" /> {/* ✅ Icona come richiesto */}
                  </Button>
                  <Button
                    onClick={() => activeTab === 'calendar' ? setIsEventModalOpen(true) : remindersTabRef.current?.openModal()}
                    size="sm"
                    className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white p-2"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* ✅ TAB NAVIGATION */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-4">
              <TabsList className="grid w-full grid-cols-2 lg:w-auto">
                <TabsTrigger value="calendar" className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-cambridge-newStyle" />
                  <span className={cn(isMobile && "text-sm")}>Eventi</span>
                </TabsTrigger>
                <TabsTrigger value="reminders" className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-cambridge-newStyle" />
                  <span className={cn(isMobile && "text-sm")}>Promemoria</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* ✅ Statistics Badges - Con più spazio su mobile (VISIBILI SOLO SU DESKTOP) */}
            {activeTab === 'calendar' && !isMobile && ( // Aggiunta !isMobile
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-cambridge-newStyle/10 text-cambridge-newStyle border-cambridge-newStyle/20">
                  {stats.total} {stats.total === 1 ? 'evento' : 'eventi'}
                </Badge>
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                  {stats.publicEvents} {stats.publicEvents === 1 ? 'pubblico' : 'pubblici'}
                </Badge>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                  {stats.privateEvents} {stats.privateEvents === 1 ? 'privato' : 'privati'}
                </Badge>
                {stats.myEvents > 0 && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                    {stats.myEvents} {stats.myEvents === 1 ? 'mio' : 'miei'}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* ✅ Bottone grande solo su schermi grandi */}
          {!isMobile && (
            <Button
              onClick={() => activeTab === 'calendar' ? setIsEventModalOpen(true) : remindersTabRef.current?.openModal()}
              className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white dark:text-black shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              {activeTab === 'calendar' ? 'Nuovo Evento' : 'Nuovo Promemoria'}
            </Button>
          )}
        </div>

        {/* ✅ CONTENT TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="calendar" className="space-y-6">
            {/* ✅ FILTRI COLLASSABILI - SOLO PER EVENTI */}
            <Card className={cn("mb-6", isMobile && "mb-4")}>
              <CardContent className={cn("p-6", isMobile && "p-4")}>

                {/* ✅ Header dei filtri su mobile */}
                {isMobile && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-cambridge-newStyle" />
                      <span className="font-medium text-sm">Filtri di ricerca</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleFilters}
                    >
                      {isFiltersExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}

                {/* ✅ Contenuto filtri - Controllo completo via JS */}
                <div className={cn(
                  "flex gap-4",
                  isMobile && !isFiltersExpanded && "hidden"
                )}>

                  <div className="space-y-2">

                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tipo Evento
                    </label>
                    <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Seleziona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti i Tipi</SelectItem>
                        <SelectItem value="personal">Personale</SelectItem>
                        <SelectItem value="family">Famiglia</SelectItem>
                        <SelectItem value="work">Lavoro</SelectItem>
                        <SelectItem value="appointment">Appuntamento</SelectItem>
                        <SelectItem value="reminder">Promemoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Visibilità
                    </label>
                    <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Seleziona visibilità" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti</SelectItem>
                        <SelectItem value="public">Pubblici</SelectItem>
                        <SelectItem value="private">Privati</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ✅ Vista Calendario - Con padding responsivo */}
            <Card className="mb-6">
              <CardContent className={cn("p-6", isMobile && "p-4")}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-delft-blue">
                    {format(currentDate, 'MMMM yyyy', { locale: it })}
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
                <div className={cn("flex flex-col", isMobile ? "h-90" : "h-98")}>
                  <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
                    {weekDays.map((day) => (
                      <div
                        key={day.name}
                        className={`p-3 text-center text-sm font-semibold ${
                          day.isWeekend
                            ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                            : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800'
                        }`}
                      >
                        {day.name}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {rows}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ✅ Prossimi Eventi - Con padding responsivo */}
            <Card>
              <CardContent className={cn("p-6", isMobile && "p-4")}>
                <h3 className="text-lg font-semibold text-delft-blue mb-4 flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Prossimi Eventi
                  {upcomingEvents.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-cambridge-newStyle/10 text-cambridge-newStyle">
                      {upcomingEvents.length}
                    </Badge>
                  )}
                </h3>
                {upcomingEvents.length > 0 ? (
                  <div className={cn(
                    "space-y-3",
                    isMobile ? "max-h-48 overflow-y-auto" : "md:overflow-y-auto md:scrollbar-thin md:scrollbar-thumb-burnt-sienna md:scrollbar-track-gray-100",
                    !isMobile && "max-h-[165px]"
                  )}>
                    {upcomingEvents.map((event) => {
                      const typeInfo = getEventTypeInfo(event.eventType);
                      return (
                        <div
                          key={event.id}
                          className="flex items-center space-x-4 p-4 rounded-lg cursor-pointer hover:shadow-md transition-all duration-200 border border-gray-100"
                          style={{ backgroundColor: `${event.color}08` }}
                          onClick={() => handleEditEvent(event)}
                        >
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: event.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-delft-blue truncate">{event.title}</h4>
                              <span className="text-lg">{typeInfo.icon}</span>
                            </div>
                            <div className={cn(
                              "flex items-center gap-4 text-sm text-gray-600",
                              isMobile && "flex-col items-start gap-1"
                            )}>
                              <div className="flex items-center">
                                <Clock className="mr-1 h-3 w-3" />
                                {format(event.startDate, 'd MMM yyyy', { locale: it })}
                                {event.isAllDay ? '' : ` ${format(event.startDate, 'HH:mm')}`}
                                {!isSameDay(event.startDate, event.endDate) && (
                                  <span> - {format(event.endDate, 'd MMM yyyy', { locale: it })}</span>
                                )}
                              </div>
                              {event.location && (
                                <div className="flex items-center">
                                  <MapPin className="mr-1 h-3 w-3" />
                                  <span className="truncate max-w-32">{event.location}</span>
                                </div>
                              )}
                              {event.attendees && event.attendees.length > 0 && (
                                <div className="flex items-center">
                                  <Users className="mr-1 h-3 w-3" />
                                  <span>{event.attendees.length}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="capitalize text-xs border-2"
                            style={{
                              borderColor: event.color,
                              color: event.color,
                            }}
                          >
                            {typeInfo.label}
                          </Badge>
                        </div>
                      );
                    })}
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
          </TabsContent>

          <TabsContent value="reminders" className="space-y-6">
            {/* ✅ COMPONENTE PROMEMORIA */}
            <RemindersTab ref={remindersTabRef} />
          </TabsContent>
        </Tabs>

        {/* Modal Dettaglio Giorno */}
        <Dialog open={isDayDetailOpen} onOpenChange={handleCloseDayDetail}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-delft-blue">
                Eventi del {selectedDate && format(selectedDate, 'd MMMM yyyy', { locale: it })}
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Dettagli degli eventi per il giorno selezionato.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 border-t border-b border-gray-200 dark:border-gray-700">
              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event) => {
                  const typeInfo = getEventTypeInfo(event.eventType);
                  return (
                    <div
                      key={event.id}
                      className="p-4 rounded-lg border border-gray-200 hover:shadow-md transition-all cursor-pointer"
                      style={{ backgroundColor: `${event.color}08` }}
                      onClick={() => handleEditEvent(event)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: event.color }}
                          />
                          <h4 className="font-semibold text-delft-blue">{event.title}</h4>
                          <span className="text-lg">{typeInfo.icon}</span>
                        </div>
                        <Badge
                          variant="outline"
                          style={{ borderColor: event.color, color: event.color }}
                        >
                          {typeInfo.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center">
                          <Clock className="mr-2 h-3 w-3" />
                          {event.isAllDay
                            ? 'Tutto il giorno'
                            : `${format(event.startDate, 'HH:mm')} - ${format(event.endDate, 'HH:mm')}`
                          }
                        </div>
                        {event.location && (
                          <div className="flex items-center">
                            <MapPin className="mr-2 h-3 w-3" />
                            {event.location}
                          </div>
                        )}
                        {event.description && (
                          <p className="mt-2 text-gray-700">{event.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Nessun evento per questo giorno.</p>
                </div>
              )}
            </div>
            <div className="pt-4 flex justify-end">
              <Button onClick={handleCloseDayDetail} variant="secondary">
                Chiudi
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ✅ NUOVO: Modale per la visualizzazione delle statistiche degli eventi */}
        <Dialog open={isBadgesPopupOpen} onOpenChange={setIsBadgesPopupOpen}>
          <DialogContent className="sm:max-w-md p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-semibold text-delft-blue">Statistiche Eventi</DialogTitle>
              <DialogDescription className="text-gray-600">
                Riepilogo rapido e completo degli eventi nel tuo calendario.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-3 py-4 border-t border-b border-gray-200 dark:border-gray-700">
              <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-cambridge-newStyle/10 text-cambridge-newStyle border-cambridge-newStyle/20">
                <CalendarIcon className="w-4 h-4 mr-2" /> {stats.total} {stats.total === 1 ? 'evento' : 'eventi'} totali
              </Badge>
              <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-green-100 text-green-700 border-green-200">
                <Globe className="w-4 h-4 mr-2" /> {stats.publicEvents} {stats.publicEvents === 1 ? 'pubblico' : 'pubblici'}
              </Badge>
              <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-orange-100 text-orange-700 border-orange-200">
                <Lock className="w-4 h-4 mr-2" /> {stats.privateEvents} {stats.privateEvents === 1 ? 'privato' : 'privati'}
              </Badge>
              {stats.myEvents > 0 && (
                <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-purple-100 text-purple-700 border-purple-200">
                  <User className="w-4 h-4 mr-2" /> {stats.myEvents} {stats.myEvents === 1 ? 'mio' : 'miei'}
                </Badge>
              )}
            </div>
            <div className="pt-4 flex justify-end">
              <Button onClick={() => setIsBadgesPopupOpen(false)} variant="secondary">
                Chiudi
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Evento */}
        <EventModal
          isOpen={isEventModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          editEvent={editEvent}
          selectedDate={selectedDate}
        />

      </div>
    </LoadingScreen>
  );
}
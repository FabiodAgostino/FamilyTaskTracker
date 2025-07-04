import React, { useState, useMemo, useImperativeHandle } from 'react';
import { 
  Plus, 
  Clock, 
  Bell,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar as CalendarIcon,
  Repeat,
  AlertCircle,
  CheckCircle,
  Pause,
  Trash2,
  Edit3,
  Globe,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReminderModal } from './ReminderModal'; // Componente che creeremo dopo
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore, isToday, isTomorrow } from 'date-fns';
import { it } from 'date-fns/locale';

// Tipo temporaneo - sostituire con il modello Reminder
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
}

export const RemindersTab = React.forwardRef<{ openModal: () => void }>((props, ref) => {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // ✅ Stati per filtri e UI
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(!isMobile);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  
  // ✅ Filtri
  const [statusFilter, setStatusFilter] = useState('active'); // active, completed, all
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');

  // ✅ Hook Firestore per promemoria
  const {
    data: reminders,
    loading,
    add: addReminder,
    update: updateReminder,
    remove: deleteReminder,
  } = useFirestore<Reminder>('reminders');

  // ✅ Aggiorna stato filtri quando cambia mobile/desktop
  React.useEffect(() => {
    setIsFiltersExpanded(!isMobile);
  }, [isMobile]);

  // ✅ Filtri applicati
  const visibleReminders = useMemo(() => {
    const visible = reminders.filter(
      (reminder) =>
        reminder.isPublic ||
        reminder.createdBy === user?.username ||
        user?.role === 'admin'
    );

    return visible.filter(reminder => {
      // Filtro stato
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && reminder.isActive && !reminder.completedAt) ||
        (statusFilter === 'completed' && reminder.completedAt);

      // Filtro tipo
      const matchesType = typeFilter === 'all' || reminder.reminderType === typeFilter;
      
      // Filtro priorità
      const matchesPriority = priorityFilter === 'all' || reminder.priority === priorityFilter;
      
      // Filtro visibilità
      const matchesVisibility = visibilityFilter === 'all' || 
        (visibilityFilter === 'public' && reminder.isPublic) ||
        (visibilityFilter === 'private' && !reminder.isPublic);
      
      return matchesStatus && matchesType && matchesPriority && matchesVisibility;
    });
  }, [reminders, user, statusFilter, typeFilter, priorityFilter, visibilityFilter]);

  // ✅ Statistiche promemoria
  const stats = useMemo(() => {
    const total = visibleReminders.length;
    const active = visibleReminders.filter(r => r.isActive && !r.completedAt).length;
    const completed = visibleReminders.filter(r => r.completedAt).length;
    const overdue = visibleReminders.filter(r => 
      r.isActive && !r.completedAt && r.scheduledTime < new Date()
    ).length;
    const upcoming = visibleReminders.filter(r => 
      r.isActive && !r.completedAt && r.scheduledTime > new Date()
    ).length;
    
    return { total, active, completed, overdue, upcoming };
  }, [visibleReminders]);

  // ✅ Promemoria raggruppati per stato temporale
  const groupedReminders = useMemo(() => {
    const now = new Date();
    const groups = {
      overdue: [] as Reminder[],
      today: [] as Reminder[],
      tomorrow: [] as Reminder[],
      upcoming: [] as Reminder[],
      completed: [] as Reminder[]
    };

    visibleReminders.forEach(reminder => {
      if (reminder.completedAt) {
        groups.completed.push(reminder);
      } else if (!reminder.isActive) {
        // Skip inattivi
      } else if (isBefore(reminder.scheduledTime, now)) {
        groups.overdue.push(reminder);
      } else if (isToday(reminder.scheduledTime)) {
        groups.today.push(reminder);
      } else if (isTomorrow(reminder.scheduledTime)) {
        groups.tomorrow.push(reminder);
      } else {
        groups.upcoming.push(reminder);
      }
    });

    // Ordina ogni gruppo per data
    Object.keys(groups).forEach(key => {
      groups[key as keyof typeof groups].sort((a, b) => 
        a.scheduledTime.getTime() - b.scheduledTime.getTime()
      );
    });

    return groups;
  }, [visibleReminders]);

  // ✅ Handlers
  const handleSaveReminder = async (reminderData: any) => {
    try {
      if (editReminder) {
        await updateReminder(editReminder.id, reminderData);
        toast({
          title: 'Promemoria aggiornato',
          description: 'Il promemoria è stato aggiornato con successo!',
        });
      } else {
        await addReminder(reminderData);
        toast({
          title: 'Promemoria creato',
          description: 'Il promemoria è stato creato con successo!',
        });
      }
      setIsReminderModalOpen(false);
      setEditReminder(null);
    } catch (error) {
      console.error('Errore nel salvare il promemoria:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile salvare il promemoria',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await deleteReminder(reminderId);
      toast({
        title: 'Promemoria eliminato',
        description: 'Il promemoria è stato eliminato con successo!',
      });
    } catch (error) {
      console.error('Errore nell\'eliminare il promemoria:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare il promemoria',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteReminder = async (reminder: Reminder) => {
    try {
      await updateReminder(reminder.id, {
        ...reminder,
        completedAt: new Date(),
        isActive: false,
        updatedAt: new Date()
      });
      toast({
        title: 'Promemoria completato',
        description: 'Il promemoria è stato segnato come completato!',
      });
    } catch (error) {
      console.error('Errore nel completare il promemoria:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile completare il promemoria',
        variant: 'destructive',
      });
    }
  };

  const handleSnoozeReminder = async (reminder: Reminder, minutes: number) => {
    try {
      const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
      await updateReminder(reminder.id, {
        ...reminder,
        snoozeUntil,
        updatedAt: new Date()
      });
      toast({
        title: 'Promemoria posticipato',
        description: `Promemoria posticipato di ${minutes} minuti`,
      });
    } catch (error) {
      console.error('Errore nel posticipare il promemoria:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile posticipare il promemoria',
        variant: 'destructive',
      });
    }
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditReminder(reminder);
    setIsReminderModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsReminderModalOpen(false);
    setEditReminder(null);
  };

  const toggleFilters = () => {
    setIsFiltersExpanded(!isFiltersExpanded);
  };

  // ✅ Utility functions
  const getReminderTypeInfo = (type: string) => {
    const types: Record<string, { label: string; icon: string; color: string }> = {
      'personal': { label: 'Personale', icon: '👤', color: '#81B29A' },
      'family': { label: 'Famiglia', icon: '👨‍👩‍👧‍👦', color: '#E07A5F' },
      'work': { label: 'Lavoro', icon: '💼', color: '#3D405B' },
      'health': { label: 'Salute', icon: '🏥', color: '#F4A261' },
      'shopping': { label: 'Shopping', icon: '🛒', color: '#2A9D8F' },
      'event': { label: 'Evento', icon: '🎉', color: '#E76F51' },
      'other': { label: 'Altro', icon: '📝', color: '#6C757D' },
    };
    return types[type] || types['other'];
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatReminderTime = (date: Date) => {
    if (isToday(date)) {
      return `Oggi alle ${format(date, 'HH:mm')}`;
    } else if (isTomorrow(date)) {
      return `Domani alle ${format(date, 'HH:mm')}`;
    } else {
      return format(date, "d MMM yyyy 'alle' HH:mm", { locale: it });
    }
  };
const openModal = () => setIsReminderModalOpen(true);

  useImperativeHandle(ref, () => ({
    openModal
  }));
  // ✅ Render componente promemoria
  const renderReminderCard = (reminder: Reminder) => {
    const typeInfo = getReminderTypeInfo(reminder.reminderType);
    const isOverdue = reminder.isActive && !reminder.completedAt && reminder.scheduledTime < new Date();
    const isSnoozed = reminder.snoozeUntil && reminder.snoozeUntil > new Date();
    const canEdit = reminder.createdBy === user?.username || user?.role === 'admin';

    return (
      <Card 
        key={reminder.id} 
        className={cn(
          "transition-all duration-200 hover:shadow-md",
          isOverdue && "border-red-200 bg-red-50/50",
          isSnoozed && "border-blue-200 bg-blue-50/50",
          reminder.completedAt && "border-green-200 bg-green-50/50 opacity-75"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div 
                className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: typeInfo.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={cn(
                    "font-semibold text-delft-blue truncate",
                    reminder.completedAt && "line-through text-gray-500"
                  )}>
                    {reminder.title}
                  </h4>
                  <span className="text-lg">{typeInfo.icon}</span>
                  {reminder.isRecurring && <Repeat className="h-4 w-4 text-blue-500" />}
                  {!reminder.isPublic && <Lock className="h-4 w-4 text-orange-500" />}
                </div>
                
                <p className={cn(
                  "text-sm text-gray-600 mb-2",
                  reminder.completedAt && "line-through"
                )}>
                  {reminder.message}
                </p>
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatReminderTime(reminder.scheduledTime)}
                  </div>
                  {isOverdue && (
                    <div className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      In ritardo
                    </div>
                  )}
                  {isSnoozed && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Pause className="h-3 w-3" />
                      Posticipato
                    </div>
                  )}
                  {reminder.completedAt && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Completato
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge 
                variant="outline" 
                className={cn("text-xs", getPriorityColor(reminder.priority))}
              >
                {reminder.priority === 'high' ? 'Alta' : 
                 reminder.priority === 'medium' ? 'Media' : 'Bassa'}
              </Badge>
              
              <Badge variant="outline" className="text-xs">
                {typeInfo.label}
              </Badge>
            </div>
          </div>
          
          {/* Azioni promemoria */}
          {canEdit && (
            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              {!reminder.completedAt && reminder.isActive && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCompleteReminder(reminder)}
                    className="text-green-600 hover:bg-green-50"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completa
                  </Button>
                  
                  <Select onValueChange={(value) => handleSnoozeReminder(reminder, parseInt(value))}>
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue placeholder="Posponi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">1 ora</SelectItem>
                      <SelectItem value="240">4 ore</SelectItem>
                      <SelectItem value="1440">1 giorno</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEditReminder(reminder)}
                className="text-blue-600 hover:bg-blue-50"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteReminder(reminder.id)}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-newStyle"></div>
        <span className="ml-3 text-delft-blue font-medium">Caricamento promemoria...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ✅ Statistics Badges */}
      <div className={cn(
        "flex flex-wrap gap-2",
        isMobile && "mb-4"
      )}>
        <Badge variant="secondary" className="bg-cambridge-newStyle/10 text-cambridge-newStyle border-cambridge-newStyle/20">
          {stats.total} {stats.total === 1 ? 'promemoria' : 'promemoria'}
        </Badge>
        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
          {stats.active} {stats.active === 1 ? 'attivo' : 'attivi'}
        </Badge>
        <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
          {stats.overdue} in ritardo
        </Badge>
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
          {stats.upcoming} {stats.upcoming === 1 ? 'prossimo' : 'prossimi'}
        </Badge>
        <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
          {stats.completed} {stats.completed === 1 ? 'completato' : 'completati'}
        </Badge>
      </div>

      {/* ✅ FILTRI COLLASSABILI */}
      <Card className={cn("mb-6", isMobile && "mb-4")}>
        <CardContent className={cn("p-6", isMobile && "p-4")}>
          
          {/* ✅ Header dei filtri su mobile */}
          {isMobile && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-sm">Filtri promemoria</span>
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

          {/* ✅ Contenuto filtri */}
          <div className={cn(
            "grid grid-cols-1 md:grid-cols-4 gap-4",
            isMobile && !isFiltersExpanded && "hidden"
          )}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Stato
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="active">Attivi</SelectItem>
                  <SelectItem value="completed">Completati</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i Tipi</SelectItem>
                  <SelectItem value="personal">Personale</SelectItem>
                  <SelectItem value="family">Famiglia</SelectItem>
                  <SelectItem value="work">Lavoro</SelectItem>
                  <SelectItem value="health">Salute</SelectItem>
                  <SelectItem value="shopping">Shopping</SelectItem>
                  <SelectItem value="event">Evento</SelectItem>
                  <SelectItem value="other">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Priorità
              </label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona priorità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Bassa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Visibilità
              </label>
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger>
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

      {/* ✅ SEZIONI PROMEMORIA RAGGRUPPATE */}
      <div className="space-y-6">
        {/* In Ritardo */}
        {groupedReminders.overdue.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              In Ritardo
              <Badge variant="destructive" className="ml-2">
                {groupedReminders.overdue.length}
              </Badge>
            </h3>
            <div className="space-y-3">
              {groupedReminders.overdue.map(renderReminderCard)}
            </div>
          </div>
        )}

        {/* Oggi */}
        {groupedReminders.today.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-delft-blue mb-4 flex items-center">
              <Clock className="mr-2 h-5 w-5" />
              Oggi
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                {groupedReminders.today.length}
              </Badge>
            </h3>
            <div className="space-y-3">
              {groupedReminders.today.map(renderReminderCard)}
            </div>
          </div>
        )}

        {/* Domani */}
        {groupedReminders.tomorrow.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-delft-blue mb-4 flex items-center">
              <CalendarIcon className="mr-2 h-5 w-5" />
              Domani
              <Badge variant="secondary" className="ml-2 bg-cambridge-newStyle/10 text-cambridge-newStyle">
                {groupedReminders.tomorrow.length}
              </Badge>
            </h3>
            <div className="space-y-3">
              {groupedReminders.tomorrow.map(renderReminderCard)}
            </div>
          </div>
        )}

        {/* Prossimi */}
        {groupedReminders.upcoming.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-delft-blue mb-4 flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              Prossimi
              <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-700">
                {groupedReminders.upcoming.length}
              </Badge>
            </h3>
            <div className="space-y-3">
              {groupedReminders.upcoming.map(renderReminderCard)}
            </div>
          </div>
        )}

        {/* Completati */}
        {statusFilter === 'all' && groupedReminders.completed.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-green-600 mb-4 flex items-center">
              <CheckCircle className="mr-2 h-5 w-5" />
              Completati
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                {groupedReminders.completed.length}
              </Badge>
            </h3>
            <div className="space-y-3">
              {groupedReminders.completed.slice(0, 5).map(renderReminderCard)}
              {groupedReminders.completed.length > 5 && (
                <p className="text-sm text-gray-500 text-center">
                  ... e altri {groupedReminders.completed.length - 5} completati
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {stats.total === 0 && (
          <div className="text-center py-12">
            <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun promemoria</h3>
            <p className="text-gray-500 mb-6">
              Crea il tuo primo promemoria per iniziare a organizzarti meglio!
            </p>
            <Button
              onClick={() => setIsReminderModalOpen(true)}
              className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crea Promemoria
            </Button>
          </div>
        )}
      </div>

      {/* ✅ Modal Promemoria */}
      <ReminderModal
        isOpen={isReminderModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveReminder}
        onDelete={handleDeleteReminder}
        editReminder={editReminder}
      />
    </div>
  );
  
});
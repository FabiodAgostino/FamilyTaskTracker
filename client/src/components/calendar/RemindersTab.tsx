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
  Trash2,
  Edit3,
  Lock,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReminderModal } from './ReminderModal';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, isBefore, isToday, isTomorrow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Reminder } from '@/lib/models/reminder';


export const RemindersTab = React.forwardRef<{ openModal: () => void }>((props, ref) => {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // ✅ Stati per filtri e UI
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(!isMobile);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  
  // ✅ Filtri
  const [statusFilter, setStatusFilter] = useState('all'); // Cambiato da 'active' a 'all'
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

  // ✅ Handlers (mantengono la stessa logica)
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



  const formatReminderTime = (date: Date) => {
    if (isToday(date)) {
      return `${format(date, 'HH:mm')}`;
    } else if (isTomorrow(date)) {
      return `Dom. ${format(date, 'HH:mm')}`;
    } else {
      return format(date, "d/M HH:mm", { locale: it });
    }
  };

  const openModal = () => setIsReminderModalOpen(true);

  useImperativeHandle(ref, () => ({
    openModal
  }));

  // ✅ Render componente promemoria COMPATTO
  const renderReminderCard = (reminder: Reminder) => {
    const typeInfo = getReminderTypeInfo(reminder.reminderType);
    const isOverdue = reminder.isActive && !reminder.completedAt && reminder.scheduledTime < new Date();
    const isSnoozed = reminder.snoozeUntil && reminder.snoozeUntil > new Date();
    const canEdit = reminder.createdBy === user?.username || user?.role === 'admin';

    return (
      <div 
        key={reminder.id} 
        className={cn(
          "group flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:shadow-sm",
          isOverdue && "border-red-200 bg-red-50/30",
          isSnoozed && "border-blue-200 bg-blue-50/30",
          reminder.completedAt && "border-green-200 bg-green-50/30 opacity-60"
        )}
      >
        {/* Indicatore colorato tipo + priorità */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: typeInfo.color }}
          />
          <div className={cn(
            "w-2 h-2 rounded-full",
            reminder.priority === 'high' ? 'bg-red-500' :
            reminder.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
          )} />
        </div>

        {/* Contenuto principale */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn(
              "font-medium text-sm text-delft-blue truncate",
              reminder.completedAt && "line-through text-gray-500"
            )}>
              {reminder.title}
            </h4>
            
            {/* Icone di stato compatte */}
            <div className="flex items-center gap-1">
              {reminder.isRecurring && <Repeat className="h-3 w-3 text-blue-500" />}
              {!reminder.isPublic && <Lock className="h-3 w-3 text-orange-500" />}
            </div>
          </div>
          
          {/* Messaggio (solo se non vuoto) */}
          {reminder.message && (
            <p className={cn(
              "text-xs text-gray-600 mb-1 truncate",
              reminder.completedAt && "line-through"
            )}>
              {reminder.message}
            </p>
          )}
        </div>

        {/* Tempo e stato */}
        <div className="flex items-center gap-2 text-xs flex-shrink-0">
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="h-3 w-3" />
            {formatReminderTime(reminder.scheduledTime)}
          </div>
          
          {/* Indicatori di stato */}
          {isOverdue && (
            <Badge variant="destructive" className="text-xs px-1 py-0">
              Ritardo
            </Badge>
          )}
          {isSnoozed && (
            <Badge variant="secondary" className="text-xs px-1 py-0 bg-blue-100 text-blue-700">
              Posticipato
            </Badge>
            
          )}
         {
          isSnoozed && (
              <div className="flex items-center gap-1 text-gray-500">
            <Clock className="h-3 w-3" />
            {formatReminderTime(reminder.snoozeUntil as Date)}
          </div>
          )
         }
          {reminder.completedAt && (
            <Badge variant="secondary" className="text-xs px-1 py-0 bg-green-100 text-green-700">
              ✓
            </Badge>
          )}
        </div>

        {/* Menu azioni compatto */}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!reminder.completedAt && reminder.isActive && (
                <>
                  <DropdownMenuItem onClick={() => handleCompleteReminder(reminder)}>
                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                    Completa
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => handleEditReminder(reminder)}>
                <Edit3 className="h-4 w-4 mr-2 text-blue-600" />
                Modifica
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDeleteReminder(reminder.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-burnt-newStyle"></div>
        <span className="ml-3 text-delft-blue text-sm">Caricamento promemoria...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ✅ Statistics Badges - più compatti */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="text-xs bg-cambridge-newStyle/10 text-cambridge-newStyle">
          {stats.total} totali
        </Badge>
        {stats.active > 0 && (
          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
            {stats.active} attivi
          </Badge>
        )}
        {stats.overdue > 0 && (
          <Badge variant="destructive" className="text-xs">
            {stats.overdue} in ritardo
          </Badge>
        )}
        {stats.upcoming > 0 && (
          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
            {stats.upcoming} prossimi
          </Badge>
        )}
      </div>

      {/* ✅ FILTRI COLLASSABILI - più compatti */}
      <Card>
        <CardContent className="p-3">
          {/* Header dei filtri */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-cambridge-newStyle" />
              <span className="font-medium text-sm">Filtri di ricerca</span>
            </div>
            {isMobile && (
              <Button variant="ghost" size="sm" onClick={toggleFilters}>
                {isFiltersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>

          {/* Contenuto filtri */}
          <div className={cn(
            "grid grid-cols-2 md:grid-cols-4 gap-2",
            isMobile && !isFiltersExpanded && "hidden"
          )}>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="active">Attivi</SelectItem>
                <SelectItem value="completed">Completati</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
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

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="low">Bassa</SelectItem>
              </SelectContent>
            </Select>

            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="public">Pubblici</SelectItem>
                <SelectItem value="private">Privati</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ✅ SEZIONI PROMEMORIA RAGGRUPPATE - design compatto */}
      <div className="space-y-4">
        {/* In Ritardo */}
        {groupedReminders.overdue.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center">
              <AlertCircle className="mr-1 h-4 w-4" />
              In Ritardo ({groupedReminders.overdue.length})
            </h3>
            <div className="space-y-2">
              {groupedReminders.overdue.map(renderReminderCard)}
            </div>
          </div>
        )}

        {/* Oggi */}
        {groupedReminders.today.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-delft-blue mb-2 flex items-center">
              <Clock className="mr-1 h-4 w-4" />
              Oggi ({groupedReminders.today.length})
            </h3>
            <div className="space-y-2">
              {groupedReminders.today.map(renderReminderCard)}
            </div>
          </div>
        )}

        {/* Domani */}
        {groupedReminders.tomorrow.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-delft-blue mb-2 flex items-center">
              <CalendarIcon className="mr-1 h-4 w-4" />
              Domani ({groupedReminders.tomorrow.length})
            </h3>
            <div className="space-y-2">
              {groupedReminders.tomorrow.map(renderReminderCard)}
            </div>
          </div>
        )}

        {/* Prossimi */}
        {groupedReminders.upcoming.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-delft-blue mb-2 flex items-center">
              <Bell className="mr-1 h-4 w-4" />
              Prossimi ({groupedReminders.upcoming.length})
            </h3>
            <div className="space-y-2">
              {groupedReminders.upcoming.map(renderReminderCard)}
            </div>
          </div>
        )}

        {/* Completati (solo primi 3) */}
        {statusFilter === 'all' && groupedReminders.completed.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-green-600 mb-2 flex items-center">
              <CheckCircle className="mr-1 h-4 w-4" />
              Completati ({groupedReminders.completed.length})
            </h3>
            <div className="space-y-2">
              {groupedReminders.completed.slice(0, 3).map(renderReminderCard)}
              {groupedReminders.completed.length > 3 && (
                <p className="text-xs text-gray-500 text-center py-2">
                  ... e altri {groupedReminders.completed.length - 3} completati
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {stats.total === 0 && (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">Nessun promemoria</h3>
            <p className="text-xs text-gray-500 mb-4">
              Crea il tuo primo promemoria per iniziare!
            </p>
            <Button
              onClick={() => setIsReminderModalOpen(true)}
              size="sm"
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
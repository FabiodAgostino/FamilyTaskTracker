// client/src/components/ui/TimePicker.tsx

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  date: Date | undefined;
  onHourSelect: (hour: number) => void;
  onMinuteSelect: (minute: number) => void;
  minTime?: Date; // Prop per l'ora minima
}

export function TimePicker({ date, onHourSelect, onMinuteSelect, minTime }: TimePickerProps) {
  const hoursRef = React.useRef<HTMLDivElement>(null);
  const minutesRef = React.useRef<HTMLDivElement>(null);

  const selectedHour = date ? date.getHours() : 0;
  const selectedMinute = date ? date.getMinutes() : 0;

  // Funzione per verificare se una data è oggi o nel passato
  const isCurrentOrPastDay = (selectedDate: Date | undefined): boolean => {
    if (!selectedDate) return true; // Se non c'è data selezionata, consideriamo come giorno corrente
    
    const today = new Date();
    const selected = new Date(selectedDate);
    
    // Resettiamo le ore per confrontare solo le date
    today.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);
    
    return selected.getTime() <= today.getTime();
  };

  // Determina se dobbiamo applicare le restrizioni
  const shouldApplyTimeRestrictions = isCurrentOrPastDay(date);

  // Questo useEffect serve a posizionare lo scroll all'ora corretta quando il popover si apre.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (hoursRef.current) {
        const selectedElement = hoursRef.current.querySelector<HTMLButtonElement>(`[data-hour="${selectedHour}"]`);
        selectedElement?.scrollIntoView({ block: 'center' });
      }
      if (minutesRef.current) {
        const selectedElement = minutesRef.current.querySelector<HTMLButtonElement>(`[data-minute="${selectedMinute}"]`);
        selectedElement?.scrollIntoView({ block: 'center' });
      }
    }, 50); 

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const stopPropagation = (e: React.UIEvent) => e.stopPropagation();

  return (
    <div className="flex items-center justify-center gap-2 p-3">
      {/* Colonna Ore */}
      <div 
        ref={hoursRef} 
        className="h-48 w-20 overflow-y-auto scroll-snap-y-mandatory"
        onWheel={stopPropagation}
        onTouchMove={stopPropagation}
      >
        {hours.map((hour) => {
          const isSelected = hour === selectedHour;
          
          // Applica le restrizioni SOLO se è il giorno corrente o passato E se minTime è definito
          const isHourDisabled = shouldApplyTimeRestrictions && minTime 
            ? hour < minTime.getHours() 
            : false;
            
          return (
            <button
              key={hour}
              onClick={() => onHourSelect(hour)}
              data-hour={hour}
              disabled={isHourDisabled}
              className={cn(
                'flex items-center justify-center w-full h-12 text-lg rounded-lg scroll-snap-align-center',
                isSelected ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-accent',
                isHourDisabled && 'text-muted-foreground opacity-50 cursor-not-allowed'
              )}
            >
              {String(hour).padStart(2, '0')}
            </button>
          );
        })}
      </div>

      <div className="text-2xl font-bold text-muted-foreground pb-1">:</div>

      {/* Colonna Minuti */}
      <div 
        ref={minutesRef} 
        className="h-48 w-20 overflow-y-auto scroll-snap-y-mandatory"
        onWheel={stopPropagation}
        onTouchMove={stopPropagation}
      >
        {minutes.map((minute) => {
          const isSelected = minute === selectedMinute;
          
          // Applica le restrizioni SOLO se è il giorno corrente o passato E se minTime è definito
          const isMinuteDisabled = shouldApplyTimeRestrictions && minTime 
            ? selectedHour < minTime.getHours() || (selectedHour === minTime.getHours() && minute < minTime.getMinutes()) 
            : false;
            
          return (
            <button
              key={minute}
              onClick={() => onMinuteSelect(minute)}
              data-minute={minute}
              disabled={isMinuteDisabled}
              className={cn(
                'flex items-center justify-center w-full h-12 text-lg rounded-lg scroll-snap-align-center',
                isSelected ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-accent',
                isMinuteDisabled && 'text-muted-foreground opacity-50 cursor-not-allowed'
              )}
            >
              {String(minute).padStart(2, '0')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
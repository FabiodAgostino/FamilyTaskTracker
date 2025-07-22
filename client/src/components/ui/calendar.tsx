// client/src/components/ui/calendar.tsx

import * as React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { DayPicker, DayPickerSingleProps } from 'react-day-picker';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerFooter, DrawerClose, DrawerTrigger } from '@/components/ui/drawer';
import { TimePicker } from './timepicker'; // Assicurati che questo sia il TimePicker modificato
import { useIsMobile } from '@/hooks/use-mobile';

// ==========================================================================================
//  PickerContent: Componente helper che contiene la logica di selezione
//  È stato spostato fuori per pulizia e ora è l'unica parte che sa COME modificare la data.
// ==========================================================================================
const PickerContent = ({
  isDesktop,
  selected,
  onSelect,
  className,
  classNames,
  showOutsideDays = true,
  dayPickerProps,
  isAllDay = false,
  minTime
}: {
  isDesktop: boolean;
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  className?: string;
  classNames?: React.ComponentProps<typeof DayPicker>['classNames'];
  showOutsideDays?: boolean;
  dayPickerProps: DayPickerSingleProps;
  isAllDay?:boolean;
  minTime?:Date;
}) => {

  // Funzione per quando si seleziona un GIORNO dal calendario
  const handleDateSelect = (day: Date | undefined) => {
    if (!day || !onSelect) return;
    // Crea una nuova data partendo da quella esistente (o da adesso)
    // e aggiorna solo la parte relativa al giorno (anno, mese, giorno).
    const newDate = selected ? new Date(selected) : new Date();
    newDate.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onSelect(newDate);
  };

  // Funzione per quando si seleziona un'ORA dal TimePicker
  const handleHourSelect = (hour: number) => {
    if (onSelect === undefined) return;
    const newDate = selected ? new Date(selected) : new Date();
    newDate.setHours(hour);
    onSelect(newDate);
  };

  // Funzione per quando si seleziona un MINUTO dal TimePicker
  const handleMinuteSelect = (minute: number) => {
    if (onSelect === undefined) return;
    const newDate = selected ? new Date(selected) : new Date();
    newDate.setMinutes(minute);
    onSelect(newDate);
  };

  // Funzione per l'input <input type="time"> della versione DESKTOP
  const handleTimeChangeDesktop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value;
    if (!selected || !timeValue || !onSelect) return;
    const [hours, minutes] = timeValue.split(':').map(Number);
    const newDate = new Date(selected);
    newDate.setHours(hours, minutes);
    onSelect(newDate);
  };

  return (
    <>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-3", className)}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-sm font-medium",
          nav: "space-x-1 flex items-center",
          nav_button: cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-2",
          cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside: "day-outside text-muted-foreground opacity-50",
          day_disabled: "text-muted-foreground opacity-50",
          ...classNames,
        }}
        components={{
          IconLeft: () => <ChevronLeft className="h-4 w-4" />,
          IconRight: () => <ChevronRight className="h-4 w-4" />,
        }}
        {...dayPickerProps}
        mode="single"
        selected={selected}
        onSelect={handleDateSelect}
        locale={it}
        weekStartsOn={1}
      />
      <div className="border-t border-border">
      {isDesktop ? (
          <div className="p-3">
            <Input type="time" value={selected ? format(selected, "HH:mm") : ""} onChange={handleTimeChangeDesktop} />
          </div>
      ) : (
        !isAllDay ? 
          <TimePicker
            date={selected}
            onHourSelect={handleHourSelect}
            onMinuteSelect={handleMinuteSelect}
            minTime={minTime}
          />
          : <span></span>
      )}
      </div>
    </>
  );
};
PickerContent.displayName = "PickerContent";


// ==========================================================================================
//  Calendar: Componente Principale
//  Questo componente ora è molto più "pulito", si occupa solo di mostrare il
//  Popover o il Drawer e passa i dati a PickerContent.
// ==========================================================================================
export type CalendarProps = Omit<React.ComponentProps<typeof DayPicker>, 'selected' | 'onSelect'> & {
    selected: Date | undefined;
    isAllDay?: boolean;
    minTime?:Date | undefined;
    onSelect: (date: Date | undefined) => void;
};

function Calendar({ className, classNames, showOutsideDays = true, selected, onSelect, isAllDay=false, minTime,...props }: CalendarProps) {
    const isDesktop = !useIsMobile();
    const [open, setOpen] = React.useState(false);
    const dayPickerProps = props as DayPickerSingleProps;
    
    const triggerButton = (
        <Button
            variant={"outline"}
            className={cn("w-[280px] justify-start text-left font-normal", !selected && "text-muted-foreground")}
        >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? format(selected, "PPP p", { locale: it }) : <span>Scegli una data e ora</span>}
        </Button>
    );

    if (isDesktop) {
        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
                <PopoverContent className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <PickerContent 
                        isDesktop={isDesktop}
                        selected={selected}
                        onSelect={onSelect}
                        className={className}
                        classNames={classNames}
                        showOutsideDays={showOutsideDays}
                        dayPickerProps={dayPickerProps}
                        isAllDay={isAllDay}
                    />
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
            <DrawerContent>
                    <div className="max-h-[85vh] overflow-y-auto p-4 flex flex-col items-center">

                    <PickerContent 
                        isDesktop={isDesktop}
                        selected={selected}
                        onSelect={onSelect}
                        className={className}
                        classNames={classNames}
                        showOutsideDays={showOutsideDays}
                        dayPickerProps={dayPickerProps}
                        isAllDay={isAllDay}
                        minTime={minTime}
                    />
                </div>
                <DrawerFooter className="pt-2">
                    <DrawerClose asChild>
                        <Button variant="outline">Conferma</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
Calendar.displayName = "Calendar";

export { Calendar };
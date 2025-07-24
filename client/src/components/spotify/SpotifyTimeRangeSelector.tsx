// components/spotify/SpotifyTimeRangeSelector.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TimeRange } from '@/lib/models/spotify';
import { TIME_RANGES } from '@/lib/spotyUtils/spotifyConst';

// Importa i componenti di Shadcn per Select
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Assicurati che questi percorsi siano corretti

// Hook personalizzato per rilevare se è mobile view
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      // Puoi definire la tua breakpoint "mobile" qui, ad esempio 768px (corrisponde a 'md' in Tailwind)
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile(); // Controlla all'inizio
    window.addEventListener('resize', checkIsMobile); // Aggiungi listener per i resize

    return () => {
      window.removeEventListener('resize', checkIsMobile); // Pulisci il listener
    };
  }, []);

  return isMobile;
};

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    short_term: '4 settimane',
    medium_term: '6 mesi',
    long_term: '1 anno',

};

interface SpotifyTimeRangeSelectorProps {
    currentTimeRange: TimeRange;
    onTimeRangeChange: (newRange: TimeRange) => void;
}

export function SpotifyTimeRangeSelector({ currentTimeRange, onTimeRangeChange }: SpotifyTimeRangeSelectorProps) {
    const isMobile = useIsMobile();

    return (
        <div>
            <Card>
                {isMobile ? (
                    // Vista per dispositivi mobili: usa il componente Select
                    <Select onValueChange={(value) => onTimeRangeChange(value as TimeRange)} value={currentTimeRange}>
                        <SelectTrigger className="w-[180px]"> {/* Puoi aggiustare la larghezza */}
                            <SelectValue placeholder="Seleziona un periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(TIME_RANGE_LABELS).map(([range, label]) => (
                                <SelectItem key={range} value={range}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    // Vista per desktop: usa i bottoni esistenti
                    <div className="flex items-center gap-2">
                        {Object.entries(TIME_RANGE_LABELS).map(([range, label]) => (
                            <Button
                                key={range}
                                size="sm"
                                variant={currentTimeRange === range ? "default" : "ghost"}
                                onClick={() => onTimeRangeChange(range as TimeRange)}
                                className={cn(
                                    currentTimeRange === range
                                        ? "bg-burnt-newStyle text-white"
                                        : "text-slate-400 hover:text-white hover:bg-slate-700"
                                )}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
// components/spotify/SpotifyHeader.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Share } from 'lucide-react';
import { SpotifyTimeRangeSelector } from './SpotifyTimeRangeSelector';
import { TimeRange } from '@/lib/models/spotify';
import { FaSpotify } from 'react-icons/fa';

interface SpotifyHeaderProps {
  userName: string | null;
  currentTimeRangeLabel: string;
  currentTimeRange: TimeRange;
  onTimeRangeChange: (newRange: TimeRange) => void;
  onLogout: () => void;
}

export function SpotifyHeader({ userName, currentTimeRangeLabel, currentTimeRange, onTimeRangeChange }: SpotifyHeaderProps) {
  return (
    <div className="">
      <div className="container mx-auto px-6 py-4">
        {/* Contenitore principale per titolo/username e selettore */}
        <div className="flex justify-between items-start">
          {/* Sezione di sinistra: Logo, Titolo e Username */}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-3">
              <FaSpotify className="h-8 w-8 text-cambridge-newStyle" />
              <h1 className="text-3xl font-bold text-delft-blue">SpotyStat</h1>
            </div>
            {userName && (
              <h5 className="text-burnt-newStyle text-sm mt-1 ml-11"> {/* Aggiustato margine per allineare sotto il titolo */}
                {userName}
              </h5>
            )}
          </div>

          {/* Sezione di destra: SpotifyTimeRangeSelector */}
          <div className="flex items-center gap-3 mt-2 sm:mt-0"> {/* Leggero margine top per allineamento su schermi piccoli */}
            <SpotifyTimeRangeSelector
                currentTimeRange={currentTimeRange}
                onTimeRangeChange={onTimeRangeChange}
              />
          </div>
        </div>
      </div>
    </div>
  );
}
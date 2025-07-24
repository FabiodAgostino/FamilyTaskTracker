// components/spotify/TracksGrid.tsx
import React from 'react';
import { Card } from '@/components/ui/card';

interface TracksGridProps {
  tracks: any[];
}

export function TracksGrid({ tracks }: TracksGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {tracks.slice(0, 100).map((track, index) => (
        <Card
          key={track.id}
          // Classi per la Card: sfondo chiaro di default, sfondo scuro in dark mode
          className="bg-white dark:bg-gray-800 shadow-md dark:shadow-lg rounded-lg overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="relative">
                <span
                  // Classi per il numero: sfondo verde fisso, testo bianco fisso
                  className="absolute -top-2 -left-2 bg-burnt-newStyle text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center"
                >
                  {index + 1}
                </span>
                <img
                  src={track.album.images[0]?.url || '/placeholder-album.png'}
                  alt={track.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3
                  // Classi per il titolo del brano: testo nero di default, testo bianco in dark mode
                  className="font-semibold text-black dark:text-white text-sm truncate mb-1"
                >
                  {track.name}
                </h3>
                <p
                  // Classi per il nome dell'artista: testo grigio chiaro di default, testo più chiaro in dark mode
                  className="text-slate-400 dark:text-gray-300 text-xs truncate"
                >
                  {track.artists.map((a: any) => a.name).join(', ')}
                </p>
                <div
                  // Classi per la popolarità: testo grigio di default, testo più chiaro in dark mode
                  className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400"
                >
                  <span>♪ Popolarità {track.popularity}%</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
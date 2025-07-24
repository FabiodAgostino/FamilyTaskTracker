// components/spotify/AlbumsGrid.tsx
import React from 'react';
import { Card } from '@/components/ui/card';

interface AlbumStat {
  album: any;
  count: number;
  tracks: any[];
}

interface AlbumsGridProps {
  albums: AlbumStat[];
}

export function AlbumsGrid({ albums }: AlbumsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {albums.slice(0, 100).map((albumStat, index) => (
        <Card
          key={albumStat.album.id}
          // Classi per la Card: sfondo chiaro di default, sfondo scuro in dark mode
          // Border, hover e transizioni si adattano per entrambi i temi
          className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md dark:shadow-lg rounded-lg overflow-hidden
                     hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="relative">
                <span
                  // Classi per il numero: sfondo verde fisso, testo bianco fisso (come negli altri componenti)
                  className="absolute -top-2 -left-2 bg-burnt-newStyle text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center"
                >
                  {index + 1}
                </span>
                <img
                  src={albumStat.album.images[0]?.url || '/placeholder-album.png'}
                  alt={albumStat.album.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3
                  // Classi per il titolo dell'album: testo nero di default, testo bianco in dark mode
                  className="font-semibold text-black dark:text-white text-sm truncate mb-1"
                >
                  {albumStat.album.name}
                </h3>
                <p
                  // Classi per l'artista: testo grigio chiaro di default, testo più chiaro in dark mode
                  className="text-slate-400 dark:text-gray-300 text-xs truncate"
                >
                  {albumStat.album.artists.map((a: any) => a.name).join(', ')}
                </p>
                <div
                  // Classi per il conteggio dei brani: testo grigio di default, testo più chiaro in dark mode
                  className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400"
                >
                  <span>🎵 {albumStat.count} brani</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
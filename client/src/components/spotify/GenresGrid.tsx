// components/spotify/GenresGrid.tsx
import React from 'react';
import { Card } from '@/components/ui/card';

interface GenreStat {
  genre: string;
  count: number;
}

interface GenresGridProps {
  genres: GenreStat[];
}

export function GenresGrid({ genres }: GenresGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {genres.slice(0, 100).map((genre, index) => (
        <Card
          key={genre.genre}
          // Classi per la Card: sfondo chiaro di default, sfondo scuro in dark mode
          // Border, hover e transizioni si adattano per entrambi i temi
          className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md dark:shadow-lg rounded-lg overflow-hidden
                     hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* Il badge del numero non ha un'immagine, quindi non serve '-top-2 -left-2' */}
                <span
                  // Classi per il numero: sfondo verde fisso, testo bianco fisso (coerente con gli altri)
                  className="bg-burnt-newStyle text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center"
                >
                  {index + 1}
                </span>
              </div>

              <div className="flex-1">
                <h3
                  // Classi per il nome del genere: testo nero di default, testo bianco in dark mode
                  className="font-semibold text-black dark:text-white text-sm capitalize mb-1"
                >
                  {genre.genre}
                </h3>
                <p
                  // Classi per il conteggio artisti: testo grigio chiaro di default, testo più chiaro in dark mode
                  className="text-slate-400 dark:text-gray-300 text-xs"
                >
                  {genre.count} artisti
                </p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
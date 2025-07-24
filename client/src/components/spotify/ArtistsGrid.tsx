// components/spotify/ArtistsGrid.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Users } from 'lucide-react'; // Icona più pulita per i follower

interface ArtistsGridProps {
  artists: any[];
}

export function ArtistsGrid({ artists }: ArtistsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {artists.slice(0, 100).map((artist, index) => {
        // ✅ ACCESSO SICURO A TUTTE LE PROPRIETÀ
        const imageUrl = artist.images?.[0]?.url || '/placeholder-artist.png';
        const genres = artist.genres?.slice(0, 2).join(', ') || 'Genere non specificato';
        const followers = artist.followers?.total?.toLocaleString() ?? 'N/D';

        return (
          <Card
            key={artist.id}
            className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md dark:shadow-lg rounded-lg overflow-hidden
                       hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="p-4">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <span
                    className="absolute -top-2 -left-2 bg-burnt-newStyle text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10"
                  >
                    {index + 1}
                  </span>
                  <img
                    src={imageUrl}
                    alt={artist.name}
                    className="w-16 h-16 rounded-full object-cover border-2 dark:border-gray-600"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-black dark:text-white text-sm truncate mb-1">
                    {artist.name}
                  </h3>
                  <p className="text-slate-400 dark:text-gray-300 text-xs truncate">
                    {genres}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-gray-400">
                    <Users className="w-3 h-3" />
                    <span>{followers}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
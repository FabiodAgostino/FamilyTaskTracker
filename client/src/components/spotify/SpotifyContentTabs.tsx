// components/spotify/SpotifyContentTabs.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, Users, Disc, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlbumsGrid } from './AlbumsGrid';
import { ArtistsGrid } from './ArtistsGrid';
import { GenresGrid } from './GenresGrid';
import { TracksGrid } from './TracksGrid';

type TabType = 'tracks' | 'artists' | 'albums' | 'genres';

const TAB_LABELS: Record<TabType, { label: string; icon: React.ReactNode }> = {
  tracks: { label: 'Brani', icon: <Music className="w-4 h-4" /> },
  artists: { label: 'Artisti', icon: <Users className="w-4 h-4" /> },
  albums: { label: 'Album', icon: <Disc className="w-4 h-4" /> },
  genres: { label: 'Generi', icon: <Tag className="w-4 h-4" /> }
};

interface SpotifyContentTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  data: {
    topTracks: any[];
    topArtists: any[];
    albumStats: any[];
    genreStats: any[];
  };
}

export function SpotifyContentTabs({ activeTab, onTabChange, data }: SpotifyContentTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TabType)}>
      {/* Contenitore per centrare la TabsList */}
      <div className="flex justify-center sm:justify-start mb-6">
        <TabsList>
          {Object.entries(TAB_LABELS).map(([key, { label, icon }]) => (
            <TabsTrigger
              key={key}
              value={key}
              className={cn(
                "data-[state=active]:bg-burnt-newStyle text-white data-[state=active]:text-white",
                "text-slate-400 hover:text-white transition-colors"
              )}
            >
              <span className="flex items-center gap-2">
                {icon}
                {label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="tracks">
        <TracksGrid tracks={data.topTracks} />
      </TabsContent>

      <TabsContent value="artists">
        <ArtistsGrid artists={data.topArtists} />
      </TabsContent>

      <TabsContent value="albums">
        <AlbumsGrid albums={data.albumStats} />
      </TabsContent>

      <TabsContent value="genres">
        <GenresGrid genres={data.genreStats} />
      </TabsContent>
    </Tabs>
  );
}
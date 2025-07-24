import { AuthService } from '@/lib/auth';
import { SpotifyStats, GenreStat, AlbumStat, TimeRange } from '@/lib/models/spotify';
import { TIME_RANGES } from '@/lib/spotyUtils/spotifyConst';
import { SpotifyService } from '@/services/spotifyService';
import { useState, useEffect, useCallback, useMemo } from 'react';

interface UseSpotifyStatsReturn extends SpotifyStats {
  genreStats: GenreStat[];
  albumStats: AlbumStat[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useSpotifyStats = (timeRange: TimeRange = TIME_RANGES.MEDIUM_TERM): UseSpotifyStatsReturn => {
  const [stats, setStats] = useState<SpotifyStats>({
    topTracks: null,
    topArtists: null,
    recentTracks: null
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllStats = useCallback(async (): Promise<void> => {
    if (!AuthService.isAuthenticated()) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [topTracks, topArtists, recentTracks] = await Promise.all([
        SpotifyService.getTopTracks(timeRange, 50),
        SpotifyService.getTopArtists(timeRange, 50), 
        SpotifyService.getRecentlyPlayed(50)
      ]);

      setStats({
        topTracks,
        topArtists,
        recentTracks
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch stats';
      setError(errorMessage);
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAllStats();
  }, [fetchAllStats]);

  const genreStats = useMemo((): GenreStat[] => {
    if (!stats.topArtists?.items) return [];
    
    const genreCount: Record<string, number> = {};
    stats.topArtists.items.forEach(artist => {
      artist.genres.forEach(genre => {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
    });
    
    return Object.entries(genreCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([genre, count]) => ({ genre, count }));
  }, [stats.topArtists]);

  const albumStats = useMemo((): AlbumStat[] => {
    if (!stats.topTracks?.items) return [];
    
    const albumCount: Record<string, AlbumStat> = {};
    stats.topTracks.items.forEach(track => {
      const albumId = track.album.id;
      if (!albumCount[albumId]) {
        albumCount[albumId] = {
          album: track.album,
          count: 0,
          tracks: []
        };
      }
      albumCount[albumId].count++;
      albumCount[albumId].tracks.push(track);
    });
    
    return Object.values(albumCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [stats.topTracks]);

  const refetch = useCallback((): void => {
    fetchAllStats();
  }, [fetchAllStats]);

  return {
    ...stats,
    genreStats,
    albumStats,
    loading,
    error,
    refetch
  };
};
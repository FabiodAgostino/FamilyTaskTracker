import { AuthService } from '@/lib/auth';
import { TimeRange } from '@/lib/models/spotify';
import { TIME_RANGES } from '@/lib/spotyUtils/spotifyConst';
import { SpotifyService } from '@/services/spotifyService';
import { useState, useEffect, useCallback } from 'react';

type DataType = 'tracks' | 'artists' | 'recent';

// NUOVO: Interfaccia per l'oggetto della cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// NUOVO: Cache in-memory e tempo di scadenza (10 minuti in millisecondi)
const cache = new Map<string, CacheEntry<any>>();
const CACHE_EXPIRATION_TIME_MS = 10 * 60 * 1000;

interface UseSpotifyDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useSpotifyData = <T>(
  dataType: DataType,
  timeRange: TimeRange = TIME_RANGES.MEDIUM_TERM,
  limit: number = 20
): UseSpotifyDataReturn<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // MODIFICATO: La funzione accetta un parametro per forzare l'aggiornamento
  const fetchData = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    // NUOVO: Genera una chiave unica per la cache
    const cacheKey = `${dataType}-${timeRange}-${limit}`;

    // NUOVO: Controlla la cache prima di fare la chiamata
    if (!forceRefresh && cache.has(cacheKey)) {
      const cachedEntry = cache.get(cacheKey)!;
      const isCacheValid = (Date.now() - cachedEntry.timestamp) < CACHE_EXPIRATION_TIME_MS;
      
      if (isCacheValid) {
        setData(cachedEntry.data as T);
        return; // Dati trovati nella cache, esci dalla funzione
      }
    }

    if (!AuthService.isAuthenticated()) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result: unknown;
      switch (dataType) {
        case 'tracks':
          result = await SpotifyService.getTopTracks(timeRange, limit);
          break;
        case 'artists':
          result = await SpotifyService.getTopArtists(timeRange, limit);
          break;
        case 'recent':
          result = await SpotifyService.getRecentlyPlayed(limit);
          break;
        default:
          throw new Error(`Unknown data type: ${dataType}`);
      }

      setData(result as T);
      // NUOVO: Salva il risultato e il timestamp nella cache
      cache.set(cacheKey, { data: result, timestamp: Date.now() });

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('RATE_LIMITED:')) {
          const retryAfter = error.message.split(':')[1];
          setError(`Rate limited. Retry after ${retryAfter} seconds`);
        } else if (error.message === 'UNAUTHORIZED') {
          setError('Authentication expired');
          AuthService.logout();
        } else {
          setError(error.message);
        }
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, [dataType, timeRange, limit]);

  useEffect(() => {
    // La chiamata iniziale userà la cache se disponibile
    fetchData();
  }, [fetchData]);

  // MODIFICATO: refetch ora chiama fetchData forzando l'aggiornamento
  const refetch = useCallback((): void => {
    fetchData(true); // 'true' per ignorare la cache e fare una nuova chiamata
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch
  };
};
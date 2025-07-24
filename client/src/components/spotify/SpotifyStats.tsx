// components/spotify/SpotifyStats.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SpotifyService } from '@/services/spotifyService';
import { AuthService } from '@/lib/auth';
import { AuthSpotifyService } from '@/services/authSpotyService';
import { TimeRange } from '@/lib/models/spotify';
import { TIME_RANGES } from '@/lib/spotyUtils/spotifyConst';
import { SpotifyAuthModal } from './SpotifyAuthModal';
import { SpotifyHeader } from './SpotifyHeader';
import { SpotifyErrorState } from './SpotifyErrorState';
import { SpotifyContentTabs } from './SpotifyContentTabs';
import { SpotifyLoadingState } from './SpotifyLoadingState';
import { LoadingScreen } from '../ui/loading-screen';

// Tipi di dati per lo stato del componente
interface SpotifyData {
  user: any | null;
  topTracks: any[];
  topArtists: any[];
  // recentTracks è mantenuto per usi futuri ma non caricato attivamente
  recentTracks: any[]; 
  genreStats: Array<{ genre: string; count: number }>;
  albumStats: Array<{ album: any; count: number; tracks: any[] }>;
}

type TabType = 'tracks' | 'artists' | 'albums' | 'genres';

// Mappatura delle etichette per il time range
const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    short_term: '4 settimane',
    medium_term: '6 mesi',
    long_term: '1 anno',
};

// --- Funzioni di utilità ---

function calculateGenreStats(artists: any[]): Array<{ genre: string; count: number }> {
    const genreCount: Record<string, number> = {};
    artists.forEach(artist => {
        if (artist && artist.genres && Array.isArray(artist.genres)) {
            artist.genres.forEach((genre: string) => {
                genreCount[genre] = (genreCount[genre] || 0) + 1;
            });
        }
    });
    return Object.entries(genreCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([genre, count]) => ({ genre, count }));
}

function calculateAlbumStats(tracks: any[]): Array<{ album: any; count: number; tracks: any[] }> {
    const albumCount: Record<string, any> = {};
    if (tracks && Array.isArray(tracks)) {
      tracks.forEach(track => {
          if (track && track.album && track.album.id) {
            const albumId = track.album.id;
            if (!albumCount[albumId]) {
                albumCount[albumId] = { album: track.album, count: 0, tracks: [] };
            }
            albumCount[albumId].count++;
            albumCount[albumId].tracks.push(track);
          }
      });
    }
    return Object.values(albumCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
}

// --- Componente Principale ---

export function SpotifyStats() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SpotifyData>({
    user: null, topTracks: [], topArtists: [], recentTracks: [], genreStats: [], albumStats: []
  });
  const [currentTimeRange, setCurrentTimeRange] = useState<TimeRange>(TIME_RANGES.MEDIUM_TERM);
  const [activeTab, setActiveTab] = useState<TabType>('tracks');
  
  // Ref per tracciare se il caricamento iniziale è già avvenuto
  const initialDataLoaded = useRef(false);

  // Unica funzione per caricare i dati, stabile e riutilizzabile
  const loadData = useCallback(async (range: TimeRange) => {
    setLoading(true);
    setError(null);
    try {
        const [topTracks, topArtists] = await Promise.all([
            SpotifyService.getTopTracks(range, 50),
            SpotifyService.getTopArtists(range, 50),
        ]);

        setData(prevData => ({
            ...prevData,
            topTracks: topTracks.items,
            topArtists: topArtists.items,
            genreStats: calculateGenreStats(topArtists.items),
            albumStats: calculateAlbumStats(topTracks.items),
        }));
    } catch (err) {
        console.error('Data loading failed:', err);
        setError(err instanceof Error ? err.message : 'Errore nel caricamento dei dati');
        if (err instanceof Error && err.message === 'UNAUTHORIZED') {
            AuthService.logout();
            setIsAuthenticated(false);
            setShowLoginModal(true);
        }
    } finally {
        setLoading(false);
    }
  }, []);

  // useEffect per il setup iniziale di autenticazione e caricamento dati
  useEffect(() => {
    const initialize = async () => {
      // Evita esecuzioni multiple (utile soprattutto in Strict Mode)
      if (initialDataLoaded.current) return;
      initialDataLoaded.current = true;

      setLoading(true);
      try {
        const code = new URLSearchParams(window.location.search).get('code');
        const state = new URLSearchParams(window.location.search).get('state');

        if (code && state) {
          await AuthSpotifyService.handleCallback(code, state);
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (AuthService.isAuthenticated()) {
          setIsAuthenticated(true);
          // Carica il profilo utente una sola volta, separatamente
          const userProfile = await SpotifyService.getUserProfile();
          setData(prev => ({...prev, user: userProfile}));
          // Esegui il primo caricamento dei dati dipendenti dal tempo
          await loadData(currentTimeRange);
        } else {
          setIsAuthenticated(false);
          setShowLoginModal(true);
          setLoading(false);
        }
      } catch (err) {
        console.error("Initialization failed", err);
        setError("Autenticazione fallita.");
        setIsAuthenticated(false);
        setShowLoginModal(true);
        setLoading(false);
      }
    };

    initialize();
  }, [loadData, currentTimeRange]);

  // --- Handlers ---
  
  const handleLogin = useCallback(async () => {
    try {
      setError(null);
      await AuthSpotifyService.initiateLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il login');
    }
  }, []);

  const handleLogout = useCallback(() => {
    AuthService.logout();
    window.location.reload(); // Ricarica per un reset pulito
  }, []);

  const handleTimeRangeChange = useCallback((newRange: TimeRange) => {
    setCurrentTimeRange(newRange);
    loadData(newRange);
  }, [loadData]);

  // --- Render ---

  if (loading && !data.user) {
    return <SpotifyLoadingState message="Connessione a Spotify in corso..." />;
  }

  return (
      <LoadingScreen
        isVisible={loading}
        title="Caricamento SpotyStat"
        subtitle="Recupero dei brani..."
      >
      <SpotifyAuthModal
        isOpen={showLoginModal && !isAuthenticated}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
        error={error}
      />

      {isAuthenticated && data.user && (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          <SpotifyHeader
            userName={data.user.display_name}
            currentTimeRange={currentTimeRange}
            onTimeRangeChange={handleTimeRangeChange}
            onLogout={handleLogout}
            currentTimeRangeLabel={TIME_RANGE_LABELS[currentTimeRange]}
          />
          <main className="container mx-auto px-6 py-6">
            {loading ? (
              <SpotifyLoadingState />
            ) : error ? (
              <SpotifyErrorState message={error} onRetry={() => loadData(currentTimeRange)} />
            ) : (
              <SpotifyContentTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                data={data}
              />
            )}
          </main>
        </div>
      )}
    </LoadingScreen>
  );
}
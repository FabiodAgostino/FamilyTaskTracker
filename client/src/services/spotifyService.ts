import { 
  SpotifyTopArtistsResponse, 
  SpotifyTopTracksResponse, 
  SpotifyUser, 
  TimeRange 
} from "@/lib/models/spotify";
import { ENDPOINTS, SPOTIFY_CONFIG } from "@/lib/spotyUtils/spotifyConst";
import { TokenManager } from "@/lib/spotyUtils/tokenManager";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_EXPIRATION_TIME_MS = 10 * 60 * 1000; // 10 minuti

export class SpotifyService {
  private static cache = new Map<string, CacheEntry<any>>();
  // Mappa per tenere traccia delle richieste in corso ed evitare chiamate multiple
  private static pendingRequests = new Map<string, Promise<any>>();

  private static async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const token = await TokenManager.getValidToken();
      const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_CONFIG.API_BASE_URL}${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          throw new Error(`RATE_LIMITED:${retryAfter}`);
        }
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`API_ERROR:${response.status}`);
      }
      
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null as T;
      }

      return await response.json();

    } catch (error) {
      console.error('Spotify API Error:', error);
      throw error;
    }
  }

  static async getUserProfile(): Promise<SpotifyUser> {
    return this.makeRequest<SpotifyUser>(ENDPOINTS.ME);
  }

  static async getTopArtists(
    timeRange: TimeRange, 
    limit: number = 20
  ): Promise<SpotifyTopArtistsResponse> {
    const cacheKey = `top_artists-${timeRange}-${limit}`;

    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < CACHE_EXPIRATION_TIME_MS) {
        return entry.data;
      }
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const requestPromise = (async (): Promise<SpotifyTopArtistsResponse> => {
      try {
        const params = new URLSearchParams({ 
          time_range: timeRange, 
          limit: limit.toString() 
        });
        
        const result = await this.makeRequest<SpotifyTopArtistsResponse>(
          `${ENDPOINTS.TOP_ARTISTS}?${params}`
        );

        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;

      } finally {
        this.pendingRequests.delete(cacheKey);
      }
    })();

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  static async getTopTracks(
    timeRange: TimeRange, 
    limit: number = 20
  ): Promise<SpotifyTopTracksResponse> {
    const cacheKey = `top_tracks-${timeRange}-${limit}`;

    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < CACHE_EXPIRATION_TIME_MS) {
        return entry.data;
      }
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }
    
    const requestPromise = (async (): Promise<SpotifyTopTracksResponse> => {
      try {
        const params = new URLSearchParams({ 
          time_range: timeRange, 
          limit: limit.toString() 
        });
        
        const result = await this.makeRequest<SpotifyTopTracksResponse>(
          `${ENDPOINTS.TOP_TRACKS}?${params}`
        );
        
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;

      } finally {
        this.pendingRequests.delete(cacheKey);
      }
    })();

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }
}
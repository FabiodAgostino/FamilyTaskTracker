import { TimeRange } from "../models/spotify";

export const SPOTIFY_CONFIG = {
  CLIENT_ID:import.meta.env.VITE_SPOTIFY_CLIENT_ID as string,
  REDIRECT_URI:import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
  SCOPES: [
    'user-read-private',
    'user-read-email', 
    'user-top-read',
    'user-read-recently-played'
  ].join(' '),
  API_BASE_URL: 'https://api.spotify.com/v1',
  AUTH_URL: 'https://accounts.spotify.com/authorize',
  TOKEN_URL: 'https://accounts.spotify.com/api/token'
} as const;

export const TIME_RANGES: Record<string, TimeRange> = {
  SHORT_TERM: 'short_term',   // ~4 settimane
  MEDIUM_TERM: 'medium_term', // ~6 mesi  
  LONG_TERM: 'long_term'      // ~1 anno
} as const;

export const ENDPOINTS = {
  ME: '/me',
  TOP_TRACKS: '/me/top/tracks',
  TOP_ARTISTS: '/me/top/artists', 
  RECENTLY_PLAYED: '/me/player/recently-played',
  ARTISTS: '/artists'
} as const;

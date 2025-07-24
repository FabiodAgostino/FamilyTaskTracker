export interface SpotifyImage {
  height: number;
  url: string;
  width: number;
}

export interface SpotifyArtist {
  external_urls: {
    spotify: string;
  };
  followers: {
    href: string | null;
    total: number;
  };
  genres: string[];
  href: string;
  id: string;
  images: SpotifyImage[];
  name: string;
  popularity: number;
  type: 'artist';
  uri: string;
}

export interface SpotifyAlbum {
  album_type: 'album' | 'single' | 'compilation';
  artists: SpotifyArtist[];
  available_markets: string[];
  external_urls: {
    spotify: string;
  };
  href: string;
  id: string;
  images: SpotifyImage[];
  name: string;
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  total_tracks: number;
  type: 'album';
  uri: string;
}

export interface SpotifyTrack {
  album: SpotifyAlbum;
  artists: SpotifyArtist[];
  available_markets: string[];
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  external_ids: {
    isrc?: string;
  };
  external_urls: {
    spotify: string;
  };
  href: string;
  id: string;
  is_local: boolean;
  name: string;
  popularity: number;
  preview_url: string | null;
  track_number: number;
  type: 'track';
  uri: string;
}

export interface SpotifyUser {
  country: string;
  display_name: string;
  email: string;
  explicit_content: {
    filter_enabled: boolean;
    filter_locked: boolean;
  };
  external_urls: {
    spotify: string;
  };
  followers: {
    href: string | null;
    total: number;
  };
  href: string;
  id: string;
  images: SpotifyImage[];
  product: 'premium' | 'free';
  type: 'user';
  uri: string;
}

export interface SpotifyTopTracksResponse {
  href: string;
  items: SpotifyTrack[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

export interface SpotifyTopArtistsResponse {
  href: string;
  items: SpotifyArtist[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

export interface SpotifyRecentlyPlayedTrack {
  track: SpotifyTrack;
  played_at: string;
  context: {
    type: string;
    href: string;
    external_urls: {
      spotify: string;
    };
    uri: string;
  } | null;
}

export interface SpotifyRecentlyPlayedResponse {
  href: string;
  items: SpotifyRecentlyPlayedTrack[];
  limit: number;
  next: string | null;
  cursors: {
    after: string;
    before: string;
  };
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  expires_in: number;
  refresh_token: string;
}

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

export interface GenreStat {
  genre: string;
  count: number;
}

export interface AlbumStat {
  album: SpotifyAlbum;
  count: number;
  tracks: SpotifyTrack[];
}

export interface SpotifyStats {
  topTracks: SpotifyTopTracksResponse | null;
  topArtists: SpotifyTopArtistsResponse | null;
  recentTracks: SpotifyRecentlyPlayedResponse | null;
}
import { TokenResponse } from "../models/spotify";
import { SPOTIFY_CONFIG } from "./spotifyConst";

export class TokenManager {
  private static readonly STORAGE_KEYS = {
    ACCESS_TOKEN: 'spotify_access_token',
    REFRESH_TOKEN: 'spotify_refresh_token',
    EXPIRES_IN: 'spotify_expires_in',
    TIMESTAMP: 'spotify_token_timestamp'
  } as const;

  static getToken(): string | null {
    return localStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN);
  }

  static setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    localStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(this.STORAGE_KEYS.EXPIRES_IN, expiresIn.toString());
    localStorage.setItem(this.STORAGE_KEYS.TIMESTAMP, Date.now().toString());
  }

  static clearTokens(): void {
    Object.values(this.STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }

  static isTokenExpired(): boolean {
    const timestamp = localStorage.getItem(this.STORAGE_KEYS.TIMESTAMP);
    const expiresIn = localStorage.getItem(this.STORAGE_KEYS.EXPIRES_IN);
    
    if (!timestamp || !expiresIn) return true;
    
    const now = Date.now();
    const tokenAge = (now - parseInt(timestamp)) / 1000;
    return tokenAge >= (parseInt(expiresIn) - 300); // 5 min buffer
  }

  static async refreshToken(): Promise<string> {
    const refreshToken = localStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(SPOTIFY_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: SPOTIFY_CONFIG.CLIENT_ID,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data: TokenResponse = await response.json();
    
    this.setTokens(
      data.access_token,
      data.refresh_token || refreshToken,
      data.expires_in
    );
    
    return data.access_token;
  }

  static async getValidToken(): Promise<string> {
    const token = this.getToken();
    
    if (!token || this.isTokenExpired()) {
      return await this.refreshToken();
    }
    
    return token;
  }
}
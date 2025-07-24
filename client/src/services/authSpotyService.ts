import { TokenResponse } from "@/lib/models/spotify";
import { SPOTIFY_CONFIG } from "@/lib/spotyUtils/spotifyConst";
import { TokenManager } from "@/lib/spotyUtils/tokenManager";

export class AuthSpotifyService {
  static async initiateLogin(): Promise<void> {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(16);
    
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    localStorage.setItem('spotify_auth_state', state);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      scope: SPOTIFY_CONFIG.SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
      state
    });
    const authURL = `${SPOTIFY_CONFIG.AUTH_URL}?${params}`;
    window.location.href = authURL;
  }

  static async handleCallback(code: string, state: string): Promise<TokenResponse> {
    alert();
    const storedState = localStorage.getItem('spotify_auth_state');
    
    if (state !== storedState) {
      throw new Error('State mismatch - potential CSRF attack');
    }

    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    
    if (!codeVerifier) {
      throw new Error('No code verifier found');
    }
    const response = await fetch(SPOTIFY_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CONFIG.CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
        code_verifier: codeVerifier,
        state
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data: TokenResponse = await response.json();
    
    TokenManager.setTokens(
      data.access_token,
      data.refresh_token,
      data.expires_in
    );

    // Cleanup
    localStorage.removeItem('spotify_code_verifier');
    localStorage.removeItem('spotify_auth_state');

    return data;
  }

  static logout(): void {
    TokenManager.clearTokens();
  }

  static isAuthenticated(): boolean {
    const token = TokenManager.getToken();
    return Boolean(token && !TokenManager.isTokenExpired());
  }


}

function generateRandomString(length:any) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};


 async function generateCodeChallenge(codeVerifier:any) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-') 
    .replace(/\//g, '_');
};

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
      client_id: SPOTIFY_CONFIG.CLIENT_ID, // ✅ Usa sempre SPOTIFY_CONFIG
      scope: SPOTIFY_CONFIG.SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI, // ✅ Usa sempre SPOTIFY_CONFIG
      state
    });
    
    const authURL = `${SPOTIFY_CONFIG.AUTH_URL}?${params}`;
    console.log('🔐 Redirecting to:', authURL);
    window.location.href = authURL;
  }

  // ✅ Prevenzione race condition
  private static exchangePromise: Promise<TokenResponse> | null = null;
  
  static async handleCallback(code: string, state: string): Promise<TokenResponse> {
    // ✅ Controlla se è già autenticato
    if (this.isAuthenticated()) {
      return { 
        access_token: TokenManager.getToken()!, 
        refresh_token: '', 
        expires_in: 3600,
        token_type: 'Bearer'
      } as TokenResponse;
    }
    
    // ✅ Previeni chiamate multiple simultanee
    if (this.exchangePromise) {
      return this.exchangePromise;
    }
    
    const storedState = localStorage.getItem('spotify_auth_state');
    
    if (state !== storedState) {
      throw new Error('State mismatch - potential CSRF attack');
    }

    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    
    if (!codeVerifier) {
      throw new Error('No code verifier found');
    }

    // ✅ Crea la promise e la salva per prevenire duplicati
    this.exchangePromise = (async (): Promise<TokenResponse> => {
      try {
        // ✅ Parametri corretti per il token exchange
        const body = new URLSearchParams({
          client_id: SPOTIFY_CONFIG.CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
          code_verifier: codeVerifier,
        });

        const response = await fetch(SPOTIFY_CONFIG.TOKEN_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: body,
        });

        if (!response.ok) {
          // ✅ Logging dettagliato dell'errore
          let errorDetails = '';
          try {
            const errorData = await response.json();
            console.error('❌ Spotify token error:', errorData);
            errorDetails = `: ${errorData.error} - ${errorData.error_description}`;
          } catch (e) {
            const errorText = await response.text();
            console.error('❌ Response error text:', errorText);
            errorDetails = `: ${errorText}`;
          }
          
          throw new Error(`Failed to exchange code for token (${response.status})${errorDetails}`);
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
        
      } finally {
        // ✅ Reset della promise per permettere retry futuri
        this.exchangePromise = null;
      }
    })();

    return this.exchangePromise;
  }

  static logout(): void {
    TokenManager.clearTokens();
    // ✅ Reset anche la promise di exchange
    this.exchangePromise = null;
  }

  static isAuthenticated(): boolean {
    const token = TokenManager.getToken();
    return Boolean(token && !TokenManager.isTokenExpired());
  }
}

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-') 
    .replace(/\//g, '_');
}
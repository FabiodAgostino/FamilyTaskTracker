import { AuthService } from '@/lib/auth';
import { SpotifyUser } from '@/lib/models/spotify';
import { AuthSpotifyService } from '@/services/authSpotyService';
import { SpotifyService } from '@/services/spotifyService';
import { useState, useEffect } from 'react';

interface UseSpotifyAuthReturn {
  isAuthenticated: boolean;
  user: SpotifyUser | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
  handleCallback: (code: string, state: string) => Promise<void>;
}

export const useSpotifyAuth = (): UseSpotifyAuthReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthStatus = async (): Promise<void> => {
      try {
        if (AuthService.isAuthenticated()) {
          const userProfile = await SpotifyService.getUserProfile();
          setUser(userProfile);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setError(error instanceof Error ? error.message : 'Authentication failed');
        AuthService.logout();
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (): Promise<void> => {
    try {
      setError(null);
      await AuthSpotifyService.initiateLogin();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  const logout = (): void => {
    AuthService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setError(null);
  };

  const handleCallback = async (code: string, state: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      await AuthSpotifyService.handleCallback(code, state);
      const userProfile = await SpotifyService.getUserProfile();
      
      setUser(userProfile);
      setIsAuthenticated(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Callback handling failed';
      setError(errorMessage);
      console.error('Callback handling failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    isAuthenticated,
    user,
    loading,
    error,
    login,
    logout,
    handleCallback
  };
};
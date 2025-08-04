import { useState, useEffect } from 'react';
import { AuthService, LoginCredentials } from '@/lib/auth';
import { User } from '@/lib/models/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    setUser(currentUser as unknown as User);
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    const userData = await AuthService.login(credentials);
    setUser(userData as unknown as User);
  };

  const logout = (): void => {
    AuthService.logout();
    setUser(null);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout
  };
}

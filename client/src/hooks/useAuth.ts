import { useState, useEffect } from 'react';
import { AuthService, LoginCredentials } from '@/lib/auth';
import { User, UserLogin } from '@/lib/models/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    const user = await AuthService.login(credentials);
    setUser(user);
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

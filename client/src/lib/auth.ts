import { User } from '@shared/schema';

// Pre-loaded user credentials as specified in requirements
const USERS: User[] = [
  { id: "1", username: "admin", password: "admin123", role: "admin" },
  { id: "2", username: "user1", password: "pass123", role: "user" },
  { id: "3", username: "user2", password: "pass456", role: "user" }
];

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export class AuthService {
  private static readonly STORAGE_KEY = 'familyTaskManager_auth';

  static async login(credentials: LoginCredentials): Promise<User> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const user = USERS.find(
      u => u.username === credentials.username && u.password === credentials.password
    );

    if (!user) {
      throw new Error('Invalid username or password');
    }

    // Store auth state in localStorage
    const authState: AuthState = {
      user: { ...user, password: '' }, // Don't store password
      isAuthenticated: true
    };
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(authState));
    
    return { ...user, password: '' };
  }

  static logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static getCurrentUser(): User | null {
    try {
      const authData = localStorage.getItem(this.STORAGE_KEY);
      if (!authData) return null;

      const authState: AuthState = JSON.parse(authData);
      return authState.isAuthenticated ? authState.user : null;
    } catch {
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }
}

// src/contexts/UserPreferencesContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';

export type ViewMode = 'images' | 'compact';

export interface UserPreferences {
  // Visualizzazione
  viewMode: ViewMode;
  showImages: boolean;
  compactMode: boolean;
  
  // Filtri default
  defaultCategory: string;
  defaultPriority: string;
  showCompleted: boolean;
  
  // UI Preferences
  theme: 'light' | 'dark';
  language: 'it' | 'en';
  itemsPerPage: number;
  
  // Notifiche
  enableNotifications: boolean;
  emailNotifications: boolean;
}

export interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => void;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  isLoading: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  // Visualizzazione
  viewMode: 'images',
  showImages: true,
  compactMode: false,
  
  // Filtri default
  defaultCategory: 'all',
  defaultPriority: 'all',
  showCompleted: false,
  
  // UI Preferences
  theme: 'light',
  language: 'it',
  itemsPerPage: 20,
  
  // Notifiche
  enableNotifications: true,
  emailNotifications: false,
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

interface UserPreferencesProviderProps {
  children: ReactNode;
}

export function UserPreferencesProvider({ children }: UserPreferencesProviderProps) {
  const { user } = useAuthContext();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Genera chiave unica per utente - gestisce il caso in cui user non sia ancora disponibile
  const getStorageKey = () => {
    return user?.username ? `familyTaskTracker_preferences_${user.username}` : 'familyTaskTracker_preferences_guest';
  };

  // Carica preferenze dal sessionStorage
  const loadPreferences = () => {
    try {
      const storageKey = getStorageKey();
      const saved = sessionStorage.getItem(storageKey);
      
      if (saved) {
        const parsedPreferences = JSON.parse(saved);
        
        // Merge con default per assicurarsi che tutte le proprietà esistano
        const mergedPreferences = {
          ...DEFAULT_PREFERENCES,
          ...parsedPreferences
        };
        
        setPreferences(mergedPreferences);
              } else {
                setPreferences(DEFAULT_PREFERENCES);
      }
    } catch (error) {
      console.error('❌ Errore nel caricamento delle preferenze:', error);
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setIsLoading(false);
    }
  };

  // Salva preferenze nel sessionStorage
  const savePreferences = (newPreferences: UserPreferences) => {
    try {
      const storageKey = getStorageKey();
      sessionStorage.setItem(storageKey, JSON.stringify(newPreferences));
          } catch (error) {
      console.error('❌ Errore nel salvataggio delle preferenze:', error);
    }
  };

  // Aggiorna singola preferenza
  const updatePreference = <K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => {
    const newPreferences = {
      ...preferences,
      [key]: value
    };
    
    setPreferences(newPreferences);
    savePreferences(newPreferences);
    
      };

  // Aggiorna multiple preferenze
  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    const updatedPreferences = {
      ...preferences,
      ...newPreferences
    };
    
    setPreferences(updatedPreferences);
    savePreferences(updatedPreferences);
    
      };

  // Reset alle preferenze default
  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
      };

  // Carica preferenze quando cambia utente
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      loadPreferences();
    }
  }, [user?.username]);

  // Migrazione automatica preferenze (se necessario)
  useEffect(() => {
    // Se l'utente ha il tema salvato separatamente nel ThemeContext, sincronizzalo
    const savedTheme = sessionStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme && savedTheme !== preferences.theme) {
      updatePreference('theme', savedTheme);
    }
  }, []);

  const contextValue: UserPreferencesContextType = {
    preferences,
    updatePreference,
    updatePreferences,
    resetPreferences,
    isLoading
  };

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

// Hook personalizzato per usare le preferenze
export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
}

// Hook specifico per ViewMode (per comodità)
export function useViewMode() {
  const { preferences, updatePreference } = useUserPreferences();
  
  const setViewMode = (mode: ViewMode) => {
    updatePreference('viewMode', mode);
    
    // Aggiorna anche le preferenze correlate
    updatePreference('showImages', mode === 'images');
    updatePreference('compactMode', mode === 'compact');
  };

  return {
    viewMode: preferences.viewMode,
    setViewMode,
    showImages: preferences.showImages,
    compactMode: preferences.compactMode
  };
}

// Hook per filtri default
export function useDefaultFilters() {
  const { preferences, updatePreference } = useUserPreferences();
  
  return {
    defaultCategory: preferences.defaultCategory,
    setDefaultCategory: (category: string) => updatePreference('defaultCategory', category),
    defaultPriority: preferences.defaultPriority,
    setDefaultPriority: (priority: string) => updatePreference('defaultPriority', priority),
    showCompleted: preferences.showCompleted,
    setShowCompleted: (show: boolean) => updatePreference('showCompleted', show),
  };
}

// Utility per debug - rimuovi in produzione
export const PreferencesDebugger = () => {
  const { preferences, resetPreferences } = useUserPreferences();
  
  
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '10px', 
      borderRadius: '5px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999 
    }}>
      <h4>🔧 Preferences Debug</h4>
      <pre>{JSON.stringify(preferences, null, 2)}</pre>
      <button onClick={resetPreferences} style={{ marginTop: '5px' }}>
        Reset Preferences
      </button>
    </div>
  );
};
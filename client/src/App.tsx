import { Switch, Route, Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UserPreferencesProvider } from "./contexts/UserPreferencesContext";
import UserSettings from "@/components/settings/UserSettings";
import { useCallback, useEffect, useState } from "react";

// 🔴 NUOVO: Import per sistema prezzi multipli
import { PriceSelectionManager } from "@/components/shopping/PriceSelectionManager";

// 🔄 RIPRISTINO: Hook hash routing originale (ma con fix iPhone)
function useHashLocation(): [string, (path: string) => void] {
  const [hash, setHash] = useState(() => {
    const currentHash = window.location.hash.slice(1) || '/';
    return currentHash;
  });
  
  useEffect(() => {
    const handler = () => {
      const newHash = window.location.hash.slice(1) || '/';
      setHash(newHash);
    };
    
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((to: string) => {
    try {
      window.location.hash = to;
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, []);

  return [hash, navigate];
}

function AppContent() {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-foreground font-medium">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // 🔄 RIPRISTINO: Switch routing come prima
  return (
    <>
      <Switch>
        <Route path="/settings">
          <div className="min-h-screen bg-background">
            <div className="container mx-auto p-6">
              <UserSettings />
            </div>
          </div>
        </Route>
        
        <Route>
          <Dashboard />
        </Route>
      </Switch>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <UserPreferencesProvider>
              {/* 🔄 RIPRISTINO: Router con useHashLocation */}
              <Router hook={useHashLocation}>
                <AppContent />
                <Toaster />
                <PriceSelectionManager />
              </Router>
            </UserPreferencesProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
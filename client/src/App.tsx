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
// ✅ NUOVO: Import UserSettings
import UserSettings from "@/components/settings/UserSettings";
import { useCallback, useEffect, useState } from "react";

// ✅ SPOSTATO FUORI: Hook personalizzato per GitHub Pages routing
function useHashLocation(): [string, (path: string) => void] {
  const [hash, setHash] = useState(window.location.hash.slice(1) || '/');
  
  useEffect(() => {
    const handler = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return [hash, navigate];
}

function AppContent() {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-eggshell flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-sienna"></div>
        <span className="ml-3 text-delft-blue font-medium">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // ✅ NUOVO: Router con rotta Settings
  return (
    <Switch>
      {/* ✅ Rotta Settings */}
      <Route path="/settings">
        <div className="min-h-screen bg-eggshell dark:bg-delft-blue">
          <div className="container mx-auto p-6">
            <UserSettings />
          </div>
        </div>
      </Route>
      
      {/* Dashboard principale (default) */}
      <Route>
        <Dashboard />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <UserPreferencesProvider>
              {/* ✅ CORRETTO: useHashLocation ora è accessibile */}
              <Router hook={useHashLocation}>
                <AppContent />
              </Router>
            </UserPreferencesProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
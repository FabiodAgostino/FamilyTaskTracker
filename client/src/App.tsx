import { Switch, Route } from "wouter";
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

  // 🔥 NORMAL ROUTING - come TripTaste
  return (
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
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <UserPreferencesProvider>
              {/* 🔥 RIMUOVO: Router con useHashLocation custom hook */}
              {/* 🔥 USO: Normal wouter routing (come TripTaste) */}
              <AppContent />
            </UserPreferencesProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
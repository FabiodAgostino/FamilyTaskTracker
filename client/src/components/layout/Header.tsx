import { Home, LogOut, Menu, User, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Link, useLocation } from 'wouter';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  const navItems = [
    { name: 'Lista della Spesa', path: '/shopping' },
    { name: 'Note', path: '/notes' },
    { name: 'Calendario', path: '/calendar' }
  ];

  return (
    <header className="bg-card shadow-md border-b border-border sticky top-0 z-40 transition-colors duration-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo e pulsante menu mobile */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden p-2 text-delft-blue hover:bg-muted"
              onClick={onMenuToggle}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center ml-2 lg:ml-0">
              <div className="w-8 h-8 bg-burnt-sienna rounded-lg flex items-center justify-center mr-3 shadow-sm">
                <Home className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-delft-blue">Compiti di Famiglia</h1>
            </div>
          </div>

          {/* Navigazione */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <Link key={item.name} href={item.path}>
                <span className={`font-medium px-1 pb-4 border-b-2 transition-colors cursor-pointer block ${
                  location === item.path
                    ? 'text-burnt-sienna border-burnt-sienna'
                    : 'text-muted-foreground hover:text-delft-blue border-transparent hover:border-muted'
                }`}>
                  {item.name}
                </span>
              </Link>
            ))}
          </nav>

          {/* Menu utente e controls */}
          <div className="flex items-center space-x-2">
            {/* ✅ NUOVO: Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full text-muted-foreground hover:text-delft-blue hover:bg-muted transition-colors"
              title={theme === 'light' ? 'Attiva modalità scura' : 'Attiva modalità chiara'}
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>

            {/* User info */}
            <div className="hidden sm:flex items-center space-x-2 ml-2">
              <div className="w-8 h-8 bg-cambridge-blue rounded-full flex items-center justify-center shadow-sm">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-delft-blue">{user?.username}</span>
            </div>
            
            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-9 h-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              title="Esci"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
import { Home, LogOut, Menu, User, Sun, Moon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Link, useLocation } from 'wouter';
import { Bell, BellOff } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
interface HeaderProps {
  onMenuToggle: () => void;
}

// Componente icona topo da Flaticon (URL diretto)
const RatIcon = ({ className }: { className?: string }) => (
  <img 
    src="https://cdn-icons-png.flaticon.com/512/6457/6457403.png"
    alt="rat icon"
    className={className}
    style={{ filter: 'brightness(0) invert(1)' }} // Rende l'icona bianca
  />
);

export function Header({ onMenuToggle }: HeaderProps) {
  const { permission, requestPermission, isSupported } = useNotifications();
  const { user, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  const navItems = [
    { name: 'Lista della Spesa', path: '/shopping' },
    { name: 'Note', path: '/notes' },
    { name: 'Calendario', path: '/calendar' },
  ];

  // ✅ NUOVO: Logica per il tema personalizzato
  const isTopiniTheme = user?.username === 'Fabio' || user?.username === 'Ludovica';
  
  const appConfig = isTopiniTheme 
    ? {
        icon: RatIcon,
        title: 'TopiniTask',
        iconBgColor: 'bg-burnt-sienna',
        iconTextColor: 'text-white'
      }
    : {
        icon: Home,
        title: 'HomeTask', 
        iconBgColor: 'bg-burnt-sienna',
        iconBgStyle: {},
        iconTextColor: 'text-white'
      };

  const AppIcon = appConfig.icon;

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
            
            {/* ✅ MODIFICATO: Logo dinamico */}
            <div className="flex items-center ml-2 lg:ml-0">
              <div 
                className={`w-8 h-8 ${appConfig.iconBgColor} rounded-lg flex items-center justify-center mr-3 shadow-sm`}
                style={appConfig.iconBgStyle}
              >
                <AppIcon className={`h-5 w-5 ${appConfig.iconTextColor}`} />
              </div>
              <h1 className="text-xl font-bold text-delft-blue">{appConfig.title}</h1>
              
              {/* ✅ BONUS: Badge utente per tema topini */}
              {isTopiniTheme && (
                <div className="ml-2 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
                  🐭 topiiiiiiii
                </div>
              )}
            </div>
          </div>

          {/* Navigazione - FIXATO: tutto insieme */}
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
            
            {/* ✅ FIXATO: Link TripTaste adesso è dentro la nav */}
            <a 
              href="https://fabiodagostino.github.io/TripTaste/#/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium px-1 pb-4 border-b-2 transition-colors cursor-pointer block text-muted-foreground hover:text-delft-blue border-transparent hover:border-muted flex items-center gap-1"
            >
              TripTaste
              <ExternalLink className="h-3 w-3" />
            </a>
          </nav>

          {/* Menu utente e controls */}
          <div className="flex items-center space-x-2">
            {/* Link TripTaste per mobile (visibile solo su mobile) */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-muted-foreground hover:text-delft-blue w-9 h-9 rounded-full"
              >
                <a 
                  href="https://fabiodagostino.github.io/TripTaste/#/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                  title="TripTaste"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>

            {/* ✅ MANTENUTO: Dark Mode Toggle */}
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

            {isSupported && (
              <Button
                variant="ghost"
                size="sm"
                onClick={requestPermission}
                className="w-9 h-9 rounded-full text-muted-foreground hover:text-delft-blue hover:bg-muted transition-colors"
                title={permission === 'granted' ? 'Notifiche attive' : 'Attiva notifiche'}
              >
                {permission === 'granted' ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* User info con tema personalizzato */}
            <div className="hidden sm:flex items-center space-x-2 ml-2">
              <div 
                className={`w-8 h-8 ${isTopiniTheme ? '' : 'bg-cambridge-blue'} rounded-full flex items-center justify-center shadow-sm`}
                style={isTopiniTheme ? { backgroundColor: 'rgb(37, 99, 235)' } : {}}
              >
                {isTopiniTheme ? (
                  <RatIcon className="h-4 w-4 text-white" />
                ) : (
                  <User className="h-4 w-4 text-white" />
                )}
              </div>
              <span className="text-sm font-medium text-delft-blue">
                {isTopiniTheme ? `${user?.username}` : user?.username}
              </span>
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
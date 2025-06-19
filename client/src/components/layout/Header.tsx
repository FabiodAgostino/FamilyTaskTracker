import { Home, LogOut, Menu, User, Sun, Moon, ExternalLink, Settings, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Link, useLocation } from 'wouter';
import { Bell, BellOff } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

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

            {/* Notifiche */}
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

            {/* ✅ NUOVO: User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="hidden sm:flex items-center space-x-2 ml-2 h-auto p-2 hover:bg-muted transition-colors rounded-lg"
                >
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
                    {user?.username}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-56">
                {/* Header del dropdown */}
                <DropdownMenuLabel className="flex items-center space-x-2">
                  <div 
                    className={`w-6 h-6 ${isTopiniTheme ? '' : 'bg-cambridge-blue'} rounded-full flex items-center justify-center`}
                    style={isTopiniTheme ? { backgroundColor: 'rgb(37, 99, 235)' } : {}}
                  >
                    {isTopiniTheme ? (
                      <RatIcon className="h-3 w-3 text-white" />
                    ) : (
                      <User className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{user?.username}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Badge variant="outline" className="px-1 py-0 text-xs">
                        {user?.role}
                      </Badge>
                      {isTopiniTheme && <span>🐭</span>}
                    </div>
                  </div>
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator />
                
                {/* Menu Items */}
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Impostazioni</span>
                  </Link>
                </DropdownMenuItem>
                
                {/* Azioni tema (opzionale) */}
                <DropdownMenuItem onClick={toggleTheme} className="flex items-center cursor-pointer">
                  {theme === 'light' ? (
                    <Moon className="mr-2 h-4 w-4" />
                  ) : (
                    <Sun className="mr-2 h-4 w-4" />
                  )}
                  <span>{theme === 'light' ? 'Tema Scuro' : 'Tema Chiaro'}</span>
                </DropdownMenuItem>

                {/* Notifiche nel menu */}
                {isSupported && (
                  <DropdownMenuItem onClick={requestPermission} className="flex items-center cursor-pointer">
                    {permission === 'granted' ? (
                      <Bell className="mr-2 h-4 w-4" />
                    ) : (
                      <BellOff className="mr-2 h-4 w-4" />
                    )}
                    <span>
                      {permission === 'granted' ? 'Notifiche Attive' : 'Attiva Notifiche'}
                    </span>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                {/* Logout */}
                <DropdownMenuItem 
                  onClick={logout} 
                  className="flex items-center cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Esci</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ✅ Mobile user icon (senza dropdown, solo per spazi stretti) */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="w-9 h-9 rounded-full text-muted-foreground hover:text-delft-blue hover:bg-muted transition-colors"
                  >
                    <div 
                      className={`w-6 h-6 ${isTopiniTheme ? '' : 'bg-cambridge-blue'} rounded-full flex items-center justify-center`}
                      style={isTopiniTheme ? { backgroundColor: 'rgb(37, 99, 235)' } : {}}
                    >
                      {isTopiniTheme ? (
                        <RatIcon className="h-3 w-3 text-white" />
                      ) : (
                        <User className="h-3 w-3 text-white" />
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>
                    <div className="font-medium">{user?.username}</div>
                    <div className="text-xs text-muted-foreground">{user?.role}</div>
                  </DropdownMenuLabel>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Impostazioni</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={logout} 
                    className="flex items-center cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Esci</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* ✅ RIMOSSO: Logout diretto - ora è nel dropdown */}
          </div>
        </div>
      </div>
    </header>
  );
}
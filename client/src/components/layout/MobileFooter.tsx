import {
  Home,
  LogOut,
  User,
  Sun,
  Moon,
  Settings,
  Users,
  ShoppingBasket,
  NotebookText,
  CalendarDays,
  Pizza, // Icona per "Spesa"
  Bell,
  BellOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Link, useLocation } from 'wouter';
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

// Riuso dell'icona personalizzata e della logica del tema
const RatIcon = ({ className }: { className?: string }) => (
  <img
    src="https://cdn-icons-png.flaticon.com/512/6457/6457403.png"
    alt="rat icon"
    className={className}
    style={{ filter: 'brightness(0) invert(1)' }}
  />
);

export function MobileFooter() {
  const { user, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const { permission, requestPermission, isSupported, token, isManuallyDisabled, disableNotifications, enableNotifications } = useNotifications();

  // Logica per tema e ruolo utente
  const isTopiniTheme = user?.username === 'Fabio' || user?.username === 'Ludovica';
  const isAdmin = user?.role === 'admin';

  // Array di navigazione con icone per il footer
  const navItems = [
    { name: 'Shopping', path: '/shopping', icon: ShoppingBasket },
    { name: 'Note', path: '/notes', icon: NotebookText },
    { name: 'Calendario', path: '/calendar', icon: CalendarDays },
    { name: 'Spesa', path: '/shoppingfood', icon: Pizza },
  ];

  const getNotificationStatus = () => {
    if (permission !== 'granted') return { icon: BellOff, text: 'Attiva Notifiche', color: 'text-muted-foreground' };
    if (token) return { icon: Bell, text: 'Notifiche Attive', color: 'text-green-500' };
    if (isManuallyDisabled) return { icon: BellOff, text: 'Notifiche Disabilitate', color: 'text-red-500' };
    return { icon: Bell, text: 'Configura notifiche', color: 'text-blue-500' };
  };
  const StatusIcon = getNotificationStatus().icon;

  // Icona utente dinamica
  const UserAvatarIcon = isTopiniTheme ? RatIcon : User;

  return (
    <footer className="sm:hidden fixed bottom-0 left-0 w-full bg-background border-t border-border shadow-up z-50">
      <div className="flex justify-between items-center h-16 px-4">

        {/* Colonna 2: Navigazione centrale con icone */}
        <nav className="flex-1 flex justify-center items-center space-x-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-12 w-12 rounded-full flex flex-col items-center justify-center space-y-1 transition-colors ${
                    isActive ? 'text-primary ' : 'text-muted-foreground hover:text-primary hover:bg-muted'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${
                    isActive ? 'text-cambridge-newStyle' : '' }`} />
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Colonna 3: Menu Utente */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <UserAvatarIcon className="h-5 w-5 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56 mb-2">
            <DropdownMenuLabel>
              <div className="font-medium">{user?.username}</div>
              <div className="text-xs text-muted-foreground">{user?.role}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
              {theme === 'light' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
              <span>{theme === 'light' ? 'Tema Scuro' : 'Tema Chiaro'}</span>
            </DropdownMenuItem>

            {isSupported && (
              <DropdownMenuItem onClick={() => (permission === 'granted' ? disableNotifications() : requestPermission())} className="cursor-pointer">
                 <StatusIcon className={`mr-2 h-4 w-4 ${getNotificationStatus().color}`} />
                 <span className={getNotificationStatus().color}>{getNotificationStatus().text}</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem asChild>
               <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Impostazioni</span>
              </Link>
            </DropdownMenuItem>

            {isAdmin && (
               <DropdownMenuItem asChild>
                <Link href="/admin/panel" className="cursor-pointer">
                  <Users className="mr-2 h-4 w-4" />
                  <span>Pannello Admin</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Esci</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </footer>
  );
}
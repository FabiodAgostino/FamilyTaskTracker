import { Home, LogOut, Menu, User, Sun, Moon, ExternalLink, Settings, ChevronDown, Users } from 'lucide-react';
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
import { VersionBadge, MobileVersionBadge } from '@/components/common/VersionBadge';
import { NotificationCenter } from '../user/NotificationCenter';
import { usePriceSelectionService } from '@/components/shopping/PriceSelectionManager';
import { useMenu } from '@/hooks/use-menu';

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
const { permission, requestPermission, isSupported, token, debug, isInitializing, disableNotifications, enableNotifications, isManuallyDisabled } = useNotifications();
  const priceSelectionService = usePriceSelectionService();


  const { user, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  const navItems = useMenu().filter(x=> x.onlyHeader);
  const getNotificationStatus = () => {
  if (permission !== 'granted') return { icon: BellOff, text: 'Attiva Notifiche', color: 'text-muted-foreground' };
  if (isInitializing) return { icon: Bell, text: 'Configurazione token in corso...', color: 'text-blue-500' };
  if (token) return { icon: Bell, text: 'Notifiche Attive', color: 'text-green-500' };
  if (isManuallyDisabled) return { icon: BellOff, text: 'Notifiche Disabilitate', color: 'text-red-500' };
  return { icon: Bell, text: 'Configurazione token in corso...', color: 'text-blue-500' };
};
  // ✅ NUOVO: Logica per il tema personalizzato
  const isTopiniTheme = user?.username === 'Fabio' || user?.username === 'Ludovica';
  // ✅ FIX: Controllo admin senza usare isAdmin()
  const isAdmin = user?.role === 'admin';
  
  const appConfig = isTopiniTheme 
    ? {
        icon: RatIcon,
        title: 'TopiniTask',
        iconBgColor: 'bg-burnt-newStyle',
        iconTextColor: 'text-white'
      }
    : {
        icon: Home,
        title: 'HomeTask', 
        iconBgColor: 'bg-burnt-newStyle',
        iconBgStyle: {},
        iconTextColor: 'text-white'
      };

  const AppIcon = appConfig.icon;

  return (
    <>
    <header className="bg-card shadow-md border-b border-border sticky top-0 z-50 transition-colors duration-200">
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

          {/* Navigazione - tutto insieme */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <Link key={item.name} href={item.path}>
                <span className={`font-medium px-1 pb-4 border-b-2 transition-colors cursor-pointer block ${
                  location === item.path
                    ? 'text-burnt-newStyle border-burnt-newStyle'
                    : 'text-muted-foreground hover:text-delft-blue border-transparent hover:border-muted'
                }`}>
                  {item.name}
                </span>
              </Link>
            ))}
          </nav>

          {/* Menu utente, version badge e controls */}
          <div className="flex items-center space-x-3">
            
            {/* 🆕 AGGIUNTO: Version Badge - Desktop */}
            <div className="hidden md:flex items-center space-x-2">
              <VersionBadge variant="default" />
               <NotificationCenter 
                variant="desktop"
                priceSelectionService={priceSelectionService}
              />
            </div>

            {/* 🆕 AGGIUNTO: Version Badge - Tablet (compatto) */}
            <div className="hidden sm:block md:hidden">
              <VersionBadge variant="compact" />
            </div>

            {/* ✅ User Dropdown Menu - Desktop/Tablet */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="hidden sm:flex items-center space-x-2 ml-2 h-auto p-2 hover:bg-muted transition-colors rounded-lg"
                >
                  <div 
                    className={`w-8 h-8 ${isTopiniTheme ? '' : 'bg-cambridge-newStyle'} rounded-full flex items-center justify-center shadow-sm`}
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
                    className={`w-6 h-6 ${isTopiniTheme ? '' : 'bg-cambridge-newStyle'} rounded-full flex items-center justify-center`}
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
                
                {/* ✅ AGGIUNTO: Toggle tema nel dropdown */}
                <DropdownMenuItem onClick={toggleTheme} className="flex items-center cursor-pointer">
                  {theme === 'light' ? (
                    <Moon className="mr-2 h-4 w-4" />
                  ) : (
                    <Sun className="mr-2 h-4 w-4" />
                  )}
                  <span>{theme === 'light' ? 'Tema Scuro' : 'Tema Chiaro'}</span>
                </DropdownMenuItem>

                {/* ✅ AGGIUNTO: Notifiche nel dropdown */}
            {isSupported && (() => {
  const status = getNotificationStatus();
  const StatusIcon = status.icon;
  
  return (
    <DropdownMenuItem 
  onClick={async () => {
  try {
    if (permission === 'granted') {
      if (token) {
        await disableNotifications();
      } else if (isManuallyDisabled) {
        await enableNotifications();
      }
    } else {
      await requestPermission();
    }
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}}
      className="flex items-center cursor-pointer"
    >
      <StatusIcon className={`mr-2 h-4 w-4 ${status.color}`} />
      <span className={status.color}>{status.text}</span>
    </DropdownMenuItem>
  );
})()}

                <DropdownMenuSeparator />
                
                {/* Menu Items */}
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Impostazioni</span>
                  </Link>
                </DropdownMenuItem>
                
                {/* ✅ AGGIUNTO: Menu amministrazione solo per admin */}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/panel" className="flex items-center cursor-pointer">
                      <Users className="mr-2 h-4 w-4" />
                        <span>Pannello amministratore</span>

                    </Link>
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

            {/* 🔧 FIXED: Mobile user icon - Dimensioni aumentate */}
            <div className="sm:hidden flex items-center space-x-2">
                <NotificationCenter 
                variant="mobile"
                priceSelectionService={priceSelectionService}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="default"
                    className="w-12 h-12 rounded-full p-2 text-muted-foreground hover:text-delft-blue hover:bg-muted transition-colors"
                  >
                    <div 
                      className={`w-8 h-8 ${isTopiniTheme ? '' : 'bg-cambridge-newStyle'} rounded-full flex items-center justify-center shadow-sm`}
                      style={isTopiniTheme ? { backgroundColor: 'rgb(37, 99, 235)' } : {}}
                    >
                      {isTopiniTheme ? (
                        <RatIcon className="h-5 w-5 text-white" />
                      ) : (
                        <User className="h-5 w-5 text-white" />
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent align="end" className="w-52">
                  {/* 🆕 AGGIUNTO: Header mobile con version */}
                  <div className="p-3 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{user?.username}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Badge variant="outline" className="px-1 py-0 text-xs">
                            {user?.role}
                          </Badge>
                          {isTopiniTheme && <span>🐭</span>}
                        </div>
                      </div>
                      <MobileVersionBadge />
                    </div>
                  </div>
                  

                  
                 {/* 🆕 AGGIUNTO: Tema e notifiche su mobile */}
                <DropdownMenuItem onClick={toggleTheme} className="flex items-center cursor-pointer">
                  {theme === 'light' ? (
                    <Moon className="mr-2 h-4 w-4" />
                  ) : (
                    <Sun className="mr-2 h-4 w-4" />
                  )}
                  <span>{theme === 'light' ? 'Tema Scuro' : 'Tema Chiaro'}</span>
                </DropdownMenuItem>

                {/* ✅ MODIFICATO: Notifiche mobile con stato avanzato */}
                {isSupported && (() => {
                  const status = getNotificationStatus();
                  const StatusIcon = status.icon;
                  
                  return (
                    <DropdownMenuItem 
                    onClick={async () => {
                      try {
                        if (permission === 'granted') {
                          if (token) {
                            await disableNotifications();
                          } else if (isManuallyDisabled) {
                            await enableNotifications();
                          }
                        } else {
                          await requestPermission();
                        }
                      } catch (error) {
                        console.error('❌ Errore:', error);
                      }
                    }}
                      className="flex items-center cursor-pointer"
                    >
                      <StatusIcon className={`mr-2 h-4 w-4 ${status.color}`} />
                      <span className={status.color}>{status.text}</span>
                    </DropdownMenuItem>
                  );
                })()}

                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Impostazioni</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  {/* ✅ AGGIUNTO: Gestione utenti anche su mobile per admin */}
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/panel" className="flex items-center cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        <span>Pannello amministratore</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  
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
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from "wouter"; // <-- IMPORTANTE: Integrazione con Wouter
import {
  LogOut,
  User,
  Sun,
  Moon,
  Settings,
  Users,
  ShoppingBasket,
  NotebookText,
  CalendarDays,
  Pizza,
  Bell,
  BellOff,
  Plus,
} from 'lucide-react';

// ============================================================================
// TIPI E INTERFACCE
// ============================================================================

type LucideIconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface UserData {
  username: string;
  role: string;
}

interface NavItem {
  name: string;
  path: string;
  icon: LucideIconType | React.ComponentType<{ className?: string }>;
}

// ============================================================================
// ICONE PERSONALIZZATE E SIMULATE
// ============================================================================

const CreditCardIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
  </svg>
);

const RatIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img
    src="https://cdn-icons-png.flaticon.com/512/6457/6457403.png"
    alt="rat icon"
    className={className}
    style={{ filter: 'brightness(0) invert(1)' }}
  />
);

// ============================================================================
// HOOK SIMULATI (Questi rimangono per l'autonomia del componente)
// ============================================================================

const useAuthContext = () => ({
  user: { username: 'Fabio', role: 'admin' } as UserData,
  logout: () => console.log('Logout eseguito'),
});

const useTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    console.log('Tema cambiato');
  };
  return { theme, toggleTheme };
};

const useNotifications = () => ({
  permission: 'granted' as NotificationPermission,
  requestPermission: () => console.log('Richiesta permessi notifiche'),
  isSupported: true,
  token: 'mock-token',
  isManuallyDisabled: false,
  disableNotifications: () => console.log('Notifiche disabilitate'),
});

// ============================================================================
// COMPONENTI UI (Dropdown Menu)
// ============================================================================

const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {React.Children.map(children, child =>
        React.isValidElement(child) ? React.cloneElement(child, { isOpen, setIsOpen } as any) : child
      )}
    </div>
  );
};

const DropdownMenuTrigger: React.FC<{ children: React.ReactNode; setIsOpen?: React.Dispatch<React.SetStateAction<boolean>> }> = ({ children, setIsOpen }) => (
  <div onClick={() => setIsOpen?.(prev => !prev)}>{children}</div>
);

const DropdownMenuContent: React.FC<{ children: React.ReactNode; className?: string; isOpen?: boolean; }> = ({ children, className = '', isOpen }) => {
  if (!isOpen) return null;
  return (
    <div className={`absolute right-0 bottom-full mb-2 w-56 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg p-1 z-50 ${className}`}>
      {children}
    </div>
  );
};

const DropdownMenuItem: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string; setIsOpen?: React.Dispatch<React.SetStateAction<boolean>>; }> = ({ children, onClick, className = '', setIsOpen }) => (
  <button
    className={`w-full p-2 text-sm flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-left ${className}`}
    onClick={() => {
      onClick?.();
      setIsOpen?.(false);
    }}
  >
    {children}
  </button>
);

const DropdownMenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-2 text-sm font-medium text-gray-500 dark:text-gray-400">{children}</div>
);

const DropdownMenuSeparator: React.FC = () => <div className="border-t dark:border-gray-700 my-1" />;

// ============================================================================
// COMPONENTE MOBILE FOOTER (Logica principale)
// ============================================================================

// Rimosse le props 'currentPage' e 'setCurrentPage'
const MobileFooter: React.FC = () => {
  // Usa l'hook di Wouter per ottenere la posizione e la funzione di navigazione
  const [location, navigate] = useLocation();

  const { user, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const { permission, isSupported, token, isManuallyDisabled, disableNotifications } = useNotifications();

  const [showBubble, setShowBubble] = useState<boolean>(false);

  const isTopiniTheme = user?.username === 'Fabio' || user?.username === 'Ludovica';
  const isAdmin = user?.role === 'admin';

  const navItems: NavItem[] = [
    // Per il routing hash, i percorsi devono iniziare con '/'
    { name: 'Shopping', path: '/shopping', icon: ShoppingBasket },
    { name: 'Note', path: '/notes', icon: NotebookText },
    { name: 'Calendario', path: '/calendar', icon: CalendarDays },
    { name: 'Spesa', path: '/shoppingfood', icon: Pizza },
    { name: 'Wallet', path: '/digitalwallet', icon: CreditCardIcon },
  ];

  const mainApps = navItems.slice(0, 2);
  const bubbleApps = navItems.slice(2);

  const getNotificationStatus = () => {
    if (permission !== 'granted') return { icon: BellOff, text: 'Attiva Notifiche', color: 'text-gray-400' };
    if (token) return { icon: Bell, text: 'Notifiche Attive', color: 'text-green-500' };
    if (isManuallyDisabled) return { icon: BellOff, text: 'Notifiche Disabilitate', color: 'text-red-500' };
    return { icon: Bell, text: 'Configura notifiche', color: 'text-blue-500' };
  };

  const StatusIcon = getNotificationStatus().icon;
  const UserAvatarIcon = isTopiniTheme ? RatIcon : User;

  // Funzione di navigazione che usa il navigate di Wouter
  const handleNavigation = (path: string) => {
    navigate(path);
    setShowBubble(false);
  };

  return (
    <footer className={`sm:hidden fixed bottom-0 left-0 w-full border-t shadow-lg z-50 ${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
      {showBubble && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowBubble(false)} />
          <div
            className={`absolute bottom-20 left-1/2 rounded-3xl p-4 shadow-2xl border min-w-[280px] z-50 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
            style={{ transform: 'translateX(-50%)', animation: 'slideInUp 0.3s ease-out forwards' }}
          >
            <div className="grid grid-cols-3 gap-2">
              {bubbleApps.map((item, index) => {
                const Icon = item.icon;
                // Usa 'location' da Wouter per determinare lo stato attivo
                const isActive = location === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`h-20 w-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 ${
                      isActive ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/50' : 'hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    style={{ animation: `slideInItem 0.4s ease-out ${index * 80}ms forwards`, opacity: 0 }}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs mt-1 font-medium">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex justify-around items-center h-16 px-2">
        {mainApps.map(item => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`h-full w-20 rounded-lg flex flex-col items-center justify-center space-y-1 transition-colors ${
                isActive ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/40' : 'text-gray-500 hover:text-blue-500'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{item.name}</span>
            </button>
          );
        })}

        <button
          onClick={() => setShowBubble(!showBubble)}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            showBubble ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/50' : 'text-gray-500 hover:text-blue-500'
          }`}
          style={{ transform: showBubble ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          <Plus className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="h-14 w-14 flex items-center justify-center">
              <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer">
                <UserAvatarIcon className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <div className="font-medium">{user?.username}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="mr-2 h-3 w-3" /> : <Sun className="mr-2 h-3 w-3" />}
              <span>{theme === 'light' ? 'Tema Scuro' : 'Tema Chiaro'}</span>
            </DropdownMenuItem>

            {isSupported && (
              <DropdownMenuItem onClick={disableNotifications}>
                <StatusIcon className={`mr-2 h-3 w-3 ${getNotificationStatus().color}`} />
                <span className={getNotificationStatus().color}>{getNotificationStatus().text}</span>
              </DropdownMenuItem>
            )}
            
            <DropdownMenuItem onClick={() => handleNavigation('/settings')}>
                <Settings className="mr-2 h-3 w-3" />
                <span>Impostazioni</span>
            </DropdownMenuItem>

            {isAdmin && (
                <DropdownMenuItem onClick={() => handleNavigation('/admin/panel')}>
                    <Users className="mr-2 h-3 w-3" />
                    <span>Pannello Admin</span>
                </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-500">
              <LogOut className="mr-2 h-3 w-3" />
              <span>Esci</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes slideInItem {
          from { opacity: 0; transform: translateY(20px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        body { background-color: ${theme === 'dark' ? '#111827' : '#f9fafb'}; }
      `}} />
    </footer>
  );
};


export default MobileFooter;

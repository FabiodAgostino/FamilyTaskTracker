import React, { useState, useRef, useEffect } from 'react';
// *** FIX 2: Passaggio a useHashLocation per compatibilità con l'hash routing ***
// Questo è il fix più probabile per il problema dell'icona "Shopping" che si attiva in modo errato.
import { useHashLocation as useLocation } from "wouter/use-hash-location";
// La riga seguente è stata commentata perché probabilmente non adatta alla configurazione del tuo router.
// import { useLocation } from "wouter"; 
import {
  LogOut,
  User,
  Sun,
  Moon,
  Settings,
  Users,
  // Removed unused icon imports
  Bell,
  BellOff,
  Plus,
  // Removed unused ExternalLink import
} from 'lucide-react';

// ============================================================================
// IMPORT DEGLI HOOK E CONTESTI REALI (COME NELL'HEADER)
// ============================================================================
import { useAuthContext } from '@/contexts/AuthContext'; // Importa il contesto reale
import { useTheme } from '@/contexts/ThemeContext';     // Importa il contesto reale
import { useNotifications } from '@/hooks/useNotifications'; // Importa l'hook reale
import { useMenu } from '@/hooks/use-menu';

// ============================================================================
// TIPI E INTERFACCE (Come da tuo codice originale, non modificato)
// ============================================================================

// Removed unused LucideIconType

// Removed unused interfaces

// ============================================================================
// ICONE PERSONALIZZATE E SIMULATE (Come da tuo codice originale, non modificato)
// ============================================================================

// Removed unused CreditCardIcon component
/*
const _CreditCardIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
  </svg>
);
*/

const RatIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img
    src="https://cdn-icons-png.flaticon.com/512/6457/6457403.png"
    alt="rat icon"
    className={className}
    style={{ filter: 'brightness(0) invert(1)' }}
  />
);


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

const MobileFooter: React.FC = () => {
  const [location, navigate] = useLocation();

  // ORA USIAMO GLI HOOK REALI, COME NELL'HEADER!
  const { user, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  // Destrutturiamo tutti i valori necessari per la logica completa delle notifiche
  const { permission, requestPermission, isSupported, token, isInitializing, disableNotifications, enableNotifications, isManuallyDisabled } = useNotifications();


  const [showBubble, setShowBubble] = useState<boolean>(false);

  const isTopiniTheme = user?.username === 'Fabio' || user?.username === 'Ludovica';
  const isAdmin = user?.role === 'admin';

  const navItems = useMenu();

  const mainApps = navItems.slice(0, 2);
  const bubbleApps = navItems.slice(2);

  // Considera se `isBubblePathActive` debba usare `location.startsWith` per link esterni
  const isBubblePathActive = bubbleApps.some(item => item.path === location || (item.path.includes("https://") && location.startsWith(item.path.split('#')[0])));


  // Logica per ottenere lo stato delle notifiche (ORA ALLINEATA CON L'HEADER)
  const getNotificationStatus = () => {
    if (permission !== 'granted') return { icon: BellOff, text: 'Attiva Notifiche', color: 'text-gray-400' };
    if (isInitializing) return { icon: Bell, text: 'Configurazione token in corso...', color: 'text-blue-500' }; // Come nell'Header
    if (token) return { icon: Bell, text: 'Notifiche Attive', color: 'text-green-500' };
    if (isManuallyDisabled) return { icon: BellOff, text: 'Notifiche Disabilitate', color: 'text-red-500' };
    return { icon: Bell, text: 'Configura notifiche', color: 'text-blue-500' }; // Testo aggiornato per rispecchiare l'Header
  };

  const StatusIcon = getNotificationStatus().icon;
  const UserAvatarIcon = isTopiniTheme ? RatIcon : User;

  const handleNavigation = (path: string) => {
    if(path.includes("https://"))
      window.open(path, '_blank', 'noopener,noreferrer');
    else
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
                // Gestione dell'active state per link esterni (allineata con l'Header)
                const isActive = item.path === location || (item.path.includes("https://") && location.startsWith(item.path.split('#')[0]));
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`h-20 w-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 ${
                      isActive ? 'text-burnt-newStyle' : 'hover:text-burnt-newStyle hover:bg-gray-100 dark:hover:bg-gray-700'
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
          // Gestione dell'active state per link esterni (allineata con l'Header)
          const isActive = item.path === location || (item.path.includes("https://") && location.startsWith(item.path.split('#')[0]));
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`h-full w-20 rounded-lg flex flex-col items-center justify-center space-y-1 transition-colors ${
                isActive ? 'text-burnt-newStyle' : 'text-gray-500 hover:text-burnt-newStyle'
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
            (showBubble || isBubblePathActive) ? 'text-burnt-newStyle' : ''
          }`}
          style={{ transform: showBubble || isBubblePathActive ? 'rotate(45deg)' : 'rotate(0deg)' }}
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
              // LOGICA AVANZATA DELLE NOTIFICHE COME NELL'HEADER
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
              >
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
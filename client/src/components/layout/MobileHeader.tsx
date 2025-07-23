// client/src/components/layout/MobileHeader.tsx

import { Home } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePriceSelectionService } from '@/components/shopping/PriceSelectionManager';
import { NotificationCenter } from '../user/NotificationCenter';

// Riuso dell'icona personalizzata e della logica del tema
const RatIcon = ({ className }: { className?: string }) => (
  <img
    src="https://cdn-icons-png.flaticon.com/512/6457/6457403.png"
    alt="rat icon"
    className={className}
    style={{ filter: 'brightness(0) invert(1)' }} // Rende l'icona bianca
  />
);

export function MobileHeader() {
  const { user } = useAuthContext();
  const priceSelectionService = usePriceSelectionService(); // Necessario per NotificationCenter

  // Logica per tema e ruolo utente
  const isTopiniTheme = user?.username === 'Fabio' || user?.username === 'Ludovica';

  const appConfig = isTopiniTheme
    ? {
        icon: RatIcon,
        title: 'TopiniTask',
        iconBgColor: 'bg-blue-600', // Colore per tema Topini
        iconTextColor: 'text-white'
      }
    : {
        icon: Home,
        title: 'HomeTask',
        iconBgColor: 'bg-burnt-newStyle', // Colore standard
        iconTextColor: 'text-white'
      };

  const AppIcon = appConfig.icon;

  return (
    <header className="sm:hidden flex items-center justify-between h-14 px-4 bg-background border-b border-border shadow-md z-10">
      {/* Sezione Sinistra: Logo e Titolo */}
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 ${appConfig.iconBgColor} rounded-lg flex items-center justify-center shadow-sm`}
        >
          <AppIcon className={`h-5 w-5 ${appConfig.iconTextColor}`} />
        </div>
        <h1 className="text-xl font-bold text-foreground">{appConfig.title}</h1>
        {isTopiniTheme && (
          <div className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
            🐭
          </div>
        )}
      </div>

      {/* Sezione Destra: Azioni */}
      <div className="flex items-center space-x-2">
        <NotificationCenter
          variant="mobile"
          priceSelectionService={priceSelectionService}
        />
      </div>
    </header>
  );
}
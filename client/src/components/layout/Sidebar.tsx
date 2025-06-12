import { ShoppingCart, StickyNote, Calendar, User, Clock } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();

  const sidebarItems = [
    {
      name: 'Lista della Spesa',
      path: '/shopping',
      icon: ShoppingCart,
      count: 3,
      color: 'bg-burnt-sienna'
    },
    {
      name: 'Note',
      path: '/notes',
      icon: StickyNote,
      count: 12,
      color: 'bg-cambridge-blue'
    },
    {
      name: 'Calendario',
      path: '/calendar',
      icon: Calendar,
      count: 2,
      color: 'bg-sunset'
    }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out mt-16 lg:mt-0 lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full pt-5 pb-4">
          <nav className="flex-1 px-4 space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.name} href={item.path}>
                  <div 
                    className={cn(
                      "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                      isActive
                        ? "bg-burnt-sienna bg-opacity-10 text-burnt-sienna"
                        : "text-gray-600 hover:bg-gray-50 hover:text-delft-blue"
                    )}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                    <span className={cn(
                      "ml-auto text-xs px-2 py-1 rounded-full",
                      isActive
                        ? "bg-burnt-sienna text-white"
                        : "text-gray-400"
                    )}>
                      {item.count}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
          
          <div className="px-4 pt-4 border-t border-gray-200">
            <div className="bg-cambridge-blue bg-opacity-10 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-delft-blue mb-2">Statistiche Rapide</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Completati Oggi</span>
                  <span className="font-medium">5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Eventi Prossimi</span>
                  <span className="font-medium">2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

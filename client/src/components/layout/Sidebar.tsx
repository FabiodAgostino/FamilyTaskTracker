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
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* ✅ CORRETTO: Sidebar full-height con theme support */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-card border-r border-border shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:w-64",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* ✅ NUOVO: Container full-height che parte da sotto header su mobile */}
        <div className="flex flex-col h-full pt-16 lg:pt-0">
          
          {/* ✅ Header sidebar (solo desktop) */}
          <div className="hidden lg:block px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-card-foreground">Menu</h2>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.name} href={item.path}>
                  <div 
                    className={cn(
                      "group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-burnt-sienna/10 text-burnt-sienna border border-burnt-sienna/20"
                        : "text-muted-foreground hover:bg-muted hover:text-card-foreground border border-transparent"
                    )}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                  >
                    <Icon className={cn(
                      "mr-3 h-5 w-5 transition-colors",
                      isActive ? "text-burnt-sienna" : "text-muted-foreground group-hover:text-card-foreground"
                    )} />
                    <span className="flex-1">{item.name}</span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium transition-colors",
                      isActive
                        ? "bg-burnt-sienna text-white"
                        : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10"
                    )}>
                      {item.count}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
          
          {/* ✅ MIGLIORATO: Footer statistiche con theme support */}
          <div className="px-4 py-4 border-t border-border mt-auto">
            <div className="bg-cambridge-blue/10 dark:bg-cambridge-blue/20 rounded-lg p-4 border border-cambridge-blue/20">
              <div className="flex items-center mb-3">
                <Clock className="h-4 w-4 text-cambridge-blue mr-2" />
                <h3 className="text-sm font-semibold text-card-foreground">Statistiche Rapide</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Completati Oggi</span>
                  <span className="font-medium text-cambridge-blue bg-cambridge-blue/10 px-2 py-1 rounded-full">5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Eventi Prossimi</span>
                  <span className="font-medium text-sunset bg-sunset/10 px-2 py-1 rounded-full">2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
import { Clock, ExternalLink } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import {Note, CalendarEvent } from '@/lib/models/types';
import { isSameDay, isAfter } from 'date-fns';
import { ShoppingItem } from '@/lib/models/shopping-item';
// Removed unused react-icons imports
import { ShoppingFood } from '@/lib/models/food';
// Removed unused FaCartShopping, FaNoteSticky imports
// Removed unused CiCreditCard1 import
import { useMenu } from '@/hooks/use-menu';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuthContext();

  // ✅ NUOVO: Fetch dei dati reali
  const { data: shoppingItems } = useFirestore<ShoppingItem>('shopping_items');
  const { data: notes } = useFirestore<Note>('notes');
  const { data: events } = useFirestore<CalendarEvent>('calendar_events');
  const { data: shoppingFood } = useFirestore<ShoppingFood>('shopping_food');


  // ✅ NUOVO: Calcolo statistiche dinamiche
  const stats = useMemo(() => {
    const today = new Date();
    
    // Filtra elementi visibili all'utente corrente
    const visibleShoppingItems = shoppingItems.filter(item => 
      item.isPublic || item.createdBy === user?.username || user?.role === 'admin'
    );
    const visibleShoppingFood = shoppingFood.filter(item => 
      item.isPublic || item.createdBy === user?.username || user?.role === 'admin'
    );
    const totalShoppingFood = visibleShoppingFood.length;
    
    const visibleNotes = notes.filter(note => 
      note.isPublic || note.createdBy === user?.username || user?.role === 'admin'
    );
    
    const visibleEvents = events.filter(event => 
      event.isPublic || event.createdBy === user?.username || user?.role === 'admin'
    );

    // Statistiche shopping
    const pendingShoppingItems = visibleShoppingItems.filter(item => !item.completed).length;
    const completedTodayItems = visibleShoppingItems.filter(item => 
      item.completed && item.completedAt && isSameDay(item.completedAt, today)
    ).length;

    // Statistiche note
    const totalNotes = visibleNotes.length;

    // Statistiche eventi
    const upcomingEvents = visibleEvents.filter(event => 
      isAfter(event.startDate, today)
    ).length;

    return {
      shopping: pendingShoppingItems,
      notes: totalNotes,
      calendar: upcomingEvents,
      completedToday: completedTodayItems,
      upcomingEvents: upcomingEvents,
      shoppingFood: totalShoppingFood
    };
  }, [shoppingItems, notes, events, user]);

  // ✅ MIGLIORATO: Sidebar items con statistiche dinamiche
  const sidebarItems = useMenu();
  sidebarItems.forEach(x=>{
switch(x.name)
{
  case 'Shopping':
    x.count = stats.shopping;
    break;
     case 'Note':
    x.count = stats.notes;
    break;
     case 'Spesa':
    x.count = stats.shoppingFood;
    break;
    case 'Calendario':
    x.count = stats.calendar;
    break;
}});

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

          {/* Navigation con statistiche reali */}
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
                        ? "bg-burnt-newStyle/10 text-burnt-newStyle border border-burnt-newStyle/20"
                        : "text-muted-foreground hover:bg-muted hover:text-card-foreground border border-transparent"
                    )}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                  >
                    <Icon className={cn(
                      "mr-3 h-5 w-5 transition-colors",
                      isActive ? "text-burnt-newStyle" : "text-muted-foreground group-hover:text-card-foreground"
                    )} />
                    <span className="flex-1">{item.name}</span>
                    {/* ✅ MIGLIORATO: Mostra count solo se > 0 */}
                    {item.count!=undefined && item.count > 0 && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium transition-colors",
                        isActive
                          ? "bg-burnt-newStyle text-white"
                          : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10"
                      )}>
                        {item.count}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}

            {/* ✅ AGGIUNTO: Separatore */}
            <div className="border-t border-border my-4"></div>

            {/* ✅ AGGIUNTO: Link a TripTaste */}
            <a 
              href="https://fabiodagostino.github.io/TripTaste/#/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer text-muted-foreground hover:bg-muted hover:text-card-foreground border border-transparent"
              onClick={() => window.innerWidth < 1024 && onClose()}
            >
              <ExternalLink className="mr-3 h-5 w-5 transition-colors text-muted-foreground group-hover:text-card-foreground" />
              <span className="flex-1">TripTaste</span>
              <span className="text-xs px-2 py-1 rounded-full font-medium transition-colors bg-muted text-muted-foreground group-hover:bg-muted-foreground/10">
                🌍
              </span>
            </a>
          </nav>
          
          {/* ✅ MIGLIORATO: Footer statistiche con dati reali */}
          <div className="px-4 py-4 border-t border-border mt-auto">
            <div className="bg-cambridge-newStyle/10 dark:bg-cambridge-newStyle/20 rounded-lg p-4 border border-cambridge-newStyle/20">
              <div className="flex items-center mb-3">
                <Clock className="h-4 w-4 text-cambridge-newStyle mr-2" />
                <h3 className="text-sm font-semibold text-card-foreground">Statistiche Rapide</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Archiviati Oggi</span>
                  <span className="font-medium text-cambridge-newStyle bg-cambridge-newStyle/10 px-2 py-1 rounded-full">
                    {stats.completedToday}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Eventi Prossimi</span>
                  <span className="font-medium text-sunset bg-sunset/10 px-2 py-1 rounded-full">
                    {stats.upcomingEvents}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
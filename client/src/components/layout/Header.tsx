import { Home, LogOut, Menu, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { Link, useLocation } from 'wouter';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuthContext();
  const [location] = useLocation();

  const navItems = [
    { name: 'Lista Spesa', path: '/shopping' },
    { name: 'Note', path: '/notes' },
    { name: 'Calendario', path: '/calendar' }
  ];

  return (
    <header className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Menu Toggle */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden p-2 text-delft-blue hover:bg-gray-100"
              onClick={onMenuToggle}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center ml-2 lg:ml-0">
              <div className="w-8 h-8 bg-burnt-sienna rounded-lg flex items-center justify-center mr-3">
                <Home className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-delft-blue">Family Tasks</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <Link key={item.name} href={item.path}>
                <span className={`font-medium px-1 pb-4 border-b-2 transition-colors cursor-pointer block ${
                  location === item.path
                    ? 'text-burnt-sienna border-burnt-sienna'
                    : 'text-gray-500 hover:text-delft-blue border-transparent hover:border-gray-300'
                }`}>
                  {item.name}
                </span>
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <div className="w-8 h-8 bg-cambridge-blue rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-delft-blue">{user?.username}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-gray-500 hover:text-delft-blue"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

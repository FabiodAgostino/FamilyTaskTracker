
// src/components/layout/Layout.tsx
import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Removed unused handlers - using inline functions instead

   return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header fisso - altezza fissa */}
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      {/* Container principale - prende lo spazio rimanente */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        {/* Content - scrollabile */}
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
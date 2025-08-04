
// src/components/layout/Layout.tsx
import { MobileHeader } from './MobileHeader';
import MobileFooter from './MobileFooter';
import AIChatComponent from '../chat/AIChatComponent';


// Removed unused interface

export function LayoutMobile({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background">
      
      {/* L'header è ora un normale blocco in cima alla pagina. */}
      <MobileHeader />

      {/* Il contenuto principale. Il padding-bottom evita che il footer copra l'ultimo elemento. */}
      <main className="pb-24">
        <div className="p-4">
          {children}
        </div>
      </main>
      <AIChatComponent />

      {/* Il footer rimane fisso in fondo alla viewport, come prima. */}
      <MobileFooter />
    </div>
  );
}

// Removed unused function declaration

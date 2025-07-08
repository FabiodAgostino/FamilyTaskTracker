// ✅ Componente LoadingScreen con rivelazione progressiva - VERSIONE CORRETTA
import React, { useState, useEffect } from 'react';

interface LoadingScreenProps {
  isVisible: boolean;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  isLoading?: boolean; // ✅ NUOVO: per controllare se mostrare contenuto
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  isVisible, 
  title, 
  subtitle,
  children,
  isLoading = false
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // Piccolo delay per permettere il render
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      // Inizia la transizione di uscita
      setIsAnimating(false);
      // Rimuovi dopo l'animazione
      setTimeout(() => {
        setShouldRender(false);
      }, 800);
    }
  }, [isVisible]);

  // Calcola l'opacità dell'overlay
  const getOverlayOpacity = () => {
    return isAnimating ? 0.95 : 0;
  };

  // Calcola la sfocatura
  const getBlurAmount = () => {
    return isAnimating ? 8 : 0;
  };

  return (
    <>
      {/* ✅ Contenuto sottostante renderizzato solo quando non siamo in loading iniziale */}
      <div className={`relative transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {children}
      </div>

      {/* ✅ Overlay che si sovrappone e diventa progressivamente trasparente */}
      {shouldRender && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-800 ease-out pointer-events-none"
          style={{
            backgroundColor: `hsl(var(--background) / ${getOverlayOpacity()})`,
            backdropFilter: `blur(${getBlurAmount()}px)`,
            WebkitBackdropFilter: `blur(${getBlurAmount()}px)`,
            opacity: isAnimating ? 1 : 0,
          }}
        >
          {/* Card container del loader */}
          <div 
            className={`
              bg-white dark:bg-gray-800 rounded-xl shadow-xl border p-8 max-w-sm mx-4
              transition-all duration-600 ease-out pointer-events-auto
              ${isAnimating
                ? 'scale-100 opacity-100 translate-y-0' 
                : 'scale-90 opacity-0 translate-y-8'
              }
            `}
          >
            <div className="flex flex-col items-center space-y-4">
              
              {/* Loader animato */}
              <div className="relative">
                <div 
                  className={`
                    animate-spin rounded-full h-12 w-12 border-4 border-cambridge-newStyle/20
                    transition-opacity duration-300
                    ${isAnimating ? 'opacity-100' : 'opacity-0'}
                  `}
                />
                <div 
                  className={`
                    animate-spin rounded-full h-12 w-12 border-4 border-cambridge-newStyle 
                    border-t-transparent absolute top-0
                    transition-opacity duration-300 delay-100
                    ${isAnimating ? 'opacity-100' : 'opacity-0'}
                  `}
                />
              </div>
              
              {/* Testo con animazione staggered */}
              <div className="text-center">
                <h3 
                  className={`
                    font-semibold text-delft-blue mb-1
                    transition-all duration-400 delay-200
                    ${isAnimating
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-2'
                    }
                  `}
                >
                  {title}
                </h3>
                <p 
                  className={`
                    text-sm text-gray-600 dark:text-gray-400
                    transition-all duration-400 delay-300
                    ${isAnimating
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-2'
                    }
                  `}
                >
                  {subtitle}
                </p>
              </div>
              
              {/* Dots animati */}
              <div 
                className={`
                  flex space-x-1
                  transition-all duration-400 delay-400
                  ${isAnimating
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-2'
                  }
                `}
              >
                <div 
                  className="w-2 h-2 bg-cambridge-newStyle rounded-full animate-bounce"
                  style={{ animationDelay: '0s' }}
                />
                <div 
                  className="w-2 h-2 bg-cambridge-newStyle rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div 
                  className="w-2 h-2 bg-cambridge-newStyle rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ✅ Hook personalizzato per gestire il loading - AGGIORNATO
export const useLoadingTransition = (loading: boolean, data: any) => {
  const [showLoading, setShowLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (!loading && data !== undefined) {
      // Delay minimo per evitare flash, poi inizia la transizione
      const timer = setTimeout(() => {
        setShowLoading(false);
        setIsInitialLoading(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [data, loading]);

  return { showLoading, isInitialLoading };
};
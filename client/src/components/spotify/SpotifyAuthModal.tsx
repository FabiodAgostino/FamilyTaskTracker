// components/spotify/SpotifyAuthModal.tsx
import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Music, X } from 'lucide-react';
import { FaSpotify } from 'react-icons/fa';
import { navigate } from 'wouter/use-hash-location';

interface SpotifyAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  error: string | null;
}

export function SpotifyAuthModal({ isOpen, onClose, onLogin, error }: SpotifyAuthModalProps) {

  const onCloseModal = useCallback(() => {
    navigate("/shopping");
  },[])
  return (
    <Dialog open={isOpen} onOpenChange={onCloseModal}>
      <DialogContent
        // Sfondo e bordo del modale: chiaro di default, scuro in dark mode
        className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-black dark:text-white"
      >
        <DialogHeader>
          <DialogTitle
            // Titolo del modale: testo nero di default, testo bianco in dark mode
            className="flex items-center gap-2 text-black dark:text-white"
          >
            <FaSpotify className="w-6 h-6 text-burnt-newStyle" /> {/* Icona Spotify rimane verde */}
            Connetti Spotify
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p
            // Testo descrittivo: testo grigio scuro di default, testo grigio chiaro in dark mode
            className="text-gray-700 dark:text-gray-300"
          >
            Connetti il tuo account Spotify per visualizzare le tue statistiche musicali personalizzate.
          </p>

          {error && (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-500 rounded-lg p-3">
              <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={onLogin}
              // Bottone di login: sfondo verde fisso, testo bianco fisso
              className="flex-1 bg-burnt-newStyle text-white"
            >
              <Music className="w-4 h-4 mr-2" />
              Connetti con Spotify
            </Button>
          </div>

          <p
            // Testo disclaimer: testo grigio scuro di default, testo grigio più chiaro in dark mode
            className="text-xs text-gray-500 dark:text-gray-400 text-center"
          >
            Accesso sicuro tramite OAuth. Non memorizziamo le tue credenziali.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
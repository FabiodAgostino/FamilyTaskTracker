// components/spotify/SpotifyLoadingState.tsx
import React from 'react';

interface SpotifyLoadingStateProps {
  message?: string;
}

export function SpotifyLoadingState({ message = 'Caricamento statistiche...' }: SpotifyLoadingStateProps) {
  return (
    <div className="container mx-auto px-6 py-12 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
      <p className="text-white">{message}</p>
    </div>
  );
}
// components/spotify/SpotifyErrorState.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SpotifyErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function SpotifyErrorState({ message, onRetry }: SpotifyErrorStateProps) {
  return (
    <div className="container mx-auto px-6 py-6">
      <Card className="bg-red-900/50 border-red-500 p-4">
        <p className="text-red-200">{message}</p>
        <Button
          onClick={onRetry}
          className="mt-3 bg-green-600 hover:bg-green-700"
        >
          Riprova
        </Button>
      </Card>
    </div>
  );
}
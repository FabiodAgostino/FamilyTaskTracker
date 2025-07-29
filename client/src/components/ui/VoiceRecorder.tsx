// src/components/chat/ui/VoiceRecorder.tsx

import React from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { VoiceRecorderProps } from '@/lib/models/chat.types';

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  isTranscribing,
  onStart,
  onStop
}) => {
  if (isTranscribing) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 
                size={24} 
                className="text-blue-600 animate-spin" 
              />
            </div>
            {/* Onde di trascrizione */}
            <div className="absolute inset-0 rounded-full border-2 border-blue-300 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping animation-delay-200" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Trascrizione in corso...</p>
            <p className="text-xs text-gray-500">Elaborazione del parlato</p>
          </div>
        </div>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative">
            {/* Pulsante centrale */}
            <button
              onClick={onStop}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors duration-200 z-10 relative"
            >
              <MicOff size={24} className="text-white" />
            </button>
            
            {/* Animazioni onde sonore */}
            <div className="absolute inset-0 rounded-full bg-red-200 animate-pulse" />
            <div className="absolute -inset-2 rounded-full bg-red-100 animate-ping opacity-75" />
            <div className="absolute -inset-4 rounded-full bg-red-50 animate-ping opacity-50 animation-delay-300" />
            
            {/* Onde audio stilizzate */}
            <div className="absolute -inset-6 flex items-center justify-center">
              <div className="flex space-x-1">
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '16px', animationDelay: '0ms' }} />
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '24px', animationDelay: '150ms' }} />
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '20px', animationDelay: '300ms' }} />
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '28px', animationDelay: '450ms' }} />
                <div className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height: '16px', animationDelay: '600ms' }} />
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-sm font-medium text-red-600">Registrazione in corso...</p>
            <p className="text-xs text-gray-500">Tocca per interrompere</p>
          </div>
          
          {/* Visualizzatore onde audio dal basso */}
          <div className="flex items-end space-x-1 h-8">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="w-1 bg-red-300 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 20 + 8}px`,
                  animationDelay: `${i * 50}ms`,
                  animationDuration: `${800 + Math.random() * 400}ms`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
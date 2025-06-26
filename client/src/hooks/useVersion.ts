// client/src/hooks/useVersion.ts
// 🏷️ Hook per gestire e visualizzare le informazioni di versione

import { useState, useEffect } from 'react';

interface VersionInfo {
  version: string;
  buildNumber: number;
  buildDate: string;
  commitSha: string;
  environment: string;
  deploymentId?: string;
}

/**
 * Hook personalizzato per ottenere le informazioni di versione
 */
export function useVersion(): VersionInfo {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    version: import.meta.env.VITE_APP_VERSION || 'v1.0.0.0',
    buildNumber: parseInt(import.meta.env.VITE_APP_BUILD_NUMBER || '0'),
    buildDate: import.meta.env.VITE_APP_BUILD_DATE || new Date().toISOString(),
    commitSha: import.meta.env.VITE_APP_COMMIT_SHA || 'dev',
    environment: import.meta.env.VITE_APP_ENVIRONMENT || 'development',
    deploymentId: import.meta.env.VITE_APP_DEPLOYMENT_ID
  });

  useEffect(() => {
    // Aggiorna le informazioni se cambiano durante il runtime
    setVersionInfo({
      version: import.meta.env.VITE_APP_VERSION || 'v1.0.0.0',
      buildNumber: parseInt(import.meta.env.VITE_APP_BUILD_NUMBER || '0'),
      buildDate: import.meta.env.VITE_APP_BUILD_DATE || new Date().toISOString(),
      commitSha: import.meta.env.VITE_APP_COMMIT_SHA || 'dev',
      environment: import.meta.env.VITE_APP_ENVIRONMENT || 'development',
      deploymentId: import.meta.env.VITE_APP_DEPLOYMENT_ID
    });
  }, []);

  return versionInfo;
}

/**
 * Formatta la data di build in modo leggibile
 */
export function formatBuildDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Data sconosciuta';
  }
}

/**
 * Determina il colore in base all'environment
 */
export function getEnvironmentColor(environment: string): string {
  switch (environment) {
    case 'production':
      return 'text-green-600';
    case 'staging':
      return 'text-yellow-600';
    case 'development':
    case 'local':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Determina l'emoji in base all'environment
 */
export function getEnvironmentEmoji(environment: string): string {
  switch (environment) {
    case 'production':
      return '🚀';
    case 'staging':
      return '🔧';
    case 'development':
    case 'local':
      return '🔨';
    default:
      return '📦';
  }
}
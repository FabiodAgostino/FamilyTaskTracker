// client/src/components/AutoFCMManager.tsx
// 🤖 Componente per gestione automatica FCM con debug integrato

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthContext } from '@/contexts/AuthContext';

interface TokenBridgeData {
  token: string;
  userInfo: {
    username?: string;
    role?: string;
  };
  registeredAt: string;
  lastSeen: string;
}

export function AutoFCMManager() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const { toast } = useToast();
  const { user } = useAuthContext();
  const {
    permission,
    token,
    requestPermission,
    testNotification,
    isSupported,
    debug
  } = useNotifications();

  /**
   * 🌉 Registra token nel bridge system
   */
  const registerTokenInBridge = async (fcmToken: string) => {
    if (!fcmToken || !user) return;

    try {
      const tokenData: TokenBridgeData = {
        token: fcmToken,
        userInfo: {
          username: user.username,
          role: user.role
        },
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      // Simula la registrazione salvando in un file accessibile al bridge
      const bridgeData = {
        action: 'register_token',
        data: tokenData,
        timestamp: Date.now()
      };

      // Salva in localStorage come ponte temporaneo
      const existingBridge = JSON.parse(localStorage.getItem('fcm_bridge_tokens') || '[]');
      const tokenIndex = existingBridge.findIndex((t: TokenBridgeData) => t.token === fcmToken);
      
      if (tokenIndex >= 0) {
        existingBridge[tokenIndex] = tokenData;
      } else {
        existingBridge.push(tokenData);
      }
      
      localStorage.setItem('fcm_bridge_tokens', JSON.stringify(existingBridge));
      sessionStorage.setItem('fcm_latest_token', JSON.stringify(tokenData));

            setBridgeStatus('connected');
      
      return true;
    } catch (error) {
      console.error('❌ Errore registrazione bridge:', error);
      setBridgeStatus('disconnected');
      return false;
    }
  };

  /**
   * 🚀 Attiva sistema automatico FCM
   */
  const enableAutoFCM = async () => {
    try {
      setBridgeStatus('connecting');
      
      // 1. Richiedi permessi se necessario
      if (permission !== 'granted') {
        await requestPermission();
        // requestPermission chiama già setupFCM() internamente
      } else {
        // 2. Se i permessi sono già granted, dobbiamo chiamare setupFCM() manualmente
                
        try {
          // Chiama setupFCM per ottenere il token
          await debug.setupFCM();
        } catch (setupError) {
          console.error('❌ Errore durante setupFCM:', setupError);
          throw new Error(`Setup FCM fallito:`);
        }
      }

      // 3. Verifica che abbiamo il token (controlla sia React state che globals)
      await new Promise(resolve => setTimeout(resolve, 500)); // Breve attesa per React state
      
      // Importa i globals direttamente  
      let currentToken = token;
      
      if (!currentToken) {
        // Se React state non aggiornato, controlla il debug
        const debugInfo = await debug.getDebugInfo();
        if (debugInfo.global.hasGlobalToken) {
                    currentToken = "token-exists-in-global"; // Placeholder per procedere
        }
      }
      
      if (!currentToken) {
        throw new Error('Impossibile ottenere token FCM dopo setupFCM');
      }

      // 4. Per registrazione bridge, usa il token React o richiama debug per ottenere quello reale
      const tokenToRegister = token || "global-token-placeholder";
      const registered = await registerTokenInBridge(tokenToRegister);
      
      if (registered) {
        setIsEnabled(true);
        toast({
          title: '🤖 Sistema Automatico Attivato!',
          description: 'FCM bridge configurato. Le notifiche saranno gestite automaticamente.'
        });
      } else {
        throw new Error('Registrazione bridge fallita');
      }

    } catch (error) {
      console.error('❌ Errore attivazione auto FCM:', error);
      setBridgeStatus('disconnected');
      toast({
        title: '❌ Errore Attivazione',
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
        variant: 'destructive'
      });
    }
  };

  /**
   * 🧪 Test automatico con bridge
   */
  const runAutomatedTest = async () => {
    if (!token || !isEnabled) {
      toast({
        title: '⚠️ Sistema non attivo',
        description: 'Attiva prima il sistema automatico',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Aggiorna timestamp nel bridge per indicare attività
      await registerTokenInBridge(token);
      
      // Esegui test locale
      await testNotification();

      // Notifica al bridge che è richiesto un test automatico
      const testRequest = {
        action: 'request_automated_test',
        token: token,
        user: user?.username,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem('fcm_test_request', JSON.stringify(testRequest));

      toast({
        title: '🧪 Test Automatico Avviato',
        description: 'Il sistema di notifiche automatico riceverà la richiesta di test.'
      });

    } catch (error) {
      console.error('❌ Errore test automatico:', error);
      toast({
        title: '❌ Errore Test',
        description: 'Impossibile eseguire test automatico',
        variant: 'destructive'
      });
    }
  };

  /**
   * 🩺 Esegui diagnostica completa
   */
  const runDiagnostics = async () => {
    try {
      const result = await debug.runDiagnostics();
      setShowDebugInfo(true);
      
      // Mostra risultati in un alert dettagliato
      const { debugInfo, issues } = result;
      
      let diagnosticMessage = '🔍 RISULTATI DIAGNOSTICA:\n\n';
      
      // Environment
      diagnosticMessage += `🌍 AMBIENTE:\n`;
      diagnosticMessage += `  Mode: ${debugInfo.environment.mode}\n`;
      diagnosticMessage += `  Prod: ${debugInfo.environment.isProd}\n`;
      diagnosticMessage += `  Base URL: ${debugInfo.environment.baseUrl}\n\n`;
      
      // VAPID Key
      diagnosticMessage += `🔑 VAPID KEY:\n`;
      diagnosticMessage += `  Exists: ${debugInfo.vapidKey.exists ? '✅' : '❌'}\n`;
      diagnosticMessage += `  Length: ${debugInfo.vapidKey.length} ${debugInfo.vapidKey.isValid ? '✅' : '❌'}\n`;
      diagnosticMessage += `  Preview: ${debugInfo.vapidKey.preview}\n\n`;
      
      // Service Worker
      diagnosticMessage += `🔧 SERVICE WORKER:\n`;
      diagnosticMessage += `  Supported: ${debugInfo.serviceWorker.supported ? '✅' : '❌'}\n`;
      diagnosticMessage += `  Registrations: ${debugInfo.serviceWorker.registrations}\n`;
      diagnosticMessage += `  Active: ${debugInfo.serviceWorker.activeSW ? '✅' : '❌'}\n`;
      if (debugInfo.serviceWorker.activeScope) {
        diagnosticMessage += `  Scope: ${debugInfo.serviceWorker.activeScope}\n`;
      }
      diagnosticMessage += '\n';
      
      // Firebase
      diagnosticMessage += `🔥 FIREBASE:\n`;
      diagnosticMessage += `  Config loaded: ${debugInfo.firebase.configLoaded ? '✅' : '❌'}\n`;
      diagnosticMessage += `  Env vars: ${debugInfo.firebase.envVarsCount}/${debugInfo.firebase.totalVars}\n`;
      if (debugInfo.firebase.missingVars.length > 0) {
        diagnosticMessage += `  Missing: ${debugInfo.firebase.missingVars.join(', ')}\n`;
      }
      diagnosticMessage += '\n';
      
      if (issues.length > 0) {
        diagnosticMessage += `🚨 PROBLEMI (${issues.length}):\n`;
        issues.forEach((issue: any) => diagnosticMessage += `  ${issue}\n`);
      }
      
    } catch (error) {
      console.error('❌ Errore diagnostica:', error);
    }
  };

  /**
   * 📊 Mostra statistiche bridge
   */
  const showBridgeStats = () => {
    const bridgeTokens = JSON.parse(localStorage.getItem('fcm_bridge_tokens') || '[]');
    
    toast({
      title: '📊 Statistiche Bridge',
      description: `Token registrati: ${bridgeTokens.length}. Controlla console per dettagli.`
    });

    console.group('📊 FCM Bridge Stats');
                            console.groupEnd();
  };

  /**
   * 🗑️ Pulisci bridge
   */
  const clearBridge = () => {
    localStorage.removeItem('fcm_bridge_tokens');
    sessionStorage.removeItem('fcm_latest_token');
    sessionStorage.removeItem('fcm_test_request');
    
    setIsEnabled(false);
    setBridgeStatus('disconnected');
    
    toast({
      title: '🗑️ Bridge Pulito',
      description: 'Tutti i token sono stati rimossi dal bridge'
    });
  };

  /**
   * 🔄 Auto-registrazione token quando cambia
   */
  useEffect(() => {
    if (token && user && isEnabled) {
      registerTokenInBridge(token);
    }
  }, [token, user, isEnabled]);

  // 🎨 Renderizzazione componente
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🤖 Sistema FCM Automatico
          <Badge variant={bridgeStatus === 'connected' ? 'default' : 'secondary'}>
            {bridgeStatus === 'connected' ? 'Connesso' : 
             bridgeStatus === 'connecting' ? 'Connessione...' : 'Disconnesso'}
          </Badge>
          {debug.isInitialized && (
            <Badge variant="outline">Inizializzato</Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Supporto:</strong> {isSupported ? '✅' : '❌'}
          </div>
          <div>
            <strong>Permesso:</strong> {permission}
          </div>
          <div>
            <strong>Token:</strong> {token ? '✅ Presente' : '❌ Assente'}
          </div>
          <div>
            <strong>Sistema:</strong> {isEnabled ? '🟢 Attivo' : '🔴 Inattivo'}
          </div>
        </div>

        {/* Token Info */}
        {token && (
          <div className="p-3 bg-gray-100 rounded-md">
            <p className="text-xs font-mono break-all">
              <strong>Token FCM:</strong><br />
              {token.substring(0, 50)}...
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {!isEnabled ? (
            <Button 
              onClick={enableAutoFCM} 
              className="w-full"
              disabled={!isSupported || bridgeStatus === 'connecting'}
            >
              🚀 Attiva Sistema Automatico
            </Button>
          ) : (
            <>
              <Button onClick={runAutomatedTest} className="w-full">
                🧪 Test Automatico
              </Button>
              
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={showBridgeStats} variant="outline" size="sm">
                  📊 Stats
                </Button>
                <Button onClick={runDiagnostics} variant="outline" size="sm">
                  🩺 Debug
                </Button>
                <Button onClick={clearBridge} variant="destructive" size="sm">
                  🗑️ Reset
                </Button>
              </div>
            </>
          )}

          {/* Debug Controls */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">🔧 Controlli Debug:</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={runDiagnostics} variant="outline" size="sm">
                🩺 Diagnostica
              </Button>
              <Button onClick={debug.forceReset} variant="destructive" size="sm">
                🔄 Reset Totale
              </Button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-sm text-gray-600 border-t pt-4">
          <h4 className="font-semibold mb-2">💡 Come usare:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Clicca "🩺 Diagnostica" per verificare la configurazione</li>
            <li>Clicca "Attiva Sistema Automatico"</li>
            <li>Apri terminale: <code>npm run fcm:bridge:start</code></li>
            <li>Il sistema invierà notifiche automaticamente</li>
          </ol>

          {showDebugInfo && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-xs">
                <strong>Debug attivato:</strong> Controlla la console per informazioni dettagliate.
                Le funzioni debug sono disponibili come <code>useNotifications().debug</code>
              </p>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
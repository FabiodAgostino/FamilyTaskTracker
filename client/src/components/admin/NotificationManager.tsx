// client/src/components/admin/FCMDashboard.tsx
import { useState, useEffect } from 'react';
import { 
  Bell, 
  BellOff, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Users, 
  Trash2, 
  RefreshCw, 
  Send, 
  CheckCircle,
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useFirestore } from '@/hooks/useFirestore';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/lib/models/types';
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { FCMToken } from '@/lib/models/fcmtoken';

interface UserTokenStats {
  username: string;
  displayName: string;
  tokens: FCMToken[];
  activeTokens: number;
  expiredTokens: number;
  lastActivity?: Date;
}

interface FCMStats {
  totalUsers: number;
  usersWithNotifications: number;
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  deviceTypes: {
    mobile: number;
    desktop: number;
    tablet: number;
    unknown: number;
  };
}

export function FCMDashboard() {
  const [tokens, setTokens] = useState<FCMToken[]>([]);
  const [userStats, setUserStats] = useState<UserTokenStats[]>([]);
  const [fcmStats, setFCMStats] = useState<FCMStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testMessage, setTestMessage] = useState({
    title: 'Test Notifica Famiglia',
    body: 'Questa è una notifica di test inviata dall\'amministratore'
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const { data: users } = useFirestore<User>('users');
  const { toast } = useToast();

  // Carica tutti i token FCM
  const loadTokens = async () => {
    if (!hasFirebaseConfig || !db) return;

    try {
      setIsLoading(true);
      const tokensRef = collection(db, 'fcm-tokens');
      const snapshot = await getDocs(tokensRef);
      
      const loadedTokens = snapshot.docs.map(doc => 
        FCMToken.fromFirestore({ id: doc.id, ...doc.data() })
      );
      
      setTokens(loadedTokens);
      calculateStats(loadedTokens);
    } catch (error) {
      toast({
        title: 'Errore caricamento',
        description: 'Impossibile caricare i token FCM',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calcola statistiche
  const calculateStats = (allTokens: FCMToken[]) => {
    // Raggruppa token per utente
    const tokensByUser = allTokens.reduce((acc, token) => {
      if (!acc[token.username]) {
        acc[token.username] = [];
      }
      acc[token.username].push(token);
      return acc;
    }, {} as Record<string, FCMToken[]>);

    // Crea statistiche per utente
    const userStatistics: UserTokenStats[] = Object.entries(tokensByUser).map(([username, userTokens]) => {
      const user = users.find(u => u.username === username);
      const activeTokens = userTokens.filter(t => t.isValid()).length;
      const expiredTokens = userTokens.filter(t => !t.isValid()).length;
      const lastActivity = userTokens.reduce((latest, token) => {
        return !latest || token.lastUsedAt > latest ? token.lastUsedAt : latest;
      }, undefined as Date | undefined);

      return {
        username,
        displayName: user?.displayName || username,
        tokens: userTokens,
        activeTokens,
        expiredTokens,
        lastActivity
      };
    });

    // Calcola statistiche globali
    const stats: FCMStats = {
      totalUsers: users.length,
      usersWithNotifications: userStatistics.length,
      totalTokens: allTokens.length,
      activeTokens: allTokens.filter(t => t.isValid()).length,
      expiredTokens: allTokens.filter(t => !t.isValid()).length,
      deviceTypes: {
        mobile: allTokens.filter(t => t.deviceType === 'mobile').length,
        desktop: allTokens.filter(t => t.deviceType === 'desktop').length,
        tablet: allTokens.filter(t => t.deviceType === 'tablet').length,
        unknown: allTokens.filter(t => t.deviceType === 'unknown').length,
      }
    };

    setUserStats(userStatistics);
    setFCMStats(stats);
  };

  // Pulizia token scaduti
  const cleanupExpiredTokens = async () => {
    if (!hasFirebaseConfig || !db) return;

    try {
      setIsRefreshing(true);
      let deletedCount = 0;

      for (const token of tokens) {
        if (!token.isValid()) {
          await deleteDoc(doc(db, 'fcm-tokens', token.id));
          deletedCount++;
        }
      }

      toast({
        title: 'Pulizia completata',
        description: `${deletedCount} token scaduti rimossi`
      });

      await loadTokens();
    } catch (error) {
      toast({
        title: 'Errore pulizia',
        description: 'Impossibile rimuovere i token scaduti',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Disabilita token specifico
  const disableToken = async (tokenId: string) => {
    if (!hasFirebaseConfig || !db) return;

    try {
      await updateDoc(doc(db, 'fcm-tokens', tokenId), {
        isActive: false,
        updatedAt: new Date()
      });

      toast({
        title: 'Token disabilitato',
        description: 'Il token è stato disattivato con successo'
      });

      await loadTokens();
    } catch (error) {
      toast({
        title: 'Errore disabilitazione',
        description: 'Impossibile disabilitare il token',
        variant: 'destructive'
      });
    }
  };

  // Simula invio notifica di test (placeholder)
  const sendTestNotification = async () => {
    // Qui andresti a implementare l'invio tramite Firebase Admin SDK
    // Per ora simulo il successo
    
    toast({
      title: 'Notifica inviata!',
      description: `Test inviato a ${selectedUsers.length > 0 ? selectedUsers.length + ' utenti' : 'tutti gli utenti'}`
    });
    
    // Reset selezioni
    setSelectedUsers([]);
  };

  useEffect(() => {
    loadTokens();
  }, [users]);

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return Smartphone;
      case 'desktop': return Monitor;
      case 'tablet': return Tablet;
      default: return Wifi;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Dashboard Notifiche FCM
          </h2>
          <p className="text-muted-foreground">
            Gestione centralizzata delle notifiche push della famiglia
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={loadTokens} 
            variant="outline" 
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
          
          <Button 
            onClick={cleanupExpiredTokens}
            variant="outline"
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Pulisci Scaduti
          </Button>
        </div>
      </div>

      {/* Statistiche Globali */}
      {fcmStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{fcmStats.usersWithNotifications}</p>
                  <p className="text-sm text-muted-foreground">
                    Utenti con Notifiche
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  su {fcmStats.totalUsers} utenti totali
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{fcmStats.activeTokens}</p>
                  <p className="text-sm text-muted-foreground">
                    Token Attivi
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {fcmStats.expiredTokens} scaduti
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{fcmStats.deviceTypes.mobile}</p>
                  <p className="text-sm text-muted-foreground">
                    Dispositivi Mobile
                  </p>
                </div>
                <Smartphone className="h-8 w-8 text-purple-500" />
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {fcmStats.deviceTypes.desktop} desktop
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{fcmStats.totalTokens}</p>
                  <p className="text-sm text-muted-foreground">
                    Token Totali
                  </p>
                </div>
                <Bell className="h-8 w-8 text-orange-500" />
              </div>
              <div className="mt-2">
                <div className="flex gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {fcmStats.deviceTypes.tablet} tablet
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {fcmStats.deviceTypes.unknown} altri
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Token per Utente */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Token FCM per Utente
          </CardTitle>
          
          {/* Test Notifica */}
          <Dialog>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Test Notifica
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invia Notifica di Test</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Titolo</label>
                  <Input
                    value={testMessage.title}
                    onChange={(e) => setTestMessage(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Messaggio</label>
                  <Textarea
                    value={testMessage.body}
                    onChange={(e) => setTestMessage(prev => ({ ...prev, body: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={sendTestNotification} className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    Invia a Tutti
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          {userStats.length === 0 ? (
            <div className="text-center py-8">
              <BellOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Nessun Token FCM</h3>
              <p className="text-muted-foreground">
                Nessun utente ha ancora abilitato le notifiche push.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {userStats.map((userStat) => (
                <div key={userStat.username} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{userStat.displayName}</h4>
                        <p className="text-sm text-muted-foreground">@{userStat.username}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={userStat.activeTokens > 0 ? 'default' : 'secondary'}>
                        {userStat.activeTokens} attivi
                      </Badge>
                      {userStat.expiredTokens > 0 && (
                        <Badge variant="destructive">
                          {userStat.expiredTokens} scaduti
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Token dell'utente */}
                  <div className="grid gap-2">
                    {userStat.tokens.map((token) => {
                      const DeviceIcon = getDeviceIcon(token.deviceType);
                      return (
                        <div key={token.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                          <div className="flex items-center gap-3">
                            <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium capitalize">
                                {token.deviceType} Device
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Ultimo utilizzo: {formatDate(token.lastUsedAt)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge variant={token.isValid() ? 'default' : 'destructive'}>
                              {token.isValid() ? (
                                <><Wifi className="h-3 w-3 mr-1" /> Attivo</>
                              ) : (
                                <><WifiOff className="h-3 w-3 mr-1" /> Inattivo</>
                              )}
                            </Badge>
                            
                            {token.isActive && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => disableToken(token.id)}
                                className="h-7 px-2"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {userStat.lastActivity && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Ultima attività: {formatDate(userStat.lastActivity)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
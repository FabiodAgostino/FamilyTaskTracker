// client/src/components/admin/AdministratorPanel.tsx - Aggiornato con FCM Dashboard
import React, { useState } from 'react';
import { Users, BarChart3, Settings, Shield, Bell, TrendingUp } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

// Importa i componenti esistenti
import { UserManagement } from '@/components/admin/UserManagement';
import PriceMonitoringDashboard from './DashboardPrice';
import { FCMDashboard } from './NotificationManager'; // 👈 NUOVO IMPORT

// Tipi per le tabs
type AdminTab = 'dashboard' | 'users' | 'notifications' | 'system' | 'analytics'; // 👈 AGGIUNTO 'notifications'

interface TabConfig {
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  component: React.ComponentType;
}

// Placeholder per future sezioni admin (mantenuto uguale)
const SystemSettings = () => (
  <div className="p-6 space-y-6">
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5" />
        Impostazioni Sistema
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-medium">Configurazione Monitoraggio</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <span className="text-sm">Frequenza check prezzi</span>
              <span className="text-sm font-medium">Ogni 8 ore</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <span className="text-sm">Timeout richieste</span>
              <span className="text-sm font-medium">30 secondi</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <span className="text-sm">Retry tentativi</span>
              <span className="text-sm font-medium">3 volte</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="font-medium">Notifiche Email</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <span className="text-sm">Abilitate</span>
              <span className="text-sm font-medium">Sì</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <span className="text-sm">Destinatario admin</span>
              <span className="text-sm font-medium">admin@famiglia.it</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Statistiche Sistema</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 border rounded-md">
          <div className="text-2xl font-bold text-blue-600">156</div>
          <div className="text-sm text-gray-600">Prodotti monitorati</div>
        </div>
        <div className="text-center p-4 border rounded-md">
          <div className="text-2xl font-bold text-green-600">23</div>
          <div className="text-sm text-gray-600">Sconti trovati</div>
        </div>
        <div className="text-center p-4 border rounded-md">
          <div className="text-2xl font-bold text-orange-600">€847</div>
          <div className="text-sm text-gray-600">Risparmio totale</div>
        </div>
        <div className="text-center p-4 border rounded-md">
          <div className="text-2xl font-bold text-purple-600">12h</div>
          <div className="text-sm text-gray-600">Ultimo check</div>
        </div>
      </div>
    </div>
  </div>
);

const Analytics = () => (
  <div className="p-6 space-y-6">
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        Analytics Avanzate
      </h2>
      <div className="space-y-6">
        <div>
          <h3 className="font-medium mb-4">Performance Sistema</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex justify-between">
              <span>CPU utilizzata</span>
              <span className="font-medium">45%</span>
            </div>
            <div className="flex justify-between">
              <span>Memoria utilizzata</span>
              <span className="font-medium">2.3 GB</span>
            </div>
            <div className="flex justify-between">
              <span>Backup ultimo</span>
              <span className="font-medium">2h fa</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <h4 className="font-medium text-yellow-900 dark:text-yellow-300 mb-2">Raccomandazioni</h4>
        <ul className="text-sm text-yellow-800 dark:text-yellow-400 space-y-1">
          <li>• Considera l'ottimizzazione delle query per migliorare i tempi di risposta</li>
          <li>• Implementa caching per ridurre il carico su Firestore</li>
          <li>• Monitora l'utilizzo delle API calls per evitare sovraccarichi</li>
        </ul>
      </div>
    </div>
  </div>
);

export default function AdminPanel() {
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Controlla se l'utente è admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <Shield className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-semibold">Accesso Negato</h2>
          <p className="text-muted-foreground">
            Non hai i privilegi necessari per accedere al pannello amministratore.
          </p>
        </div>
      </div>
    );
  }

  // Configurazione delle tabs - AGGIORNATA con FCM
  const tabs: TabConfig[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      description: 'Monitoraggio prezzi e performance sistema',
      component: PriceMonitoringDashboard
    },
    {
      id: 'users',
      label: 'Gestione Utenti',
      icon: Users,
      description: 'Amministrazione utenti e permessi',
      component: UserManagement
    },
    {
      id: 'notifications', // 👈 NUOVA TAB
      label: 'Notifiche FCM',
      icon: Bell,
      description: 'Gestione notifiche push e token FCM',
      component: FCMDashboard
    },
    {
      id: 'system',
      label: 'Impostazioni',
      icon: Settings,
      description: 'Configurazione sistema e parametri',
      component: SystemSettings
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      description: 'Statistiche avanzate e performance',
      component: Analytics
    }
  ];

  const activeTabConfig = tabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabConfig?.component || PriceMonitoringDashboard;

  return (
    <div className="min-h-screen bg-background">
      {/* Header del pannello admin - FIX Z-INDEX */}
      <header className="bg-card border-b sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary-foreground" />
                </div>
                Pannello Amministratore
              </h1>
              <p className="text-sm text-muted-foreground">
                {activeTabConfig?.description || 'Controllo e gestione del sistema'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium">Admin: {user.displayName || user.username}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs - FIX Z-INDEX */}
      <nav className="bg-card border-b relative z-35">
        <div className="px-6">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                 className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                    transition-colors duration-200
                    ${isActive 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Contenuto principale */}
      <main className="relative z-10">
        <ActiveComponent />
      </main>
    </div>
  );
}
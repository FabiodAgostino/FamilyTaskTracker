import React, { useState } from 'react';
import { Users, BarChart3, Settings, Shield, Activity, Database, Mail, TrendingUp } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

// Importa i componenti esistenti
import { UserManagement } from '@/components/admin/UserManagement';
import PriceMonitoringDashboard from './DashboardPrice';

// Tipi per le tabs
type AdminTab = 'dashboard' | 'users' | 'system' | 'analytics';

interface TabConfig {
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  component: React.ComponentType;
}

// Placeholder per future sezioni admin
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
              <span className="text-sm">Email amministratori</span>
              <span className="text-sm font-medium">Attive</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <span className="text-sm">Report giornaliero</span>
              <span className="text-sm font-medium">09:00</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <span className="text-sm">Soglia errori alert</span>
              <span className="text-sm font-medium">10%</span>
            </div>
          </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Performance Sistema</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Uptime</span>
              <span className="font-medium">99.8%</span>
            </div>
            <div className="flex justify-between">
              <span>Memoria utilizata</span>
              <span className="font-medium">67%</span>
            </div>
            <div className="flex justify-between">
              <span>CPU media</span>
              <span className="font-medium">23%</span>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 className="font-medium text-green-900 dark:text-green-300 mb-2">Efficienza API</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Calls successo</span>
              <span className="font-medium">94.2%</span>
            </div>
            <div className="flex justify-between">
              <span>Tempo risposta</span>
              <span className="font-medium">1.2s</span>
            </div>
            <div className="flex justify-between">
              <span>Rate limiting</span>
              <span className="font-medium">0.3%</span>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <h3 className="font-medium text-purple-900 dark:text-purple-300 mb-2">Database</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Documents</span>
              <span className="font-medium">15.7K</span>
            </div>
            <div className="flex justify-between">
              <span>Storage utilizzato</span>
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

  // Configurazione delle tabs
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
      {/* Header del pannello admin */}
      <header className="bg-card border-b sticky top-0 z-50">
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

      {/* Navigation Tabs */}
      <nav className="bg-card border-b">
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
                      ? 'border-primary text-primary bg-primary/5' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
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

      {/* Tab Content */}
      <main className="flex-1">
        <div className="transition-all duration-300 ease-in-out">
          <ActiveComponent />
        </div>
      </main>

      {/* Footer informativo per admin */}
      <footer className="bg-card border-t">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Database className="w-4 h-4" />
                Firestore: Connesso
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-4 h-4" />
                Sistema: Operativo
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                Email: Configurato
              </span>
            </div>
            <div className="text-xs">
              Ultimo aggiornamento: {new Date().toLocaleString('it-IT')}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
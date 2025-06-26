// src/components/settings/UserSettings.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

import { 
  Settings, 
  LayoutGrid, 
  LayoutList,
  Eye,
  Bell,
  Globe,
  RotateCcw,
  Save,
  User,
  Database,
  Monitor,
  Moon,
  Sun
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthContext } from '@/contexts/AuthContext';

export function UserSettings() {
  const { user } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const { 
    preferences, 
    updatePreference, 
    updatePreferences, 
    resetPreferences, 
    isLoading 
  } = useUserPreferences();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  // Gestione cambi temporanei
  const handlePreferenceChange = <K extends keyof typeof preferences>(
    key: K, 
    value: typeof preferences[K]
  ) => {
    updatePreference(key, value);
    setHasUnsavedChanges(false); // Le preferenze si salvano automaticamente
    toast({title:"Aggiornamento", description:`Preferenza "${key}" aggiornata`})

  };

  // Reset completo con conferma
  const handleResetAll = () => {
    if (confirm('Sei sicuro di voler resettare tutte le preferenze ai valori default?')) {
      resetPreferences();
      setHasUnsavedChanges(false);
    toast({title:"Reset", description:'Preferenze resettate ai valori default'})

    }
  };

  // Esporta preferenze
  const handleExportPreferences = () => {
    const dataStr = JSON.stringify(preferences, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `familytask-preferences-${user?.username}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({title:"Esportazione", description:'Preferenze esportate'})
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cambridge-blue mx-auto mb-4"></div>
          <p className="text-delft-blue dark:text-eggshell">Caricamento impostazioni...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-delft-blue dark:text-eggshell flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Impostazioni Utente
          </h1>
          <p className="text-delft-blue/70 dark:text-eggshell/70 mt-1">
            Personalizza la tua esperienza FamilyTaskTracker
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <User className="h-3 w-3 mr-1" />
            {user?.username} ({user?.role})
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            <Database className="h-3 w-3 mr-1" />
            Salvate in Sessione
          </Badge>
        </div>
      </div>

      {/* 🎨 VISUALIZZAZIONE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Preferenze di Visualizzazione
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* View Mode */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Modalità Vista Shopping List</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-eggshell/50 dark:bg-delft-blue/20">
                <LayoutList className={`h-4 w-4 ${preferences.viewMode === 'compact' ? 'text-cambridge-blue' : 'text-gray-400'}`} />
                <Switch
                  checked={preferences.viewMode === 'images'}
                  onCheckedChange={(checked) => 
                    handlePreferenceChange('viewMode', checked ? 'images' : 'compact')
                  }
                  className="data-[state=checked]:bg-cambridge-blue"
                />
                <LayoutGrid className={`h-4 w-4 ${preferences.viewMode === 'images' ? 'text-cambridge-blue' : 'text-gray-400'}`} />
                <span className="font-medium">
                  {preferences.viewMode === 'images' ? 'Vista Immagini' : 'Vista Compatta'}
                </span>
              </div>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                💾 Salvato automaticamente
              </Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              La modalità vista determina come vengono mostrati gli articoli nella shopping list.
            </p>
          </div>

          <Separator />

          {/* Items per Page */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Articoli per Pagina</Label>
            <Select 
              value={preferences.itemsPerPage.toString()} 
              onValueChange={(value) => handlePreferenceChange('itemsPerPage', parseInt(value))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 articoli</SelectItem>
                <SelectItem value="20">20 articoli</SelectItem>
                <SelectItem value="30">30 articoli</SelectItem>
                <SelectItem value="50">50 articoli</SelectItem>
                <SelectItem value="100">100 articoli</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Tema */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Tema Applicazione</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-eggshell/50 dark:bg-delft-blue/20">
                <Sun className={`h-4 w-4 ${theme === 'light' ? 'text-cambridge-blue' : 'text-gray-400'}`} />
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                  className="data-[state=checked]:bg-cambridge-blue"
                />
                <Moon className={`h-4 w-4 ${theme === 'dark' ? 'text-cambridge-blue' : 'text-gray-400'}`} />
                <span className="font-medium">
                  {theme === 'light' ? 'Tema Chiaro' : 'Tema Scuro'}
                </span>
              </div>
              <Badge variant="outline" className="bg-blue-100 text-blue-700">
                <Monitor className="h-3 w-3 mr-1" />
                Sincronizzato con sistema
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 📋 FILTRI DEFAULT */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Filtri Predefiniti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Categoria Default */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Categoria Predefinita</Label>
            <Select 
              value={preferences.defaultCategory} 
              onValueChange={(value) => handlePreferenceChange('defaultCategory', value)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Categorie</SelectItem>
                <SelectItem value="Alimentari">🥘 Alimentari</SelectItem>
                <SelectItem value="Casa">🏠 Casa</SelectItem>
                <SelectItem value="Elettronica">💻 Elettronica</SelectItem>
                <SelectItem value="Abbigliamento">👕 Abbigliamento</SelectItem>
                <SelectItem value="Salute">💊 Salute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priorità Default */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Priorità Predefinita</Label>
            <Select 
              value={preferences.defaultPriority} 
              onValueChange={(value) => handlePreferenceChange('defaultPriority', value)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Priorità</SelectItem>
                <SelectItem value="high">🔴 Alta</SelectItem>
                <SelectItem value="medium">🟡 Media</SelectItem>
                <SelectItem value="low">🟢 Bassa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mostra Completati */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Mostra Articoli Completati</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Include gli articoli già completati nella vista predefinita
                </p>
              </div>
              <Switch
                checked={preferences.showCompleted}
                onCheckedChange={(checked) => handlePreferenceChange('showCompleted', checked)}
                className="data-[state=checked]:bg-cambridge-blue"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🔔 NOTIFICHE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Impostazioni Notifiche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notifiche Generali */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Abilita Notifiche</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Ricevi notifiche per aggiornamenti e promemoria
                </p>
              </div>
              <Switch
                checked={preferences.enableNotifications}
                onCheckedChange={(checked) => handlePreferenceChange('enableNotifications', checked)}
                className="data-[state=checked]:bg-cambridge-blue"
              />
            </div>
          </div>

          {/* Email Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Notifiche Email</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Ricevi un riepilogo giornaliero via email
                </p>
              </div>
              <Switch
                checked={preferences.emailNotifications}
                onCheckedChange={(checked) => handlePreferenceChange('emailNotifications', checked)}
                className="data-[state=checked]:bg-cambridge-blue"
                disabled={!preferences.enableNotifications}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🌍 REGIONALIZZAZIONE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Impostazioni Regionali
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lingua */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Lingua</Label>
            <Select 
              value={preferences.language} 
              onValueChange={(value) => handlePreferenceChange('language', value as 'it' | 'en')}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                <SelectItem value="en">🇺🇸 English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 💾 GESTIONE DATI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Gestione Dati e Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Storage */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                  Le tue preferenze sono salvate in SessionStorage
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  I dati vengono conservati per tutta la durata della sessione browser. 
                  Chiudendo il browser, le preferenze verranno perse.
                </p>
                <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                  <strong>Chiave storage:</strong> familyTaskTracker_preferences_{user?.username}
                </div>
              </div>
            </div>
          </div>

          {/* Export/Import Preferenze */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-base font-medium">Esporta Preferenze</Label>
              <Button
                onClick={handleExportPreferences}
                variant="outline"
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                Scarica Backup JSON
              </Button>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Salva le tue preferenze come file JSON
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Spazio Utilizzato</Label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span>Preferenze:</span>
                    <span className="font-mono">
                      {new Blob([JSON.stringify(preferences)]).size} bytes
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Tema:</span>
                    <span className="font-mono">
                      {sessionStorage.getItem('theme')?.length || 0} bytes
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🔧 AZIONI AVANZATE */}
      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
            <RotateCcw className="h-5 w-5" />
            Azioni Avanzate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reset Preferenze */}
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-orange-900 dark:text-orange-100">
                  Reset Completo Preferenze
                </h4>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  Ripristina tutte le impostazioni ai valori predefiniti. 
                  Questa azione non può essere annullata.
                </p>
              </div>
              <Button
                onClick={handleResetAll}
                variant="destructive"
                size="sm"
                className="ml-4"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Tutto
              </Button>
            </div>
          </div>

          {/* Clear SessionStorage */}
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-red-900 dark:text-red-100">
                  Cancella Tutti i Dati di Sessione
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Rimuove completamente tutti i dati salvati in SessionStorage, 
                  incluse preferenze e tema. Richiede ricaricamento pagina.
                </p>
              </div>
              <Button
                onClick={() => {
                  if (confirm('Sei sicuro? Tutti i dati di sessione verranno persi e la pagina verrà ricaricata.')) {
                    sessionStorage.clear();
                    window.location.reload();
                  }
                }}
                variant="destructive"
                size="sm"
                className="ml-4"
              >
                <Database className="mr-2 h-4 w-4" />
                Cancella Tutto
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 📊 RIEPILOGO PREFERENZE CORRENTI */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <Eye className="h-5 w-5" />
            Riepilogo Configurazione Attuale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Visualizzazione */}
            <div className="space-y-2">
              <h4 className="font-medium text-delft-blue dark:text-eggshell">Visualizzazione</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Vista:</span>
                  <Badge variant="outline" className={
                    preferences.viewMode === 'images' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700'
                  }>
                    {preferences.viewMode === 'images' ? '🖼️ Immagini' : '📝 Compatta'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Items/Pagina:</span>
                  <span className="font-mono">{preferences.itemsPerPage}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tema:</span>
                  <Badge variant="outline" className={
                    theme === 'dark' 
                      ? 'bg-gray-800 text-gray-100' 
                      : 'bg-yellow-100 text-yellow-700'
                  }>
                    {theme === 'dark' ? '🌙 Scuro' : '☀️ Chiaro'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Filtri */}
            <div className="space-y-2">
              <h4 className="font-medium text-delft-blue dark:text-eggshell">Filtri Default</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Categoria:</span>
                  <span className="font-mono text-xs">{preferences.defaultCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span>Priorità:</span>
                  <span className="font-mono text-xs">{preferences.defaultPriority}</span>
                </div>
                <div className="flex justify-between">
                  <span>Archiviati:</span>
                  <Badge variant="outline" className={
                    preferences.showCompleted 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }>
                    {preferences.showCompleted ? '✅ Sì' : '❌ No'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Notifiche */}
            <div className="space-y-2">
              <h4 className="font-medium text-delft-blue dark:text-eggshell">Notifiche</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Abilitate:</span>
                  <Badge variant="outline" className={
                    preferences.enableNotifications 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }>
                    {preferences.enableNotifications ? '🔔 Sì' : '🔕 No'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Email:</span>
                  <Badge variant="outline" className={
                    preferences.emailNotifications 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }>
                    {preferences.emailNotifications ? '📧 Sì' : '📭 No'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Lingua:</span>
                  <span className="font-mono text-xs">
                    {preferences.language === 'it' ? '🇮🇹 IT' : '🇺🇸 EN'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* 💡 TIPS E SUGGERIMENTI */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
            💡 Tips e Suggerimenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-blue-500">📱</span>
              <div>
                <strong>Vista Immagini vs Compatta:</strong> La vista immagini è ideale per prodotti con foto, 
                mentre la vista compatta permette di vedere più articoli contemporaneamente.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">💾</span>
              <div>
                <strong>Salvataggio Automatico:</strong> Tutte le modifiche alle preferenze vengono salvate 
                automaticamente in SessionStorage senza bisogno di conferma.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-500">🔄</span>
              <div>
                <strong>Sincronizzazione Multi-Device:</strong> Per ora le preferenze sono salvate localmente. 
                In futuro potrebbero essere sincronizzate con il cloud.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-500">⚡</span>
              <div>
                <strong>Performance:</strong> La vista compatta carica più velocemente quando hai molti articoli, 
                mentre la vista immagini offre un'esperienza più ricca.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer con info versione */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
        <p>
          FamilyTaskTracker v{import.meta.env.VITE_APP_VERSION || '1.0.0'} • 
          Preferenze User: {user?.username} • 
          Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
        </p>
      </div>
    </div>
  );
}

export default UserSettings;
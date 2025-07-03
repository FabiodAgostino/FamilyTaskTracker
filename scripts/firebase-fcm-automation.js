// scripts/firebase-fcm-automation.js
// 🤖 Sistema completo per automatizzare notifiche Firebase con service account

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔧 Configurazione
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];
const TOKENS_CACHE_FILE = path.join(__dirname, '../.firebase-tokens-cache.json');

/**
 * 🔑 Classe per gestire token Firebase automaticamente
 */
class FirebaseTokenManager {
  constructor() {
    this.serviceAccount = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.projectId = null;
    this.loadServiceAccount();
  }

  /**
   * Carica service account
   */
  loadServiceAccount() {
    try {
      if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        throw new Error(`❌ Service account non trovato: ${SERVICE_ACCOUNT_PATH}`);
      }

      this.serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
      this.projectId = this.serviceAccount.project_id;
      
      console.log(`✅ Service account caricato per progetto: ${this.projectId}`);
    } catch (error) {
      console.error('❌ Errore caricamento service account:', error.message);
      throw error;
    }
  }

  /**
   * Genera access token automaticamente
   */
  async getAccessToken() {
    try {
      // Controlla se abbiamo un token valido in cache
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
        console.log('🔄 Usando token cached');
        return this.accessToken;
      }

      console.log('🔑 Generando nuovo access token...');

      const jwtClient = new google.auth.JWT(
        this.serviceAccount.client_email,
        null,
        this.serviceAccount.private_key,
        SCOPES,
        null
      );

      const tokens = await jwtClient.authorize();
      
      this.accessToken = tokens.access_token;
      this.tokenExpiry = tokens.expiry_date;
      
      // Salva in cache
      this.saveTokenCache();
      
      const expiresIn = Math.floor((this.tokenExpiry - Date.now()) / 60000);
      console.log(`✅ Nuovo token generato (valido per ${expiresIn} minuti)`);
      
      return this.accessToken;
      
    } catch (error) {
      console.error('❌ Errore generazione token:', error.message);
      throw error;
    }
  }

  /**
   * Salva token in cache
   */
  saveTokenCache() {
    try {
      const cacheData = {
        accessToken: this.accessToken,
        tokenExpiry: this.tokenExpiry,
        projectId: this.projectId,
        generatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(TOKENS_CACHE_FILE, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn('⚠️ Impossibile salvare token cache:', error.message);
    }
  }

  /**
   * Carica token da cache
   */
  loadTokenCache() {
    try {
      if (fs.existsSync(TOKENS_CACHE_FILE)) {
        const cacheData = JSON.parse(fs.readFileSync(TOKENS_CACHE_FILE, 'utf8'));
        
        if (cacheData.projectId === this.projectId) {
          this.accessToken = cacheData.accessToken;
          this.tokenExpiry = cacheData.tokenExpiry;
          console.log('📂 Token cache caricato');
        }
      }
    } catch (error) {
      console.warn('⚠️ Impossibile caricare token cache:', error.message);
    }
  }
}

/**
 * 🚀 Classe per inviare notifiche automaticamente
 */
class FCMNotificationSender {
  constructor() {
    this.tokenManager = new FirebaseTokenManager();
  }

  /**
   * Invia notifica a token specifico
   */
  async sendNotification(fcmToken, notification, data = {}) {
    try {
      const accessToken = await this.tokenManager.getAccessToken();
      const projectId = this.tokenManager.projectId;
      
      const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
      
      const message = {
        message: {
          token: fcmToken,
          notification: {
            title: notification.title,
            body: notification.body,
            image: notification.image || undefined
          },
          data: {
            ...data,
            timestamp: Date.now().toString(),
            source: 'automated-system'
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              click_action: "FLUTTER_NOTIFICATION_CLICK"
            }
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1
              }
            }
          },
          webpush: {
            headers: {
              Urgency: "high"
            },
            notification: {
              icon: "/FamilyTaskTracker/icon-192.png",
              badge: "/FamilyTaskTracker/icon-192.png",
              requireInteraction: false,
              tag: 'family-task-notification'
            }
          }
        }
      };

      console.log('📤 Inviando notifica...');
      console.log(`🎯 Token: ${fcmToken.substring(0, 20)}...`);
      console.log(`📝 Titolo: ${notification.title}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ NOTIFICA INVIATA CON SUCCESSO!');
        console.log(`📨 Message ID: ${result.name}`);
        return result;
      } else {
        const error = await response.text();
        console.error('❌ ERRORE INVIO NOTIFICA:');
        console.error(`   Status: ${response.status}`);
        console.error(`   Error: ${error}`);
        throw new Error(`HTTP ${response.status}: ${error}`);
      }
      
    } catch (error) {
      console.error('💥 ERRORE CRITICO:', error.message);
      throw error;
    }
  }

  /**
   * Invia notifica di test rapida
   */
  async sendTestNotification(fcmToken) {
    const notification = {
      title: "🤖 Test Automatico!",
      body: "Sistema di notifiche completamente automatizzato funzionante!",
    };

    const data = {
      test_type: "automated",
      click_action: "/FamilyTaskTracker/"
    };

    return await this.sendNotification(fcmToken, notification, data);
  }

  /**
   * Invia serie di notifiche di test
   */
  async sendTestSeries(fcmToken) {
    const tests = [
      {
        title: "🔥 Test 1: Base",
        body: "Notifica di base per verificare funzionamento",
        data: { test_id: "1", type: "basic" }
      },
      {
        title: "📊 Test 2: Con Dati",
        body: "Notifica con dati personalizzati per test avanzato",
        data: { test_id: "2", type: "advanced", user_action: "required" }
      },
      {
        title: "🚨 Test 3: Priorità Alta",
        body: "Notifica ad alta priorità con richiesta interazione",
        data: { test_id: "3", type: "high_priority", urgent: "true" }
      }
    ];

    console.log('🎯 Avviando serie di test automatici...\n');

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      try {
        console.log(`\n🧪 Eseguendo: ${test.title}`);
        await this.sendNotification(fcmToken, test, test.data);
        console.log(`✅ Test ${i + 1} completato`);
        
        // Attendi 3 secondi tra i test
        if (i < tests.length - 1) {
          console.log('⏳ Attendo 3 secondi...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.error(`❌ Test ${i + 1} fallito:`, error.message);
      }
    }
    
    console.log('\n🎉 Serie di test completata!');
  }

  /**
   * Monitoring dei token FCM nel browser
   */
  async startTokenMonitoring() {
    console.log('👀 Avviando monitoring automatico token FCM...');
    console.log('💡 Apri il browser su http://localhost:3000 e attiva le notifiche');
    console.log('🔄 Il sistema controllerà automaticamente ogni 10 secondi...\n');

    let tokenFound = false;
    const checkInterval = setInterval(async () => {
      try {
        // Qui potresti implementare logic per leggere token da un file
        // o da un endpoint API della tua app
        
        console.log('🔍 Controllando nuovi token FCM...');
        
        // Per ora, simula il controllo
        // In una implementazione reale, potresti:
        // 1. Leggere da un file condiviso
        // 2. Controllare un database
        // 3. Fare una chiamata HTTP alla tua app
        
      } catch (error) {
        console.error('❌ Errore monitoring:', error.message);
      }
    }, 10000);

    // Cleanup dopo 5 minuti
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('⏹️ Monitoring interrotto dopo 5 minuti');
    }, 300000);
  }
}

/**
 * 🎮 Sistema di comandi interattivi
 */
class FCMCommandSystem {
  constructor() {
    this.sender = new FCMNotificationSender();
  }

  /**
   * Mostra menu comandi
   */
  showMenu() {
    console.log('\n🤖 === SISTEMA AUTOMATIZZATO FCM ===');
    console.log('Comandi disponibili:');
    console.log('  test <token>        - Invia notifica di test');
    console.log('  series <token>      - Invia serie di test');
    console.log('  monitor             - Avvia monitoring token');
    console.log('  token               - Genera solo access token');
    console.log('  help                - Mostra questo menu');
    console.log('=====================================\n');
  }

  /**
   * Esegue comando
   */
  async executeCommand(command, args) {
    try {
      switch (command) {
        case 'test':
          if (!args[0]) {
            console.error('❌ Uso: npm run fcm:test <FCM_TOKEN>');
            return;
          }
          await this.sender.sendTestNotification(args[0]);
          break;

        case 'series':
          if (!args[0]) {
            console.error('❌ Uso: npm run fcm:series <FCM_TOKEN>');
            return;
          }
          await this.sender.sendTestSeries(args[0]);
          break;

        case 'monitor':
          await this.sender.startTokenMonitoring();
          break;

        case 'token':
          const token = await this.sender.tokenManager.getAccessToken();
          console.log(`🔑 Access Token: ${token}`);
          break;

        case 'help':
          this.showMenu();
          break;

        default:
          console.error(`❌ Comando sconosciuto: ${command}`);
          this.showMenu();
      }
    } catch (error) {
      console.error('💥 Errore esecuzione comando:', error.message);
    }
  }
}

/**
 * 🚀 Funzione principale
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  const commandSystem = new FCMCommandSystem();

  if (!command) {
    commandSystem.showMenu();
    return;
  }

  await commandSystem.executeCommand(command, commandArgs);
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Errore fatale:', error.message);
    process.exit(1);
  });
}

export { FirebaseTokenManager, FCMNotificationSender, FCMCommandSystem };
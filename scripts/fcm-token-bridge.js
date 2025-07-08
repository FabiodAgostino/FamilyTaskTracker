// scripts/fcm-token-bridge.js
// 🌉 Bridge per catturare automaticamente token FCM dalla tua app

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FCMNotificationSender } from './firebase-fcm-automation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_BRIDGE_FILE = path.join(__dirname, '../.fcm-tokens-bridge.json');
const WATCHED_TOKENS_FILE = path.join(__dirname, '../.watched-tokens.json');

/**
 * 🎯 Sistema di bridge per catturare token FCM automaticamente
 */
class FCMTokenBridge {
  constructor() {
    this.sender = new FCMNotificationSender();
    this.watchedTokens = new Set();
    this.loadWatchedTokens();
  }

  /**
   * Carica token già processati
   */
  loadWatchedTokens() {
    try {
      if (fs.existsSync(WATCHED_TOKENS_FILE)) {
        const data = JSON.parse(fs.readFileSync(WATCHED_TOKENS_FILE, 'utf8'));
        this.watchedTokens = new Set(data.tokens || []);
              }
    } catch (error) {
      console.warn('⚠️ Impossibile caricare token watched:', error.message);
    }
  }

  /**
   * Salva token processati
   */
  saveWatchedTokens() {
    try {
      const data = {
        tokens: Array.from(this.watchedTokens),
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(WATCHED_TOKENS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('⚠️ Impossibile salvare token watched:', error.message);
    }
  }

  /**
   * Registra un nuovo token dal browser
   */
  registerToken(token, userInfo = {}) {
    try {
      const tokenData = {
        token,
        userInfo,
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      // Leggi tokens esistenti
      let bridgeData = { tokens: [] };
      if (fs.existsSync(TOKEN_BRIDGE_FILE)) {
        bridgeData = JSON.parse(fs.readFileSync(TOKEN_BRIDGE_FILE, 'utf8'));
      }

      // Aggiungi o aggiorna token
      const existingIndex = bridgeData.tokens.findIndex(t => t.token === token);
      if (existingIndex >= 0) {
        bridgeData.tokens[existingIndex] = { ...bridgeData.tokens[existingIndex], ...tokenData };
              } else {
        bridgeData.tokens.push(tokenData);
              }

      // Salva
      fs.writeFileSync(TOKEN_BRIDGE_FILE, JSON.stringify(bridgeData, null, 2));
      
      return tokenData;
    } catch (error) {
      console.error('❌ Errore registrazione token:', error.message);
      throw error;
    }
  }

  /**
   * Ottieni tutti i token disponibili
   */
  getAvailableTokens() {
    try {
      if (!fs.existsSync(TOKEN_BRIDGE_FILE)) {
        return [];
      }

      const bridgeData = JSON.parse(fs.readFileSync(TOKEN_BRIDGE_FILE, 'utf8'));
      return bridgeData.tokens || [];
    } catch (error) {
      console.error('❌ Errore lettura token:', error.message);
      return [];
    }
  }

  /**
   * Invia notifica di benvenuto a nuovo token
   */
  async sendWelcomeNotification(token) {
    if (this.watchedTokens.has(token)) {
            return;
    }

    try {
      const notification = {
        title: "🎉 Notifiche Attivate!",
        body: "Sistema automatico configurato e funzionante!"
      };

      const data = {
        welcome: "true",
        setup_completed: "true"
      };

      await this.sender.sendNotification(token, notification, data);
      
      // Aggiungi ai token processati
      this.watchedTokens.add(token);
      this.saveWatchedTokens();
      
          } catch (error) {
      console.error('❌ Errore invio welcome:', error.message);
    }
  }

  /**
   * Avvia monitoring automatico
   */
  async startAutoMonitoring() {
        
    const monitorInterval = setInterval(async () => {
      try {
        const tokens = this.getAvailableTokens();
        
        for (const tokenData of tokens) {
          const { token } = tokenData;
          
          // Invia welcome se è un nuovo token
          if (!this.watchedTokens.has(token)) {
                        await this.sendWelcomeNotification(token);
          }
        }

        if (tokens.length > 0) {
                  } else {
                  }
        
      } catch (error) {
        console.error('❌ Errore monitoring:', error.message);
      }
    }, 15000); // Controlla ogni 15 secondi

    // Cleanup dopo 30 minuti
    setTimeout(() => {
      clearInterval(monitorInterval);
                }, 1800000);

      }

  /**
   * Testa tutti i token disponibili
   */
  async testAllTokens() {
    const tokens = this.getAvailableTokens();
    
    if (tokens.length === 0) {
                  return;
    }

    
    for (let i = 0; i < tokens.length; i++) {
      const { token, userInfo } = tokens[i];
      
      try {
                                
        const notification = {
          title: `🧪 Test Automatico ${i + 1}`,
          body: `Notifica di test per ${userInfo.username || 'utente'}`
        };

        await this.sender.sendNotification(token, notification);
                
        // Pausa tra i test
        if (i < tokens.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Test ${i + 1} fallito:`, error.message);
      }
    }

      }

  /**
   * Pulisce token vecchi
   */
  cleanupOldTokens(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 giorni
    try {
      const tokens = this.getAvailableTokens();
      const now = Date.now();
      
      const validTokens = tokens.filter(tokenData => {
        const age = now - new Date(tokenData.registeredAt).getTime();
        return age < maxAge;
      });

      if (validTokens.length < tokens.length) {
        const removed = tokens.length - validTokens.length;
                
        const bridgeData = { tokens: validTokens };
        fs.writeFileSync(TOKEN_BRIDGE_FILE, JSON.stringify(bridgeData, null, 2));
      }

      return validTokens;
    } catch (error) {
      console.error('❌ Errore cleanup:', error.message);
      return [];
    }
  }

  /**
   * Mostra statistiche
   */
  showStats() {
    const tokens = this.getAvailableTokens();
    
                
    if (tokens.length > 0) {
            tokens.forEach((tokenData, index) => {
        const { userInfo, registeredAt } = tokenData;
        const age = Math.floor((Date.now() - new Date(registeredAt).getTime()) / (1000 * 60));
              });
    }
    
      }
}

/**
 * 🚀 Funzione principale
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const bridge = new FCMTokenBridge();

  switch (command) {
    case 'start':
    case 'monitor':
      await bridge.startAutoMonitoring();
      break;

    case 'test':
      await bridge.testAllTokens();
      break;

    case 'stats':
      bridge.showStats();
      break;

    case 'cleanup':
      bridge.cleanupOldTokens();
      bridge.showStats();
      break;

    case 'register':
      if (!args[1]) {
        console.error('❌ Uso: npm run fcm:bridge:register <TOKEN> [username]');
        return;
      }
      bridge.registerToken(args[1], { username: args[2] || 'manual' });
      break;

    default:
                                                  }
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Errore bridge:', error.message);
    process.exit(1);
  });
}

export { FCMTokenBridge };
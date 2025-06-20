// scripts/build-service-worker.js
// 🔧 Script per generare il service worker con le variabili d'ambiente (ES Module)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Genera il service worker sostituendo i placeholder con le variabili d'ambiente
 */
function buildServiceWorker() {
  try {
    console.log('🔄 Generando service worker...');

    // Percorsi file
    const templatePath = path.join(__dirname, '../client/public/firebase-messaging-sw.template.js');
    const outputPath = path.join(__dirname, '../client/public/firebase-messaging-sw.js');

    // Verifica che il template esista
    if (!fs.existsSync(templatePath)) {
      throw new Error(`❌ Template non trovato: ${templatePath}`);
    }

    // Leggi il template
    let template = fs.readFileSync(templatePath, 'utf8');

    // Mappa delle sostituzioni con fallback sicuri
    const replacements = {
      '__VITE_FIREBASE_API_KEY__': process.env.VITE_FIREBASE_API_KEY || '',
      '__VITE_FIREBASE_AUTH_DOMAIN__': process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      '__VITE_FIREBASE_PROJECT_ID__': process.env.VITE_FIREBASE_PROJECT_ID || '',
      '__VITE_FIREBASE_STORAGE_BUCKET__': process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      '__VITE_FIREBASE_MESSAGING_SENDER_ID__': process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      '__VITE_FIREBASE_APP_ID__': process.env.VITE_FIREBASE_APP_ID || '',
      '__VITE_FIREBASE_MEASUREMENT_ID__': process.env.VITE_FIREBASE_MEASUREMENT_ID || '',
      '__VITE_APP_NAME__': process.env.VITE_APP_NAME || 'Family Task Tracker',
      '__VITE_BASE_URL__': process.env.VITE_BASE_URL || '/FamilyTaskTracker/',
      '__VITE_APP_ENVIRONMENT__': process.env.VITE_APP_ENVIRONMENT || process.env.NODE_ENV || 'development',
      '__VITE_APP_VERSION__': process.env.VITE_APP_VERSION || '1.0.0'
    };

    // Verifica variabili critiche
    const criticalVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ];

    const missingVars = criticalVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn('⚠️  Variabili d\'ambiente mancanti:', missingVars.join(', '));
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`❌ Variabili critiche mancanti in produzione: ${missingVars.join(', ')}`);
      } else {
        console.log('🔧 Modalità sviluppo: continuando con valori fallback...');
      }
    }

    // Sostituisci tutti i placeholder
    Object.entries(replacements).forEach(([placeholder, value]) => {
      template = template.replace(new RegExp(placeholder, 'g'), value);
    });

    // Aggiungi header con info build
    const buildInfo = `// 🔥 Generated Service Worker - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}
// Environment: ${process.env.NODE_ENV || 'development'}
// Version: ${process.env.VITE_APP_VERSION || '1.0.0'}

`;

    const finalServiceWorker = buildInfo + template;

    // Crea la directory se non esiste
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Scrivi il file finale
    fs.writeFileSync(outputPath, finalServiceWorker, 'utf8');

    console.log('✅ Service worker generato con successo!');
    console.log(`📁 File: ${outputPath}`);
    console.log(`📊 Dimensione: ${(finalServiceWorker.length / 1024).toFixed(2)} KB`);

    // Log delle variabili utilizzate (senza valori sensibili)
    console.log('🔧 Variabili configurate:');
    Object.keys(replacements).forEach(key => {
      const value = replacements[key];
      if (key.includes('API_KEY') || key.includes('SECRET')) {
        console.log(`  - ${key}: ${'*'.repeat(Math.min(value.length, 20))}`);
      } else {
        console.log(`  - ${key}: ${value || '(vuoto)'}`);
      }
    });

    return true;

  } catch (error) {
    console.error('❌ Errore nella generazione del service worker:', error.message);
    return false;
  }
}

/**
 * Pulisce il service worker generato (per cleanup)
 */
function cleanServiceWorker() {
  const outputPath = path.join(__dirname, '../client/public/firebase-messaging-sw.js');
  
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log('🧹 Service worker pulito');
    return true;
  }
  return false;
}

// Esegui se chiamato direttamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  
  switch (command) {
    case 'clean':
      cleanServiceWorker();
      break;
    case 'build':
    default:
      const success = buildServiceWorker();
      process.exit(success ? 0 : 1);
      break;
  }
}

export {
  buildServiceWorker,
  cleanServiceWorker
};
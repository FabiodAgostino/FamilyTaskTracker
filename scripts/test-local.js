// scripts/test-local.js
// 🧪 Script completo per testare tutto in locale (ES Module)

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colori per output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  }

/**
 * Simula le variabili d'ambiente di GitHub Actions
 */
function setupTestEnvironment() {
  log('cyan', '🔧 Setup ambiente di test...');
  
  // Simula le variabili che avresti nei GitHub Secrets
  const testEnvVars = {
    'VITE_FIREBASE_API_KEY': 'test-api-key-replace-with-real-one',
    'VITE_FIREBASE_AUTH_DOMAIN': 'familytasktracker-c2dfe.firebaseapp.com',
    'VITE_FIREBASE_PROJECT_ID': 'familytasktracker-c2dfe',
    'VITE_FIREBASE_STORAGE_BUCKET': 'familytasktracker-c2dfe.firebasestorage.app',
    'VITE_FIREBASE_MESSAGING_SENDER_ID': '984085570940',
    'VITE_FIREBASE_APP_ID': '1:984085570940:web:ddc61b61702341939130f9',
    'VITE_FIREBASE_MEASUREMENT_ID': 'G-2TFQZKTN8G',
    'VITE_APP_NAME': 'Family Task Tracker',
    'VITE_APP_VERSION': '1.0.0-test',
    'VITE_APP_ENVIRONMENT': 'testing',
    'VITE_BASE_URL': './',  // ← Base URL relativo per test locale
    'NODE_ENV': 'development'
  };

  // Crea file .env di test
  const envContent = Object.entries(testEnvVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(path.join(__dirname, '../client/.env.test'), envContent);
  
  // Setta le variabili nel processo corrente
  Object.entries(testEnvVars).forEach(([key, value]) => {
    process.env[key] = value;
  });

  log('green', '✅ Ambiente di test configurato');
  log('yellow', '📝 File .env.test creato in client/');
  
  return testEnvVars;
}

/**
 * Testa la generazione del service worker
 */
async function testServiceWorkerGeneration() {
  log('cyan', '🔄 Testing service worker generation...');
  
  try {
    // Rimuovi service worker esistente se presente
    const swPath = path.join(__dirname, '../client/public/firebase-messaging-sw.js');
    if (fs.existsSync(swPath)) {
      fs.unlinkSync(swPath);
      log('yellow', '🧹 Service worker esistente rimosso');
    }

    // Importa dinamicamente il modulo (per ES modules)
    const { buildServiceWorker } = await import('./build-service-worker.js');
    const success = buildServiceWorker();

    if (!success) {
      throw new Error('buildServiceWorker returned false');
    }

    // Verifica che sia stato creato
    if (!fs.existsSync(swPath)) {
      throw new Error('Service worker non generato');
    }

    // Verifica contenuto
    const swContent = fs.readFileSync(swPath, 'utf8');
    
    // Controlla che non ci siano placeholder
    const placeholders = swContent.match(/__VITE_\w+__/g);
    if (placeholders) {
      throw new Error(`Placeholder non sostituiti: ${placeholders.join(', ')}`);
    }

    // Controlla che abbia le configurazioni corrette
    if (!swContent.includes('familytasktracker-c2dfe')) {
      throw new Error('Configurazione Firebase mancante');
    }

    if (!swContent.includes('Family Task Tracker')) {
      throw new Error('Nome app mancante');
    }

    log('green', '✅ Service worker generato e validato correttamente');
    log('blue', `📊 Dimensione: ${(swContent.length / 1024).toFixed(2)} KB`);

    return true;

  } catch (error) {
    log('red', `❌ Errore test service worker: ${error.message}`);
    throw error;
  }
}

/**
 * Testa il build completo
 */
async function testFullBuild() {
  log('cyan', '🏗️ Testing full build...');

  return new Promise((resolve, reject) => {
    // Cambia nella directory client
    const clientDir = path.join(__dirname, '../client');
    
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: clientDir,
      stdio: 'pipe',
      env: { ...process.env },
      shell: true // Necessario su Windows
    });

    let output = '';
    let errorOutput = '';

    buildProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    buildProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        log('green', '✅ Build completato con successo');
        
        // Mostra l'output del build (solo ultime righe)
        if (output) {
          const lines = output.split('\n').slice(-10);
          log('blue', '📝 Output build (ultime 10 righe):');
          lines.forEach(line =>         }
        
        resolve();
      } else {
        log('red', `❌ Build fallito con codice ${code}`);
        if (errorOutput) {
          log('red', '📝 Errori build:');
                  }
        reject(new Error(`Build fallito: ${code}`));
      }
    });

    buildProcess.on('error', (error) => {
      log('red', `❌ Errore avvio build: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Verifica i file generati
 */
function testGeneratedFiles() {
  log('cyan', '🔍 Verificando file generati...');

  const filesToCheck = [
    '../docs/index.html',
    '../docs/firebase-messaging-sw.js',
    '../client/public/firebase-messaging-sw.js'
  ];

  const results = [];
  let allOK = true;

  filesToCheck.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      const stats = fs.statSync(fullPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      results.push({ file: filePath, exists: true, size: `${sizeKB} KB` });
      log('green', `✅ ${filePath} - ${sizeKB} KB`);
    } else {
      results.push({ file: filePath, exists: false, size: 'N/A' });
      log('red', `❌ ${filePath} - Non trovato`);
      allOK = false;
    }
  });

  // Verifica contenuto docs/firebase-messaging-sw.js
  const docsSWPath = path.join(__dirname, '../docs/firebase-messaging-sw.js');
  if (fs.existsSync(docsSWPath)) {
    const content = fs.readFileSync(docsSWPath, 'utf8');
    
    if (content.includes('__VITE_')) {
      log('red', '❌ Service worker in docs contiene placeholder!');
      allOK = false;
    } else if (!content.includes('firebase.initializeApp')) {
      log('red', '❌ Service worker in docs non contiene inizializzazione Firebase!');
      allOK = false;
    } else {
      log('green', '✅ Service worker in docs validato');
    }
  }

  return allOK;
}

/**
 * Simula un server locale per testare
 */
async function testLocalServer() {
  log('cyan', '🌐 Avviando server locale per test...');

  return new Promise((resolve) => {
    // Prova prima con http-server, poi con un semplice server Python
    let serverProcess = spawn('npx', ['http-server', 'docs', '-p', '8080', '-c-1'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      shell: true
    });

    let serverOutput = '';
    let serverStarted = false;

    serverProcess.stdout.on('data', (data) => {
      serverOutput += data.toString();
      
      // Quando il server è pronto
      if (serverOutput.includes('Available on:') || serverOutput.includes('localhost:8080')) {
        if (!serverStarted) {
          serverStarted = true;
          log('green', '✅ Server locale avviato su http://localhost:8080');
          log('yellow', '🔗 Apri il browser e vai su http://localhost:8080');
          log('yellow', '📱 Apri DevTools → Application → Service Workers per verificare');
          log('yellow', '🔔 Testa le notifiche (se supportate dal browser)');
          log('blue', '\n📋 CHECKLIST MANUALE:');
          log('blue', '  [ ] Pagina si carica correttamente');
          log('blue', '  [ ] Service worker si registra (DevTools → Application)');
          log('blue', '  [ ] Firebase si inizializza senza errori (Console)');
          log('blue', '  [ ] Configurazione Firebase corretta');
          log('blue', '\n⌨️  Premi CTRL+C per fermare il server\n');
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const errorStr = data.toString();
      if (errorStr.includes('ENOENT') && errorStr.includes('http-server')) {
        log('yellow', '⚠️  http-server non trovato, installando...');
        // Fallback: prova con Python
        serverProcess.kill();
        startPythonServer(resolve);
      } else {
        console.error(errorStr);
      }
    });

    serverProcess.on('error', (error) => {
      if (error.message.includes('ENOENT')) {
        log('yellow', '⚠️  Tentando con server Python...');
        startPythonServer(resolve);
      } else {
        log('red', `❌ Errore server: ${error.message}`);
      }
    });

    // Gestisci CTRL+C
    process.on('SIGINT', () => {
      log('yellow', '\n🛑 Fermando server locale...');
      serverProcess.kill();
      resolve();
    });
  });
}

/**
 * Fallback: usa Python HTTP server
 */
function startPythonServer(resolve) {
  log('cyan', '🐍 Avviando server Python...');
  
  const pythonServer = spawn('python', ['-m', 'http.server', '8080'], {
    cwd: path.join(__dirname, '../docs'),
    stdio: 'pipe',
    shell: true
  });

  pythonServer.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('8080')) {
      log('green', '✅ Server Python avviato su http://localhost:8080');
      log('yellow', '🔗 Apri il browser e vai su http://localhost:8080');
    }
  });

  pythonServer.on('error', () => {
    log('red', '❌ Anche Python server non disponibile');
    log('yellow', '💡 Apri manualmente docs/index.html nel browser');
    resolve();
  });

  process.on('SIGINT', () => {
    log('yellow', '\n🛑 Fermando server Python...');
    pythonServer.kill();
    resolve();
  });
}

/**
 * Cleanup file di test
 */
function cleanup() {
  log('cyan', '🧹 Cleanup file di test...');
  
  const filesToClean = [
    '../client/.env.test'
  ];

  filesToClean.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      log('green', `✅ Rimosso ${filePath}`);
    }
  });
}

/**
 * Test completo
 */
async function runFullTest() {
  log('magenta', '🧪 AVVIO TEST COMPLETO LOCALE\n');

  try {
    setupTestEnvironment();
    await testServiceWorkerGeneration();
    await testFullBuild();
    const filesOK = testGeneratedFiles();
    
    if (!filesOK) {
      throw new Error('Alcuni file non sono stati generati correttamente');
    }

    log('green', '\n🎉 TUTTI I TEST PASSATI!');
    log('blue', '\n🚀 Vuoi avviare il server locale per test manuali? (CTRL+C per uscire)');
    
    await testLocalServer();

  } catch (error) {
    log('red', `\n💥 TEST FALLITO: ${error.message}`);
    return false;
  } finally {
    cleanup();
  }
  
  return true;
}

// Esegui se chiamato direttamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'sw':
        setupTestEnvironment();
        await testServiceWorkerGeneration();
        break;
      case 'build':
        setupTestEnvironment();
        await testFullBuild();
        break;
      case 'server':
        await testLocalServer();
        break;
      case 'clean':
        cleanup();
        break;
      default:
        const success = await runFullTest();
        process.exit(success ? 0 : 1);
        break;
    }
  } catch (error) {
    log('red', `❌ Errore: ${error.message}`);
    process.exit(1);
  }
}

export {
  setupTestEnvironment,
  testServiceWorkerGeneration,
  testFullBuild,
  testGeneratedFiles,
  testLocalServer,
  cleanup
};
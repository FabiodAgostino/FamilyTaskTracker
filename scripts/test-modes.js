// scripts/test-modes.js
// 🧪 Test con diverse modalità (locale, staging, produzione)

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Configurazioni per diverse modalità
 */
const modes = {
  local: {
    name: 'Locale (Development)',
    env: {
      'NODE_ENV': 'development',
      'VITE_BASE_URL': './',
      'VITE_APP_ENVIRONMENT': 'local'
    },
    description: 'Test locale con server su docs/ senza prefisso'
  },
  
  staging: {
    name: 'Staging (GitHub Pages Preview)', 
    env: {
      'NODE_ENV': 'production',
      'VITE_BASE_URL': '/FamilyTaskTracker/',
      'VITE_APP_ENVIRONMENT': 'staging'
    },
    description: 'Simula GitHub Pages con prefisso /FamilyTaskTracker/'
  },
  
  production: {
    name: 'Production (GitHub Pages)',
    env: {
      'NODE_ENV': 'production', 
      'VITE_BASE_URL': '/FamilyTaskTracker/',
      'VITE_APP_ENVIRONMENT': 'production'
    },
    description: 'Configurazione finale per GitHub Pages'
  }
};

/**
 * Setup comune delle variabili d'ambiente
 */
function getBaseEnvVars() {
  return {
    'VITE_FIREBASE_API_KEY': 'test-api-key-replace-with-real-one',
    'VITE_FIREBASE_AUTH_DOMAIN': 'familytasktracker-c2dfe.firebaseapp.com',
    'VITE_FIREBASE_PROJECT_ID': 'familytasktracker-c2dfe',
    'VITE_FIREBASE_STORAGE_BUCKET': 'familytasktracker-c2dfe.firebasestorage.app',
    'VITE_FIREBASE_MESSAGING_SENDER_ID': '984085570940',
    'VITE_FIREBASE_APP_ID': '1:984085570940:web:ddc61b61702341939130f9',
    'VITE_FIREBASE_MEASUREMENT_ID': 'G-2TFQZKTN8G',
    'VITE_APP_NAME': 'Family Task Tracker',
    'VITE_APP_VERSION': '1.0.0-test'
  };
}

/**
 * Esegue il build per una modalità specifica
 */
async function buildForMode(modeName) {
  const mode = modes[modeName];
  if (!mode) {
    throw new Error(`Modalità sconosciuta: ${modeName}`);
  }

  log('cyan', `🔨 Building per modalità: ${mode.name}`);
  log('blue', `📝 ${mode.description}`);

  // Combina variabili base con quelle specifiche della modalità
  const envVars = {
    ...getBaseEnvVars(),
    ...mode.env
  };

  // Crea file .env specifico
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const envFilePath = path.join(__dirname, `../client/.env.${modeName}`);
  fs.writeFileSync(envFilePath, envContent);
  
  log('green', `✅ File .env.${modeName} creato`);
  
  // Log configurazione
  log('yellow', '🔧 Configurazione:');
  Object.entries(mode.env).forEach(([key, value]) => {
    log('yellow', `  - ${key}: ${value}`);
  });

  return new Promise((resolve, reject) => {
    const rootDir = path.join(__dirname, '..');
    
    // Verifica che la directory root esista
    if (!fs.existsSync(rootDir)) {
      reject(new Error(`Directory root non trovata: ${rootDir}`));
      return;
    }

    // Verifica che index.html esista nella struttura corretta
    const indexPath = path.join(rootDir, 'client', 'index.html');
    if (!fs.existsSync(indexPath)) {
      reject(new Error(`File index.html non trovato: ${indexPath}`));
      return;
    }

    // Verifica che vite.config esista nella root
    const viteConfigJS = path.join(rootDir, 'vite.config.js');
    const viteConfigTS = path.join(rootDir, 'vite.config.ts');
    const viteConfigExists = fs.existsSync(viteConfigJS) || fs.existsSync(viteConfigTS);
    
    if (!viteConfigExists) {
      reject(new Error(`File vite.config.js/ts non trovato nella root: ${rootDir}`));
      return;
    }

    log('blue', `📁 Building da directory: ${rootDir}`);
    log('blue', `📄 Index.html: ${fs.existsSync(indexPath) ? '✅' : '❌'}`);
    log('blue', `⚙️  Vite config: ${viteConfigExists ? '✅' : '❌'}`);
    
    // Esegui build dalla ROOT, non da client
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: rootDir,  // ← CAMBIATO: esegui dalla root
      stdio: 'pipe',
      env: { ...process.env, ...envVars },
      shell: true
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
        log('green', `✅ Build ${mode.name} completato`);
        
        // Analizza l'output
        const lines = output.split('\n');
        const buildStats = lines.filter(line => 
          line.includes('kB') || line.includes('built in')
        );
        
        if (buildStats.length > 0) {
          log('blue', '📊 Statistiche build:');
          buildStats.forEach(stat => log('blue', `  ${stat.trim()}`));
        }
        
        resolve({ mode: modeName, success: true, output });
      } else {
        log('red', `❌ Build ${mode.name} fallito con codice ${code}`);
        if (errorOutput) {
          log('red', '📝 Errori:');
          console.error(errorOutput);
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
 * Verifica i file generati per una modalità
 */
function verifyModeFiles(modeName) {
  const mode = modes[modeName];
  log('cyan', `🔍 Verificando file per modalità: ${mode.name}`);

  const docsPath = path.join(__dirname, '../docs');
  const indexPath = path.join(docsPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    throw new Error('File index.html non trovato in docs/');
  }

  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Analizza i link generati
  const assetLinks = indexContent.match(/(?:href|src)="([^"]+\.(css|js))"/g) || [];
  
  log('blue', '🔗 Link assets trovati:');
  assetLinks.forEach(link => {
    log('blue', `  ${link}`);
  });

  // Verifica base URL nei link
  const expectedBase = mode.env.VITE_BASE_URL;
  if (expectedBase === './') {
    // Per base relativo, i link dovrebbero iniziare con ./assets/
    const hasRelativeLinks = assetLinks.some(link => link.includes('./assets/'));
    if (!hasRelativeLinks) {
      log('yellow', '⚠️  Nessun link relativo trovato per modalità locale');
    } else {
      log('green', '✅ Link relativi trovati per modalità locale');
    }
  } else {
    // Per base assoluto, i link dovrebbero includere il prefisso
    const hasAbsoluteLinks = assetLinks.some(link => link.includes(expectedBase));
    if (!hasAbsoluteLinks) {
      log('yellow', `⚠️  Nessun link con base ${expectedBase} trovato`);
    } else {
      log('green', `✅ Link con base ${expectedBase} trovati`);
    }
  }

  return true;
}

/**
 * Avvia server locale per test
 */
async function startServer(modeName, port = 8080) {
  const mode = modes[modeName];
  log('cyan', `🌐 Avviando server per modalità: ${mode.name} su porta ${port}`);

  return new Promise((resolve) => {
    const serverProcess = spawn('npx', ['http-server', 'docs', '-p', port.toString(), '-c-1'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      shell: true
    });

    let serverStarted = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      if ((output.includes('Available on:') || output.includes(`localhost:${port}`)) && !serverStarted) {
        serverStarted = true;
        log('green', `✅ Server ${mode.name} avviato su http://localhost:${port}`);
        log('yellow', `🔗 Test URL: http://localhost:${port}`);
        
        if (mode.env.VITE_BASE_URL !== './') {
          log('yellow', `📝 Nota: Questa modalità usa base URL ${mode.env.VITE_BASE_URL}`);
          log('yellow', '📝 I link potrebbero non funzionare su server locale senza proxy');
        }
        
        log('blue', '\n📋 Da verificare nel browser:');
        log('blue', '  [ ] Pagina si carica senza errori 404');
        log('blue', '  [ ] Assets (CSS, JS) si caricano correttamente');
        log('blue', '  [ ] Service worker si registra');
        log('blue', '  [ ] Console senza errori');
        log('blue', '\n⌨️  Premi CTRL+C per fermare\n');
      }
    });

    serverProcess.on('error', (error) => {
      log('red', `❌ Errore server: ${error.message}`);
      resolve();
    });

    process.on('SIGINT', () => {
      log('yellow', `\n🛑 Fermando server ${mode.name}...`);
      serverProcess.kill();
      resolve();
    });
  });
}

/**
 * Test di tutte le modalità
 */
async function testAllModes() {
  log('magenta', '🧪 TESTING TUTTE LE MODALITÀ\n');

  const results = [];

  for (const [modeName, mode] of Object.entries(modes)) {
    try {
      log('cyan', `\n${'='.repeat(50)}`);
      log('cyan', `🔄 TESTING MODALITÀ: ${mode.name.toUpperCase()}`);
      log('cyan', `${'='.repeat(50)}`);

      const result = await buildForMode(modeName);
      verifyModeFiles(modeName);
      
      results.push({ mode: modeName, success: true });
      log('green', `✅ Modalità ${mode.name} - SUCCESSO\n`);

    } catch (error) {
      results.push({ mode: modeName, success: false, error: error.message });
      log('red', `❌ Modalità ${mode.name} - FALLITO: ${error.message}\n`);
    }
  }

  // Riepilogo
  log('magenta', '\n📊 RIEPILOGO RISULTATI:');
  results.forEach(result => {
    const emoji = result.success ? '✅' : '❌';
    const status = result.success ? 'SUCCESSO' : `FALLITO (${result.error})`;
    log(result.success ? 'green' : 'red', `${emoji} ${modes[result.mode].name}: ${status}`);
  });

  const successCount = results.filter(r => r.success).length;
  log('blue', `\n🎯 ${successCount}/${results.length} modalità completate con successo`);

  return results;
}

/**
 * Cleanup
 */
function cleanup() {
  log('cyan', '🧹 Cleanup file di test...');
  
  Object.keys(modes).forEach(modeName => {
    const envFile = path.join(__dirname, `../client/.env.${modeName}`);
    if (fs.existsSync(envFile)) {
      fs.unlinkSync(envFile);
      log('green', `✅ Rimosso .env.${modeName}`);
    }
  });
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  const mode = process.argv[3];

  try {
    switch (command) {
      case 'build':
        if (!mode || !modes[mode]) {
          log('red', `❌ Modalità richiesta. Usa: ${Object.keys(modes).join(', ')}`);
          process.exit(1);
        }
        await buildForMode(mode);
        verifyModeFiles(mode);
        break;

      case 'server':
        if (!mode || !modes[mode]) {
          log('red', `❌ Modalità richiesta. Usa: ${Object.keys(modes).join(', ')}`);
          process.exit(1);
        }
        await startServer(mode);
        break;

      case 'all':
        await testAllModes();
        break;

      case 'clean':
        cleanup();
        break;

      default:
        log('blue', '🧪 TEST MODALITÀ - Family Task Tracker\n');
        log('blue', 'Comandi disponibili:');
        log('blue', '  node scripts/test-modes.js build <mode>   - Build per una modalità');
        log('blue', '  node scripts/test-modes.js server <mode>  - Server per una modalità');
        log('blue', '  node scripts/test-modes.js all           - Test tutte le modalità');
        log('blue', '  node scripts/test-modes.js clean         - Pulisci file temporanei');
        log('blue', '\nModalità disponibili:');
        Object.entries(modes).forEach(([key, mode]) => {
          log('blue', `  - ${key}: ${mode.description}`);
        });
        break;
    }
  } catch (error) {
    log('red', `❌ Errore: ${error.message}`);
    process.exit(1);
  } finally {
    if (command !== 'server') {
      cleanup();
    }
  }
}

export { buildForMode, verifyModeFiles, startServer, testAllModes, cleanup };
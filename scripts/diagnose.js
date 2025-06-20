// scripts/diagnose.js
// 🔍 Diagnostica struttura progetto per risolvere problemi di build

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
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  const emoji = exists ? '✅' : '❌';
  log(exists ? 'green' : 'red', `${emoji} ${description}: ${filePath}`);
  
  if (exists) {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    log('blue', `   📊 Dimensione: ${sizeKB} KB`);
    
    if (filePath.endsWith('.json') && stats.size < 1000) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);
        log('blue', `   📋 Keys: ${Object.keys(parsed).join(', ')}`);
      } catch (e) {
        log('red', `   ❌ JSON non valido: ${e.message}`);
      }
    }
  }
  
  return exists;
}

function checkDirectory(dirPath, description) {
  const exists = fs.existsSync(dirPath);
  const emoji = exists ? '📁' : '❌';
  log(exists ? 'green' : 'red', `${emoji} ${description}: ${dirPath}`);
  
  if (exists) {
    const files = fs.readdirSync(dirPath);
    log('blue', `   📄 File (${files.length}): ${files.slice(0, 10).join(', ')}${files.length > 10 ? '...' : ''}`);
  }
  
  return exists;
}

function diagnoseProject() {
  log('cyan', '🔍 DIAGNOSTICA STRUTTURA PROGETTO\n');

  const rootDir = path.join(__dirname, '..');
  log('blue', `📍 Root directory: ${rootDir}\n`);

  // 1. Verifica struttura base
  log('cyan', '📁 STRUTTURA DIRECTORY:');
  checkDirectory(rootDir, 'Root project');
  checkDirectory(path.join(rootDir, 'client'), 'Client directory');
  checkDirectory(path.join(rootDir, 'client', 'src'), 'Client src');
  checkDirectory(path.join(rootDir, 'client', 'public'), 'Client public');
  checkDirectory(path.join(rootDir, 'scripts'), 'Scripts directory');
  checkDirectory(path.join(rootDir, 'docs'), 'Docs directory (output)');

  console.log();

  // 2. Verifica file critici
  log('cyan', '📄 FILE CRITICI:');
  checkFile(path.join(rootDir, 'package.json'), 'Root package.json');
  checkFile(path.join(rootDir, 'client', 'package.json'), 'Client package.json');
  checkFile(path.join(rootDir, 'client', 'index.html'), 'Client index.html');
  checkFile(path.join(rootDir, 'client', 'vite.config.js'), 'Vite config');

  console.log();

  // 3. Verifica file generati
  log('cyan', '🔧 FILE GENERATI:');
  checkFile(path.join(rootDir, 'client', 'public', 'firebase-messaging-sw.js'), 'Service Worker');
  checkFile(path.join(rootDir, 'client', 'public', 'manifest.json'), 'PWA Manifest');
  checkFile(path.join(rootDir, 'client', 'public', 'icon-192.png'), 'Icona 192x192');
  checkFile(path.join(rootDir, 'client', 'public', 'icon-512.png'), 'Icona 512x512');

  console.log();

  // 4. Verifica output
  log('cyan', '📤 OUTPUT BUILD:');
  checkFile(path.join(rootDir, 'docs', 'index.html'), 'Build index.html');
  checkFile(path.join(rootDir, 'docs', 'firebase-messaging-sw.js'), 'Build Service Worker');
  checkFile(path.join(rootDir, 'docs', 'manifest.json'), 'Build Manifest');

  console.log();

  // 5. Analizza index.html se esiste
  const indexPath = path.join(rootDir, 'client', 'index.html');
  if (fs.existsSync(indexPath)) {
    log('cyan', '📝 ANALISI INDEX.HTML:');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    const hasReact = indexContent.includes('react');
    const hasRoot = indexContent.includes('id="root"');
    const hasScript = indexContent.includes('<script');
    const hasVite = indexContent.includes('/src/main') || indexContent.includes('main.tsx') || indexContent.includes('main.jsx');
    
    log(hasRoot ? 'green' : 'red', `${hasRoot ? '✅' : '❌'} Div root presente`);
    log(hasScript ? 'green' : 'red', `${hasScript ? '✅' : '❌'} Script tags presenti`);
    log(hasVite ? 'green' : 'red', `${hasVite ? '✅' : '❌'} Entry point Vite presente`);
    
    // Mostra content preview
    log('blue', '📝 Preview index.html:');
    const lines = indexContent.split('\n').slice(0, 15);
    lines.forEach((line, i) => {
      log('blue', `   ${i + 1}: ${line.trim()}`);
    });
  }

  console.log();

  // 6. Verifica package.json scripts
  const clientPackagePath = path.join(rootDir, 'client', 'package.json');
  if (fs.existsSync(clientPackagePath)) {
    log('cyan', '📦 ANALISI CLIENT PACKAGE.JSON:');
    try {
      const clientPackage = JSON.parse(fs.readFileSync(clientPackagePath, 'utf8'));
      
      const scripts = clientPackage.scripts || {};
      const deps = clientPackage.dependencies || {};
      const devDeps = clientPackage.devDependencies || {};
      
      log('blue', '🔧 Scripts disponibili:');
      Object.keys(scripts).forEach(script => {
        log('blue', `   - ${script}: ${scripts[script]}`);
      });
      
      log('blue', '📚 Dipendenze principali:');
      ['react', 'react-dom', 'vite', 'firebase'].forEach(dep => {
        const version = deps[dep] || devDeps[dep];
        log(version ? 'green' : 'yellow', `   - ${dep}: ${version || 'non trovato'}`);
      });
      
    } catch (e) {
      log('red', `❌ Errore parsing package.json: ${e.message}`);
    }
  }

  console.log();

  // 7. Raccomandazioni
  log('cyan', '💡 RACCOMANDAZIONI:');
  
  const recommendations = [];
  
  if (!fs.existsSync(path.join(rootDir, 'client', 'index.html'))) {
    recommendations.push('❌ Crea client/index.html');
  }
  
  if (!fs.existsSync(path.join(rootDir, 'client', 'vite.config.js'))) {
    recommendations.push('❌ Crea client/vite.config.js');
  }
  
  if (!fs.existsSync(path.join(rootDir, 'client', 'package.json'))) {
    recommendations.push('❌ Crea client/package.json');
  }
  
  if (recommendations.length === 0) {
    log('green', '✅ Struttura sembra corretta!');
    log('blue', '🚀 Prova: npm run build:local');
  } else {
    recommendations.forEach(rec => log('red', rec));
  }

  console.log();
}

function createMissingFiles() {
  log('cyan', '🔧 CREANDO FILE MANCANTI...\n');

  const rootDir = path.join(__dirname, '..');
  
  // Crea index.html basilare se mancante
  const indexPath = path.join(rootDir, 'client', 'index.html');
  if (!fs.existsSync(indexPath)) {
    const indexContent = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#E07A5F">
    <link rel="manifest" href="/manifest.json">
    <title>Family Task Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    
    fs.writeFileSync(indexPath, indexContent);
    log('green', '✅ Creato client/index.html');
  }

  // Crea package.json client se mancante
  const clientPackagePath = path.join(rootDir, 'client', 'package.json');
  if (!fs.existsSync(clientPackagePath)) {
    const clientPackage = {
      "name": "family-task-tracker-client",
      "private": true,
      "version": "1.0.0",
      "type": "module",
      "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
      },
      "dependencies": {
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "firebase": "^11.9.1"
      },
      "devDependencies": {
        "@vitejs/plugin-react": "^4.3.4",
        "vite": "^6.0.5"
      }
    };
    
    fs.writeFileSync(clientPackagePath, JSON.stringify(clientPackage, null, 2));
    log('green', '✅ Creato client/package.json');
  }

  log('blue', '\n🔄 Ora installa le dipendenze: cd client && npm install');
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];

  switch (command) {
    case 'fix':
      createMissingFiles();
      break;
    case 'diagnose':
    default:
      diagnoseProject();
      break;
  }
}

export { diagnoseProject, createMissingFiles };
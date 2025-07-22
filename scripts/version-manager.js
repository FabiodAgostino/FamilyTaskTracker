// scripts/version-manager.js
// 🔢 Gestione automatica delle versioni con sistema timestamp

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
  const prefix = colors[color] || '';
  console.log(`${prefix}${message}${colors.reset}`);
}

/**
 * Struttura del file version.json
 */
const VERSION_FILE = path.join(__dirname, '../version.json');

/**
 * Versione di default se il file non esiste
 */
const DEFAULT_VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  build: 0,
  lastUpdated: new Date().toISOString(),
  environment: 'development',
  deploymentId: null
};

function setSpecificVersion(versionString, environment = 'production') {
  const versionRegex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const match = versionString.match(versionRegex);
  if (!match) {
    throw new Error('Formato versione non valido. Usa: major.minor.patch.build (es: 5.1.4.0)');
  }
  const [, maj, min, pat, bu] = match;
  const major = Number(maj), minor = Number(min), patch = Number(pat), build = Number(bu);
  return {
    major,
    minor,
    patch,
    build,
    lastUpdated: new Date().toISOString(),
    environment,
    deploymentId: generateDeploymentId()
  };
}

function readVersion() {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      const content = fs.readFileSync(VERSION_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    log('yellow', `⚠️ Errore lettura version.json: ${error.message}`);
  }
  log('cyan', '📄 Creazione nuovo file version.json...');
  return DEFAULT_VERSION;
}

function writeVersion(versionData) {
  try {
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));
    log('green', `✅ Versione salvata: v${versionData.major}.${versionData.minor}.${versionData.patch}.${versionData.build}`);
  } catch (error) {
    log('red', `❌ Errore scrittura version.json: ${error.message}`);
    throw error;
  }
}

function incrementVersion(current, type = 'build') {
  const newVersion = { ...current, lastUpdated: new Date().toISOString(), deploymentId: generateDeploymentId() };
  switch (type) {
    case 'major':
      newVersion.major += 1; newVersion.minor = 0; newVersion.patch = 0; newVersion.build = 0;
      break;
    case 'minor':
      newVersion.minor += 1; newVersion.patch = 0; newVersion.build = 0;
      break;
    case 'patch':
      newVersion.patch += 1; newVersion.build = 0;
      break;
    case 'build':
    default:
      newVersion.build += 1;
      break;
  }
  return newVersion;
}

function formatVersion(v) {
  return `${v.major}.${v.minor}.${v.patch}.${v.build}`;
}

function generateDeploymentId() {
  const ts = Date.now();
  const rand = Math.random().toString(36).substr(2, 5);
  return `${ts}-${rand}`;
}

function main() {
  const command = process.argv[2] || 'increment';
  const typeOrVersion = process.argv[3];
  const environment = process.argv[4] || 'production';

  switch (command) {
    case 'set': {
      if (!typeOrVersion) {
        log('red', '❌ Specifica la versione dopo `set` (es: set 2.0.0.0)');
        process.exit(1);
      }
      log('cyan', `🔢 Imposto versione specifica: ${typeOrVersion}`);
      let newVer;
      try {
        newVer = setSpecificVersion(typeOrVersion, environment);
        writeVersion(newVer);
      } catch (err) {
        log('red', `❌ ${err.message}`);
        process.exit(1);
      }
      // Output per CI/CD
      console.log(`version=${formatVersion(newVer)}`);
      console.log(`build_number=${newVer.build}`);
      console.log(`deployment_id=${newVer.deploymentId}`);
      process.exit(0);
    }

    case 'increment': {
      const incrementType = typeOrVersion || 'build';
      log('cyan', `🔢 Incremento versione: ${incrementType}`);
      const current = readVersion();
      log('blue', `📋 Versione corrente: v${formatVersion(current)}`);
      const newVer = incrementVersion(current, incrementType);
      newVer.environment = environment;
      writeVersion(newVer);
      // Output per CI/CD
      console.log(`version=${formatVersion(newVer)}`);
      console.log(`build_number=${newVer.build}`);
      console.log(`deployment_id=${newVer.deploymentId}`);
      process.exit(0);
    }

    case 'reset': {
      log('yellow', '🔄 Reset versione ai valori di default');
      const resetVer = { ...DEFAULT_VERSION, environment, deploymentId: generateDeploymentId() };
      writeVersion(resetVer);
      process.exit(0);
    }

    default:
      log('red', `❌ Comando non riconosciuto: ${command}`);
      log('cyan', 'Comandi disponibili:');
      log('cyan', '  set <version> [environment]   - Imposta versione specifica');
      log('cyan', '  increment [build|patch|minor|major] [environment] - Incrementa versione');
      log('cyan', '  reset [environment]           - Reset versione ai default');
      process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { readVersion, writeVersion, incrementVersion, formatVersion, setSpecificVersion };

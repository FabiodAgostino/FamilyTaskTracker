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
  environment: 'development'
};
function setSpecificVersion(versionString, environment = 'production') {
  const versionRegex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const match = versionString.match(versionRegex);
  
  if (!match) {
    throw new Error('Formato versione non valido. Usa: major.minor.patch.build (es: 5.1.4.0)');
  }
  
  const [, major, minor, patch, build] = match.map(Number);
  
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
/**
 * Genera build number basato su timestamp (più unico)
 */
function generateBuildNumber() {
  // Usa gli ultimi 6 digit del timestamp per build number
  // Questo garantisce che ogni build sia sempre incrementale
  const timestamp = Date.now();
  const buildNumber = parseInt(timestamp.toString().slice(-6));
  return buildNumber;
}

/**
 * Genera versione basata su data corrente
 */
function generateTimestampVersion(type = 'build', environment = 'production') {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-based
  const day = now.getDate();
  
  // Leggi versione corrente per determinare patch se necessario
  const currentVersion = readVersion();
  
  let newVersion;
  
  switch (type) {
    case 'major':
      newVersion = {
        major: year - 2020, // 2025 = v5.x.x
        minor: 0,
        patch: 0,
        build: generateBuildNumber(),
        lastUpdated: now.toISOString(),
        environment: environment,
        deploymentId: generateDeploymentId()
      };
      break;
      
    case 'minor':
      newVersion = {
        major: currentVersion.major,
        minor: month, // 1-12 
        patch: 0,
        build: generateBuildNumber(),
        lastUpdated: now.toISOString(),
        environment: environment,
        deploymentId: generateDeploymentId()
      };
      break;
      
    case 'patch':
      newVersion = {
        major: currentVersion.major,
        minor: currentVersion.minor,
        patch: day, // 1-31
        build: generateBuildNumber(),
        lastUpdated: now.toISOString(),
        environment: environment,
        deploymentId: generateDeploymentId()
      };
      break;

    case 'set': {
      const versionString = process.argv[3];
      if (!versionString) {
        log('red', '❌ Specifica la versione (es: 5.1.4.0)');
        process.exit(1);
      }

      try {
        const newVersion = setSpecificVersion(versionString, environment);
        writeVersion(newVersion);
        log('green', `🎯 Versione impostata: ${formatVersion(newVersion)}`);
      } catch (error) {
        log('red', `❌ ${error.message}`);
        process.exit(1);
      }
      break;
      }
      
    case 'build':
    default:
      // Sistema completamente automatico: ogni deploy genera build number unico
      newVersion = {
        major: currentVersion.major,
        minor: currentVersion.minor, 
        patch: currentVersion.patch,
        build: generateBuildNumber(), // Sempre nuovo
        lastUpdated: now.toISOString(),
        environment: environment,
        deploymentId: generateDeploymentId()
      };
      break;
  }
  
  return newVersion;
}

/**
 * Legge la versione corrente dal file
 */
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

/**
 * Scrive la versione nel file
 */
function writeVersion(versionData) {
  try {
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));
    log('green', `✅ Versione salvata: v${versionData.major}.${versionData.minor}.${versionData.patch}.${versionData.build}`);
  } catch (error) {
    log('red', `❌ Errore scrittura version.json: ${error.message}`);
    throw error;
  }
}

/**
 * Incrementa la versione in base al tipo (LEGACY)
 */
function incrementVersion(current, type = 'build') {
  const newVersion = { ...current };
  newVersion.lastUpdated = new Date().toISOString();
  
  switch (type) {
    case 'major':
      newVersion.major += 1;
      newVersion.minor = 0;
      newVersion.patch = 0;
      newVersion.build = 0;
      break;
    case 'minor':
      newVersion.minor += 1;
      newVersion.patch = 0;
      newVersion.build = 0;
      break;
    case 'patch':
      newVersion.patch += 1;
      newVersion.build = 0;
      break;
    case 'build':
    default:
      newVersion.build += 1;
      break;
  }
  
  return newVersion;
}

/**
 * Formatta la versione come stringa
 */
function formatVersion(versionData) {
  return `v${versionData.major}.${versionData.minor}.${versionData.patch}.${versionData.build}`;
}

/**
 * Genera il deployment ID unico
 */
function generateDeploymentId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  return `${timestamp}-${random}`;
}

/**
 * Comando principale
 */
function main() {
  const command = process.argv[2] || 'increment';
  const type = process.argv[3] || 'build';
  const environment = process.argv[4] || 'production';
  
  log('cyan', `🔢 Version Manager - Comando: ${command}`);
  
  switch (command) {
    case 'increment': {
      log('cyan', '🔢 Incremento versione per deploy...');
      
      const currentVersion = readVersion();
      log('blue', `📋 Versione corrente: ${formatVersion(currentVersion)}`);
      
      // Sistema sequenziale tradizionale
      const newVersion = incrementVersion(currentVersion, type);
      newVersion.environment = environment;
      newVersion.deploymentId = generateDeploymentId();
      
      // Scrivi sempre il file aggiornato
      writeVersion(newVersion);
      
      // Output per il CI/CD
                        
      log('green', `🎉 Nuova versione: ${formatVersion(newVersion)}`);
      log('cyan', `🏗️ Build #${newVersion.build} | Environment: ${environment}`);
      break;
    }
    
    case 'increment-legacy': {
      // Sistema legacy per backward compatibility
      log('cyan', '🔢 Incremento versione legacy per deploy...');
      
      const currentVersion = readVersion();
      log('blue', `📋 Versione corrente: ${formatVersion(currentVersion)}`);
      
      const newVersion = incrementVersion(currentVersion, type);
      newVersion.environment = environment;
      newVersion.deploymentId = generateDeploymentId();
      
      writeVersion(newVersion);
      
      // Output per il CI/CD
                        
      log('green', `🎉 Nuova versione: ${formatVersion(newVersion)}`);
      log('cyan', `🏗️ Build #${newVersion.build} | Environment: ${environment}`);
      break;
    }
    
    case 'current': {
      const currentVersion = readVersion();
            break;
    }
    
    case 'info': {
      const currentVersion = readVersion();
      log('cyan', '📊 Informazioni Versione:');
            break;
    }
    
    case 'reset': {
      log('yellow', '🔄 Reset versione...');
      const resetVersion = { 
        ...DEFAULT_VERSION, 
        environment: environment 
      };
      writeVersion(resetVersion);
      break;
    }
    
    default:
      log('red', '❌ Comando non riconosciuto!');
      log('cyan', 'Comandi disponibili:');
      log('cyan', '  increment [build|patch|minor|major] [environment] - Incrementa versione (timestamp-based)');
      log('cyan', '  increment-legacy [build|patch|minor|major] [environment] - Incrementa versione (legacy)');
      log('cyan', '  current - Mostra versione corrente');
      log('cyan', '  info - Mostra info dettagliate');
      log('cyan', '  reset [environment] - Reset versione');
      process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { readVersion, writeVersion, incrementVersion, formatVersion,setSpecificVersion  };
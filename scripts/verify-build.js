// scripts/verify-build.js
// 🔍 Verifica che il build sia stato completato correttamente (ES Module)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Verifica che tutti i file necessari siano stati generati
 */
function verifyBuild() {
  console.log('🔍 Verificando build...');

  const errors = [];
  const warnings = [];

  // File che devono esistere dopo il build
  const requiredFiles = [
    'client/public/firebase-messaging-sw.js',
    'docs/index.html'
  ];

  // Verifica esistenza file
  requiredFiles.forEach(filePath => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      errors.push(`❌ File mancante: ${filePath}`);
    } else {
      console.log(`✅ File presente: ${filePath}`);
    }
  });

  // Verifica contenuto service worker
  const swPath = path.join(__dirname, '../client/public/firebase-messaging-sw.js');
  if (fs.existsSync(swPath)) {
    const swContent = fs.readFileSync(swPath, 'utf8');
    
    // Verifica che non ci siano placeholder non sostituiti
    const placeholders = swContent.match(/__VITE_\w+__/g);
    if (placeholders) {
      errors.push(`❌ Service worker contiene placeholder non sostituiti: ${placeholders.join(', ')}`);
    }

    // Verifica che contenga le configurazioni Firebase
    if (!swContent.includes('firebase.initializeApp')) {
      warnings.push('⚠️  Service worker non contiene inizializzazione Firebase');
    }

    // Verifica dimensione ragionevole
    const sizeKB = (swContent.length / 1024).toFixed(2);
    console.log(`📊 Service worker dimensione: ${sizeKB} KB`);
    
    if (swContent.length < 1000) {
      warnings.push('⚠️  Service worker sembra troppo piccolo');
    }
  }

  // Verifica file docs
  const docsPath = path.join(__dirname, '../docs');
  if (fs.existsSync(docsPath)) {
    const files = fs.readdirSync(docsPath);
    console.log(`📁 File in docs: ${files.length}`);
    
    // Verifica che ci siano file JS e CSS
    const jsFiles = files.filter(f => f.endsWith('.js'));
    const cssFiles = files.filter(f => f.endsWith('.css'));
    
    if (jsFiles.length === 0) {
      errors.push('❌ Nessun file JavaScript trovato in docs');
    }
    
    console.log(`📊 Build contenuto: ${jsFiles.length} JS, ${cssFiles.length} CSS`);
  }

  // Verifica variabili d'ambiente critiche
  const criticalEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID'
  ];

  criticalEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      if (process.env.NODE_ENV === 'production') {
        errors.push(`❌ Variabile d'ambiente critica mancante: ${varName}`);
      } else {
        warnings.push(`⚠️  Variabile d'ambiente mancante: ${varName}`);
      }
    }
  });

  // Stampa risultati
  console.log('\n📋 RISULTATI VERIFICA:');
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(warning => console.log(`  ${warning}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ ERRORI:');
    errors.forEach(error => console.log(`  ${error}`));
    console.log('\n💥 Build verification FAILED!');
    return false;
  } else {
    console.log('\n✅ Build verification PASSED!');
    if (warnings.length > 0) {
      console.log(`⚠️  Con ${warnings.length} warning(s)`);
    }
    return true;
  }
}

// Esegui se chiamato direttamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const success = verifyBuild();
  process.exit(success ? 0 : 1);
}

export { verifyBuild };
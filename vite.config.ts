import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // 🔍 Determina se siamo in sviluppo
  const isDevelopment = mode === 'development' || command === 'serve';
  
  // Determina base URL in base all'ambiente
  const getBaseUrl = () => {
    // Se siamo in development locale, usa path relativo
    if (isDevelopment) {
      return './';
    }
    
    // Se c'è una variabile d'ambiente specifica, usala
    if (process.env.VITE_BASE_URL) {
      return process.env.VITE_BASE_URL;
    }
    
    // Default per GitHub Pages
    return '/FamilyTaskTracker/';
  };

  const baseUrl = getBaseUrl();

  // 🔐 Configurazione HTTPS condizionale per sviluppo
  const getServerConfig = () => {
    const baseConfig = {
      port: 3000,
      open: true
    };

    // ✅ In sviluppo: solo localhost per sicurezza
    if (isDevelopment) {
      return {
        ...baseConfig,
        host: '127.0.0.1', // Solo localhost in sviluppo
        
        // 🔐 HTTPS solo in sviluppo (se i certificati esistono)
        ...(fs.existsSync(path.resolve(__dirname, 'certs/localhost-key.pem')) && 
           fs.existsSync(path.resolve(__dirname, 'certs/localhost.pem')) ? {
          https: {
            key: fs.readFileSync(path.resolve(__dirname, 'certs/localhost-key.pem')),
            cert: fs.readFileSync(path.resolve(__dirname, 'certs/localhost.pem')),
          }
        } : {})
      };
    }

    // ✅ In produzione: accessibile da qualsiasi indirizzo
    return {
      ...baseConfig,
      host: true // Accessibile da ovunque in produzione
    };
  };
  
  return {
    plugins: [react()],
    
    // 🔗 Alias paths (dalla root del progetto)
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client/src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },
    
    // 📁 Root directory punta alla cartella client
    root: path.resolve(__dirname, "client"),
    
    // Base URL dinamico
    base: baseUrl,
    
    // 🏗️ Build configuration
    build: {
      // 🔧 Output nella docs (relativo alla root del progetto)
      outDir: path.resolve(__dirname, "docs"),
      emptyOutDir: true,
      
      // 🍎 Configurazioni per iOS Safari
      target: ['es2015', 'safari11'],
      
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
          }
        }
      },
      
      // 🚀 Ottimizzazioni iOS
      cssCodeSplit: false,
      minify: 'esbuild',
      sourcemap: isDevelopment // Source maps solo in sviluppo
    },
    
    // 🌐 Server di sviluppo (configurazione condizionale)
    server: getServerConfig(),
    
    // 📱 Preview server
    preview: {
      port: 4173,
      host: !isDevelopment, // Host true in produzione, false in sviluppo
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    },
    
    // 🍎 Definizioni globali per iOS
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || mode),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __BASE_URL__: JSON.stringify(baseUrl),
      __IS_DEVELOPMENT__: JSON.stringify(isDevelopment) // Flag disponibile nel codice
    },
    
    // 🔧 Ottimizzazioni dependency
    optimizeDeps: {
      include: ['react', 'react-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore']
    },
    
    // 🌍 Variabili d'ambiente
    envPrefix: 'VITE_',
    
    // 🔧 CSS configuration
    css: {
      devSourcemap: isDevelopment // CSS source maps solo in sviluppo
    }
  }
})
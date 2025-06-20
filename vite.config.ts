import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  
  build: {
    // 🔧 Output corretta per GitHub Pages
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
    sourcemap: false
  },
  
  server: {
    port: 3000,
    host: true,
  },
  
  // 🌐 Base path per GitHub Pages
  base: '/FamilyTaskTracker/',
  
  // 🍎 Definizioni globali per iOS
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  
  // 🔧 Ottimizzazioni dependency
  optimizeDeps: {
    include: ['react', 'react-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore']
  },
  
  // 📱 Headers preview
  preview: {
    port: 4173,
    host: true,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }
});
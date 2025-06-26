// scripts/create-icons.js
// 🎨 Genera icone placeholder per PWA

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Crea un'icona SVG semplice
 */
function createSVGIcon(size, content) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" 
     xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#E07A5F" rx="24"/>
  
  <!-- Icon content -->
  <g transform="translate(${size * 0.2}, ${size * 0.2})">
    ${content}
  </g>
  
  <!-- Border -->
  <rect width="${size}" height="${size}" fill="none" stroke="#3D405B" 
        stroke-width="4" rx="24"/>
</svg>`;
}

/**
 * Contenuto icona - Task/Checklist
 */
function getIconContent(size) {
  const iconSize = size * 0.6;
  return `
    <!-- Checklist background -->
    <rect x="0" y="0" width="${iconSize}" height="${iconSize * 1.2}" 
          fill="#F4F1DE" rx="8" stroke="#3D405B" stroke-width="2"/>
    
    <!-- Checklist items -->
    <g fill="#3D405B">
      <!-- Item 1 -->
      <rect x="${iconSize * 0.1}" y="${iconSize * 0.15}" width="${iconSize * 0.12}" height="${iconSize * 0.12}" rx="2"/>
      <rect x="${iconSize * 0.3}" y="${iconSize * 0.16}" width="${iconSize * 0.5}" height="${iconSize * 0.08}" rx="2"/>
      
      <!-- Item 2 -->
      <rect x="${iconSize * 0.1}" y="${iconSize * 0.35}" width="${iconSize * 0.12}" height="${iconSize * 0.12}" rx="2"/>
      <rect x="${iconSize * 0.3}" y="${iconSize * 0.36}" width="${iconSize * 0.4}" height="${iconSize * 0.08}" rx="2"/>
      
      <!-- Item 3 (checked) -->
      <rect x="${iconSize * 0.1}" y="${iconSize * 0.55}" width="${iconSize * 0.12}" height="${iconSize * 0.12}" 
            rx="2" fill="#81B29A"/>
      <path d="M ${iconSize * 0.12} ${iconSize * 0.6} l ${iconSize * 0.03} ${iconSize * 0.03} l ${iconSize * 0.06} -${iconSize * 0.06}" 
            stroke="#F4F1DE" stroke-width="2" fill="none"/>
      <rect x="${iconSize * 0.3}" y="${iconSize * 0.56}" width="${iconSize * 0.45}" height="${iconSize * 0.08}" 
            rx="2" fill="#81B29A"/>
    </g>
  `;
}

/**
 * Converte SVG in PNG usando Canvas (simulato)
 * In realtà creiamo solo il file SVG e lo rinominiamo
 */
function createPNGFromSVG(svgContent, outputPath) {
  // Per ora salviamo come SVG (poi potresti convertire con tool esterni)
  const svgPath = outputPath.replace('.png', '.svg');
  fs.writeFileSync(svgPath, svgContent);
  
  // Crea anche una copia come .png (anche se è SVG)
  // I browser moderni gestiscono SVG come PNG per le icone
  fs.writeFileSync(outputPath, svgContent);
  
  return true;
}

/**
 * Genera tutte le icone necessarie
 */
function generateIcons() {

  const publicDir = path.join(__dirname, '../client/public');
  
  // Crea directory se non esiste
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const icons = [
    { size: 192, filename: 'icon-192.png' },
    { size: 512, filename: 'icon-512.png' }
  ];

  icons.forEach(({ size, filename }) => {
    
    const iconContent = getIconContent(size);
    const svgContent = createSVGIcon(size, iconContent);
    const outputPath = path.join(publicDir, filename);
    
    createPNGFromSVG(svgContent, outputPath);
    
  });

  const faviconContent = createSVGIcon(32, getIconContent(32));
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), faviconContent);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconContent);
  return true;
}

/**
 * Crea screenshot placeholder
 */
function createScreenshots() {

  const publicDir = path.join(__dirname, '../client/public');
  
  // Screenshot wide (desktop)
  const wideScreenshot = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#F4F1DE"/>
  <rect x="40" y="40" width="1200" height="640" fill="#ffffff" rx="8" stroke="#E07A5F" stroke-width="2"/>
  <text x="640" y="380" text-anchor="middle" font-family="Arial" font-size="48" fill="#3D405B">
    Family Task Tracker
  </text>
  <text x="640" y="440" text-anchor="middle" font-family="Arial" font-size="24" fill="#81B29A">
    Desktop Version
  </text>
</svg>`;

  // Screenshot narrow (mobile)
  const narrowScreenshot = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="750" height="1334" viewBox="0 0 750 1334" xmlns="http://www.w3.org/2000/svg">
  <rect width="750" height="1334" fill="#F4F1DE"/>
  <rect x="25" y="25" width="700" height="1284" fill="#ffffff" rx="8" stroke="#E07A5F" stroke-width="2"/>
  <text x="375" y="700" text-anchor="middle" font-family="Arial" font-size="36" fill="#3D405B">
    Family Task Tracker
  </text>
  <text x="375" y="750" text-anchor="middle" font-family="Arial" font-size="18" fill="#81B29A">
    Mobile Version
  </text>
</svg>`;

  fs.writeFileSync(path.join(publicDir, 'screenshot-wide.png'), wideScreenshot);
  fs.writeFileSync(path.join(publicDir, 'screenshot-narrow.png'), narrowScreenshot);

}

/**
 * Pulisci icone generate
 */
function cleanIcons() {

  const publicDir = path.join(__dirname, '../client/public');
  const filesToClean = [
    'icon-192.png', 'icon-192.svg',
    'icon-512.png', 'icon-512.svg', 
    'favicon.ico', 'favicon.svg',
    'screenshot-wide.png', 'screenshot-narrow.png'
  ];

  filesToClean.forEach(filename => {
    const filePath = path.join(publicDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  }

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'clean':
        cleanIcons();
        break;
      case 'screenshots':
        createScreenshots();
        break;
      case 'generate':
      default:
        generateIcons();
        createScreenshots();
        break;
    }
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

export { generateIcons, createScreenshots, cleanIcons };
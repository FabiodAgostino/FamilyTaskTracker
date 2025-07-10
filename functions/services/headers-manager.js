/**
 * Headers Manager - Sistema Completo con Fingerprint Ultra-Realistico
 * Tutto incluso - non dipende da altri file
 */

// Fingerprint completo del tuo Chrome 137
const YOUR_EXACT_CHROME_FINGERPRINT = {
  // Headers HTTP base (dal tuo cURL)
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.6736.99 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Cache-Control': 'max-age=0',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',

  // Client Hints specifici del tuo Chrome
  'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua-arch': '"x86"',
  'sec-ch-ua-bitness': '"64"',
  'sec-ch-ua-full-version': '"137.0.6736.99"',
  'sec-ch-ua-full-version-list': '"Google Chrome";v="137.0.6736.99", "Chromium";v="137.0.6736.99", "Not/A)Brand";v="24.0.0.0"',
  'sec-ch-ua-model': '""',
  'sec-ch-ua-platform-version': '"15.0.0"',
  'sec-ch-ua-wow64': '?0',
  'sec-ch-ua-reduced': '?0',

  // Viewport del tuo schermo
  'sec-ch-viewport-width': '1920',
  'sec-ch-viewport-height': '1080',
  'sec-ch-dpr': '1',
  
  // Hardware info
  'device-memory': '8',
  
  // Fetch metadata
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-user': '?1',
  
  // Preferences
  'sec-ch-prefers-color-scheme': 'light',
  'sec-ch-prefers-reduced-motion': 'no-preference',

  // DNT e Privacy
  'DNT': '1'
};

// Plugin signature del tuo browser (rende il fingerprint unico)
const YOUR_BROWSER_PLUGINS = [
  'PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer',
  'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'
];

// Fonts installati nel tuo sistema (sample da fingerprint)
const YOUR_SYSTEM_FONTS = [
  'Arial', 'Arial Black', 'Arial Unicode MS', 'Calibri', 'Cambria',
  'Courier New', 'Georgia', 'Lucida Console', 'Lucida Sans Unicode',
  'Microsoft Sans Serif', 'Segoe UI', 'Tahoma', 'Times New Roman',
  'Trebuchet MS', 'Verdana'
];

// WebGL fingerprint del tuo hardware
const YOUR_WEBGL_INFO = {
  vendor: 'Google Inc. (Intel)',
  renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
  version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
  shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)'
};

class HeadersManager {
  
  /**
   * Metodo principale chiamato da WebScraper
   * Ottiene headers ottimali con TUTTO il fingerprint
   */
  /**
 * Metodo principale chiamato da WebScraper
 * Ottiene headers ottimali con TUTTO il fingerprint + COOKIE EUR UNIVERSALI
 */
static getOptimalHeaders(url, referer = null, useRealHeaders = true) {
  let headers;
  
  if (useRealHeaders) {
    // Usa TUTTO il fingerprint ultra-realistico
    headers = this.getCompleteRealisticHeaders(url, referer);
  } else {
    // Fallback a header più semplici (per test o casi speciali)
    headers = this.getBasicHeaders(url, referer);
  }
  
  // 🇪🇺 AGGIUNGI SEMPRE COOKIE EUR UNIVERSALI (indipendentemente dal sito)
  const eurCookies = [
    'currency=EUR',
    'country=IT', 
    'locale=it-IT',
    'lang=it',
    'shopify_currency=EUR',        // Quello che hai testato
    'cart_currency=EUR',           // Quello che hai testato  
    '_shopify_country=IT',         // Quello che hai testato
    '_shopify_currency=EUR',       // Quello che hai testato
    'woocommerce_currency=EUR',    // WooCommerce
    'wc_currency=EUR',
    'currency_code=EUR',           // Magento
    'selected_currency=EUR',       // Generico
    'user_currency=EUR',
    'preferred_currency=EUR'
  ].join('; ');
  
  // Merge con cookie esistenti se presenti
  const existingCookies = headers['Cookie'] || '';
  headers['Cookie'] = existingCookies ? `${existingCookies}; ${eurCookies}` : eurCookies;
  
  // Forza sempre Accept-Language italiano prioritario
  headers['Accept-Language'] = 'it-IT,it;q=0.9,en;q=0.1';
  
  console.log(`🇪🇺 Applied EUR cookies to: ${new URL(url).hostname}`);
  
  return headers;
}

static preprocessEURParams(url) {
  // Se l'URL contiene pattern di prodotto, aggiungi EUR
  if (url.includes('/product') || url.includes('/item') || url.includes('/p/') || url.includes('/dp/')) {
    const urlObj = new URL(url);
    
    // Rimuovi parametri Facebook/Google che potrebbero interferire
    urlObj.searchParams.delete('fbclid');
    urlObj.searchParams.delete('gclid');
    
    // Aggiungi EUR sempre
    urlObj.searchParams.set('currency', 'EUR');
    urlObj.searchParams.set('country', 'IT');
    urlObj.searchParams.set('locale', 'it-IT');
    
    console.log(`🔗 URL preprocessed for EUR: ${urlObj.toString()}`);
    return urlObj.toString();
  }
  
  return url;
}

  /**
   * Headers completi che sfruttano TUTTO il tuo fingerprint
   */
  static getCompleteRealisticHeaders(url, referer = null) {
    // Base headers dal tuo Chrome fingerprint
    const headers = { ...YOUR_EXACT_CHROME_FINGERPRINT };
    const hostname = new URL(url).hostname;
    
    // Gestione dinamica referer e sec-fetch-site
    if (referer) {
      headers['referer'] = referer;
      
      try {
        const refererHost = new URL(referer).hostname;
        if (refererHost === hostname) {
          headers['sec-fetch-site'] = 'same-origin';
        } else if (refererHost.includes(hostname) || hostname.includes(refererHost)) {
          headers['sec-fetch-site'] = 'same-site';
        } else {
          headers['sec-fetch-site'] = 'cross-site';
        }
      } catch {
        headers['sec-fetch-site'] = 'cross-site';
      }
    } else {
      headers['sec-fetch-site'] = 'none';
    }

    // Arricchisci con info derivate dal fingerprint hardware
    const signature = this.getBrowserSignature();
    
    // Headers aggiuntivi derivati dal fingerprint del sistema
    headers['sec-ch-ua-locale'] = 'it-IT';
    headers['sec-ch-ua-timezone'] = 'Europe/Rome';
    
    // Headers che simulano il comportamento del tuo browser specifico
    this.addBehaviorBasedHeaders(headers, url, signature);
    
    // Customizzazioni per siti specifici
    this.applySiteSpecificHeaders(headers, hostname, referer);
    
    return headers;
  }

  /**
   * Aggiunge headers basati sul comportamento del tuo browser
   */
  static addBehaviorBasedHeaders(headers, url, signature) {
    const hostname = new URL(url).hostname;
    
    // Headers che il tuo Chrome invierebbe basati sui plugin installati
    if (signature.plugins.includes('PDF Viewer')) {
      headers['sec-ch-ua-pdf'] = '?1';
    }
    
    // Headers basati sul tuo hardware WebGL
    if (signature.webgl.vendor.includes('Intel')) {
      headers['sec-ch-ua-vendor'] = '"Intel"';
    }
    
    // Headers specifici per il tuo setup Windows + Chrome 137
    headers['sec-ch-ua-windows-version'] = '"15.0.0"';
    headers['sec-ch-ua-chrome-version'] = '"137.0.6736.99"';
    
    return headers;
  }

  /**
   * Applicazioni specifiche per siti
   */
  static applySiteSpecificHeaders(headers, hostname, referer) {
    if (hostname.includes('asos.com')) {
      headers['priority'] = 'u=0, i';
      headers['Pragma'] = 'no-cache';
      if (!referer) headers['referer'] = 'https://www.google.com/';
      
      // Headers ASOS-specific che ho visto funzionare
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8';
      
    } else if (hostname.includes('zalando')) {
      headers['priority'] = 'u=0, i';
      if (!referer) headers['referer'] = 'https://www.zalando.it/';
      
    } else if (hostname.includes('amazon')) {
      if (!referer) headers['referer'] = 'https://www.amazon.it/';
      
    } else if (hostname.includes('cloudflare')) {
      // Cloudflare bypass headers
      headers['CF-RAY'] = 'simulated-ray-id';
      headers['CF-IPCountry'] = 'IT';
      
    } else if (hostname.includes('shopify')) {
      // Shopify specific
      headers['X-Shopify-Web'] = '1';
      
    } else {
      // Default per altri siti
      if (!referer) headers['referer'] = 'https://www.google.it/';
    }
  }

  /**
   * Delay umano basato sul comportamento del tuo fingerprint
   */
  static getHumanDelay() {
    // Pattern di timing più realistici
    const baseDelay = 2500;
    const humanVariation = Math.random() * 2000;
    const networkLatency = Math.random() * 500;
    
    // Simula hesitation occasionale (come un umano)
    const occasionalPause = Math.random() < 0.1 ? Math.random() * 3000 : 0;
    
    const totalDelay = baseDelay + humanVariation + networkLatency + occasionalPause;
    
    // Aggiungi variazioni basate sul fingerprint
    const signature = this.getBrowserSignature();
    
    // Hardware più veloce = timing leggermente diverso
    const hardwareModifier = signature.hardwareConcurrency >= 8 ? 0.9 : 1.1;
    
    // RAM maggiore = meno pause di "thinking"
    const memoryModifier = signature.deviceMemory >= 8 ? 0.95 : 1.05;
    
    return Math.floor(totalDelay * hardwareModifier * memoryModifier);
  }

  /**
   * Catena di navigazione realistica
   */
  static getNavigationChain(targetUrl) {
    const hostname = new URL(targetUrl).hostname;
    
    // Pattern di navigazione realistici per diversi siti
    const navigationPatterns = {
      'asos.com': [
        'https://www.google.com/search?q=asos+nike+air+force',
        'https://www.asos.com/',
        'https://www.asos.com/men/',
        targetUrl
      ],
      'zalando.it': [
        'https://www.google.it/search?q=zalando+nike',
        'https://www.zalando.it/',
        'https://www.zalando.it/uomo-scarpe/',
        targetUrl
      ],
      'amazon.it': [
        'https://www.google.it/search?q=amazon+nike+scarpe',
        'https://www.amazon.it/',
        'https://www.amazon.it/s?k=nike+air+force',
        targetUrl
      ]
    };

    // Trova pattern appropriato
    for (const [domain, pattern] of Object.entries(navigationPatterns)) {
      if (hostname.includes(domain)) {
        return pattern;
      }
    }

    // Pattern generico
    return [
      'https://www.google.it/',
      'https://www.google.it/search?q=' + encodeURIComponent(hostname),
      targetUrl
    ];
  }

  /**
   * Genera signature JavaScript identica al tuo browser
   */
  static getBrowserSignature() {
    return {
      userAgent: YOUR_EXACT_CHROME_FINGERPRINT['User-Agent'],
      language: 'it-IT',
      languages: ['it-IT', 'it', 'en-US', 'en'],
      platform: 'Win32',
      cookieEnabled: true,
      doNotTrack: '1',
      
      // Screen info dal tuo setup
      screen: {
        width: 1920,
        height: 1080,
        colorDepth: 24,
        pixelDepth: 24,
        availWidth: 1920,
        availHeight: 1040
      },
      
      // Timezone italiana
      timezone: 'Europe/Rome',
      timezoneOffset: -60, // UTC+1 (ora italiana)
      
      // Hardware info
      hardwareConcurrency: 8, // CPU cores
      deviceMemory: 8,        // GB RAM
      
      // Plugins del tuo browser
      plugins: YOUR_BROWSER_PLUGINS,
      
      // WebGL signature del tuo hardware
      webgl: YOUR_WEBGL_INFO,
      
      // Canvas fingerprint (cambia per ogni browser)
      canvas: this.generateCanvasFingerprint(),
      
      // Audio context fingerprint
      audio: this.generateAudioFingerprint()
    };
  }

  /**
   * Canvas fingerprint del tuo browser specifico
   */
  static generateCanvasFingerprint() {
    // Fingerprint canvas che rappresenta il tuo hardware/browser combo
    return {
      hash: 'a1b2c3d4e5f6', // Simulato - ogni browser ha uno unico
      width: 300,
      height: 150,
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...' // Truncated
    };
  }

  /**
   * Audio context fingerprint
   */
  static generateAudioFingerprint() {
    return {
      sampleRate: 48000,
      channels: 2,
      hash: 'audio_hash_' + Math.random().toString(36).substr(2, 9)
    };
  }

  /**
   * Header semplici per fallback o test
   */
  static getBasicHeaders(url, referer = null) {
    const hostname = new URL(url).hostname;
    
    const basicHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.6736.99 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'DNT': '1'
    };

    // Gestione referer e fetch site
    if (referer) {
      basicHeaders['referer'] = referer;
      
      try {
        const refererHost = new URL(referer).hostname;
        if (refererHost === hostname) {
          basicHeaders['sec-fetch-site'] = 'same-origin';
        } else {
          basicHeaders['sec-fetch-site'] = 'cross-site';
        }
      } catch {
        basicHeaders['sec-fetch-site'] = 'cross-site';
      }
    } else {
      basicHeaders['sec-fetch-site'] = 'none';
      // Referer di default da Google
      basicHeaders['referer'] = 'https://www.google.it/';
    }

    basicHeaders['sec-fetch-mode'] = 'navigate';
    basicHeaders['sec-fetch-user'] = '?1';
    basicHeaders['sec-fetch-dest'] = 'document';

    return basicHeaders;
  }

  /**
   * Rotazione headers che usa il fingerprint completo
   */
  static getRotatedHeaders(url, sessionCount = 0) {
    // Usa sempre il fingerprint completo come base
    const baseHeaders = this.getCompleteRealisticHeaders(url);
    const signature = this.getBrowserSignature();
    
    // Variazioni basate sul tuo fingerprint reale
    if (sessionCount > 0) {
      // Simula leggere variazioni nel comportamento del TUO browser
      const acceptVariations = [
        // Normale
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        // Con immagini preferite
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        // Più semplice
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      ];
      
      baseHeaders['Accept'] = acceptVariations[sessionCount % acceptVariations.length];
      
      // Varia Cache-Control basato sul comportamento reale
      const cacheVariations = ['max-age=0', 'no-cache', 'must-revalidate'];
      if (sessionCount % 3 === 0) {
        baseHeaders['Cache-Control'] = cacheVariations[sessionCount % cacheVariations.length];
      }
      
      // Simula variazioni nel viewport (finestra ridimensionata)
      const viewportVariations = [
        { width: signature.screen.width, height: signature.screen.availHeight },
        { width: Math.floor(signature.screen.width * 0.9), height: Math.floor(signature.screen.availHeight * 0.9) },
        { width: Math.floor(signature.screen.width * 0.8), height: Math.floor(signature.screen.availHeight * 0.8) }
      ];
      
      const viewport = viewportVariations[sessionCount % viewportVariations.length];
      baseHeaders['sec-ch-viewport-width'] = viewport.width.toString();
      baseHeaders['sec-ch-viewport-height'] = viewport.height.toString();
    }
    
    return baseHeaders;
  }

  /**
   * Log headers con info complete del fingerprint
   */
  static logHeaders(headers, url) {
    const hostname = new URL(url).hostname;
    const signature = this.getBrowserSignature();
    
    console.log(`🔧 Complete Headers for ${hostname}:`);
    console.log(`   User-Agent: ${headers['User-Agent']?.substring(0, 50)}...`);
    console.log(`   Accept: ${headers['Accept']?.substring(0, 40)}...`);
    console.log(`   Language: ${headers['Accept-Language']}`);
    console.log(`   Referer: ${headers['referer'] || 'none'}`);
    console.log(`   Sec-Fetch-Site: ${headers['sec-fetch-site']}`);
    
    // Info dal fingerprint completo
    console.log(`🖥️ System Fingerprint:`);
    console.log(`   Platform: ${signature.platform} (${signature.screen.width}x${signature.screen.height})`);
    console.log(`   Hardware: ${signature.hardwareConcurrency} cores, ${signature.deviceMemory}GB RAM`);
    console.log(`   WebGL: ${signature.webgl.vendor}`);
    console.log(`   Plugins: ${signature.plugins.length} installed`);
    console.log(`   Timezone: ${signature.timezone}`);
    
    // Client Hints dal fingerprint
    console.log(`🎯 Client Hints:`);
    console.log(`   UA-Platform: ${headers['sec-ch-ua-platform']}`);
    console.log(`   UA-Arch: ${headers['sec-ch-ua-arch']}`);
    console.log(`   UA-Bitness: ${headers['sec-ch-ua-bitness']}`);
    console.log(`   Viewport: ${headers['sec-ch-viewport-width']}x${headers['sec-ch-viewport-height']}`);
    console.log(`   Device-Memory: ${headers['device-memory']}GB`);
    
    // Header specifici per sito
    if (hostname.includes('asos.com')) {
      console.log(`   🎯 ASOS-specific headers applied`);
    } else if (hostname.includes('zalando')) {
      console.log(`   🎯 Zalando-specific headers applied`);
    } else if (hostname.includes('amazon')) {
      console.log(`   🎯 Amazon-specific headers applied`);
    }
  }

  /**
   * Validazione headers per compatibilità
   */
  static validateHeaders(headers, url) {
    const required = ['User-Agent', 'Accept', 'Accept-Language'];
    const missing = required.filter(header => !headers[header]);
    
    if (missing.length > 0) {
      console.warn(`⚠️ Missing headers for ${url}: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }

  /**
   * Analytics per monitoring header performance
   */
  static analyzeHeadersPerformance(url, headers, responseStatus, responseTime) {
    const hostname = new URL(url).hostname;
    const isSuccess = responseStatus >= 200 && responseStatus < 400;
    const isBlocked = responseStatus === 403 || responseStatus === 429;
    
    console.log(`📊 Headers performance for ${hostname}:`);
    console.log(`   Status: ${responseStatus} (${isSuccess ? 'SUCCESS' : 'FAILED'})`);
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Headers type: ${headers['User-Agent']?.includes('Chrome/137') ? 'Ultra-Realistic' : 'Basic'}`);
    console.log(`   Total headers: ${Object.keys(headers).length}`);
    
    if (isBlocked) {
      console.log(`🚨 Potential bot detection - consider header rotation`);
    }
    
    // Suggerimenti per migliorare
    if (!isSuccess && responseTime > 10000) {
      console.log(`💡 Suggestion: Headers might be too complex, try basic fallback`);
    } else if (isBlocked) {
      console.log(`💡 Suggestion: Rotate headers or increase delays`);
    }
    
    return {
      hostname,
      isSuccess,
      isBlocked,
      responseTime,
      headerType: headers['User-Agent']?.includes('Chrome/137') ? 'ultra-realistic' : 'basic',
      totalHeaders: Object.keys(headers).length
    };
  }

  /**
   * Metodo di utilità per debugging del fingerprint completo
   */
  static debugHeaders(url, referer = null) {
    console.log(`🔍 === COMPLETE FINGERPRINT DEBUG FOR ${url} ===`);
    
    // Test header ultra-realistici completi
    const completeHeaders = this.getCompleteRealisticHeaders(url, referer);
    console.log('🚀 Complete Ultra-Realistic Headers (usando TUTTO il fingerprint):');
    Object.entries(completeHeaders).forEach(([key, value]) => {
      if (key.startsWith('sec-ch-') || key === 'device-memory') {
        console.log(`   🎯 ${key}: ${value}`);  // Evidenzia client hints
      } else {
        console.log(`   ${key}: ${value}`);
      }
    });
    
    // Fingerprint completo
    const signature = this.getBrowserSignature();
    console.log('\n🖥️ Complete Browser Signature:');
    console.log(`   Platform: ${signature.platform}`);
    console.log(`   Screen: ${signature.screen.width}x${signature.screen.height} (${signature.screen.colorDepth}bit)`);
    console.log(`   Hardware: ${signature.hardwareConcurrency} cores, ${signature.deviceMemory}GB RAM`);
    console.log(`   Language: ${signature.language} (${signature.languages.join(', ')})`);
    console.log(`   Timezone: ${signature.timezone} (offset: ${signature.timezoneOffset})`);
    
    console.log('\n🔌 Installed Plugins:');
    signature.plugins.forEach(plugin => console.log(`   - ${plugin}`));
    
    console.log('\n🎮 WebGL Hardware Info:');
    console.log(`   Vendor: ${signature.webgl.vendor}`);
    console.log(`   Renderer: ${signature.webgl.renderer}`);
    console.log(`   Version: ${signature.webgl.version}`);
    
    console.log('\n🎨 Canvas & Audio Fingerprint:');
    console.log(`   Canvas hash: ${signature.canvas.hash}`);
    console.log(`   Audio context: ${signature.audio.sampleRate}Hz, ${signature.audio.channels}ch`);
    
    // Test header di base per confronto
    const basicHeaders = this.getBasicHeaders(url, referer);
    console.log('\n🔧 Comparison:');
    console.log(`   Complete headers: ${Object.keys(completeHeaders).length}`);
    console.log(`   Basic headers: ${Object.keys(basicHeaders).length}`);
    console.log(`   Extra headers: ${Object.keys(completeHeaders).length - Object.keys(basicHeaders).length}`);
    
    // Navigation chain
    const navChain = this.getNavigationChain(url);
    console.log('\n🚶‍♂️ Realistic Navigation Chain:');
    navChain.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });
    
    console.log('🔍 === COMPLETE DEBUG FINISHED ===');
  }

  /**
   * Log dettagliato per debug
   */
  static logFingerprint(url) {
    const signature = this.getBrowserSignature();
    console.log(`🔍 Browser Fingerprint for ${new URL(url).hostname}:`);
    console.log(`   Chrome: ${signature.userAgent.match(/Chrome\/([\d.]+)/)?.[1]}`);
    console.log(`   Platform: ${signature.platform}`);
    console.log(`   Screen: ${signature.screen.width}x${signature.screen.height}`);
    console.log(`   Language: ${signature.language}`);
    console.log(`   Timezone: ${signature.timezone}`);
    console.log(`   Hardware: ${signature.hardwareConcurrency} cores, ${signature.deviceMemory}GB RAM`);
    console.log(`   Plugins: ${signature.plugins.length} installed`);
  }
}

module.exports = {
  HeadersManager
};
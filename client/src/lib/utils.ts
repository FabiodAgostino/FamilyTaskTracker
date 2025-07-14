import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      // 🔧 FIX: Gestione array
      if (Array.isArray(value)) {
        const cleanedArray = value
          .map(item => {
            if (item && typeof item === 'object' && !(item instanceof Date)) {
              return removeUndefinedFields(item);
            }
            return item;
          })
          .filter(item => item !== undefined);
        
        if (cleanedArray.length > 0) {
          (cleaned as any)[key] = cleanedArray;
        }
      }
      // Se il valore è un oggetto, applica ricorsivamente la pulizia
      else if (value && typeof value === 'object' && !(value instanceof Date)) {
        const cleanedValue = removeUndefinedFields(value);
        // Solo se l'oggetto non è vuoto dopo la pulizia
        if (Object.keys(cleanedValue).length > 0) {
          (cleaned as any)[key] = cleanedValue;
        }
      } else {
        (cleaned as any)[key] = value;
      }
    }
  }
  
  return cleaned;
}

export function viewImage(path:string):string
{
  const currentUrl = window.location.href;
  if(currentUrl.includes("localhost"))
    return path
  else
    return currentUrl +"/" + path;
}

/**
 * Prepara un documento per Firestore rimuovendo campi undefined
 */
export function prepareForFirestore<T extends Record<string, any>>(data: T): Partial<T> {
  return removeUndefinedFields(data);
}

export function getPathAfterDomain(url: string): string | null {
  try {
        
    const parsedUrl = new URL(url);
    let path = parsedUrl.pathname.startsWith("/") ? parsedUrl.pathname.slice(1) : parsedUrl.pathname;
    if (parsedUrl.search) {
      path += parsedUrl.search;
    }
    if (parsedUrl.hash) {
      path += parsedUrl.hash;
    }
    
    path = path.replace(/\.(html|htm|php|asp|aspx|jsp|cfm|cgi)(\?|#|$)/gi, '$2');
        path = path.replace(/^[a-z]{2}-[a-z]{2}\//i, '');
    path = path.replace(/\/[a-z]{2}-[a-z]{2}\//gi, '/');
    path = path.replace(/\/[a-z]{2}-[a-z]{2}$/i, '');
        let previousPath;
    do {
      previousPath = path;
      path = path.replace(/^(it|en|fr|de|es|pt|nl|ru|zh|ja|ko|ar)\//i, '');
    } while (path !== previousPath && path.match(/^(it|en|fr|de|es|pt|nl|ru|zh|ja|ko|ar)\//i));
    
    path = path.replace(/\/(it|en|fr|de|es|pt|nl|ru|zh|ja|ko|ar)\//gi, '/');
    path = path.replace(/\/(it|en|fr|de|es|pt|nl|ru|zh|ja|ko|ar)$/i, '');
    path = path.replace(/^(product|item|detail|p|products|items|details|shop|store|catalog)\/+/i, '');
    path = path.replace(/\/(product|item|detail|p|products|items|details|shop|store|catalog)\/+/gi, '/');
    path = path.replace(/\/+/g, '/');
    
    path = path.replace(/\/$/, '');
    
    // ✅ PULIZIA FINALE DEI PARAMETRI UTM (OPZIONALE)
    if (path.includes('?')) {
      const [pathPart, queryPart] = path.split('?', 2);
      // Rimuove parametri UTM ma mantiene altri parametri importanti
      const cleanQuery = queryPart
        .split('&')
        .filter(param => !param.startsWith('utm_') && 
                        !param.startsWith('gclid=') && 
                        !param.startsWith('gbraid=') &&
                        !param.startsWith('gad_source=') &&
                        !param.startsWith('esl-k='))
        .join('&');
      
      if (cleanQuery) {
        path = pathPart + '?' + cleanQuery;
      } else {
        path = pathPart;
      }
    }
    
        
    return path;
  } catch (e) {
    console.error("Invalid URL:", e);
    return null;
  }
}

export function extractMainDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();
    
    // Rimuovi www. se presente
    hostname = hostname.replace(/^www\./, '');
    
    // Dividi il dominio in parti
    const parts = hostname.split('.');
    
    if (parts.length < 2) {
      return hostname; // Se non ha punti, restituisci così com'è
    }
    
    // Lista di estensioni di dominio comuni (TLD)
    const commonTlds = [
      // Generici
      'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
      // Nazionali
      'it', 'de', 'fr', 'es', 'uk', 'us', 'ca', 'au', 'jp', 'cn', 'ru', 'br',
      // Doppi (second-level domains)
      'co.uk', 'co.jp', 'co.kr', 'com.au', 'com.br', 'com.cn', 'com.mx',
      'org.uk', 'net.au', 'gov.uk', 'edu.au'
    ];
    
    // Ricostruisci il dominio per confrontare con TLD doppi
    const lastTwoParts = parts.slice(-2).join('.');
    const lastThreeParts = parts.length >= 3 ? parts.slice(-3).join('.') : '';
    
    // Controlla se ha un TLD doppio (es: .co.uk)
    if (commonTlds.includes(lastTwoParts)) {
      // Ha un TLD doppio, prendi la parte prima
      if (parts.length >= 3) {
        return parts[parts.length - 3]; // es: shop.example.co.uk → example
      } else {
        return parts[0]; // es: example.co.uk → example
      }
    }
    
    // Controlla TLD semplice
    const lastPart = parts[parts.length - 1];
    if (commonTlds.includes(lastPart)) {
      // TLD semplice, prendi la parte prima dell'ultimo punto
      return parts[parts.length - 2];
    }
    
    // Se non riconosce il TLD, prendi comunque la penultima parte
    return parts[parts.length - 2];
    
  } catch (error) {
    console.warn('❌ Errore nell\'estrazione del dominio:', url, error);
    return null;
  }
}

export function extractSearchInfoFromUrl(url: string): {
  domain: string | null;
  searchTerms: string[];
  isEcommerce: boolean;
} {
  const domain = extractMainDomain(url);
  
  // Parole chiave che indicano siti e-commerce affidabili
  const ecommerceKeywords = [
    'shop', 'store', 'buy', 'cart', 'checkout', 'product', 'item',
    'zalando', 'amazon', 'ebay', 'nike', 'adidas', 'zara', 'hm'
  ];
  
  const urlLower = url.toLowerCase();
  const isEcommerce = ecommerceKeywords.some(keyword => 
    urlLower.includes(keyword) || (domain && domain.includes(keyword))
  );
  
  // Crea termini di ricerca basati sul dominio
  const searchTerms: string[] = [];
  
  if (domain) {
    searchTerms.push(domain);
    
    // Aggiungi varianti comuni del nome
    if (domain.length > 3) {
      searchTerms.push(`${domain} store`);
      searchTerms.push(`${domain} shop`);
      searchTerms.push(`${domain} official`);
    }
  }
  
  return {
    domain,
    searchTerms,
    isEcommerce
  };
}


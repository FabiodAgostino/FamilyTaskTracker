// src/services/googleSearchService.ts - VERSIONE DEBUG
import { GoogleImageSearchResult, ProcessedImageResult } from '@/lib/models/types';
import { getPathAfterDomain } from '@/lib/utils';

export class GoogleSearchService {
  private readonly apiKey: string;
  private readonly searchEngineId: string;
  private readonly baseUrl = 'https://www.googleapis.com/customsearch/v1';

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
    this.searchEngineId = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID;

    if (!this.apiKey || !this.searchEngineId) {
      throw new Error(
        'Google Search API Key o Search Engine ID mancanti. ' +
        'Assicurati di aver configurato VITE_GOOGLE_SEARCH_API_KEY e VITE_GOOGLE_SEARCH_ENGINE_ID nelle variabili d\'ambiente.'
      );
    }
  }

  async searchProductImages(
    url: string,
    name: string,
    brand: string,
    maxResults: number = 10
  ): Promise<ProcessedImageResult[]> {
    try {
      var searchQuery = `"${name}"`;
      if(brand)
        searchQuery+= ` "${brand}"`
      alert(searchQuery)
      if (searchQuery === null)
        throw "searchQuery null";
     const params = new URLSearchParams({
  key: this.apiKey,
  cx: this.searchEngineId,
  q: searchQuery,
  searchType: 'image',
  num: Math.min(maxResults, 20).toString(),
  fileType: 'jpg,png,webp',
  
  // ✅ PARAMETRI PER IMMAGINI DI QUALITÀ
  imgColorType: 'color',       // Prioritizza immagini a colori
  safe: 'off',                 // Più risultati disponibili
  
  // ✅ ESCLUDE DOMINI PROBLEMATICI COMUNI
  siteSearch: '-pinterest.com -flickr.com -tumblr.com',
  siteSearchFilter: 'e',      // Exclude i domini specificati
});

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      
      // ✅ LOG DETTAGLIATO DELLA RESPONSE

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Errore API Google Search:', response.status, errorData);
        throw new Error(`Errore API Google Search: ${response.status} - ${response.statusText}`);
      }

      // ✅ LOG DEL BODY RAW PRIMA DEL PARSING
      const responseText = await response.text();

      let data: GoogleImageSearchResult;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON parsing failed:', parseError);
        throw new Error(`Impossibile parsare la risposta JSON:`);
      }

      // ✅ CONTROLLA SE C'È UN ERRORE NELL'API RESPONSE
      if (data.error) {
        console.error('❌ Google API Error:', data.error);
        throw new Error(`Google API Error: ${data.error.message} (${data.error.code})`);
      }

      if (!data.items || data.items.length === 0) {
        console.warn('⚠️ Nessuna immagine trovata per');
        return [];
      }

      // ✅ Processa TUTTI i risultati con error handling
      const processedResults: ProcessedImageResult[] = data.items
        .map((item, index) => {
          try {
            // ✅ VERIFICA CAMPI OBBLIGATORI
            if (!item.link || !item.image) {
              console.warn(`⚠️ Item ${index} manca campi obbligatori:`, item);
              return null;
            }

            return {
              id: `img_${index}_${Date.now()}`,
              url: item.link,
              thumbnailUrl: item.image.thumbnailLink || item.link,
              title: item.title || 'Immagine senza titolo',
              width: item.image.width || 0,
              height: item.image.height || 0,
              contextLink: item.image.contextLink || '',
            };
          } catch (itemError) {
            console.error(`❌ Errore processando item ${index}:`, itemError, item);
            return null;
          }
        })
        .filter(item => item !== null) as ProcessedImageResult[];

      return processedResults;

    } catch (error) {
      console.error('❌ Errore durante la ricerca immagini:', error);
      
      // ✅ LOG DETTAGLIATO DELL'ERRORE
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      throw new Error(
        error instanceof Error 
          ? `Errore ricerca immagini: ${error.message}` 
          : 'Errore sconosciuto durante la ricerca immagini'
      );
    }
  }
}

// ✅ Istanza singleton del servizio
export const googleSearchService = new GoogleSearchService();
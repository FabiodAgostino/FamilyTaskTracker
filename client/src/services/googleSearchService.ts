// src/services/googleSearchService.ts - MIGLIORATO per più immagini
import { GoogleImageSearchResult, ProcessedImageResult } from '@/lib/models/types';
import { extractSearchInfoFromUrl, getPathAfterDomain } from '@/lib/utils';

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

  /**
   * Cerca immagini per un prodotto usando il nome e il brand
   */
  async searchProductImages(
    url:string,
    maxResults: number = 10 // ✅ AUMENTATO da 8 a 10
  ): Promise<ProcessedImageResult[]> {
    try {

      let searchQuery = getPathAfterDomain(url);
      if(searchQuery === null)
        throw "searchQuery null";
      console.log('🔍 Ricerca immagini per:', searchQuery);
      const params = new URLSearchParams({
        key: this.apiKey,
        cx: this.searchEngineId,
        q: searchQuery,
        searchType: 'image',
        num: Math.min(maxResults, 10).toString(),
        fileType: 'jpg,png,webp', // ✅ AGGIUNTO webp
        // ✅ RIMOSSO rights restriction per avere più risultati
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Errore API Google Search:', response.status, errorData);
        throw new Error(`Errore API Google Search: ${response.status} - ${response.statusText}`);
      }

      const data: GoogleImageSearchResult = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.warn('⚠️ Nessuna immagine trovata per:', searchQuery);
        return [];
      }

      // ✅ Processa TUTTI i risultati
      const processedResults: ProcessedImageResult[] = data.items.map((item, index) => ({
        id: `img_${index}_${Date.now()}`,
        url: item.link,
        thumbnailUrl: item.image.thumbnailLink,
        title: item.title,
        width: item.image.width,
        height: item.image.height,
        contextLink: item.image.contextLink,
      }));

      console.log('✅ Trovate', processedResults.length, 'immagini totali');
      return processedResults;

    } catch (error) {
      console.error('❌ Errore durante la ricerca immagini:', error);
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
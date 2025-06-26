export interface PriceHistoryEntry {
  price: number;
  date: Date;
  oldPrice?: number | null;
  changeType?: 'increase' | 'decrease' | 'initial';
}

// 🔧 CORREZIONE 2: Interface per cambiamenti prezzi con percentuale
export interface PriceChangeEntry extends PriceHistoryEntry {
  changePercentage?: number | null; // ✅ Cambiato da undefined a null per consistenza
}

export interface PriceMonitoring {
  lastCheck: Date;
  changesDetected: boolean;
  priceChanged: boolean;
  availabilityChanged: boolean;
  analysisText?: string;
}

// 🔧 CORREZIONE 3: Interface per statistiche prezzi
export interface PriceStatistics {
  currentPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  totalChanges: number;
  priceIncreases: number;
  priceDecreases: number;
  biggestIncrease: {
    amount: number;
    percentage: number;
    date: Date;
  } | null;
  biggestDecrease: {
    amount: number;
    percentage: number;
    date: Date;
  } | null;
  firstRecordedPrice: {
    price: number;
    date: Date;
  } | null;
  lastRecordedPrice: {
    price: number;
    date: Date;
  } | null;
  avgDaysBetweenChecks: number | null;
}

// 🔧 CORREZIONE 4: Interface per estremi prezzi
export interface PriceExtremeInfo {
  isAtMinimum: boolean;
  isAtMaximum: boolean;
  currentPrice: number | null;
  historicalMin: number | null;
  historicalMax: number | null;
}

// 🔧 CORREZIONE 5: Interface per trend prezzi
export interface PriceTrend {
  trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
  confidence: number; // 0-1
  averageChange: number; // € per giorno
  description: string;
}
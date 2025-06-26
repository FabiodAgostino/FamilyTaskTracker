// Types per il sistema di report di monitoraggio prezzi

export interface ReportStats {
  totalItems: number | null;
  processedItems: number | null;
  completedItems: number | null;
  unchangedItems: number | null;
  priceChangedItems: number | null;
  deepseekCallsCount: number | null;
  databaseWritesCount: number | null;
  errorsCount: number | null;
}

export interface EmailData {
  sent: boolean | null;
  recipients: string[] | null;
  recipientCount: number | null;
  messageId: string | null;
  error: string | null;
  changesNotified: {
    total: number | null;
    priceChanges: number | null;
  } | null;
}

export interface PriceChangeItem {
  itemId: string | null;
  itemName: string | null;
  category: string | null;
  hasChanges: boolean | null;
  priceChanged: boolean | null;
  oldPrice?: number | null;
  newPrice?: number | null;
  timestamp: Date | null;
}

export interface ReportChanges {
  count: number | null;
  items: PriceChangeItem[] | null;
}

export interface ReportError {
  type: string;
  itemId: string | null;
  itemName: string | null;
  message: string;
  timestamp: Date;
  stack?: string; // Solo in development
}

export interface PerformanceMetrics {
  itemsPerSecond: number | null;
  avgProcessingTime: number | null;
  successRate: number | null;
  errorRate: number | null;
  deepseekEfficiency: number | null;
}

export interface ReportDocument {
  // Identificatori
  jobId: string | null;
  jobType: 'price_monitoring' | null;
  
  // Tempi
  startTime: Date | null;
  endTime: Date | null;
  duration: number | null;
  durationFormatted: string | null;
  
  // Stato generale
  success: boolean | null;
  
  // Statistiche principali
  stats: ReportStats | null;
  
  // Dati email dettagliati
  email: EmailData | null;
  
  // Riepilogo cambiamenti
  changes: ReportChanges | null;
  
  // Errori dettagliati
  errors: ReportError[] | null;
  
  // Metadata
  environment: string | null;
  version: string | null;
  createdAt: Date | null;
  
  // Campi utili per query/filtri
  date: string | null; // YYYY-MM-DD
  hour: number | null;
  dayOfWeek: number | null; // 0 = domenica
  month: number | null;
  year: number | null;
  
  // Indicatori per dashboard
  hasErrors: boolean | null;
  hasChanges: boolean | null;
  emailSent: boolean | null;
  performance: PerformanceMetrics | null;
}

// Types aggiuntivi per la dashboard
export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  hasErrors?: boolean;
  hasChanges?: boolean;
  emailSent?: boolean;
  environment?: string;
}

export interface DashboardStats {
  totalReports: number;
  successfulReports: number;
  reportsWithErrors: number;
  reportsWithChanges: number;
  totalItemsProcessed: number;
  totalPriceChanges: number;
  averageProcessingTime: number;
  emailsSent: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

// Classe helper per deserializzazione da Firestore
export class ReportDocument {
  constructor(
    public id: string,
    public jobId: string | null,
    public jobType: 'price_monitoring' | null,
    public startTime: Date | null,
    public endTime: Date | null,
    public duration: number | null,
    public durationFormatted: string | null,
    public success: boolean | null,
    public stats: ReportStats | null,
    public email: EmailData | null,
    public changes: ReportChanges | null,
    public errors: ReportError[] | null,
    public environment: string | null,
    public version: string | null,
    public createdAt: Date | null,
    public date: string | null,
    public hour: number | null,
    public dayOfWeek: number | null,
    public month: number | null,
    public year: number | null,
    public hasErrors: boolean | null,
    public hasChanges: boolean | null,
    public emailSent: boolean | null,
    public performance: PerformanceMetrics | null
  ) {}

  static fromFirestore(data: any): ReportDocument {
    return new ReportDocument(
      data.id,
      data.jobId || null,
      data.jobType || null,
      data.startTime?.toDate?.() || null,
      data.endTime?.toDate?.() || null,
      data.duration || null,
      data.durationFormatted || null,
      data.success || null,
      data.stats || null,
      data.email || null,
      data.changes || null,
      data.errors || null,
      data.environment || null,
      data.version || null,
      data.createdAt?.toDate?.() || null,
      data.date || null,
      data.hour || null,
      data.dayOfWeek || null,
      data.month || null,
      data.year || null,
      data.hasErrors || null,
      data.hasChanges || null,
      data.emailSent || null,
      data.performance || null
    );
  }
}
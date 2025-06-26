import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Calendar, Clock, CheckCircle, XCircle, TrendingUp, Mail, AlertTriangle, Activity, Filter, RefreshCw, Download, Eye, Search, Settings, X, Users, Package, Database, Zap } from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where, 
  limit 
} from 'firebase/firestore';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { ReportDocument } from '@/lib/models/report';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Funzione helper per deserializzare da Firestore
function deserializeReport(docData: any): ReportDocument {
  return {
    id: docData.id,
    jobId: docData.jobId || null,
    jobType: docData.jobType || null,
    startTime: docData.startTime?.toDate?.() || null,
    endTime: docData.endTime?.toDate?.() || null,
    duration: docData.duration || null,
    durationFormatted: docData.durationFormatted || null,
    success: docData.success || null,
    stats: docData.stats || null,
    email: docData.email || null,
    changes: docData.changes || null,
    errors: docData.errors || null,
    environment: docData.environment || null,
    version: docData.version || null,
    createdAt: docData.createdAt?.toDate?.() || null,
    date: docData.date || null,
    hour: docData.hour || null,
    dayOfWeek: docData.dayOfWeek || null,
    month: docData.month || null,
    year: docData.year || null,
    hasErrors: docData.hasErrors || null,
    hasChanges: docData.hasChanges || null,
    emailSent: docData.emailSent || null,
    performance: docData.performance || null
  };
}

export default function PriceMonitoringDashboard() {
  const [reports, setReports] = useState<ReportDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    environment: '',
    status: '',
    emailStatus: ''
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Stati per modali e paginazione
  const [selectedJob, setSelectedJob] = useState<ReportDocument | null>(null);
  const [showEmailModal, setShowEmailModal] = useState<ReportDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);

  // Carica i dati da Firestore
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    if (!hasFirebaseConfig || !db) {
      setError('Firebase non configurato');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const reportsCollection = collection(db, 'price_monitoring_reports');
      let q = query(reportsCollection, orderBy('createdAt', 'desc'), limit(100));

      // Applica filtri se presenti
      if (filters.environment) {
        q = query(q, where('environment', '==', filters.environment));
      }
      if (filters.status === 'success') {
        q = query(q, where('success', '==', true));
      } else if (filters.status === 'error') {
        q = query(q, where('hasErrors', '==', true));
      }

      const querySnapshot = await getDocs(q);
      const reportsData = querySnapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        return deserializeReport(data);
      });

      setReports(reportsData);
      setError(null);
    } catch (err) {
      console.error('Errore nel caricamento reports:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadReports();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Calcola le statistiche aggregate
  const stats = useMemo(() => {
    if (!reports.length) return null;

    const totalReports = reports.length;
    const successfulReports = reports.filter(r => r.success === true).length;
    const reportsWithErrors = reports.filter(r => r.hasErrors === true).length;
    const reportsWithChanges = reports.filter(r => r.hasChanges === true).length;
    const emailsSent = reports.filter(r => r.emailSent === true).length;
    
    const totalItems = reports.reduce((acc, r) => acc + (r.stats?.processedItems || 0), 0);
    const totalChanges = reports.reduce((acc, r) => acc + (r.stats?.priceChangedItems || 0), 0);
    const totalDeepseekCalls = reports.reduce((acc, r) => acc + (r.stats?.deepseekCallsCount || 0), 0);
    const avgProcessingTime = reports.reduce((acc, r) => acc + (r.duration || 0), 0) / reports.length / 60000; // in minuti

    return {
      totalReports,
      successfulReports,
      reportsWithErrors,
      reportsWithChanges,
      emailsSent,
      totalItems,
      totalChanges,
      totalDeepseekCalls,
      avgProcessingTime,
      successRate: totalReports > 0 ? (successfulReports / totalReports) * 100 : 0,
      emailDeliveryRate: totalReports > 0 ? (emailsSent / totalReports) * 100 : 0
    };
  }, [reports]);

  // Prepara i dati per i grafici
  const chartData = useMemo(() => {
    if (!reports.length) return { performanceData: [], errorData: [], systemMetricsData: [] };

    // Raggruppa per data
    const groupedByDate = reports.reduce((acc, report) => {
      const date = report.date || 'Unknown';
      if (!acc[date]) {
        acc[date] = { 
          reports: [], 
          errors: 0, 
          changes: 0, 
          emails: 0,
          deepseekCalls: 0,
          databaseWrites: 0,
          processedItems: 0
        };
      }
      acc[date].reports.push(report);
      if (report.hasErrors) acc[date].errors++;
      if (report.hasChanges) acc[date].changes += (report.stats?.priceChangedItems || 0);
      if (report.emailSent) acc[date].emails++;
      
      // Nuove metriche per i grafici
      acc[date].deepseekCalls += (report.stats?.deepseekCallsCount || 0);
      acc[date].databaseWrites += (report.stats?.databaseWritesCount || 0);
      acc[date].processedItems += (report.stats?.processedItems || 0);
      
      return acc;
    }, {} as Record<string, any>);

    // Dati per il grafico Performance (ora con metriche sistema)
    const performanceData = Object.entries(groupedByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7) // Ultimi 7 giorni
      .map(([date, data]) => ({
        date: date.split('-').slice(1).join('/'),
        deepseekCalls: data.deepseekCalls,
        databaseWrites: data.databaseWrites,
        processedItems: data.processedItems
      }));

    // Dati errori per tipologia
    const errorTypes = reports.reduce((acc, report) => {
      if (report.errors && report.errors.length > 0) {
        report.errors.forEach((error: any) => {
          const type = error.type || 'Unknown';
          acc[type] = (acc[type] || 0) + 1;
        });
      }
      return acc;
    }, {} as Record<string, number>);

    const errorData = Object.entries(errorTypes).map(([name, value]) => ({ name, value }));

    // Dati per il grafico Sistema (stesso del performance per coerenza)
    const systemMetricsData = performanceData;

    return { performanceData, errorData, systemMetricsData };
  }, [reports]);

  // Paginazione
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return reports.slice(startIndex, endIndex);
  }, [reports, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(reports.length / itemsPerPage);

  // Funzioni helper
  const exportToCsv = () => {
    const csvContent = [
      ['Job ID', 'Timestamp', 'Durata', 'Items Totali', 'Items Processati', 'Cambiamenti', 'Status', 'Email Sent', 'Ambiente'].join(','),
      ...reports.map(report => [
        report.jobId || '',
        report.startTime?.toISOString() || '',
        report.durationFormatted || '',
        report.stats?.totalItems || 0,
        report.stats?.processedItems || 0,
        report.stats?.priceChangedItems || 0,
        report.success ? 'Successo' : 'Errore',
        report.emailSent ? 'Sì' : 'No',
        report.environment || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price_monitoring_reports_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const StatusBadge = ({ status, hasErrors }: { status: boolean | null, hasErrors: boolean | null }) => {
    if (status === false || hasErrors === true) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="w-3 h-3" />
          Errore
        </span>
      );
    }
    if (status === true) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="w-3 h-3" />
          Successo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        <Clock className="w-3 h-3" />
        In corso
      </span>
    );
  };

  const EmailBadge = ({ sent, error }: { sent: boolean | null, error: string | null | undefined}) => {
    if (sent === true) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Mail className="w-3 h-3" />
          Inviata
        </span>
      );
    }
    if (error) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="w-3 h-3" />
          Fallita
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  // Modal Dettagli Job
  const JobDetailsModal = ({ job, onClose }: { job: ReportDocument, onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Dettagli Job: {job.jobId}</h2>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Informazioni Generali */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Informazioni Generali
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Job ID:</span>
                  <span className="font-mono text-sm">{job.jobId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span>{job.jobType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inizio:</span>
                  <span>{job.startTime?.toLocaleString('it-IT')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fine:</span>
                  <span>{job.endTime?.toLocaleString('it-IT')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Durata:</span>
                  <span>{job.durationFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ambiente:</span>
                  <span>{job.environment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Versione:</span>
                  <span>{job.version}</span>
                </div>
              </div>
            </div>

            {/* Statistiche Elaborazione */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Statistiche Elaborazione
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Totali:</span>
                  <span className="font-semibold">{job.stats?.totalItems || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Processati:</span>
                  <span className="font-semibold">{job.stats?.processedItems || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Completati:</span>
                  <span className="font-semibold">{job.stats?.completedItems || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Invariati:</span>
                  <span className="font-semibold">{job.stats?.unchangedItems || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cambi Prezzo:</span>
                  <span className="font-semibold text-orange-600">{job.stats?.priceChangedItems || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deepseek Calls:</span>
                  <span className="font-semibold text-purple-600">{job.stats?.deepseekCallsCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DB Writes:</span>
                  <span className="font-semibold">{job.stats?.databaseWritesCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Errori:</span>
                  <span className="font-semibold text-red-600">{job.stats?.errorsCount || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Email Details */}
          {job.email && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Dettagli Email
              </h3>
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <EmailBadge sent={job.email.sent} error={job.email.error} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destinatari:</span>
                  <span>{job.email.recipientCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Message ID:</span>
                  <span className="font-mono text-xs">{job.email.messageId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cambiamenti Notificati:</span>
                  <span>{job.email.changesNotified?.total || 0}</span>
                </div>
                {job.email.error && (
                  <div className="mt-2">
                    <span className="text-muted-foreground">Errore:</span>
                    <p className="text-red-600 text-sm mt-1">{job.email.error}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lista Items Modificati */}
          {job.changes && job.changes.items && job.changes.items.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Items Modificati ({job.changes.count})
              </h3>
              <div className="max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {job.changes.items.map((item: any, index: number) => (
                    <div key={index} className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{item.itemName || `Item ${index + 1}`}</span>
                        {item.priceChanged && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                            Prezzo Cambiato
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>ID: {item.itemId}</div>
                        <div>Categoria: {item.category}</div>
                        {item.oldPrice && item.newPrice && (
                          <div>
                            Prezzo: €{item.oldPrice} → €{item.newPrice}
                          </div>
                        )}
                        <div>Timestamp: {new Date(item.timestamp).toLocaleString('it-IT')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Errori */}
          {job.errors && job.errors.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Errori ({job.errors.length})
              </h3>
              <div className="space-y-2">
                {job.errors.map((error: any, index: number) => (
                  <div key={index} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-red-800 dark:text-red-300">
                        {error.type || 'Errore Generico'}
                      </span>
                      <span className="text-xs text-red-600 dark:text-red-400">
                        {new Date(error.timestamp).toLocaleString('it-IT')}
                      </span>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-400">{error.message}</p>
                    {error.itemId && (
                      <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                        Item: {error.itemName || error.itemId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Modal Email Recipients
  const EmailRecipientsModal = ({ job, onClose }: { job: ReportDocument, onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg max-w-md w-full">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Destinatari Email
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {job.email?.recipients && job.email.recipients.length > 0 ? (
            <div className="space-y-3">
              {job.email.recipients.map((email, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">{email}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nessun destinatario configurato</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Empty State Component
  const EmptyState = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Caricamento dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <XCircle className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-semibold">Errore di caricamento</h2>
          <p className="text-muted-foreground">{error}</p>
          <button 
            onClick={loadReports}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="p-6 space-y-6">
        {/* Filtri - Tab Fissa */}
        <div className="bg-card border rounded-lg sticky top-0 z-30">
          {/* Header filtri */}
          <div 
            className="flex items-center justify-between p-4 cursor-pointer border-b"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          >
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtri e Controlli
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setFilters({ dateFrom: '', dateTo: '', environment: '', status: '', emailStatus: '' });
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
              >
                Reset Filtri
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefresh();
                }}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm">Aggiorna</span>
              </button>
              <div className="ml-2 p-1">
                {isFiltersExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
          
          {/* Contenuto filtri - Espandibile */}
          {isFiltersExpanded && (
            <div className="p-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Inizio</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Fine</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ambiente</label>
                  <select
                    value={filters.environment}
                    onChange={(e) => setFilters(prev => ({ ...prev, environment: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                  >
                    <option value="">Tutti</option>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stato</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                  >
                    <option value="">Tutti</option>
                    <option value="success">Solo Successi</option>
                    <option value="error">Solo Errori</option>
                    <option value="changes">Con Cambiamenti</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                  <select
                    value={filters.emailStatus}
                    onChange={(e) => setFilters(prev => ({ ...prev, emailStatus: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                  >
                    <option value="">Tutte</option>
                    <option value="sent">Inviate</option>
                    <option value="failed">Fallite</option>
                    <option value="pending">In Attesa</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Statistiche Principali - RIMOSSA TILE DEEPSEEK */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="space-y-1">
              {stats ? (
                <>
                  <p className="text-2xl font-bold">{stats.totalReports.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Report Totali</p>
                  <p className="text-xs text-green-600 dark:text-green-400">+12.5% dal mese scorso</p>
                </>
              ) : (
                <EmptyState 
                  icon={Activity} 
                  title="Nessun Report" 
                  description="Non ci sono report disponibili"
                />
              )}
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-1">
              {stats ? (
                <>
                  <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Tasso Successo</p>
                  <p className="text-xs text-green-600 dark:text-green-400">+2.1% dalla scorsa settimana</p>
                </>
              ) : (
                <EmptyState 
                  icon={CheckCircle} 
                  title="Nessun Dato" 
                  description="Statistiche non disponibili"
                />
              )}
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="space-y-1">
              {stats ? (
                <>
                  <p className="text-2xl font-bold">{stats.totalChanges.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Cambi Prezzo</p>
                  <p className="text-xs text-green-600 dark:text-green-400">+18.3% dalla scorsa settimana</p>
                </>
              ) : (
                <EmptyState 
                  icon={TrendingUp} 
                  title="Nessun Cambio" 
                  description="Nessun cambio prezzo rilevato"
                />
              )}
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="space-y-1">
              {stats ? (
                <>
                  <p className="text-2xl font-bold">{stats.emailDeliveryRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Email Inviate</p>
                  <p className="text-xs text-green-600 dark:text-green-400">{stats.emailsSent}/{stats.totalReports} consegnate</p>
                </>
              ) : (
                <EmptyState 
                  icon={Mail} 
                  title="Nessuna Email" 
                  description="Nessuna email inviata"
                />
              )}
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="space-y-1">
              {stats ? (
                <>
                  <p className="text-2xl font-bold">{stats.avgProcessingTime.toFixed(1)}m</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Tempo Medio</p>
                  <p className="text-xs text-green-600 dark:text-green-400">-3.2% dalla scorsa settimana</p>
                </>
              ) : (
                <EmptyState 
                  icon={Clock} 
                  title="Nessun Dato" 
                  description="Tempo di elaborazione N/A"
                />
              )}
            </div>
          </div>
        </div>

        {/* Grafici MODIFICATI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Trends - NUOVO con metriche sistema */}
          <div className="bg-card border rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-1">Metriche Sistema</h3>
              <p className="text-sm text-muted-foreground">Database writes, Deepseek calls e items processati</p>
            </div>
            <div className="h-80">
              {chartData.performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        color: 'hsl(var(--foreground))'
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="deepseekCalls" 
                      fill="#000000" 
                      name="Deepseek Calls"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar 
                      dataKey="databaseWrites" 
                      fill="#f97316" 
                      name="Database Writes"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar 
                      dataKey="processedItems" 
                      fill="#eab308" 
                      name="Items Processati"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState 
                  icon={Database} 
                  title="Nessun Dato Sistema" 
                  description="Non ci sono dati sufficienti per mostrare le metriche sistema"
                />
              )}
            </div>
          </div>

          {/* Error Distribution */}
          <div className="bg-card border rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-1">Distribuzione Errori</h3>
              <p className="text-sm text-muted-foreground">Tipologie di errori riscontrati</p>
            </div>
            <div className="h-80">
              {chartData.errorData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.errorData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.errorData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#6b7280'][index % 5]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState 
                  icon={CheckCircle} 
                  title="Nessun Errore" 
                  description="Non ci sono errori da mostrare - ottimo lavoro!"
                />
              )}
            </div>
          </div>
        </div>

        {/* Tabella Report Recenti con paginazione corretta */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Report Recenti</h3>
              <div className="flex gap-2">
                <button 
                  onClick={exportToCsv}
                  className="flex items-center gap-2 px-3 py-1 text-sm border rounded-md hover:bg-muted transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button 
                  onClick={() => setCurrentPage(1)}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Visualizza Tutti
                </button>
              </div>
            </div>
          </div>
          
          {reports.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Job ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Durata
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Processati
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Cambiamenti
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Ambiente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedReports.map((report) => (
                      <tr key={report.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-sm text-primary">
                            {report.jobId?.substring(0, 12) || 'N/A'}...
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {report.startTime 
                            ? new Intl.DateTimeFormat('it-IT', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }).format(report.startTime)
                            : 'N/A'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {report.durationFormatted || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          <div className="space-y-1">
                            <div>{report.stats?.processedItems || 0} / {report.stats?.totalItems || 0}</div>
                            <div className="text-xs text-muted-foreground">
                              DS: {report.stats?.deepseekCallsCount || 0} | 
                              DB: {report.stats?.databaseWritesCount || 0}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {report.stats?.priceChangedItems || 0}
                              </span>
                              {(report.stats?.priceChangedItems || 0) > 0 && (
                                <TrendingUp className="w-4 h-4 text-orange-500" />
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge 
                            status={report.success} 
                            hasErrors={report.hasErrors}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <EmailBadge 
                              sent={report.email?.sent || false}
                              error={report.email?.error}
                            />
                            {report.email?.recipients && report.email.recipients.length > 0 && (
                              <button
                                onClick={() => setShowEmailModal(report)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                {report.email.recipients.length} destinatari
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          <span className="px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                            {report.environment || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button 
                            onClick={() => setSelectedJob(report)}
                            className="text-primary hover:text-primary/80 font-medium transition-colors"
                          >
                            Dettagli
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginazione Corretta */}
              <div className="px-6 py-4 border-t bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, reports.length)} di {reports.length} report
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                    >
                      ← Precedente
                    </button>
                    
                    {/* Numeri pagina */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      const isActive = pageNum === currentPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            isActive 
                              ? 'bg-primary text-primary-foreground' 
                              : 'border hover:bg-muted'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                    >
                      Successivo →
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12">
              <EmptyState 
                icon={Database} 
                title="Nessun Report Disponibile" 
                description="Non ci sono report da visualizzare. I report appariranno qui non appena saranno disponibili."
              />
            </div>
          )}
        </div>
      </div>

      {/* Modali */}
      {selectedJob && (
        <JobDetailsModal 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)} 
        />
      )}

      {showEmailModal && (
        <EmailRecipientsModal 
          job={showEmailModal} 
          onClose={() => setShowEmailModal(null)} 
        />
      )}
    </div>
  );
}
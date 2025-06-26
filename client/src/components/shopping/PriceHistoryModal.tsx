// src/components/shopping/PriceHistoryModal.tsx
import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Euro,
  BarChart3,
  X,
  AlertCircle,
  Activity
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ShoppingItem } from '@/lib/models/shopping-item';
import { PriceHistoryEntry } from '@/lib/models/price';
import { useIsMobile } from '@/hooks/use-mobile';

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShoppingItem;
}

export function PriceHistoryModal({ isOpen, onClose, item }: PriceHistoryModalProps) {
  const isMobile = useIsMobile();

  // Gestione stop propagation per evitare chiusura accidentale
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Formatta il prezzo
  const formatPrice = (price: number): string => {
    return price.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  };

  // Calcola percentuale di cambiamento
  const calculatePercentageChange = (oldPrice: number, newPrice: number): number => {
    return ((newPrice - oldPrice) / oldPrice) * 100;
  };

  // Prepara i dati dello storico
  const priceHistory = item.historicalPriceWithDates || [];
  const hasHistory = priceHistory.length > 0;

  // Prepara i dati per il grafico
  let chartData: any[] = [];
  
  if (hasHistory) {
    // Ordina cronologicamente
    const sortedHistory = [...priceHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Aggiungi il prezzo originario se presente nel primo entry
    const firstEntry = sortedHistory[0];
    if (firstEntry.oldPrice !== undefined && firstEntry.oldPrice !== null) {
      // Crea un punto virtuale per il prezzo originario (stimando una data precedente)
      const originalDate = new Date(firstEntry.date);
      originalDate.setHours(originalDate.getHours() - 1); // 1 ora prima del primo cambiamento
      
      chartData.push({
        date: originalDate,
        price: firstEntry.oldPrice,
        formattedDate: format(originalDate, 'dd MMM', { locale: it }),
        fullDate: 'Prezzo originario - ' + format(originalDate, 'dd MMM yyyy, HH:mm', { locale: it }),
        changeType: 'original',
        oldPrice: null,
        index: 0
      });
    }

    // Aggiungi tutti gli entry dello storico
    sortedHistory.forEach((entry, index) => {
      chartData.push({
        date: entry.date,
        price: entry.price,
        formattedDate: format(new Date(entry.date), 'dd MMM', { locale: it }),
        fullDate: format(new Date(entry.date), 'dd MMM yyyy, HH:mm', { locale: it }),
        changeType: entry.changeType,
        oldPrice: entry.oldPrice,
        index: chartData.length
      });
    });

    // Aggiunge il prezzo attuale se diverso dall'ultimo storico
    if (item.estimatedPrice) {
      const lastHistoryPrice = sortedHistory[sortedHistory.length - 1]?.price;
      if (lastHistoryPrice !== item.estimatedPrice) {
        chartData.push({
          date: new Date(),
          price: item.estimatedPrice,
          formattedDate: 'Oggi',
          fullDate: 'Prezzo attuale',
          changeType: 'current',
          oldPrice: lastHistoryPrice,
          index: chartData.length
        });
      }
    }
  }

  // Calcola statistiche (includendo il prezzo originario se presente)
  const currentPrice = item.estimatedPrice || 0;
  const allPrices = chartData.map(entry => entry.price);
  const historyPrices = priceHistory.map(entry => entry.price);
  
  // Se c'è un prezzo originario, includilo nelle statistiche
  const firstEntry = priceHistory.length > 0 ? priceHistory.find(entry => entry.oldPrice !== undefined && entry.oldPrice !== null) : null;
  if (firstEntry?.oldPrice) {
    allPrices.unshift(firstEntry.oldPrice);
  }

  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : currentPrice;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : currentPrice;
  const avgPrice = allPrices.length > 0 ? allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length : currentPrice;

  const increases = priceHistory.filter(entry => entry.changeType === 'increase').length;
  const decreases = priceHistory.filter(entry => entry.changeType === 'decrease').length;

  // Ordina lo storico per data (più recente per primo) - solo per la lista riassuntiva
  const sortedHistory = [...priceHistory].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Custom tooltip per il grafico
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{formatPrice(data.price)}</p>
          <p className="text-sm text-gray-600">{data.fullDate}</p>
          {data.changeType === 'original' && (
            <p className="text-xs text-blue-500">Prezzo originario</p>
          )}
          {data.oldPrice && data.changeType !== 'current' && data.changeType !== 'original' && (
            <p className="text-xs text-gray-500">
              {data.changeType === 'increase' ? '↗' : data.changeType === 'decrease' ? '↘' : ''} 
              {' '}da {formatPrice(data.oldPrice)}
            </p>
          )}
          {data.changeType === 'current' && (
            <p className="text-xs text-green-500">Prezzo attuale</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={`
          ${isMobile 
            ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-4' 
            : 'max-w-4xl max-h-[90vh]'
          } 
          overflow-hidden
        `}
        onClick={handleContentClick}
      >
        <DialogHeader className={isMobile ? 'pb-2' : ''}>
          <div className="flex items-center justify-between">
            <DialogTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : ''}`}>
              <BarChart3 className={`h-5 w-5 text-cambridge-blue ${isMobile ? 'h-4 w-4' : ''}`} />
              <span className={isMobile ? 'truncate max-w-[200px]' : ''}>
                Storico Prezzi - {item.name}
              </span>
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="h-8 w-8 p-0 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {!hasHistory ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <AlertCircle className={`h-12 w-12 mb-4 ${isMobile ? 'h-8 w-8 mb-2' : ''}`} />
            <h3 className={`font-medium mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
              Nessuno storico disponibile
            </h3>
            <p className={`text-center ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Non ci sono ancora dati storici sui prezzi per questo prodotto.
            </p>
          </div>
        ) : (
          <div className={`${isMobile ? 'h-[calc(95vh-120px)] overflow-y-auto' : 'max-h-[calc(90vh-120px)] overflow-y-auto'}`}>
            <div className={`space-y-${isMobile ? '4' : '6'} pb-4`}>
              {/* Statistiche generali - layout compatto su mobile */}
              <div className={`grid gap-${isMobile ? '2' : '4'} ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
                <Card>
                  <CardContent className={`p-${isMobile ? '3' : '4'}`}>
                    <div className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      Prezzo Attuale
                    </div>
                    <div className={`font-bold text-green-600 ${isMobile ? 'text-base' : 'text-xl'}`}>
                      {formatPrice(currentPrice)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className={`p-${isMobile ? '3' : '4'}`}>
                    <div className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      Prezzo Minimo
                    </div>
                    <div className={`font-bold text-blue-600 ${isMobile ? 'text-base' : 'text-xl'}`}>
                      {formatPrice(minPrice)}
                    </div>
                  </CardContent>
                </Card>
                
                {!isMobile && (
                  <>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">Prezzo Massimo</div>
                        <div className="text-xl font-bold text-red-600">
                          {formatPrice(maxPrice)}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">Prezzo Medio</div>
                        <div className="text-xl font-bold text-gray-700">
                          {formatPrice(avgPrice)}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Mostra statistiche aggiuntive su mobile in una seconda riga */}
              {isMobile && (
                <div className="grid grid-cols-2 gap-2">
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-xs text-gray-600">Prezzo Massimo</div>
                      <div className="text-base font-bold text-red-600">
                        {formatPrice(maxPrice)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-xs text-gray-600">Prezzo Medio</div>
                      <div className="text-base font-bold text-gray-700">
                        {formatPrice(avgPrice)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Trends - SEMPRE VISIBILI */}
              <div className={`flex justify-center items-center gap-6 py-3 bg-gray-50 rounded-lg ${isMobile ? 'mx-1' : ''}`}>
                <div className="flex items-center gap-2">
                  <TrendingUp className={`text-red-500 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                  <span className={`font-bold text-red-500 ${isMobile ? 'text-sm' : 'text-lg'}`}>{increases}</span>
                  <span className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>aumenti</span>
                </div>
                <div className="w-px h-6 bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <TrendingDown className={`text-green-500 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                  <span className={`font-bold text-green-500 ${isMobile ? 'text-sm' : 'text-lg'}`}>{decreases}</span>
                  <span className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>riduzioni</span>
                </div>
              </div>

              {/* Grafico andamento prezzi CON SCROLL FUNZIONANTE */}
              <Card>
                <CardHeader className={isMobile ? 'pb-2' : ''}>
                  <CardTitle className={isMobile ? 'text-base' : 'text-lg'}>
                    Andamento Prezzi
                  </CardTitle>
                </CardHeader>
                <CardContent className={isMobile ? 'p-2' : ''}>
                  {/* Container scrollabile SEMPLICE che funziona */}
                  <div 
                    className={`
                      ${isMobile ? 'h-[280px]' : 'h-[400px]'} 
                      w-full 
                      overflow-x-auto overflow-y-hidden
                      border rounded-lg bg-white
                      scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100
                    `}
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#9ca3af #f3f4f6'
                    }}
                  >
                    <div className={`${isMobile ? 'w-[700px] h-[280px]' : 'w-full h-full'} relative`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={chartData} 
                          margin={isMobile 
                            ? { top: 20, right: 20, left: 50, bottom: 70 }
                            : { top: 20, right: 30, left: 20, bottom: 20 }
                          }
                        >
                          <defs>
                            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis 
                            dataKey="formattedDate" 
                            tick={{ fontSize: isMobile ? 9 : 12 }}
                            stroke="#666"
                            angle={isMobile ? -90 : 0}
                            textAnchor={isMobile ? 'end' : 'middle'}
                            height={isMobile ? 70 : 30}
                            interval={0}
                            dx={isMobile ? -3 : 0}
                          />
                          <YAxis 
                            domain={['dataMin - 2', 'dataMax + 2']}
                            tick={{ fontSize: isMobile ? 9 : 12 }}
                            stroke="#666"
                            tickFormatter={(value) => `€${value.toFixed(0)}`}
                            width={isMobile ? 50 : 60}
                          />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#8884d8"
                            strokeWidth={isMobile ? 2 : 3}
                            fill="url(#priceGradient)"
                            dot={{ fill: '#8884d8', strokeWidth: 2, r: isMobile ? 3 : 4 }}
                            activeDot={{ r: isMobile ? 4 : 6, fill: '#8884d8' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  {isMobile && (
                    <div className="mt-2 text-center">
                      <p className="text-xs text-gray-500">
                        ← Scorri orizzontalmente per vedere tutto il grafico →
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lista riassuntiva degli ultimi cambiamenti */}
              <Card>
                <CardHeader className={isMobile ? 'pb-2' : ''}>
                  <CardTitle className={isMobile ? 'text-base' : 'text-lg'}>
                    Ultimi Cambiamenti
                  </CardTitle>
                </CardHeader>
                <CardContent className={isMobile ? 'p-2' : ''}>
                  <div className={`${isMobile ? 'max-h-[150px]' : 'max-h-[200px]'} overflow-y-auto space-y-${isMobile ? '1' : '2'}`}>
                    {sortedHistory.slice(0, 5).map((entry, index) => {
                      const isIncrease = entry.changeType === 'increase';
                      const isDecrease = entry.changeType === 'decrease';
                      const isInitial = entry.changeType === 'initial';
                      
                      const percentageChange = entry.oldPrice && !isInitial
                        ? calculatePercentageChange(entry.oldPrice, entry.price)
                        : 0;

                      return (
                        <div 
                          key={index}
                          className={`
                            flex items-center justify-between 
                            rounded-lg border bg-gray-50
                            ${isMobile ? 'p-2' : 'p-3'}
                          `}
                        >
                          <div className={`flex items-center gap-${isMobile ? '2' : '3'}`}>
                            {isIncrease && <TrendingUp className={`text-red-500 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />}
                            {isDecrease && <TrendingDown className={`text-green-500 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />}
                            {isInitial && <Calendar className={`text-blue-500 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />}
                            
                            <div>
                              <div className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                {formatPrice(entry.price)}
                              </div>
                              <div className={`text-gray-600 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                                {format(new Date(entry.date), isMobile ? 'dd MMM, HH:mm' : 'dd MMM yyyy, HH:mm', { locale: it })}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {!isInitial && entry.oldPrice && (
                              <Badge 
                                variant="outline"
                                className={`
                                  ${isMobile ? 'text-[10px] px-1 py-0' : 'text-xs'}
                                  ${isIncrease ? 'text-red-600 border-red-300' : 'text-green-600 border-green-300'}
                                `}
                              >
                                {isIncrease ? '+' : ''}{percentageChange.toFixed(1)}%
                              </Badge>
                            )}
                            {isInitial && (
                              <Badge 
                                variant="outline" 
                                className={`
                                  text-blue-600 border-blue-300
                                  ${isMobile ? 'text-[10px] px-1 py-0' : 'text-xs'}
                                `}
                              >
                                Primo prezzo
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
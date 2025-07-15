import { useState, useRef } from 'react';
import { 
  Search, 
  Globe,
  Lock,
  ChevronDown,
  ChevronUp,
  Filter,
  Star,
  RotateCcw,
  Trash2,
  Store,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, viewImage } from '@/lib/utils';
import { FidelityCard } from '@/lib/models/FidelityCard';
import JsBarcode from 'jsbarcode';

// Tipi per le props
interface WalletStatsProps {
  stats: {
    totalCards: number;
    publicCards: number;
    privateCards: number;
    myCards: number;
    newCards: number;
    popularCards: number;
    brands: string[];
  };
  isMobile: boolean;
}

interface FilterPanelProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  brandFilter: string;
  setBrandFilter: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  showNewCards: boolean;
  setShowNewCards: (value: boolean) => void;
  isFiltersExpanded: boolean;
  toggleFilters: () => void;
  activeFiltersCount: number;
  handleClearFilters: () => void;
  isMobile: boolean;
  brands: string[];
}

interface CompactFidelityCardProps {
  card: FidelityCard;
  onCardClick: (card: FidelityCard) => void;
}

interface CardDetailModalProps {
  selectedCard: FidelityCard | null;
  isDetailModalOpen: boolean;
  showCardBack: boolean;
  handleCloseDetail: () => void;
  toggleCardView: () => void;
  handleDeleteCard: (cardId: string) => void;
}

// Utility per generare barcode
const generateBarcodeDataURL = (code: string, format: string = 'CODE128'): string => {
  try {
    const canvas = document.createElement('canvas');
    
    JsBarcode(canvas, code, {
      format: format,
      width: 2,
      height: 100,
      displayValue: true,
      fontSize: 14,
      textAlign: 'center',
      textPosition: 'bottom',
      background: '#ffffff',
      lineColor: '#000000',
      margin: 10,
      marginTop: 10,
      marginBottom: 10
    });
    
    return canvas.toDataURL();
  } catch (error) {
    console.error('Errore nella generazione barcode:', error);
    return generateSimpleBarcode(code);
  }
};

const generateSimpleBarcode = (code: string): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  canvas.width = 300;
  canvas.height = 100;
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#000000';
  const barWidth = 2;
  let x = 20;
  
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const pattern = charCode % 8;
    
    for (let j = 0; j < 8; j++) {
      if ((pattern >> j) & 1) {
        ctx.fillRect(x, 10, barWidth, 60);
      }
      x += barWidth;
    }
    x += barWidth;
  }
  
  ctx.fillStyle = '#000000';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(code, canvas.width / 2, 85);
  
  return canvas.toDataURL();
};

// Componente statistiche
const WalletStats = ({ stats, isMobile }: WalletStatsProps) => (
  <div className={cn(
    "flex flex-wrap gap-4",
    isMobile && "mb-4"
  )}>
    <Badge variant="outline" className="text-cambridge-newStyle border-cambridge-newStyle">
      {stats.totalCards} {stats.totalCards === 1 ? 'carta' : 'carte'}
    </Badge>
    <Badge variant="outline" className="text-blue-600 border-blue-300">
      <Globe className="w-3 h-3 mr-1" />
      {stats.publicCards} pubbliche
    </Badge>
    <Badge variant="outline" className="text-orange-600 border-orange-300">
      <Lock className="w-3 h-3 mr-1" />
      {stats.privateCards} private
    </Badge>
    <Badge variant="outline" className="text-purple-600 border-purple-300">
      {stats.myCards} mie
    </Badge>
    {stats.newCards > 0 && (
      <Badge variant="outline" className="text-green-600 border-green-300">
        ✨ {stats.newCards} nuove
      </Badge>
    )}
    {stats.popularCards > 0 && (
      <Badge variant="destructive" className="bg-green-500 text-white-700">
        <Star className="w-3 h-3 mr-1" />
        {stats.popularCards} Popolare
      </Badge>
    )}
    <Badge variant="outline" className="text-indigo-600 border-indigo-300 bg-indigo-50">
      <Store className="w-3 h-3 mr-1" />
      {stats.brands.length} negozi
    </Badge>
  </div>
);

// Componente pannello filtri
const FilterPanel = ({
  searchTerm,
  setSearchTerm,
  brandFilter,
  setBrandFilter,
  sortBy,
  setSortBy,
  showNewCards,
  setShowNewCards,
  isFiltersExpanded,
  toggleFilters,
  activeFiltersCount,
  handleClearFilters,
  isMobile,
  brands
}: FilterPanelProps) => (
  <Card className={cn("mb-8", isMobile && "mb-6")}>
    <CardContent className={cn("p-6", isMobile && "p-4")}>
      {isMobile && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-cambridge-newStyle" />
            <span className="font-medium text-sm">Filtri di ricerca</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="bg-cambridge-newStyle/10 text-cambridge-newStyle text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFilters}
            className="p-1"
          >
            {isFiltersExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      <div className={cn(
        isMobile && !isFiltersExpanded ? "hidden" : "block"
      )}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Ricerca
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cerca carte, brand, numero..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Brand
              </Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className={cn("w-[140px]", isMobile && "w-full")}>
                  <SelectValue placeholder="Tutti i brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i brand</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ordina per
              </Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className={cn("w-[140px]", isMobile && "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priorità</SelectItem>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="lastUsed">Ultimo uso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="show-new-cards"
              checked={showNewCards}
              onCheckedChange={setShowNewCards}
              className="data-[state=checked]:bg-cambridge-newStyle"
            />
            <Label htmlFor="show-new-cards" className="text-sm font-medium cursor-pointer">
              Includi carte nuove
            </Label>
          </div>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              onClick={handleClearFilters}
              size="sm"
              className={cn("text-gray-500", isMobile && "w-full")}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Pulisci ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

// Componente carta compatta
const CompactFidelityCard = ({ card, onCardClick }: CompactFidelityCardProps) => (
  <Card 
    className="relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 group"
    style={{ 
      backgroundColor: card.color || '#6B7280',
      aspectRatio: '3/2'
    }}
    onClick={() => onCardClick(card)}
  >
    <CardContent className="p-4 h-full flex flex-col justify-center items-center text-white text-center">
      <img
        src={viewImage(card.logo)}
        alt="Wallet Logo"
        className="group-hover:scale-110 transition-transform duration-200"
      />
      
      <div className="font-bold text-sm uppercase tracking-wide mb-1">
        {card.brand}
      </div>
      
      <div className="flex gap-1 flex-wrap justify-center">
        {card.isNew() && (
          <Badge className="bg-green-500 text-white text-xs px-1.5 py-0.5">
            NUOVA
          </Badge>
        )}
        {card.isPopular() && (
          <Badge className="bg-green-500 text-white text-xs px-1.5 py-0.5">
            <Star className="w-2 h-2 mr-1" />
            Popolare
          </Badge>
        )}
      </div>
    </CardContent>
  </Card>
);

// Modal dettaglio carta
const CardDetailModal = ({
  selectedCard,
  isDetailModalOpen,
  showCardBack,
  handleCloseDetail,
  toggleCardView,
  handleDeleteCard
}: CardDetailModalProps) => {
  if (!selectedCard || !isDetailModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={handleCloseDetail}
      />
      
      <div className="relative bg-white rounded-lg border shadow-lg p-6 max-w-md mx-auto w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {selectedCard.name}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloseDetail}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Card con animazione 3D flip */}
          <div className="mx-auto w-full" style={{ perspective: '1000px' }}>
            <div 
              className="cursor-pointer hover:shadow-lg transition-shadow duration-300 rounded-lg shadow-lg"
              style={{ 
                aspectRatio: '3/2',
                transformStyle: 'preserve-3d',
                transform: showCardBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.7s ease-in-out',
                position: 'relative'
              }}
              onClick={toggleCardView}
            >
              {/* Fronte carta */}
              <div 
                className="absolute inset-0 p-6 flex flex-col justify-between text-white rounded-lg border-2 border-white/20"
                style={{
                  backgroundColor: selectedCard.color || '#6B7280',
                  backfaceVisibility: 'hidden'
                }}
              >
                <div className="flex items-center justify-center h-full">
                <img
                  src={viewImage(selectedCard.logo)}
                  alt="Wallet Logo"
                  className="h-[30%] group-hover:scale-110 transition-transform duration-200"
                />
              </div>
                
                <div className="font-mono text-lgtracking-wider">
                  {selectedCard.number}
                </div>
                
                <div className="text-xs opacity-80">
                  Ultima: {new Date(selectedCard.lastUsed).toLocaleDateString()}
                </div>

                <div className="absolute bottom-2 right-2 text-xs opacity-60">
                  Clicca per girare →
                </div>
              </div>

              {/* Retro carta */}
              <div 
                className="absolute inset-0 p-4 flex flex-col justify-center items-center rounded-lg border-2 border-white/20"
                style={{
                  backgroundColor: selectedCard.color || '#6B7280',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
              <div className="bg-white rounded-lg p-4 pt-8 w-full shadow-inner">
              <div className="text-center space-y-3">
                {/* Barcode */}
                <div className="flex items-center justify-center h-40 w-full bg-white overflow-hidden">
                  <img 
                    src={generateBarcodeDataURL(selectedCard.barcode || '1378305867585143')}
                    alt={`Barcode ${selectedCard.barcode}`}
                    className="w-[110%] h-full object-contain"
                    style={{ imageRendering: 'crisp-edges' }}
                  />
                </div>
              </div>
            </div>


                <div className="absolute bottom-2 right-2 text-xs opacity-60 text-white">
                  ← Clicca per girare
                </div>
              </div>
            </div>
            
            <div className="text-center mt-3 text-sm text-gray-500">
              {showCardBack 
                ? "Mostra questo codice alla cassa per utilizzare la carta"
                : "Clicca sulla carta per vedere il codice a barre"
              }
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-cambridge-newStyle">
                {selectedCard.priority}
              </div>
              <div className="text-xs text-gray-500">Utilizzi</div>
              <div className="text-xs text-green-600">✨ Auto-incrementati</div>
            </div>
            <div className="space-y-1">
            </div>
            <div className="space-y-1">
              <div className="text-2xl">
                {selectedCard.isPublic ? '🌐' : '🔒'}
              </div>
              <div className="text-xs text-gray-500">
                {selectedCard.isPublic ? 'Pubblica' : 'Privata'}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-1">
              <Button 
                variant="destructive"
                onClick={() => {
                  handleDeleteCard(selectedCard.id);
                  handleCloseDetail();
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Elimina
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export di tutti i componenti
export const WalletComponents = {
  WalletStats,
  FilterPanel,
  CompactFidelityCard,
  CardDetailModal
};
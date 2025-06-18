// src/components/shopping/ShoppingItemCard.tsx
import { useState } from 'react';
import { 
  Edit, 
  Trash2, 
  ExternalLink, 
  User, 
  Clock, 
  Check, 
  Euro,
  AlertTriangle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  StickyNote,
  Globe,
  Lock,
  Award,
  Zap,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { it } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, isValid } from 'date-fns';
import { ShoppingItem, Category } from '@/lib/models/types';

interface ShoppingItemCardProps {
  item: ShoppingItem;
  categories: Category[];
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}

export function ShoppingItemCard({ 
  item, 
  categories, 
  onEdit, 
  onDelete, 
  onComplete 
}: ShoppingItemCardProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);

  const canEdit = user?.username === item.createdBy || user?.role === 'admin';

  // ✅ Funzione per troncare il titolo
  const truncateTitle = (title: string, maxLength: number = 32): { display: string; isTruncated: boolean } => {
    if (!title || title.length <= maxLength) {
      return { display: title || 'Prodotto senza nome', isTruncated: false };
    }
    return { 
      display: title.substring(0, maxLength) + '...', 
      isTruncated: true 
    };
  };

  const titleData = truncateTitle(item.name || 'Prodotto senza nome');

  const isAIProcessing = item.scrapingData && item.scrapingData.scrapingSuccess !== true;
  const hasAIData = item.scrapingData && item.scrapingData.scrapingSuccess === true;

  // ✅ Funzione sicura per formattare le date
  const formatSafeDate = (date: Date | undefined): string => {
    if (!date || !isValid(date)) {
      return 'Data non disponibile';
    }
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: it });
    } catch (error) {
      console.warn('Error formatting date:', error);
      return 'Data non valida';
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete(item.id);
      toast({
        title: 'Elemento completato',
        description: 'Elemento della lista della spesa segnato come completato!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: "Impossibile segnare l'elemento come completato",
        variant: 'destructive',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(item.id);
      toast({
        title: 'Elemento eliminato',
        description: 'Elemento della lista della spesa eliminato con successo!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: "Impossibile eliminare l'elemento",
        variant: 'destructive',
      });
    }
  };

  // ✅ Formattiamo il prezzo in modo sicuro
  const formatPrice = (price: number | string): string => {
    if (typeof price === 'string') {
      return price;
    }
    return price.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  };

  // ✅ Trova la categoria per styling
  const categoryData = categories?.find(cat => cat.name === item.category);
  const categoryStyle = categoryData 
    ? { backgroundColor: `${categoryData.color}20`, color: categoryData.color, className: 'border-current' }
    : { className: 'text-gray-600 border-gray-300' };

  // ✅ Configurazione priorità
  const priorityConfig = {
    high: { 
      icon: ArrowUp, 
      label: 'Alta', 
      color: 'text-red-600 border-red-300 bg-red-50',
      className: 'badge-high-priority'
    },
    medium: { 
      icon: ArrowRight, 
      label: 'Media', 
      color: 'text-yellow-600 border-yellow-300 bg-yellow-50',
      className: 'badge-medium-priority'
    },
    low: { 
      icon: ArrowDown, 
      label: 'Bassa', 
      color: 'text-green-600 border-green-300 bg-green-50',
      className: 'badge-low-priority'
    }
  };

  const priorityDisplay = priorityConfig[item.priority];
  const PriorityIcon = priorityDisplay.icon;

  return (
    <TooltipProvider>
      <Card className={`
        transition-all duration-300 hover:shadow-lg border h-full flex flex-col
        ${item.completed ? 'opacity-60' : ''} 
        ${item.priority === 'high' ? 'ring-2 ring-red-400 dark:ring-red-500' : ''}
        ${isAIProcessing ? 'ring-2 ring-blue-400' : ''}
      `}>
      <CardContent className="p-4 flex flex-col flex-1">
        {/* ✅ HEADER COMPATTO - Nome + Prezzo + Azioni Inline */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            {/* Prima riga: Icona visibilità + Badge AI + Titolo */}
            <div className="flex items-center mb-1">
              {/* Icona visibilità compatta */}
              {item.isPublic ? (
                <Globe className="w-3 h-3 mr-1 text-green-600 flex-shrink-0" />
              ) : (
                <Lock className="w-3 h-3 mr-1 text-orange-600 flex-shrink-0" />
              )}
              
              {/* Badge AI compatti */}
              {isAIProcessing && (
                <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 mr-1 text-xs px-1 py-0 h-5">
                  <Sparkles className="mr-1 h-2 w-2 animate-slow-spin" />
                  AI
                </Badge>
              )}
              
              {hasAIData && (
                <Badge variant="outline" className="text-purple-600 border-purple-300 bg-purple-50 mr-1 text-xs px-1 py-0 h-5">
                  <Zap className="mr-1 h-2 w-2" />
                  AI
                </Badge>
              )}
            </div>
            
            {/* Seconda riga: Titolo del prodotto */}
            <div className="mb-1">
              {titleData.isTruncated ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3 className={`font-semibold text-card-foreground cursor-help text-sm leading-tight ${item.completed ? 'line-through' : ''}`}>
                      {titleData.display}
                    </h3>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{item.name}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <h3 className={`font-semibold text-card-foreground text-sm leading-tight ${item.completed ? 'line-through' : ''}`}>
                  {titleData.display}
                </h3>
              )}
            </div>

            {/* Terza riga: Brand se presente */}
            {item.brandName && (
              <div className="flex items-center text-xs text-gray-600 mb-1">
                <Award className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
                <span className="font-medium truncate">{item.brandName}</span>
              </div>
            )}
          </div>
          
          {/* ✅ AZIONI INLINE + PREZZO */}
          <div className="flex items-start space-x-1 ml-2 flex-shrink-0">
            {/* Prezzo compatto */}
            {item.estimatedPrice && (
              <div className="flex items-center text-green-600 dark:text-green-400 font-semibold text-sm">
                {formatPrice(item.estimatedPrice)}
              </div>
            )}
            
            {/* Bottoni azione compatti inline */}
            {canEdit && (
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(item)}
                  className="text-gray-400 hover:text-cambridge-blue h-6 w-6 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-red-500 h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                      <AlertDialogDescription>
                        Sei sicuro di voler eliminare "{item.name || 'questo elemento'}"? Questa azione non può essere annullata.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        Elimina
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
        
        {/* ✅ BADGE COMPATTI - Categoria e Priorità inline */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <Badge 
            variant="outline"
            style={categoryStyle.className ? undefined : categoryStyle}
            className={`${categoryStyle.className || 'border'} text-xs px-2 py-0 h-5`}
          >
            {categoryData?.icon && <span className="mr-1 text-xs">{categoryData.icon}</span>}
            {item.category}
          </Badge>
          
          <Badge 
            variant="outline"
            className={`${priorityDisplay.color} border-current ${priorityDisplay.className} text-xs px-2 py-0 h-5`}
          >
            <PriorityIcon className="h-2.5 w-2.5 mr-1" />
            {priorityDisplay.label}
          </Badge>
        </div>

        {/* ✅ NOTE COMPATTE - se disponibili */}
        {item.notes && (
          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-md flex-grow">
            <div className="flex items-start">
              <StickyNote className="h-3 w-3 mr-1.5 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">{item.notes}</p>
            </div>
          </div>
        )}

        {/* ✅ LINK COMPATTO - se disponibile */}
        {item.link && (
          <div className="mb-3">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs text-cambridge-blue hover:text-cambridge-blue/80 hover:underline"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Vedi prodotto
            </a>
          </div>
        )}

        {/* ✅ FOOTER COMPATTO con info - Autore + Data inline */}
        <div className="flex justify-between items-center text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
          <div className="flex items-center min-w-0 flex-1">
            <User className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
            <span className="truncate">{item.createdBy}</span>
          </div>
          <div className="flex items-center ml-2 flex-shrink-0">
            <Clock className="h-2.5 w-2.5 mr-1" />
            <span className="truncate">{formatSafeDate(item.createdAt)}</span>
          </div>
        </div>

        {/* ✅ PULSANTE COMPLETAMENTO COMPATTO - Bottom fixed */}
        {!item.completed && (
          <div className="flex justify-center mt-3">
            <Button
              onClick={handleComplete}
              disabled={isCompleting}
              variant="outline"
              size="sm"
              className="w-full h-8 bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800 text-xs"
            >
              {isCompleting ? (
                'Segnando...'
              ) : (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Completato
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}

// ✅ CSS ottimizzato per le animazioni compatte
const styles = `
  @keyframes slow-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }
  
  @keyframes slow-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .animate-slow-bounce {
    animation: slow-bounce 2s ease-in-out infinite;
  }
  
  .animate-slow-spin {
    animation: slow-spin 3s linear infinite;
  }
  
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  /* ✅ Ottimizzazioni per badge compatti */
  .badge-high-priority {
    font-size: 10px;
    padding: 1px 6px;
  }
  
  .badge-medium-priority {
    font-size: 10px;
    padding: 1px 6px;
  }
  
  .badge-low-priority {
    font-size: 10px;
    padding: 1px 6px;
  }
`;

// Inietta gli stili nel documento
if (typeof document !== 'undefined' && !document.getElementById('shopping-card-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'shopping-card-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
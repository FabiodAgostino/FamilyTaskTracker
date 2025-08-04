// src/components/shopping/ShoppingItemDetail.tsx - CORREZIONE PREZZO
import { useState } from 'react';
import { 
  ExternalLink, 
  User, 
  Clock, 
  Check, 
  ArrowUp,
  ArrowRight,
  ArrowDown,
  StickyNote,
  Globe,
  Lock,
  Award,
  Zap,
  Sparkles,
  Edit,
  Calendar,
  Copy,
  Share2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow, format, isValid } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { Category } from '@/lib/models/types';
import { ShoppingItem } from '@/lib/models/shopping-item';
import React from 'react';

interface ShoppingItemDetailProps {
  item: ShoppingItem | null;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (item: ShoppingItem) => void;
  onComplete?: (id: string) => void;
}

export function ShoppingItemDetail({ 
  item, 
  categories, 
  isOpen, 
  onClose, 
  onEdit,
  onComplete 
}: ShoppingItemDetailProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);

  if (!item) return null;

  const canEdit = user?.username === item.createdBy || user?.role === 'admin' || item.isPublic;

  // Trova i dati della categoria
  const categoryData = categories?.find(cat => cat.name === item.category);

  // Configurazione priorità
  const priorityConfig = {
    high: { 
      label: 'Alta', 
      icon: ArrowUp, 
      color: 'text-red-600', 
      className: 'border-red-200 bg-red-50' 
    },
    medium: { 
      label: 'Media', 
      icon: ArrowRight, 
      color: 'text-yellow-600', 
      className: 'border-yellow-200 bg-yellow-50' 
    },
    low: { 
      label: 'Bassa', 
      icon: ArrowDown, 
      color: 'text-green-600', 
      className: 'border-green-200 bg-green-50' 
    }
  };

  const priorityDisplay = priorityConfig[item.priority] || priorityConfig.medium;
  const PriorityIcon = priorityDisplay.icon;
  
  // ✅ CORRETTO: Formato prezzo con gestione valute dinamiche
  const formatPrice = (price: number | string): string => {
    if (typeof price === 'string') {
      // Se è già una stringa, la restituisco così com'è (già formattata)
      return price;
    }
    
    // ✅ Controllo per NaN e valori non validi
    if (isNaN(price) || price === null || price === undefined) {
      return 'Prezzo non disponibile';
    }
    
    // Per numeri, aggiungo sempre € dopo la cifra
    return price.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  };

  // Formato data sicuro
  const formatSafeDate = (date: Date | undefined, formatStr?: string): string => {
    if (!date || !isValid(date)) {
      return 'Data non disponibile';
    }
    try {
      return formatStr ? format(date, formatStr, { locale: it }) : 
             formatDistanceToNow(date, { addSuffix: true, locale: it });
    } catch (error) {
      console.warn('Error formatting date:', error);
      return 'Data non valida';
    }
  };

  // Stato AI e dati
  const isAIProcessing = item.scrapingData && item.scrapingData.scrapingSuccess !== true;
  const hasAIData = item.scrapingData && item.scrapingData.scrapingSuccess === true;

  const handleComplete = async () => {
    if (!onComplete) return;
    
    setIsCompleting(true);
    try {
      await onComplete(item.id);
      toast({
        title: 'Elemento archiviato',
        description: 'Elemento Shopping segnato come archiviato!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile archiviare l\'elemento',
        variant: 'destructive',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCopyLink = () => {
    if (item.link) {
      navigator.clipboard.writeText(item.link);
      toast({
        title: 'Link copiato',
        description: 'Il link del prodotto è stato copiato negli appunti',
      });
    }
  };

  const handleShare = () => {
    if (navigator.share && item.link) {
      navigator.share({
        title: item.name || 'Prodotto',
        url: item.link
      });
    } else {
      handleCopyLink();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className={`text-xl font-semibold ${item.completed ? 'line-through text-gray-500' : ''}`}>
                {item.name || 'Prodotto senza nome'}
              </DialogTitle>
              {item.brandName && (
                <div className="flex items-center mt-2 text-gray-600">
                  <Award className="h-4 w-4 mr-1" />
                  <span className="font-medium">{item.brandName}</span>
                </div>
              )}
            </div>
            {canEdit && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
                className="ml-4"
              >
                <Edit className="h-4 w-4 mr-1" />
                Modifica
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Badges informativi */}
          <div className="flex flex-wrap gap-2">
            {/* Categoria */}
            <Badge variant="outline" className="text-sm">
              {categoryData?.icon && <span className="mr-1">{categoryData.icon}</span>}
              {item.category}
            </Badge>

            {/* Priorità */}
            <Badge 
              variant="outline"
              className={`${priorityDisplay.color} ${priorityDisplay.className} text-sm`}
            >
              <PriorityIcon className="h-3 w-3 mr-1" />
              {priorityDisplay.label}
            </Badge>

            {/* Visibilità */}
            <Badge 
              variant={item.isPublic ? "default" : "secondary"}
              className="text-sm"
            >
              {item.isPublic ? (
                <>
                  <Globe className="h-3 w-3 mr-1" />
                  Pubblico
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3 mr-1" />
                  Privato
                </>
              )}
            </Badge>

            {/* Stato completamento */}
            {item.completed && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-sm">
                <Check className="h-3 w-3 mr-1" />
                Archiviato
              </Badge>
            )}

            {/* Indicatori AI */}
            {isAIProcessing && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-sm">
                <Zap className="h-3 w-3 mr-1" />
                Analisi AI in corso...
              </Badge>
            )}

            {hasAIData && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-sm">
                <Sparkles className="h-3 w-3 mr-1" />
                Analizzato da AI
              </Badge>
            )}
          </div>

          {/* ✅ CORRETTO: Prezzo senza icona € prima */}
          {item.estimatedPrice && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2 flex items-center justify-center">
                    <span className="text-green-600 font-bold text-lg">💰</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Prezzo stimato</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPrice(item.estimatedPrice)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Note */}
          {item.notes && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center">
                  <StickyNote className="h-4 w-4 mr-2 text-gray-600" />
                  <h3 className="font-medium text-gray-900">Note</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {item.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Link del prodotto */}
          {item.link && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center">
                  <ExternalLink className="h-4 w-4 mr-2 text-gray-600" />
                  <h3 className="font-medium text-gray-900">Link Prodotto</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(item.link, '_blank')}
                    className="flex-1"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Apri prodotto
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Informazioni di sistema */}
          <Card>
            <CardHeader className="pb-3">
              <h3 className="font-medium">Informazioni</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-2" />
                <span>Creato da <strong>{item.createdBy}</strong></span>
              </div>
              
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                <span>
                  Creato {formatSafeDate(item.createdAt)}
                  {item.createdAt && (
                    <span className="ml-2 text-gray-400">
                      ({formatSafeDate(item.createdAt, 'dd/MM/yyyy HH:mm')})
                    </span>
                  )}
                </span>
              </div>

              {item.updatedAt && item.updatedAt !== item.createdAt && (
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  <span>
                    Aggiornato {formatSafeDate(item.updatedAt)}
                    {item.updatedAt && (
                      <span className="ml-2 text-gray-400">
                        ({formatSafeDate(item.updatedAt, 'dd/MM/yyyy HH:mm')})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {item.completedAt && (
                <div className="flex items-center text-sm text-gray-600">
                  <Check className="h-4 w-4 mr-2" />
                  <span>
                    Archiviato {formatSafeDate(item.completedAt)}
                    {item.completedAt && (
                      <span className="ml-2 text-gray-400">
                        ({formatSafeDate(item.completedAt, 'dd/MM/yyyy HH:mm')})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pulsante completamento */}
          {!item.completed && onComplete && (
            <>
              <Separator />
               <div className="flex justify-end space-x-2 pt-4">
                 <Button
                                    variant="secondary" 
                                    onClick={() => onClose()}
                                  >
                                    Annulla
                                  </Button>
                <Button
                  onClick={handleComplete}
                  disabled={isCompleting}
                  className=" bg-green-600 hover:bg-green-700"
                >
                  {isCompleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Segnando come archiviato...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Segna come archiviato
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
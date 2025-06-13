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
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { it } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
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
import { formatDistanceToNow } from 'date-fns';
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
  console.log(item)
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);

  const canEdit = user?.username === item.createdBy || user?.role === 'admin';

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

  const getCategoryStyle = (categoryName: string) => {
    const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    
    if (category && category.color) {
      return {
        backgroundColor: `${category.color}20`,
        color: category.color,
        borderColor: category.color
      };
    }
    
    const defaultColors: Record<string, { bg: string; text: string; border: string }> = {
      'groceries': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
      'electronics': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
      'household': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
      'clothing': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    };
    
    const defaultStyle = defaultColors[categoryName.toLowerCase()];
    return defaultStyle 
      ? { className: `${defaultStyle.bg} ${defaultStyle.text} ${defaultStyle.border}` }
      : { className: 'bg-gray-100 text-gray-700 border-gray-300' };
  };

  const getPriorityDisplay = (priority: 'low' | 'medium' | 'high') => {
    const priorityConfig = {
      low: { 
        icon: ArrowDown, 
        label: 'Bassa', 
        color: 'text-green-600',
        bgColor: 'bg-green-100' 
      },
      medium: { 
        icon: ArrowRight, 
        label: 'Media', 
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100' 
      },
      high: { 
        icon: ArrowUp, 
        label: 'Alta', 
        color: 'text-red-600',
        bgColor: 'bg-red-100' 
      }
    };
    
    return priorityConfig[priority];
  };

  const formatPrice = (price?: number): string => {
    if (!price) return '';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const categoryStyle = getCategoryStyle(item.category);
  const priorityDisplay = getPriorityDisplay(item.priority);
  const PriorityIcon = priorityDisplay.icon;
  
  const categoryData = categories.find(c => c.name.toLowerCase() === item.category.toLowerCase());

  return (
    <Card className={`hover:shadow-lg transition-all duration-200 flex flex-col h-full border border-border ${
      item.completed ? 'opacity-60' : ''
    } ${item.priority === 'high' ? 'ring-2 ring-red-400 dark:ring-red-500' : ''}`}>
      <CardContent className="p-6 flex flex-col flex-1">
        {/* Header con nome, prezzo e azioni */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {/* ✅ NUOVO: Icona visibilità in alto a sinistra */}
            <div className="flex items-center mb-2">
              {item.isPublic ? (
                <Globe className="w-4 h-4 mr-2 text-green-600" />
              ) : (
                <Lock className="w-4 h-4 mr-2 text-orange-600" />
              )}
              <h3 className={`font-semibold text-card-foreground flex-1 ${item.completed ? 'line-through' : ''}`}>
                {item.name}
              </h3>
              {item.estimatedPrice && (
                <div className="flex items-center text-green-600 dark:text-green-400 font-semibold ml-auto">
                  <Euro className="h-4 w-4 mr-1" />
                  {formatPrice(item.estimatedPrice)}
                </div>
              )}
            </div>
            
            {/* Badge categoria e priorità */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline"
                style={categoryStyle.className ? undefined : categoryStyle}
                className={categoryStyle.className || 'border'}
              >
                {categoryData?.icon && <span className="mr-1">{categoryData.icon}</span>}
                {item.category}
              </Badge>
              
              <Badge 
                variant="outline"
                className={`${priorityDisplay.color} border-current ${
                  item.priority === 'high' ? 'badge-high-priority' :
                  item.priority === 'medium' ? 'badge-medium-priority' : 
                  'badge-low-priority'
                }`}
              >
                <PriorityIcon className="h-3 w-3 mr-1" />
                {priorityDisplay.label}
              </Badge>
            </div>
          </div>
          
          {canEdit && (
            <div className="flex space-x-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(item)}
                className="text-gray-400 hover:text-cambridge-blue"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sei sicuro di voler eliminare "{item.name}"? Questa azione non può essere annullata.
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

        {/* Note se disponibili */}
        {item.notes && (
          <div className="mb-3 p-3 bg-muted rounded-lg border border-border">
            <div className="flex items-start text-sm text-muted-foreground">
              <StickyNote className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground" />
              <span className="italic">{item.notes}</span>
            </div>
          </div>
        )}

        <div className="space-y-3 flex-1">
          <div className="flex items-center text-sm text-muted-foreground">
            <User className="mr-2 h-4 w-4" />
            Aggiunto da {item.createdBy}
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="mr-2 h-4 w-4" />
            {formatDistanceToNow(item.createdAt, { addSuffix: true, locale: it })}
          </div>
          
          {item.link && (
            <div className="flex items-center text-sm">
              <ExternalLink className="mr-2 h-4 w-4 text-cambridge-blue" />
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cambridge-blue hover:underline"
              >
                Vedi prodotto
              </a>
            </div>
          )}
          
          {!item.estimatedPrice && !item.link && (
            <div className="text-sm text-muted-foreground">
              Nessun link o prezzo specificato
            </div>
          )}
          
          <div className="flex-1"></div>
        </div>

        {/* Pulsante completamento */}
        <div className="mt-auto pt-4 border-t border-border">
          {item.completed ? (
            <Button
              disabled
              className="w-full bg-muted text-muted-foreground cursor-not-allowed"
            >
              <Check className="mr-2 h-4 w-4" />
              Completato
              {item.completedAt && (
                <span className="ml-2 text-xs opacity-75">
                  ({formatDistanceToNow(item.completedAt, { locale: it })})
                </span>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isCompleting}
              className="w-full bg-burnt-sienna hover:bg-burnt-sienna/90 text-white transition-colors"
            >
              {isCompleting ? (
                'Segnando...'
              ) : (
                <>
                  <PriorityIcon className="mr-2 h-4 w-4" />
                  Segna come completato
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
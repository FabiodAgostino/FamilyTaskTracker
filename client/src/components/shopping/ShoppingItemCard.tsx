// src/components/shopping/ShoppingItemCard.tsx
import { useState } from 'react';
import { Edit, Trash2, ExternalLink, User, Clock, Check } from 'lucide-react';
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
import { ShoppingItem } from '@/lib/models/types';

interface ShoppingItemCardProps { // ✅ Interface rinominata
  item: ShoppingItem; // ✅ Usa direttamente la classe
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}

export function ShoppingItemCard({ item, onEdit, onDelete, onComplete }: ShoppingItemCardProps) { // ✅ Componente rinominato
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

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'groceries': 'bg-cambridge-blue/20 text-cambridge-blue',
      'electronics': 'bg-sunset/50 text-delft-blue',
      'household': 'bg-burnt-sienna/20 text-burnt-sienna',
      'clothing': 'bg-purple-100 text-purple-700',
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-delft-blue mb-1">{item.name}</h3>
            <Badge className={getCategoryColor(item.category)}>
              {item.category}
            </Badge>
          </div>
          {canEdit && (
            <div className="flex space-x-2">
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

        <div className="space-y-3">
          <div className="flex items-center text-sm text-gray-600">
            <User className="mr-2 h-4 w-4" />
            Aggiunto da {item.createdBy}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="mr-2 h-4 w-4" />
            {formatDistanceToNow(item.createdAt, { addSuffix: true, locale: it  })}
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
          {!item.link && (
            <div className="text-sm text-gray-500">Nessun link al prodotto</div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          {item.completed ? (
            <Button
              disabled
              className="w-full bg-gray-400 text-white cursor-not-allowed"
            >
              <Check className="mr-2 h-4 w-4" />
              Completato
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isCompleting}
              className="w-full bg-cambridge-blue hover:bg-cambridge-blue/90 text-white"
            >
              {isCompleting ? 'Segnando...' : 'Segna come completato'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

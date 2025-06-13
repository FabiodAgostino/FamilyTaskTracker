import { useState } from 'react';
import { Edit, Trash2, Globe, Lock, User, Clock, Pin, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Note } from '@/lib/models/types';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = user?.username === note.createdBy || user?.role === 'admin';

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(note.id);
      toast({
        title: 'Nota eliminata',
        description: 'La nota è stata eliminata con successo!',
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare la nota',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const truncateContent = (content: string, maxLength: number = 120) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getVisibilityBadge = () => {
    if (note.isPublic) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          <Globe className="mr-1 h-3 w-3" />
          Pubblica
        </Badge>
      );
    }
    return (
      <Badge className="bg-orange-100 text-orange-700 border-orange-200">
        <Lock className="mr-1 h-3 w-3" />
        Privata
      </Badge>
    );
  };

  return (
    <Card 
      className="hover:shadow-md transition-all duration-200 border-l-4"
      style={{ 
        borderLeftColor: note.color || '#F3F4F6',
        backgroundColor: note.color ? `${note.color}08` : 'white' // Sfumatura molto leggera del colore
      }}
    >
      <CardContent className="p-6">
        {/* Header con titolo e azioni */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {note.isPinned && <Pin className="h-4 w-4 text-burnt-sienna flex-shrink-0" />}
              <h3 className="font-semibold text-delft-blue truncate">{note.title}</h3>
            </div>
            {getVisibilityBadge()}
          </div>
          {canEdit && (
            <div className="flex space-x-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(note)}
                className="h-8 w-8 p-0 text-gray-400 hover:text-cambridge-blue"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sei sicuro di voler eliminare la nota "{note.title}"? 
                      Questa azione non può essere annullata.
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

        {/* Contenuto della nota */}
        <div className="space-y-3">
          <p className="text-gray-700 text-sm leading-relaxed">
            {truncateContent(note.content)}
          </p>

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {note.tags.slice(0, 3).map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs px-2 py-0.5 bg-gray-50"
                >
                  #{tag}
                </Badge>
              ))}
              {note.tags.length > 3 && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gray-50">
                  +{note.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Info metadata */}
          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex items-center">
              <User className="mr-2 h-3 w-3" />
              Creata da {note.createdBy}
            </div>
            <div className="flex items-center">
              <Clock className="mr-2 h-3 w-3" />
              {formatDistanceToNow(new Date(note.updatedAt), { 
                addSuffix: true, 
                locale: it 
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
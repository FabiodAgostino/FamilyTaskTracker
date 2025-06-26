// src/components/notes/NoteDetail.tsx
import { 
  Globe, 
  Lock, 
  User, 
  Clock, 
  Pin, 
  Tag,
  Edit,
  Calendar,
  Copy,
  Share2,
  Palette
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
import { Note } from '@/lib/models/types';

interface NoteDetailProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (note: Note) => void;
}

export function NoteDetail({ 
  note, 
  isOpen, 
  onClose, 
  onEdit 
}: NoteDetailProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();

  if (!note) return null;

 const canEdit = user?.username === note.createdBy || user?.role === 'admin' || note.isPublic;


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

  const handleClose = () => {
    onClose();
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(note.content);
    toast({
      title: 'Contenuto copiato',
      description: 'Il contenuto della nota è stato copiato negli appunti',
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: note.title,
        text: note.content
      });
    } else {
      handleCopyContent();
    }
  };

  // Determina il colore del testo basato sul colore di sfondo della nota
  const getTextColorFromBg = (bgColor: string): string => {
    if (!bgColor || bgColor === '#F3F4F6') return '#111827';
    
    // Conversione hex a RGB per calcolare la luminanza
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calcola la luminanza relativa
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Ritorna nero per sfondi chiari, bianco per sfondi scuri
    return luminance > 0.5 ? '#111827' : '#FFFFFF';
  };

  const textColor = getTextColorFromBg(note.color || '#F3F4F6');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold pr-4">
                {note.title}
              </DialogTitle>
            </div>
            {canEdit && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(note)}
                className="ml-4 flex-shrink-0"
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
            {/* Visibilità */}
            <Badge 
              variant={note.isPublic ? "default" : "secondary"}
              className="text-sm"
            >
              {note.isPublic ? (
                <>
                  <Globe className="h-3 w-3 mr-1" />
                  Pubblica
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3 mr-1" />
                  Privata
                </>
              )}
            </Badge>

            {/* Nota fissata */}
            {note.isPinned && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-sm">
                <Pin className="h-3 w-3 mr-1" />
                Fissata
              </Badge>
            )}

            {/* Colore della nota */}
            {note.color && note.color !== '#F3F4F6' && (
              <Badge variant="outline" className="text-sm">
                <Palette className="h-3 w-3 mr-1" />
                <div 
                  className="w-3 h-3 rounded-full ml-1 border border-gray-300"
                  style={{ backgroundColor: note.color }}
                />
              </Badge>
            )}
          </div>

          {/* Contenuto principale della nota */}
          <Card 
            className="border-l-4 min-h-[200px]"
            style={{ 
              borderLeftColor: note.color || '#F3F4F6',
              backgroundColor: note.color || '#F3F4F6'
            }}
          >
            <CardContent className="pt-6">
              <div 
                className="prose prose-sm max-w-none leading-relaxed whitespace-pre-wrap"
                style={{ color: textColor }}
              >
                {note.content}
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center">
                  <Tag className="h-4 w-4 mr-2 text-gray-600" />
                  <h3 className="font-medium text-gray-900">Tags</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {note.tags.map((tag, index) => (
                    <Badge 
                      key={index}
                      variant="outline" 
                      className="text-sm px-3 py-1 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Azioni */}
          <Card>
            <CardHeader className="pb-3">
              <h3 className="font-medium text-gray-900">Azioni</h3>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyContent}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copia contenuto
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

          {/* Informazioni di sistema */}
          <Card>
            <CardHeader className="pb-3">
              <h3 className="font-medium text-gray-900">Informazioni</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-2" />
                <span>Creata da <strong>{note.createdBy}</strong></span>
              </div>
              
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                <span>
                  Creata {formatSafeDate(note.createdAt)}
                  {note.createdAt && (
                    <span className="ml-2 text-gray-400">
                      ({formatSafeDate(note.createdAt, 'dd/MM/yyyy HH:mm')})
                    </span>
                  )}
                </span>
              </div>

              {note.updatedAt && note.updatedAt !== note.createdAt && (
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  <span>
                    Aggiornata {formatSafeDate(note.updatedAt)}
                    {note.updatedAt && (
                      <span className="ml-2 text-gray-400">
                        ({formatSafeDate(note.updatedAt, 'dd/MM/yyyy HH:mm')})
                      </span>
                    )}
                  </span>
                </div>
              )}
               <div className="flex gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={handleClose}
              >
                Chiudi
              </Button>
              </div>

              {/* Statistiche di lunghezza */}
              <Separator className="my-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Caratteri: {note.content.length}</span>
                <span>
                  Parole: {note.content.trim() ? note.content.trim().split(/\s+/).length : 0}
                </span>
                <span>
                  Righe: {note.content.split('\n').length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
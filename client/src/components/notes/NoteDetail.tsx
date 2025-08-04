import React, { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { Note } from '@/lib/models/types';

interface NoteDetailProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (note: Note) => void;
  onUpdateContent?: (note: Note, newContent: string) => Promise<void>;
}

// Componente per l'anteprima del testo formattato nel dettaglio
const FormattedContentDisplay = ({ 
  text, 
  onContentUpdate 
}: { 
  text: string;
  onContentUpdate?: (newContent: string) => void;
}) => {
  const toggleCheckbox = (lineIndex: number) => {
    if (!onContentUpdate) return;

    const lines = text.split('\n');
    const line = lines[lineIndex];
    
    // Verifica se è una riga checkbox
    const checkboxMatch = line.match(/^- (.+)$/);
    if (!checkboxMatch) return;

    const content = checkboxMatch[1];
    let newLine = '';

    // Se la riga termina con £, la checkbox è spuntata -> deseleziona
    if (content.endsWith('£')) {
      newLine = `- ${content.slice(0, -1)}`; // Rimuove £
    } else {
      // La checkbox non è spuntata -> seleziona
      newLine = `- ${content}£`; // Aggiunge £
    }

    // Aggiorna la riga nel testo
    const newLines = [...lines];
    newLines[lineIndex] = newLine;
    const newContent = newLines.join('\n');
    
    onContentUpdate(newContent);
  };

  const parseInlineFormatting = (text: string) => {
    if (!text) return null;

    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      // Aggiungi il testo prima del grassetto
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Aggiungi il testo in grassetto
      parts.push(
        <strong key={`bold-${match.index}`} className="font-bold">
          {match[1]}
        </strong>
      );
      
      lastIndex = match.index + match[0].length;
    }

    // Aggiungi il testo rimanente
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const parseText = (text: string) => {
    if (!text) return [];

    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Pattern checkbox: "- testo" o "- testo£" (con £ per checkbox spuntata)
      const checkboxMatch = line.match(/^- (.+)$/);
      if (checkboxMatch) {
        const content = checkboxMatch[1];
        const isChecked = content.endsWith('£');
        const displayContent = isChecked ? content.slice(0, -1) : content; // Rimuove £ per visualizzazione
        
        return (
          <div key={index} className="flex items-center gap-3 my-2">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleCheckbox(index)}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 focus:ring-2 flex-shrink-0"
              disabled={!onContentUpdate} // Disabilita se non c'è callback di aggiornamento
            />
            <span className={`${isChecked ? 'line-through text-gray-500' : ''} leading-relaxed`}>
              {parseInlineFormatting(displayContent)}
            </span>
          </div>
        );
      }

      // Pattern elenco puntato: ". testo"
      const bulletMatch = line.match(/^\. (.+)$/);
      if (bulletMatch) {
        return (
          <div key={index} className="flex items-start gap-3 my-2">
            <span className="text-blue-600 font-bold mt-0.5 select-none flex-shrink-0">•</span>
            <span className="leading-relaxed">{parseInlineFormatting(bulletMatch[1])}</span>
          </div>
        );
      }

      // Riga normale
      return (
        <div key={index} className="my-2 leading-relaxed">
          {parseInlineFormatting(line) || '\u00A0'}
        </div>
      );
    });
  };

  return (
    <div className="text-base leading-relaxed">
      {parseText(text)}
    </div>
  );
};

export function NoteDetail({ 
  note, 
  isOpen, 
  onClose, 
  onEdit,
  onUpdateContent
}: NoteDetailProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();

  if (!note) return null;
  const canEdit = user?.username === note.createdBy || user?.role === 'admin' || note.isPublic;

  // Gestisce l'aggiornamento del contenuto quando si spuntano le checkbox
  const handleContentUpdate = async (newContent: string) => {
    if (!onUpdateContent) {
      toast({
        title: 'Impossibile aggiornare',
        description: 'Funzionalità di aggiornamento non disponibile',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onUpdateContent(note, newContent);
      
    } catch (error) {
      console.error('Errore nell\'aggiornamento del contenuto:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile salvare le modifiche',
        variant: 'destructive',
      });
    }
  };

  // Funzioni per formattazione date senza dipendenze esterne
  const formatSafeDate = (date: Date | undefined, formatStr?: string): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Data non disponibile';
    }
    
    try {
      if (formatStr === 'dd/MM/yyyy HH:mm') {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      }
      
      // Formato relativo semplice
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes < 1) return 'appena ora';
      if (diffMinutes < 60) return `${diffMinutes} minuti fa`;
      if (diffHours < 24) return `${diffHours} ore fa`;
      if (diffDays < 7) return `${diffDays} giorni fa`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} mesi fa`;
      return `${Math.floor(diffDays / 365)} anni fa`;
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

  // Determina il nome del colore
  const getColorName = (colorValue: string): string => {
    const colorMap: Record<string, string> = {
      '#F3F4F6': 'Predefinito',
      '#FEF3C7': 'Giallo',
      '#D1FAE5': 'Verde',
      '#DBEAFE': 'Azzurro',
      '#E9D5FF': 'Viola',
      '#FCE7F3': 'Rosa',
      '#FED7AA': 'Arancione',
      '#FECACA': 'Rosso',
    };
    return colorMap[colorValue] || 'Personalizzato';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-semibold text-delft-blue pr-4">
                {note.title}
              </DialogTitle>
            </div>
            {canEdit && onEdit && (
              <Button
                variant="outline"
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
          
          </div>

          {/* Contenuto principale della nota con formattazione avanzata */}
          <Card 
            className="border-4 min-h-[200px] bg-white"
            style={{ 
              borderColor: note.color || '#F3F4F6'
            }}
          >
            <CardContent className="pt-6">
              <div className="prose prose-lg max-w-none">
                <FormattedContentDisplay 
                  text={note.content} 
                  onContentUpdate={canEdit ? handleContentUpdate : undefined}
                />
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
                  onClick={handleCopyContent}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copia contenuto
                </Button>
                <Button
                  variant="outline"
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

              {/* Pulsante Chiudi */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={handleClose}
                >
                  Chiudi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
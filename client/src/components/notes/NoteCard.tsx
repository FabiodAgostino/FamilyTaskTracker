import React, { useState } from 'react';
import { Edit, Trash2, Globe, Lock, User, Clock, Pin, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Note } from '@/lib/models/types';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onClick?: (note: Note) => void;
}

// Componente per l'anteprima formattata del contenuto nella card
const FormattedContentPreview = ({ text }: { text: string }) => {
  const [checkboxStates, setCheckboxStates] = useState<Record<number, boolean>>({});

  const toggleCheckbox = (index: number) => {
    setCheckboxStates(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
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
      
      // Aggiungi SOLO il contenuto in grassetto (senza gli asterischi)
      parts.push(
        <strong 
          key={`bold-${match.index}`} 
          className="font-bold text-blue-900"
        >
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
      // Pattern checkbox: "- testo" o "- testo£" 
      const checkboxMatch = line.match(/^- (.+)$/);
      if (checkboxMatch) {
        const content = checkboxMatch[1]; // Prende solo il contenuto DOPO "- "
        const isChecked = content.endsWith('£');
        const displayContent = isChecked ? content.slice(0, -1) : content; // Rimuove £ per visualizzazione
        
        return (
          <div key={index} className="flex items-center gap-2 my-1">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleCheckbox(index)}
              className="h-3 w-3 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 cursor-pointer"
              disabled // Disabilitato nella card preview
            />
            <span className={`${isChecked ? 'line-through text-gray-500' : ''} text-sm leading-relaxed`}>
              {parseInlineFormatting(displayContent)} {/* Mostra SOLO il contenuto, non "- contenuto" */}
            </span>
          </div>
        );
      }

      // Pattern elenco puntato: ". testo"
      const bulletMatch = line.match(/^\. (.+)$/);
      if (bulletMatch) {
        const bulletContent = bulletMatch[1]; // Prende solo il contenuto DOPO ". "
        
        return (
          <div key={index} className="flex items-start gap-2 my-1">
            <span className="text-blue-600 font-bold mt-0.5 select-none flex-shrink-0 text-sm">•</span>
            <span className="text-sm leading-relaxed">
              {parseInlineFormatting(bulletContent)} {/* Mostra SOLO il contenuto, non ". contenuto" */}
            </span>
          </div>
        );
      }

      // Riga normale - applica parsing per **grassetto**
      return (
        <div key={index} className="my-1 text-sm leading-relaxed">
          {parseInlineFormatting(line) || '\u00A0'}
        </div>
      );
    });
  };

  return (
    <div className="text-sm leading-relaxed">
      {parseText(text)}
    </div>
  );
};

export function NoteCard({ 
  note, 
  onEdit, 
  onDelete, 
  onClick
}: NoteCardProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = user?.username === note.createdBy || user?.role === 'admin' || note.isPublic;

  // Formato data semplice senza date-fns
  const formatRelativeTime = (date: Date | string): string => {
    const now = new Date();
    const targetDate = new Date(date);
    
    if (isNaN(targetDate.getTime())) {
      return 'Data non valida';
    }
    
    const diffMs = now.getTime() - targetDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'appena ora';
    if (diffMinutes < 60) return `${diffMinutes} minuti fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays < 7) return `${diffDays} giorni fa`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} mesi fa`;
    return `${Math.floor(diffDays / 365)} anni fa`;
  };

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

  // Handler per il click sulla card
  const handleCardClick = (e: React.MouseEvent) => {
    // Evita il click se si sta cliccando sui pulsanti di azione
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('a') ||
      (e.target as HTMLElement).closest('[role="button"]')
    ) {
      return;
    }
    
    if (onClick) {
      onClick(note);
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
    <Card 
      className="hover:shadow-md transition-all duration-200 border-l-4 cursor-pointer"
      style={{ 
        borderLeftColor: note.color || '#F3F4F6',
      }}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        {/* Header con titolo e azioni */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              {/* Icona di pin se la nota è fissata */}
              {note.isPinned && (
                <Pin className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              )}
              
              <h3 
                className="font-semibold text-lg leading-tight break-words"
              >
                {note.title}
              </h3>
            </div>
          </div>

          {/* Azioni (visibili solo se si può modificare) */}
          {canEdit && (
            <div className="flex space-x-1 ml-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(note);
                }}
                className="text-gray-400 hover:text-cambridge-newStyle h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                    className="text-gray-400 hover:text-red-500 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
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

        {/* Badges informativi */}
        <div className="flex flex-wrap gap-2 mb-3">
          {getVisibilityBadge()}
          
          {note.isPinned && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-200">
              <Pin className="mr-1 h-3 w-3" />
              Fissata
            </Badge>
          )}
        </div>

        {/* Contenuto della nota con formattazione avanzata */}
        <div className="space-y-3">
          <div className="text-sm leading-relaxed">
            <FormattedContentPreview text={truncateContent(note.content)} />
          </div>

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
              {formatRelativeTime(note.updatedAt)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
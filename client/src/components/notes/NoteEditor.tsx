import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Globe, Lock, Plus, Palette, Pin, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Note, ModelFactory, ValidationError } from '@/lib/models/types';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface NoteFormData {
  title: string;
  content: string;
  isPublic: boolean;
  createdBy: string;
  tags: string[];
  isPinned: boolean;
  color: string;
}

interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Note) => Promise<void>;
  editNote?: Note | null;
}

export function NoteEditor({ isOpen, onClose, onSave, editNote }: NoteEditorProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Colori predefiniti per le note con nomi in italiano
  const noteColors = [
    { name: 'Predefinito', value: '#F3F4F6', textColor: '#111827' },
    { name: 'Giallo', value: '#FEF3C7', textColor: '#92400E' },
    { name: 'Verde', value: '#D1FAE5', textColor: '#065F46' },
    { name: 'Azzurro', value: '#DBEAFE', textColor: '#1E40AF' },
    { name: 'Viola', value: '#E9D5FF', textColor: '#7C2D12' },
    { name: 'Rosa', value: '#FCE7F3', textColor: '#BE185D' },
    { name: 'Arancione', value: '#FED7AA', textColor: '#C2410C' },
    { name: 'Rosso', value: '#FECACA', textColor: '#DC2626' },
  ];

  const form = useForm<NoteFormData>({
    defaultValues: {
      title: '',
      content: '',
      isPublic: false,
      createdBy: user?.username || '',
      tags: [],
      isPinned: false,
      color: '#F3F4F6',
    },
  });

  // Reset form quando cambia la nota in edit o quando si apre/chiude il dialog
  useEffect(() => {
    if (isOpen) {
      if (editNote) {
        form.reset({
          title: editNote.title,
          content: editNote.content,
          isPublic: editNote.isPublic,
          createdBy: editNote.createdBy,
          tags: editNote.tags,
          isPinned: editNote.isPinned,
          color: editNote.color,
        });
        setTags(editNote.tags);
      } else {
        form.reset({
          title: '',
          content: '',
          isPublic: false,
          createdBy: user?.username || '',
          tags: [],
          isPinned: false,
          color: '#F3F4F6',
        });
        setTags([]);
      }
      setTagInput('');
    }
  }, [editNote, form, user, isOpen]);

  const handleClose = () => {
    onClose();
    // Reset form e stati quando si chiude
    setTimeout(() => {
      form.reset();
      setTags([]);
      setTagInput('');
    }, 150); // Piccolo delay per evitare flicker
  };

  const onSubmit = async (data: NoteFormData) => {
    if (!data.title.trim()) {
      toast({
        title: 'Errore',
        description: 'Il titolo è obbligatorio',
        variant: 'destructive',
      });
      return;
    }

    if (!data.content.trim()) {
      toast({
        title: 'Errore',
        description: 'Il contenuto è obbligatorio',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const noteData = {
        ...data,
        title: data.title.trim(),
        content: data.content.trim(),
        tags: tags.filter(tag => tag.trim() !== ''), // Pulisce i tag vuoti
      };

      let note: Note;
      
      if (editNote) {
        // Aggiornamento nota esistente
        note = editNote;
        try {
          note.update(noteData.title, noteData.content);
          note.isPublic = noteData.isPublic;
          note.color = noteData.color;
          note.isPinned = noteData.isPinned;
          
          // Gestione tag con validazione
          note.tags = [];
          noteData.tags.forEach(tag => note.addTag(tag.trim()));
          
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Errore di Validazione',
              description: validationError.errors.join(', '),
              variant: 'destructive',
            });
            return;
          }
          throw validationError;
        }
      } else {
        // Creazione nuova nota
        try {
          note = ModelFactory.createNote({
            id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: noteData.title,
            content: noteData.content,
            isPublic: noteData.isPublic,
            createdBy: noteData.createdBy,
            tags: noteData.tags,
            isPinned: noteData.isPinned,
            color: noteData.color,
          });
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Errore di Validazione',
              description: validationError.errors.join(', '),
              variant: 'destructive',
            });
            return;
          }
          throw validationError;
        }
      }

      await onSave(note);
      
      toast({
        title: editNote ? 'Nota aggiornata' : 'Nota creata',
        description: editNote ? 'La nota è stata aggiornata con successo!' : 'La nota è stata creata con successo!',
      });
      
      handleClose();
    } catch (error) {
      console.error('Errore nel salvare la nota:', error);
      toast({
        title: 'Errore',
        description: editNote ? 'Impossibile aggiornare la nota' : 'Impossibile creare la nota',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) { // Limite di 10 tag
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      // Rimuove l'ultimo tag se si preme backspace su input vuoto
      removeTag(tags[tags.length - 1]);
    }
  };

  const getSelectedColorName = () => {
    const selectedColor = noteColors.find(color => color.value === form.watch('color'));
    return selectedColor?.name || 'Predefinito';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-delft-blue flex items-center">
            {editNote ? (
              <>
                <Pin className="mr-3 h-6 w-6 text-burnt-sienna" />
                Modifica Nota
              </>
            ) : (
              <>
                <Plus className="mr-3 h-6 w-6 text-burnt-sienna" />
                Crea Nuova Nota
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Titolo */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Titolo della Nota *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Inserisci un titolo significativo..."
                      maxLength={100}
                      className="text-lg"
                    />
                  </FormControl>
                  <div className="text-xs text-gray-500 mt-1">
                    {field.value?.length || 0}/100 caratteri
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contenuto */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Contenuto *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Scrivi qui il contenuto della tua nota..."
                      rows={5}
                      className="resize-y min-h-[100px]"
                    />
                  </FormControl>
                  <div className="text-xs text-gray-500 mt-1">
                    {field.value?.length || 0} caratteri
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-delft-blue flex items-center">
                <Tag className="mr-2 h-4 w-4" />
                Tag {tags.length > 0 && <span className="ml-2 text-xs text-gray-500">({tags.length}/10)</span>}
              </label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Aggiungi un tag e premi Invio..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyPress}
                  className="flex-1"
                  maxLength={20}
                  disabled={tags.length >= 10}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTag}
                  disabled={!tagInput.trim() || tags.length >= 10}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="cursor-pointer hover:bg-red-50 transition-colors"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Colore Nota */}
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <Palette className="mr-2 h-4 w-4" />
                    Colore Nota: <span className="ml-2 font-normal text-gray-600">{getSelectedColorName()}</span>
                  </FormLabel>
                  <div className="grid grid-cols-4 gap-3">
                    {noteColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => field.onChange(color.value)}
                        className={`p-4 rounded-xl border-2 text-sm font-medium transition-all hover:scale-105 ${
                          field.value === color.value 
                            ? 'border-burnt-sienna ring-2 ring-burnt-sienna/30 shadow-md' 
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        style={{ 
                          backgroundColor: color.value,
                          color: color.textColor 
                        }}
                      >
                        {color.name}
                      </button>
                    ))}
                  </div>
                </FormItem>
              )}
            />

            {/* Opzioni della Nota */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fissa Nota */}
              <FormField
                control={form.control}
                name="isPinned"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium text-delft-blue flex items-center cursor-pointer">
                        <Pin className="mr-2 h-4 w-4" />
                        Fissa in Alto
                      </FormLabel>
                      <p className="text-xs text-gray-600">
                        Appare sempre in cima
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Visibilità */}
              <FormField
                control={form.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium text-delft-blue flex items-center cursor-pointer">
                        {field.value ? (
                          <>
                            <Globe className="mr-2 h-4 w-4 text-green-600" />
                            Pubblica
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4 text-orange-600" />
                            Privata
                          </>
                        )}
                      </FormLabel>
                      <p className="text-xs text-gray-600">
                        {field.value 
                          ? 'Visibile a tutti'
                          : 'Solo per te'}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Pulsanti Azione */}
            <div className="flex gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isLoading}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-burnt-sienna hover:bg-burnt-sienna/90 text-white font-semibold"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editNote ? 'Aggiorna Nota' : 'Crea Nota'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
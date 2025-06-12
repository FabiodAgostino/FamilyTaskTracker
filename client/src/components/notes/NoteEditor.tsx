import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Globe, Lock, Plus, Palette, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Note, ModelFactory, ValidationError } from '@/lib/models/types';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Tipo semplice per il form - la validazione è gestita dalle classi
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

  // Colori predefiniti per le note
  const noteColors = [
    { name: 'Default', value: '#F3F4F6', textColor: '#111827' },
    { name: 'Yellow', value: '#FEF3C7', textColor: '#92400E' },
    { name: 'Green', value: '#D1FAE5', textColor: '#065F46' },
    { name: 'Blue', value: '#DBEAFE', textColor: '#1E40AF' },
    { name: 'Purple', value: '#E9D5FF', textColor: '#7C2D12' },
    { name: 'Pink', value: '#FCE7F3', textColor: '#BE185D' },
    { name: 'Orange', value: '#FED7AA', textColor: '#C2410C' },
    { name: 'Red', value: '#FECACA', textColor: '#DC2626' },
  ];

  const form = useForm<NoteFormData>({
    // Nessun resolver - la validazione è gestita dalle classi
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

  useEffect(() => {
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
  }, [editNote, form, user]);

  const onSubmit = async (data: NoteFormData) => {
    setIsLoading(true);
    
    try {
      const noteData = {
        ...data,
        tags,
      };

      let note: Note;
      
      if (editNote) {
        // Aggiornamento nota esistente
        note = editNote;
        try {
          // Usa i metodi della classe che includono validazione automatica
          note.update(noteData.title, noteData.content);
          note.isPublic = noteData.isPublic;
          note.color = noteData.color;
          note.isPinned = noteData.isPinned;
          
          // Gestione tag con validazione
          note.tags = [];
          tags.forEach(tag => note.addTag(tag));
          
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Validation Error',
              description: validationError.errors.join(', '),
              variant: 'destructive',
            });
            return;
          }
          throw validationError;
        }
      } else {
        // Creazione nuova nota usando ModelFactory (con validazione automatica)
        try {
          note = ModelFactory.createNote({
            id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: noteData.title,
            content: noteData.content,
            isPublic: noteData.isPublic,
            createdBy: noteData.createdBy,
            tags: tags,
            isPinned: noteData.isPinned,
            color: noteData.color,
          });
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            toast({
              title: 'Validation Error',
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
        title: editNote ? 'Note updated' : 'Note created',
        description: editNote ? 'Note updated successfully!' : 'Note created successfully!',
      });
      
      onClose();
      form.reset();
      setTags([]);
      setTagInput('');
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: 'Error',
        description: editNote ? 'Failed to update note' : 'Failed to create note',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
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
    }
  };

 return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-delft-blue">
            {editNote ? 'Modifica Nota' : 'Crea Nota'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue">
                    Titolo *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Inserisci il titolo della nota"
                      maxLength={100}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      placeholder="Scrivi qui il contenuto della nota..."
                      rows={8}
                      className="resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <label className="text-sm font-medium text-delft-blue mb-2 block">Tag</label>
              <div className="flex space-x-2 mb-2">
                <Input
                  placeholder="Aggiungi tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleTagInputKeyPress}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTag}
                  disabled={!tagInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="cursor-pointer">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-gray-500 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                    <Palette className="mr-2 h-4 w-4" />
                    Colore Nota
                  </FormLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {noteColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => field.onChange(color.value)}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          field.value === color.value 
                            ? 'border-burnt-sienna ring-2 ring-burnt-sienna/20' 
                            : 'border-gray-200 hover:border-gray-300'
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

            <FormField
              control={form.control}
              name="isPinned"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                      <Pin className="mr-2 h-4 w-4" />
                      Fissa Nota
                    </FormLabel>
                    <p className="text-sm text-gray-600">
                      Le note fissate appariranno in cima all'elenco
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

            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                      {field.value ? (
                        <>
                          <Globe className="mr-2 h-4 w-4" />
                          Nota Pubblica
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Nota Privata
                        </>
                      )}
                    </FormLabel>
                    <p className="text-sm text-gray-600">
                      {field.value 
                        ? 'Questa nota sarà visibile a tutti i membri della famiglia'
                        : 'Questa nota sarà visibile solo a te'}
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

            <div className="flex space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-burnt-sienna hover:bg-burnt-sienna/90 text-white"
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
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Loader2, Globe, Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { insertNoteSchema, Note } from '@shared/schema';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: any) => Promise<void>;
  editNote?: Note | null;
}

export function NoteEditor({ isOpen, onClose, onSave, editNote }: NoteEditorProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const form = useForm({
    resolver: zodResolver(insertNoteSchema),
    defaultValues: {
      title: '',
      content: '',
      isPublic: false,
      createdBy: user?.username || '',
      tags: [],
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
      });
      setTags(editNote.tags);
    } else {
      form.reset({
        title: '',
        content: '',
        isPublic: false,
        createdBy: user?.username || '',
        tags: [],
      });
      setTags([]);
    }
  }, [editNote, form, user]);

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const noteData = {
        ...data,
        tags,
      };

      await onSave(noteData);
      
      toast({
        title: editNote ? 'Note updated' : 'Note created',
        description: editNote ? 'Note updated successfully!' : 'Note created successfully!',
      });
      
      onClose();
      form.reset();
      setTags([]);
      setTagInput('');
    } catch (error) {
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
            {editNote ? 'Edit Note' : 'Create Note'}
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
                    Title *
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter note title" />
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
                    Content *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Write your note content here..."
                      rows={8}
                      className="resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <label className="text-sm font-medium text-delft-blue mb-2 block">Tags</label>
              <div className="flex space-x-2 mb-2">
                <Input
                  placeholder="Add tags..."
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
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-delft-blue flex items-center">
                      {field.value ? (
                        <>
                          <Globe className="mr-2 h-4 w-4" />
                          Public Note
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Private Note
                        </>
                      )}
                    </FormLabel>
                    <p className="text-sm text-gray-600">
                      {field.value 
                        ? 'This note will be visible to all family members'
                        : 'This note will only be visible to you'
                      }
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-burnt-sienna hover:bg-burnt-sienna/90 text-white"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editNote ? 'Update Note' : 'Create Note'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

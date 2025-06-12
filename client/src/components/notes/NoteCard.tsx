import { useState } from 'react';
import { Edit, Trash2, Globe, Lock, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Note } from '@shared/schema';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();

  const canEdit = user?.username === note.createdBy || user?.role === 'admin';

  const handleDelete = async () => {
    try {
      await onDelete(note.id);
      toast({
        title: 'Note deleted',
        description: 'Note deleted successfully!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2 flex-1">
            <h3 className="font-semibold text-delft-blue truncate">{note.title}</h3>
            <div className="w-2 h-2 bg-cambridge-blue rounded-full flex-shrink-0"></div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Badge 
              variant={note.isPublic ? "default" : "secondary"}
              className={note.isPublic 
                ? "bg-cambridge-blue/20 text-cambridge-blue" 
                : "bg-burnt-sienna/20 text-burnt-sienna"
              }
            >
              {note.isPublic ? (
                <>
                  <Globe className="w-3 h-3 mr-1" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 mr-1" />
                  Private
                </>
              )}
            </Badge>
            {canEdit && (
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(note)}
                  className="text-gray-400 hover:text-cambridge-blue h-8 w-8 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-red-500 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{note.title}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
          {truncateContent(note.content)}
        </p>

        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {note.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center">
            <User className="mr-1 h-3 w-3" />
            By {note.createdBy}
          </div>
          <div className="flex items-center">
            <Clock className="mr-1 h-3 w-3" />
            {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

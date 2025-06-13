import { useState, useMemo } from 'react';
import { Plus, Search, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuthContext } from '@/contexts/AuthContext';
import { Note } from '@/lib/models/types';

export function NotesList() {
  const { user } = useAuthContext();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const { 
    data: notes, 
    loading, 
    add: addNote, 
    update: updateNote, 
    remove: deleteNote 
  } = useFirestore<Note>('notes');

  // Calculate statistics
  const stats = useMemo(() => {
    const total = notes.length;
    const publicNotes = notes.filter(note => note.isPublic).length;
    const privateNotes = notes.filter(note => !note.isPublic).length;
    const myNotes = notes.filter(note => note.createdBy === user?.username).length;
    
    return { total, publicNotes, privateNotes, myNotes };
  }, [notes, user]);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    let filtered = notes.filter(note => {
      // Check visibility (public notes for everyone, private only for creator + admin)
      const canView = note.isPublic || note.createdBy === user?.username || user?.role === 'admin';
      if (!canView) return false;

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(searchLower);
        const matchesContent = note.content.toLowerCase().includes(searchLower);
        const matchesTags = note.tags.some(tag => tag.toLowerCase().includes(searchLower));
        
        if (!matchesTitle && !matchesContent && !matchesTags) {
          return false;
        }
      }

      // Apply visibility filter
      if (filterBy === 'public' && !note.isPublic) return false;
      if (filterBy === 'private' && note.isPublic) return false;
      if (filterBy === 'mine' && note.createdBy !== user?.username) return false;

      return true;
    });

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'updated':
        filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      default: // newest
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  }, [notes, user, searchTerm, filterBy, sortBy]);

  const handleSaveNote = async (noteData: any) => {
    if (editNote) {
      await updateNote(editNote.id, noteData);
      setEditNote(null);
    } else {
      await addNote(noteData);
    }
    setIsEditorOpen(false);
  };

  const handleEditNote = (note: Note) => {
    setEditNote(note);
    setIsEditorOpen(true);
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditNote(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-sienna"></div>
        <span className="ml-3 text-delft-blue font-medium">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <StickyNote className="h-8 w-8 text-cambridge-blue" />
              <h1 className="text-3xl font-bold text-delft-blue">Note</h1>
            </div>
            {/* Statistics Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-cambridge-blue/10 text-cambridge-blue border-cambridge-blue/20">
                {stats.total} {stats.total === 1 ? 'nota' : 'note'}
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                {stats.publicNotes} {stats.publicNotes === 1 ? 'pubblica' : 'pubbliche'}
              </Badge>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                {stats.privateNotes} {stats.privateNotes === 1 ? 'privata' : 'private'}
              </Badge>
              {user?.role === 'admin' && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                  {stats.myNotes} {stats.myNotes === 1 ? 'mia' : 'mie'}
                </Badge>
              )}
            </div>
          </div>
          <Button
            onClick={() => setIsEditorOpen(true)}
            className="bg-cambridge-blue hover:bg-cambridge-blue/90 text-white dark:text-black shadow-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuova Nota
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
            {/* Extended Centered Search */}
            <div className="w-full md:flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cerca titoli, contenuto o tag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex gap-3 w-full md:w-auto">
              <Select value={filterBy} onValueChange={setFilterBy}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le Note</SelectItem>
                  <SelectItem value="public">Pubbliche</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="mine">Le Mie</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Più Recenti</SelectItem>
                  <SelectItem value="oldest">Più Vecchie</SelectItem>
                  <SelectItem value="title">Titolo A-Z</SelectItem>
                  <SelectItem value="updated">Aggiornate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.sort((a, b) => {
  return Number(b.isPinned) - Number(a.isPinned);
}).map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-delft-blue mb-2">Nessuna nota trovata</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || filterBy !== 'all' 
              ? 'Prova ad aggiustare i filtri di ricerca.'
              : 'Crea la tua prima nota per condividere pensieri e informazioni importanti.'
            }
          </p>
          <Button
            onClick={() => setIsEditorOpen(true)}
            className="bg-burnt-sienna hover:bg-burnt-sienna/90 text-white font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crea Prima Nota
          </Button>
        </div>
      )}

      {/* Note Editor Modal */}
      <NoteEditor
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        onSave={handleSaveNote}
        editNote={editNote}
      />
    </div>
  );
}
import { useState, useMemo } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
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

  // Filtra e ordina le note
  const filteredNotes = useMemo(() => {
    let filtered = notes.filter(note => {
      // Controlla visibilità (note pubbliche per tutti, private solo per creatore + admin)
      const canView = note.isPublic || note.createdBy === user?.username || user?.role === 'admin';
      if (!canView) return false;

      // Applica filtro ricerca
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(searchLower);
        const matchesContent = note.content.toLowerCase().includes(searchLower);
        const matchesTags = note.tags.some(tag => tag.toLowerCase().includes(searchLower));
        
        if (!matchesTitle && !matchesContent && !matchesTags) {
          return false;
        }
      }

      // Applica filtro visibilità
      if (filterBy === 'public' && !note.isPublic) return false;
      if (filterBy === 'private' && note.isPublic) return false;
      if (filterBy === 'mine' && note.createdBy !== user?.username) return false;

      return true;
    });

    // Applica ordinamento
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
        <span className="ml-3 text-delft-blue font-medium">Caricamento...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Sezione Intestazione */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-delft-blue">Note Familiari</h2>
            <p className="text-gray-600 mt-1">Condividi pensieri e informazioni importanti</p>
          </div>
          <Button
            onClick={() => setIsEditorOpen(true)}
            className="mt-4 sm:mt-0 bg-burnt-sienna hover:bg-burnt-sienna/90 text-white font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crea Nota
          </Button>
        </div>
      </div>

      {/* Filtri e Ricerca */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-delft-blue mb-2">Cerca Note</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cerca titoli, contenuti o tag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-delft-blue mb-2">Filtra per Visibilità</label>
              <Select value={filterBy} onValueChange={setFilterBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le Note</SelectItem>
                  <SelectItem value="public">Note Pubbliche</SelectItem>
                  <SelectItem value="private">Note Private</SelectItem>
                  <SelectItem value="mine">Le Mie Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-delft-blue mb-2">Ordina per</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Più Recenti</SelectItem>
                  <SelectItem value="oldest">Più Vecchie</SelectItem>
                  <SelectItem value="title">Titolo A-Z</SelectItem>
                  <SelectItem value="updated">Aggiornate di Recente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Griglia delle Note */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
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
              ? 'Prova a modificare la ricerca o i filtri.'
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

      {/* Modale Editor Note */}
      <NoteEditor
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        onSave={handleSaveNote}
        editNote={editNote}
      />
    </div>
  );
}

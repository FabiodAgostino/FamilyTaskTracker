// client/src/components/notes/NotesList.tsx - VERSIONE CORRETTA e AGGIORNATA
import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  Info, // ✅ NUOVO: Icona per il bottone del popup badge
  Globe, // Import aggiunto per l'icona
  Lock,  // Import aggiunto per l'icona
  User,  // Import aggiunto per l'icona
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog, // ✅ NUOVO: Componente Dialog per il popup
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'; // Assicurati di avere questi import
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { useAuthContext } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { Note } from '@/lib/models/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { NoteDetail } from './NoteDetail';
import { FaIdBadge, FaNoteSticky } from 'react-icons/fa6';
import { LoadingScreen, useLoadingTransition } from '../ui/loading-screen';
import { LuChartColumnBig } from "react-icons/lu";



export function NotesList() {
  const { user } = useAuthContext();
  const isMobile = useIsMobile();

  // Stato per filtri collassabili (chiusi di default su mobile)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(!isMobile);

  // ✅ NUOVO: Stato per il popup dei badge
  const [isBadgesPopupOpen, setIsBadgesPopupOpen] = useState(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Aggiorna stato filtri quando cambia mobile/desktop
  React.useEffect(() => {
    setIsFiltersExpanded(!isMobile);
  }, [isMobile]);

  const {
    data: notes,
    loading,
    add: addNote,
    update: updateNote,
    remove: deleteNote
  } = useFirestore<Note>('notes');

  const { showLoading } = useLoadingTransition(loading, notes);

  // Statistiche e filtri
  const { filteredNotes, stats } = useMemo(() => {
    const visibleNotes = notes.filter(note =>
      note.isPublic || note.createdBy === user?.username || user?.role === 'admin'
    );

    const stats = {
      total: visibleNotes.length,
      publicNotes: visibleNotes.filter(note => note.isPublic).length,
      privateNotes: visibleNotes.filter(note => !note.isPublic).length,
      // Solo mostra 'myNotes' se l'utente è loggato e non è un admin, o se è un admin per le sue note
      myNotes: visibleNotes.filter(note => note.createdBy === user?.username).length,
    };

    let filtered = visibleNotes.filter(note => {
      const matchesSearch = !searchTerm ||
        note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesFilter = filterBy === 'all' ||
        (filterBy === 'public' && note.isPublic) ||
        (filterBy === 'private' && !note.isPublic) ||
        (filterBy === 'mine' && note.createdBy === user?.username);

      return matchesSearch && matchesFilter;
    });

    // Ordinamento
    filtered.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'updated') return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      return 0;
    });

    return { filteredNotes: filtered, stats };
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
  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
    setIsDetailModalOpen(true);
  };

  // Handler per chiudere il dettaglio
  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedNote(null);
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditNote(null);
  };

  const toggleFilters = () => setIsFiltersExpanded(!isFiltersExpanded);

  return (
    <LoadingScreen
      isVisible={showLoading}
      title="Caricamento Note"
      subtitle="Recupero delle note..."
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Header Section - RESPONSIVE */}
        <div className={cn("mb-6", isMobile ? "space-y-4" : "mb-8")}>
          <div className={cn(
            "flex items-start justify-between",
            isMobile ? "flex-col space-y-3" : "flex-row items-center"
          )}>
            <div className={cn("flex items-center gap-3", isMobile ? "w-full" : "")}> {/* Modificato: aggiunto flex items-center gap-3 */}
              <FaNoteSticky className="h-8 w-8 text-cambridge-newStyle" />
              <h1 className="text-3xl font-bold text-delft-blue">Note</h1>

              {/* Bottoni "Info" e "Plus" solo su mobile, spostati a destra */}
              {isMobile && (
                <div className="flex items-center gap-2 ml-auto"> {/* Modificato: ml-auto per spingere a destra */}
                  <Button
                    onClick={() => setIsBadgesPopupOpen(true)} // ✅ NUOVO: Apre il popup dei badge
                    size="sm"
                    variant="outline"
                    className="border-cambridge-newStyle"
                  >
                    <LuChartColumnBig className="h-4 w-4 text-cambridge-newStyle" />
                  </Button>
                  <Button
                    onClick={() => setIsEditorOpen(true)}
                    size="sm"
                    className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white p-2"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Statistics Badges - Con più spazio in mobile (VISIBILI SOLO SU DESKTOP) */}
            {!isMobile && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-cambridge-newStyle/10 text-cambridge-newStyle border-cambridge-newStyle/20">
                  {stats.total} {stats.total === 1 ? 'nota' : 'note'}
                </Badge>
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                  {stats.publicNotes} {stats.publicNotes === 1 ? 'pubblica' : 'pubbliche'}
                </Badge>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                  {stats.privateNotes} {stats.privateNotes === 1 ? 'privata' : 'private'}
                </Badge>
                {stats.myNotes > 0 && ( // Mostra solo se ci sono note dell'utente
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                    {stats.myNotes} {stats.myNotes === 1 ? 'mia' : 'mie'}
                  </Badge>
                )}
              </div>
            )}

            {/* Bottone grande solo su schermi grandi */}
            {!isMobile && (
              <Button
                onClick={() => setIsEditorOpen(true)}
                className="bg-cambridge-newStyle hover:bg-cambridge-newStyle/90 text-white dark:text-black shadow-lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuova Nota
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters - COLLASSABILI */}
        <Card className={cn("mb-6", isMobile ? "mb-4" : "")}>
          <CardContent className={cn("p-4", isMobile ? "p-3" : "")}>

            {/* Header dei filtri su mobile */}
            {isMobile && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-cambridge-newStyle" />
                  <span className="font-medium text-sm">Filtri di ricerca</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFilters}
                  className="p-1"
                >
                  {isFiltersExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            {/* Contenuto filtri - Collassabile su mobile */}
            <div className={cn(
              isMobile && !isFiltersExpanded ? "hidden" : "block",
              "space-y-4"
            )}>
              <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
                {/* Extended Centered Search */}
                <div className="w-full md:flex-1 max-w-2xl space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Ricerca
                  </label>
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
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Filtro
                    </label>
                    <Select value={filterBy} onValueChange={setFilterBy}>
                      <SelectTrigger className="w-full md:w-40">
                        <SelectValue placeholder="Tutte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte le Note</SelectItem>
                        <SelectItem value="public">Pubbliche</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="mine">Le Mie</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Ordinamento
                    </label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full md:w-40">
                        <SelectValue placeholder="Ordina per" />
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
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes Grid - Con padding responsivo */}
        <div className={cn(isMobile ? "px-1" : "")}>
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
                  onClick={handleNoteClick}
                />
              )
              )}
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
                className="bg-burnt-newStyle hover:bg-burnt-newStyle/90 text-white font-semibold"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crea Prima Nota
              </Button>
            </div>
          )}
        </div>

        {/* Note Editor Modal */}
        <NoteEditor
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
          onSave={handleSaveNote}
          editNote={editNote}
        />
        <NoteDetail
          note={selectedNote}
          isOpen={isDetailModalOpen}
          onUpdateContent={ async (note, content) => {note.content=content; await updateNote(note.id, note)}}
          onClose={handleCloseDetail}
          onEdit={(note) => {
            handleCloseDetail(); // Chiudi il dettaglio
            handleEditNote(note); // Apri l'editor
          }}
        />

        {/* ✅ NUOVO: Modale per la visualizzazione di tutti i badge in small view */}
        <Dialog open={isBadgesPopupOpen} onOpenChange={setIsBadgesPopupOpen}>
          <DialogContent className="sm:max-w-md p-6"> {/* Stile migliorato */}
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-semibold text-delft-blue">Statistiche Note</DialogTitle>
              <DialogDescription className="text-gray-600">
                Riepilogo rapido e completo delle note.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-3 py-4 border-t border-b border-gray-200 dark:border-gray-700"> {/* Bordi per separare */}
              <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-cambridge-newStyle/10 text-cambridge-newStyle border-cambridge-newStyle/20">
                <FaNoteSticky className="w-4 h-4 mr-2" /> {stats.total} {stats.total === 1 ? 'nota' : 'note'} totali
              </Badge>
              <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-green-100 text-green-700 border-green-200">
                <Globe className="w-4 h-4 mr-2" /> {stats.publicNotes} {stats.publicNotes === 1 ? 'pubblica' : 'pubbliche'}
              </Badge>
              <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-orange-100 text-orange-700 border-orange-200">
                <Lock className="w-4 h-4 mr-2" /> {stats.privateNotes} {stats.privateNotes === 1 ? 'privata' : 'private'}
              </Badge>
              {stats.myNotes > 0 && (
                <Badge variant="secondary" className="flex items-center justify-center p-2 text-sm font-medium bg-purple-100 text-purple-700 border-purple-200">
                  <User className="w-4 h-4 mr-2" /> {stats.myNotes} {stats.myNotes === 1 ? 'mia' : 'mie'}
                </Badge>
              )}
            </div>
            <div className="pt-4 flex justify-end">
              <Button onClick={() => setIsBadgesPopupOpen(false)} variant="secondary">
                Chiudi
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </LoadingScreen>
  );
}
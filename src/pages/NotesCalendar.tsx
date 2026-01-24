import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NotesCalendarView } from '@/components/NotesCalendarView';
import { Calendar as CalendarIcon, Plus, StickyNote, FileText, FileEdit, Pen, Filter, FileCode, GitBranch, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoteEditor } from '@/components/NoteEditor';
import { Note, Folder, NoteType } from '@/types/note';
import { BottomNavigation } from '@/components/BottomNavigation';
import { format, isSameDay } from 'date-fns';
import { NoteCard } from '@/components/NoteCard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import appLogo from '@/assets/app-logo.png';
import { useDarkMode } from '@/hooks/useDarkMode';
import { loadNotesFromDB, saveNotesToDB, saveNoteToDBSingle, deleteNoteFromDB } from '@/utils/noteStorage';

const NotesCalendar = () => {
  const { t } = useTranslation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedDateNotes, setSelectedDateNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [defaultType, setDefaultType] = useState<NoteType>('regular');
  const [selectedNoteTypes, setSelectedNoteTypes] = useState<NoteType[]>([
    'sticky', 'lined', 'regular', 'sketch', 'code', 'mindmap'
  ]);
  const [folders, setFolders] = useState<Folder[]>([]);
  
  useEffect(() => {
    const loadFolders = async () => {
      const { getSetting } = await import('@/utils/settingsStorage');
      const saved = await getSetting<Folder[]>('folders', []);
      setFolders(saved);
    };
    loadFolders();
  }, []);

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const loadedNotes = await loadNotesFromDB();
        setNotes(loadedNotes);
      } catch (error) {
        console.error('Error loading notes:', error);
      }
    };
    loadNotes();
  }, []);

  useEffect(() => {
    if (date) {
      const notesForDate = notes.filter(note =>
        isSameDay(new Date(note.createdAt), date) &&
        selectedNoteTypes.includes(note.type)
      );
      setSelectedDateNotes(notesForDate);
    } else {
      setSelectedDateNotes([]);
    }
  }, [date, notes, selectedNoteTypes]);

  const handleSaveNote = async (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingNote) {
      // Update existing note - preserve original createdAt
      const updatedNote: Note = {
        ...editingNote,
        ...noteData,
        createdAt: editingNote.createdAt,
        updatedAt: new Date(),
      };
      const updatedNotes = notes.map(n => n.id === editingNote.id ? updatedNote : n);
      setNotes(updatedNotes);
      await saveNoteToDBSingle(updatedNote);
    } else {
      // Create new note with selected date
      const newNote: Note = {
        ...noteData,
        id: Date.now().toString(),
        title: noteData.title || `Note - ${format(date || new Date(), 'MMM dd, yyyy')}`,
        createdAt: date || new Date(),
        updatedAt: date || new Date(),
      };
      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      await saveNoteToDBSingle(newNote);
    }
    setIsEditorOpen(false);
    setEditingNote(null);
    // Trigger calendar refresh
    window.dispatchEvent(new Event('notesUpdated'));
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleCreateNote = (type: NoteType) => {
    setDefaultType(type);
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const toggleNoteType = (type: NoteType) => {
    setSelectedNoteTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const NOTE_TYPE_LABELS: Record<NoteType, { label: string; icon: any }> = {
    sticky: { label: t('notesMenu.sticky'), icon: StickyNote },
    lined: { label: t('notesMenu.lined'), icon: FileText },
    regular: { label: t('notesMenu.regular'), icon: FileEdit },
    sketch: { label: t('notesMenu.sketch'), icon: Pen },
    code: { label: t('notesMenu.code'), icon: FileCode },
    mindmap: { label: t('notesMenu.mindMap'), icon: GitBranch },
    expense: { label: t('notesMenu.expense'), icon: FileText },
  };

  const handleDeleteNote = async (noteId: string) => {
    const updatedNotes = notes.filter(n => n.id !== noteId);
    setNotes(updatedNotes);
    await deleteNoteFromDB(noteId);
    // Trigger calendar refresh
    window.dispatchEvent(new Event('notesUpdated'));
  };

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-background pb-16 sm:pb-20">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-2 xs:px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between gap-1 xs:gap-2">
            <div className="flex items-center gap-1.5 xs:gap-2 min-w-0 flex-shrink-0">
              <img src={appLogo} alt="Npd" className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 flex-shrink-0" />
              <h1 className="text-base xs:text-lg sm:text-xl font-bold truncate">{t('nav.calendar')}</h1>
            </div>
            <div className="flex items-center gap-0.5 xs:gap-1 flex-shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleDarkMode}
                className="h-7 w-7 xs:h-8 xs:w-8 sm:h-9 sm:w-9 touch-target"
                title="Toggle theme"
              >
                {isDarkMode ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 xs:h-8 xs:w-8 sm:h-9 sm:w-9 touch-target">
                    <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 z-50 bg-card max-h-[70vh] overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <DropdownMenuLabel>{t('notesMenu.filterByType')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(Object.keys(NOTE_TYPE_LABELS) as NoteType[]).map((type) => {
                    const { label, icon: Icon } = NOTE_TYPE_LABELS[type];
                    return (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={selectedNoteTypes.includes(type)}
                        onCheckedChange={() => toggleNoteType(type)}
                        className="gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 xs:px-3 sm:px-4 py-3 xs:py-4 sm:py-6 pb-28 xs:pb-32">
        <div className="max-w-md mx-auto space-y-6">
          <NotesCalendarView
            selectedDate={date}
            onDateSelect={setDate}
          />

          {selectedDateNotes.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="text-lg font-semibold text-foreground">
                {t('notesMenu.notesForDate', { date: format(date || new Date(), 'MMMM dd, yyyy') })}
              </h2>
              {selectedDateNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={handleEditNote}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="fixed bottom-20 left-4 right-4 z-30 h-12 text-base font-semibold"
            size="lg"
            disabled={!date}
          >
            <Plus className="h-5 w-5" />
            {t('notesMenu.addNote')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="mb-2 w-48 z-50 bg-card">
          <DropdownMenuItem onClick={() => handleCreateNote('sticky')} className="gap-2">
            <StickyNote className="h-4 w-4" />
            {t('notesMenu.stickyNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('lined')} className="gap-2">
            <FileText className="h-4 w-4" />
            {t('notesMenu.linedNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('regular')} className="gap-2">
            <FileEdit className="h-4 w-4" />
            {t('notesMenu.regularNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('sketch')} className="gap-2">
            <Pen className="h-4 w-4" />
            {t('notesMenu.sketchNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('code')} className="gap-2">
            <FileCode className="h-4 w-4" />
            {t('notesMenu.codeNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('mindmap')} className="gap-2">
            <GitBranch className="h-4 w-4" />
            {t('notesMenu.mindMap')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NoteEditor
        note={editingNote}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
        defaultType={defaultType}
        returnTo="/calendar"
      />

      <BottomNavigation />
    </div>
  );
};

export default NotesCalendar;

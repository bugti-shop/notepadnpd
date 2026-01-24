import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Note, NoteType, Folder } from '@/types/note';
import { NoteCard } from '@/components/NoteCard';
import { NoteEditor } from '@/components/NoteEditor';
import { BottomNavigation } from '@/components/BottomNavigation';
import { PersonalizedTips } from '@/components/PersonalizedTips';
import { FolderManager } from '@/components/FolderManager';
import { SyncBadge } from '@/components/SyncStatusIndicator';
import { MasonryNotesGrid } from '@/components/MasonryNotesGrid';
import { VirtualizedNotesGrid, VirtualizedNotesList, shouldVirtualizeNotes } from '@/components/VirtualizedNotesGrid';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { syncManager } from '@/utils/syncManager';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, StickyNote, FileText, FileEdit, Pen, ListTodo, Bell, Clock, Repeat, FileCode, GitBranch, Sun, Moon, Receipt, Star, ArrowUpDown, MoreVertical, FolderPlus, CheckSquare, Trash2, Archive, X, RotateCcw, Copy, Folder as FolderIcon } from 'lucide-react';
import { getAllUpcomingReminders } from '@/utils/noteNotifications';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import appLogo from '@/assets/app-logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getSuggestedFolders } from '@/utils/personalization';
import { triggerHaptic } from '@/utils/haptics';
import { loadNotesFromDB, saveNoteToDBSingle, deleteNoteFromDB, migrateNotesToIndexedDB, saveNotesToDB } from '@/utils/noteStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { logActivity } from '@/utils/activityLogger';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<NoteType>('regular');
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [upcomingReminders, setUpcomingReminders] = useState<any[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'type'>('date');
  const [filterByType, setFilterByType] = useState<NoteType | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'notes' | 'trash' | 'archive'>('notes');
  const [isGridView, setIsGridView] = useState(false);
  const [showBulkFolderSheet, setShowBulkFolderSheet] = useState(false);
  const { isOnline, isSyncing, hasError, lastSync } = useRealtimeSync();
  const syncEnabled = syncManager.isSyncEnabled();

  // Load all preferences from IndexedDB
  useEffect(() => {
    const loadPreferences = async () => {
      const [gridViewPref, sortByPref, filterByTypePref, viewModePref] = await Promise.all([
        getSetting<boolean>('notesGridView', false),
        getSetting<'date' | 'title' | 'type'>('notesSortBy', 'date'),
        getSetting<NoteType | null>('notesFilterByType', null),
        getSetting<'notes' | 'trash' | 'archive'>('notesViewMode', 'notes'),
      ]);
      setIsGridView(gridViewPref);
      setSortBy(sortByPref);
      setFilterByType(filterByTypePref);
      setViewMode(viewModePref);
      
      // Log app open activity
      logActivity('app_open', 'User opened Notes home page');
    };
    loadPreferences();
  }, []);

  // Toggle grid view and save preference
  const handleToggleGridView = async () => {
    const newValue = !isGridView;
    setIsGridView(newValue);
    await setSetting('notesGridView', newValue);
    logActivity('grid_view_toggle', `Switched to ${newValue ? 'grid' : 'list'} view`);
  };
  
  // Persist sort/filter/view mode changes
  useEffect(() => { setSetting('notesSortBy', sortBy); }, [sortBy]);
  useEffect(() => { setSetting('notesFilterByType', filterByType); }, [filterByType]);
  useEffect(() => { setSetting('notesViewMode', viewMode); }, [viewMode]);

  // Check onboarding status on mount
  useEffect(() => {
    // Initialize folders from personalized suggestions
    const loadFolders = async () => {
      const savedFolders = await getSetting<Folder[] | null>('folders', null);
      if (savedFolders) {
        setFolders(savedFolders.map((f: Folder) => ({
          ...f,
          createdAt: new Date(f.createdAt),
        })));
      } else {
        const answers = await getSetting<any>('onboardingAnswers', null);
        if (answers) {
          const suggestedFolders = getSuggestedFolders(answers);
          const initialFolders: Folder[] = suggestedFolders.map((name, index) => ({
            id: `folder-${Date.now()}-${index}`,
            name,
            isDefault: false,
            createdAt: new Date(),
            color: ['#3c78f0', '#10b981', '#f59e0b'][index % 3],
          }));
          setFolders(initialFolders);
          setSetting('folders', initialFolders);
        }
      }
    };
    
    loadFolders();
    
    // Listen for folder updates from NoteEditor
    const handleFoldersUpdated = () => loadFolders();
    window.addEventListener('foldersUpdated', handleFoldersUpdated);
    return () => window.removeEventListener('foldersUpdated', handleFoldersUpdated);
  }, []);

  // Load notes from IndexedDB (unified storage)
  useEffect(() => {
    const loadNotes = async () => {
      try {
        // Ensure migration happens first
        await migrateNotesToIndexedDB();
        // Load from IndexedDB
        const loadedNotes = await loadNotesFromDB();
        setNotes(loadedNotes);
      } catch (error) {
        console.error('Error loading notes:', error);
      }
    };
    loadNotes();
  }, []);

  useEffect(() => {
    setSetting('folders', folders);
  }, [folders]);

  useEffect(() => {
    const loadReminders = async () => {
      const reminders = await getAllUpcomingReminders();
      const remindersWithNotes = reminders.slice(0, 3).map(reminder => ({
        ...reminder,
        note: notes.find(note => note.id === reminder.noteId),
      }));
      setUpcomingReminders(remindersWithNotes);
    };
    loadReminders();
  }, [notes]);

  // Auto-delete trash items older than 30 days
  useEffect(() => {
    const cleanupOldTrash = () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      setNotes(prev => {
        const filtered = prev.filter(note => {
          if (note.isDeleted && note.deletedAt) {
            const deletedDate = new Date(note.deletedAt);
            return deletedDate > thirtyDaysAgo;
          }
          return true;
        });
        if (filtered.length !== prev.length) {
          console.log(`Auto-deleted ${prev.length - filtered.length} old trash items`);
        }
        return filtered;
      });
    };
    
    // Run on mount and every hour
    cleanupOldTrash();
    const interval = setInterval(cleanupOldTrash, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveNote = (note: Note) => {
    setNotes((prev) => {
      const existing = prev.find((n) => n.id === note.id);
      if (existing) {
        return prev.map((n) => (n.id === note.id ? note : n));
      }
      // Auto-assign to default folder based on note type
      const noteWithFolder = { ...note, folderId: note.folderId || note.type };
      return [noteWithFolder, ...prev];
    });
  };

  const handleDeleteNote = (id: string) => {
    // Move to trash instead of permanent delete
    setNotes((prev) => {
      const updatedNotes = prev.map((n) => 
        n.id === id 
          ? { ...n, isDeleted: true, deletedAt: new Date() } 
          : n
      );
      // Persist to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    logActivity('note_delete', 'Note moved to trash', { entityId: id, entityType: 'note' });
  };

  const handleArchiveNote = (id: string) => {
    setNotes((prev) => {
      const updatedNotes = prev.map((n) => 
        n.id === id 
          ? { ...n, isArchived: true, archivedAt: new Date() } 
          : n
      );
      // Persist to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    logActivity('note_archive', 'Note archived', { entityId: id, entityType: 'note' });
  };

  const handleRestoreFromTrash = (id: string) => {
    setNotes((prev) => {
      const updatedNotes = prev.map((n) => 
        n.id === id 
          ? { ...n, isDeleted: false, deletedAt: undefined } 
          : n
      );
      // Persist to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    logActivity('note_restore', 'Note restored from trash', { entityId: id, entityType: 'note' });
  };

  const handleRestoreFromArchive = (id: string) => {
    setNotes((prev) => {
      const updatedNotes = prev.map((n) => 
        n.id === id 
          ? { ...n, isArchived: false, archivedAt: undefined } 
          : n
      );
      // Persist to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    logActivity('note_restore', 'Note restored from archive', { entityId: id, entityType: 'note' });
  };

  const handlePermanentDelete = async (id: string) => {
    // Delete from IndexedDB first
    await deleteNoteFromDB(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    logActivity('note_delete', 'Note permanently deleted', { entityId: id, entityType: 'note' });
  };

  const handleEmptyTrash = () => {
    setNotes((prev) => {
      const updatedNotes = prev.filter((n) => !n.isDeleted);
      // Persist to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    logActivity('note_delete', 'Trash emptied');
  };

  const handleDuplicateNote = (noteId: string) => {
    const noteToDuplicate = notes.find(n => n.id === noteId);
    if (!noteToDuplicate) return;
    
    const duplicatedNote: Note = {
      ...noteToDuplicate,
      id: Date.now().toString(),
      title: `${noteToDuplicate.title || 'Untitled'} (Copy)`,
      isPinned: false,
      pinnedOrder: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setNotes(prev => [duplicatedNote, ...prev]);
  };

  const handleTogglePin = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes((prev) => {
      const updatedNotes = prev.map((n) => {
        if (n.id === noteId) {
          return {
            ...n,
            isPinned: !n.isPinned,
            pinnedOrder: !n.isPinned ? Date.now() : undefined,
          };
        }
        return n;
      });
      // Save to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
  };

  const handleToggleFavorite = (noteId: string) => {
    setNotes((prev) => {
      const updatedNotes = prev.map((n) => {
        if (n.id === noteId) {
          return { ...n, isFavorite: !n.isFavorite };
        }
        return n;
      });
      // Save to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
  };

  const handleDragStart = (e: React.DragEvent, noteId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', noteId);
    setDraggedNoteId(noteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    setDraggedNoteId(null);
  };

  const handleDrop = (e: React.DragEvent, targetNoteId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/html');

    if (draggedId === targetNoteId) return;

    const draggedNote = notes.find(n => n.id === draggedId);
    const targetNote = notes.find(n => n.id === targetNoteId);

    if (!draggedNote || !targetNote) return;
    if (draggedNote.isPinned !== targetNote.isPinned) return;

    setNotes((prev) => {
      const updatedNotes = [...prev];
      const draggedIndex = updatedNotes.findIndex(n => n.id === draggedId);
      const targetIndex = updatedNotes.findIndex(n => n.id === targetNoteId);

      const [removed] = updatedNotes.splice(draggedIndex, 1);
      updatedNotes.splice(targetIndex, 0, removed);

      if (draggedNote.isPinned) {
        updatedNotes.forEach((note, idx) => {
          if (note.isPinned) {
            note.pinnedOrder = idx;
          }
        });
      }

      // Save to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
  };

  const handleCreateNote = (type: NoteType) => {
    setDefaultType(type);
    setSelectedNote(null);
    setIsEditorOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setIsEditorOpen(true);
  };

  const handleCreateFolder = (name: string, color: string) => {
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name,
      isDefault: false,
      createdAt: new Date(),
      color,
    };
    setFolders(prev => [...prev, newFolder]);
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    setNotes(prev => prev.map(n => n.folderId === folderId ? { ...n, folderId: undefined } : n));
  };

  const handleEditFolder = (folderId: string, name: string) => {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
  };

  const handleDropOnFolder = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    if (!draggedNoteId) return;

    setNotes(prev => prev.map(n =>
      n.id === draggedNoteId ? { ...n, folderId: targetFolderId || undefined } : n
    ));
    setDraggedNoteId(null);
  };

  const handleHideNote = (noteId: string) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, isHidden: true } : n));
  };

  const handleBulkHideNotes = (noteIds: string[]) => {
    setNotes(prev => prev.map(n => noteIds.includes(n.id) ? { ...n, isHidden: true } : n));
  };

  const handleProtectNote = (noteId: string) => {
    // Protection is handled via NoteProtectionSheet - this just triggers the dialog
    // For now, we'll store a flag that the note needs protection UI
    console.log('Protect note:', noteId);
  };

  let allFilteredNotes = notes.filter(
    (note) =>
      !note.isDeleted && 
      !note.isArchived &&
      !note.isHidden && // Hide hidden notes from main view
      (note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.metaDescription && note.metaDescription.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  // Filter by folder
  if (selectedFolderId !== null) {
    allFilteredNotes = allFilteredNotes.filter(note => note.folderId === selectedFolderId);
  }

  // Filter favorites only
  if (showFavoritesOnly) {
    allFilteredNotes = allFilteredNotes.filter(note => note.isFavorite);
  }

  // Filter by note type
  if (filterByType) {
    allFilteredNotes = allFilteredNotes.filter(note => note.type === filterByType);
  }

  // Bulk selection handlers
  const handleToggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  const handleBulkDelete = () => {
    setNotes(prev => {
      const updatedNotes = prev.map(n =>
        selectedNoteIds.includes(n.id)
          ? { ...n, isDeleted: true, deletedAt: new Date() }
          : n
      );
      // Persist to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    setSelectedNoteIds([]);
    setIsSelectionMode(false);
  };

  const handleBulkArchive = () => {
    setNotes(prev => {
      const updatedNotes = prev.map(n =>
        selectedNoteIds.includes(n.id)
          ? { ...n, isArchived: true, archivedAt: new Date() }
          : n
      );
      // Persist to IndexedDB
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    setSelectedNoteIds([]);
    setIsSelectionMode(false);
  };

  // New bulk operations
  const handleBulkFavorite = () => {
    setNotes(prev => {
      const updatedNotes = prev.map(n =>
        selectedNoteIds.includes(n.id)
          ? { ...n, isFavorite: true }
          : n
      );
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    setSelectedNoteIds([]);
    setIsSelectionMode(false);
  };

  const handleBulkDuplicate = () => {
    setNotes(prev => {
      const duplicates = selectedNoteIds
        .map(id => prev.find(n => n.id === id))
        .filter(Boolean)
        .map(note => ({
          ...note!,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: `${note!.title || 'Untitled'} (Copy)`,
          isPinned: false,
          pinnedOrder: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      const updatedNotes = [...duplicates, ...prev];
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    setSelectedNoteIds([]);
    setIsSelectionMode(false);
  };

  const handleBulkMoveToFolder = (folderId: string | null) => {
    setNotes(prev => {
      const updatedNotes = prev.map(n =>
        selectedNoteIds.includes(n.id)
          ? { ...n, folderId: folderId || undefined }
          : n
      );
      saveNotesToDB(updatedNotes);
      return updatedNotes;
    });
    setSelectedNoteIds([]);
    setIsSelectionMode(false);
    setShowBulkFolderSheet(false);
  };

  const handleSelectAll = () => {
    setSelectedNoteIds(filteredNotes.map(n => n.id));
  };

  const handleCancelSelection = () => {
    setSelectedNoteIds([]);
    setIsSelectionMode(false);
  };

  const filteredNotes = [...allFilteredNotes].sort((a, b) => {
    // Pinned notes always first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.isPinned && b.isPinned) {
      return (a.pinnedOrder || 0) - (b.pinnedOrder || 0);
    }
    
    // Then sort by selected option
    switch (sortBy) {
      case 'title':
        return (a.title || '').localeCompare(b.title || '');
      case 'type':
        return a.type.localeCompare(b.type);
      case 'date':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-background pb-20 sm:pb-24">
      <header 
        className="border-b sticky top-0 bg-background z-10"
        style={{
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
        }}
      >
        <div className="container mx-auto px-2 xs:px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between mb-2 xs:mb-3 sm:mb-4 gap-1 xs:gap-2">
            <div className="flex items-center gap-1.5 xs:gap-2 min-w-0 flex-shrink-0">
              <img src={appLogo} alt="Npd" className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 flex-shrink-0" style={{ minWidth: '24px', minHeight: '24px' }} />
              <h1 className="text-base xs:text-lg sm:text-xl font-bold">Npd</h1>
            </div>
            <div className="flex items-center gap-0.5 xs:gap-1 sm:gap-2 flex-shrink-0">
              {syncEnabled && (
                <SyncBadge
                  isOnline={isOnline}
                  isSyncing={isSyncing}
                  lastSync={lastSync}
                  hasError={hasError}
                />
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleDarkMode}
                className="h-7 w-7 xs:h-8 xs:w-8 sm:h-9 sm:w-9 hover:bg-transparent active:bg-transparent touch-target"
                title="Toggle theme"
              >
                {isDarkMode ? <Sun className="h-4 w-4 xs:h-4 xs:w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 xs:h-4 xs:w-4 sm:h-5 sm:w-5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  await triggerHaptic('light');
                  navigate('/todo/today');
                }}
                className="h-7 w-7 xs:h-8 xs:w-8 sm:h-9 sm:w-9 hover:bg-transparent active:bg-transparent touch-target"
                title="Switch to To-Do"
              >
                <ListTodo className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>
          </div>

          <div className="flex gap-1.5 xs:gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 xs:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 xs:h-4 xs:w-4 text-muted-foreground" />
              <Input
                placeholder={t('notes.searchNotes')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 xs:pl-10 bg-secondary/50 border-none text-xs xs:text-sm sm:text-base h-9 xs:h-10"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 xs:px-3 sm:px-4 py-2 xs:py-3">
        <PersonalizedTips />

        {/* Upcoming Reminders Section */}
        {upcomingReminders.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                {t('notes.upcomingReminders')}
              </h2>
            </div>
            <div className="space-y-2">
              {upcomingReminders.map((reminder) => (
                <Card
                  key={reminder.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    const note = notes.find(n => n.id === reminder.noteId);
                    if (note) handleEditNote(note);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate mb-1">
                          {reminder.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            {isToday(reminder.schedule)
                              ? `${t('common.today')} ${format(reminder.schedule, 'h:mm a')}`
                              : isTomorrow(reminder.schedule)
                              ? `${t('common.tomorrow')} ${format(reminder.schedule, 'h:mm a')}`
                              : format(reminder.schedule, 'MMM dd, h:mm a')}
                          </Badge>
                          {reminder.recurring && reminder.recurring !== 'none' && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Repeat className="h-3 w-3" />
                              {reminder.recurring}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {reminder.note && (
                        <Badge className="capitalize text-xs">
                          {reminder.note.type}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <FolderManager
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onEditFolder={handleEditFolder}
          onDropOnFolder={handleDropOnFolder}
          notes={notes}
          onAddNotesToFolder={(noteIds, folderId) => {
            setNotes(prev => prev.map(note =>
              noteIds.includes(note.id) ? { ...note, folderId } : note
            ));
          }}
          onRemoveNoteFromFolder={(noteId) => {
            setNotes(prev => prev.map(note =>
              note.id === noteId ? { ...note, folderId: undefined } : note
            ));
          }}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavoritesOnly={() => setShowFavoritesOnly(!showFavoritesOnly)}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          filterByType={filterByType}
          onFilterByTypeChange={setFilterByType}
          onEnterSelectionMode={() => setIsSelectionMode(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          trashedNotesCount={notes.filter(n => n.isDeleted).length}
          archivedNotesCount={notes.filter(n => n.isArchived && !n.isDeleted).length}
          isGridView={isGridView}
          onToggleGridView={handleToggleGridView}
        />

        {/* Bulk Selection Mode Bar */}
        {isSelectionMode && (
          <div className="sticky top-[120px] z-10 bg-primary text-primary-foreground p-3 rounded-lg mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCancelSelection}
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('common.cancel')}
                </Button>
                <span className="text-sm font-medium">
                  {selectedNoteIds.length} {t('actions.selectedCount')}
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSelectAll}
              >
                {t('common.selectAll')}
              </Button>
            </div>
            
            {/* Action buttons row */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {/* Move to Folder */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={selectedNoteIds.length === 0}
                    className="shrink-0"
                  >
                    <FolderIcon className="h-4 w-4 mr-1" />
                    Move
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => handleBulkMoveToFolder(null)}>
                    <FolderIcon className="h-4 w-4 mr-2" />
                    All Notes (No Folder)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {folders.map((folder) => (
                    <DropdownMenuItem 
                      key={folder.id} 
                      onClick={() => handleBulkMoveToFolder(folder.id)}
                    >
                      <div 
                        className="h-3 w-3 rounded-full mr-2" 
                        style={{ backgroundColor: folder.color }} 
                      />
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Favorite */}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkFavorite}
                disabled={selectedNoteIds.length === 0}
                className="shrink-0"
              >
                <Star className="h-4 w-4 mr-1" />
                Favorite
              </Button>
              
              {/* Duplicate */}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkDuplicate}
                disabled={selectedNoteIds.length === 0}
                className="shrink-0"
              >
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
              
              {/* Archive */}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkArchive}
                disabled={selectedNoteIds.length === 0}
                className="shrink-0"
              >
                <Archive className="h-4 w-4 mr-1" />
                {t('notes.archive')}
              </Button>
              
              {/* Delete */}
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={selectedNoteIds.length === 0}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t('common.delete')}
              </Button>
            </div>
          </div>
        )}

        {/* Trash View */}
        {viewMode === 'trash' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                {t('notes.trash')}
              </h2>
              {notes.filter(n => n.isDeleted).length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleEmptyTrash}
                >
                  {t('notes.emptyTrash')}
                </Button>
              )}
            </div>
            {notes.filter(n => n.isDeleted).length === 0 ? (
              <div className="text-center py-20">
                <Trash2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-1">{t('notes.trashEmpty')}</h3>
                <p className="text-muted-foreground text-sm">{t('notes.trashEmptyDesc')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.filter(n => n.isDeleted).map((note) => (
                  <Card key={note.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{note.title || t('notes.untitled')}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {note.content.replace(/<[^>]*>/g, '').trim() || t('notes.noContent')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('notes.deleted')}: {note.deletedAt ? new Date(note.deletedAt).toLocaleDateString() : t('notes.unknown')}
                          {note.deletedAt && (
                            <span className="ml-2 text-destructive">
                              • {t('notes.autoDeletesIn', { days: 30 - differenceInDays(new Date(), new Date(note.deletedAt)) })}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreFromTrash(note.id)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          {t('notes.restore')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handlePermanentDelete(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Archive View */}
        {viewMode === 'archive' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" />
              {t('notes.archivedNotes')}
            </h2>
            {notes.filter(n => n.isArchived && !n.isDeleted).length === 0 ? (
              <div className="text-center py-20">
                <Archive className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-1">{t('notes.noArchivedNotes')}</h3>
                <p className="text-muted-foreground text-sm">{t('notes.noArchivedNotesDesc')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.filter(n => n.isArchived && !n.isDeleted).map((note) => (
                  <Card key={note.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{note.title || t('notes.untitled')}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {note.content.replace(/<[^>]*>/g, '').trim() || t('notes.noContent')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('notes.archived')}: {note.archivedAt ? new Date(note.archivedAt).toLocaleDateString() : t('notes.unknown')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreFromArchive(note.id)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          {t('notes.restore')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes View (Regular) */}
        {viewMode === 'notes' && (
          <>
            {/* Grid View (Masonry) */}
            {isGridView ? (
              <>
                {/* Favorites in Grid */}
                {filteredNotes.filter(n => n.isFavorite).length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      {t('notes.favorites')}
                    </h2>
                    {shouldVirtualizeNotes(filteredNotes.filter(n => n.isFavorite).length) ? (
                      <VirtualizedNotesGrid
                        notes={filteredNotes.filter(n => n.isFavorite)}
                        onEdit={handleEditNote}
                        onDelete={handleDeleteNote}
                        onArchive={handleArchiveNote}
                        isSelectionMode={isSelectionMode}
                        selectedNoteIds={selectedNoteIds}
                        onToggleSelection={handleToggleNoteSelection}
                        className="h-[300px]"
                      />
                    ) : (
                      <MasonryNotesGrid
                        notes={filteredNotes.filter(n => n.isFavorite)}
                        onEdit={handleEditNote}
                        onDelete={handleDeleteNote}
                        onArchive={handleArchiveNote}
                        isSelectionMode={isSelectionMode}
                        selectedNoteIds={selectedNoteIds}
                        onToggleSelection={handleToggleNoteSelection}
                      />
                    )}
                  </div>
                )}
                
                {/* All Notes in Grid */}
                {filteredNotes.filter(n => !n.isFavorite).length === 0 && filteredNotes.filter(n => n.isFavorite).length === 0 ? (
                  <div className="text-center py-20">
                    <h2 className="text-xl font-semibold mb-2">{t('notes.noNotes')}</h2>
                    <p className="text-muted-foreground text-sm">
                      {searchQuery ? t('common.noResults') : t('notes.tapToCreate')}
                    </p>
                  </div>
                ) : filteredNotes.filter(n => !n.isFavorite).length > 0 && (
                  <div>
                    {filteredNotes.filter(n => n.isFavorite).length > 0 && (
                      <h2 className="text-lg font-semibold text-muted-foreground mb-3">{t('notes.allNotes')}</h2>
                    )}
                    {shouldVirtualizeNotes(filteredNotes.filter(n => !n.isFavorite).length) ? (
                      <VirtualizedNotesGrid
                        notes={filteredNotes.filter(n => !n.isFavorite)}
                        onEdit={handleEditNote}
                        onDelete={handleDeleteNote}
                        onArchive={handleArchiveNote}
                        isSelectionMode={isSelectionMode}
                        selectedNoteIds={selectedNoteIds}
                        onToggleSelection={handleToggleNoteSelection}
                        className="h-[calc(100vh-350px)]"
                      />
                    ) : (
                      <MasonryNotesGrid
                        notes={filteredNotes.filter(n => !n.isFavorite)}
                        onEdit={handleEditNote}
                        onDelete={handleDeleteNote}
                        onArchive={handleArchiveNote}
                        isSelectionMode={isSelectionMode}
                        selectedNoteIds={selectedNoteIds}
                        onToggleSelection={handleToggleNoteSelection}
                      />
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* List View (Default) */}
                {/* Favorites Section */}
                {filteredNotes.filter(n => n.isFavorite).length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      {t('notes.favorites')}
                    </h2>
                    <div className="space-y-3">
                      {filteredNotes.filter(n => n.isFavorite).map((note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onEdit={handleEditNote}
                          onDelete={handleDeleteNote}
                          onArchive={handleArchiveNote}
                          onTogglePin={handleTogglePin}
                          onToggleFavorite={handleToggleFavorite}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onDragEnd={handleDragEnd}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedNoteIds.includes(note.id)}
                          onToggleSelection={handleToggleNoteSelection}
                          onDuplicate={handleDuplicateNote}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* All Notes */}
                {filteredNotes.filter(n => !n.isFavorite).length === 0 && filteredNotes.filter(n => n.isFavorite).length === 0 ? (
                  <div className="text-center py-20">
                    <h2 className="text-xl font-semibold mb-2">{t('notes.noNotes')}</h2>
                    <p className="text-muted-foreground text-sm">
                      {searchQuery ? t('common.noResults') : t('notes.tapToCreate')}
                    </p>
                  </div>
                ) : filteredNotes.filter(n => !n.isFavorite).length > 0 && (
                  <>
                    {filteredNotes.filter(n => n.isFavorite).length > 0 && (
                      <h2 className="text-lg font-semibold text-muted-foreground mb-3">{t('notes.allNotes')}</h2>
                    )}
                    {shouldVirtualizeNotes(filteredNotes.filter(n => !n.isFavorite).length) ? (
                      <VirtualizedNotesList
                        notes={filteredNotes.filter(n => !n.isFavorite)}
                        onEdit={handleEditNote}
                        onDelete={handleDeleteNote}
                        onArchive={handleArchiveNote}
                        isSelectionMode={isSelectionMode}
                        selectedNoteIds={selectedNoteIds}
                        onToggleSelection={handleToggleNoteSelection}
                        className="h-[calc(100vh-350px)]"
                      />
                    ) : (
                      <div className="space-y-3">
                        {filteredNotes.filter(n => !n.isFavorite).map((note) => (
                          <NoteCard
                            key={note.id}
                            note={note}
                            onEdit={handleEditNote}
                            onDelete={handleDeleteNote}
                            onArchive={handleArchiveNote}
                            onTogglePin={handleTogglePin}
                            onToggleFavorite={handleToggleFavorite}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragEnd={handleDragEnd}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedNoteIds.includes(note.id)}
                            onToggleSelection={handleToggleNoteSelection}
                            onDuplicate={handleDuplicateNote}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>

      <NoteEditor
        note={selectedNote}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedNote(null);
        }}
        onSave={handleSaveNote}
        defaultType={defaultType}
        defaultFolderId={selectedFolderId || undefined}
        returnTo="/"
      />

      {/* Floating Add Note Button - Hide when editor is open */}
      {!isEditorOpen && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="fixed bottom-20 left-4 right-4 z-50 h-12 text-base font-semibold"
              size="lg"
              onClick={() => triggerHaptic('heavy')}
            >
              <Plus className="h-5 w-5" />
              {t('notes.newNote')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="mb-2 w-48">
            <DropdownMenuItem onClick={() => { triggerHaptic('medium'); handleCreateNote('sticky'); }} className="gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              {t('notes.noteTypes.sticky')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { triggerHaptic('medium'); handleCreateNote('lined'); }} className="gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              {t('notes.noteTypes.lined')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { triggerHaptic('medium'); handleCreateNote('regular'); }} className="gap-2">
              <FileEdit className="h-4 w-4 text-emerald-500" />
              {t('notes.noteTypes.regular')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { triggerHaptic('medium'); handleCreateNote('sketch'); }} className="gap-2">
              <Pen className="h-4 w-4 text-purple-500" />
              {t('notes.noteTypes.sketch')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { triggerHaptic('medium'); handleCreateNote('code'); }} className="gap-2">
              <FileCode className="h-4 w-4 text-orange-500" />
              {t('notes.noteTypes.code')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { triggerHaptic('medium'); handleCreateNote('mindmap'); }} className="gap-2">
              <GitBranch className="h-4 w-4 text-pink-500" />
              {t('notes.noteTypes.mindMap')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { triggerHaptic('medium'); handleCreateNote('expense'); }} className="gap-2">
              <Receipt className="h-4 w-4 text-teal-500" />
              {t('notes.noteTypes.expense')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <BottomNavigation />
    </div>
  );
};

export default Index;

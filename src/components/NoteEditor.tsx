import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Note, NoteType, StickyColor, VoiceRecording, Folder } from '@/types/note';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from './RichTextEditor';
import { getTableStyles, TableStyle } from './TableEditor';
import { FindReplacePage } from './FindReplacePage';
import { VoiceRecorder } from './VoiceRecorder';
import { SketchEditor } from './SketchEditor';
import { VirtualizedCodeEditor } from './VirtualizedCodeEditor';
import { MindMapEditor } from './MindMapEditor';
import { TemplateSelector } from './TemplateSelector';
import { ExpenseTrackerEditor } from './ExpenseTrackerEditor';
import { NoteVersionHistorySheet } from './NoteVersionHistorySheet';
import { NoteLinkingSheet } from './NoteLinkingSheet';
import { NoteTableOfContents, injectHeadingIds } from './NoteTableOfContents';
import { InputSheetPage } from './InputSheetPage';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { sanitizeForDisplay } from '@/lib/sanitize';

import { ErrorBoundary } from './ErrorBoundary';
import { ArrowLeft, Folder as FolderIcon, Plus, CalendarIcon, History, FileDown, Link2, ChevronDown, FileText, BookOpen, BarChart3, MoreVertical, Mic, Share2, Search, Image, Table, Minus, SeparatorHorizontal, MessageSquare, FileSymlink, FileType } from 'lucide-react';
import { exportNoteToPdf, getPageBreakCount } from '@/utils/exportToPdf';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { scheduleNoteReminder, updateNoteReminder, cancelNoteReminder } from '@/utils/noteNotifications';
import { saveNoteVersion } from '@/utils/noteVersionHistory';
import { exportNoteToMarkdown } from '@/utils/markdownExport';
import { insertNoteLink, findBacklinks } from '@/utils/noteLinking';
import { calculateNoteStats, formatReadingTime } from '@/utils/noteStats';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface NoteEditorProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Note) => void;
  defaultType?: NoteType;
  defaultFolderId?: string;
  allNotes?: Note[];
  /** Route to navigate back to when editor closes. If not provided, stays on current route. */
  returnTo?: string;
}

// User-created folders only - no default note type folders

const STICKY_COLORS: StickyColor[] = ['yellow', 'blue', 'green', 'pink', 'orange'];

const STICKY_COLOR_VALUES = {
  yellow: 'hsl(var(--sticky-yellow))',
  blue: 'hsl(var(--sticky-blue))',
  green: 'hsl(var(--sticky-green))',
  pink: 'hsl(var(--sticky-pink))',
  orange: 'hsl(var(--sticky-orange))',
};

export const NoteEditor = ({ note, isOpen, onClose, onSave, defaultType = 'regular', defaultFolderId, allNotes = [], returnTo }: NoteEditorProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const draftIdRef = useRef<string | null>(null);
  const isOpenRef = useRef(isOpen);
  const pushedHistoryRef = useRef(false);
  const isPoppingHistoryRef = useRef(false);
  const returnToRef = useRef(returnTo);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Capture the returnTo route when editor opens
  useEffect(() => {
    if (isOpen && returnTo) {
      returnToRef.current = returnTo;
    }
  }, [isOpen, returnTo]);

  const getCurrentNoteId = useCallback(() => {
    if (note?.id) return note.id;
    if (!draftIdRef.current) draftIdRef.current = `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return draftIdRef.current;
  }, [note?.id]);

  const [noteType, setNoteType] = useState<NoteType>(defaultType);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<StickyColor>('yellow');
  const [images, setImages] = useState<string[]>([]);
  const [voiceRecordings, setVoiceRecordings] = useState<VoiceRecording[]>([]);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [tableStyle, setTableStyle] = useState<'default' | 'striped' | 'bordered' | 'minimal' | 'modern'>('default');
  
  const TABLE_STYLE_OPTIONS = [
    { id: 'default', name: t('editor.tableStyles.default', 'Default') },
    { id: 'striped', name: t('editor.tableStyles.striped', 'Striped') },
    { id: 'bordered', name: t('editor.tableStyles.bordered', 'Bordered') },
    { id: 'minimal', name: t('editor.tableStyles.minimal', 'Minimal') },
    { id: 'modern', name: t('editor.tableStyles.modern', 'Modern') },
  ] as const;
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [fontFamily, setFontFamily] = useState<string>('-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  const [fontSize, setFontSize] = useState<string>('16px');
  const [fontWeight, setFontWeight] = useState<string>('400');
  const [letterSpacing, setLetterSpacing] = useState<string>('0em');
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [lineHeight, setLineHeight] = useState<string>('1.5');
  const [createdAt, setCreatedAt] = useState<Date>(new Date());
  const [createdTime, setCreatedTime] = useState<string>('12:00');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<string>('12:00');
  const [reminderRecurring, setReminderRecurring] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [reminderVibration, setReminderVibration] = useState<boolean>(true);
  const [notificationId, setNotificationId] = useState<number | undefined>(undefined);
  const [notificationIds, setNotificationIds] = useState<number[] | undefined>(undefined);

  // Code note state
  const [codeContent, setCodeContent] = useState<string>('');
  const [codeLanguage, setCodeLanguage] = useState<string>('auto');

  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isNoteLinkingOpen, setIsNoteLinkingOpen] = useState(false);
  const [isBacklinksOpen, setIsBacklinksOpen] = useState(true);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [metaDescription, setMetaDescription] = useState<string>('');
  
  // Input sheet page states (replaces window.prompt)
  const [isLinkInputOpen, setIsLinkInputOpen] = useState(false);
  const [isCommentInputOpen, setIsCommentInputOpen] = useState(false);
  const [isMetaDescInputOpen, setIsMetaDescInputOpen] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Calculate stats
  const noteStats = calculateNoteStats(content, title);
  
  // Calculate backlinks
  const backlinks = note ? findBacklinks(note, allNotes) : [];

  useEffect(() => {
    const loadFolders = async () => {
      const { getSetting } = await import('@/utils/settingsStorage');
      const savedFolders = await getSetting<Folder[] | null>('folders', null);
      if (savedFolders) {
        setFolders(savedFolders.map((f: Folder) => ({
          ...f,
          createdAt: new Date(f.createdAt),
        })));
      }
    };
    loadFolders();
  }, []);

  useEffect(() => {
    if (note) {
      setNoteType(note.type);
      setTitle(note.title);
      setContent(note.content);
      setColor(note.color || 'yellow');
      setImages(note.images || []);
      setVoiceRecordings(note.voiceRecordings || []);
      setSelectedFolderId(note.folderId);
      setFontFamily(note.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
      setFontSize(note.fontSize || '16px');
      setFontWeight(note.fontWeight || '400');
      setLetterSpacing(note.letterSpacing || '0em');
      setIsItalic(note.isItalic || false);
      setLineHeight(note.lineHeight || '1.5');
      const noteDate = new Date(note.createdAt);
      setCreatedAt(noteDate);
      setCreatedTime(format(noteDate, 'HH:mm'));
      setReminderEnabled(note.reminderEnabled || false);
      setReminderRecurring(note.reminderRecurring || 'none');
      setReminderVibration(note.reminderVibration !== false);
      if (note.reminderTime) {
        const reminderDate = new Date(note.reminderTime);
        setReminderTime(format(reminderDate, 'HH:mm'));
      }
      setNotificationId(note.notificationId);
      setNotificationIds(note.notificationIds);

      // Code fields
      setCodeContent(note.codeContent || '');
      setCodeLanguage(note.codeLanguage || 'auto');
      setMetaDescription(note.metaDescription || '');
    } else {
      // Reset draft ID for new notes to prevent overwriting
      draftIdRef.current = null;
      
      setNoteType(defaultType);
      setTitle('');
      setContent('');
      setColor('yellow');
      setImages([]);
      setVoiceRecordings([]);
      setSelectedFolderId(defaultFolderId);
      setFontFamily('-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
      setFontSize('16px');
      setFontWeight('400');
      setLetterSpacing('0em');
      setIsItalic(false);
      setLineHeight('1.5');
      const now = new Date();
      setCreatedAt(now);
      setCreatedTime(format(now, 'HH:mm'));
      setReminderEnabled(false);
      setReminderTime('12:00');
      setReminderRecurring('none');
      setReminderVibration(true);
      setNotificationId(undefined);
      setNotificationIds(undefined);
      setMetaDescription('');

      // Reset code fields
      setCodeContent('');
      setCodeLanguage('auto');
    }
  }, [note, defaultType, defaultFolderId, isOpen]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    const newFolder: Folder = {
      id: Date.now().toString(),
      name: newFolderName,
      isDefault: false,
      createdAt: new Date(),
      color: newFolderColor,
    };

    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);
    // Save folders to IndexedDB and dispatch event
    const foldersToSave = updatedFolders.filter(f => !f.isDefault);
    const { setSetting } = await import('@/utils/settingsStorage');
    await setSetting('folders', foldersToSave);
    // Dispatch event so Index.tsx can pick up the new folder
    window.dispatchEvent(new Event('foldersUpdated'));
    setSelectedFolderId(newFolder.id);
    setNewFolderName('');
    setNewFolderColor('#3B82F6');
    setIsNewFolderDialogOpen(false);
    toast.success(t('toast.folderCreated'));
  };

  const persistNoteToIndexedDB = useCallback(async (savedNote: Note) => {
    try {
      const { saveNoteToDBSingle } = await import('@/utils/noteStorage');
      await saveNoteToDBSingle(savedNote);
    } catch (e) {
      console.warn('Failed to persist note to IndexedDB', e);
    }
  }, []);

  const buildCurrentNote = useCallback((): Note => {
    // Combine date and time
    const [hours, minutes] = createdTime.split(':').map(Number);
    const combinedDateTime = new Date(createdAt);
    combinedDateTime.setHours(hours, minutes, 0, 0);

    return {
      id: getCurrentNoteId(),
      type: noteType,
      title,
      content: noteType === 'code' ? '' : content,
      color: noteType === 'sticky' ? color : undefined,
      images: noteType === 'sticky' ? undefined : images,
      voiceRecordings,
      folderId: selectedFolderId || noteType,
      fontFamily: (noteType === 'sticky' || noteType === 'lined' || noteType === 'regular') ? fontFamily : undefined,
      fontSize: (noteType === 'sticky' || noteType === 'lined' || noteType === 'regular') ? fontSize : undefined,
      fontWeight: (noteType === 'sticky' || noteType === 'lined' || noteType === 'regular') ? fontWeight : undefined,
      letterSpacing: (noteType === 'sticky' || noteType === 'lined' || noteType === 'regular') ? letterSpacing : undefined,
      isItalic: (noteType === 'sticky' || noteType === 'lined' || noteType === 'regular') ? isItalic : undefined,
      lineHeight: (noteType === 'sticky' || noteType === 'lined' || noteType === 'regular') ? lineHeight : undefined,
      codeContent: noteType === 'code' ? codeContent : undefined,
      codeLanguage: noteType === 'code' ? codeLanguage : undefined,
      reminderEnabled,
      reminderTime: reminderEnabled ? (() => {
        const [remHours, remMinutes] = reminderTime.split(':').map(Number);
        const reminderDateTime = new Date(createdAt);
        reminderDateTime.setHours(remHours, remMinutes, 0, 0);
        return reminderDateTime;
      })() : undefined,
      reminderRecurring,
      reminderVibration,
      notificationId,
      notificationIds,
      metaDescription: metaDescription || undefined,
      createdAt: note?.createdAt || combinedDateTime,
      updatedAt: new Date(),
    };
  }, [
    createdAt,
    createdTime,
    getCurrentNoteId,
    note?.createdAt,
    noteType,
    title,
    content,
    color,
    images,
    voiceRecordings,
    selectedFolderId,
    fontFamily,
    fontSize,
    fontWeight,
    letterSpacing,
    isItalic,
    lineHeight,
    codeContent,
    codeLanguage,
    reminderEnabled,
    reminderTime,
    reminderRecurring,
    reminderVibration,
    notificationId,
    notificationIds,
    metaDescription,
  ]);

  const commitNote = useCallback(async ({ full }: { full: boolean }) => {
    const savedNote = buildCurrentNote();

    if (full) {
      // Handle notification scheduling
      if (savedNote.reminderEnabled && savedNote.reminderTime) {
        const result = await updateNoteReminder({
          ...savedNote,
          notificationId: savedNote.notificationId || undefined,
          notificationIds: savedNote.notificationIds || undefined,
        });

        if (result) {
          if (Array.isArray(result)) {
            savedNote.notificationIds = result;
            savedNote.notificationId = undefined;
          } else {
            savedNote.notificationId = result;
            savedNote.notificationIds = undefined;
          }
        }
      } else if (!savedNote.reminderEnabled && (savedNote.notificationId || savedNote.notificationIds)) {
        // Cancel notification(s) if reminder was disabled
        if (savedNote.notificationIds) {
          await cancelNoteReminder(savedNote.notificationIds);
        } else if (savedNote.notificationId) {
          await cancelNoteReminder(savedNote.notificationId);
        }
        savedNote.notificationId = undefined;
        savedNote.notificationIds = undefined;
        savedNote.reminderTime = undefined;
      }

      // Save version history (only on "full" save)
      saveNoteVersion(savedNote, note ? 'edit' : 'create');
    }

    onSave(savedNote);
    persistNoteToIndexedDB(savedNote);
  }, [buildCurrentNote, note, onSave, persistNoteToIndexedDB]);

  const handleSave = useCallback(async () => {
    await commitNote({ full: true });
  }, [commitNote]);

  // Use ref to always have access to the latest save function
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const closeHistoryOverlay = useCallback(() => {
    if (!pushedHistoryRef.current) return;
    pushedHistoryRef.current = false;
    isPoppingHistoryRef.current = true;
    setTimeout(() => {
      window.history.back();
    }, 0);
  }, []);

  const handleClose = useCallback(async () => {
    await commitNote({ full: true });
    onClose();
    closeHistoryOverlay();
    // Navigate back to the origin screen if provided
    if (returnToRef.current) {
      navigate(returnToRef.current, { replace: true });
    }
  }, [closeHistoryOverlay, commitNote, navigate, onClose]);

  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  // When editor opens, push a history entry so "Back" closes editor instead of leaving/exiting
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;

    pushedHistoryRef.current = true;
    window.history.pushState({ __noteEditor: true }, '');

    const onPopState = () => {
      if (isPoppingHistoryRef.current) {
        isPoppingHistoryRef.current = false;
        return;
      }

      if (!isOpenRef.current) return;

      // Keep user on same URL; close editor instead.
      window.history.pushState({ __noteEditor: true }, '');
      void handleCloseRef.current();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isOpen]);

  // Auto-save as user types (debounced)
  useEffect(() => {
    if (!isOpen) return;

    const hasText = (title?.trim() || '') !== '' || (content?.trim() || '') !== '' || (codeContent?.trim() || '') !== '';
    if (!hasText) return;

    const t = window.setTimeout(() => {
      void commitNote({ full: false });
    }, 700);

    return () => window.clearTimeout(t);
  }, [isOpen, title, content, codeContent, commitNote]);

  // Save immediately if tab/app is backgrounded
  useEffect(() => {
    if (!isOpen) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void commitNote({ full: false });
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isOpen, commitNote]);

  // Handle hardware back button on Android - save and close editor (parent keeps correct screen)
  useHardwareBackButton({
    onBack: handleClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleRestoreVersion = (restoredContent: string, restoredTitle: string) => {
    setContent(restoredContent);
    setTitle(restoredTitle);
    toast.success(t('toast.versionRestored'));
  };

  const handleInsertNoteLink = (noteTitle: string) => {
    const linkText = insertNoteLink(noteTitle);
    setContent(prev => prev + linkText);
    toast.success(t('toast.linkInserted', { title: noteTitle }));
  };

  const handleExportMarkdown = () => {
    const currentNote: Note = {
      id: note?.id || Date.now().toString(),
      type: noteType,
      title,
      content,
      codeContent,
      codeLanguage,
      voiceRecordings,
      createdAt: note?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    exportNoteToMarkdown(currentNote);
    toast.success(t('toast.noteExportedMarkdown'));
  };

  const handleImageAdd = (imageUrl: string) => {
    setImages([...images, imageUrl]);
  };

  const handleRecordingAdd = (recording: VoiceRecording) => {
    setVoiceRecordings([...voiceRecordings, recording]);
  };

  const handleInsertAudioAtCursor = (audioBase64: string, recordingId: string) => {
    // For rich text editors (sticky, lined, regular), insert audio element at cursor position
    // We use a custom data attribute to identify and render with AudioPlayer component
    if (['sticky', 'lined', 'regular'].includes(noteType) && editorRef.current) {
      // Focus the editor to ensure cursor is active
      editorRef.current.focus();
      
      // For lined notes, wrap in div with proper class for alignment, followed by a new paragraph for cursor
      const audioHtml = `<div class="audio-player-container" style="margin: 12px 0; display: block; text-align: center;" data-recording-id="${recordingId}" data-audio-src="${audioBase64}"><audio controls src="${audioBase64}" style="width: 100%; max-width: 400px; height: 54px;"></audio></div><p style="text-align: center;"><br></p>`;
      
      // Insert at cursor position using execCommand
      document.execCommand('insertHTML', false, audioHtml);
      
      // Move cursor to the new paragraph
      const selection = window.getSelection();
      if (selection && editorRef.current) {
        const paragraphs = editorRef.current.querySelectorAll('p');
        const lastP = paragraphs[paragraphs.length - 1];
        if (lastP) {
          const range = document.createRange();
          range.selectNodeContents(lastP);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      
      // Trigger content update
      if (editorRef.current) {
        setContent(editorRef.current.innerHTML);
      }
    }
  };

  const handleRecordingDelete = (id: string) => {
    setVoiceRecordings(voiceRecordings.filter(r => r.id !== id));
  };

  const getEditorBackgroundColor = () => {
    if (noteType === 'sticky') {
      return STICKY_COLOR_VALUES[color];
    }
    // Use CSS variable for regular/lined notes to match dark mode
    return 'hsl(var(--background))';
  };

  if (!isOpen) return null;

  // Insert handlers for + icon dropdown
  const handleInsertLink = () => {
    setIsLinkInputOpen(true);
  };

  const handleInsertLinkSave = (url: string) => {
    if (url) {
      const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      setContent(prev => prev + linkHtml);
      toast.success(t('editor.linkInserted'));
    }
  };

  const handleInsertComment = () => {
    setIsCommentInputOpen(true);
  };

  const handleInsertCommentSave = (comment: string) => {
    if (comment) {
      const commentHtml = `<div style="background: hsl(var(--muted)); border-left: 3px solid hsl(var(--primary)); padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-style: italic; color: hsl(var(--muted-foreground));">💬 ${comment}</div>`;
      setContent(prev => prev + commentHtml);
      toast.success(t('editor.commentAdded'));
    }
  };

  const handleInsertHorizontalLine = () => {
    // Insert solid black separator at cursor position using execCommand
    // Use proper block display for lined notes alignment
    const lineHtml = `<hr style="border: none; border-top: 2px solid currentColor; margin: 16px 0; display: block;" /><p><br></p>`;
    document.execCommand('insertHTML', false, lineHtml);
    toast.success(t('editor.separatorAdded'));
  };

  const handleInsertPageBreak = () => {
    // MS Word/Google Docs style page break - creates a visual page separation
    // Added display: block and proper spacing for lined notes
    const pageBreakHtml = `
      <div class="page-break-container" style="page-break-after: always; margin: 32px 0; position: relative; display: block;" contenteditable="false">
        <div style="
          border: 1px dashed #999;
          background: linear-gradient(to bottom, hsl(var(--muted)), hsl(var(--background)));
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          <span style="
            background: hsl(var(--background));
            border: 1px solid hsl(var(--border));
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 11px;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          ">${t('editor.pageBreak')}</span>
        </div>
      </div>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, pageBreakHtml);
    toast.success(t('editor.pageBreakAdded'));
  };

  return (
    <div
      className={cn("fixed inset-0 z-50 flex flex-col")}
      style={{ backgroundColor: getEditorBackgroundColor() }}
    >
      {/* Top Header - Hide for expense notes */}
      {noteType !== 'expense' && (
        <div
          className="flex justify-between items-center px-4 py-3 border-b"
          style={{ backgroundColor: getEditorBackgroundColor(), borderColor: 'rgba(0,0,0,0.1)' }}
        >
          <Button variant="ghost" size="icon" onClick={handleClose} className={cn("h-9 w-9", noteType === 'sticky' && "text-black hover:text-black")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-1">
            {/* Table of Contents */}
            {content && (
              <NoteTableOfContents 
                content={content} 
                onJumpTo={(id) => {
                  const element = document.getElementById(id);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }} 
              />
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Table Picker Popover - only available for rich text notes */}
            {(noteType === 'sticky' || noteType === 'lined' || noteType === 'regular') && (
              <Popover open={isTablePickerOpen} onOpenChange={setIsTablePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className={cn("h-9 w-9", noteType === 'sticky' && "text-black hover:text-black")}>
                    <Table className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-4 z-[60]" align="end" side="left">
                  <div className="space-y-4">
                    <div className="font-medium text-sm">{t('editor.insertTable')}</div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{t('editor.rows')}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => setTableRows(Math.max(1, tableRows - 1))}
                          >
                            <Minus className="h-4 w-4 stroke-[3]" />
                          </Button>
                          <span className="w-8 text-center text-sm font-bold">{tableRows}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => setTableRows(Math.min(20, tableRows + 1))}
                          >
                            <Plus className="h-4 w-4 stroke-[3]" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{t('editor.columns')}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => setTableCols(Math.max(1, tableCols - 1))}
                          >
                            <Minus className="h-4 w-4 stroke-[3]" />
                          </Button>
                          <span className="w-8 text-center text-sm font-bold">{tableCols}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => setTableCols(Math.min(10, tableCols + 1))}
                          >
                            <Plus className="h-4 w-4 stroke-[3]" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Style Selection */}
                    <div className="space-y-2">
                      <span className="text-sm">{t('editor.style')}</span>
                      <div className="grid grid-cols-2 gap-1">
                        {TABLE_STYLE_OPTIONS.map((style) => (
                          <Button
                            key={style.id}
                            variant={tableStyle === style.id ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                              "h-8 text-xs justify-start",
                              tableStyle === style.id && "ring-1 ring-primary"
                            )}
                            onClick={() => setTableStyle(style.id)}
                          >
                            {style.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Grid preview */}
                    <div className="border rounded p-2 bg-muted/30">
                      <div 
                        className="grid gap-0.5"
                        style={{ 
                          gridTemplateColumns: `repeat(${Math.min(tableCols, 6)}, 1fr)`,
                        }}
                      >
                        {Array.from({ length: Math.min(tableRows, 5) * Math.min(tableCols, 6) }).map((_, i) => (
                          <div
                            key={i}
                            className="aspect-square bg-primary/20 rounded-sm min-w-[12px]"
                          />
                        ))}
                      </div>
                      {(tableRows > 5 || tableCols > 6) && (
                        <p className="text-xs text-muted-foreground mt-1 text-center">
                          {tableRows}×{tableCols} table
                        </p>
                      )}
                    </div>

                    <Button 
                      onClick={() => {
                        const styles = getTableStyles(tableStyle);
                        const headerRow = `<tr>${Array(tableCols).fill(`<th style="${styles.headerCell}">${t('editor.tableHeader')}</th>`).join('')}</tr>`;
                        const bodyRows = Array(tableRows - 1)
                          .fill(null)
                          .map((_, rowIdx) => {
                            const isEven = rowIdx % 2 === 0;
                            const cellStyle = tableStyle === 'striped' && isEven ? styles.stripedCell : styles.bodyCell;
                            return `<tr>${Array(tableCols).fill(`<td style="${cellStyle}">${t('editor.tableCell')}</td>`).join('')}</tr>`;
                          })
                          .join('');
                        
                        // Create table with centered wrapper and trailing paragraph for cursor
                        const tableHtml = `<div class="resizable-table-wrapper" style="width: 100%; margin: 16px 0; display: block; text-align: center;"><table style="${styles.table}; margin: 0 auto;" data-table-style="${tableStyle}">${headerRow}${bodyRows}</table></div><p style="text-align: center;"><br></p>`;
                        
                        // Focus editor and insert at cursor position
                        if (editorRef.current) {
                          editorRef.current.focus();
                          document.execCommand('insertHTML', false, tableHtml);
                          
                          // Move cursor to the new paragraph
                          const selection = window.getSelection();
                          if (selection) {
                            const paragraphs = editorRef.current.querySelectorAll('p');
                            const lastP = paragraphs[paragraphs.length - 1];
                            if (lastP) {
                              const range = document.createRange();
                              range.selectNodeContents(lastP);
                              range.collapse(false);
                              selection.removeAllRanges();
                              selection.addRange(range);
                            }
                          }
                          
                          // Update content state
                          setContent(editorRef.current.innerHTML);
                        }
                        
                        setIsTablePickerOpen(false);
                        toast.success(t('editor.tableAdded', { rows: tableRows, cols: tableCols, style: tableStyle }));
                      }} 
                      className="w-full" 
                      size="sm"
                    >
                      {t('editor.insertTableButton', { style: tableStyle.charAt(0).toUpperCase() + tableStyle.slice(1) })}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("h-9 w-9", noteType === 'sticky' && "text-black hover:text-black")}>
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card z-50">
                {/* Global Font Size Control */}
                {['sticky', 'lined', 'regular'].includes(noteType) && (
                  <>
                    <div className="px-2 py-1.5 text-sm font-semibold flex items-center gap-2">
                      <FileType className="h-4 w-4" />
                      {t('editor.globalFontSize', 'Font Size')}
                    </div>
                    <div className="px-2 py-1.5 flex items-center justify-between gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => {
                          const currentSize = parseInt(fontSize) || 16;
                          const newSize = Math.max(10, currentSize - 2);
                          setFontSize(`${newSize}px`);
                        }}
                      >
                        <Minus className="h-4 w-4 stroke-[3]" />
                      </Button>
                      <span className="text-sm font-semibold min-w-[48px] text-center">{fontSize}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => {
                          const currentSize = parseInt(fontSize) || 16;
                          const newSize = Math.min(48, currentSize + 2);
                          setFontSize(`${newSize}px`);
                        }}
                      >
                        <Plus className="h-4 w-4 stroke-[3]" />
                      </Button>
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setShowStats(!showStats)}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {showStats ? t('editor.hideStats') : t('editor.showStats')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsReadingMode(!isReadingMode)}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  {isReadingMode ? t('editor.exitReadingMode') : t('editor.enterReadingMode')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsFindReplaceOpen(true)}>
                  <Search className="h-4 w-4 mr-2" />
                  {t('editor.findReplace')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsMetaDescInputOpen(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  {metaDescription ? t('editor.editMetaDescription') : t('editor.addMetaDescription')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                
                {/* Created & Modified Dates */}
                <div className="px-2 py-1.5 text-xs text-muted-foreground flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    <span>{t('editor.created')}: {format(note?.createdAt || createdAt, 'MMM dd, yyyy • h:mm a')}</span>
                  </div>
                  {note && (
                    <div className="flex items-center gap-1">
                      <span>{t('editor.modified')}: {format(new Date(note.updatedAt), 'MMM dd, yyyy • h:mm a')}</span>
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                
                {/* Voice Recorder */}
                <div className="px-2 py-1.5">
                  <VoiceRecorder
                    recordings={voiceRecordings}
                    onRecordingAdd={handleRecordingAdd}
                    onRecordingDelete={handleRecordingDelete}
                    onInsertAtCursor={handleInsertAudioAtCursor}
                    compact={true}
                  />
                </div>
                <DropdownMenuSeparator />
                
                {/* Folder Selection */}
                <div className="px-2 py-1.5 text-sm font-semibold flex items-center gap-2">
                  <FolderIcon className="h-4 w-4" />
                  {t('editor.moveToFolder')}
                </div>
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      toast.success(t('toast.movedToFolder', { folder: folder.name }));
                    }}
                    className={cn(selectedFolderId === folder.id && "bg-accent", "pl-6")}
                  >
                    <span 
                      className="h-3 w-3 rounded-full mr-2 flex-shrink-0" 
                      style={{ backgroundColor: folder.color || '#3B82F6' }} 
                    />
                    {folder.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setIsNewFolderDialogOpen(true)} className="pl-6">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('notes.newFolder')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  const plainContent = content.replace(/<[^>]*>/g, '').trim();
                  const shareText = title ? `${title}\n\n${plainContent}` : plainContent;
                  if (navigator.share) {
                    navigator.share({
                      title: title || 'Note',
                      text: shareText,
                    }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(shareText);
                    toast.success(t('toast.noteCopied'));
                  }
                }}>
                  <Share2 className="h-4 w-4 mr-2" />
                  {t('editor.shareNote')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  toast.loading(t('toast.generatingPdf'), { id: 'pdf-export' });
                  try {
                    await exportNoteToPdf(content, {
                      title: title || t('notes.untitled'),
                      filename: `${title || 'note'}.pdf`,
                    });
                    toast.success(t('toast.pdfExported'), { id: 'pdf-export' });
                  } catch (error) {
                    console.error('PDF export failed:', error);
                    toast.error(t('toast.pdfExportFailed'), { id: 'pdf-export' });
                  }
                }}>
                  <FileType className="h-4 w-4 mr-2" />
                  {t('editor.exportPdf')}
                </DropdownMenuItem>
                {note && (
                  <DropdownMenuItem onClick={() => setIsVersionHistoryOpen(true)}>
                    <History className="h-4 w-4 mr-2" />
                    {t('editor.versionHistory')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Word Count Stats Bar with Page Indicator - only shows when enabled */}
      {showStats && (
        <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between text-xs text-muted-foreground" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
          <div className="flex items-center gap-2">
            {getPageBreakCount(content) > 1 && (
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                {t('editor.pagesCount', { count: getPageBreakCount(content) })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>{t('editor.wordsCount', { count: noteStats.wordCount })}</span>
            <span>•</span>
            <span>{t('editor.charsCount', { count: noteStats.characterCount })}</span>
          </div>
        </div>
      )}

      {/* Sticky note color picker */}
      {noteType === 'sticky' && !isReadingMode && (
        <div className="px-4 py-2 border-b bg-background">
          <div className="flex items-center gap-2">
            {STICKY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Set sticky color ${c}`}
                onClick={() => setColor(c)}
                className={cn("h-7 w-7 rounded-full border", c === color && "ring-2 ring-ring")}
                style={{ backgroundColor: STICKY_COLOR_VALUES[c] }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Full Page Content Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ErrorBoundary>
          {noteType === 'expense' ? (
            <ExpenseTrackerEditor
              content={content}
              onChange={setContent}
              title={title}
              onTitleChange={setTitle}
              onClose={handleClose}
            />
          ) : noteType === 'code' ? (
            <VirtualizedCodeEditor
              code={codeContent}
              onChange={setCodeContent}
              language={codeLanguage}
              onLanguageChange={setCodeLanguage}
              title={title}
              onTitleChange={setTitle}
              onClose={handleClose}
            />
          ) : noteType === 'mindmap' ? (
            <MindMapEditor
              content={content}
              onChange={setContent}
              title={title}
              onTitleChange={setTitle}
            />
          ) : noteType === 'sketch' ? (
            <SketchEditor content={content} onChange={setContent} />
          ) : isReadingMode ? (
            <div 
              className="h-full overflow-y-auto overscroll-contain"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                minHeight: 0,
              }}
            >
              <div className="p-4 pb-20">
                {title && (
                  <h1 
                    className="text-2xl font-bold mb-4"
                    style={{ fontFamily }}
                  >
                    {title}
                  </h1>
                )}
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert"
                  style={{ fontFamily, fontSize, fontWeight, lineHeight }}
                  dangerouslySetInnerHTML={{ __html: sanitizeForDisplay(content) }}
                />
              </div>
            </div>
          ) : (
            <RichTextEditor
              content={content}
              onChange={setContent}
              onImageAdd={handleImageAdd}
              allowImages={true}
              showTable={noteType !== 'lined'}
              className={cn(
                noteType === 'lined' && 'lined-note',
                noteType === 'sticky' && 'sticky-note-editor'
              )}
              toolbarPosition="bottom"
              title={title}
              onTitleChange={setTitle}
              showTitle={true}
              fontFamily={fontFamily}
              onFontFamilyChange={setFontFamily}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
              fontWeight={fontWeight}
              onFontWeightChange={setFontWeight}
              letterSpacing={letterSpacing}
              onLetterSpacingChange={setLetterSpacing}
              isItalic={isItalic}
              onItalicChange={setIsItalic}
              lineHeight={lineHeight}
              onLineHeightChange={setLineHeight}
              onInsertNoteLink={() => setIsNoteLinkingOpen(true)}
              externalEditorRef={editorRef}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* Backlinks Section */}
      {note && backlinks.length > 0 && (
        <div className="border-t bg-background/95 backdrop-blur-sm">
          <Collapsible open={isBacklinksOpen} onOpenChange={setIsBacklinksOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 hover:bg-accent/50 transition-colors">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                {backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isBacklinksOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 space-y-1 max-h-32 overflow-y-auto">
                {backlinks.map((linkedNote) => (
                  <button
                    key={linkedNote.id}
                    onClick={() => {
                      handleSave();
                      onClose();
                      // Trigger opening the linked note via navigation or callback
                      toast.info(`Navigate to "${linkedNote.title}" to view`);
                    }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded-md hover:bg-accent transition-colors"
                  >
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="truncate">{linkedNote.title || 'Untitled'}</span>
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Template Selector */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelectTemplate={(templateContent) => setContent(templateContent)}
      />

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>{t('editor.createNewFolder')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder={t('editor.folderNamePlaceholder')}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('editor.folderColor')}</label>
              <div className="flex flex-wrap gap-2">
                {[
                  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
                  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
                  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
                  '#EC4899', '#F43F5E', '#78716C', '#6B7280', '#64748B'
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewFolderColor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${newFolderColor === c ? 'ring-2 ring-ring ring-offset-2' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleCreateFolder} className="w-full">
              {t('editor.createFolder')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Sheet */}
      {note && (
        <NoteVersionHistorySheet
          isOpen={isVersionHistoryOpen}
          onClose={() => setIsVersionHistoryOpen(false)}
          noteId={note.id}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Note Linking Sheet */}
      <NoteLinkingSheet
        isOpen={isNoteLinkingOpen}
        onClose={() => setIsNoteLinkingOpen(false)}
        notes={allNotes}
        currentNoteId={note?.id}
        onSelectNote={handleInsertNoteLink}
      />

      {/* Find & Replace Page */}
      <FindReplacePage
        isOpen={isFindReplaceOpen}
        onClose={() => setIsFindReplaceOpen(false)}
        content={content}
        onContentChange={setContent}
        editorRef={editorRef}
      />

      {/* Input Sheet Pages - Replace window.prompt */}
      <InputSheetPage
        isOpen={isLinkInputOpen}
        onClose={() => setIsLinkInputOpen(false)}
        onSave={handleInsertLinkSave}
        title={t('editor.insertLinkTitle')}
        placeholder={t('editor.insertLinkPlaceholder')}
      />

      <InputSheetPage
        isOpen={isCommentInputOpen}
        onClose={() => setIsCommentInputOpen(false)}
        onSave={handleInsertCommentSave}
        title={t('editor.addCommentTitle')}
        placeholder={t('editor.addCommentPlaceholder')}
        multiline
      />

      <InputSheetPage
        isOpen={isMetaDescInputOpen}
        onClose={() => setIsMetaDescInputOpen(false)}
        onSave={(desc) => {
          setMetaDescription(desc);
          toast.success(t('editor.metaDescUpdated'));
        }}
        title={t('editor.metaDescription')}
        placeholder={t('editor.metaDescPlaceholder')}
        defaultValue={metaDescription}
        maxLength={160}
        multiline
      />
    </div>
  );
};

import { useEffect, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Code, PenLine, StickyNote, Paintbrush, X, Send, CalendarIcon, Timer, LayoutTemplate, Flag, FolderIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotes } from '@/contexts/NotesContext';
import { Note, NoteType, TodoItem, Priority, Folder, RepeatType } from '@/types/note';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { useToast } from '@/hooks/use-toast';
import { getSetting } from '@/utils/settingsStorage';
import { useNoteTypeVisibility } from '@/hooks/useNoteTypeVisibility';
import { parseNaturalLanguageTask, hasNaturalLanguagePatterns } from '@/utils/naturalLanguageParser';
import { notificationManager } from '@/utils/notifications';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type QuickAddMode = 'select_note_type' | 'add_task' | null;

export const PersistentNotificationHandler = () => {
  const { t } = useTranslation();
  const { saveNote } = useNotes();
  const { toast } = useToast();
  const { isTypeVisible } = useNoteTypeVisibility();
  const [mode, setMode] = useState<QuickAddMode>(null);
  
  // Task input state
  const [taskText, setTaskText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [priority, setPriority] = useState<Priority>('none');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();

  // Load folders on mount
  useEffect(() => {
    const loadFolders = async () => {
      const savedFolders = await getSetting<Folder[]>('todo_folders', []);
      setFolders(savedFolders);
    };
    loadFolders();
  }, [mode]);

  // NoteType from types/note.ts: 'sticky' | 'lined' | 'regular' | 'sketch' | 'code'
  const noteTypes: { type: NoteType; icon: React.ReactNode; label: string; color: string }[] = [
    { type: 'sticky', icon: <StickyNote className="h-6 w-6" />, label: t('notes.noteTypes.sticky', 'Sticky Note'), color: 'text-amber-500' },
    { type: 'lined', icon: <FileText className="h-6 w-6" />, label: t('notes.noteTypes.lined', 'Lined Note'), color: 'text-blue-500' },
    { type: 'regular', icon: <PenLine className="h-6 w-6" />, label: t('notes.noteTypes.regular', 'Regular Note'), color: 'text-emerald-500' },
    { type: 'sketch', icon: <Paintbrush className="h-6 w-6" />, label: t('notes.noteTypes.sketch', 'Sketch Note'), color: 'text-purple-500' },
    { type: 'code', icon: <Code className="h-6 w-6" />, label: t('notes.noteTypes.code', 'Code Note'), color: 'text-orange-500' },
  ];

  // Filter by visibility
  const visibleNoteTypes = noteTypes.filter(nt => isTypeVisible(nt.type));

  useEffect(() => {
    const handleAction = (event: CustomEvent<{ actionId: string }>) => {
      const { actionId } = event.detail;
      console.log('[QuickAdd] Action received:', actionId);
      
      if (actionId === 'add_note') {
        setMode('select_note_type');
      } else if (actionId === 'add_task') {
        setMode('add_task');
        // Reset task state
        setTaskText('');
        setDueDate(undefined);
        setPriority('none');
        setSelectedFolderId(undefined);
      }
    };

    window.addEventListener('persistentNotificationAction', handleAction as EventListener);
    return () => {
      window.removeEventListener('persistentNotificationAction', handleAction as EventListener);
    };
  }, []);

  const handleSelectNoteType = useCallback(async (type: NoteType) => {
    try {
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: '',
        content: '',
        type,
        createdAt: new Date(),
        updatedAt: new Date(),
        voiceRecordings: [],
        color: type === 'sticky' ? 'yellow' : undefined,
      };

      await saveNote(newNote);
      
      toast({
        title: t('notes.noteCreated', 'Note created'),
        description: t('notes.noteTypes.' + type, type),
      });
      
      // Navigate to notes page with the note open for editing
      window.location.href = `/?edit=${newNote.id}`;
      
      setMode(null);
    } catch (error) {
      console.error('Error creating note:', error);
      toast({
        title: t('errors.createNoteFailed', 'Failed to create note'),
        variant: 'destructive',
      });
    }
  }, [saveNote, toast, t]);

  const handleAddTask = useCallback(async () => {
    if (!taskText.trim()) return;

    setIsSubmitting(true);
    try {
      const tasks = await loadTodoItems();
      
      // Parse natural language if enabled
      let parsedData: Partial<TodoItem> = {};
      if (hasNaturalLanguagePatterns(taskText)) {
        const parsed = parseNaturalLanguageTask(taskText);
        parsedData = {
          text: parsed.text, // 'text' is the cleaned text in ParsedTask
          dueDate: parsed.dueDate,
          reminderTime: parsed.reminderTime,
          priority: parsed.priority,
          repeatType: parsed.repeatType,
        };
      }
      
      const newTask: TodoItem = {
        id: crypto.randomUUID(),
        text: parsedData.text || taskText.trim(),
        completed: false,
        createdAt: new Date(),
        priority: parsedData.priority || priority,
        dueDate: parsedData.dueDate || dueDate,
        reminderTime: parsedData.reminderTime,
        repeatType: parsedData.repeatType || 'none' as RepeatType,
        folderId: selectedFolderId,
      };

      await saveTodoItems([newTask, ...tasks]);
      
      // Schedule notification if reminder time is set
      if (newTask.reminderTime) {
        try {
          await notificationManager.scheduleTaskReminder(newTask);
        } catch (e) {
          console.warn('Failed to schedule notification:', e);
        }
      }
      
      toast({
        title: t('toasts.taskAdded', 'Task added'),
        description: newTask.text,
      });

      // Dispatch event to refresh task lists
      window.dispatchEvent(new CustomEvent('todoItemsChanged'));

      setTaskText('');
      setDueDate(undefined);
      setPriority('none');
      setSelectedFolderId(undefined);
      setMode(null);
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: t('errors.addTaskFailed', 'Failed to add task'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [taskText, priority, dueDate, selectedFolderId, toast, t]);

  const handleClose = () => {
    setMode(null);
    setTaskText('');
    setDueDate(undefined);
    setPriority('none');
  };

  const priorityColors: Record<Priority, string> = {
    none: 'text-muted-foreground',
    low: 'text-blue-500',
    medium: 'text-amber-500',
    high: 'text-red-500',
  };

  const cyclePriority = () => {
    const priorities: Priority[] = ['none', 'low', 'medium', 'high'];
    const currentIndex = priorities.indexOf(priority);
    const nextIndex = (currentIndex + 1) % priorities.length;
    setPriority(priorities[nextIndex]);
  };

  return (
    <>
      {/* Note Type Selection Sheet */}
      <Sheet open={mode === 'select_note_type'} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center justify-between">
              <span className="text-lg font-semibold">{t('notes.selectNoteType', 'Select Note Type')}</span>
              <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
                <X className="h-5 w-5" />
              </Button>
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 pb-6">
            {visibleNoteTypes.map(({ type, icon, label, color }) => (
              <button
                key={type}
                onClick={() => handleSelectNoteType(type)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleSelectNoteType(type);
                }}
                className={cn(
                  "flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border",
                  "hover:bg-muted hover:border-primary/30 active:scale-95 transition-all",
                  "touch-manipulation select-none"
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className={color}>{icon}</div>
                <span className="text-sm font-medium text-center">{label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Enhanced Add Task Sheet */}
      <Sheet open={mode === 'add_task'} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <SheetHeader className="pb-2 flex-shrink-0">
            <SheetTitle className="flex items-center justify-between">
              <span className="text-lg font-semibold">{t('tasks.quickAddTask', 'Quick Add Task')}</span>
              <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
                <X className="h-5 w-5" />
              </Button>
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-col gap-4 py-4 flex-1 overflow-y-auto">
            {/* Task Input */}
            <div className="relative">
              <Textarea
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                placeholder={t('tasks.naturalLanguagePlaceholder', 'e.g. Buy groceries tomorrow at 5pm')}
                className="min-h-[80px] pr-12 text-base resize-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && taskText.trim()) {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
              />
              <Button
                size="icon"
                className="absolute bottom-2 right-2 h-9 w-9"
                onClick={handleAddTask}
                disabled={!taskText.trim() || isSubmitting}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Options Row */}
            <div className="flex flex-wrap gap-2">
              {/* Templates Button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  toast({ title: t('tasks.templatesHint', 'Type your task above') });
                }}
              >
                <LayoutTemplate className="h-4 w-4" />
                {t('tasks.templates', 'Templates')}
              </Button>

              {/* Date Button */}
              <Button
                variant={dueDate ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(9, 0, 0, 0);
                  setDueDate(dueDate ? undefined : tomorrow);
                }}
              >
                <CalendarIcon className="h-4 w-4" />
                {dueDate ? format(dueDate, 'MMM d') : t('tasks.date', 'Date')}
              </Button>

              {/* Deadline (Today) Button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const today = new Date();
                  today.setHours(23, 59, 0, 0);
                  setDueDate(today);
                }}
              >
                <Timer className="h-4 w-4" />
                {t('tasks.deadline', 'Deadline')}
              </Button>

              {/* Priority Button */}
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-2", priorityColors[priority])}
                onClick={cyclePriority}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  cyclePriority();
                }}
              >
                <Flag className="h-4 w-4" />
                {priority === 'none' ? t('tasks.priority', 'Priority') : t(`tasks.priority_${priority}`, priority)}
              </Button>

              {/* Folder Selector */}
              {folders.length > 0 && (
                <Button
                  variant={selectedFolderId ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const currentIndex = folders.findIndex(f => f.id === selectedFolderId);
                    const nextIndex = (currentIndex + 1) % (folders.length + 1);
                    setSelectedFolderId(nextIndex === folders.length ? undefined : folders[nextIndex].id);
                  }}
                >
                  <FolderIcon className="h-4 w-4" />
                  {selectedFolderId 
                    ? folders.find(f => f.id === selectedFolderId)?.name || t('tasks.folder', 'Folder')
                    : t('tasks.folder', 'Folder')
                  }
                </Button>
              )}
            </div>

            {/* Hint Text */}
            <p className="text-xs text-muted-foreground">
              {t('tasks.naturalLanguageHint', 'Tip: Type "tomorrow at 3pm" or "next Monday" to auto-set date & time')}
            </p>
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex gap-3 pt-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleAddTask}
              disabled={!taskText.trim() || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? t('common.adding', 'Adding...') : t('tasks.addTask', 'Add Task')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

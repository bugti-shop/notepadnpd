import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Code, PenLine, StickyNote, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotes } from '@/contexts/NotesContext';
import { Note, NoteType, TodoItem } from '@/types/note';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { useToast } from '@/hooks/use-toast';

type QuickAddMode = 'select_note_type' | 'add_task' | null;

export const PersistentNotificationHandler = () => {
  const { t } = useTranslation();
  const { saveNote } = useNotes();
  const { toast } = useToast();
  const [mode, setMode] = useState<QuickAddMode>(null);
  const [taskText, setTaskText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NoteType from types/note.ts: 'sticky' | 'lined' | 'regular' | 'sketch' | 'code'
  const noteTypes: { type: NoteType; icon: React.ReactNode; label: string }[] = [
    { type: 'regular', icon: <FileText className="h-5 w-5" />, label: t('notes.textNote', 'Text Note') },
    { type: 'lined', icon: <PenLine className="h-5 w-5" />, label: t('notes.linedNote', 'Lined Note') },
    { type: 'sticky', icon: <StickyNote className="h-5 w-5" />, label: t('notes.stickyNote', 'Sticky Note') },
    { type: 'code', icon: <Code className="h-5 w-5" />, label: t('notes.codeNote', 'Code Note') },
  ];

  useEffect(() => {
    const handleAction = (event: CustomEvent<{ actionId: string }>) => {
      const { actionId } = event.detail;
      
      if (actionId === 'add_note') {
        setMode('select_note_type');
      } else if (actionId === 'add_task') {
        setMode('add_task');
        setTaskText('');
      }
    };

    window.addEventListener('persistentNotificationAction', handleAction as EventListener);
    return () => {
      window.removeEventListener('persistentNotificationAction', handleAction as EventListener);
    };
  }, []);

  const handleSelectNoteType = async (type: NoteType) => {
    try {
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: '',
        content: '',
        type,
        createdAt: new Date(),
        updatedAt: new Date(),
        voiceRecordings: [],
      };

      await saveNote(newNote);
      
      // Navigate to notes with the new note open
      window.location.href = `/notes?edit=${newNote.id}`;
      
      setMode(null);
    } catch (error) {
      console.error('Error creating note:', error);
      toast({
        title: t('errors.createNoteFailed', 'Failed to create note'),
        variant: 'destructive',
      });
    }
  };

  const handleAddTask = async () => {
    if (!taskText.trim()) return;

    setIsSubmitting(true);
    try {
      const tasks = await loadTodoItems();
      const newTask: TodoItem = {
        id: crypto.randomUUID(),
        text: taskText.trim(),
        completed: false,
        createdAt: new Date(),
        priority: 'medium',
      };

      await saveTodoItems([newTask, ...tasks]);
      
      toast({
        title: t('toasts.taskAdded', 'Task added'),
        description: taskText.trim(),
      });

      setTaskText('');
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
  };

  const handleClose = () => {
    setMode(null);
    setTaskText('');
  };

  return (
    <>
      {/* Note Type Selection Sheet */}
      <Sheet open={mode === 'select_note_type'} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center justify-between">
              <span>{t('notes.selectNoteType', 'Select Note Type')}</span>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {noteTypes.map(({ type, icon, label }) => (
              <button
                key={type}
                onClick={() => handleSelectNoteType(type)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted transition-colors"
              >
                <div className="text-primary">{icon}</div>
                <span className="text-xs font-medium text-center">{label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Task Sheet */}
      <Sheet open={mode === 'add_task'} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center justify-between">
              <span>{t('tasks.addTask', 'Add Task')}</span>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 py-4">
            <Input
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder={t('tasks.taskPlaceholder', 'What do you need to do?')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && taskText.trim()) {
                  handleAddTask();
                }
              }}
            />
            <div className="flex gap-2">
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
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

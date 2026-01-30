import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotes } from '@/contexts/NotesContext';
import { Note, NoteType, TodoItem, Folder } from '@/types/note';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { useToast } from '@/hooks/use-toast';
import { getSetting } from '@/utils/settingsStorage';
import { notificationManager } from '@/utils/notifications';
import { TaskInputSheet } from './TaskInputSheet';

export const PersistentNotificationHandler = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { saveNote } = useNotes();
  const { toast } = useToast();
  
  // Task input sheet state
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);

  // Load folders when task sheet opens
  useEffect(() => {
    if (showTaskInput) {
      const loadFolders = async () => {
        const savedFolders = await getSetting<Folder[]>('todo_folders', []);
        setFolders(savedFolders);
      };
      loadFolders();
    }
  }, [showTaskInput]);

  // Listen for persistent notification actions
  useEffect(() => {
    const handleAction = (event: CustomEvent<{ actionId: string }>) => {
      const { actionId } = event.detail;
      console.log('[QuickAdd] Action received:', actionId);
      
      if (actionId === 'add_note') {
        // Navigate to home and dispatch event to open note type dropdown
        navigate('/');
        // Small delay to ensure page is loaded before dispatching
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openNoteTypeSelector'));
        }, 100);
      } else if (actionId === 'add_task') {
        // Open the task input sheet (reusing existing component)
        setShowTaskInput(true);
      }
    };

    window.addEventListener('persistentNotificationAction', handleAction as EventListener);
    return () => {
      window.removeEventListener('persistentNotificationAction', handleAction as EventListener);
    };
  }, [navigate]);

  // Handle adding a task from the task input sheet
  const handleAddTask = useCallback(async (task: Omit<TodoItem, 'id' | 'completed'>) => {
    try {
      const tasks = await loadTodoItems();
      
      const newTask: TodoItem = {
        id: crypto.randomUUID(),
        ...task,
        completed: false,
        createdAt: new Date(),
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

      setShowTaskInput(false);
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: t('errors.addTaskFailed', 'Failed to add task'),
        variant: 'destructive',
      });
    }
  }, [toast, t]);

  const handleCreateFolder = useCallback(async (name: string, color: string) => {
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      color,
      isDefault: false,
      createdAt: new Date(),
    };
    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);
    await import('@/utils/settingsStorage').then(({ setSetting }) => {
      setSetting('todo_folders', updatedFolders);
    });
  }, [folders]);

  return (
    <TaskInputSheet
      isOpen={showTaskInput}
      onClose={() => setShowTaskInput(false)}
      onAddTask={handleAddTask}
      folders={folders}
      onCreateFolder={handleCreateFolder}
    />
  );
};

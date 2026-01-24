import { useState, useEffect, useMemo, useCallback } from 'react';
import { NotesCalendarView } from '@/components/NotesCalendarView';
import { Plus, ListTodo, CalendarDays, Clock, MapPin, Repeat, Trash2, Edit, Filter, MousePointer2, Eye, EyeOff, MoreVertical, Copy, FolderInput, Flag, CheckCheck, X, GripVertical, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskInputSheet } from '@/components/TaskInputSheet';
import { TodoItem, Folder, CalendarEvent, Priority } from '@/types/note';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskItem } from '@/components/TaskItem';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { TaskFilterSheet, DateFilter, PriorityFilter, StatusFilter } from '@/components/TaskFilterSheet';
import { SelectActionsSheet, SelectAction } from '@/components/SelectActionsSheet';
import { MoveToFolderSheet } from '@/components/MoveToFolderSheet';
import { PrioritySelectSheet } from '@/components/PrioritySelectSheet';
import { SmartListsDropdown, SmartListType, getSmartListFilter } from '@/components/SmartListsDropdown';
import { LocationRemindersMap } from '@/components/LocationRemindersMap';
import { TaskWidgets } from '@/components/TaskWidgets';
import { AddToCalendarDialog, useCalendarEventPrompt } from '@/components/AddToCalendarDialog';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { isSameDay, format, addDays, addWeeks, addMonths } from 'date-fns';
import { createNextRecurringTask } from '@/utils/recurringTasks';
import { playCompletionSound } from '@/utils/taskSounds';
import { cleanupCompletedTasks } from '@/utils/taskCleanup';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TodoLayout } from './TodoLayout';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, isGoogleCalendarEnabled } from '@/utils/googleCalendar';
import { toast } from 'sonner';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { notificationManager } from '@/utils/notifications';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EventEditor } from '@/components/EventEditor';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useTranslation } from 'react-i18next';

const TodoCalendar = () => {
  const { t } = useTranslation();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isEventEditorOpen, setIsEventEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [taskDates, setTaskDates] = useState<Date[]>([]);
  const [eventDates, setEventDates] = useState<Date[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedTask, setSelectedTask] = useState<TodoItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Advanced filters
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [smartList, setSmartList] = useState<SmartListType>('all');

  // Sheets
  const [isSelectActionsOpen, setIsSelectActionsOpen] = useState(false);
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [isPrioritySheetOpen, setIsPrioritySheetOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false);
  const [showWidgets, setShowWidgets] = useState(true);
  
  // Calendar event prompt
  const { showPrompt: showCalendarPrompt, pendingTask, promptAddToCalendar, closePrompt: closeCalendarPrompt } = useCalendarEventPrompt();

  const loadTasks = useCallback(async () => {
    let tasks = await loadTodoItems();
    
    // Auto-cleanup completed tasks older than 3 days
    const { cleanedTasks, deletedCount } = cleanupCompletedTasks(tasks, 3);
    if (deletedCount > 0) {
      await saveTodoItems(cleanedTasks);
      tasks = cleanedTasks;
      toast.info(`Auto-deleted ${deletedCount} completed task(s) older than 3 days`, { icon: '🧹' });
    }
    
    setItems(tasks);

    let filteredTasks = tasks;
    if (filterType === 'pending') filteredTasks = tasks.filter(task => !task.completed);
    else if (filterType === 'completed') filteredTasks = tasks.filter(task => task.completed);

    const dates = filteredTasks.filter(task => task.dueDate).map(task => new Date(task.dueDate!));
    setTaskDates(dates);

    // Load folders from IndexedDB
    const { getSetting } = await import('@/utils/settingsStorage');
    const savedFolders = await getSetting<Folder[]>('todoFolders', []);
    if (savedFolders.length > 0) setFolders(savedFolders);

    // Load calendar events from IndexedDB
    const savedEvents = await getSetting<CalendarEvent[]>('calendarEvents', []);
    if (savedEvents.length > 0) {
      const loadedEvents = savedEvents.map((e: CalendarEvent) => ({
        ...e,
        startDate: new Date(e.startDate),
        endDate: new Date(e.endDate),
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
      }));
      setEvents(loadedEvents);
      const evDates = loadedEvents.map((e: CalendarEvent) => new Date(e.startDate));
      setEventDates(evDates);
    }

  }, [filterType]);

  useEffect(() => {
    loadTasks();
    const handleTasksUpdate = () => loadTasks();
    window.addEventListener('tasksUpdated', handleTasksUpdate);
    window.addEventListener('storage', handleTasksUpdate);
    return () => {
      window.removeEventListener('tasksUpdated', handleTasksUpdate);
      window.removeEventListener('storage', handleTasksUpdate);
    };
  }, [loadTasks]);

  // Events for selected date (including recurring)
  const eventsForSelectedDate = useMemo(() => {
    if (!date) return [];
    
    return events.filter(event => {
      const eventStart = new Date(event.startDate);
      if (isSameDay(eventStart, date)) return true;
      if (event.repeat !== 'never') {
        return isRecurringEventOnDate(event, date);
      }
      return false;
    });
  }, [date, events]);


  const isRecurringEventOnDate = (event: CalendarEvent, targetDate: Date): boolean => {
    const eventStart = new Date(event.startDate);
    if (targetDate < eventStart) return false;
    
    const daysDiff = Math.floor((targetDate.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (event.repeat) {
      case 'daily': return true;
      case 'weekly': return daysDiff % 7 === 0;
      case 'monthly': return eventStart.getDate() === targetDate.getDate();
      case 'yearly': return eventStart.getDate() === targetDate.getDate() && eventStart.getMonth() === targetDate.getMonth();
      default: return false;
    }
  };

  const getRecurringEventDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    const futureLimit = new Date(today);
    futureLimit.setMonth(futureLimit.getMonth() + 3);
    
    events.forEach(event => {
      const eventStart = new Date(event.startDate);
      dates.push(eventStart);
      
      if (event.repeat !== 'never') {
        let currentDate = new Date(eventStart);
        while (currentDate <= futureLimit) {
          switch (event.repeat) {
            case 'daily': currentDate = addDays(currentDate, 1); break;
            case 'weekly': currentDate = addWeeks(currentDate, 1); break;
            case 'monthly': currentDate = addMonths(currentDate, 1); break;
            case 'yearly': currentDate = addMonths(currentDate, 12); break;
            default: currentDate = futureLimit;
          }
          if (currentDate <= futureLimit) {
            dates.push(new Date(currentDate));
          }
        }
      }
    });

    
    return dates;
  }, [events]);

  // Selection mode handlers
  const handleToggleSelection = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const taskIds = tasksForSelectedDate.filter(t => !t.completed).map(t => t.id);
    setSelectedTaskIds(new Set(taskIds));
  }, []);

  const handleSelectAction = async (action: SelectAction) => {
    const selectedTasks = items.filter(t => selectedTaskIds.has(t.id));
    
    switch (action) {
      case 'complete':
        for (const task of selectedTasks) {
          await handleUpdateTask(task.id, { completed: true });
        }
        toast.success(`Completed ${selectedTasks.length} task(s)`);
        break;
      case 'delete':
        for (const task of selectedTasks) {
          await handleDeleteTask(task.id);
        }
        toast.success(`Deleted ${selectedTasks.length} task(s)`);
        break;
      case 'move':
        setIsMoveToFolderOpen(true);
        return;
      case 'priority':
        setIsPrioritySheetOpen(true);
        return;
      case 'duplicate':
        for (const task of selectedTasks) {
          const duplicatedTask: TodoItem = { ...task, id: Date.now().toString() + Math.random(), completed: false };
          const updatedItems = [...items, duplicatedTask];
          setItems(updatedItems);
          await saveTodoItems(updatedItems);
        }
        toast.success(`Duplicated ${selectedTasks.length} task(s)`);
        break;
    }
    
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    window.dispatchEvent(new Event('tasksUpdated'));
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    const updatedItems = items.map(item => 
      selectedTaskIds.has(item.id) ? { ...item, folderId: folderId || undefined } : item
    );
    setItems(updatedItems);
    await saveTodoItems(updatedItems);
    toast.success(`Moved ${selectedTaskIds.size} task(s)`);
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    setIsMoveToFolderOpen(false);
    window.dispatchEvent(new Event('tasksUpdated'));
  };

  const handleSetPriority = async (priority: Priority) => {
    const updatedItems = items.map(item => 
      selectedTaskIds.has(item.id) ? { ...item, priority } : item
    );
    setItems(updatedItems);
    await saveTodoItems(updatedItems);
    toast.success(`Updated priority for ${selectedTaskIds.size} task(s)`);
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    setIsPrioritySheetOpen(false);
    window.dispatchEvent(new Event('tasksUpdated'));
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsEventEditorOpen(true);
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    setEventToDelete(event);
  };

  const confirmDeleteEvent = async () => {
    if (eventToDelete) {
      const { setSetting } = await import('@/utils/settingsStorage');
      const updatedEvents = events.filter(e => e.id !== eventToDelete.id);
      setEvents(updatedEvents);
      await setSetting('calendarEvents', updatedEvents);
      notificationManager.cancelTaskReminder(eventToDelete.id).catch(console.error);
      toast.success('Event deleted');
      setEventToDelete(null);
    }
  };

  const handleSaveEvent = async (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const { setSetting } = await import('@/utils/settingsStorage');
    if (editingEvent) {
      const updatedEvent: CalendarEvent = { ...editingEvent, ...eventData, updatedAt: new Date() };
      const updatedEvents = events.map(e => e.id === editingEvent.id ? updatedEvent : e);
      setEvents(updatedEvents);
      await setSetting('calendarEvents', updatedEvents);
      await scheduleEventNotification(updatedEvent);
      setEditingEvent(null);
    } else {
      const newEvent: CalendarEvent = { ...eventData, id: Date.now().toString(), createdAt: new Date(), updatedAt: new Date() };
      const updatedEvents = [...events, newEvent];
      setEvents(updatedEvents);
      await setSetting('calendarEvents', updatedEvents);
      await scheduleEventNotification(newEvent);
    }
  };

  const scheduleEventNotification = async (event: CalendarEvent) => {
    try {
      await notificationManager.cancelTaskReminder(event.id);
      
      const getReminderOffset = (reminder: string): number => {
        switch (reminder) {
          case '5min': return 5 * 60 * 1000;
          case '10min': return 10 * 60 * 1000;
          case '15min': return 15 * 60 * 1000;
          case '30min': return 30 * 60 * 1000;
          case '1hour': return 60 * 60 * 1000;
          case '1day': return 24 * 60 * 60 * 1000;
          default: return 0;
        }
      };

      const offset = getReminderOffset(event.reminder);
      const now = new Date();
      const futureLimit = new Date(now);
      futureLimit.setMonth(futureLimit.getMonth() + 1);

      const occurrences: Date[] = [];
      let currentDate = new Date(event.startDate);
      
      if (event.repeat === 'never') {
        if (currentDate > now) occurrences.push(currentDate);
      } else {
        while (currentDate <= futureLimit) {
          if (currentDate > now) occurrences.push(new Date(currentDate));
          switch (event.repeat) {
            case 'daily': currentDate = addDays(currentDate, 1); break;
            case 'weekly': currentDate = addWeeks(currentDate, 1); break;
            case 'monthly': currentDate = addMonths(currentDate, 1); break;
            case 'yearly': currentDate = addMonths(currentDate, 12); break;
            default: currentDate = futureLimit;
          }
        }
      }

      for (let i = 0; i < Math.min(occurrences.length, 10); i++) {
        const occurrence = occurrences[i];
        const reminderTime = new Date(occurrence.getTime() - offset);
        
        if (reminderTime > now) {
          const fakeTask: TodoItem = { id: `${event.id}-${i}`, text: event.title, completed: false, reminderTime, priority: 'medium' };
          await notificationManager.scheduleTaskReminder(fakeTask);
        }
      }
    } catch (error) {
      console.error('Failed to schedule event notification:', error);
    }
  };

  const handleAddTask = async (task: Omit<TodoItem, 'id' | 'completed'>) => {
    const newItem: TodoItem = { id: Date.now().toString(), completed: false, ...task };

    if (newItem.dueDate || newItem.reminderTime) {
      try { await notificationManager.scheduleTaskReminder(newItem); } catch (error) { console.error('Failed to schedule notification:', error); }
    }
    
    // Check if Google Calendar is enabled via the old utility
    const calendarEnabled = await isGoogleCalendarEnabled();
    if (calendarEnabled && newItem.dueDate) {
      const eventId = await createCalendarEvent(newItem);
      if (eventId) {
        newItem.googleCalendarEventId = eventId;
        toast.success('Task synced to Google Calendar');
      }
    }
    
    const allItems = await loadTodoItems();
    allItems.unshift(newItem);
    await saveTodoItems(allItems);
    setItems(allItems);
    setTaskDates(allItems.filter(t => t.dueDate).map(t => new Date(t.dueDate!)));
    window.dispatchEvent(new Event('tasksUpdated'));
    
    // Also prompt via the new Google Auth dialog if not already synced
    if (newItem.dueDate && !newItem.googleCalendarEventId) {
      promptAddToCalendar(newItem);
    }
  };
  
  const handleCalendarEventCreated = (eventId: string) => {
    if (pendingTask) {
      setItems(prev => prev.map(item => 
        item.id === pendingTask.id 
          ? { ...item, googleCalendarEventId: eventId }
          : item
      ));
    }
  };

  const handleCreateFolder = async (name: string, color: string) => {
    const { setSetting } = await import('@/utils/settingsStorage');
    const newFolder: Folder = { id: Date.now().toString(), name, color, isDefault: false, createdAt: new Date() };
    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);
    await setSetting('todoFolders', updatedFolders);
  };

  const handleUpdateTask = async (itemId: string, updates: Partial<TodoItem>) => {
    const currentItem = items.find(t => t.id === itemId);
    
    // Play completion sound when completing a task
    if (updates.completed === true && currentItem && !currentItem.completed) {
      playCompletionSound();
    }
    
    // Check if this is a recurring task being completed
    if (currentItem && updates.completed === true && !currentItem.completed) {
      if (currentItem.repeatType && currentItem.repeatType !== 'none') {
        const nextTask = createNextRecurringTask(currentItem);
        if (nextTask) {
          const updatedItems = [nextTask, ...items.map(t => t.id === itemId ? { ...t, ...updates } : t)];
          setItems(updatedItems);
          await saveTodoItems(updatedItems);
          toast.success('Recurring task completed! Next occurrence created.', { icon: '🔄' });
          window.dispatchEvent(new Event('tasksUpdated'));
          return;
        }
      }
    }
    
    const updatedItems = items.map(task => {
      if (task.id === itemId) {
        const updatedTask = { ...task, ...updates };
        if (updatedTask.googleCalendarEventId && updatedTask.dueDate) {
          isGoogleCalendarEnabled().then(enabled => {
            if (enabled) updateCalendarEvent(updatedTask.googleCalendarEventId!, updatedTask);
          });
        }
        return updatedTask;
      }
      return task;
    });
    setItems(updatedItems);
    await saveTodoItems(updatedItems);
    window.dispatchEvent(new Event('tasksUpdated'));

  };

  const handleDeleteTask = async (itemId: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    const taskToDelete = items.find(t => t.id === itemId);
    if (taskToDelete?.googleCalendarEventId) {
      const enabled = await isGoogleCalendarEnabled();
      if (enabled) await deleteCalendarEvent(taskToDelete.googleCalendarEventId);
    }


    const updatedItems = items.filter(task => task.id !== itemId);
    setItems(updatedItems);
    await saveTodoItems(updatedItems);
    window.dispatchEvent(new Event('tasksUpdated'));
  };

  const handleTaskClick = (task: TodoItem) => {
    if (isSelectionMode) {
      handleToggleSelection(task.id);
    } else {
      setSelectedTask(task);
      setIsDetailOpen(true);
    }
  };

  const handleImageClick = (imageUrl: string) => window.open(imageUrl, '_blank');

  // Filter tasks for selected date with smart list and priority filters
  const tasksForSelectedDate = useMemo(() => {
    if (!date) return [];
    
    let filtered = items.filter(task => {
      if (!task.dueDate) return false;
      const matches = isSameDay(new Date(task.dueDate), date);
      if (filterType === 'pending') return matches && !task.completed;
      if (filterType === 'completed') return matches && task.completed;
      return matches;
    });

    // Apply smart list filter
    if (smartList !== 'all') {
      filtered = filtered.filter(getSmartListFilter(smartList));
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    // Apply tag filter
    if (tagFilter.length > 0) {
      filtered = filtered.filter(task => 
        task.coloredTags?.some(tag => tagFilter.includes(tag.name))
      );
    }

    return filtered;
  }, [date, items, filterType, smartList, priorityFilter, tagFilter]);

  // Check if there are tasks with location reminders
  const hasLocationTasks = useMemo(() => {
    return items.some(task => task.locationReminder?.enabled);
  }, [items]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (priorityFilter !== 'all') count++;
    if (tagFilter.length > 0) count++;
    if (smartList !== 'all') count++;
    return count;
  }, [priorityFilter, tagFilter, smartList]);

  // Drag and drop handler
  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || !date) return;
    
    const { source, destination } = result;
    if (source.index === destination.index) return;

    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}

    const filteredTasks = tasksForSelectedDate.filter(t => showCompleted || !t.completed);
    const reorderedTasks = Array.from(filteredTasks);
    const [removed] = reorderedTasks.splice(source.index, 1);
    reorderedTasks.splice(destination.index, 0, removed);

    // Update the full items array with new order
    const taskIdsInOrder = reorderedTasks.map(t => t.id);
    const otherTasks = items.filter(t => !taskIdsInOrder.includes(t.id));
    const updatedItems = [...reorderedTasks, ...otherTasks];
    
    setItems(updatedItems);
    await saveTodoItems(updatedItems);
    window.dispatchEvent(new Event('tasksUpdated'));
  }, [date, tasksForSelectedDate, showCompleted, items]);

  return (
    <TodoLayout title={t('calendar.title')}>
      <main className="container mx-auto px-4 py-6 pb-32">
        <div className="max-w-md mx-auto space-y-4">
          {/* Selection mode actions */}
          {isSelectionMode && (
            <div className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedTaskIds.size > 0 && selectedTaskIds.size === tasksForSelectedDate.filter(t => !t.completed).length}
                  onCheckedChange={(checked) => {
                    if (checked) handleSelectAll();
                    else setSelectedTaskIds(new Set());
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedTaskIds.size} selected
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setIsSelectActionsOpen(true)} disabled={selectedTaskIds.size === 0}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedTaskIds(new Set()); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <NotesCalendarView 
            selectedDate={date} 
            onDateSelect={setDate} 
            taskDates={taskDates} 
            eventDates={getRecurringEventDates} 
          />

          {date && (
            <div className="space-y-4">
              {/* Events for selected date */}
              {eventsForSelectedDate.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    {t('calendar.events')}
                  </h3>
                  <div className="space-y-2">
                    {eventsForSelectedDate.map((event) => (
                      <Card key={event.id} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{event.title}</h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {event.allDay ? t('calendar.allDay') : `${format(new Date(event.startDate), 'h:mm a')} - ${format(new Date(event.endDate), 'h:mm a')}`}
                                </span>
                                {event.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {event.location}
                                  </span>
                                )}
                                {event.repeat !== 'never' && (
                                  <span className="flex items-center gap-1">
                                    <Repeat className="h-3 w-3" />
                                    {event.repeat}
                                  </span>
                                )}
                              </div>
                              {event.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditEvent(event)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteEvent(event)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks for selected date */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-primary" />
                  {t('calendar.tasksForDate', { date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}
                  {tasksForSelectedDate.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{tasksForSelectedDate.length}</Badge>
                  )}
                </h3>
                {tasksForSelectedDate.length > 0 ? (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="calendar-tasks">
                      {(provided) => (
                        <ScrollArea className="h-[250px]">
                          <div 
                            className="space-y-2 pr-4"
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                          >
                            {tasksForSelectedDate
                              .filter(task => showCompleted || !task.completed)
                              .map((task, index) => (
                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className={cn(
                                        "flex items-start gap-2",
                                        snapshot.isDragging && "opacity-70 shadow-lg rounded-lg"
                                      )}
                                    >
                                      <div 
                                        {...provided.dragHandleProps}
                                        className="mt-3 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </div>
                                      {isSelectionMode && (
                                        <Checkbox
                                          checked={selectedTaskIds.has(task.id)}
                                          onCheckedChange={() => handleToggleSelection(task.id)}
                                          className="mt-3"
                                        />
                                      )}
                                      <div className="flex-1">
                                        <TaskItem 
                                          item={task} 
                                          onUpdate={handleUpdateTask} 
                                          onDelete={handleDeleteTask} 
                                          onTaskClick={handleTaskClick} 
                                          onImageClick={handleImageClick} 
                                          allTasks={items} 
                                        />
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                            {provided.placeholder}
                          </div>
                        </ScrollArea>
                      )}
                    </Droppable>
                  </DragDropContext>
                ) : (
                  <p className="text-muted-foreground text-center py-4">{filterType !== 'all' ? t('emptyStates.noTasksFiltered', { filter: filterType }) : t('calendar.noTasksForDate')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="fixed bottom-20 left-4 right-4 z-30 h-12 text-base font-semibold" size="lg">
            <Plus className="h-5 w-5" />{t('calendar.addNew')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="mb-2 w-48 z-50 bg-card">
          <DropdownMenuItem onClick={() => setIsInputOpen(true)} className="gap-2">
            <ListTodo className="h-4 w-4" />
            {t('calendar.addTask')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setEditingEvent(null); setIsEventEditorOpen(true); }} className="gap-2">
            <CalendarDays className="h-4 w-4" />
            {t('calendar.addEvent')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskInputSheet isOpen={isInputOpen} onClose={() => setIsInputOpen(false)} onAddTask={handleAddTask} folders={folders} selectedFolderId={null} onCreateFolder={handleCreateFolder} defaultDate={date} />

      <EventEditor
        event={editingEvent}
        isOpen={isEventEditorOpen}
        onClose={() => { setIsEventEditorOpen(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        defaultDate={date}
      />

      {/* Filter Sheet */}
      <TaskFilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        folders={folders}
        selectedFolderId={null}
        onFolderChange={() => {}}
        dateFilter={'all'}
        onDateFilterChange={() => {}}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        statusFilter={'all'}
        onStatusFilterChange={() => {}}
        selectedTags={tagFilter}
        onTagsChange={setTagFilter}
        onClearAll={() => {
          setPriorityFilter('all');
          setTagFilter([]);
          setSmartList('all');
        }}
      />

      {/* Select Actions Sheet */}
      <SelectActionsSheet
        isOpen={isSelectActionsOpen}
        onClose={() => setIsSelectActionsOpen(false)}
        onAction={handleSelectAction}
        selectedCount={selectedTaskIds.size}
        totalCount={tasksForSelectedDate.filter(t => !t.completed).length}
      />

      {/* Move to Folder Sheet */}
      <MoveToFolderSheet
        isOpen={isMoveToFolderOpen}
        onClose={() => setIsMoveToFolderOpen(false)}
        folders={folders}
        onSelect={handleMoveToFolder}
      />

      {/* Priority Select Sheet */}
      <PrioritySelectSheet
        isOpen={isPrioritySheetOpen}
        onClose={() => setIsPrioritySheetOpen(false)}
        onSelect={handleSetPriority}
      />

      {/* Location Map */}
      <LocationRemindersMap
        open={isLocationMapOpen}
        onOpenChange={setIsLocationMapOpen}
        tasks={items.filter(t => t.locationReminder?.enabled)}
      />

      {/* Delete Event Confirmation */}
      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{eventToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEvent} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedTask && (
        <TaskDetailSheet
          task={selectedTask}
          isOpen={isDetailOpen}
          onClose={() => { setIsDetailOpen(false); setSelectedTask(null); }}
          onUpdate={(updatedTask) => handleUpdateTask(updatedTask.id, updatedTask)}
          onDelete={handleDeleteTask}
          onDuplicate={async (task) => {
            const duplicatedTask: TodoItem = { ...task, id: Date.now().toString(), completed: false };
            const updatedItems = [...items, duplicatedTask];
            setItems(updatedItems);
            await saveTodoItems(updatedItems);
            window.dispatchEvent(new Event('tasksUpdated'));
          }}
        />
      )}
      
      {/* Add to Google Calendar Dialog */}
      {pendingTask && (
        <AddToCalendarDialog
          isOpen={showCalendarPrompt}
          onClose={closeCalendarPrompt}
          task={pendingTask}
          onEventCreated={handleCalendarEventCreated}
        />
      )}
    </TodoLayout>
  );
};

export default TodoCalendar;

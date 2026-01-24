import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem, Folder, Priority, Note, TaskSection, TaskStatus } from '@/types/note';
import { WaveformProgressBar } from '@/components/WaveformProgressBar';
import { Play, Pause, Repeat, Check, Trash2 as TrashIcon, Edit, Plus as PlusIcon, ArrowUpCircle, ArrowDownCircle, Move, History, TrendingUp, Flag, MapPin, ChevronsUpDown, Circle, Loader2, Clock as ClockIcon } from 'lucide-react';
import { Plus, FolderIcon, ChevronRight, ChevronDown, MoreVertical, Eye, EyeOff, Filter, Copy, MousePointer2, FolderPlus, Settings, LayoutList, LayoutGrid, Trash2, ListPlus, Tag, ArrowDownAZ, ArrowUpDown, Sun, Columns3, GitBranch, X, Search, ListChecks } from 'lucide-react';
import { LocationRemindersMap } from '@/components/LocationRemindersMap';
import { TaskWidgets } from '@/components/TaskWidgets';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskInputSheet } from '@/components/TaskInputSheet';
import { TaskDetailPage } from '@/components/TaskDetailPage';
import { TaskItem } from '@/components/TaskItem';
import { TaskFilterSheet, DateFilter, PriorityFilter, StatusFilter } from '@/components/TaskFilterSheet';
import { DuplicateOptionsSheet, DuplicateOption } from '@/components/DuplicateOptionsSheet';
import { FolderManageSheet } from '@/components/FolderManageSheet';
import { MoveToFolderSheet } from '@/components/MoveToFolderSheet';
import { SelectActionsSheet, SelectAction } from '@/components/SelectActionsSheet';
import { PrioritySelectSheet } from '@/components/PrioritySelectSheet';
import { BatchTaskSheet } from '@/components/BatchTaskSheet';
import { SectionEditSheet } from '@/components/SectionEditSheet';
import { SectionMoveSheet } from '@/components/SectionMoveSheet';
import { TaskOptionsSheet } from '@/components/TaskOptionsSheet';
import { BulkDateSheet } from '@/components/BulkDateSheet';
import { BulkReminderSheet } from '@/components/BulkReminderSheet';
import { BulkRepeatSheet } from '@/components/BulkRepeatSheet';
import { BulkSectionMoveSheet } from '@/components/BulkSectionMoveSheet';
import { BulkStatusSheet } from '@/components/BulkStatusSheet';
import { UnifiedDragDropList } from '@/components/UnifiedDragDropList';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { SubtaskDetailSheet } from '@/components/SubtaskDetailSheet';
import { SmartListType, getSmartListFilter, useSmartLists } from '@/components/SmartListsDropdown';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { notificationManager } from '@/utils/notifications';
import { createNextRecurringTask } from '@/utils/recurringTasks';
import { cleanupCompletedTasks } from '@/utils/taskCleanup';
import { startGeofenceWatching, hasLocationReminders } from '@/utils/geofencing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sparkles, AlertCircle, CalendarX, Flame, Clock, CheckCircle2, Calendar as CalendarIcon2, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TodoLayout } from './TodoLayout';
import { toast } from 'sonner';
import { isToday, isTomorrow, isThisWeek, isBefore, startOfDay, format, isYesterday, subDays } from 'date-fns';
import { loadTodoItems, saveTodoItems, resolveTaskMediaUrl } from '@/utils/todoItemsStorage';
import { updateSectionOrder, applyTaskOrder, removeTaskFromOrders } from '@/utils/taskOrderStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { ResolvedTaskImage } from '@/components/ResolvedTaskImage';
import { useResolvedTaskMedia } from '@/hooks/useResolvedTaskMedia';
import { ResolvedImageDialog } from '@/components/ResolvedImageDialog';
import { playCompletionSound } from '@/utils/taskSounds';
import { HideDetailsOptions } from '@/components/TaskOptionsSheet';
import { logActivity } from '@/utils/activityLogger';
import { AddToCalendarDialog, useCalendarEventPrompt } from '@/components/AddToCalendarDialog';

type ViewMode = 'flat' | 'kanban' | 'kanban-status' | 'timeline' | 'progress' | 'priority' | 'history';
type SortBy = 'date' | 'priority' | 'name' | 'created';

const defaultSections: TaskSection[] = [
  { id: 'default', name: 'Tasks', color: '#3b82f6', isCollapsed: false, order: 0 }
];

const Today = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sections, setSections] = useState<TaskSection[]>(defaultSections);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [inputSectionId, setInputSectionId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TodoItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isDuplicateSheetOpen, setIsDuplicateSheetOpen] = useState(false);
  const [isFolderManageOpen, setIsFolderManageOpen] = useState(false);
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [isSelectActionsOpen, setIsSelectActionsOpen] = useState(false);
  const [isPrioritySheetOpen, setIsPrioritySheetOpen] = useState(false);
  const [isBatchTaskOpen, setIsBatchTaskOpen] = useState(false);
  const [isSectionEditOpen, setIsSectionEditOpen] = useState(false);
  const [isSectionMoveOpen, setIsSectionMoveOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<TaskSection | null>(null);
  const [selectedSubtask, setSelectedSubtask] = useState<{ subtask: TodoItem; parentId: string } | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [smartList, setSmartList] = useState<SmartListType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('flat');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [hideDetailsOptions, setHideDetailsOptions] = useState<HideDetailsOptions>({ hideDateTime: false, hideStatus: false, hideSubtasks: false });
  const [dropdownView, setDropdownView] = useState<'main' | 'smartLists' | 'sortBy' | 'groupBy'>('main');
  const [compactMode, setCompactMode] = useState<boolean>(false);
  const [groupByOption, setGroupByOption] = useState<'none' | 'section' | 'priority' | 'date'>('none');
  const [subtaskSwipeState, setSubtaskSwipeState] = useState<{ id: string; parentId: string; x: number; isSwiping: boolean } | null>(null);
  const subtaskTouchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const smartListData = useSmartLists(items);
  const [viewModeSearch, setViewModeSearch] = useState(''); // Search within view modes
  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false);
  const [isBulkDateSheetOpen, setIsBulkDateSheetOpen] = useState(false);
  const [isBulkReminderSheetOpen, setIsBulkReminderSheetOpen] = useState(false);
  const [isBulkRepeatSheetOpen, setIsBulkRepeatSheetOpen] = useState(false);
  const [isBulkSectionMoveOpen, setIsBulkSectionMoveOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [isTaskOptionsOpen, setIsTaskOptionsOpen] = useState(false);
  // Counter to force re-render after drag-drop reordering
  const [orderVersion, setOrderVersion] = useState(0);
  // New task options state
  const [defaultSectionId, setDefaultSectionId] = useState<string | undefined>();
  const [taskAddPosition, setTaskAddPosition] = useState<'top' | 'bottom'>('top');
  const [showStatusBadge, setShowStatusBadge] = useState<boolean>(true);
  const [groupBy, setGroupBy] = useState<'custom' | 'date' | 'priority'>('custom');
  const [optionsSortBy, setOptionsSortBy] = useState<'custom' | 'date' | 'priority'>('custom');
  // Flag to prevent saving settings before they're loaded from IndexedDB
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Calendar event prompt hook
  const { showPrompt: showCalendarPrompt, pendingTask, promptAddToCalendar, closePrompt: closeCalendarPrompt } = useCalendarEventPrompt();

  useEffect(() => {
    const loadAll = async () => {
      let loadedItems = await loadTodoItems();
      
      // Auto-rollover repeat tasks that are overdue
      const { processTaskRollovers } = await import('@/utils/taskRollover');
      const { tasks: rolledOverItems, rolledOverCount } = processTaskRollovers(loadedItems);
      if (rolledOverCount > 0) {
        await saveTodoItems(rolledOverItems);
        loadedItems = rolledOverItems;
        toast.info(`Auto-updated ${rolledOverCount} recurring task(s) to next date`, { icon: '🔄' });
      }
      
      // Auto-cleanup completed tasks older than 3 days
      const { cleanedTasks, deletedCount } = cleanupCompletedTasks(loadedItems, 3);
      if (deletedCount > 0) {
        await saveTodoItems(cleanedTasks);
        loadedItems = cleanedTasks;
        toast.info(`Auto-deleted ${deletedCount} completed task(s) older than 3 days`, { icon: '🧹' });
      }
      
      setItems(loadedItems);
      notificationManager.rescheduleAllTasks(loadedItems).catch(console.error);
    };
    loadAll();

    // Load settings from IndexedDB
    const loadSettings = async () => {
      const savedFolders = await getSetting<Folder[] | null>('todoFolders', null);
      if (savedFolders) {
        setFolders(savedFolders.map((f: Folder) => ({ ...f, createdAt: new Date(f.createdAt) })));
      }

      const savedSections = await getSetting<TaskSection[]>('todoSections', []);
      setSections(savedSections.length > 0 ? savedSections : defaultSections);

      const savedShowCompleted = await getSetting<boolean>('todoShowCompleted', true);
      setShowCompleted(savedShowCompleted);
      
      const savedDateFilter = await getSetting<DateFilter>('todoDateFilter', 'all');
      setDateFilter(savedDateFilter);
      
      const savedPriorityFilter = await getSetting<PriorityFilter>('todoPriorityFilter', 'all');
      setPriorityFilter(savedPriorityFilter);
      
      const savedStatusFilter = await getSetting<StatusFilter>('todoStatusFilter', 'all');
      setStatusFilter(savedStatusFilter);
      
      const savedTagFilter = await getSetting<string[]>('todoTagFilter', []);
      setTagFilter(savedTagFilter);
      
      const savedViewMode = await getSetting<ViewMode>('todoViewMode', 'flat');
      setViewMode(savedViewMode);
      
      const savedHideDetails = await getSetting<HideDetailsOptions>('todoHideDetailsOptions', { hideDateTime: false, hideStatus: false, hideSubtasks: false });
      setHideDetailsOptions(savedHideDetails);
      
      const savedSortBy = await getSetting<SortBy>('todoSortBy', 'date');
      setSortBy(savedSortBy);
      
      const savedSmartList = await getSetting<SmartListType>('todoSmartList', 'all');
      setSmartList(savedSmartList);
      
      const savedFolderId = await getSetting<string | null>('todoSelectedFolder', null);
      setSelectedFolderId(savedFolderId === 'null' ? null : savedFolderId);
      
      const savedDefaultSection = await getSetting<string>('todoDefaultSectionId', '');
      setDefaultSectionId(savedDefaultSection || undefined);
      
      const savedTaskAddPos = await getSetting<'top' | 'bottom'>('todoTaskAddPosition', 'bottom');
      setTaskAddPosition(savedTaskAddPos);
      
      const savedShowStatusBadge = await getSetting<boolean>('todoShowStatusBadge', true);
      setShowStatusBadge(savedShowStatusBadge);
      
      const savedCompactMode = await getSetting<boolean>('todoCompactMode', false);
      setCompactMode(savedCompactMode);
      
      const savedGroupByOption = await getSetting<'none' | 'section' | 'priority' | 'date'>('todoGroupByOption', 'none');
      setGroupByOption(savedGroupByOption);
      
      // Mark settings as loaded to enable saving
      setSettingsLoaded(true);
    };
    loadSettings();
  }, []);

  useEffect(() => { 
    saveTodoItems(items).then(({ persisted }) => {
      if (!persisted) {
        toast.error('Storage full! Some data may not save.', { id: 'storage-full' });
      }
    });
    window.dispatchEvent(new Event('tasksUpdated'));
  }, [items]);
  // Only save settings AFTER they have been loaded from IndexedDB to prevent race conditions
  useEffect(() => { if (settingsLoaded) setSetting('todoFolders', folders); }, [folders, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoSections', sections); }, [sections, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoShowCompleted', showCompleted); }, [showCompleted, settingsLoaded]);
  useEffect(() => { 
    if (!settingsLoaded) return;
    setSetting('todoDateFilter', dateFilter); 
    setSetting('todoPriorityFilter', priorityFilter);
    setSetting('todoStatusFilter', statusFilter);
    setSetting('todoTagFilter', tagFilter);
  }, [dateFilter, priorityFilter, statusFilter, tagFilter, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoViewMode', viewMode); logActivity('view_mode_change', `View mode: ${viewMode}`); } }, [viewMode, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoHideDetailsOptions', hideDetailsOptions); }, [hideDetailsOptions, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoSortBy', sortBy); logActivity('sort_change', `Sort by: ${sortBy}`); } }, [sortBy, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoSmartList', smartList); logActivity('smart_list_change', `Smart list: ${smartList}`); } }, [smartList, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoSelectedFolder', selectedFolderId || 'null'); }, [selectedFolderId, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoDefaultSectionId', defaultSectionId || ''); }, [defaultSectionId, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoTaskAddPosition', taskAddPosition); }, [taskAddPosition, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoShowStatusBadge', showStatusBadge); }, [showStatusBadge, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoCompactMode', compactMode); logActivity('compact_mode_toggle', `Compact mode: ${compactMode}`); } }, [compactMode, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoGroupByOption', groupByOption); logActivity('group_by_change', `Group by: ${groupByOption}`); } }, [groupByOption, settingsLoaded]);

  // Start geofencing for location-based reminders
  useEffect(() => {
    if (hasLocationReminders(items)) {
      const stopWatching = startGeofenceWatching(() => items);
      return stopWatching;
    }
  }, [items]);

  const handleCreateFolder = (name: string, color: string) => {
    const newFolder: Folder = { id: Date.now().toString(), name, color, isDefault: false, createdAt: new Date() };
    setFolders([...folders, newFolder]);
  };

  const handleEditFolder = (folderId: string, name: string, color: string) => {
    setFolders(folders.map(f => f.id === folderId ? { ...f, name, color } : f));
  };

  const handleDeleteFolder = (folderId: string) => {
    setItems(items.map(item => item.folderId === folderId ? { ...item, folderId: undefined } : item));
    setFolders(folders.filter(f => f.id !== folderId));
    if (selectedFolderId === folderId) setSelectedFolderId(null);
  };

  const handleReorderFolders = (reorderedFolders: Folder[]) => {
    setFolders(reorderedFolders);
    toast.success('Folders reordered');
  };

  const handleSectionDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    
    const sortedSects = [...sections].sort((a, b) => a.order - b.order);
    const [removed] = sortedSects.splice(sourceIndex, 1);
    sortedSects.splice(destIndex, 0, removed);
    
    const reordered = sortedSects.map((s, idx) => ({ ...s, order: idx }));
    setSections(reordered);
  };

  const handleAddTask = async (task: Omit<TodoItem, 'id' | 'completed'>) => {
    const now = new Date();
    const newItem: TodoItem = { 
      id: Date.now().toString(), 
      completed: false, 
      sectionId: inputSectionId || defaultSectionId || sections[0]?.id,
      dueDate: task.dueDate || new Date(), // Default to current date if no date specified
      createdAt: now,
      modifiedAt: now,
      status: 'not_started', // Default status
      // Default reminder to "instant" if task has date/time but no reminder set
      reminderTime: (task.dueDate && !task.reminderTime) ? task.dueDate : task.reminderTime,
      ...task 
    };

    // If user set ANY date/time (including via NLP), schedule immediately.
    const shouldSchedule = !!task.dueDate || !!task.reminderTime;
    if (shouldSchedule) {
      try { await notificationManager.scheduleTaskReminder(newItem); } catch (error) { console.error('Failed to schedule notification:', error); }
    } else {
      // Schedule auto-reminders for tasks without date/time (3x daily)
      try { await notificationManager.scheduleAutoReminders(newItem); } catch (error) { console.error('Failed to schedule auto-reminders:', error); }
    }

    // Add task based on user preference (top or bottom)
    if (taskAddPosition === 'bottom') {
      setItems([...items, newItem]);
    } else {
      setItems([newItem, ...items]);
    }
    setInputSectionId(null);
    
    // Prompt to add to Google Calendar if task has a due date and calendar sync is enabled
    if (newItem.dueDate && !newItem.googleCalendarEventId) {
      promptAddToCalendar(newItem);
    }
  };
  
  // Handle calendar event created callback
  const handleCalendarEventCreated = (eventId: string) => {
    if (pendingTask) {
      setItems(prev => prev.map(item => 
        item.id === pendingTask.id 
          ? { ...item, googleCalendarEventId: eventId }
          : item
      ));
    }
  };

  const handleBatchAddTasks = async (taskTexts: string[], sectionId?: string, folderId?: string, priority?: Priority, dueDate?: Date) => {
    const now = new Date();
    const newItems: TodoItem[] = taskTexts.map((text, idx) => ({
      id: `${Date.now()}-${idx}`,
      text,
      completed: false,
      folderId: folderId || selectedFolderId || undefined,
      sectionId: sectionId || inputSectionId || sections[0]?.id,
      priority: priority,
      dueDate: dueDate || new Date(), // Default to current date if no date specified
      createdAt: now,
      modifiedAt: now,
    }));
    setItems([...newItems, ...items]);
    toast.success(`Added ${newItems.length} task(s)`);
    setInputSectionId(null);
  };

  // Section management functions
  const handleAddSection = (position: 'above' | 'below', referenceId?: string) => {
    const maxOrder = Math.max(...sections.map(s => s.order), 0);
    let newOrder = maxOrder + 1;
    
    if (referenceId) {
      const refSection = sections.find(s => s.id === referenceId);
      if (refSection) {
        if (position === 'above') {
          newOrder = refSection.order - 0.5;
        } else {
          newOrder = refSection.order + 0.5;
        }
      }
    }

    const newSection: TaskSection = {
      id: Date.now().toString(),
      name: 'New Section',
      color: '#3b82f6',
      isCollapsed: false,
      order: newOrder,
    };

    const updatedSections = [...sections, newSection]
      .sort((a, b) => a.order - b.order)
      .map((s, idx) => ({ ...s, order: idx }));

    setSections(updatedSections);
    setEditingSection(newSection);
    setIsSectionEditOpen(true);
    toast.success('Section added');
  };

  const handleEditSection = (section: TaskSection) => {
    setEditingSection(section);
    setIsSectionEditOpen(true);
  };

  const handleSaveSection = (updatedSection: TaskSection) => {
    setSections(prev => {
      const exists = prev.some(s => s.id === updatedSection.id);
      if (exists) {
        return prev.map(s => s.id === updatedSection.id ? updatedSection : s);
      }
      // Section was just created, it's already in the list
      return prev.map(s => s.id === updatedSection.id ? updatedSection : s);
    });
  };

  const handleDeleteSection = (sectionId: string) => {
    if (sections.length <= 1) {
      toast.error('Cannot delete the last section');
      return;
    }
    // Move tasks to the first remaining section
    const remainingSections = sections.filter(s => s.id !== sectionId);
    const firstSection = remainingSections.sort((a, b) => a.order - b.order)[0];
    setItems(items.map(item => item.sectionId === sectionId ? { ...item, sectionId: firstSection.id } : item));
    setSections(remainingSections);
    toast.success('Section deleted');
  };

  const handleDuplicateSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const maxOrder = Math.max(...sections.map(s => s.order), 0);
    const newSection: TaskSection = {
      ...section,
      id: Date.now().toString(),
      name: `${section.name} (Copy)`,
      order: maxOrder + 1,
    };

    // Duplicate tasks in this section
    const sectionTasks = items.filter(i => i.sectionId === sectionId && !i.completed);
    const duplicatedTasks = sectionTasks.map((task, idx) => ({
      ...task,
      id: `${Date.now()}-${idx}`,
      sectionId: newSection.id,
    }));

    setSections([...sections, newSection]);
    setItems([...duplicatedTasks, ...items]);
    toast.success('Section duplicated');
  };

  const handleMoveSection = (sectionId: string, targetIndex: number) => {
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    const currentIndex = sortedSections.findIndex(s => s.id === sectionId);
    if (currentIndex === targetIndex) return;

    const [movedSection] = sortedSections.splice(currentIndex, 1);
    sortedSections.splice(targetIndex, 0, movedSection);
    
    const reorderedSections = sortedSections.map((s, idx) => ({ ...s, order: idx }));
    setSections(reorderedSections);
    toast.success('Section moved');
  };

  const handleToggleSectionCollapse = (sectionId: string) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, isCollapsed: !s.isCollapsed } : s));
  };

  const handleAddTaskToSection = async (sectionId: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    setInputSectionId(sectionId);
    setIsInputOpen(true);
  };

  const updateItem = async (itemId: string, updates: Partial<TodoItem>) => {
    const currentItem = items.find(i => i.id === itemId);
    const now = new Date();
    
    // Add modifiedAt timestamp
    const updatesWithTimestamp: Partial<TodoItem> = {
      ...updates,
      modifiedAt: now,
    };
    
    // Add completedAt timestamp when completing a task
    if (updates.completed === true && currentItem && !currentItem.completed) {
      updatesWithTimestamp.completedAt = now;
      playCompletionSound();
      // Cancel auto-reminders when task is completed
      try { await notificationManager.cancelAutoReminders(itemId); } catch {}
    }
    
    // Clear completedAt if uncompleting a task
    if (updates.completed === false && currentItem?.completed) {
      updatesWithTimestamp.completedAt = undefined;
    }
    
    // Check if this is a recurring task being completed
    if (currentItem && updates.completed === true && !currentItem.completed) {
      if (currentItem.repeatType && currentItem.repeatType !== 'none') {
        const nextTask = createNextRecurringTask(currentItem);
        if (nextTask) {
          // Add the next occurrence with timestamps
          const nextTaskWithTimestamps = {
            ...nextTask,
            createdAt: now,
            modifiedAt: now,
          };
          setItems(prevItems => [
            nextTaskWithTimestamps,
            ...prevItems.map(i => i.id === itemId ? { ...i, ...updatesWithTimestamp } : i)
          ]);
          toast.success('Recurring task completed! Next occurrence created.', {
            icon: '🔄',
          });
          return;
        }
      }
    }
    
    setItems(items.map((i) => (i.id === itemId ? { ...i, ...updatesWithTimestamp } : i)));
  };

  const deleteItem = async (itemId: string, showUndo: boolean = false) => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    const deletedItem = items.find(item => item.id === itemId);
    setItems(items.filter((item) => item.id !== itemId));
    
    if (showUndo && deletedItem) {
      toast.success('Task deleted', {
        action: {
          label: 'Undo',
          onClick: () => {
            setItems(prev => [deletedItem, ...prev]);
            toast.success('Task restored');
          }
        },
        duration: 5000,
      });
    }
  };

  // Unified reorder handler for drag-and-drop
  const handleUnifiedReorder = useCallback((updatedItems: TodoItem[]) => {
    setItems(prevItems => {
      // Keep completed items unchanged
      const completedItems = prevItems.filter(item => item.completed);
      return [...updatedItems, ...completedItems];
    });
  }, []);

  // Section reorder handler for drag-and-drop
  const handleSectionReorder = useCallback((updatedSections: TaskSection[]) => {
    setSections(updatedSections);
  }, []);

  // Handle subtask updates
  const handleUpdateSubtaskFromSheet = useCallback((parentId: string, subtaskId: string, updates: Partial<TodoItem>) => {
    const now = new Date();
    const updatesWithTimestamp: Partial<TodoItem> = {
      ...updates,
      modifiedAt: now,
    };
    
    // Add completedAt when completing a subtask
    if (updates.completed === true) {
      updatesWithTimestamp.completedAt = now;
    }
    // Clear completedAt if uncompleting
    if (updates.completed === false) {
      updatesWithTimestamp.completedAt = undefined;
    }
    
    setItems(prevItems => prevItems.map(item => {
      if (item.id === parentId && item.subtasks) {
        return {
          ...item,
          modifiedAt: now, // Also update parent's modifiedAt
          subtasks: item.subtasks.map(st => st.id === subtaskId ? { ...st, ...updatesWithTimestamp } : st)
        };
      }
      return item;
    }));
  }, []);

  // Handle subtask deletion
  const handleDeleteSubtaskFromSheet = useCallback((parentId: string, subtaskId: string) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === parentId && item.subtasks) {
        return {
          ...item,
          subtasks: item.subtasks.filter(st => st.id !== subtaskId)
        };
      }
      return item;
    }));
  }, []);

  // Convert subtask to main task
  const handleConvertSubtaskToTask = useCallback((parentId: string, subtask: TodoItem) => {
    setItems(prevItems => {
      // Remove subtask from parent
      const updatedItems = prevItems.map(item => {
        if (item.id === parentId && item.subtasks) {
          return {
            ...item,
            subtasks: item.subtasks.filter(st => st.id !== subtask.id)
          };
        }
        return item;
      });
      
      // Add as new main task
      const newTask: TodoItem = {
        ...subtask,
        sectionId: prevItems.find(i => i.id === parentId)?.sectionId || sections[0]?.id,
      };
      
      return [newTask, ...updatedItems];
    });
  }, [sections]);

  const duplicateTask = async (task: TodoItem) => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    const duplicatedTask: TodoItem = { ...task, id: Date.now().toString(), completed: false, text: `${task.text} (Copy)` };
    setItems([duplicatedTask, ...items]);
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) newSet.delete(taskId);
      else newSet.add(taskId);
      return newSet;
    });
  };

  const handleDuplicate = (option: DuplicateOption) => {
    const filteredItems = selectedFolderId ? items.filter(i => i.folderId === selectedFolderId) : items;
    let toDuplicate: TodoItem[] = [];

    if (option === 'uncompleted') {
      toDuplicate = filteredItems.filter(i => !i.completed);
    } else {
      toDuplicate = filteredItems;
    }

    const duplicated = toDuplicate.map((item, idx) => ({
      ...item,
      id: `${Date.now()}-${idx}`,
      completed: option === 'all-reset' ? false : item.completed,
      text: `${item.text} (Copy)`
    }));

    setItems([...duplicated, ...items]);
    toast.success(`Duplicated ${duplicated.length} task(s)`);
  };

  const handleSelectAction = (action: SelectAction) => {
    const selectedItems = items.filter(i => selectedTaskIds.has(i.id));
    
    switch (action) {
      case 'selectAll':
        // Select all uncompleted tasks
        const allTaskIds = new Set(uncompletedItems.map(i => i.id));
        setSelectedTaskIds(allTaskIds);
        toast.success(`Selected ${allTaskIds.size} task(s)`);
        return; // Don't close the sheet
      case 'move':
        setIsMoveToFolderOpen(true);
        break;
      case 'delete':
        setItems(items.filter(i => !selectedTaskIds.has(i.id)));
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        toast.success(`Deleted ${selectedItems.length} task(s)`);
        break;
      case 'complete':
        // Play sound for each completed task
        playCompletionSound();
        setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, completed: true } : i));
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        toast.success(`Completed ${selectedItems.length} task(s)`);
        break;
      case 'pin':
        toast.success(`Pinned ${selectedItems.length} task(s)`);
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        break;
      case 'priority':
        setIsPrioritySheetOpen(true);
        break;
      case 'duplicate':
        const duplicated = selectedItems.map((item, idx) => ({
          ...item,
          id: `${Date.now()}-${idx}`,
          completed: false,
          text: `${item.text} (Copy)`
        }));
        setItems([...duplicated, ...items]);
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        toast.success(`Duplicated ${selectedItems.length} task(s)`);
        break;
      case 'convert':
        convertToNotes(selectedItems);
        break;
      case 'setDueDate':
        setIsBulkDateSheetOpen(true);
        break;
      case 'setReminder':
        setIsBulkReminderSheetOpen(true);
        break;
      case 'setRepeat':
        setIsBulkRepeatSheetOpen(true);
        break;
      case 'moveToSection':
        setIsBulkSectionMoveOpen(true);
        break;
      case 'setStatus':
        setIsBulkStatusOpen(true);
        break;
    }
    setIsSelectActionsOpen(false);
  };

  const handleMoveToFolder = (folderId: string | null) => {
    setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, folderId: folderId || undefined } : i));
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    toast.success(`Moved ${selectedTaskIds.size} task(s)`);
  };

  const handleSetPriority = (priority: Priority) => {
    setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, priority } : i));
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    toast.success(`Updated priority for ${selectedTaskIds.size} task(s)`);
  };

  const convertToNotes = async (tasksToConvert: TodoItem[]) => {
    const { loadNotesFromDB, saveNotesToDB } = await import('@/utils/noteStorage');
    const existingNotes = await loadNotesFromDB();
    
    const newNotes: Note[] = tasksToConvert.map((task, idx) => ({
      id: `${Date.now()}-${idx}`,
      type: 'regular' as const,
      title: task.text,
      content: task.description || '',
      voiceRecordings: [],
      images: task.imageUrl ? [task.imageUrl] : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await saveNotesToDB([...newNotes, ...existingNotes]);
    setItems(items.filter(i => !tasksToConvert.some(t => t.id === i.id)));
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    toast.success(`Converted ${tasksToConvert.length} task(s) to notes`);
  };

  const handleConvertSingleTask = (task: TodoItem) => {
    convertToNotes([task]);
  };

  const handleMoveTaskToFolder = (taskId: string, folderId: string | null) => {
    setItems(items.map(i => i.id === taskId ? { ...i, folderId: folderId || undefined } : i));
    toast.success('Task moved');
  };

  const processedItems = useMemo(() => {
    let filtered = items.filter(item => {
      // Smart list filter (takes precedence)
      if (smartList !== 'all') {
        const smartListFilter = getSmartListFilter(smartList);
        if (!smartListFilter(item)) return false;
      }

      // Folder filter
      const folderMatch = selectedFolderId ? item.folderId === selectedFolderId : true;
      
      // Priority filter
      const priorityMatch = priorityFilter === 'all' ? true : item.priority === priorityFilter;
      
      // Status filter - handles both completion and task status
      let statusMatch = true;
      if (statusFilter === 'completed') statusMatch = item.completed;
      else if (statusFilter === 'uncompleted') statusMatch = !item.completed;
      else if (statusFilter === 'not_started') statusMatch = item.status === 'not_started' || !item.status;
      else if (statusFilter === 'in_progress') statusMatch = item.status === 'in_progress';
      else if (statusFilter === 'almost_done') statusMatch = item.status === 'almost_done';
      
      // Date filter
      let dateMatch = true;
      if (dateFilter !== 'all') {
        const today = startOfDay(new Date());
        const itemDate = item.dueDate ? new Date(item.dueDate) : null;
        
        switch (dateFilter) {
          case 'today':
            dateMatch = itemDate ? isToday(itemDate) : false;
            break;
          case 'tomorrow':
            dateMatch = itemDate ? isTomorrow(itemDate) : false;
            break;
          case 'this-week':
            dateMatch = itemDate ? isThisWeek(itemDate) : false;
            break;
          case 'overdue':
            dateMatch = itemDate ? isBefore(itemDate, today) && !item.completed : false;
            break;
          case 'has-date':
            dateMatch = !!itemDate;
            break;
          case 'no-date':
            dateMatch = !itemDate;
            break;
        }
      }

      // Tag filter
      let tagMatch = true;
      if (tagFilter.length > 0) {
        const itemTags = item.coloredTags?.map(t => t.name) || [];
        tagMatch = tagFilter.some(tag => itemTags.includes(tag));
      }
      
      return folderMatch && priorityMatch && statusMatch && dateMatch && tagMatch;
    });

    // Sort based on sortBy state
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return dateA - dateB;
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 3 };
          return (priorityOrder[a.priority || 'undefined'] || 3) - (priorityOrder[b.priority || 'undefined'] || 3);
        case 'name':
          return a.text.localeCompare(b.text);
        case 'created':
          return parseInt(b.id) - parseInt(a.id); // Newer first (id is timestamp-based)
        default:
          return 0;
      }
    });

    return filtered;
  }, [items, selectedFolderId, priorityFilter, statusFilter, dateFilter, tagFilter, smartList, sortBy]);

  // Apply view mode search filter
  const searchFilteredItems = useMemo(() => {
    if (!viewModeSearch.trim()) return processedItems;
    const search = viewModeSearch.toLowerCase();
    return processedItems.filter(item => 
      item.text.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search) ||
      item.coloredTags?.some(tag => tag.name.toLowerCase().includes(search))
    );
  }, [processedItems, viewModeSearch]);

  const uncompletedItems = searchFilteredItems.filter(item => !item.completed);
  const completedItems = searchFilteredItems.filter(item => item.completed);

  const handleClearFilters = () => {
    setSelectedFolderId(null);
    setDateFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
    setTagFilter([]);
    setSmartList('all');
  };

  const getPriorityBorderColor = (priority?: Priority) => {
    switch (priority) {
      case 'high': return 'border-red-500';
      case 'medium': return 'border-orange-500';
      case 'low': return 'border-green-500';
      default: return 'border-primary';
    }
  };

  // Voice playback state for flat view
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceCurrentTime, setVoiceCurrentTime] = useState(0);
  const [voiceDuration, setVoiceDuration] = useState<Record<string, number>>({});
  const [voicePlaybackSpeed, setVoicePlaybackSpeed] = useState(1);
  const [resolvedVoiceUrls, setResolvedVoiceUrls] = useState<Record<string, string>>({});
  const flatAudioRef = useRef<HTMLAudioElement | null>(null);
  const VOICE_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];
  
  // Resolve voice URLs for items with voice recordings
  useEffect(() => {
    const resolveUrls = async () => {
      const voiceItems = items.filter(item => item.voiceRecording?.audioUrl);
      for (const item of voiceItems) {
        if (item.voiceRecording && !resolvedVoiceUrls[item.id]) {
          const url = await resolveTaskMediaUrl(item.voiceRecording.audioUrl);
          if (url) {
            setResolvedVoiceUrls(prev => ({ ...prev, [item.id]: url }));
          }
        }
      }
    };
    resolveUrls();
  }, [items]);
  
  // Swipe state for flat view
  const [swipeState, setSwipeState] = useState<{ id: string; x: number; isSwiping: boolean } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const SWIPE_THRESHOLD = 80;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFlatVoicePlay = async (item: TodoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.voiceRecording) return;

    if (playingVoiceId === item.id && flatAudioRef.current) {
      flatAudioRef.current.pause();
      flatAudioRef.current = null;
      setPlayingVoiceId(null);
      setVoiceProgress(0);
      setVoiceCurrentTime(0);
      return;
    }

    if (flatAudioRef.current) {
      flatAudioRef.current.pause();
      flatAudioRef.current = null;
    }

    // Resolve media ref if needed
    const audioUrl = await resolveTaskMediaUrl(item.voiceRecording.audioUrl);
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.playbackRate = voicePlaybackSpeed;
    flatAudioRef.current = audio;
    
    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setVoiceProgress((audio.currentTime / audio.duration) * 100);
        setVoiceCurrentTime(audio.currentTime);
      }
    };
    
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setVoiceDuration(prev => ({ ...prev, [item.id]: Math.round(audio.duration) }));
      }
    };
    
    audio.onended = () => {
      setPlayingVoiceId(null);
      setVoiceProgress(0);
      setVoiceCurrentTime(0);
      flatAudioRef.current = null;
    };
    
    audio.play();
    setPlayingVoiceId(item.id);
  };

  const cycleVoicePlaybackSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = VOICE_PLAYBACK_SPEEDS.indexOf(voicePlaybackSpeed);
    const nextIndex = (currentIndex + 1) % VOICE_PLAYBACK_SPEEDS.length;
    const newSpeed = VOICE_PLAYBACK_SPEEDS[nextIndex];
    setVoicePlaybackSpeed(newSpeed);
    if (flatAudioRef.current) {
      flatAudioRef.current.playbackRate = newSpeed;
    }
  };

  const handleVoiceSeek = (e: React.MouseEvent<HTMLDivElement>, item: TodoItem) => {
    e.stopPropagation();
    if (!flatAudioRef.current || playingVoiceId !== item.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = flatAudioRef.current.duration || voiceDuration[item.id] || item.voiceRecording?.duration || 0;
    if (duration && !isNaN(duration)) {
      flatAudioRef.current.currentTime = percentage * duration;
      setVoiceProgress(percentage * 100);
      setVoiceCurrentTime(percentage * duration);
    }
  };

  const handleFlatTouchStart = (itemId: string, e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwipeState({ id: itemId, x: 0, isSwiping: false });
  };

  const handleFlatTouchMove = (itemId: string, e: React.TouchEvent) => {
    if (!swipeState || swipeState.id !== itemId) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    
    if (deltaY < 30) {
      const clampedX = Math.max(-120, Math.min(120, deltaX));
      setSwipeState({ id: itemId, x: clampedX, isSwiping: true });
    }
  };

  const handleFlatTouchEnd = async (item: TodoItem) => {
    if (!swipeState || swipeState.id !== item.id) return;
    
    if (swipeState.x < -SWIPE_THRESHOLD) {
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
      deleteItem(item.id, true);
    } else if (swipeState.x > SWIPE_THRESHOLD) {
      try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
      updateItem(item.id, { completed: !item.completed });
    }
    setSwipeState(null);
  };

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleSubtasks = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const updateSubtask = async (parentId: string, subtaskId: string, updates: Partial<TodoItem>) => {
    const now = new Date();
    const updatesWithTimestamp: Partial<TodoItem> = {
      ...updates,
      modifiedAt: now,
    };
    
    // Add completedAt when completing
    if (updates.completed === true) {
      updatesWithTimestamp.completedAt = now;
    }
    if (updates.completed === false) {
      updatesWithTimestamp.completedAt = undefined;
    }
    
    setItems(items.map(item => {
      if (item.id === parentId && item.subtasks) {
        return {
          ...item,
          modifiedAt: now,
          subtasks: item.subtasks.map(st => st.id === subtaskId ? { ...st, ...updatesWithTimestamp } : st)
        };
      }
      return item;
    }));
  };

  const deleteSubtask = (parentId: string, subtaskId: string, showUndo: boolean = false) => {
    let deletedSubtask: TodoItem | null = null;
    
    setItems(items.map(item => {
      if (item.id === parentId && item.subtasks) {
        deletedSubtask = item.subtasks.find(st => st.id === subtaskId) || null;
        return {
          ...item,
          subtasks: item.subtasks.filter(st => st.id !== subtaskId)
        };
      }
      return item;
    }));

    if (showUndo && deletedSubtask) {
      const subtaskToRestore = deletedSubtask;
      toast.success('Subtask deleted', {
        action: {
          label: 'Undo',
          onClick: () => {
            setItems(prev => prev.map(item => {
              if (item.id === parentId) {
                return {
                  ...item,
                  subtasks: [...(item.subtasks || []), subtaskToRestore]
                };
              }
              return item;
            }));
            toast.success('Subtask restored');
          }
        },
        duration: 5000,
      });
    }
  };

  const handleSubtaskSwipeStart = (subtaskId: string, parentId: string, e: React.TouchEvent) => {
    subtaskTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSubtaskSwipeState({ id: subtaskId, parentId, x: 0, isSwiping: false });
  };

  const handleSubtaskSwipeMove = (subtaskId: string, parentId: string, e: React.TouchEvent) => {
    if (!subtaskSwipeState || subtaskSwipeState.id !== subtaskId) return;
    const deltaX = e.touches[0].clientX - subtaskTouchStartRef.current.x;
    const deltaY = Math.abs(e.touches[0].clientY - subtaskTouchStartRef.current.y);
    
    if (deltaY < 30) {
      const clampedX = Math.max(-120, Math.min(120, deltaX));
      setSubtaskSwipeState({ id: subtaskId, parentId, x: clampedX, isSwiping: true });
    }
  };

  const handleSubtaskSwipeEnd = async (subtask: TodoItem, parentId: string) => {
    if (!subtaskSwipeState || subtaskSwipeState.id !== subtask.id) return;
    
    if (subtaskSwipeState.x < -SWIPE_THRESHOLD) {
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
      deleteSubtask(parentId, subtask.id, true);
    } else if (subtaskSwipeState.x > SWIPE_THRESHOLD) {
      try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
      updateSubtask(parentId, subtask.id, { completed: !subtask.completed });
    }
    setSubtaskSwipeState(null);
  };

  // Render task item in flat layout style for ALL view modes
  const renderTaskItem = (item: TodoItem) => {
    const hasSubtasks = item.subtasks && item.subtasks.length > 0;
    const currentSwipe = swipeState?.id === item.id ? swipeState : null;
    const isExpanded = expandedTasks.has(item.id);
    const completedSubtasks = item.subtasks?.filter(st => st.completed).length || 0;
    const totalSubtasks = item.subtasks?.length || 0;
    
    // Always use flat layout style for consistency across all view modes
    return (
      <div key={item.id} className="relative">
        <div className="relative overflow-hidden">
          {/* Swipe action backgrounds - only show relevant color based on direction */}
          {currentSwipe && currentSwipe.isSwiping && (
            <div className="absolute inset-0 flex">
              {currentSwipe.x > 0 && (
                <div className={cn(
                  "absolute inset-0 flex items-center justify-start pl-4 transition-colors",
                  currentSwipe.x > SWIPE_THRESHOLD ? "bg-green-500" : "bg-green-500/70"
                )}>
                  <Check className="h-5 w-5 text-white" />
                </div>
              )}
              {currentSwipe.x < 0 && (
                <div className={cn(
                  "absolute inset-0 flex items-center justify-end pr-4 transition-colors",
                  currentSwipe.x < -SWIPE_THRESHOLD ? "bg-red-500" : "bg-red-500/70"
                )}>
                  <TrashIcon className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          )}
          
          {/* Main flat item */}
          <div 
            className={cn(
              "flex items-start gap-3 border-b border-border/50 bg-background",
              compactMode ? "py-1.5 px-1.5 gap-2" : "py-2.5 px-2"
            )}
            style={{ 
              transform: `translateX(${currentSwipe?.x || 0}px)`, 
              transition: currentSwipe?.isSwiping ? 'none' : 'transform 0.3s ease-out' 
            }}
            onTouchStart={(e) => handleFlatTouchStart(item.id, e)}
            onTouchMove={(e) => handleFlatTouchMove(item.id, e)}
            onTouchEnd={() => handleFlatTouchEnd(item)}
          >
          {isSelectionMode && (
              <Checkbox checked={selectedTaskIds.has(item.id)} onCheckedChange={() => handleSelectTask(item.id)} className={cn(compactMode ? "h-4 w-4" : "h-5 w-5", "mt-0.5")} />
            )}
            
            <Checkbox
              checked={item.completed}
              onCheckedChange={async (checked) => {
                updateItem(item.id, { completed: !!checked });
                if (checked && !item.completed) {
                  try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "rounded-sm border-0 mt-0.5 flex-shrink-0",
                compactMode ? "h-4 w-4" : "h-5 w-5",
                item.completed 
                  ? "bg-muted-foreground/30 data-[state=checked]:bg-muted-foreground/30 data-[state=checked]:text-white" 
                  : cn("border-2", getPriorityBorderColor(item.priority))
              )}
            />
            <div className="flex-1 min-w-0" onClick={() => !currentSwipe?.isSwiping && setSelectedTask(item)}>
              {/* Show voice player OR text based on whether it's a voice task */}
              {item.voiceRecording ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleFlatVoicePlay(item, e)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors min-w-0 flex-1"
                  >
                    {playingVoiceId === item.id ? (
                      <Pause className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <Play className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                    {/* Waveform progress bar */}
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      {resolvedVoiceUrls[item.id] ? (
                        <WaveformProgressBar
                          audioUrl={resolvedVoiceUrls[item.id]}
                          progress={playingVoiceId === item.id ? voiceProgress : 0}
                          duration={voiceDuration[item.id] || item.voiceRecording.duration}
                          isPlaying={playingVoiceId === item.id}
                          onSeek={(percent) => {
                            if (flatAudioRef.current && playingVoiceId === item.id) {
                              const duration = flatAudioRef.current.duration || voiceDuration[item.id] || item.voiceRecording!.duration;
                              if (duration && !isNaN(duration)) {
                                flatAudioRef.current.currentTime = (percent / 100) * duration;
                                setVoiceProgress(percent);
                                setVoiceCurrentTime((percent / 100) * duration);
                              }
                            }
                          }}
                          height={12}
                        />
                      ) : (
                        <div 
                          className="relative h-1.5 bg-primary/20 rounded-full overflow-hidden cursor-pointer"
                          onClick={(e) => handleVoiceSeek(e, item)}
                        >
                          <div 
                            className="absolute h-full bg-primary rounded-full transition-all duration-100"
                            style={{ width: playingVoiceId === item.id ? `${voiceProgress}%` : '0%' }}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-primary font-medium">
                          {playingVoiceId === item.id ? formatDuration(Math.round(voiceCurrentTime)) : '0:00'}
                        </span>
                        <span className="text-primary/70">
                          {formatDuration(voiceDuration[item.id] || item.voiceRecording.duration)}
                        </span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={cycleVoicePlaybackSpeed}
                    className="px-2 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 transition-colors min-w-[40px]"
                  >
                    {voicePlaybackSpeed}x
                  </button>
                  {item.repeatType && item.repeatType !== 'none' && <Repeat className="h-3 w-3 text-purple-500 flex-shrink-0" />}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={cn(compactMode ? "text-xs" : "text-sm", item.completed && "text-muted-foreground")}>{item.text}</span>
                  {item.repeatType && item.repeatType !== 'none' && <Repeat className={cn(compactMode ? "h-2.5 w-2.5" : "h-3 w-3", "text-purple-500 flex-shrink-0")} />}
                </div>
              )}
              {/* Tags display - hide in compact mode */}
              {!compactMode && !hideDetailsOptions.hideDateTime && item.coloredTags && item.coloredTags.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {item.coloredTags.slice(0, 4).map((tag) => (
                    <span 
                      key={tag.name}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {tag.name}
                    </span>
                  ))}
                  {item.coloredTags.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{item.coloredTags.length - 4}</span>
                  )}
                </div>
              )}
              {/* Date display - inline in compact mode */}
              {!hideDetailsOptions.hideDateTime && item.dueDate && (
                <p className={cn("text-muted-foreground", compactMode ? "text-[10px] mt-0.5" : "text-xs mt-1")}>
                  {new Date(item.dueDate).toLocaleDateString()}
                </p>
              )}
              {/* Subtasks indicator - inline in compact mode */}
              {!hideDetailsOptions.hideSubtasks && hasSubtasks && !isExpanded && (
                <p className={cn("text-muted-foreground", compactMode ? "text-[10px] mt-0.5" : "text-xs mt-1")}>
                  {completedSubtasks}/{totalSubtasks} subtasks
                </p>
              )}
              {/* Status badge - hide in compact mode */}
              {!compactMode && !hideDetailsOptions.hideStatus && showStatusBadge && !item.completed && item.status && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] px-1.5 py-0 mt-1",
                    item.status === 'not_started' && "border-muted-foreground text-muted-foreground bg-muted/30",
                    item.status === 'in_progress' && "border-blue-500 text-blue-500 bg-blue-500/10",
                    item.status === 'almost_done' && "border-amber-500 text-amber-500 bg-amber-500/10"
                  )}
                >
                  {item.status === 'not_started' ? 'Not Started' : item.status === 'in_progress' ? 'In Progress' : 'Almost Done'}
                </Badge>
              )}
            </div>
            {/* Image display - smaller in compact mode */}
            {item.imageUrl && (
              <div
                className={cn(
                  "rounded-full overflow-hidden border-2 border-border flex-shrink-0 cursor-pointer hover:border-primary transition-colors",
                  compactMode ? "w-7 h-7" : "w-10 h-10"
                )}
                onClick={(e) => { e.stopPropagation(); setSelectedImage(item.imageUrl!); }}
              >
                <ResolvedTaskImage srcRef={item.imageUrl} alt="Task attachment" className="w-full h-full object-cover" />
              </div>
            )}
            {/* Expand/Collapse button for subtasks - always visible */}
            {hasSubtasks && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleSubtasks(item.id); }}
                className={cn("rounded hover:bg-muted transition-colors flex-shrink-0", compactMode ? "p-0.5" : "p-1 mt-0.5")}
              >
                {isExpanded ? (
                  <ChevronDown className={cn(compactMode ? "h-3 w-3" : "h-4 w-4", "text-muted-foreground")} />
                ) : (
                  <ChevronRight className={cn(compactMode ? "h-3 w-3" : "h-4 w-4", "text-muted-foreground")} />
                )}
              </button>
            )}
          </div>
        </div>
        {/* Subtasks are rendered by UnifiedDragDropList - not here to avoid duplicates */}
      </div>
    );
  };

  // Render subtasks inline for Kanban/Progress/Timeline views
  const renderSubtasksInline = (item: TodoItem) => {
    const isExpanded = expandedTasks.has(item.id);
    if (!isExpanded || !item.subtasks || item.subtasks.length === 0) return null;
    
    const getPriorityColorValue = (priority?: Priority) => {
      switch (priority) {
        case 'high': return '#ef4444';
        case 'medium': return '#f97316';
        case 'low': return '#22c55e';
        default: return '#6b7280';
      }
    };
    
    return (
      <div className="border-t border-border/30 bg-muted/20 p-2 space-y-1">
        {item.subtasks.map((subtask) => (
          <div 
            key={subtask.id}
            className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
            style={{ borderLeft: `3px solid ${getPriorityColorValue(subtask.priority)}` }}
          >
            <Checkbox
              checked={subtask.completed}
              onCheckedChange={(checked) => {
                const updatedSubtasks = item.subtasks?.map(st => 
                  st.id === subtask.id ? { ...st, completed: !!checked } : st
                );
                updateItem(item.id, { subtasks: updatedSubtasks });
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "h-4 w-4 rounded-sm border-0",
                subtask.completed 
                  ? "bg-muted-foreground/30 data-[state=checked]:bg-muted-foreground/30 data-[state=checked]:text-white" 
                  : cn("border-2", getPriorityBorderColor(subtask.priority))
              )}
            />
            <span 
              className={cn("text-xs flex-1", subtask.completed && "text-muted-foreground line-through")}
              onClick={() => setSelectedSubtask({ subtask, parentId: item.id })}
            >
              • {subtask.text}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  // Get view mode icon for visual indicator
  const getViewModeIcon = () => {
    switch (viewMode) {
      case 'kanban': return <Columns3 className="h-3.5 w-3.5" />;
      case 'kanban-status': return <ListChecks className="h-3.5 w-3.5" />;
      case 'timeline': return <GitBranch className="h-3.5 w-3.5" />;
      case 'progress': return <TrendingUp className="h-3.5 w-3.5" />;
      case 'priority': return <Flag className="h-3.5 w-3.5" />;
      case 'history': return <History className="h-3.5 w-3.5" />;
      default: return <LayoutList className="h-3.5 w-3.5" />;
    }
  };

  const renderSectionHeader = (section: TaskSection, isDragging: boolean = false) => {
    const sectionTasks = uncompletedItems.filter(item => item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id));
    
    return (
      <div 
        className={cn(
          "flex items-center",
          isDragging && "opacity-90 scale-[1.02] shadow-xl bg-card rounded-t-xl"
        )} 
        style={{ borderLeft: `4px solid ${section.color}` }}
      >
        <div className="flex-1 flex items-center gap-3 px-3 py-2.5 bg-muted/30">
          {/* View mode indicator icon */}
          <span className="text-muted-foreground" style={{ color: section.color }}>
            {getViewModeIcon()}
          </span>
          <span className="text-sm font-semibold">{section.name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{sectionTasks.length}</span>
        </div>
        
        {/* Collapse button */}
        <button
          onClick={() => handleToggleSectionCollapse(section.id)}
          className="p-2 hover:bg-muted/50 transition-colors"
        >
          {section.isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Options menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-muted/50 transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-lg z-50">
            <DropdownMenuItem onClick={() => handleEditSection(section)} className="cursor-pointer">
              <Edit className="h-4 w-4 mr-2" />Edit Section
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddTaskToSection(section.id)} className="cursor-pointer">
              <PlusIcon className="h-4 w-4 mr-2" />Add Task
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleAddSection('above', section.id)} className="cursor-pointer">
              <ArrowUpCircle className="h-4 w-4 mr-2" />Add Section Above
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddSection('below', section.id)} className="cursor-pointer">
              <ArrowDownCircle className="h-4 w-4 mr-2" />Add Section Below
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDuplicateSection(section.id)} className="cursor-pointer">
              <Copy className="h-4 w-4 mr-2" />Duplicate Section
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEditingSection(section); setIsSectionMoveOpen(true); }} className="cursor-pointer">
              <Move className="h-4 w-4 mr-2" />Move to
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleDeleteSection(section.id)} 
              className="cursor-pointer text-destructive focus:text-destructive"
              disabled={sections.length <= 1}
            >
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  // Collapsible section state for special view modes
  const [collapsedViewSections, setCollapsedViewSections] = useState<Set<string>>(new Set());
  
  const toggleViewSectionCollapse = (sectionId: string) => {
    setCollapsedViewSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Render collapsible section header for special view modes
  const renderViewModeSectionHeader = (
    label: string, 
    taskCount: number, 
    color: string, 
    icon: React.ReactNode,
    sectionId: string,
    extra?: React.ReactNode
  ) => {
    const isCollapsed = collapsedViewSections.has(sectionId);
    
    return (
      <button 
        onClick={() => toggleViewSectionCollapse(sectionId)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors" 
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <span style={{ color }}>{icon}</span>
        <span className="text-sm font-semibold flex-1 text-left">{label}</span>
        {extra}
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{taskCount}</span>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    );
  };

  // Render completed section for special view modes
  const renderCompletedSectionForViewMode = () => {
    if (!showCompleted || completedItems.length === 0) return null;
    
    const isCollapsed = collapsedViewSections.has('view-completed');
    
    return (
      <div className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden mt-6">
        <button 
          onClick={() => toggleViewSectionCollapse('view-completed')}
          className="w-full flex items-center gap-2 px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors" 
          style={{ borderLeft: `4px solid #10b981` }}
        >
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold flex-1 text-left text-muted-foreground uppercase tracking-wide">Completed</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{completedItems.length}</span>
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {!isCollapsed && (
          <div className="p-2 space-y-2">
            {completedItems.map((item) => (
              <div key={item.id} className="bg-card rounded-lg border border-border/50 opacity-70">
                {renderTaskItem(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleSubtaskClick = (subtask: TodoItem, parentId?: string) => {
    if (parentId) {
      setSelectedSubtask({ subtask, parentId });
    } else {
      setSelectedTask(subtask);
    }
  };

  return (
    <TodoLayout title="Npd" searchValue={viewModeSearch} onSearchChange={setViewModeSearch}>
      <main className="container mx-auto px-4 py-3 pb-32">
        <div className="max-w-2xl mx-auto">
          {/* Folders */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold flex items-center gap-2"><FolderIcon className="h-5 w-5" />{t('menu.folders')}</h2>
                {smartList === 'location-reminders' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsLocationMapOpen(true)}
                    className="gap-1"
                  >
                    <MapPin className="h-4 w-4" />
                    {t('menu.mapView')}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isSelectionMode && (
                  <Button variant="default" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedTaskIds(new Set()); }}>
                    {t('menu.cancel')}
                  </Button>
                )}
                <DropdownMenu onOpenChange={(open) => { if (!open) setDropdownView('main'); }}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56 max-h-[70vh] overflow-y-auto bg-popover border shadow-lg z-50">
                    <div className={cn(
                      "transition-all duration-200 ease-out",
                      dropdownView === 'main' ? "animate-in slide-in-from-left-full" : "hidden"
                    )}>
                      {dropdownView === 'main' && (
                        <>
                          {/* Smart Lists */}
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('smartLists'); }} className="cursor-pointer">
                            <Sparkles className="h-4 w-4 mr-2" />
                            {t('menu.smartLists')}
                            {smartList !== 'all' && (
                              <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs mr-1">
                                {t('menu.active')}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 ml-auto" />
                          </DropdownMenuItem>
                          {/* Sort By */}
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('sortBy'); }} className="cursor-pointer">
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            {t('menu.sortBy')}
                            <ChevronRight className="h-4 w-4 ml-auto" />
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setShowCompleted(!showCompleted)} className="cursor-pointer">
                            {showCompleted ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                            {showCompleted ? t('menu.hideCompleted') : t('menu.showCompleted')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              const allHidden = hideDetailsOptions.hideDateTime && hideDetailsOptions.hideStatus && hideDetailsOptions.hideSubtasks;
                              setHideDetailsOptions({
                                hideDateTime: !allHidden,
                                hideStatus: !allHidden,
                                hideSubtasks: !allHidden,
                              });
                            }} 
                            className="cursor-pointer"
                          >
                            {(hideDetailsOptions.hideDateTime && hideDetailsOptions.hideStatus && hideDetailsOptions.hideSubtasks) ? (
                              <><Eye className="h-4 w-4 mr-2" />{t('menu.showAllDetails')}</>
                            ) : (
                              <><EyeOff className="h-4 w-4 mr-2" />{t('menu.hideAllDetails')}</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCompactMode(!compactMode)} className="cursor-pointer">
                            {compactMode ? <LayoutList className="h-4 w-4 mr-2" /> : <LayoutGrid className="h-4 w-4 mr-2" />}
                            {compactMode ? t('menu.normalMode') : t('menu.compactMode')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsTaskOptionsOpen(true)} className="cursor-pointer">
                            <Settings className="h-4 w-4 mr-2" />
                            {t('menu.detailSettings')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {/* Group By */}
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('groupBy'); }} className="cursor-pointer">
                            <Columns3 className="h-4 w-4 mr-2" />
                            {t('menu.groupBy')}
                            {groupByOption !== 'none' && (
                              <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs mr-1">
                                {groupByOption}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 ml-auto" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsFilterSheetOpen(true)} className="cursor-pointer">
                            <Filter className="h-4 w-4 mr-2" />{t('menu.filter')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsDuplicateSheetOpen(true)} className="cursor-pointer">
                            <Copy className="h-4 w-4 mr-2" />{t('menu.duplicate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsBatchTaskOpen(true)} className="cursor-pointer">
                            <ListPlus className="h-4 w-4 mr-2" />{t('menu.addMultipleTasks')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAddSection('below')} className="cursor-pointer">
                            <PlusIcon className="h-4 w-4 mr-2" />{t('menu.sections')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsFolderManageOpen(true)} className="cursor-pointer">
                            <FolderIcon className="h-4 w-4 mr-2" />{t('menu.folders')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setIsSelectionMode(true); setIsSelectActionsOpen(true); }} className="cursor-pointer">
                            <MousePointer2 className="h-4 w-4 mr-2" />{t('menu.select')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setViewMode('flat')} className={cn("cursor-pointer", viewMode === 'flat' && "bg-accent")}>
                            <LayoutList className="h-4 w-4 mr-2" />{t('menu.flatLayout')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewMode('kanban')} className={cn("cursor-pointer", viewMode === 'kanban' && "bg-accent")}>
                            <Columns3 className="h-4 w-4 mr-2" />{t('menu.kanbanBoard')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewMode('kanban-status')} className={cn("cursor-pointer", viewMode === 'kanban-status' && "bg-accent")}>
                            <ListChecks className="h-4 w-4 mr-2" />{t('menu.statusBoard')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewMode('timeline')} className={cn("cursor-pointer", viewMode === 'timeline' && "bg-accent")}>
                            <GitBranch className="h-4 w-4 mr-2" />{t('menu.timelineBoard')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewMode('progress')} className={cn("cursor-pointer", viewMode === 'progress' && "bg-accent")}>
                            <TrendingUp className="h-4 w-4 mr-2" />{t('menu.progressBoard')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewMode('priority')} className={cn("cursor-pointer", viewMode === 'priority' && "bg-accent")}>
                            <Flag className="h-4 w-4 mr-2" />{t('menu.priorityBoard')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewMode('history')} className={cn("cursor-pointer", viewMode === 'history' && "bg-accent")}>
                            <History className="h-4 w-4 mr-2" />{t('menu.historyLog')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </div>
                    <div className={cn(
                      "transition-all duration-200 ease-out",
                      dropdownView === 'smartLists' ? "animate-in slide-in-from-right-full" : "hidden"
                    )}>
                      {dropdownView === 'smartLists' && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('main'); }} className="cursor-pointer">
                            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                            {t('menu.back')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {smartListData.smartLists.map((list) => (
                            <DropdownMenuItem
                              key={list.id}
                              onClick={() => setSmartList(list.id)}
                              className={cn("cursor-pointer", smartList === list.id && "bg-accent")}
                            >
                              {list.icon}
                              <span className={cn("ml-2", list.color)}>{list.label}</span>
                              {smartListData.getCounts[list.id] > 0 && (
                                <Badge 
                                  variant={list.id === 'overdue' ? "destructive" : "secondary"}
                                  className="ml-auto"
                                >
                                  {smartListData.getCounts[list.id]}
                                </Badge>
                              )}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </div>
                    <div className={cn(
                      "transition-all duration-200 ease-out",
                      dropdownView === 'sortBy' ? "animate-in slide-in-from-right-full" : "hidden"
                    )}>
                      {dropdownView === 'sortBy' && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('main'); }} className="cursor-pointer">
                            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                            {t('menu.back')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSortBy('date')} className={cn("cursor-pointer", sortBy === 'date' && "bg-accent")}>
                            <CalendarIcon2 className="h-4 w-4 mr-2 text-blue-500" />
                            {t('menu.dueDate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('priority')} className={cn("cursor-pointer", sortBy === 'priority' && "bg-accent")}>
                            <Flame className="h-4 w-4 mr-2 text-orange-500" />
                            {t('menu.priority')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('name')} className={cn("cursor-pointer", sortBy === 'name' && "bg-accent")}>
                            <ArrowDownAZ className="h-4 w-4 mr-2 text-purple-500" />
                            {t('menu.name')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('created')} className={cn("cursor-pointer", sortBy === 'created' && "bg-accent")}>
                            <Clock className="h-4 w-4 mr-2 text-green-500" />
                            {t('menu.createdTime')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </div>
                    <div className={cn(
                      "transition-all duration-200 ease-out",
                      dropdownView === 'groupBy' ? "animate-in slide-in-from-right-full" : "hidden"
                    )}>
                      {dropdownView === 'groupBy' && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('main'); }} className="cursor-pointer">
                            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                            {t('menu.back')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setGroupByOption('none')} className={cn("cursor-pointer", groupByOption === 'none' && "bg-accent")}>
                            <LayoutList className="h-4 w-4 mr-2 text-muted-foreground" />
                            {t('menu.noGrouping')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setGroupByOption('section')} className={cn("cursor-pointer", groupByOption === 'section' && "bg-accent")}>
                            <Columns3 className="h-4 w-4 mr-2 text-blue-500" />
                            {t('menu.bySection')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setGroupByOption('priority')} className={cn("cursor-pointer", groupByOption === 'priority' && "bg-accent")}>
                            <Flag className="h-4 w-4 mr-2 text-orange-500" />
                            {t('menu.byPriority')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setGroupByOption('date')} className={cn("cursor-pointer", groupByOption === 'date' && "bg-accent")}>
                            <CalendarIcon2 className="h-4 w-4 mr-2 text-green-500" />
                            {t('menu.byDueDate')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button onClick={() => setSelectedFolderId(null)} className={cn("flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all whitespace-nowrap", !selectedFolderId ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border")}>
                <FolderIcon className="h-4 w-4" />{t('smartLists.allTasks')}
              </button>
              {folders.map((folder) => (
                <button key={folder.id} onClick={() => setSelectedFolderId(folder.id)} className="flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all whitespace-nowrap" style={{ backgroundColor: selectedFolderId === folder.id ? folder.color : 'transparent', color: selectedFolderId === folder.id ? 'white' : 'inherit', borderColor: folder.color }}>
                  {folder.name}
                </button>
              ))}
            </div>
            
          </div>
          {isSelectionMode && selectedTaskIds.size > 0 && (
            <div className="fixed bottom-20 left-4 right-4 z-40 bg-card border rounded-lg shadow-lg p-4">
              <p className="text-sm mb-3 font-medium">{selectedTaskIds.size} task(s) selected</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsSelectActionsOpen(true)}>Actions</Button>
                <Button variant="outline" size="sm" onClick={() => { setItems(items.filter(i => !selectedTaskIds.has(i.id))); setSelectedTaskIds(new Set()); setIsSelectionMode(false); }}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              </div>
            </div>
          )}
          {/* Collapse All / Expand All Button - only for special view modes */}
          {['timeline', 'progress', 'priority', 'history', 'kanban'].includes(viewMode) && (
            <div className="mb-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (collapsedViewSections.size > 0) {
                    // Expand all
                    setCollapsedViewSections(new Set());
                  } else {
                    // Collapse all - add all possible section IDs
                    const allSectionIds = new Set<string>();
                    if (viewMode === 'kanban') {
                      sortedSections.forEach(s => allSectionIds.add(`kanban-${s.id}`));
                      allSectionIds.add('kanban-completed');
                    } else if (viewMode === 'timeline') {
                      ['timeline-overdue', 'timeline-today', 'timeline-tomorrow', 'timeline-thisweek', 'timeline-later', 'timeline-nodate'].forEach(id => allSectionIds.add(id));
                    } else if (viewMode === 'progress') {
                      ['progress-notstarted', 'progress-inprogress', 'progress-almostdone'].forEach(id => allSectionIds.add(id));
                    } else if (viewMode === 'priority') {
                      ['priority-high', 'priority-medium', 'priority-low', 'priority-none'].forEach(id => allSectionIds.add(id));
                    } else if (viewMode === 'history') {
                      ['history-completed-today', 'history-completed-yesterday', 'history-this-week', 'history-older'].forEach(id => allSectionIds.add(id));
                    }
                    allSectionIds.add('view-completed');
                    setCollapsedViewSections(allSectionIds);
                  }
                }}
                className="gap-1 whitespace-nowrap"
              >
                {collapsedViewSections.size > 0 ? (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    {t('sections.expandAll')}
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    {t('sections.collapseAll')}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Tasks by Sections */}
          {processedItems.length === 0 ? (
            <div className="text-center py-20"><p className="text-muted-foreground">{t('emptyStates.noTasks')}</p></div>
          ) : viewMode === 'kanban' ? (
            /* Kanban Mode - Horizontal Sections with Drag & Drop */
            <DragDropContext onDragEnd={(result: DropResult) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              
              const taskId = draggableId;
              const sourceSectionId = source.droppableId;
              const destSectionId = destination.droppableId;
              const sourceIndex = source.index;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (sourceSectionId === destSectionId && sourceIndex === destIndex) return;
              
              setItems(prevItems => {
                const taskToMove = prevItems.find(item => item.id === taskId);
                if (!taskToMove) return prevItems;
                
                // Get uncompleted items for reordering
                const uncompletedList = prevItems.filter(item => !item.completed);
                const completedList = prevItems.filter(item => item.completed);
                
                // Get source section tasks
                const sourceTasks = uncompletedList.filter(item => 
                  item.sectionId === sourceSectionId || (!item.sectionId && sourceSectionId === sections[0]?.id)
                );
                
                // Get destination section tasks (excluding the moved task)
                const destTasks = uncompletedList.filter(item => 
                  item.id !== taskId &&
                  (item.sectionId === destSectionId || (!item.sectionId && destSectionId === sections[0]?.id))
                );
                
                // Remove task from source and insert at destination index
                const updatedTask = { ...taskToMove, sectionId: destSectionId };
                destTasks.splice(destIndex, 0, updatedTask);
                
                // Persist the new order for destination section
                updateSectionOrder(`kanban-${destSectionId}`, destTasks.map(t => t.id));
                
                // If moving between sections, also update source section order
                if (sourceSectionId !== destSectionId) {
                  const remainingSourceTasks = sourceTasks.filter(t => t.id !== taskId);
                  updateSectionOrder(`kanban-${sourceSectionId}`, remainingSourceTasks.map(t => t.id));
                }
                
                // Build new items array preserving order
                const otherTasks = uncompletedList.filter(item => 
                  item.id !== taskId &&
                  item.sectionId !== destSectionId && 
                  (item.sectionId || destSectionId !== sections[0]?.id)
                );
                
                return [...otherTasks, ...destTasks, ...completedList];
              });
              
              // Force re-render to apply the new order immediately
              setOrderVersion(v => v + 1);
              
              Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
              toast.success('Task moved');
            }}>
              <div className="overflow-x-auto pb-4 -mx-4 px-4">
                <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                  {sortedSections.map((section) => {
                    const rawSectionTasks = uncompletedItems.filter(
                      item => item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id)
                    );
                    // Apply persisted order
                    const sectionTasks = applyTaskOrder(rawSectionTasks, `kanban-${section.id}`);
                    const kanbanSectionId = `kanban-${section.id}`;
                    const isCollapsed = collapsedViewSections.has(kanbanSectionId);
                    
                    return (
                      <div 
                        key={section.id} 
                        className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border/30 overflow-hidden"
                      >
                        {/* Kanban Column Header with Collapse */}
                        <button 
                          onClick={() => toggleViewSectionCollapse(kanbanSectionId)}
                          className="w-full flex items-center gap-2 px-3 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
                          style={{ borderLeft: `4px solid ${section.color}` }}
                        >
                          <Columns3 className="h-3.5 w-3.5" style={{ color: section.color }} />
                          <span className="text-sm font-semibold flex-1 text-left">{section.name}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {sectionTasks.length}
                          </span>
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <div className="p-1 hover:bg-muted/50 rounded transition-colors">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-lg z-50">
                              <DropdownMenuItem onClick={() => handleEditSection(section)} className="cursor-pointer">
                                <Edit className="h-4 w-4 mr-2" />{t('sections.editSection')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddTaskToSection(section.id)} className="cursor-pointer">
                                <PlusIcon className="h-4 w-4 mr-2" />{t('sections.addTask')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDuplicateSection(section.id)} className="cursor-pointer">
                                <Copy className="h-4 w-4 mr-2" />{t('common.duplicate')}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteSection(section.id)} 
                                className="cursor-pointer text-destructive focus:text-destructive"
                                disabled={sections.length <= 1}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </button>
                        
                        {/* Kanban Column Tasks with Drag & Drop */}
                        {!isCollapsed && (
                          <>
                            <Droppable droppableId={section.id}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cn("min-h-[300px] max-h-[400px] overflow-y-auto p-2 space-y-2", snapshot.isDraggingOver && "bg-primary/5")}
                                >
                                  {sectionTasks.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-muted-foreground">
                                      {t('sections.dropTasksHere')}
                                    </div>
                                  ) : (
                                    sectionTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={cn("bg-card rounded-lg border border-border/50 shadow-sm", snapshot.isDragging && "shadow-lg ring-2 ring-primary")}
                                          >
                                            {renderTaskItem(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                            
                            {/* Add Task Button */}
                            <div className="p-2 border-t border-border/30">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full justify-start text-muted-foreground"
                                onClick={() => handleAddTaskToSection(section.id)}
                              >
                                <PlusIcon className="h-4 w-4 mr-2" />
                                {t('sections.addTask')}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Completed Column for Kanban */}
                  {showCompleted && completedItems.length > 0 && (
                    <div className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                      <button 
                        onClick={() => toggleViewSectionCollapse('kanban-completed')}
                        className="w-full flex items-center gap-2 px-3 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
                        style={{ borderLeft: `4px solid #10b981` }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-sm font-semibold flex-1 text-left text-muted-foreground uppercase tracking-wide">Completed</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {completedItems.length}
                        </span>
                        {collapsedViewSections.has('kanban-completed') ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {!collapsedViewSections.has('kanban-completed') && (
                        <div className="min-h-[100px] max-h-[400px] overflow-y-auto p-2 space-y-2">
                          {completedItems.map((item) => (
                            <div key={item.id} className="bg-card rounded-lg border border-border/50 shadow-sm opacity-70">
                              {renderTaskItem(item)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Add Section Column */}
                  <div className="flex-shrink-0 w-72">
                    <Button 
                      variant="outline" 
                      className="w-full h-12 border-dashed"
                      onClick={() => handleAddSection('below')}
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add Section
                    </Button>
                  </div>
                </div>
              </div>
            </DragDropContext>
          ) : viewMode === 'kanban-status' ? (
            /* Status Kanban Board - Tasks grouped by status with drag-drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const taskId = draggableId;
              const sourceStatus = source.droppableId.replace('status-', '') as TaskStatus;
              const destStatus = destination.droppableId.replace('status-', '') as TaskStatus;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (source.droppableId === destination.droppableId && source.index === destination.index) return;
              
              // Update task status when moving between columns
              if (sourceStatus !== destStatus) {
                updateItem(taskId, { 
                  status: destStatus,
                  // Auto-complete when moved to completed column
                  completed: destStatus === 'completed',
                  completedAt: destStatus === 'completed' ? new Date() : undefined
                });
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
                toast.success(`Task status updated to ${destStatus.replace('_', ' ')}`);
              }
              
              // Persist new order
              const destGroupId = destination.droppableId;
              const destTasks = items.filter(item => {
                const itemStatus = item.status || 'not_started';
                return destGroupId === `status-${itemStatus}` || 
                       (destGroupId === 'status-completed' && item.completed);
              });
              const reorderedIds = destTasks.map(t => t.id).filter(id => id !== taskId);
              reorderedIds.splice(destIndex, 0, taskId);
              updateSectionOrder(destGroupId, reorderedIds);
              setOrderVersion(v => v + 1);
            }}>
              <div className="overflow-x-auto pb-4 -mx-4 px-4">
                <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                  {(() => {
                    const statusGroups: { id: TaskStatus; label: string; color: string; icon: React.ReactNode; tasks: TodoItem[] }[] = [
                      { 
                        id: 'not_started', 
                        label: 'Not Started', 
                        color: '#6b7280', 
                        icon: <Circle className="h-3.5 w-3.5" />,
                        tasks: uncompletedItems.filter(item => !item.status || item.status === 'not_started')
                      },
                      { 
                        id: 'in_progress', 
                        label: 'In Progress', 
                        color: '#3b82f6', 
                        icon: <Loader2 className="h-3.5 w-3.5" />,
                        tasks: uncompletedItems.filter(item => item.status === 'in_progress')
                      },
                      { 
                        id: 'almost_done', 
                        label: 'Almost Done', 
                        color: '#f59e0b', 
                        icon: <ClockIcon className="h-3.5 w-3.5" />,
                        tasks: uncompletedItems.filter(item => item.status === 'almost_done')
                      },
                      { 
                        id: 'completed', 
                        label: 'Completed', 
                        color: '#10b981', 
                        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                        tasks: completedItems
                      },
                    ];
                    
                    return statusGroups.map((group) => {
                      const statusSectionId = `status-${group.id}`;
                      const isCollapsed = collapsedViewSections.has(statusSectionId);
                      const orderedTasks = applyTaskOrder(group.tasks, statusSectionId);
                      
                      return (
                        <div 
                          key={group.id} 
                          className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border/30 overflow-hidden"
                        >
                          <button 
                            onClick={() => toggleViewSectionCollapse(statusSectionId)}
                            className="w-full flex items-center gap-2 px-3 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
                            style={{ borderLeft: `4px solid ${group.color}` }}
                          >
                            <span style={{ color: group.color }}>{group.icon}</span>
                            <span className="text-sm font-semibold flex-1 text-left">{group.label}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {group.tasks.length}
                            </span>
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          
                          {!isCollapsed && (
                            <Droppable droppableId={statusSectionId}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cn(
                                    "min-h-[200px] max-h-[400px] overflow-y-auto p-2 space-y-2",
                                    snapshot.isDraggingOver && "bg-primary/5"
                                  )}
                                >
                                  {orderedTasks.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-muted-foreground">
                                      Drop tasks here
                                    </div>
                                  ) : (
                                    orderedTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={cn(
                                              "bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden",
                                              snapshot.isDragging && "shadow-lg ring-2 ring-primary",
                                              group.id === 'completed' && "opacity-70"
                                            )}
                                          >
                                            {renderTaskItem(item)}
                                            {renderSubtasksInline(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </DragDropContext>
          ) : viewMode === 'timeline' ? (
            /* Timeline Board - Tasks grouped by date with drag-drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const taskId = draggableId;
              const sourceGroup = source.droppableId;
              const destGroup = destination.droppableId;
              const sourceIndex = source.index;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (sourceGroup === destGroup && sourceIndex === destIndex) return;
              
              const today = new Date();
              let newDate: Date | undefined;
              
              // Only update date if moving to a different group
              if (sourceGroup !== destGroup) {
                if (destGroup === 'timeline-overdue') newDate = subDays(today, 1);
                else if (destGroup === 'timeline-today') newDate = today;
                else if (destGroup === 'timeline-tomorrow') { newDate = new Date(); newDate.setDate(newDate.getDate() + 1); }
                else if (destGroup === 'timeline-thisweek') { newDate = new Date(); newDate.setDate(newDate.getDate() + 3); }
                else if (destGroup === 'timeline-later') { newDate = new Date(); newDate.setDate(newDate.getDate() + 14); }
                else if (destGroup === 'timeline-nodate') newDate = undefined;
                
                updateItem(taskId, { dueDate: newDate });
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
                toast.success('Task date updated');
              }
              
              // Persist new order for the destination group (whether moved or reordered)
              const destGroupTasks = items.filter(item => !item.completed).filter(item => {
                const itemDate = item.dueDate ? new Date(item.dueDate) : null;
                if (destGroup === 'timeline-overdue') return itemDate && isBefore(itemDate, startOfDay(today));
                if (destGroup === 'timeline-today') return itemDate && isToday(itemDate);
                if (destGroup === 'timeline-tomorrow') return itemDate && isTomorrow(itemDate);
                if (destGroup === 'timeline-thisweek') return itemDate && isThisWeek(itemDate) && !isToday(itemDate) && !isTomorrow(itemDate);
                if (destGroup === 'timeline-later') return itemDate && !isBefore(itemDate, startOfDay(today)) && !isThisWeek(itemDate);
                if (destGroup === 'timeline-nodate') return !itemDate;
                return false;
              });
              const reorderedIds = destGroupTasks.map(t => t.id).filter(id => id !== taskId);
              reorderedIds.splice(destIndex, 0, taskId);
              updateSectionOrder(destGroup, reorderedIds);
              
              // Force re-render to apply the new order immediately
              setOrderVersion(v => v + 1);
              
              Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            }}>
              <div className="space-y-6">
                {(() => {
                  const today = startOfDay(new Date());
                  const overdueTasks = uncompletedItems.filter(item => item.dueDate && isBefore(new Date(item.dueDate), today));
                  const todayTasks = uncompletedItems.filter(item => item.dueDate && isToday(new Date(item.dueDate)));
                  const tomorrowTasks = uncompletedItems.filter(item => item.dueDate && isTomorrow(new Date(item.dueDate)));
                  const thisWeekTasks = uncompletedItems.filter(item => item.dueDate && isThisWeek(new Date(item.dueDate)) && !isToday(new Date(item.dueDate)) && !isTomorrow(new Date(item.dueDate)));
                  const laterTasks = uncompletedItems.filter(item => item.dueDate && !isBefore(new Date(item.dueDate), today) && !isThisWeek(new Date(item.dueDate)));
                  const noDateTasks = uncompletedItems.filter(item => !item.dueDate);
                  
                  const timelineGroups = [
                    { id: 'timeline-overdue', label: 'Overdue', tasks: overdueTasks, color: '#ef4444', icon: <AlertCircle className="h-4 w-4" /> },
                    { id: 'timeline-today', label: 'Today', tasks: todayTasks, color: '#3b82f6', icon: <Sun className="h-4 w-4" /> },
                    { id: 'timeline-tomorrow', label: 'Tomorrow', tasks: tomorrowTasks, color: '#f59e0b', icon: <CalendarIcon2 className="h-4 w-4" /> },
                    { id: 'timeline-thisweek', label: 'This Week', tasks: thisWeekTasks, color: '#10b981', icon: <CalendarIcon2 className="h-4 w-4" /> },
                    { id: 'timeline-later', label: 'Later', tasks: laterTasks, color: '#8b5cf6', icon: <Clock className="h-4 w-4" /> },
                    { id: 'timeline-nodate', label: 'No Date', tasks: noDateTasks, color: '#6b7280', icon: <CalendarX className="h-4 w-4" /> },
                  ];
                  
                  return (
                    <>
                      {timelineGroups.map((group) => {
                        const isCollapsed = collapsedViewSections.has(group.id);
                        // Apply persisted order
                        const orderedTasks = applyTaskOrder(group.tasks, group.id);
                        return (
                          <div key={group.label} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                            {renderViewModeSectionHeader(group.label, group.tasks.length, group.color, group.icon, group.id)}
                            {!isCollapsed && (
                              <Droppable droppableId={group.id}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.droppableProps} className={cn("p-2 space-y-2 min-h-[50px]", snapshot.isDraggingOver && "bg-primary/5")}>
                                    {orderedTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={cn("bg-card rounded-lg border border-border/50", snapshot.isDragging && "shadow-lg ring-2 ring-primary")}>
                                            {renderTaskItem(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            )}
                          </div>
                        );
                      })}
                      {renderCompletedSectionForViewMode()}
                    </>
                  );
                })()}
              </div>
            </DragDropContext>
          ) : viewMode === 'progress' ? (
            /* Progress Board - Tasks grouped by completion status/subtask progress with drag-drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination } = result;
              
              const taskId = result.draggableId;
              const destGroup = destination.droppableId;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (source.droppableId === destination.droppableId && source.index === destination.index) return;
              
              // Progress board allows visual reordering with haptic feedback
              // Persist the new order
              const destGroupTasks = items.filter(item => !item.completed).filter(item => {
                const hasSubtasks = item.subtasks && item.subtasks.length > 0;
                const completedSubtasks = hasSubtasks ? item.subtasks.filter(st => st.completed).length : 0;
                const totalSubtasks = hasSubtasks ? item.subtasks.length : 0;
                const completionPercent = hasSubtasks ? completedSubtasks / totalSubtasks : 0;
                
                if (destGroup === 'progress-notstarted') return !hasSubtasks || completedSubtasks === 0;
                if (destGroup === 'progress-inprogress') return hasSubtasks && completedSubtasks > 0 && completionPercent < 0.75;
                if (destGroup === 'progress-almostdone') return hasSubtasks && completionPercent >= 0.75 && completedSubtasks < totalSubtasks;
                return false;
              });
              const reorderedIds = destGroupTasks.map(t => t.id).filter(id => id !== taskId);
              reorderedIds.splice(destIndex, 0, taskId);
              updateSectionOrder(destGroup, reorderedIds);
              
              // Force re-render to apply the new order immediately
              setOrderVersion(v => v + 1);
              
              Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            }}>
              <div className="space-y-6">
                {(() => {
                  const notStarted = uncompletedItems.filter(item => !item.subtasks || item.subtasks.length === 0 || item.subtasks.every(st => !st.completed));
                  const inProgress = uncompletedItems.filter(item => item.subtasks && item.subtasks.length > 0 && item.subtasks.some(st => st.completed) && item.subtasks.some(st => !st.completed));
                  const almostDone = uncompletedItems.filter(item => item.subtasks && item.subtasks.length > 0 && item.subtasks.filter(st => st.completed).length >= item.subtasks.length * 0.75 && item.subtasks.some(st => !st.completed));
                  
                  const progressGroups = [
                    { id: 'progress-notstarted', label: 'Not Started', tasks: notStarted.filter(t => !inProgress.includes(t) && !almostDone.includes(t)), color: '#6b7280', percent: '0%' },
                    { id: 'progress-inprogress', label: 'In Progress', tasks: inProgress.filter(t => !almostDone.includes(t)), color: '#f59e0b', percent: '25-74%' },
                    { id: 'progress-almostdone', label: 'Almost Done', tasks: almostDone, color: '#10b981', percent: '75%+' },
                  ];
                  
                  return (
                    <>
                      {progressGroups.map((group) => {
                        const isCollapsed = collapsedViewSections.has(group.id);
                        // Apply persisted order
                        const orderedTasks = applyTaskOrder(group.tasks, group.id);
                        return (
                          <div key={group.label} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                            {renderViewModeSectionHeader(
                              group.label, 
                              group.tasks.length, 
                              group.color, 
                              <TrendingUp className="h-4 w-4" />, 
                              group.id,
                              <span className="text-xs text-muted-foreground">{group.percent}</span>
                            )}
                            {!isCollapsed && (
                              <Droppable droppableId={group.id}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.droppableProps} className={cn("p-2 space-y-2 min-h-[50px]", snapshot.isDraggingOver && "bg-primary/5")}>
                                    {orderedTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={cn("bg-card rounded-lg border border-border/50 overflow-hidden", snapshot.isDragging && "shadow-lg ring-2 ring-primary")}>
                                            {renderTaskItem(item)}
                                            {renderSubtasksInline(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            )}
                          </div>
                        );
                      })}
                      {renderCompletedSectionForViewMode()}
                    </>
                  );
                })()}
              </div>
            </DragDropContext>
          ) : viewMode === 'priority' ? (
            /* Priority Board - Tasks grouped by priority with drag-drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const taskId = draggableId;
              const sourceGroup = source.droppableId;
              const destGroup = destination.droppableId;
              const sourceIndex = source.index;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (sourceGroup === destGroup && sourceIndex === destIndex) return;
              
              // Only update priority if moving to a different group
              if (sourceGroup !== destGroup) {
                let newPriority: Priority = 'none';
                
                if (destGroup === 'priority-high') newPriority = 'high';
                else if (destGroup === 'priority-medium') newPriority = 'medium';
                else if (destGroup === 'priority-low') newPriority = 'low';
                else if (destGroup === 'priority-none') newPriority = 'none';
                
                updateItem(taskId, { priority: newPriority });
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
                toast.success('Priority updated');
              }
              
              // Persist new order for the destination group
              const destGroupTasks = items.filter(item => !item.completed).filter(item => {
                if (destGroup === 'priority-high') return item.priority === 'high';
                if (destGroup === 'priority-medium') return item.priority === 'medium';
                if (destGroup === 'priority-low') return item.priority === 'low';
                if (destGroup === 'priority-none') return !item.priority || item.priority === 'none';
                return false;
              });
              const reorderedIds = destGroupTasks.map(t => t.id).filter(id => id !== taskId);
              reorderedIds.splice(destIndex, 0, taskId);
              updateSectionOrder(destGroup, reorderedIds);
              
              // Force re-render to apply the new order immediately
              setOrderVersion(v => v + 1);
              
              Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            }}>
              <div className="space-y-6">
                {(() => {
                  const highPriority = uncompletedItems.filter(item => item.priority === 'high');
                  const mediumPriority = uncompletedItems.filter(item => item.priority === 'medium');
                  const lowPriority = uncompletedItems.filter(item => item.priority === 'low');
                  const noPriority = uncompletedItems.filter(item => !item.priority || item.priority === 'none');
                  
                  const priorityGroups = [
                    { id: 'priority-high', label: 'High Priority', tasks: highPriority, color: '#ef4444', icon: <Flame className="h-4 w-4" /> },
                    { id: 'priority-medium', label: 'Medium Priority', tasks: mediumPriority, color: '#f59e0b', icon: <Flag className="h-4 w-4" /> },
                    { id: 'priority-low', label: 'Low Priority', tasks: lowPriority, color: '#10b981', icon: <Flag className="h-4 w-4" /> },
                    { id: 'priority-none', label: 'No Priority', tasks: noPriority, color: '#6b7280', icon: <Flag className="h-4 w-4" /> },
                  ];
                  
                  return (
                    <>
                      {priorityGroups.map((group) => {
                        const isCollapsed = collapsedViewSections.has(group.id);
                        // Apply persisted order
                        const orderedTasks = applyTaskOrder(group.tasks, group.id);
                        return (
                          <div key={group.label} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                            {renderViewModeSectionHeader(group.label, group.tasks.length, group.color, group.icon, group.id)}
                            {!isCollapsed && (
                              <Droppable droppableId={group.id}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.droppableProps} className={cn("p-2 space-y-2 min-h-[50px]", snapshot.isDraggingOver && "bg-primary/5")}>
                                    {orderedTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={cn("bg-card rounded-lg border border-border/50 overflow-hidden", snapshot.isDragging && "shadow-lg ring-2 ring-primary")}>
                                            {renderTaskItem(item)}
                                            {renderSubtasksInline(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            )}
                          </div>
                        );
                      })}
                      {renderCompletedSectionForViewMode()}
                    </>
                  );
                })()}
              </div>
            </DragDropContext>
          ) : viewMode === 'history' ? (
            /* History Log - Recent activity and completed tasks */
            <div className="space-y-6">
              {(() => {
                const todayCompleted = completedItems.filter(item => item.dueDate && isToday(new Date(item.dueDate)));
                const yesterdayCompleted = completedItems.filter(item => item.dueDate && isYesterday(new Date(item.dueDate)));
                const thisWeekCompleted = completedItems.filter(item => item.dueDate && isThisWeek(new Date(item.dueDate)) && !isToday(new Date(item.dueDate)) && !isYesterday(new Date(item.dueDate)));
                const olderCompleted = completedItems.filter(item => !item.dueDate || (!isThisWeek(new Date(item.dueDate))));
                
                const historyGroups = [
                  { label: t('grouping.completedToday', 'Completed Today'), tasks: todayCompleted, color: '#10b981' },
                  { label: t('grouping.completedYesterday', 'Completed Yesterday'), tasks: yesterdayCompleted, color: '#3b82f6' },
                  { label: t('grouping.thisWeek', 'This Week'), tasks: thisWeekCompleted, color: '#8b5cf6' },
                  { label: t('grouping.older', 'Older'), tasks: olderCompleted, color: '#6b7280' },
                ];
                
                return historyGroups.filter(g => g.tasks.length > 0).length === 0 ? (
                  <div className="text-center py-20">
                    <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">{t('emptyStates.noCompletedTasks')}</p>
                  </div>
                ) : (
                  <>
                    {historyGroups.filter(g => g.tasks.length > 0).map((group) => {
                      const sectionId = `history-${group.label.toLowerCase().replace(/\s+/g, '-')}`;
                      const isCollapsed = collapsedViewSections.has(sectionId);
                      return (
                        <div key={group.label} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                          {renderViewModeSectionHeader(group.label, group.tasks.length, group.color, <CheckCircle2 className="h-4 w-4" />, sectionId)}
                          {!isCollapsed && (
                            <div className="p-2 space-y-2">
                              {group.tasks.map((item) => (
                                <div key={item.id} className="bg-card rounded-lg border border-border/50 opacity-70">
                                  {renderTaskItem(item)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          ) : groupByOption !== 'none' ? (
            /* Grouped Flat Mode with Drag & Drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const taskId = draggableId;
              const sourceGroup = source.droppableId.replace('grouped-', '');
              const destGroup = destination.droppableId.replace('grouped-', '');
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (source.droppableId === destination.droppableId && source.index === destination.index) return;
              
              // Update task based on group type
              if (sourceGroup !== destGroup) {
                if (groupByOption === 'priority') {
                  const priorityMap: Record<string, Priority> = { 'high': 'high', 'medium': 'medium', 'low': 'low', 'none': 'none' };
                  updateItem(taskId, { priority: priorityMap[destGroup] || 'none' });
                  toast.success('Priority updated');
                } else if (groupByOption === 'section') {
                  updateItem(taskId, { sectionId: destGroup });
                  toast.success('Moved to section');
                } else if (groupByOption === 'date') {
                  const today = new Date();
                  let newDate: Date | undefined;
                  if (destGroup === 'overdue') newDate = subDays(today, 1);
                  else if (destGroup === 'today') newDate = today;
                  else if (destGroup === 'tomorrow') { newDate = new Date(); newDate.setDate(newDate.getDate() + 1); }
                  else if (destGroup === 'this-week') { newDate = new Date(); newDate.setDate(newDate.getDate() + 3); }
                  else if (destGroup === 'later') { newDate = new Date(); newDate.setDate(newDate.getDate() + 14); }
                  else if (destGroup === 'no-date') newDate = undefined;
                  updateItem(taskId, { dueDate: newDate });
                  toast.success('Date updated');
                }
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
              }
              
              // Persist order in destination group
              const destGroupId = `grouped-${destGroup}`;
              updateSectionOrder(destGroupId, [taskId]);
              setOrderVersion(v => v + 1);
            }}>
              <div className="space-y-4">
                {(() => {
                  // Generate groups based on groupByOption
                  let groups: { id: string; label: string; color: string; icon: React.ReactNode; tasks: TodoItem[] }[] = [];
                  
                  if (groupByOption === 'section') {
                    groups = sortedSections.map(section => ({
                      id: section.id,
                      label: section.name,
                      color: section.color,
                      icon: <Columns3 className="h-4 w-4" style={{ color: section.color }} />,
                      tasks: uncompletedItems.filter(item => item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id))
                    }));
                  } else if (groupByOption === 'priority') {
                    groups = [
                      { id: 'high', label: t('grouping.highPriority'), color: '#ef4444', icon: <Flame className="h-4 w-4 text-red-500" />, tasks: uncompletedItems.filter(item => item.priority === 'high') },
                      { id: 'medium', label: t('grouping.mediumPriority'), color: '#f59e0b', icon: <Flag className="h-4 w-4 text-amber-500" />, tasks: uncompletedItems.filter(item => item.priority === 'medium') },
                      { id: 'low', label: t('grouping.lowPriority'), color: '#22c55e', icon: <Flag className="h-4 w-4 text-green-500" />, tasks: uncompletedItems.filter(item => item.priority === 'low') },
                      { id: 'none', label: t('grouping.noPriority'), color: '#6b7280', icon: <Flag className="h-4 w-4 text-muted-foreground" />, tasks: uncompletedItems.filter(item => !item.priority || item.priority === 'none') },
                    ];
                  } else if (groupByOption === 'date') {
                    const today = startOfDay(new Date());
                    groups = [
                      { id: 'overdue', label: t('grouping.overdue'), color: '#ef4444', icon: <AlertCircle className="h-4 w-4 text-red-500" />, tasks: uncompletedItems.filter(item => item.dueDate && isBefore(new Date(item.dueDate), today)) },
                      { id: 'today', label: t('grouping.today'), color: '#3b82f6', icon: <Sun className="h-4 w-4 text-blue-500" />, tasks: uncompletedItems.filter(item => item.dueDate && isToday(new Date(item.dueDate))) },
                      { id: 'tomorrow', label: t('grouping.tomorrow'), color: '#f59e0b', icon: <CalendarIcon2 className="h-4 w-4 text-amber-500" />, tasks: uncompletedItems.filter(item => item.dueDate && isTomorrow(new Date(item.dueDate))) },
                      { id: 'this-week', label: t('grouping.thisWeek'), color: '#10b981', icon: <CalendarIcon2 className="h-4 w-4 text-green-500" />, tasks: uncompletedItems.filter(item => item.dueDate && isThisWeek(new Date(item.dueDate)) && !isToday(new Date(item.dueDate)) && !isTomorrow(new Date(item.dueDate))) },
                      { id: 'later', label: t('grouping.later'), color: '#8b5cf6', icon: <Clock className="h-4 w-4 text-purple-500" />, tasks: uncompletedItems.filter(item => item.dueDate && !isBefore(new Date(item.dueDate), today) && !isThisWeek(new Date(item.dueDate))) },
                      { id: 'no-date', label: t('grouping.noDate'), color: '#6b7280', icon: <CalendarX className="h-4 w-4 text-muted-foreground" />, tasks: uncompletedItems.filter(item => !item.dueDate) },
                    ];
                  }
                  
                  // Show all groups including empty ones for drag-drop targets
                  return groups.map(group => {
                    const groupSectionId = `group-${groupByOption}-${group.id}`;
                    const isCollapsed = collapsedViewSections.has(groupSectionId);
                    const orderedTasks = applyTaskOrder(group.tasks, `grouped-${group.id}`);
                    
                    return (
                      <div key={group.id} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                        <button 
                          onClick={() => toggleViewSectionCollapse(groupSectionId)}
                          className="w-full flex items-center gap-2 px-3 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
                          style={{ borderLeft: `4px solid ${group.color}` }}
                        >
                          {group.icon}
                          <span className="text-sm font-semibold flex-1 text-left">{group.label}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {group.tasks.length}
                          </span>
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        {!isCollapsed && (
                          <Droppable droppableId={`grouped-${group.id}`}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                  "p-2 space-y-1 min-h-[40px]",
                                  compactMode && "p-1 space-y-0",
                                  snapshot.isDraggingOver && "bg-primary/5"
                                )}
                              >
                                {orderedTasks.length === 0 ? (
                                  <div className="py-4 text-center text-sm text-muted-foreground">
                                    Drop tasks here
                                  </div>
                                ) : (
                                  orderedTasks.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={cn(
                                            "bg-card rounded-lg border border-border/50",
                                            snapshot.isDragging && "shadow-lg ring-2 ring-primary"
                                          )}
                                        >
                                          {renderTaskItem(item)}
                                          {renderSubtasksInline(item)}
                                        </div>
                                      )}
                                    </Draggable>
                                  ))
                                )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    );
                  });
                })()}
                {/* Completed Section */}
                {showCompleted && completedItems.length > 0 && (
                  <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen}>
                    <div className="bg-muted/50 rounded-xl p-3 border border-border/30">
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between px-2 py-2 hover:bg-muted/60 rounded-lg transition-colors">
                          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">COMPLETED</span>
                          <div className="flex items-center gap-2 text-muted-foreground"><span className="text-sm font-medium">{completedItems.length}</span>{isCompletedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className={cn("space-y-2 mt-2", compactMode && "space-y-1 mt-1")}>{completedItems.map(renderTaskItem)}</CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
              </div>
            </DragDropContext>
          ) : (
            /* Flat/Card Mode - Vertical Sections */
            <div className="space-y-4">
              {/* Render sections with unified drag-drop */}
              <UnifiedDragDropList
                sections={sortedSections}
                items={uncompletedItems}
                onReorder={handleUnifiedReorder}
                onSectionReorder={handleSectionReorder}
                onTaskClick={handleSubtaskClick}
                expandedTasks={expandedTasks}
                renderSectionHeader={renderSectionHeader}
                selectedFolderId={selectedFolderId}
                renderEmptySection={(section) => (
                  <div className={cn("text-center text-sm text-muted-foreground", compactMode ? "py-2 px-2" : "py-4 px-4")}>
                    {t('emptyStates.noTasksInSection')}
                  </div>
                )}
                renderTask={(item, isDragging, isDropTarget) => (
                  <div className={cn(isDragging && "bg-card rounded-lg")}>
                    {renderTaskItem(item)}
                  </div>
                )}
                renderSubtask={(subtask, parentId, isDragging) => {
                  const currentSubtaskSwipe = subtaskSwipeState?.id === subtask.id ? subtaskSwipeState : null;
                  
                  return (
                    <div className="relative overflow-hidden">
                      {/* Swipe action backgrounds - only show relevant color based on direction */}
                      {currentSubtaskSwipe && currentSubtaskSwipe.isSwiping && (
                        <div className="absolute inset-0 flex">
                          {currentSubtaskSwipe.x > 0 && (
                            <div className={cn(
                              "absolute inset-0 flex items-center justify-start pl-4 transition-colors",
                              currentSubtaskSwipe.x > SWIPE_THRESHOLD ? "bg-green-500" : "bg-green-500/70"
                            )}>
                              <Check className="h-4 w-4 text-white" />
                            </div>
                          )}
                          {currentSubtaskSwipe.x < 0 && (
                            <div className={cn(
                              "absolute inset-0 flex items-center justify-end pr-4 transition-colors",
                              currentSubtaskSwipe.x < -SWIPE_THRESHOLD ? "bg-red-500" : "bg-red-500/70"
                            )}>
                              <TrashIcon className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Subtask content */}
                      <div 
                        className={cn(
                          "flex items-start gap-3 border-b border-border/30 last:border-b-0 cursor-pointer bg-muted/10 transition-colors",
                          compactMode ? "py-1 px-2 gap-2" : "py-2 px-3",
                          isDragging && "bg-card shadow-lg"
                        )}
                        style={{ 
                          transform: `translateX(${currentSubtaskSwipe?.x || 0}px)`, 
                          transition: currentSubtaskSwipe?.isSwiping ? 'none' : 'transform 0.3s ease-out' 
                        }}
                        onClick={() => !currentSubtaskSwipe?.isSwiping && setSelectedSubtask({ subtask, parentId })}
                        onTouchStart={(e) => handleSubtaskSwipeStart(subtask.id, parentId, e)}
                        onTouchMove={(e) => handleSubtaskSwipeMove(subtask.id, parentId, e)}
                        onTouchEnd={() => handleSubtaskSwipeEnd(subtask, parentId)}
                      >
                        <Checkbox
                          checked={subtask.completed}
                          onCheckedChange={async (checked) => {
                            updateSubtask(parentId, subtask.id, { completed: !!checked });
                            if (checked) try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "rounded-sm mt-0.5 flex-shrink-0",
                            compactMode ? "h-3.5 w-3.5" : "h-4 w-4",
                            subtask.completed ? "bg-muted-foreground/30 border-0" : "border-2 border-muted-foreground/40"
                          )}
                        />
                        <span className={cn("flex-1", compactMode ? "text-xs" : "text-sm", subtask.completed && "text-muted-foreground")}>
                          {subtask.text}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              {/* Completed Section */}
              {showCompleted && completedItems.length > 0 && (
                <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen}>
                  <div className="bg-muted/50 rounded-xl p-3 border border-border/30">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between px-2 py-2 hover:bg-muted/60 rounded-lg transition-colors">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('grouping.completed')}</span>
                        <div className="flex items-center gap-2 text-muted-foreground"><span className="text-sm font-medium">{completedItems.length}</span>{isCompletedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className={cn("space-y-2 mt-2", compactMode && "space-y-1 mt-1")}>{completedItems.map(renderTaskItem)}</CollapsibleContent>
                  </div>
                </Collapsible>
              )}
            </div>
          )}
        </div>
      </main>

      <Button onClick={async () => { try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {} setIsInputOpen(true); }} className="fixed bottom-20 left-4 right-4 z-30 h-12 text-base font-semibold" size="lg">
        <Plus className="h-5 w-5" />{t('tasks.addTask')}
      </Button>

      <TaskInputSheet isOpen={isInputOpen} onClose={() => { setIsInputOpen(false); setInputSectionId(null); }} onAddTask={handleAddTask} folders={folders} selectedFolderId={selectedFolderId} onCreateFolder={handleCreateFolder} sections={sections} selectedSectionId={inputSectionId} />
      <TaskDetailPage 
        isOpen={!!selectedTask} 
        task={selectedTask} 
        folders={folders}
        allTasks={items}
        onClose={() => setSelectedTask(null)} 
        onUpdate={(updatedTask) => { updateItem(updatedTask.id, updatedTask); setSelectedTask(updatedTask); }} 
        onDelete={deleteItem} 
        onDuplicate={duplicateTask}
        onConvertToNote={handleConvertSingleTask}
        onMoveToFolder={handleMoveTaskToFolder}
      />
      <TaskFilterSheet isOpen={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)} folders={folders} selectedFolderId={selectedFolderId} onFolderChange={setSelectedFolderId} dateFilter={dateFilter} onDateFilterChange={setDateFilter} priorityFilter={priorityFilter} onPriorityFilterChange={setPriorityFilter} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} selectedTags={tagFilter} onTagsChange={setTagFilter} onClearAll={handleClearFilters} />
      <DuplicateOptionsSheet isOpen={isDuplicateSheetOpen} onClose={() => setIsDuplicateSheetOpen(false)} onSelect={handleDuplicate} />
      <FolderManageSheet isOpen={isFolderManageOpen} onClose={() => setIsFolderManageOpen(false)} folders={folders} onCreateFolder={handleCreateFolder} onEditFolder={handleEditFolder} onDeleteFolder={handleDeleteFolder} onReorderFolders={handleReorderFolders} />
      <MoveToFolderSheet isOpen={isMoveToFolderOpen} onClose={() => setIsMoveToFolderOpen(false)} folders={folders} onSelect={handleMoveToFolder} />
      <SelectActionsSheet isOpen={isSelectActionsOpen} onClose={() => setIsSelectActionsOpen(false)} selectedCount={selectedTaskIds.size} onAction={handleSelectAction} totalCount={uncompletedItems.length} />
      <PrioritySelectSheet isOpen={isPrioritySheetOpen} onClose={() => setIsPrioritySheetOpen(false)} onSelect={handleSetPriority} />
      <BatchTaskSheet isOpen={isBatchTaskOpen} onClose={() => setIsBatchTaskOpen(false)} onAddTasks={handleBatchAddTasks} sections={sections} folders={folders} />
      <SectionEditSheet 
        isOpen={isSectionEditOpen} 
        onClose={() => { setIsSectionEditOpen(false); setEditingSection(null); }} 
        section={editingSection} 
        onSave={handleSaveSection} 
      />
      <SectionMoveSheet 
        isOpen={isSectionMoveOpen} 
        onClose={() => { setIsSectionMoveOpen(false); setEditingSection(null); }} 
        sections={sections} 
        currentSectionId={editingSection?.id || ''} 
        onMoveToPosition={(targetIndex) => editingSection && handleMoveSection(editingSection.id, targetIndex)} 
      />
      <SubtaskDetailSheet
        isOpen={!!selectedSubtask}
        subtask={selectedSubtask?.subtask || null}
        parentId={selectedSubtask?.parentId || null}
        onClose={() => setSelectedSubtask(null)}
        onUpdate={handleUpdateSubtaskFromSheet}
        onDelete={handleDeleteSubtaskFromSheet}
        onConvertToTask={handleConvertSubtaskToTask}
      />
      <TaskOptionsSheet
        isOpen={isTaskOptionsOpen}
        onClose={() => setIsTaskOptionsOpen(false)}
        groupBy={groupBy}
        sortBy={optionsSortBy}
        onGroupByChange={setGroupBy}
        onSortByChange={setOptionsSortBy}
        sections={sections}
        defaultSectionId={defaultSectionId}
        onDefaultSectionChange={setDefaultSectionId}
        taskAddPosition={taskAddPosition}
        onTaskAddPositionChange={setTaskAddPosition}
        hideDetailsOptions={hideDetailsOptions}
        onHideDetailsOptionsChange={setHideDetailsOptions}
      />
      <ResolvedImageDialog imageRef={selectedImage} onClose={() => setSelectedImage(null)} />
      <LocationRemindersMap
        open={isLocationMapOpen}
        onOpenChange={setIsLocationMapOpen}
        tasks={items}
        onTaskClick={(task) => {
          setSelectedTask(task);
          setIsLocationMapOpen(false);
        }}
      />
      <BulkDateSheet
        isOpen={isBulkDateSheetOpen}
        onClose={() => setIsBulkDateSheetOpen(false)}
        selectedCount={selectedTaskIds.size}
        onSetDate={(date) => {
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, dueDate: date } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          toast.success(`Updated due date for ${selectedTaskIds.size} task(s)`);
        }}
      />
      <BulkReminderSheet
        isOpen={isBulkReminderSheetOpen}
        onClose={() => setIsBulkReminderSheetOpen(false)}
        selectedCount={selectedTaskIds.size}
        onSetReminder={(date) => {
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, reminderTime: date } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          toast.success(`Updated reminder for ${selectedTaskIds.size} task(s)`);
        }}
      />
      <BulkRepeatSheet
        isOpen={isBulkRepeatSheetOpen}
        onClose={() => setIsBulkRepeatSheetOpen(false)}
        selectedCount={selectedTaskIds.size}
        onSetRepeat={(repeatType) => {
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, repeatType } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          toast.success(`Updated repeat for ${selectedTaskIds.size} task(s)`);
        }}
      />
      <BulkSectionMoveSheet
        isOpen={isBulkSectionMoveOpen}
        onClose={() => setIsBulkSectionMoveOpen(false)}
        selectedCount={selectedTaskIds.size}
        sections={sections}
        onMoveToSection={(sectionId) => {
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, sectionId } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          toast.success(`Moved ${selectedTaskIds.size} task(s) to section`);
        }}
      />
      <BulkStatusSheet
        isOpen={isBulkStatusOpen}
        onClose={() => setIsBulkStatusOpen(false)}
        selectedCount={selectedTaskIds.size}
        onStatusChange={(status) => {
          const isCompleting = status === 'completed';
          const now = new Date();
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { 
            ...i, 
            status,
            completed: isCompleting ? true : i.completed,
            completedAt: isCompleting ? now : i.completedAt,
            modifiedAt: now
          } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          if (isCompleting) {
            playCompletionSound();
          }
          toast.success(`Updated status for ${selectedTaskIds.size} task(s)`);
        }}
      />
      
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

export default Today;

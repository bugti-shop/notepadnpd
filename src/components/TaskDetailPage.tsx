import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem, Priority, Folder, Note, RepeatType, ColoredTag, TimeTracking, TaskStatus } from '@/types/note';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { logActivity } from '@/utils/activityLogger';
import { TaskStatusBadge, TASK_STATUS_OPTIONS, getStatusConfig } from './TaskStatusBadge';
import {
  FolderIcon,
  ChevronDown,
  MoreVertical,
  Check,
  Flag,
  Copy,
  Pin,
  Trash2,
  Plus,
  Calendar as CalendarIcon,
  FileText,
  Tag,
  X,
  MapPin,
  Link,
  Clock,
  GripVertical,
  Circle
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { LocationMapPreview } from './LocationMapPreview';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { WaveformProgressBar } from './WaveformProgressBar';
import { Play, Pause } from 'lucide-react';
import { TaskDateTimePage, RepeatSettings } from './TaskDateTimePage';
import { TaskTimeTracker } from './TaskTimeTracker';
import { TaskDependencySheet, canCompleteTask } from './TaskDependencySheet';
import { notificationManager } from '@/utils/notifications';
import { ResolvedTaskImage } from './ResolvedTaskImage';
import { resolveTaskMediaUrl } from '@/utils/todoItemsStorage';
import { TaskInputSheet } from './TaskInputSheet';
import { SubtaskDetailSheet } from './SubtaskDetailSheet';

interface TaskDetailPageProps {
  isOpen: boolean;
  task: TodoItem | null;
  folders: Folder[];
  allTasks?: TodoItem[];
  onClose: () => void;
  onUpdate: (task: TodoItem) => void;
  onDelete: (taskId: string) => void;
  onDuplicate: (task: TodoItem) => void;
  onConvertToNote: (task: TodoItem) => void;
  onMoveToFolder: (taskId: string, folderId: string | null) => void;
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];


export const TaskDetailPage = ({
  isOpen,
  task,
  folders,
  allTasks = [],
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  onConvertToNote,
  onMoveToFolder
}: TaskDetailPageProps) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [isSubtaskInputSheetOpen, setIsSubtaskInputSheetOpen] = useState(false);
  const [showDateTimePage, setShowDateTimePage] = useState(false);
  const [showDependencySheet, setShowDependencySheet] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceCurrentTime, setVoiceCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [voicePlaybackSpeed, setVoicePlaybackSpeed] = useState(1);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);
  const VOICE_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];
  const [reminderOffset, setReminderOffset] = useState<string>('');
  const [repeatSettings, setRepeatSettings] = useState<RepeatSettings | undefined>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  
  // Subtask detail sheet state
  const [selectedSubtask, setSelectedSubtask] = useState<TodoItem | null>(null);
  const [showSubtaskDetailSheet, setShowSubtaskDetailSheet] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.text);
      // Resolve audio URL
      if (task.voiceRecording?.audioUrl) {
        resolveTaskMediaUrl(task.voiceRecording.audioUrl).then(url => {
          if (url) setResolvedAudioUrl(url);
        });
      } else {
        setResolvedAudioUrl(null);
      }
    }
  }, [task]);

  useEffect(() => {
    if (showSubtaskInput && subtaskInputRef.current) {
      subtaskInputRef.current.focus();
    }
  }, [showSubtaskInput]);

  // Handle hardware back button on Android
  const handleBack = useCallback(() => {
    onClose();
  }, [onClose]);

  useHardwareBackButton({
    onBack: handleBack,
    enabled: isOpen && !showDateTimePage && !showDependencySheet,
    priority: 'sheet',
  });

  if (!isOpen || !task) return null;

  const currentFolder = folders.find(f => f.id === task.folderId);

  const handleTitleBlur = () => {
    if (title.trim() !== task.text) {
      onUpdate({ ...task, text: title.trim() });
    }
  };

  const handleMarkAsDone = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    onUpdate({ ...task, completed: !task.completed });
    toast.success(task.completed ? t('taskDetail.markAsIncomplete') : t('taskDetail.markAsDone'));
  };

  const handleSetPriority = async (priority: Priority) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    onUpdate({ ...task, priority });
    toast.success(t('toasts.saved'));
  };

  const handleDuplicate = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    onDuplicate(task);
    onClose();
    toast.success(t('toasts.taskDuplicated'));
  };

  const handlePin = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    toast.success(t('notes.pinned'));
  };

  const handleDelete = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    onDelete(task.id);
    onClose();
    toast.success(t('toasts.taskDeleted'));
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskText.trim()) return;
    
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    
    const newSubtask: TodoItem = {
      id: Date.now().toString(),
      text: newSubtaskText.trim(),
      completed: false,
    };

    onUpdate({
      ...task,
      subtasks: [...(task.subtasks || []), newSubtask]
    });

    setNewSubtaskText('');
    // Keep input open for next subtask
  };

  const handleAddSubtaskFromSheet = async (subtask: Omit<TodoItem, 'id' | 'completed'>) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    
    const newSubtask: TodoItem = {
      id: Date.now().toString(),
      completed: false,
      ...subtask,
    };

    onUpdate({
      ...task,
      subtasks: [...(task.subtasks || []), newSubtask]
    });
    
    setIsSubtaskInputSheetOpen(false);
    toast.success(t('taskDetail.subtaskAdded'));
  };

  const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtask();
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    const updatedSubtasks = (task.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    onUpdate({ ...task, subtasks: updatedSubtasks });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    onUpdate({
      ...task,
      subtasks: (task.subtasks || []).filter(st => st.id !== subtaskId)
    });
  };

  const handleOpenSubtaskDetail = (subtask: TodoItem) => {
    setSelectedSubtask(subtask);
    setShowSubtaskDetailSheet(true);
  };

  const handleUpdateSubtask = (parentId: string, subtaskId: string, updates: Partial<TodoItem>) => {
    const updatedSubtasks = (task.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, ...updates } : st
    );
    onUpdate({ ...task, subtasks: updatedSubtasks });
  };

  const handleDeleteSubtaskFromSheet = (parentId: string, subtaskId: string) => {
    onUpdate({
      ...task,
      subtasks: (task.subtasks || []).filter(st => st.id !== subtaskId)
    });
  };

  const handleConvertSubtaskToTask = (parentId: string, subtask: TodoItem) => {
    // Remove from subtasks
    onUpdate({
      ...task,
      subtasks: (task.subtasks || []).filter(st => st.id !== subtask.id)
    });
    // Create as main task (handled by parent component via onDuplicate with modifications)
    const newTask: TodoItem = {
      ...subtask,
      id: Date.now().toString(),
      folderId: task.folderId,
    };
    onDuplicate(newTask);
  };

  const handleSubtaskDragEnd = async (result: DropResult) => {
    if (!result.destination || !task.subtasks) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    
    const reordered = Array.from(task.subtasks);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, removed);
    
    onUpdate({ ...task, subtasks: reordered });
  };

  const handleDateTimeSave = async (data: {
    selectedDate?: Date;
    selectedTime?: { hour: number; minute: number; period: 'AM' | 'PM' };
    reminder?: string;
    repeatSettings?: RepeatSettings;
  }) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    
    let reminderTime: Date | undefined;
    
    if (data.selectedDate && data.selectedTime) {
      reminderTime = new Date(data.selectedDate);
      let hours = data.selectedTime.hour;
      if (data.selectedTime.period === 'PM' && hours !== 12) hours += 12;
      if (data.selectedTime.period === 'AM' && hours === 12) hours = 0;
      reminderTime.setHours(hours, data.selectedTime.minute, 0, 0);
    }

    const updatedTask: TodoItem = {
      ...task,
      dueDate: data.selectedDate,
      reminderTime,
      repeatType: data.repeatSettings?.frequency as any || 'none',
    };

    onUpdate(updatedTask);
    
    // Store reminder offset and repeat settings for notification scheduling
    setReminderOffset(data.reminder || '');
    setRepeatSettings(data.repeatSettings);

    // Schedule notification
    try {
      const notificationIds = await notificationManager.scheduleTaskReminder(
        updatedTask,
        data.reminder,
        data.repeatSettings
      );
      
      if (notificationIds.length > 0) {
        onUpdate({ ...updatedTask, notificationIds });
        toast.success('Date, time, and reminder saved!');
      } else if (data.selectedDate) {
        toast.success('Date saved!');
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
      toast.success('Date saved (notification scheduling not available)');
    }

    setShowDateTimePage(false);
  };

  const handleConvertToNote = () => {
    onConvertToNote(task);
    onClose();
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    
    const newTag: ColoredTag = {
      name: newTagName.trim(),
      color: newTagColor
    };

    onUpdate({
      ...task,
      coloredTags: [...(task.coloredTags || []), newTag]
    });

    // Save to suggestions in IndexedDB
    getSetting<ColoredTag[]>('coloredTagSuggestions', []).then(savedTags => {
      const exists = savedTags.some((t: ColoredTag) => t.name === newTag.name);
      if (!exists) {
        setSetting('coloredTagSuggestions', [newTag, ...savedTags].slice(0, 20));
      }
    });

    setNewTagName('');
    setShowTagInput(false);
    toast.success(t('toasts.tagAdded'));
  };

  const handleRemoveTag = (tagName: string) => {
    onUpdate({
      ...task,
      coloredTags: (task.coloredTags || []).filter(t => t.name !== tagName)
    });
  };

  const handleVoicePlay = async () => {
    if (!task.voiceRecording) return;

    if (playingVoiceId === task.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingVoiceId(null);
      setVoiceProgress(0);
      setVoiceCurrentTime(0);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Resolve media ref if needed
    const audioUrl = await resolveTaskMediaUrl(task.voiceRecording.audioUrl);
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.playbackRate = voicePlaybackSpeed;
    audioRef.current = audio;
    
    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setVoiceProgress((audio.currentTime / audio.duration) * 100);
        setVoiceCurrentTime(audio.currentTime);
      }
    };
    
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
    };
    
    audio.onended = () => {
      setPlayingVoiceId(null);
      setVoiceProgress(0);
      setVoiceCurrentTime(0);
      audioRef.current = null;
    };
    audio.play();
    setPlayingVoiceId(task.id);
  };

  const cycleVoicePlaybackSpeed = () => {
    const currentIndex = VOICE_PLAYBACK_SPEEDS.indexOf(voicePlaybackSpeed);
    const nextIndex = (currentIndex + 1) % VOICE_PLAYBACK_SPEEDS.length;
    const newSpeed = VOICE_PLAYBACK_SPEEDS[nextIndex];
    setVoicePlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleVoiceSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !task?.voiceRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = audioRef.current.duration || audioDuration || task.voiceRecording.duration;
    if (duration && !isNaN(duration)) {
      audioRef.current.currentTime = percentage * duration;
      setVoiceProgress(percentage * 100);
      setVoiceCurrentTime(percentage * duration);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-orange-500';
      case 'low': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className={cn(
      "fixed inset-0 bg-background z-50 flex flex-col transition-transform duration-300",
      isOpen ? "translate-x-0" : "translate-x-full"
    )}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        {/* Left: Folders Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <FolderIcon className="h-4 w-4" />
              <span>{currentFolder?.name || t('smartLists.allTasks')}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 bg-popover border shadow-lg z-[60]">
            <DropdownMenuItem 
              onClick={() => onMoveToFolder(task.id, null)}
              className={cn("cursor-pointer", !task.folderId && "bg-accent")}
            >
              <FolderIcon className="h-4 w-4 mr-2" />
              {t('taskDetail.allTasksNoFolder')}
              {!task.folderId && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {folders.map((folder) => (
              <DropdownMenuItem 
                key={folder.id}
                onClick={() => onMoveToFolder(task.id, folder.id)}
                className={cn("cursor-pointer", task.folderId === folder.id && "bg-accent")}
              >
                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: folder.color }} />
                {folder.name}
                {task.folderId === folder.id && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Right: Options Menu */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-lg z-[60]">
              <DropdownMenuItem onClick={handleMarkAsDone} className="cursor-pointer">
                <Check className="h-4 w-4 mr-2" />
                {task.completed ? t('taskDetail.markAsIncomplete') : t('taskDetail.markAsDone')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSetPriority('high')} className="cursor-pointer">
                <Flag className="h-4 w-4 mr-2 text-red-500" />{t('taskDetail.highPriority')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetPriority('medium')} className="cursor-pointer">
                <Flag className="h-4 w-4 mr-2 text-orange-500" />{t('taskDetail.mediumPriority')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetPriority('low')} className="cursor-pointer">
                <Flag className="h-4 w-4 mr-2 text-green-500" />{t('taskDetail.lowPriority')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetPriority('none')} className="cursor-pointer">
                <Flag className="h-4 w-4 mr-2 text-muted-foreground" />{t('taskDetail.noPriority')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDuplicate} className="cursor-pointer">
                <Copy className="h-4 w-4 mr-2" />{t('taskDetail.duplicateTask')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePin} className="cursor-pointer">
                <Pin className="h-4 w-4 mr-2" />{t('taskDetail.pinTask')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />{t('taskDetail.deleteTask')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Task Title */}
        <div className="space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder={t('taskDetail.taskTitle')}
            className={cn(
              "text-xl font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0",
              task.completed && "line-through opacity-60"
            )}
          />
          <div className="flex items-center gap-3 flex-wrap">
            {task.priority && task.priority !== 'none' && (
              <div className="flex items-center gap-1.5">
                <Flag className={cn("h-4 w-4", getPriorityColor(task.priority))} />
                <span className={cn("text-sm capitalize", getPriorityColor(task.priority))}>
                  {t(`tasks.priority.${task.priority}`)}
                </span>
              </div>
            )}
            {/* Task Status Badge */}
            <TaskStatusBadge status={task.status} size="md" />
          </div>
        </div>

        {/* Task Status Selection */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Circle className="h-4 w-4" />
            {t('taskDetail.taskStatus')}
          </div>
          <Select 
            value={task.status || 'not_started'} 
            onValueChange={(value) => {
              onUpdate({ ...task, status: value as TaskStatus });
              toast.success(t('toasts.saved'));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status">
                <div className="flex items-center gap-2">
                  <TaskStatusBadge status={task.status || 'not_started'} showLabel={true} />
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <TaskStatusBadge status={option.value} showLabel={true} />
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice Recording Display */}
        {task.voiceRecording && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <button
              onClick={handleVoicePlay}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"
            >
              {playingVoiceId === task.id ? (
                <Pause className="h-5 w-5 text-primary-foreground" />
              ) : (
                <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
              )}
            </button>
            <div className="flex-1 flex flex-col gap-1">
              {/* Waveform progress bar */}
              {resolvedAudioUrl ? (
                <WaveformProgressBar
                  audioUrl={resolvedAudioUrl}
                  progress={voiceProgress}
                  duration={audioDuration || task.voiceRecording.duration}
                  isPlaying={playingVoiceId === task.id}
                  onSeek={(percent) => {
                    if (audioRef.current) {
                      const duration = audioRef.current.duration || audioDuration || task.voiceRecording!.duration;
                      if (duration && !isNaN(duration)) {
                        audioRef.current.currentTime = (percent / 100) * duration;
                        setVoiceProgress(percent);
                        setVoiceCurrentTime((percent / 100) * duration);
                      }
                    }
                  }}
                  height={20}
                />
              ) : (
                <div 
                  className="relative h-2 bg-primary/20 rounded-full overflow-hidden cursor-pointer"
                  onClick={handleVoiceSeek}
                >
                  <div 
                    className="absolute h-full bg-primary rounded-full transition-all duration-100"
                    style={{ width: `${voiceProgress}%` }}
                  />
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-primary font-medium">
                  {playingVoiceId === task.id ? formatDuration(Math.round(voiceCurrentTime)) : '0:00'}
                </span>
                <span className="text-primary/70">
                  {formatDuration(audioDuration || task.voiceRecording.duration)}
                </span>
              </div>
            </div>
            <button
              onClick={cycleVoicePlaybackSpeed}
              className="px-2 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 transition-colors min-w-[40px]"
            >
              {voicePlaybackSpeed}x
            </button>
          </div>
        )}

        {/* Image Display */}
        {task.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-border">
            <ResolvedTaskImage srcRef={task.imageUrl} alt="Task attachment" className="w-full max-h-48 object-cover" />
          </div>
        )}

        {/* Location Map Display */}
        {task.location && (
          <LocationMapPreview 
            location={task.location} 
            showFullMap={true}
            onClose={() => onUpdate({ ...task, location: undefined })}
          />
        )}

        {/* Subtasks - Bullet Point Structure */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="text-lg">•</span>
              {t('taskDetail.subtasks')}
            </div>
            <button
              onClick={() => setIsSubtaskInputSheetOpen(true)}
              className="flex items-center gap-1 text-primary text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              {t('taskDetail.addSubtask')}
            </button>
          </div>

          {task.subtasks && task.subtasks.length > 0 && (
            <DragDropContext onDragEnd={handleSubtaskDragEnd}>
              <Droppable droppableId="subtasks-list">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {task.subtasks.map((subtask, index) => (
                      <Draggable key={subtask.id} draggableId={subtask.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "flex items-start gap-2 py-3 px-3 bg-card rounded-lg border border-border group cursor-pointer hover:bg-muted/50 transition-colors",
                              snapshot.isDragging && "shadow-lg ring-2 ring-primary/20"
                            )}
                            onClick={() => handleOpenSubtaskDetail(subtask)}
                          >
                            <div
                              {...provided.dragHandleProps}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-grab active:cursor-grabbing touch-none mt-1"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                            {/* Bullet Point Style */}
                            <span className="text-muted-foreground mt-0.5 text-lg leading-none">•</span>
                            <Checkbox
                              checked={subtask.completed}
                              onCheckedChange={() => handleToggleSubtask(subtask.id)}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "h-5 w-5 transition-all flex-shrink-0 mt-0.5",
                                subtask.completed 
                                  ? "rounded-sm bg-muted-foreground/30 border-0" 
                                  : cn("rounded-full border-2", 
                                      subtask.priority === 'high' ? 'border-red-500' :
                                      subtask.priority === 'medium' ? 'border-orange-500' :
                                      subtask.priority === 'low' ? 'border-green-500' :
                                      'border-muted-foreground/40'
                                    )
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-medium",
                                subtask.completed && "line-through text-muted-foreground"
                              )}>
                                {subtask.text}
                              </p>
                              {/* Subtask metadata */}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {subtask.status && subtask.status !== 'not_started' && (
                                  <TaskStatusBadge status={subtask.status} size="sm" />
                                )}
                                {subtask.dueDate && (
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(subtask.dueDate), 'MMM d')}
                                  </span>
                                )}
                                {subtask.coloredTags && subtask.coloredTags.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    {subtask.coloredTags.slice(0, 2).map((tag) => (
                                      <span 
                                        key={tag.name}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full"
                                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                      >
                                        <Tag className="h-2.5 w-2.5" />
                                        {tag.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Nested subtasks count */}
                                {subtask.subtasks && subtask.subtasks.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded-full">
                                    {t('taskDetail.nested', { completed: subtask.subtasks.filter(st => st.completed).length, total: subtask.subtasks.length })}
                                  </span>
                                )}
                              </div>
                            </div>
                            {subtask.imageUrl && (
                              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                                <ResolvedTaskImage srcRef={subtask.imageUrl} alt="Subtask" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSubtask(subtask.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity p-1"
                            >
                              <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    <p className="text-xs text-muted-foreground px-3 py-1">
                      {t('taskDetail.subtasksCompleted', { completed: task.subtasks.filter(st => st.completed).length, total: task.subtasks.length })}
                    </p>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        {/* Time Tracking */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            {t('taskDetail.timeTracking')}
          </div>
          <TaskTimeTracker
            timeTracking={task.timeTracking}
            onUpdate={(tracking) => onUpdate({ ...task, timeTracking: tracking })}
          />
        </div>

        {/* Dependencies */}
        <div className="space-y-2">
          <button
            onClick={() => setShowDependencySheet(true)}
            className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
          >
            <Link className="h-5 w-5 text-purple-500" />
            <span className="flex-1 text-left">{t('taskDetail.dependencies')}</span>
            <span className="text-sm text-muted-foreground">
              {t('taskDetail.linked', { count: task.dependsOn?.length || 0 })}
            </span>
          </button>
          {task.dependsOn && task.dependsOn.length > 0 && (
            <div className="pl-10 space-y-1">
              {(() => {
                const { canComplete, blockedBy } = canCompleteTask(task, allTasks);
                const completedDeps = allTasks.filter(t => task.dependsOn?.includes(t.id) && t.completed);
                return (
                  <>
                    {blockedBy.length > 0 && (
                      <p className="text-xs text-amber-500">
                        ⚠️ {t('taskDetail.blockedBy', { count: blockedBy.length, tasks: blockedBy.map(t => t.text).slice(0, 2).join(', ') + (blockedBy.length > 2 ? '...' : '') })}
                      </p>
                    )}
                    {completedDeps.length > 0 && (
                      <p className="text-xs text-green-500">
                        ✓ {t('taskDetail.dependencyCompleted', { count: completedDeps.length })}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Action Items */}
        <div className="space-y-1 border-t border-border pt-4">
          {/* Date - Opens TaskDateTimePage */}
          <button 
            onClick={() => setShowDateTimePage(true)}
            className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
          >
            <CalendarIcon className="h-5 w-5 text-cyan-500" />
            <span className="flex-1 text-left">{t('taskDetail.dateTimeReminder')}</span>
            <span className="text-sm text-muted-foreground">
              {task.dueDate 
                ? `${format(new Date(task.dueDate), 'MMM d')}${task.reminderTime ? ` • ${format(new Date(task.reminderTime), 'h:mm a')}` : ''}`
                : t('taskDetail.notSet')}
            </span>
          </button>

          {/* Convert to Notes */}
          <button 
            onClick={handleConvertToNote}
            className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
          >
            <FileText className="h-5 w-5 text-blue-500" />
            <span className="flex-1 text-left">{t('taskDetail.convertToNotes')}</span>
          </button>


          {/* Tag */}
          <div className="space-y-2">
            <Popover open={showTagInput} onOpenChange={setShowTagInput}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors">
                  <Tag className="h-5 w-5 text-yellow-500" />
                  <span className="flex-1 text-left">{t('taskDetail.tag')}</span>
                  <span className="text-sm text-muted-foreground">
                    {t('taskDetail.tagsCount', { count: task.coloredTags?.length || 0 })}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 z-[60]" align="start">
                <div className="space-y-3">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder={t('taskDetail.tagName')}
                    className="h-9"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={cn(
                          "w-6 h-6 rounded-full transition-transform",
                          newTagColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Button onClick={handleAddTag} size="sm" className="w-full">
                    {t('taskDetail.addTag')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Display existing tags */}
            {task.coloredTags && task.coloredTags.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-10">
                {task.coloredTags.map((tag) => (
                  <span
                    key={tag.name}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full"
                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                  >
                    {tag.name}
                    <button onClick={() => handleRemoveTag(tag.name)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description Section */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              {t('taskDetail.description')}
            </div>
            <textarea
              value={task.description || ''}
              onChange={(e) => onUpdate({ ...task, description: e.target.value })}
              placeholder={t('taskDetail.descriptionPlaceholder')}
              className="w-full min-h-[120px] p-3 rounded-xl bg-muted/30 border border-border/50 resize-none text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Task Timestamps Section */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <Clock className="h-4 w-4" />
              {t('taskDetail.taskHistory')}
            </div>
            <div className="space-y-2 text-sm">
              {task.createdAt && (
                <div className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg">
                  <span className="text-muted-foreground">{t('taskDetail.created')}</span>
                  <span className="font-medium">{format(new Date(task.createdAt), 'MMM d, yyyy • h:mm a')}</span>
                </div>
              )}
              {task.modifiedAt && (
                <div className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg">
                  <span className="text-muted-foreground">{t('taskDetail.lastModified')}</span>
                  <span className="font-medium">{format(new Date(task.modifiedAt), 'MMM d, yyyy • h:mm a')}</span>
                </div>
              )}
              {task.completed && task.completedAt && (
                <div className="flex items-center justify-between py-2 px-3 bg-green-500/10 rounded-lg">
                  <span className="text-green-600 dark:text-green-400">{t('taskDetail.completed')}</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{format(new Date(task.completedAt), 'MMM d, yyyy • h:mm a')}</span>
                </div>
              )}
              {!task.createdAt && !task.modifiedAt && !task.completedAt && (
                <div className="text-muted-foreground text-center py-2">{t('taskDetail.noTimestampData')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Safe area padding for bottom */}
      <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }} />

      {/* TaskDateTimePage */}
      <TaskDateTimePage
        isOpen={showDateTimePage}
        onClose={() => setShowDateTimePage(false)}
        onSave={handleDateTimeSave}
        initialDate={task.dueDate ? new Date(task.dueDate) : undefined}
        initialTime={task.reminderTime ? {
          hour: new Date(task.reminderTime).getHours() % 12 || 12,
          minute: new Date(task.reminderTime).getMinutes(),
          period: new Date(task.reminderTime).getHours() >= 12 ? 'PM' : 'AM'
        } : undefined}
        initialReminder={reminderOffset}
        initialRepeatSettings={repeatSettings}
      />

      {/* TaskDependencySheet */}
      <TaskDependencySheet
        isOpen={showDependencySheet}
        onClose={() => setShowDependencySheet(false)}
        task={task}
        allTasks={allTasks}
        onSave={(dependsOn) => onUpdate({ ...task, dependsOn })}
      />

      {/* Subtask Input Sheet - full featured like main task */}
      <TaskInputSheet
        isOpen={isSubtaskInputSheetOpen}
        onClose={() => setIsSubtaskInputSheetOpen(false)}
        onAddTask={handleAddSubtaskFromSheet}
        folders={folders}
        selectedFolderId={task.folderId}
        onCreateFolder={() => {}}
      />

      {/* Subtask Detail Sheet */}
      <SubtaskDetailSheet
        isOpen={showSubtaskDetailSheet}
        subtask={selectedSubtask}
        parentId={task.id}
        onClose={() => {
          setShowSubtaskDetailSheet(false);
          setSelectedSubtask(null);
        }}
        onUpdate={handleUpdateSubtask}
        onDelete={handleDeleteSubtaskFromSheet}
        onConvertToTask={handleConvertSubtaskToTask}
      />
    </div>
  );
};

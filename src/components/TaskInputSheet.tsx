import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem, Priority, RepeatType, Folder, ColoredTag, VoiceRecording, LocationReminder } from '@/types/note';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { notificationManager } from '@/utils/notifications';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { getSetting, setSetting } from '@/utils/settingsStorage';

// Ref for pending subtasks (sync access during task creation)
let pendingSubtasksRef: { current: TodoItem[] | undefined } = { current: undefined };

import {
  Calendar as CalendarIcon,
  Flag,
  FolderIcon,
  Image as ImageIcon,
  Send,
  X,
  Mic,
  Square,
  Play,
  Pause,
  Timer,
  CalendarCheck,
  Tag,
  CalendarClock,
  Settings2,
  ListTodo,
  FileText,
  MapPin,
  Sparkles,
  LayoutTemplate
} from 'lucide-react';
import { EditActionsSheet, ActionItem, defaultActions } from './EditActionsSheet';
import { WaveformVisualizer } from './WaveformVisualizer';
import { VoiceTrimmer } from './VoiceTrimmer';
import { WaveformProgressBar } from './WaveformProgressBar';
import { LocationSearchInput } from './LocationSearchInput';
import { TaskTemplateSheet, TaskTemplate } from './TaskTemplateSheet';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskDateTimePage, RepeatSettings } from './TaskDateTimePage';
import { parseNaturalLanguageTask, hasNaturalLanguagePatterns } from '@/utils/naturalLanguageParser';

interface TaskSection {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  order: number;
}

interface TaskInputSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: Omit<TodoItem, 'id' | 'completed'>) => void;
  folders: Folder[];
  selectedFolderId?: string | null;
  onCreateFolder: (name: string, color: string) => void;
  sections?: TaskSection[];
  selectedSectionId?: string | null;
  defaultDate?: Date; // New prop for calendar auto-assignment
}

export const TaskInputSheet = ({ isOpen, onClose, onAddTask, folders, selectedFolderId, onCreateFolder, sections = [], selectedSectionId, defaultDate }: TaskInputSheetProps) => {
  const { t } = useTranslation();
  
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const [taskText, setTaskText] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [reminderTime, setReminderTime] = useState<Date | undefined>();
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [folderId, setFolderId] = useState<string | undefined>();
  const [sectionId, setSectionId] = useState<string | undefined>();
  const [showDateTimePage, setShowDateTimePage] = useState(false);
  const [showDeadlinePage, setShowDeadlinePage] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showSectionPopover, setShowSectionPopover] = useState(false);
  const [repeatSettings, setRepeatSettings] = useState<RepeatSettings | undefined>();
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [coloredTags, setColoredTags] = useState<ColoredTag[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState('#14b8a6');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [editingTag, setEditingTag] = useState<ColoredTag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [deadlineReminderTime, setDeadlineReminderTime] = useState<Date | undefined>();
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationReminder, setLocationReminder] = useState<LocationReminder | undefined>();
  const [showDescriptionInput, setShowDescriptionInput] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [showEditActions, setShowEditActions] = useState(false);
  const [showTemplateSheet, setShowTemplateSheet] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>(defaultActions);
  const [savedTags, setSavedTags] = useState<ColoredTag[]>([]);
  
  // Load saved actions and tags from IndexedDB
  useEffect(() => {
    const loadSavedData = async () => {
      const { getSetting } = await import('@/utils/settingsStorage');
      const savedActions = await getSetting<ActionItem[] | null>('taskInputActions', null);
      if (savedActions) setActionItems(savedActions);
      const savedTagsData = await getSetting<ColoredTag[] | null>('savedColoredTags', null);
      if (savedTagsData) setSavedTags(savedTagsData);
    };
    loadSavedData();
  }, []);
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimeRef = useRef(0); // Track actual duration
  const [voiceRecording, setVoiceRecording] = useState<VoiceRecording | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [audioData, setAudioData] = useState<Float32Array | null>(null);
  const animationFrameRef = useRef<number>();
  
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const folderColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Natural language parsing - real-time preview
  const parsedTask = useMemo(() => {
    if (!taskText.trim()) return null;
    return parseNaturalLanguageTask(taskText);
  }, [taskText]);

  const hasNLPPatterns = useMemo(() => {
    return hasNaturalLanguagePatterns(taskText);
  }, [taskText]);

  const handleSaveActions = async (actions: ActionItem[]) => {
    setActionItems(actions);
    await setSetting('taskInputActions', actions);
    toast.success(t('toasts.actionsUpdated'));
  };

  const isActionEnabled = (id: string) => actionItems.find(a => a.id === id)?.enabled ?? true;
  const getActionOrder = () => actionItems.filter(a => a.enabled).map(a => a.id);

  useEffect(() => {
    if (!isOpen) {
      setTaskText('');
      setPriority('none');
      setDueDate(undefined);
      setReminderTime(undefined);
      setRepeatType('none');
      setRepeatDays([]);
      setFolderId(undefined);
      setSectionId(undefined);
      setImageUrl(undefined);
      setColoredTags([]);
      setTagInput('');
      setSelectedTagColor('#14b8a6');
      setShowTagInput(false);
      setDeadline(undefined);
      setDeadlineReminderTime(undefined);
      setDescription('');
      setLocation('');
      setLocationReminder(undefined);
      setShowDescriptionInput(false);
      setShowLocationInput(false);
      setVoiceRecording(undefined);
      setIsRecording(false);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      setIsPlaying(false);
      setPlaybackProgress(0);
      setPlaybackCurrentTime(0);
      setShowTrimmer(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    } else {
      // Set default date when sheet opens (for calendar auto-assignment)
      if (defaultDate) {
        setDueDate(defaultDate);
      }
    }
  }, [isOpen, defaultDate]);

  useEffect(() => {
    if (selectedSectionId) {
      setSectionId(selectedSectionId);
    }
  }, [selectedSectionId]);

  useEffect(() => {
    if (selectedFolderId) {
      setFolderId(selectedFolderId);
    }
  }, [selectedFolderId]);

  const handleSend = async () => {
    if (!taskText.trim() && !voiceRecording) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}

    // Use natural language parsing to extract date/time/priority/repeat/location/tags/folder from text
    const parsed = taskText.trim() ? parseNaturalLanguageTask(taskText) : null;
    
    // Use parsed values if available, otherwise use manually set values
    const finalText = parsed?.text || taskText || (voiceRecording ? 'Voice Task' : '');
    const finalDueDate = dueDate || parsed?.dueDate;
    const finalPriority = priority !== 'none' ? priority : parsed?.priority;
    const finalRepeatType = repeatType !== 'none' ? repeatType : parsed?.repeatType;
    const finalRepeatDays = repeatType === 'custom' && repeatDays.length > 0 ? repeatDays : parsed?.repeatDays;
    const finalLocation = location.trim() || parsed?.location;
    const finalReminderTime = reminderTime || deadlineReminderTime || parsed?.reminderTime;
    
    // Merge parsed tags with manually added tags
    let finalTags = [...coloredTags];
    if (parsed?.tags && parsed.tags.length > 0) {
      const defaultTagColor = '#14b8a6';
      parsed.tags.forEach(tagName => {
        if (!finalTags.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
          // Check if tag exists in saved tags to use its color
          const savedTag = savedTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          finalTags.push({ name: tagName, color: savedTag?.color || defaultTagColor });
        }
      });
    }
    
    // Resolve folder name to folder ID
    let finalFolderId = folderId;
    if (parsed?.folderName && !folderId) {
      const matchedFolder = folders.find(f => 
        f.name.toLowerCase().includes(parsed.folderName!.toLowerCase())
      );
      if (matchedFolder) {
        finalFolderId = matchedFolder.id;
      }
    }

    // Check for pending subtasks from template (use ref to avoid async issues)
    const subtasks = pendingSubtasksRef.current;
    pendingSubtasksRef.current = undefined;

    const mainTask: Omit<TodoItem, 'id' | 'completed'> = {
      text: finalText,
      priority: finalPriority,
      dueDate: finalDueDate,
      reminderTime: finalReminderTime,
      repeatType: finalRepeatType,
      repeatDays: finalRepeatDays,
      advancedRepeat: parsed?.advancedRepeat,
      folderId: finalFolderId,
      sectionId,
      imageUrl,
      coloredTags: finalTags.length > 0 ? finalTags : undefined,
      voiceRecording,
      description: description.trim() || undefined,
      location: finalLocation,
      locationReminder: locationReminder,
      subtasks: subtasks,
    };

    // If deadline is set, store it in dueDate
    if (deadline) {
      mainTask.dueDate = deadline;
    }

    onAddTask(mainTask);
    setTaskText('');
    setVoiceRecording(undefined);
    inputRef.current?.focus();
  };

  // Handle template selection
  const handleSelectTemplate = (template: TaskTemplate) => {
    setTaskText(template.taskText);
    setPriority(template.priority);
    setRepeatType(template.repeatType);
    if (template.repeatDays) {
      setRepeatDays(template.repeatDays);
    }
    if (template.tags) {
      setColoredTags(template.tags);
    }
    
    // Create subtasks from template
    if (template.subtasks && template.subtasks.length > 0) {
      const subtasksList = template.subtasks.map((text, idx) => ({
        id: `subtask-${Date.now()}-${idx}`,
        text,
        completed: false
      }));
      // Store subtasks to be added when task is created (use ref for sync access)
      pendingSubtasksRef.current = subtasksList as TodoItem[];
    }
    
    toast.success(t('toasts.templateApplied', { name: template.name }));
  };

  // Voice recording functions
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Set up audio analysis for waveform
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start analyzing audio
      const analyzeAudio = () => {
        if (!analyserRef.current) return;
        const dataArray = new Float32Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getFloatTimeDomainData(dataArray);
        setAudioData(new Float32Array(dataArray));
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };
      analyzeAudio();

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop audio analysis
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        setAudioData(null);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const audioBase64 = reader.result as string;
          // Use ref value for accurate duration (state may be stale in callback)
          const recording: VoiceRecording = {
            id: Date.now().toString(),
            audioUrl: audioBase64,
            duration: recordingTimeRef.current,
            timestamp: new Date(),
          };
          setVoiceRecording(recording);
          stream.getTracks().forEach(track => track.stop());
          setRecordingTime(0);
          recordingTimeRef.current = 0;
          toast.success(t('toasts.voiceRecordingSaved'));
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
      }, 1000);

      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {}
    } catch (error) {
      toast.error(t('errors.microphoneFailed'));
      console.error(error);
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {}
    }
  };

  const playVoiceRecording = () => {
    if (!voiceRecording) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setPlaybackProgress(0);
      setPlaybackCurrentTime(0);
      return;
    }

    const audio = new Audio(voiceRecording.audioUrl);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;
    
    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
        setPlaybackCurrentTime(audio.currentTime);
      }
    };
    
    audio.onloadedmetadata = () => {
      // Update duration from actual audio metadata if available
      if (audio.duration && !isNaN(audio.duration) && voiceRecording.duration === 0) {
        setVoiceRecording(prev => prev ? { ...prev, duration: Math.round(audio.duration) } : prev);
      }
    };
    
    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
      setPlaybackCurrentTime(0);
      audioRef.current = null;
    };
    
    audio.play();
    setIsPlaying(true);
  };

  const cyclePlaybackSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !voiceRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = audioRef.current.duration || voiceRecording.duration;
    if (duration && !isNaN(duration)) {
      audioRef.current.currentTime = percentage * duration;
      setPlaybackProgress(percentage * 100);
      setPlaybackCurrentTime(percentage * duration);
    }
  };

  const removeVoiceRecording = () => {
    setVoiceRecording(undefined);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleDateTimeSave = (data: {
    selectedDate?: Date;
    selectedTime?: { hour: number; minute: number; period: 'AM' | 'PM' };
    reminder?: string;
    repeatSettings?: RepeatSettings;
  }) => {
    // Combine date with time
    let finalDate: Date | undefined;
    if (data.selectedDate) {
      finalDate = new Date(data.selectedDate);
      if (data.selectedTime) {
        let hour = data.selectedTime.hour;
        // Convert 12-hour to 24-hour format
        if (data.selectedTime.period === 'PM' && hour !== 12) {
          hour += 12;
        } else if (data.selectedTime.period === 'AM' && hour === 12) {
          hour = 0;
        }
        finalDate.setHours(hour, data.selectedTime.minute, 0, 0);
      }
    }
    
    setDueDate(finalDate);
    
    // Set reminder time based on reminder option
    if (data.reminder && data.reminder !== 'none' && finalDate) {
      const reminderDate = new Date(finalDate);
      switch (data.reminder) {
        case 'instant':
          // Reminder at the exact task time
          break;
        case '5min':
          reminderDate.setMinutes(reminderDate.getMinutes() - 5);
          break;
        case '10min':
          reminderDate.setMinutes(reminderDate.getMinutes() - 10);
          break;
        case '15min':
          reminderDate.setMinutes(reminderDate.getMinutes() - 15);
          break;
        case '30min':
          reminderDate.setMinutes(reminderDate.getMinutes() - 30);
          break;
        case '1hour':
          reminderDate.setHours(reminderDate.getHours() - 1);
          break;
        case '2hours':
          reminderDate.setHours(reminderDate.getHours() - 2);
          break;
        case '1day':
          reminderDate.setDate(reminderDate.getDate() - 1);
          break;
      }
      setReminderTime(reminderDate);
    } else {
      setReminderTime(undefined);
    }
    
    // Set repeat settings
    if (data.repeatSettings) {
      setRepeatSettings(data.repeatSettings);
      // Map to legacy repeatType for compatibility
      switch (data.repeatSettings.frequency) {
        case 'daily':
          setRepeatType('daily');
          break;
        case 'weekly':
          setRepeatType('weekly');
          setRepeatDays(data.repeatSettings.weeklyDays || []);
          break;
        case 'monthly':
          setRepeatType('monthly');
          break;
        default:
          setRepeatType('none');
      }
    } else {
      setRepeatSettings(undefined);
      setRepeatType('none');
      setRepeatDays([]);
    }
    
    setShowDateTimePage(false);
    toast.success(t('toasts.dateTimeSaved'));
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    onCreateFolder(newFolderName.trim(), selectedColor);
    setNewFolderName('');
    setSelectedColor('#3b82f6');
    setShowFolderDialog(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const tagColors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#10b981', '#6366f1'];

  const handleAddTag = () => {
    if (tagInput.trim() && !coloredTags.some(t => t.name === tagInput.trim())) {
      const newTag = { name: tagInput.trim(), color: selectedTagColor };
      setColoredTags([...coloredTags, newTag]);
      
      // Save to IndexedDB for suggestions
      const existingSaved = savedTags.filter(t => t.name !== newTag.name);
      const updatedSaved = [newTag, ...existingSaved].slice(0, 20); // Keep last 20 tags
      setSavedTags(updatedSaved);
      setSetting('savedColoredTags', updatedSaved);
      
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleAddSavedTag = (tag: ColoredTag) => {
    if (!coloredTags.some(t => t.name === tag.name)) {
      setColoredTags([...coloredTags, tag]);
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setColoredTags(coloredTags.filter(t => t.name !== tagName));
  };

  const handleDeleteSavedTag = (tagName: string) => {
    const updatedSaved = savedTags.filter(t => t.name !== tagName);
    setSavedTags(updatedSaved);
    setSetting('savedColoredTags', updatedSaved);
  };

  const handleStartEditTag = (tag: ColoredTag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const handleSaveEditTag = () => {
    if (!editingTag || !editTagName.trim()) return;
    
    const updatedSaved = savedTags.map(t => 
      t.name === editingTag.name ? { name: editTagName.trim(), color: editTagColor } : t
    );
    setSavedTags(updatedSaved);
    setSetting('savedColoredTags', updatedSaved);
    
    // Also update any currently selected tags
    setColoredTags(coloredTags.map(t => 
      t.name === editingTag.name ? { name: editTagName.trim(), color: editTagColor } : t
    ));
    
    setEditingTag(null);
    setEditTagName('');
    setEditTagColor('');
  };

  const handleCancelEditTag = () => {
    setEditingTag(null);
    setEditTagName('');
    setEditTagColor('');
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      <div
        className="fixed bottom-0 left-0 right-0 bg-card z-50 rounded-t-[28px] shadow-2xl pointer-events-auto"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-5">
            <Input
              ref={inputRef}
              placeholder={t('tasks.naturalLanguagePlaceholder')}
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="text-[17px] border-0 px-0 py-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none bg-transparent placeholder:text-muted-foreground/40"
              autoFocus
            />

            {taskText.trim() || voiceRecording ? (
              <button
                onClick={handleSend}
                className="w-10 h-10 rounded-lg bg-primary hover:opacity-90 flex items-center justify-center transition-all flex-shrink-0"
              >
                <Send className="h-5 w-5 text-primary-foreground rotate-45" />
              </button>
            ) : isRecording ? (
              <div className="flex items-center gap-2">
                <WaveformVisualizer 
                  audioData={audioData} 
                  isActive={isRecording} 
                  barCount={12}
                  color="hsl(var(--destructive))"
                  className="h-8"
                />
                <span className="text-sm font-mono text-destructive animate-pulse">
                  {formatRecordingTime(recordingTime)}
                </span>
                <button 
                  onClick={stopRecording}
                  className="w-10 h-10 rounded-lg bg-destructive hover:opacity-90 flex items-center justify-center transition-all flex-shrink-0"
                >
                  <Square className="h-5 w-5 text-destructive-foreground" />
                </button>
              </div>
            ) : (
              <button 
                onClick={startRecording}
                className="w-10 h-10 rounded-lg bg-muted/30 hover:bg-muted flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <Mic className="h-5 w-5 text-muted-foreground/60" />
              </button>
            )}
          </div>

          {/* Natural Language Parsing Preview */}
          {hasNLPPatterns && parsedTask && (parsedTask.dueDate || parsedTask.priority || parsedTask.repeatType || parsedTask.location) && (
            <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
              <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-xs text-muted-foreground">{t('tasks.detected')}:</span>
              {parsedTask.dueDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                  <CalendarIcon className="h-3 w-3" />
                  {format(parsedTask.dueDate, 'MMM d, h:mm a')}
                </span>
              )}
              {parsedTask.repeatType && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-500">
                  <Timer className="h-3 w-3" />
                  {parsedTask.repeatType === 'custom' && parsedTask.repeatDays 
                    ? `Every ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].filter((_, i) => parsedTask.repeatDays?.includes(i)).join(', ')}`
                    : parsedTask.repeatType}
                </span>
              )}
              {parsedTask.location && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500">
                  <MapPin className="h-3 w-3" />
                  {parsedTask.location}
                </span>
              )}
              {parsedTask.priority && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full",
                  parsedTask.priority === 'high' && "bg-red-500/10 text-red-500",
                  parsedTask.priority === 'medium' && "bg-yellow-500/10 text-yellow-500",
                  parsedTask.priority === 'low' && "bg-green-500/10 text-green-500",
                )}>
                  <Flag className="h-3 w-3" />
                  {parsedTask.priority}
                </span>
              )}
            </div>
          )}
          {voiceRecording && !showTrimmer && (
            <div className="px-4 py-3 bg-primary/10 rounded-lg flex items-center gap-3 mb-4 border border-primary/20">
              <button
                onClick={playVoiceRecording}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 text-primary-foreground" />
                ) : (
                  <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
                )}
              </button>
              <div className="flex-1 flex flex-col gap-1">
                {/* Waveform progress bar */}
                <WaveformProgressBar
                  audioUrl={voiceRecording.audioUrl}
                  progress={playbackProgress}
                  duration={voiceRecording.duration}
                  isPlaying={isPlaying}
                  onSeek={(percent) => {
                    if (audioRef.current && voiceRecording) {
                      const duration = audioRef.current.duration || voiceRecording.duration;
                      if (duration && !isNaN(duration)) {
                        audioRef.current.currentTime = (percent / 100) * duration;
                        setPlaybackProgress(percent);
                        setPlaybackCurrentTime((percent / 100) * duration);
                      }
                    }
                  }}
                  height={20}
                />
                {/* Time display */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-primary font-medium">
                    {isPlaying ? formatRecordingTime(Math.round(playbackCurrentTime)) : '0:00'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRecordingTime(voiceRecording.duration)}
                  </p>
                </div>
              </div>
              <button
                onClick={cyclePlaybackSpeed}
                className="px-2 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 transition-colors min-w-[40px]"
              >
                {playbackSpeed}x
              </button>
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                  }
                  setIsPlaying(false);
                  setShowTrimmer(true);
                }}
                className="p-2 hover:bg-muted rounded-full transition-colors"
                title="Trim recording"
              >
                <Settings2 className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={removeVoiceRecording}
                className="p-2 hover:bg-destructive/10 rounded-full transition-colors"
              >
                <X className="h-4 w-4 text-destructive" />
              </button>
            </div>
          )}
          
          {/* Voice Trimmer */}
          {voiceRecording && showTrimmer && (
            <div className="mb-4">
              <VoiceTrimmer
                audioUrl={voiceRecording.audioUrl}
                duration={voiceRecording.duration}
                onSave={(trimmedUrl, newDuration) => {
                  setVoiceRecording({
                    ...voiceRecording,
                    audioUrl: trimmedUrl,
                    duration: newDuration,
                  });
                  setShowTrimmer(false);
                  toast.success(t('toasts.recordingTrimmed'));
                }}
                onCancel={() => setShowTrimmer(false)}
              />
            </div>
          )}

          {/* Date/Time/Repeat indicator */}
          {(dueDate || repeatSettings) && (
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg flex items-center gap-2 mb-4">
              <CalendarCheck className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                {dueDate ? format(dueDate, 'MMM d') : ''}
                {dueDate && (dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0) ? ` • ${format(dueDate, 'h:mm a')}` : ''}
                {repeatSettings ? ` • Repeats ${repeatSettings.frequency}` : ''}
              </span>
              <button
                onClick={() => {
                  setDueDate(undefined);
                  setReminderTime(undefined);
                  setRepeatSettings(undefined);
                  setRepeatType('none');
                  setRepeatDays([]);
                }}
                className="ml-auto"
              >
                <X className="h-4 w-4 text-blue-500 hover:text-blue-700" />
              </button>
            </div>
          )}

          {/* Deadline indicator */}
          {deadline && (
            <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/20 rounded-lg flex items-center gap-2 mb-4">
              <CalendarClock className="h-4 w-4 text-rose-500" />
              <span className="text-sm text-rose-700 dark:text-rose-300 font-medium">
                Deadline: {format(deadline, 'MMM d')}
                {deadlineReminderTime ? ` • Reminder ${format(deadlineReminderTime, 'h:mm a')}` : ''}
              </span>
              <button
                onClick={() => {
                  setDeadline(undefined);
                  setDeadlineReminderTime(undefined);
                }}
                className="ml-auto"
              >
                <X className="h-4 w-4 text-rose-500 hover:text-rose-700" />
              </button>
            </div>
          )}

          {/* Tags display */}
          {coloredTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {coloredTags.map((tag) => (
                <span 
                  key={tag.name} 
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border"
                  style={{ 
                    backgroundColor: `${tag.color}15`, 
                    borderColor: `${tag.color}40`,
                    color: tag.color 
                  }}
                >
                  <Tag className="h-3 w-3" />
                  {tag.name}
                  <button onClick={() => handleRemoveTag(tag.name)}>
                    <X className="h-3 w-3 hover:opacity-70" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Description indicator */}
          {description && (
            <div className="px-4 py-2 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-cyan-500" />
              <span className="text-sm text-cyan-700 dark:text-cyan-300 font-medium truncate flex-1">
                {description.length > 50 ? description.substring(0, 50) + '...' : description}
              </span>
              <button
                onClick={() => {
                  setDescription('');
                }}
                className="ml-auto"
              >
                <X className="h-4 w-4 text-cyan-500 hover:text-cyan-700" />
              </button>
            </div>
          )}

          {/* Location indicator */}
          {location && (
            <div className="px-4 py-2 bg-pink-50 dark:bg-pink-950/20 rounded-lg flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-pink-500" />
              <span className="text-sm text-pink-700 dark:text-pink-300 font-medium truncate flex-1">
                {location}
              </span>
              <button
                onClick={() => {
                  setLocation('');
                }}
                className="ml-auto"
              >
                <X className="h-4 w-4 text-pink-500 hover:text-pink-700" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {/* Template button - always first */}
            <button
              onClick={() => setShowTemplateSheet(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all whitespace-nowrap"
            >
              <LayoutTemplate className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm text-primary font-medium">{t('taskInput.templates')}</span>
            </button>
            
            {/* Render action buttons in the order defined by actionItems */}
            {actionItems.filter(a => a.enabled).map((action) => {
              if (action.id === 'date') {
                return (
                  <button
                    key={action.id}
                    onClick={() => setShowDateTimePage(true)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all whitespace-nowrap",
                      dueDate ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-border bg-card hover:bg-muted"
                    )}
                  >
                    {dueDate && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
                    {dueDate ? (
                      <CalendarCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={cn("text-sm whitespace-nowrap", dueDate ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>
                      {dueDate ? format(dueDate, 'MMM d') : t('taskInput.date')}
                    </span>
                  </button>
                );
              }

              if (action.id === 'priority') {
                return (
                  <Popover key={action.id} open={showPriorityMenu} onOpenChange={setShowPriorityMenu}>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        "relative flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all whitespace-nowrap",
                        priority === 'high' ? "border-red-500 bg-red-50 dark:bg-red-950/30" :
                        priority === 'medium' ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" :
                        priority === 'low' ? "border-green-500 bg-green-50 dark:bg-green-950/30" :
                        "border-border bg-card hover:bg-muted"
                      )}>
                        {priority !== 'none' && (
                          <span className={cn(
                            "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                            priority === 'high' ? 'bg-red-500' :
                            priority === 'medium' ? 'bg-orange-500' :
                            'bg-green-500'
                          )} />
                        )}
                        <Flag className={cn("h-4 w-4 flex-shrink-0", 
                          priority === 'high' ? 'text-red-500 fill-red-500' : 
                          priority === 'medium' ? 'text-orange-500 fill-orange-500' : 
                          priority === 'low' ? 'text-green-500 fill-green-500' : 
                          'text-muted-foreground'
                        )} />
                        <span className={cn("text-sm whitespace-nowrap",
                          priority === 'high' ? 'text-red-600 dark:text-red-400' : 
                          priority === 'medium' ? 'text-orange-600 dark:text-orange-400' : 
                          priority === 'low' ? 'text-green-600 dark:text-green-400' : 
                          'text-muted-foreground'
                        )}>
                          {priority !== 'none' ? t(`tasks.priority.${priority}`) : t('taskInput.priority')}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2 bg-popover z-50" align="start">
                      <div className="space-y-1">
                        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setPriority('high'); setShowPriorityMenu(false); }}>
                          <Flag className="h-4 w-4 mr-2 text-red-500 fill-red-500" />{t('tasks.priority.high')}
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setPriority('medium'); setShowPriorityMenu(false); }}>
                          <Flag className="h-4 w-4 mr-2 text-orange-500 fill-orange-500" />{t('tasks.priority.medium')}
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setPriority('low'); setShowPriorityMenu(false); }}>
                          <Flag className="h-4 w-4 mr-2 text-green-500 fill-green-500" />{t('tasks.priority.low')}
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setPriority('none'); setShowPriorityMenu(false); }}>
                          <Flag className="h-4 w-4 mr-2 text-gray-400" />{t('tasks.priority.none')}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              // Reminder and Repeat are now handled in the Date/Time page
              if (action.id === 'reminder' || action.id === 'repeat') {
                return null;
              }

              if (action.id === 'tags') {
                return (
                  <Popover key={action.id} open={showTagInput} onOpenChange={setShowTagInput}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "relative flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all whitespace-nowrap",
                          coloredTags.length > 0 ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30" : "border-border bg-card hover:bg-muted"
                        )}
                      >
                        {coloredTags.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-teal-500 rounded-full" />}
                        <Tag className={cn("h-4 w-4 flex-shrink-0", coloredTags.length > 0 ? "text-teal-500" : "text-muted-foreground")} />
                        <span className={cn("text-sm whitespace-nowrap", coloredTags.length > 0 ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground")}>
                          {coloredTags.length > 0 ? `${coloredTags.length} ${t('taskInput.tags')}` : t('taskInput.tags')}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3 bg-popover z-50" align="start">
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('taskInput.addTag')}
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                            className="h-9 text-sm flex-1"
                          />
                          <Button size="sm" onClick={handleAddTag} disabled={!tagInput.trim()}>{t('common.add')}</Button>
                        </div>
                        
                        {savedTags.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-muted-foreground">{t('taskInput.recentTags')}</p>
                              <button
                                onClick={() => setShowManageTags(true)}
                                className="text-xs text-primary hover:underline"
                              >
                                {t('common.manage')}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {savedTags
                                .filter(st => !coloredTags.some(ct => ct.name === st.name))
                                .slice(0, 6)
                                .map((tag) => (
                                  <button
                                    key={tag.name}
                                    onClick={() => handleAddSavedTag(tag)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full hover:opacity-80 transition-opacity"
                                    style={{ 
                                      backgroundColor: `${tag.color}20`, 
                                      color: tag.color 
                                    }}
                                  >
                                    <Tag className="h-3 w-3" />
                                    {tag.name}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">{t('taskInput.tagColor')}</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {tagColors.map((color) => (
                              <button
                                key={color}
                                onClick={() => setSelectedTagColor(color)}
                                className={cn(
                                  "w-7 h-7 rounded-full transition-all",
                                  selectedTagColor === color && "ring-2 ring-offset-2 ring-primary"
                                )}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        {coloredTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                            {coloredTags.map((tag) => (
                              <span 
                                key={tag.name} 
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full"
                                style={{ 
                                  backgroundColor: `${tag.color}20`, 
                                  color: tag.color 
                                }}
                              >
                                {tag.name}
                                <button onClick={() => handleRemoveTag(tag.name)}><X className="h-3 w-3" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              if (action.id === 'deadline') {
                return (
                  <button
                    key={action.id}
                    onClick={() => setShowDeadlinePage(true)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all whitespace-nowrap",
                      deadline ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30" : "border-border bg-card hover:bg-muted"
                    )}
                  >
                    {deadline && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full" />}
                    <CalendarClock className={cn("h-4 w-4 flex-shrink-0", deadline ? "text-rose-500" : "text-muted-foreground")} />
                    <span className={cn("text-sm whitespace-nowrap", deadline ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                      {deadline ? format(deadline, 'MMM d') : t('taskInput.deadline')}
                    </span>
                  </button>
                );
              }

              if (action.id === 'section') {
                return (
                  <Popover key={action.id} open={showSectionPopover} onOpenChange={setShowSectionPopover}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "relative flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all whitespace-nowrap",
                          sectionId ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30" : "border-border bg-card hover:bg-muted"
                        )}
                      >
                        {sectionId && <span className="absolute -top-1 -right-1 w-2 h-2 bg-violet-500 rounded-full" />}
                        <ListTodo className={cn("h-4 w-4 flex-shrink-0", sectionId ? "text-violet-500" : "text-muted-foreground")} />
                        <span className={cn("text-sm whitespace-nowrap", sectionId ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground")}>
                          {sectionId ? sections.find(s => s.id === sectionId)?.name || t('taskInput.section') : t('taskInput.section')}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 bg-popover z-50" align="start">
                      <div className="space-y-1">
                        {sections.map((section) => (
                          <Button
                            key={section.id}
                            variant={sectionId === section.id ? "secondary" : "ghost"}
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => { setSectionId(section.id); setShowSectionPopover(false); }}
                          >
                            <div className="w-3 h-3 rounded-sm mr-2" style={{ backgroundColor: section.color }} />
                            {section.name}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              if (action.id === 'folder') {
                return (
                  <button
                    key={action.id}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all whitespace-nowrap",
                      folderId ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-border bg-card hover:bg-muted"
                    )}
                    onClick={() => setShowFolderDialog(true)}
                  >
                    {folderId && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />}
                    <FolderIcon className={cn("h-4 w-4 flex-shrink-0", folderId ? "text-amber-500" : "text-muted-foreground")} />
                    <span className={cn("text-sm whitespace-nowrap", folderId ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                      {folderId ? folders.find(f => f.id === folderId)?.name || t('taskInput.folder') : t('taskInput.folder')}
                    </span>
                  </button>
                );
              }

              if (action.id === 'image') {
                return (
                  <button
                    key={action.id}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all whitespace-nowrap",
                      imageUrl ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-border bg-card hover:bg-muted"
                    )}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {imageUrl && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />}
                    <ImageIcon className={cn("h-4 w-4 flex-shrink-0", imageUrl ? "text-emerald-500" : "text-muted-foreground")} />
                    <span className={cn("text-sm whitespace-nowrap", imageUrl ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                      {imageUrl ? t('taskInput.imageAdded') : t('taskInput.image')}
                    </span>
                  </button>
                );
              }

              if (action.id === 'description') {
                return (
                  <Popover key={action.id} open={showDescriptionInput} onOpenChange={setShowDescriptionInput}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "relative flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all whitespace-nowrap",
                          description ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30" : "border-border bg-card hover:bg-muted"
                        )}
                      >
                        {description && <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-500 rounded-full" />}
                        <FileText className={cn("h-4 w-4 flex-shrink-0", description ? "text-cyan-500" : "text-muted-foreground")} />
                        <span className={cn("text-sm whitespace-nowrap", description ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground")}>
                          {description ? t('taskInput.hasDescription') : t('taskInput.description')}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3 bg-popover z-50" align="start">
                      <div className="space-y-3">
                        <p className="text-sm font-medium">{t('taskInput.taskDescription')}</p>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={t('taskInput.addMoreDetails')}
                          className="w-full h-24 px-3 py-2 text-sm rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <Button size="sm" className="w-full" onClick={() => setShowDescriptionInput(false)}>
                          {t('common.done')}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              if (action.id === 'location') {
                return (
                  <Popover key={action.id} open={showLocationInput} onOpenChange={setShowLocationInput}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "relative flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all whitespace-nowrap",
                          locationReminder?.enabled ? "border-pink-500 bg-pink-50 dark:bg-pink-950/30" : 
                          location ? "border-pink-500 bg-pink-50 dark:bg-pink-950/30" : "border-border bg-card hover:bg-muted"
                        )}
                      >
                        {(location || locationReminder?.enabled) && <span className="absolute -top-1 -right-1 w-2 h-2 bg-pink-500 rounded-full" />}
                        <MapPin className={cn("h-4 w-4 flex-shrink-0", (location || locationReminder?.enabled) ? "text-pink-500" : "text-muted-foreground")} />
                        <span className={cn("text-sm whitespace-nowrap", (location || locationReminder?.enabled) ? "text-pink-600 dark:text-pink-400" : "text-muted-foreground")}>
                          {locationReminder?.enabled ? t('taskInput.locationReminder') : location ? t('taskInput.hasLocation') : t('taskInput.location')}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-3 bg-popover z-50" align="start">
                      <div className="space-y-3">
                        <p className="text-sm font-medium">{t('taskInput.locationReminder')}</p>
                        <LocationSearchInput
                          value={location}
                          onChange={setLocation}
                          onLocationSelect={(reminder) => {
                            setLocation(reminder.address);
                            setLocationReminder(reminder);
                          }}
                          locationReminder={locationReminder}
                          onClear={() => {
                            setLocation('');
                            setLocationReminder(undefined);
                          }}
                        />
                        <Button size="sm" className="w-full" onClick={() => setShowLocationInput(false)}>
                          {t('common.done')}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              // Repeat section removed - now handled in TaskDateTimePage

              return null;
            })}

            {/* Edit Actions Button - always last */}
            <button
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted transition-all whitespace-nowrap"
              onClick={() => setShowEditActions(true)}
            >
              <Settings2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">{t('taskInput.editActions')}</span>
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        </div>
      </div>

      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('taskInput.selectOrCreateFolder')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {folders.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('taskInput.selectFolder')}:</p>
                <div className="space-y-1">
                  <Button variant="ghost" className="w-full justify-start" onClick={() => { setFolderId(undefined); setShowFolderDialog(false); }}>
                    <FolderIcon className="h-4 w-4 mr-2" />{t('taskInput.allTasks')}
                  </Button>
                  {folders.map((folder) => (
                    <Button
                      key={folder.id}
                      variant={folderId === folder.id ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => { setFolderId(folder.id); setShowFolderDialog(false); }}
                    >
                      <div className="w-4 h-4 rounded mr-2" style={{ backgroundColor: folder.color }} />
                      {folder.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('taskInput.createNewFolder')}:</p>
              <Input
                placeholder={t('taskInput.folderName')}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
              />
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('taskInput.folderColor')}</p>
                <div className="flex gap-2">
                  {folderColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn("w-10 h-10 rounded-full transition-all", selectedColor === color && "ring-2 ring-primary ring-offset-2")}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={handleCreateFolder} className="w-full" disabled={!newFolderName.trim()}>
                {t('notesMenu.createFolder')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TaskDateTimePage - Full page date/time/repeat picker */}
      <TaskDateTimePage
        isOpen={showDateTimePage}
        onClose={() => setShowDateTimePage(false)}
        onSave={handleDateTimeSave}
        initialDate={dueDate}
        initialRepeatSettings={repeatSettings}
      />

      {/* Deadline Page - Date/Time/Reminder without repeat */}
      <TaskDateTimePage
        isOpen={showDeadlinePage}
        onClose={() => setShowDeadlinePage(false)}
        onSave={(data) => {
          setDeadline(data.selectedDate);
          if (data.reminder && data.reminder !== 'none' && data.selectedDate) {
            const reminderDate = new Date(data.selectedDate);
            switch (data.reminder) {
              case '5min':
                reminderDate.setMinutes(reminderDate.getMinutes() - 5);
                break;
              case '10min':
                reminderDate.setMinutes(reminderDate.getMinutes() - 10);
                break;
              case '15min':
                reminderDate.setMinutes(reminderDate.getMinutes() - 15);
                break;
              case '30min':
                reminderDate.setMinutes(reminderDate.getMinutes() - 30);
                break;
              case '1hour':
                reminderDate.setHours(reminderDate.getHours() - 1);
                break;
              case '2hours':
                reminderDate.setHours(reminderDate.getHours() - 2);
                break;
              case '1day':
                reminderDate.setDate(reminderDate.getDate() - 1);
                break;
            }
            setDeadlineReminderTime(reminderDate);
          } else {
            setDeadlineReminderTime(undefined);
          }
          setShowDeadlinePage(false);
          toast.success('Deadline saved');
        }}
        initialDate={deadline}
        hideRepeat={true}
      />

      {/* Edit Actions Sheet */}
      <EditActionsSheet
        isOpen={showEditActions}
        onClose={() => setShowEditActions(false)}
        actions={actionItems}
        onSave={handleSaveActions}
      />

      {/* Manage Tags Dialog */}
      <Dialog open={showManageTags} onOpenChange={(open) => {
        setShowManageTags(open);
        if (!open) handleCancelEditTag();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('taskInput.manageSavedTags')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {savedTags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('taskInput.noSavedTagsYet')}</p>
            ) : (
              savedTags.map((tag) => (
                <div 
                  key={tag.name} 
                  className="flex flex-col gap-2 p-3 rounded-lg border border-border"
                >
                  {editingTag?.name === tag.name ? (
                    <>
                      <Input
                        value={editTagName}
                        onChange={(e) => setEditTagName(e.target.value)}
                        placeholder="Tag name"
                        className="h-9"
                        autoFocus
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {tagColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditTagColor(color)}
                            className={cn(
                              "w-7 h-7 rounded-full transition-all",
                              editTagColor === color && "ring-2 ring-primary ring-offset-2"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Button size="sm" onClick={handleSaveEditTag} className="flex-1 h-8">
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEditTag} className="flex-1 h-8">
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => handleStartEditTag(tag)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <span 
                          className="w-4 h-4 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: tag.color }} 
                        />
                        <span className="text-sm font-medium">{tag.name}</span>
                      </button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteSavedTag(tag.name)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Template Sheet */}
      <TaskTemplateSheet
        isOpen={showTemplateSheet}
        onClose={() => setShowTemplateSheet(false)}
        onSelectTemplate={handleSelectTemplate}
      />
    </>
  );
};

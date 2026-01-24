import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem, Priority, ColoredTag } from '@/types/note';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, Repeat, Tag, Play, Pause, Link, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { WaveformProgressBar } from './WaveformProgressBar';
import { canCompleteTask } from './TaskDependencySheet';
import { getRepeatLabel } from '@/utils/recurringTasks';
import { ResolvedTaskImage } from './ResolvedTaskImage';
import { resolveTaskMediaUrl } from '@/utils/todoItemsStorage';
import { TaskStatusBadge } from './TaskStatusBadge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TaskItemProps {
  item: TodoItem;
  level?: number;
  onUpdate: (itemId: string, updates: Partial<TodoItem>) => void;
  onDelete: (itemId: string) => void;
  onTaskClick: (item: TodoItem) => void;
  onImageClick: (imageUrl: string) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onSelect?: (itemId: string) => void;
  expandedTasks?: Set<string>;
  onToggleSubtasks?: (taskId: string) => void;
  onUpdateSubtask?: (parentId: string, subtaskId: string, updates: Partial<TodoItem>) => void;
  hideDetails?: boolean;
  showStatusBadge?: boolean;
  allTasks?: TodoItem[];
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

const getPriorityBorderColor = (priority?: Priority) => {
  switch (priority) {
    case 'high': return '#ef4444';
    case 'medium': return '#f97316';
    case 'low': return '#22c55e';
    default: return '#6b7280';
  }
};

const getPriorityBorderClass = (priority?: Priority) => {
  switch (priority) {
    case 'high': return 'border-red-500';
    case 'medium': return 'border-orange-500';
    case 'low': return 'border-green-500';
    default: return 'border-muted-foreground/40';
  }
};

// Subtask component with nested subtask collapse support
interface SubtaskWithNestedProps {
  subtask: TodoItem;
  parentId: string;
  onUpdateSubtask?: (parentId: string, subtaskId: string, updates: Partial<TodoItem>) => void;
  hasNestedSubtasks: boolean;
}

const SubtaskWithNested = ({ subtask, parentId, onUpdateSubtask, hasNestedSubtasks }: SubtaskWithNestedProps) => {
  const [isNestedOpen, setIsNestedOpen] = useState(false);
  
  return (
    <Collapsible open={isNestedOpen} onOpenChange={setIsNestedOpen}>
      <div
        className="flex items-center gap-3 py-2 px-2 border-l-4 hover:bg-muted/30 transition-colors"
        style={{ borderLeftColor: getPriorityBorderColor(subtask.priority) }}
      >
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={async (checked) => {
            if (onUpdateSubtask) {
              onUpdateSubtask(parentId, subtask.id, { completed: !!checked });
            }
            if (checked && !subtask.completed) {
              try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "h-5 w-5 transition-all",
            subtask.completed 
              ? "rounded-sm border-0 bg-muted-foreground/30 data-[state=checked]:bg-muted-foreground/30 data-[state=checked]:text-white" 
              : cn("rounded-full border-2", getPriorityBorderClass(subtask.priority))
          )}
        />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium truncate",
            subtask.completed && "text-muted-foreground line-through"
          )}>
            {subtask.text}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {subtask.dueDate && (
              <span className="text-xs text-muted-foreground">
                {new Date(subtask.dueDate).toLocaleDateString()}
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
            {subtask.repeatType && subtask.repeatType !== 'none' && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600">
                <Repeat className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>
        {subtask.imageUrl && (
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
            <ResolvedTaskImage srcRef={subtask.imageUrl} alt="Subtask attachment" className="w-full h-full object-cover" />
          </div>
        )}
        {hasNestedSubtasks && (
          <CollapsibleTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); setIsNestedOpen(!isNestedOpen); }}
              className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
            >
              {isNestedOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
        )}
      </div>
      
      {/* Nested subtasks (sub-subtasks) */}
      {hasNestedSubtasks && (
        <CollapsibleContent>
          <div className="ml-6 space-y-1 pt-1 border-l-2 border-muted-foreground/20">
            {subtask.subtasks!.map((nested) => (
              <div
                key={nested.id}
                className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/20 transition-colors border-l-2"
                style={{ borderLeftColor: getPriorityBorderColor(nested.priority) }}
              >
                <Checkbox
                  checked={nested.completed}
                  className={cn(
                    "h-4 w-4 transition-all",
                    nested.completed 
                      ? "rounded-sm border-0 bg-muted-foreground/30" 
                      : cn("rounded-full border-2", getPriorityBorderClass(nested.priority))
                  )}
                  disabled
                />
                <span className={cn(
                  "text-xs flex-1 truncate",
                  nested.completed && "text-muted-foreground line-through"
                )}>
                  {nested.text}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

export const TaskItem = ({
  item,
  level = 0,
  onUpdate,
  onDelete,
  onTaskClick,
  onImageClick,
  isSelected = false,
  isSelectionMode = false,
  onSelect,
  expandedTasks,
  onToggleSubtasks,
  onUpdateSubtask,
  hideDetails = false,
  showStatusBadge = true,
  allTasks = []
}: TaskItemProps) => {
  const { t } = useTranslation();
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isOpen = expandedTasks ? expandedTasks.has(item.id) : localIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onToggleSubtasks) {
      onToggleSubtasks(item.id);
    } else {
      setLocalIsOpen(open);
    }
  };
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(item.voiceRecording?.duration || 0);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasSubtasks = item.subtasks && item.subtasks.length > 0;
  const indentPx = level * 16;
  
  useEffect(() => {
    if (item.voiceRecording?.audioUrl) {
      resolveTaskMediaUrl(item.voiceRecording.audioUrl).then(url => {
        if (url) setResolvedAudioUrl(url);
      });
    }
  }, [item.voiceRecording?.audioUrl]);
  
  const { canComplete, blockedBy } = canCompleteTask(item, allTasks);
  const hasDependencies = item.dependsOn && item.dependsOn.length > 0;
  const isBlocked = hasDependencies && !canComplete;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayVoice = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.voiceRecording) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingVoice(false);
      setPlaybackProgress(0);
      setCurrentTime(0);
      return;
    }

    const audioUrl = await resolveTaskMediaUrl(item.voiceRecording.audioUrl);
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;
    
    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
      }
    };
    
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
    };
    
    audio.onended = () => {
      setIsPlayingVoice(false);
      setPlaybackProgress(0);
      setCurrentTime(0);
      audioRef.current = null;
    };
    
    audio.play();
    setIsPlayingVoice(true);
  };

  const cyclePlaybackSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !item.voiceRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = audioRef.current.duration || audioDuration || item.voiceRecording.duration;
    if (duration && !isNaN(duration)) {
      audioRef.current.currentTime = percentage * duration;
      setPlaybackProgress(percentage * 100);
      setCurrentTime(percentage * duration);
    }
  };

  return (
    <div className="space-y-1" style={{ paddingLeft: indentPx > 0 ? `${indentPx}px` : undefined }}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Main task - flat layout */}
        <div
          className={cn(
            "flex items-center gap-3 py-2.5 px-2 border-l-4 transition-all cursor-pointer select-none hover:bg-muted/30",
            isSelected && "bg-primary/5",
            level > 0 && "mr-2"
          )}
          style={{ 
            borderLeftColor: getPriorityBorderColor(item.priority),
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
          onClick={() => !isSelectionMode && onTaskClick(item)}
        >
          {isSelectionMode && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect?.(item.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5 flex-shrink-0"
            />
          )}
          
          <div className="relative flex items-center flex-shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Checkbox
                      checked={item.completed}
                      disabled={isBlocked}
                      onCheckedChange={async (checked) => {
                        if (isBlocked) return;
                        onUpdate(item.id, { completed: !!checked });
                        if (checked && !item.completed) {
                          try {
                            await Haptics.impact({ style: ImpactStyle.Heavy });
                            setTimeout(async () => { try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {} }, 100);
                          } catch {}
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "h-6 w-6 flex-shrink-0 transition-all",
                        item.completed 
                          ? "rounded-sm border-0 bg-muted-foreground/30 data-[state=checked]:bg-muted-foreground/30 data-[state=checked]:text-white" 
                          : cn("rounded-full border-2", getPriorityBorderClass(item.priority)),
                        isBlocked && "opacity-50 cursor-not-allowed"
                      )}
                    />
                    {isBlocked && (
                      <Lock className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
                    )}
                  </div>
                </TooltipTrigger>
                {isBlocked && (
                  <TooltipContent>
                    <p className="text-xs">{t('tasks.blockedBy', 'Blocked by')}: {blockedBy.map(task => task.text).slice(0, 2).join(', ')}{blockedBy.length > 2 ? ` +${blockedBy.length - 2}` : ''}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            {item.voiceRecording ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayVoice}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors min-w-0 flex-1"
                >
                  {isPlayingVoice ? (
                    <Pause className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : (
                    <Play className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    {resolvedAudioUrl ? (
                      <WaveformProgressBar
                        audioUrl={resolvedAudioUrl}
                        progress={playbackProgress}
                        duration={audioDuration || item.voiceRecording.duration}
                        isPlaying={isPlayingVoice}
                        onSeek={(percent) => {
                          if (audioRef.current) {
                            const duration = audioRef.current.duration || audioDuration || item.voiceRecording!.duration;
                            if (duration && !isNaN(duration)) {
                              audioRef.current.currentTime = (percent / 100) * duration;
                              setPlaybackProgress(percent);
                              setCurrentTime((percent / 100) * duration);
                            }
                          }
                        }}
                        height={12}
                      />
                    ) : (
                      <div 
                        className="relative h-1.5 bg-primary/20 rounded-full overflow-hidden cursor-pointer"
                        onClick={handleSeek}
                      >
                        <div 
                          className="absolute h-full bg-primary rounded-full transition-all duration-100"
                          style={{ width: `${playbackProgress}%` }}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-primary font-medium">
                        {isPlayingVoice ? formatDuration(Math.round(currentTime)) : '0:00'}
                      </span>
                      <span className="text-primary/70">
                        {formatDuration(audioDuration || item.voiceRecording.duration)}
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={cyclePlaybackSpeed}
                  className="px-2 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 transition-colors min-w-[40px]"
                >
                  {playbackSpeed}x
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className={cn("text-sm font-medium truncate", item.completed && "text-muted-foreground line-through")}>{item.text}</p>
              </div>
            )}
            
            {/* Colored tags display */}
            {!hideDetails && item.coloredTags && item.coloredTags.length > 0 && !item.voiceRecording && (
              <div className="flex items-center gap-1 mt-1 overflow-hidden">
                {item.coloredTags.slice(0, 3).map((tag) => (
                  <span 
                    key={tag.name}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full truncate max-w-[60px]"
                    style={{ 
                      backgroundColor: `${tag.color}20`, 
                      color: tag.color 
                    }}
                  >
                    <Tag className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="truncate">{tag.name}</span>
                  </span>
                ))}
                {item.coloredTags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{item.coloredTags.length - 3}</span>
                )}
              </div>
            )}
            
            {/* Date display */}
            {!hideDetails && item.dueDate && !item.voiceRecording && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(item.dueDate).toLocaleDateString()}
              </p>
            )}
            
            {/* Status Badge */}
            {!hideDetails && showStatusBadge && item.status && item.status !== 'not_started' && !item.voiceRecording && (
              <div className="mt-1">
                <TaskStatusBadge status={item.status} size="sm" />
              </div>
            )}
            
            {/* Indicators */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {item.repeatType && item.repeatType !== 'none' && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600">
                  <Repeat className="h-2.5 w-2.5" />
                  {getRepeatLabel(item.repeatType, item.repeatDays, item.advancedRepeat)}
                </span>
              )}
              {hasDependencies && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full",
                  isBlocked ? "bg-amber-500/20 text-amber-600" : "bg-green-500/20 text-green-600"
                )}>
                  <Link className="h-2.5 w-2.5" />
                  {isBlocked ? `${blockedBy.length} blocking` : 'Ready'}
                </span>
              )}
              {hasSubtasks && !isOpen && (
                <p className="text-xs text-muted-foreground">{item.subtasks!.filter(st => st.completed).length}/{item.subtasks!.length} {t('tasks.subtasks', 'subtasks')}</p>
              )}
            </div>
          </div>

          {item.imageUrl && (
            <div
              className="w-14 h-14 rounded-full overflow-hidden border-2 border-border flex-shrink-0 ml-1 cursor-pointer hover:border-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); onImageClick(item.imageUrl!); }}
            >
              <ResolvedTaskImage srcRef={item.imageUrl} alt="Task attachment" className="w-full h-full object-cover" />
            </div>
          )}

          {hasSubtasks && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
              className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>

        {/* Subtasks */}
        <CollapsibleContent>
          {hasSubtasks && (
            <div className="ml-4 space-y-1 pt-1">
              {item.subtasks!.map((subtask) => {
                const hasNestedSubtasks = subtask.subtasks && subtask.subtasks.length > 0;
                return (
                  <SubtaskWithNested
                    key={subtask.id}
                    subtask={subtask}
                    parentId={item.id}
                    onUpdateSubtask={onUpdateSubtask}
                    hasNestedSubtasks={hasNestedSubtasks}
                  />
                );
              })}
              <p className="text-xs text-muted-foreground px-2 py-1">
                {item.subtasks!.filter(st => st.completed).length}/{item.subtasks!.length} completed
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
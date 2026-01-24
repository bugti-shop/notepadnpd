import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, Play, Pause, RotateCcw, Settings, Coffee, 
  Brain, Target, Volume2, VolumeX, SkipForward,
  LinkIcon, CheckCircle2, Clock, ChevronDown, Goal, Trash2, Edit2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from 'sonner';
import { TodoItem } from '@/types/note';
import { loadTasksFromDB } from '@/utils/taskStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';

type SessionType = 'work' | 'shortBreak' | 'longBreak';

interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

interface PomodoroSession {
  type: SessionType;
  startTime: Date;
  endTime: Date;
  duration: number;
  completed: boolean;
  linkedTaskId?: string;
  linkedTaskText?: string;
}

interface TaskTimeTracking {
  taskId: string;
  taskText: string;
  totalMinutes: number;
  sessionsCount: number;
  lastSession: Date;
  goalMinutes?: number;
}

interface PomodoroTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultSettings: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  soundEnabled: true,
  vibrationEnabled: true,
};

const sessionColors = {
  work: 'text-red-500',
  shortBreak: 'text-green-500',
  longBreak: 'text-blue-500',
};

const sessionBgColors = {
  work: 'bg-red-500',
  shortBreak: 'bg-green-500',
  longBreak: 'bg-blue-500',
};

export const PomodoroTimer = ({ isOpen, onClose }: PomodoroTimerProps) => {
  const [settings, setSettings] = useState<PomodoroSettings>(defaultSettings);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  
  const [sessionType, setSessionType] = useState<SessionType>('work');
  const [timeRemaining, setTimeRemaining] = useState(defaultSettings.workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [linkedTask, setLinkedTask] = useState<{ id: string; text: string } | null>(null);
  const [availableTasks, setAvailableTasks] = useState<TodoItem[]>([]);
  const [taskTimeTracking, setTaskTimeTracking] = useState<TaskTimeTracking[]>([]);
  const [showGoalSetter, setShowGoalSetter] = useState(false);
  const [selectedTaskForGoal, setSelectedTaskForGoal] = useState<string | null>(null);
  const [goalInputMinutes, setGoalInputMinutes] = useState<number>(60);
  
  const [todaySessions, setTodaySessions] = useState<PomodoroSession[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  // Load settings from IndexedDB
  useEffect(() => {
    const loadSettings = async () => {
      const savedSettings = await getSetting<PomodoroSettings>('pomodoroSettings', defaultSettings);
      setSettings(savedSettings);
      setTimeRemaining(savedSettings.workDuration * 60);
      
      const savedTracking = await getSetting<TaskTimeTracking[]>('pomodoroTaskTracking', []);
      setTaskTimeTracking(savedTracking);
      
      const savedSessions = await getSetting<PomodoroSession[]>('pomodoroSessions', []);
      const today = new Date().toDateString();
      setTodaySessions(savedSessions.filter((s: PomodoroSession) => 
        new Date(s.startTime).toDateString() === today
      ));
      
      setIsSettingsLoaded(true);
    };
    loadSettings();
  }, []);

  // Load available tasks
  useEffect(() => {
    const loadTasks = async () => {
      const tasks = await loadTasksFromDB();
      setAvailableTasks(tasks.filter(t => !t.completed));
    };
    loadTasks();
    
    const handleUpdate = () => loadTasks();
    window.addEventListener('tasksUpdated', handleUpdate);
    return () => window.removeEventListener('tasksUpdated', handleUpdate);
  }, []);

  // Save settings
  useEffect(() => {
    if (isSettingsLoaded) {
      setSetting('pomodoroSettings', settings);
    }
  }, [settings, isSettingsLoaded]);

  // Save sessions
  useEffect(() => {
    if (isSettingsLoaded) {
      setSetting('pomodoroSessions', todaySessions);
    }
  }, [todaySessions, isSettingsLoaded]);

  // Save task time tracking
  useEffect(() => {
    if (isSettingsLoaded) {
      setSetting('pomodoroTaskTracking', taskTimeTracking);
    }
  }, [taskTimeTracking, isSettingsLoaded]);

  // Timer logic
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const updateTaskTimeTracking = (taskId: string, taskText: string, duration: number) => {
    setTaskTimeTracking(prev => {
      const existing = prev.find(t => t.taskId === taskId);
      let newTracking: TaskTimeTracking[];
      
      if (existing) {
        const newTotalMinutes = existing.totalMinutes + duration;
        const goalMinutes = existing.goalMinutes;
        
        // Check for milestone notifications
        if (goalMinutes) {
          const oldProgress = (existing.totalMinutes / goalMinutes) * 100;
          const newProgress = (newTotalMinutes / goalMinutes) * 100;
          
          // 80% milestone
          if (oldProgress < 80 && newProgress >= 80 && newProgress < 100) {
            toast.success(`🎯 Almost there! ${taskText} is 80% complete!`, {
              duration: 5000,
              description: `${formatDuration(newTotalMinutes)} of ${formatDuration(goalMinutes)} goal reached`
            });
            try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
          }
          
          // 100% milestone
          if (oldProgress < 100 && newProgress >= 100) {
            toast.success(`🎉 Goal Complete! ${taskText}`, {
              duration: 8000,
              description: `You've reached your ${formatDuration(goalMinutes)} goal! Congratulations!`
            });
            try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
          }
        }
        
        newTracking = prev.map(t => 
          t.taskId === taskId 
            ? { 
                ...t, 
                totalMinutes: newTotalMinutes,
                sessionsCount: t.sessionsCount + 1,
                lastSession: new Date()
              }
            : t
        );
      } else {
        newTracking = [...prev, {
          taskId,
          taskText,
          totalMinutes: duration,
          sessionsCount: 1,
          lastSession: new Date()
        }];
      }
      
      return newTracking;
    });
  };

  const handleSessionComplete = async () => {
    setIsRunning(false);
    
    // Haptic feedback
    if (settings.vibrationEnabled) {
      try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    }

    // Sound notification
    if (settings.soundEnabled) {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...');
        audio.play().catch(() => {});
      } catch {}
    }

    // Record session
    if (sessionStartRef.current) {
      const session: PomodoroSession = {
        type: sessionType,
        startTime: sessionStartRef.current,
        endTime: new Date(),
        duration: getDuration(sessionType),
        completed: true,
        linkedTaskId: linkedTask?.id,
        linkedTaskText: linkedTask?.text,
      };
      setTodaySessions(prev => [...prev, session]);

      // Update task time tracking if linked
      if (linkedTask && sessionType === 'work') {
        updateTaskTimeTracking(linkedTask.id, linkedTask.text, getDuration(sessionType));
      }
    }

    // Handle next session
    if (sessionType === 'work') {
      const newCompletedSessions = completedSessions + 1;
      setCompletedSessions(newCompletedSessions);
      
      if (newCompletedSessions % settings.sessionsUntilLongBreak === 0) {
        toast.success('Great work! Time for a long break!');
        switchSession('longBreak');
        if (settings.autoStartBreaks) startTimer('longBreak');
      } else {
        toast.success('Session complete! Take a short break.');
        switchSession('shortBreak');
        if (settings.autoStartBreaks) startTimer('shortBreak');
      }
    } else {
      toast.success('Break over! Ready to focus?');
      switchSession('work');
      if (settings.autoStartWork) startTimer('work');
    }
  };

  const getDuration = (type: SessionType) => {
    switch (type) {
      case 'work': return settings.workDuration;
      case 'shortBreak': return settings.shortBreakDuration;
      case 'longBreak': return settings.longBreakDuration;
    }
  };

  const switchSession = (type: SessionType) => {
    setSessionType(type);
    setTimeRemaining(getDuration(type) * 60);
    sessionStartRef.current = null;
  };

  const startTimer = async (type?: SessionType) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    if (type) switchSession(type);
    sessionStartRef.current = new Date();
    setIsRunning(true);
  };

  const pauseTimer = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    setIsRunning(false);
  };

  const resetTimer = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    setIsRunning(false);
    setTimeRemaining(getDuration(sessionType) * 60);
    sessionStartRef.current = null;
  };

  const skipSession = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    handleSessionComplete();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const handleLinkTask = (task: TodoItem) => {
    setLinkedTask({ id: task.id, text: task.text });
    setShowTaskPicker(false);
    toast.success(`Linked to: ${task.text}`);
  };

  const handleUnlinkTask = () => {
    setLinkedTask(null);
    toast.info('Task unlinked');
  };

  const handleSetGoal = (taskId: string, goalMinutes: number) => {
    setTaskTimeTracking(prev => prev.map(t =>
      t.taskId === taskId ? { ...t, goalMinutes } : t
    ));
    setShowGoalSetter(false);
    setSelectedTaskForGoal(null);
    toast.success(`Goal set: ${formatDuration(goalMinutes)}`);
  };

  const handleRemoveGoal = (taskId: string) => {
    setTaskTimeTracking(prev => prev.map(t =>
      t.taskId === taskId ? { ...t, goalMinutes: undefined } : t
    ));
    toast.info('Goal removed');
  };

  const openGoalSetter = (taskId: string, currentGoal?: number) => {
    setSelectedTaskForGoal(taskId);
    setGoalInputMinutes(currentGoal || 60);
    setShowGoalSetter(true);
  };

  const getGoalProgress = (tracking: TaskTimeTracking) => {
    if (!tracking.goalMinutes) return 0;
    return Math.min((tracking.totalMinutes / tracking.goalMinutes) * 100, 100);
  };

  const progress = ((getDuration(sessionType) * 60 - timeRemaining) / (getDuration(sessionType) * 60)) * 100;

  const todayWorkSessions = todaySessions.filter(s => s.type === 'work' && s.completed).length;
  const todayTotalMinutes = todaySessions
    .filter(s => s.type === 'work' && s.completed)
    .reduce((acc, s) => acc + s.duration, 0);

  const linkedTaskSessions = linkedTask 
    ? todaySessions.filter(s => s.linkedTaskId === linkedTask.id && s.completed).length
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">Pomodoro Timer</h2>
            <p className="text-xs text-muted-foreground">Focus in {settings.workDuration} minute sessions</p>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={cn("p-2 hover:bg-muted rounded-lg", showSettings && "bg-muted")}
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {showSettings ? (
          <div className="p-4 max-w-md mx-auto space-y-6">
            <h3 className="font-semibold">Timer Settings</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Work Duration: {settings.workDuration} min</Label>
                <Slider
                  value={[settings.workDuration]}
                  onValueChange={([v]) => setSettings(prev => ({ ...prev, workDuration: v }))}
                  min={5}
                  max={60}
                  step={5}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm">Short Break: {settings.shortBreakDuration} min</Label>
                <Slider
                  value={[settings.shortBreakDuration]}
                  onValueChange={([v]) => setSettings(prev => ({ ...prev, shortBreakDuration: v }))}
                  min={1}
                  max={15}
                  step={1}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm">Long Break: {settings.longBreakDuration} min</Label>
                <Slider
                  value={[settings.longBreakDuration]}
                  onValueChange={([v]) => setSettings(prev => ({ ...prev, longBreakDuration: v }))}
                  min={5}
                  max={30}
                  step={5}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm">Sessions until long break: {settings.sessionsUntilLongBreak}</Label>
                <Slider
                  value={[settings.sessionsUntilLongBreak]}
                  onValueChange={([v]) => setSettings(prev => ({ ...prev, sessionsUntilLongBreak: v }))}
                  min={2}
                  max={8}
                  step={1}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto-start breaks</Label>
                <Switch
                  checked={settings.autoStartBreaks}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, autoStartBreaks: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto-start work sessions</Label>
                <Switch
                  checked={settings.autoStartWork}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, autoStartWork: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  Sound notifications
                </Label>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, soundEnabled: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Vibration</Label>
                <Switch
                  checked={settings.vibrationEnabled}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, vibrationEnabled: v }))}
                />
              </div>
            </div>

            {/* Task Time Tracking Stats with Goals */}
            {taskTimeTracking.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Goal className="h-4 w-4" />
                  Task Time Goals & Progress
                </h4>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {taskTimeTracking
                      .sort((a, b) => b.totalMinutes - a.totalMinutes)
                      .map((tracking) => {
                        const progress = getGoalProgress(tracking);
                        const isGoalComplete = tracking.goalMinutes && tracking.totalMinutes >= tracking.goalMinutes;
                        
                        return (
                          <div 
                            key={tracking.taskId}
                            className={cn(
                              "p-3 rounded-lg border",
                              isGoalComplete 
                                ? "bg-green-500/10 border-green-500/30" 
                                : "bg-muted/50 border-border/50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium line-clamp-1 flex-1">{tracking.taskText}</p>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openGoalSetter(tracking.taskId, tracking.goalMinutes)}
                                  className="p-1 hover:bg-muted rounded"
                                >
                                  <Edit2 className="h-3 w-3 text-muted-foreground" />
                                </button>
                                {tracking.goalMinutes && (
                                  <button
                                    onClick={() => handleRemoveGoal(tracking.taskId)}
                                    className="p-1 hover:bg-muted rounded"
                                  >
                                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(tracking.totalMinutes)}
                                {tracking.goalMinutes && (
                                  <span> / {formatDuration(tracking.goalMinutes)}</span>
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                <Brain className="h-3 w-3" />
                                {tracking.sessionsCount} sessions
                              </span>
                            </div>
                            
                            {tracking.goalMinutes && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className={cn(
                                    isGoalComplete ? "text-green-600 font-medium" : "text-muted-foreground"
                                  )}>
                                    {isGoalComplete ? "Goal Complete! 🎉" : `${Math.round(progress)}% complete`}
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all duration-500",
                                      isGoalComplete ? "bg-green-500" : "bg-primary"
                                    )}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            
                            {!tracking.goalMinutes && (
                              <button
                                onClick={() => openGoalSetter(tracking.taskId)}
                                className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <Goal className="h-3 w-3" />
                                Set time goal
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setSettings(defaultSettings)}
            >
              Reset to Defaults
            </Button>
          </div>
        ) : (
          <div className="p-4 flex flex-col items-center">
            {/* Task Link Button */}
            <div className="w-full max-w-sm mb-4">
              {linkedTask ? (
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Tracking time for:</p>
                    <p className="text-sm font-medium truncate">{linkedTask.text}</p>
                    {linkedTaskSessions > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {linkedTaskSessions} session{linkedTaskSessions !== 1 ? 's' : ''} today
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnlinkTask}
                    className="text-xs h-7"
                  >
                    Unlink
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTaskPicker(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-muted-foreground/30 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <LinkIcon className="h-4 w-4" />
                  <span className="text-sm">Link to a task for time tracking</span>
                </button>
              )}
            </div>

            {/* Session Type Tabs */}
            <div className="flex gap-2 mb-8">
              {(['work', 'shortBreak', 'longBreak'] as SessionType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => !isRunning && switchSession(type)}
                  disabled={isRunning}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    sessionType === type 
                      ? cn(sessionBgColors[type], "text-white")
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {type === 'work' && <Brain className="h-4 w-4 inline mr-1.5" />}
                  {type === 'shortBreak' && <Coffee className="h-4 w-4 inline mr-1.5" />}
                  {type === 'longBreak' && <Coffee className="h-4 w-4 inline mr-1.5" />}
                  {type === 'work' ? 'Focus' : type === 'shortBreak' ? 'Short Break' : 'Long Break'}
                </button>
              ))}
            </div>

            {/* Timer Display */}
            <div className="relative w-64 h-64 mb-8">
              <div className="absolute inset-0 rounded-full border-8 border-muted" />
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 2.89} 289`}
                  className={sessionColors[sessionType]}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-5xl font-bold tabular-nums", sessionColors[sessionType])}>
                  {formatTime(timeRemaining)}
                </span>
                <span className="text-sm text-muted-foreground mt-2 capitalize">
                  {sessionType === 'work' ? 'Focus Time' : sessionType === 'shortBreak' ? 'Short Break' : 'Long Break'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mb-8">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={resetTimer}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>

              <Button
                size="icon"
                className={cn("h-16 w-16 rounded-full", sessionBgColors[sessionType])}
                onClick={isRunning ? pauseTimer : () => startTimer()}
              >
                {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={skipSession}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>

            {/* Stats */}
            <div className="w-full max-w-sm bg-muted/50 rounded-xl p-4">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Today's Progress
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-red-500">{todayWorkSessions}</div>
                  <div className="text-xs text-muted-foreground">Sessions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-500">{todayTotalMinutes}</div>
                  <div className="text-xs text-muted-foreground">Minutes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-500">{completedSessions}</div>
                  <div className="text-xs text-muted-foreground">This Cycle</div>
                </div>
              </div>
            </div>

            {/* Session Indicator */}
            <div className="mt-4 flex gap-2">
              {Array.from({ length: settings.sessionsUntilLongBreak }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full transition-all",
                    i < (completedSessions % settings.sessionsUntilLongBreak)
                      ? "bg-red-500"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Today's Sessions with Task Links */}
            {todaySessions.filter(s => s.type === 'work' && s.completed).length > 0 && (
              <div className="w-full max-w-sm mt-6">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Today's Work Sessions
                </h4>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {todaySessions
                      .filter(s => s.type === 'work' && s.completed)
                      .reverse()
                      .map((session, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Brain className="h-3 w-3 text-red-500" />
                            <span>{session.duration} min</span>
                            {session.linkedTaskText && (
                              <span className="text-muted-foreground truncate max-w-[120px]">
                                • {session.linkedTaskText}
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Picker Modal */}
      {showTaskPicker && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-md max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">Link to Task</h3>
              <button 
                onClick={() => setShowTaskPicker(false)}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="flex-1 p-4">
              {availableTasks.length > 0 ? (
                <div className="space-y-2">
                  {availableTasks.map((task) => {
                    const tracking = taskTimeTracking.find(t => t.taskId === task.id);
                    return (
                      <button
                        key={task.id}
                        onClick={() => handleLinkTask(task)}
                        className="w-full text-left p-3 rounded-lg hover:bg-muted/50 border border-border transition-colors"
                      >
                        <p className="text-sm font-medium line-clamp-1">{task.text}</p>
                        {tracking && (
                          <div className="mt-1">
                            <p className="text-xs text-muted-foreground">
                              {formatDuration(tracking.totalMinutes)} tracked • {tracking.sessionsCount} sessions
                            </p>
                            {tracking.goalMinutes && (
                              <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    tracking.totalMinutes >= tracking.goalMinutes ? "bg-green-500" : "bg-primary"
                                  )}
                                  style={{ width: `${getGoalProgress(tracking)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No tasks available</p>
                  <p className="text-xs mt-1">Create tasks in the Todo section first</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Goal Setter Modal */}
      {showGoalSetter && selectedTaskForGoal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-sm p-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Goal className="h-4 w-4" />
                Set Time Goal
              </h3>
              <button 
                onClick={() => {
                  setShowGoalSetter(false);
                  setSelectedTaskForGoal(null);
                }}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {taskTimeTracking.find(t => t.taskId === selectedTaskForGoal)?.taskText}
            </p>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Goal Duration</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Slider
                    value={[goalInputMinutes]}
                    onValueChange={([v]) => setGoalInputMinutes(v)}
                    min={15}
                    max={480}
                    step={15}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-16 text-right">
                    {formatDuration(goalInputMinutes)}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                {[30, 60, 120, 180, 240, 480].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setGoalInputMinutes(mins)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                      goalInputMinutes === mins 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {formatDuration(mins)}
                  </button>
                ))}
              </div>
              
              <Button 
                onClick={() => handleSetGoal(selectedTaskForGoal, goalInputMinutes)}
                className="w-full"
              >
                <Target className="h-4 w-4 mr-2" />
                Set Goal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PomodoroTimer;

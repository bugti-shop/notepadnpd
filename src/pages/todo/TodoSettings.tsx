import { ChevronRight, Settings as SettingsIcon, Grid3X3, Timer, Clock, BarChart3, Focus, CalendarDays, CalendarRange, Plus, Eye, EyeOff, Trash2, Edit2, Target, Zap, Brain, Sparkles, Palette, Check, ExternalLink, Bell } from 'lucide-react';
import { useDarkMode, themes } from '@/hooks/useDarkMode';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TodoLayout } from './TodoLayout';
import { loadTasksFromDB, saveTasksToDB } from '@/utils/taskStorage';
import { getSetting, setSetting, getAllSettings } from '@/utils/settingsStorage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Lazy load productivity tools to prevent crashes
const EisenhowerMatrix = lazy(() => import('@/components/EisenhowerMatrix').then(m => ({ default: m.EisenhowerMatrix })));
const PomodoroTimer = lazy(() => import('@/components/PomodoroTimer').then(m => ({ default: m.PomodoroTimer })));
const CountdownTimer = lazy(() => import('@/components/CountdownTimer').then(m => ({ default: m.CountdownTimer })));
const TaskAnalytics = lazy(() => import('@/components/TaskAnalytics').then(m => ({ default: m.TaskAnalytics })));
const FocusMode = lazy(() => import('@/components/FocusMode').then(m => ({ default: m.FocusMode })));
const DailyPlanner = lazy(() => import('@/components/DailyPlanner').then(m => ({ default: m.DailyPlanner })));
const WeeklyReview = lazy(() => import('@/components/WeeklyReview').then(m => ({ default: m.WeeklyReview })));

interface CustomTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
  linkedTaskIds?: string[];
  linkedCategoryId?: string;
}

const DEFAULT_TOOL_VISIBILITY: Record<string, boolean> = {
  eisenhower: true,
  pomodoro: true,
  countdown: true,
  focusMode: true,
  dailyPlanner: true,
  weeklyReview: true,
  analytics: true,
};

const TOOL_ICONS = [
  { id: 'target', icon: Target, label: 'Target' },
  { id: 'zap', icon: Zap, label: 'Zap' },
  { id: 'brain', icon: Brain, label: 'Brain' },
  { id: 'sparkles', icon: Sparkles, label: 'Sparkles' },
  { id: 'timer', icon: Timer, label: 'Timer' },
  { id: 'focus', icon: Focus, label: 'Focus' },
];

const TOOL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

const TodoSettings = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentTheme, setTheme } = useDarkMode();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showEisenhower, setShowEisenhower] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showDailyPlanner, setShowDailyPlanner] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  
  // Custom tools state
  const [toolVisibility, setToolVisibility] = useState<Record<string, boolean>>(DEFAULT_TOOL_VISIBILITY);
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [showAddToolDialog, setShowAddToolDialog] = useState(false);
  const [editingTool, setEditingTool] = useState<CustomTool | null>(null);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDescription, setNewToolDescription] = useState('');
  const [newToolIcon, setNewToolIcon] = useState('target');
  const [newToolColor, setNewToolColor] = useState('#3b82f6');
  const [newToolLinkedTaskIds, setNewToolLinkedTaskIds] = useState<string[]>([]);
  const [newToolLinkedCategoryId, setNewToolLinkedCategoryId] = useState<string>('');
  const [showManageTools, setShowManageTools] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<{ id: string; text: string }[]>([]);
  const [availableCategories, setAvailableCategories] = useState<{ id: string; name: string }[]>([]);
  
  // Auto-reminder time settings
  const [showAutoReminderDialog, setShowAutoReminderDialog] = useState(false);
  const [morningReminderHour, setMorningReminderHour] = useState(9);
  const [afternoonReminderHour, setAfternoonReminderHour] = useState(14);
  const [eveningReminderHour, setEveningReminderHour] = useState(19);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load tool visibility settings
        const savedVisibility = await getSetting<Record<string, boolean> | null>('productivityToolVisibility', null);
        if (savedVisibility) {
          setToolVisibility({ ...DEFAULT_TOOL_VISIBILITY, ...savedVisibility });
        }
        
        // Load custom tools
        const savedCustomTools = await getSetting<CustomTool[]>('customProductivityTools', []);
        if (savedCustomTools.length > 0) {
          setCustomTools(savedCustomTools);
        }

        // Load available tasks from IndexedDB
        const tasks = await loadTasksFromDB();
        setAvailableTasks(tasks.slice(0, 50).map(t => ({ id: t.id, text: t.text || '' })));

        // Load available categories
        const savedCategories = await getSetting<{ id: string; name: string }[]>('categories', []);
        setAvailableCategories(savedCategories);
        
        // Load auto-reminder times
        const savedReminderTimes = await getSetting<{ morning: number; afternoon: number; evening: number } | null>('autoReminderTimes', null);
        if (savedReminderTimes) {
          setMorningReminderHour(savedReminderTimes.morning || 9);
          setAfternoonReminderHour(savedReminderTimes.afternoon || 14);
          setEveningReminderHour(savedReminderTimes.evening || 19);
        }
      } catch (error) {
        console.error('Error loading settings data:', error);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    setSetting('productivityToolVisibility', toolVisibility);
  }, [toolVisibility]);

  useEffect(() => {
    setSetting('customProductivityTools', customTools);
  }, [customTools]);

  const toggleToolVisibility = (toolId: string) => {
    setToolVisibility(prev => ({ ...prev, [toolId]: !prev[toolId] }));
  };

  const handleAddCustomTool = () => {
    if (!newToolName.trim()) {
      toast({ title: t('settings.enterToolName'), variant: 'destructive' });
      return;
    }

    const newTool: CustomTool = {
      id: editingTool?.id || Date.now().toString(),
      name: newToolName,
      description: newToolDescription || t('settings.customProductivityTool'),
      icon: newToolIcon,
      color: newToolColor,
      enabled: true,
      linkedTaskIds: newToolLinkedTaskIds.length > 0 ? newToolLinkedTaskIds : undefined,
      linkedCategoryId: newToolLinkedCategoryId || undefined,
    };

    if (editingTool) {
      setCustomTools(prev => prev.map(t => t.id === editingTool.id ? newTool : t));
      toast({ title: t('settings.toolUpdated') });
    } else {
      setCustomTools(prev => [...prev, newTool]);
      toast({ title: t('settings.toolAdded') });
    }

    resetToolDialog();
  };

  const handleDeleteCustomTool = (toolId: string) => {
    setCustomTools(prev => prev.filter(t => t.id !== toolId));
    toast({ title: t('settings.toolDeleted') });
  };

  const handleEditCustomTool = (tool: CustomTool) => {
    setEditingTool(tool);
    setNewToolName(tool.name);
    setNewToolDescription(tool.description);
    setNewToolIcon(tool.icon);
    setNewToolColor(tool.color);
    setNewToolLinkedTaskIds(tool.linkedTaskIds || []);
    setNewToolLinkedCategoryId(tool.linkedCategoryId || '');
    setShowAddToolDialog(true);
  };

  const toggleCustomToolEnabled = (toolId: string) => {
    setCustomTools(prev => prev.map(t => t.id === toolId ? { ...t, enabled: !t.enabled } : t));
  };

  const resetToolDialog = () => {
    setShowAddToolDialog(false);
    setEditingTool(null);
    setNewToolName('');
    setNewToolDescription('');
    setNewToolIcon('target');
    setNewToolColor('#3b82f6');
    setNewToolLinkedTaskIds([]);
    setNewToolLinkedCategoryId('');
  };

  const getIconComponent = (iconId: string) => {
    const found = TOOL_ICONS.find(i => i.id === iconId);
    return found ? found.icon : Target;
  };

  const handleSaveAutoReminderTimes = async () => {
    const times = {
      morning: morningReminderHour,
      afternoon: afternoonReminderHour,
      evening: eveningReminderHour,
    };
    await setSetting('autoReminderTimes', times);
    setShowAutoReminderDialog(false);
    toast({ title: t('settings.reminderTimesSaved') });
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12:00 AM';
    if (hour === 12) return '12:00 PM';
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };


  const handleBackupData = async () => {
    const tasks = await loadTasksFromDB();
    const folders = await getSetting('todoFolders', []);
    const backup = { 
      todoItems: JSON.stringify(tasks), 
      todoFolders: JSON.stringify(folders), 
      timestamp: new Date().toISOString() 
    };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `npd-todo-backup-${Date.now()}.json`;
    a.click();
    toast({ title: t('settings.dataBackedUp') });
  };

  const handleRestoreData = () => {
    setShowRestoreDialog(true);
  };

  const confirmRestoreData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const backup = JSON.parse(event.target?.result as string);
            if (backup.todoItems) {
              const tasks = JSON.parse(backup.todoItems);
              await saveTasksToDB(tasks);
            }
            if (backup.todoFolders) {
              const folders = JSON.parse(backup.todoFolders);
              await setSetting('todoFolders', folders);
            }
            toast({ title: t('settings.dataRestored') });
            setTimeout(() => window.location.reload(), 1000);
          } catch (error) {
            toast({ title: t('settings.restoreFailed'), variant: "destructive" });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
    setShowRestoreDialog(false);
  };

  const handleDownloadData = async () => {
    const tasks = await loadTasksFromDB();
    const folders = await getSetting('todoFolders', []);
    const allData = {
      todoItems: tasks,
      todoFolders: folders,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `npd-todo-data-${Date.now()}.json`;
    a.click();
    toast({ title: t('settings.dataDownloaded') });
  };

  const handleDeleteData = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteData = async () => {
    const { removeSetting } = await import('@/utils/settingsStorage');
    const { saveTasksToDB } = await import('@/utils/taskStorage');
    await saveTasksToDB([]);
    await removeSetting('todoFolders');
    toast({ title: t('settings.allDataDeleted') });
    setShowDeleteDialog(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleShareApp = () => {
    if (navigator.share) {
      navigator.share({
        title: t('share.appTitle'),
        text: t('share.appDescription'),
        url: window.location.origin
      });
    } else {
      toast({ title: t('settings.shareNotAvailable') });
    }
  };

  const settingsItems = [
    { label: t('settings.backupData'), onClick: handleBackupData },
    { label: t('settings.restoreData'), onClick: handleRestoreData },
    { label: t('settings.downloadData'), onClick: handleDownloadData },
    { label: t('settings.deleteData'), onClick: handleDeleteData },
  ];

  const handleRateAndShare = () => {
    window.open('https://play.google.com/store/apps/details?id=nota.npd.com', '_blank');
  };

  const otherItems = [
    { label: t('settings.shareWithFriends'), onClick: handleRateAndShare },
    { label: t('settings.termsOfService'), onClick: () => setShowTermsDialog(true) },
    { label: t('settings.helpFeedback'), onClick: () => setShowHelpDialog(true) },
    { label: t('settings.privacy'), onClick: () => setShowPrivacyDialog(true) },
    { label: t('settings.rateApp'), onClick: handleRateAndShare },
  ];

  return (
    <TodoLayout title={t('settings.title')}>
      <main className="container mx-auto px-4 py-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Theme Switcher Section */}
          <div className="bg-card border rounded-lg">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">{t('settings.appearance')}</h2>
              </div>
            </div>
            <button
              onClick={() => setShowThemeDialog(true)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full border border-border",
                  themes.find(t => t.id === currentTheme)?.preview
                )} />
                <span className="text-foreground text-sm">
                  {themes.find(t => t.id === currentTheme)?.name || 'Light Mode'}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Integrations & Import Section */}
          <div className="bg-card border rounded-lg">
            <button
              onClick={() => navigate('/settings/sync')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5 text-emerald-500" />
                <span className="text-foreground text-sm font-medium">{t('settings.integrationsImport')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>


          <div className="bg-card border rounded-lg">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">{t('settings.autoReminderSettings')}</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings.autoReminderNote')}
              </p>
            </div>
            <button
              onClick={() => setShowAutoReminderDialog(true)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="text-foreground text-sm">{t('settings.reminderTimes')}</span>
                <span className="text-xs text-muted-foreground">
                  {formatHour(morningReminderHour)}, {formatHour(afternoonReminderHour)}, {formatHour(eveningReminderHour)}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="bg-card border rounded-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">{t('settings.productivityTools')}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManageTools(!showManageTools)}
                  className="text-xs"
                >
                  {showManageTools ? t('settings.done') : t('settings.manage')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAddToolDialog(true)}
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border">
              {toolVisibility.eisenhower && (
                <div className="flex items-center">
                  <button
                    onClick={() => !showManageTools && setShowEisenhower(true)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="p-2 bg-red-100 dark:bg-red-950 rounded-lg">
                      <Grid3X3 className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{t('settings.eisenhowerMatrix')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.eisenhowerDesc')}</p>
                    </div>
                    {!showManageTools && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showManageTools && (
                    <button onClick={() => toggleToolVisibility('eisenhower')} className="p-3">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {toolVisibility.pomodoro && (
                <div className="flex items-center">
                  <button
                    onClick={() => !showManageTools && setShowPomodoro(true)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-lg">
                      <Timer className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{t('settings.pomodoroTimer')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.pomodoroDesc')}</p>
                    </div>
                    {!showManageTools && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showManageTools && (
                    <button onClick={() => toggleToolVisibility('pomodoro')} className="p-3">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {toolVisibility.countdown && (
                <div className="flex items-center">
                  <button
                    onClick={() => !showManageTools && setShowCountdown(true)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{t('settings.countdownTimer')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.countdownDesc')}</p>
                    </div>
                    {!showManageTools && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showManageTools && (
                    <button onClick={() => toggleToolVisibility('countdown')} className="p-3">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {toolVisibility.focusMode && (
                <div className="flex items-center">
                  <button
                    onClick={() => !showManageTools && setShowFocusMode(true)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="p-2 bg-purple-100 dark:bg-purple-950 rounded-lg">
                      <Focus className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{t('settings.focusMode')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.focusModeDesc')}</p>
                    </div>
                    {!showManageTools && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showManageTools && (
                    <button onClick={() => toggleToolVisibility('focusMode')} className="p-3">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {toolVisibility.dailyPlanner && (
                <div className="flex items-center">
                  <button
                    onClick={() => !showManageTools && setShowDailyPlanner(true)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
                      <CalendarDays className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{t('settings.dailyPlanner')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.dailyPlannerDesc')}</p>
                    </div>
                    {!showManageTools && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showManageTools && (
                    <button onClick={() => toggleToolVisibility('dailyPlanner')} className="p-3">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {toolVisibility.weeklyReview && (
                <div className="flex items-center">
                  <button
                    onClick={() => !showManageTools && setShowWeeklyReview(true)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-950 rounded-lg">
                      <CalendarRange className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{t('settings.weeklyReview')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.weeklyReviewDesc')}</p>
                    </div>
                    {!showManageTools && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showManageTools && (
                    <button onClick={() => toggleToolVisibility('weeklyReview')} className="p-3">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {toolVisibility.analytics && (
                <div className="flex items-center">
                  <button
                    onClick={() => !showManageTools && setShowAnalytics(true)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-950 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-cyan-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{t('settings.taskAnalytics')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.taskAnalyticsDesc')}</p>
                    </div>
                    {!showManageTools && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showManageTools && (
                    <button onClick={() => toggleToolVisibility('analytics')} className="p-3">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {/* Custom Tools */}
              {customTools.filter(t => t.enabled).map((tool) => {
                const IconComponent = getIconComponent(tool.icon);
                return (
                  <div key={tool.id} className="flex items-center">
                    <button
                      onClick={() => !showManageTools && navigate(`/todo/tool/${tool.id}`)}
                      className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${tool.color}20` }}>
                        <IconComponent className="h-5 w-5" style={{ color: tool.color }} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">{tool.name}</p>
                        <p className="text-xs text-muted-foreground">{tool.description}</p>
                      </div>
                      {!showManageTools && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {showManageTools && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEditCustomTool(tool)} className="p-2">
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDeleteCustomTool(tool.id)} className="p-2">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Show hidden tools in manage mode */}
              {showManageTools && (
                <>
                  {!toolVisibility.eisenhower && (
                    <div className="flex items-center opacity-50">
                      <div className="flex-1 flex items-center gap-3 px-4 py-3">
                        <div className="p-2 bg-red-100 dark:bg-red-950 rounded-lg">
                          <Grid3X3 className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{t('settings.eisenhowerMatrix')}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleToolVisibility('eisenhower')} className="p-3">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  {!toolVisibility.pomodoro && (
                    <div className="flex items-center opacity-50">
                      <div className="flex-1 flex items-center gap-3 px-4 py-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-lg">
                          <Timer className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{t('settings.pomodoroTimer')}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleToolVisibility('pomodoro')} className="p-3">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  {!toolVisibility.countdown && (
                    <div className="flex items-center opacity-50">
                      <div className="flex-1 flex items-center gap-3 px-4 py-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
                          <Clock className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{t('settings.countdownTimer')}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleToolVisibility('countdown')} className="p-3">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  {!toolVisibility.focusMode && (
                    <div className="flex items-center opacity-50">
                      <div className="flex-1 flex items-center gap-3 px-4 py-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-950 rounded-lg">
                          <Focus className="h-5 w-5 text-purple-500" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{t('settings.focusMode')}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleToolVisibility('focusMode')} className="p-3">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  {!toolVisibility.dailyPlanner && (
                    <div className="flex items-center opacity-50">
                      <div className="flex-1 flex items-center gap-3 px-4 py-3">
                        <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
                          <CalendarDays className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{t('settings.dailyPlanner')}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleToolVisibility('dailyPlanner')} className="p-3">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  {!toolVisibility.weeklyReview && (
                    <div className="flex items-center opacity-50">
                      <div className="flex-1 flex items-center gap-3 px-4 py-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-950 rounded-lg">
                          <CalendarRange className="h-5 w-5 text-indigo-500" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{t('settings.weeklyReview')}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleToolVisibility('weeklyReview')} className="p-3">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  {!toolVisibility.analytics && (
                    <div className="flex items-center opacity-50">
                      <div className="flex-1 flex items-center gap-3 px-4 py-3">
                        <div className="p-2 bg-cyan-100 dark:bg-cyan-950 rounded-lg">
                          <BarChart3 className="h-5 w-5 text-cyan-500" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{t('settings.taskAnalytics')}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleToolVisibility('analytics')} className="p-3">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>


          {/* Settings Items */}
          <div className="space-y-1">
            {settingsItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/50 transition-colors"
              >
                <span className="text-foreground text-sm">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}

            <div className="flex items-center gap-2 px-4 py-3">
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground text-sm font-medium">{t('settings.other')}</span>
            </div>

            {otherItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/50 transition-colors"
              >
                <span className="text-foreground text-sm">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.deleteTodoTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-destructive">⚠️ {t('dialogs.deleteTodoWarning')}</p>
              <p>{t('dialogs.deleteTodoDesc')}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('dialogs.deleteTodoTasks')}</li>
                <li>{t('dialogs.deleteTodoFolders')}</li>
                <li>{t('dialogs.deleteTodoData')}</li>
              </ul>
              <p className="font-medium mt-2">{t('dialogs.deleteTodoConfirm')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteData} className="bg-destructive hover:bg-destructive/90">
              {t('dialogs.deleteEverything')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-Reminder Times Dialog */}
      <Dialog open={showAutoReminderDialog} onOpenChange={setShowAutoReminderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('dialogs.autoReminderTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('dialogs.morning')}</span>
              <select
                value={morningReminderHour}
                onChange={(e) => setMorningReminderHour(parseInt(e.target.value))}
                className="bg-background border rounded px-3 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 5).map((hour) => (
                  <option key={hour} value={hour}>{formatHour(hour)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('dialogs.afternoon')}</span>
              <select
                value={afternoonReminderHour}
                onChange={(e) => setAfternoonReminderHour(parseInt(e.target.value))}
                className="bg-background border rounded px-3 py-2 text-sm"
              >
                {Array.from({ length: 6 }, (_, i) => i + 12).map((hour) => (
                  <option key={hour} value={hour}>{formatHour(hour)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('dialogs.evening')}</span>
              <select
                value={eveningReminderHour}
                onChange={(e) => setEveningReminderHour(parseInt(e.target.value))}
                className="bg-background border rounded px-3 py-2 text-sm"
              >
                {Array.from({ length: 6 }, (_, i) => i + 18).map((hour) => (
                  <option key={hour} value={hour}>{formatHour(hour)}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={handleSaveAutoReminderTimes} className="w-full">
            {t('common.save')}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.restoreTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-orange-600">⚠️ {t('dialogs.restoreNotice')}</p>
              <p>{t('dialogs.restoreDesc')}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('dialogs.restoreTodoReplace')}</li>
                <li>{t('dialogs.restoreOverwrite')}</li>
                <li>{t('dialogs.restoreReload')}</li>
              </ul>
              <p className="font-medium mt-2">{t('dialogs.restoreBackup')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestoreData}>
              {t('dialogs.continueRestore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terms of Service Dialog */}
      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Terms of Service</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
                <p className="text-muted-foreground">By accessing and using NPD, you accept and agree to be bound by the terms and provision of this agreement.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. Use License</h3>
                <p className="text-muted-foreground">Permission is granted to temporarily use NPD for personal, non-commercial transitory viewing only.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. User Data</h3>
                <p className="text-muted-foreground">All tasks and data are stored locally on your device. You are responsible for backing up your data regularly.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. Disclaimer</h3>
                <p className="text-muted-foreground">The app is provided "as is" without warranty of any kind. We do not guarantee that the app will be error-free or uninterrupted.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Limitations</h3>
                <p className="text-muted-foreground">In no event shall NPD or its suppliers be liable for any damages arising out of the use or inability to use the app.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. Modifications</h3>
                <p className="text-muted-foreground">We may revise these terms at any time without notice. By using this app, you agree to be bound by the current version of these terms.</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">1. Information We Collect</h3>
                <p className="text-muted-foreground">NPD stores all your tasks and data locally on your device. We do not collect, transmit, or store any personal information on external servers.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. Local Storage</h3>
                <p className="text-muted-foreground">Your tasks, folders, and settings are stored using your device's local storage. This data remains on your device and is not accessible to us.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. Data Security</h3>
                <p className="text-muted-foreground">Since all data is stored locally, the security of your information depends on your device's security measures. We recommend using device encryption and strong passwords.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. Third-Party Services</h3>
                <p className="text-muted-foreground">We do not use any third-party analytics or tracking services. Your data is completely private and stays on your device.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Data Backup</h3>
                <p className="text-muted-foreground">You can backup your data using the backup feature. Backup files are stored on your device and you control where they are kept.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. Changes to Privacy Policy</h3>
                <p className="text-muted-foreground">We may update this privacy policy from time to time. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Help and Feedback Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Help & Feedback</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">Getting Started</h3>
                <p className="text-muted-foreground">Create your first task by tapping the "Add Task" button. Set priorities, due dates, and reminders to stay organized.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Organizing Tasks</h3>
                <p className="text-muted-foreground">Use folders and categories to organize your tasks. Add subtasks to break down larger projects into manageable steps.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Backup & Restore</h3>
                <p className="text-muted-foreground">Regularly backup your data using the "Back up data" option. Keep your backup files in a safe location like cloud storage.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Common Issues</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Tasks not saving? Check your device storage space.</li>
                  <li>App running slow? Try completing or archiving old tasks.</li>
                  <li>Lost data? Restore from your latest backup file.</li>
                </ul>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Contact Support</h3>
                <p className="text-muted-foreground">For additional help or to report issues, please contact us through the app store review section or reach out via our support channels.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Feedback</h3>
                <p className="text-muted-foreground">We value your feedback! Let us know how we can improve NPD by rating the app and leaving a review.</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Productivity Tools - Only render when open to prevent crashes */}
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          {showEisenhower && <EisenhowerMatrix isOpen={showEisenhower} onClose={() => setShowEisenhower(false)} />}
          {showPomodoro && <PomodoroTimer isOpen={showPomodoro} onClose={() => setShowPomodoro(false)} />}
          {showCountdown && <CountdownTimer isOpen={showCountdown} onClose={() => setShowCountdown(false)} />}
          {showAnalytics && <TaskAnalytics isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} />}
          {showFocusMode && <FocusMode isOpen={showFocusMode} onClose={() => setShowFocusMode(false)} />}
          {showDailyPlanner && <DailyPlanner isOpen={showDailyPlanner} onClose={() => setShowDailyPlanner(false)} />}
          {showWeeklyReview && <WeeklyReview isOpen={showWeeklyReview} onClose={() => setShowWeeklyReview(false)} />}
        </Suspense>
      </ErrorBoundary>

      {/* Add/Edit Custom Tool Dialog */}
      <Dialog open={showAddToolDialog} onOpenChange={(open) => { if (!open) resetToolDialog(); else setShowAddToolDialog(true); }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTool ? t('customTool.editTitle') : t('customTool.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('customTool.name')}</Label>
              <Input value={newToolName} onChange={(e) => setNewToolName(e.target.value)} placeholder={t('customTool.namePlaceholder')} />
            </div>
            <div>
              <Label>{t('customTool.description')}</Label>
              <Input value={newToolDescription} onChange={(e) => setNewToolDescription(e.target.value)} placeholder={t('customTool.descriptionPlaceholder')} />
            </div>
            <div>
              <Label>{t('customTool.icon')}</Label>
              <div className="flex gap-2 mt-1">
                {TOOL_ICONS.map(({ id, icon: Icon }) => (
                  <button key={id} onClick={() => setNewToolIcon(id)} className={cn("p-2 rounded-lg border", newToolIcon === id && "border-primary bg-primary/10")}>
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t('customTool.color')}</Label>
              <div className="flex gap-2 mt-1">
                {TOOL_COLORS.map((color) => (
                  <button key={color} onClick={() => setNewToolColor(color)} className={cn("w-7 h-7 rounded-full border-2", newToolColor === color ? "border-foreground" : "border-transparent")} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
            
            {/* Link to Category */}
            {availableCategories.length > 0 && (
              <div>
                <Label>{t('customTool.linkToCategory')}</Label>
                <select
                  value={newToolLinkedCategoryId}
                  onChange={(e) => setNewToolLinkedCategoryId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                >
                  <option value="">{t('common.none')}</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Link to Tasks */}
            {availableTasks.length > 0 && (
              <div>
                <Label>{t('customTool.linkToTasks')}</Label>
                <ScrollArea className="h-32 border rounded-md mt-1 p-2">
                  <div className="space-y-1">
                    {availableTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`task-${task.id}`}
                          checked={newToolLinkedTaskIds.includes(task.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewToolLinkedTaskIds(prev => [...prev, task.id]);
                            } else {
                              setNewToolLinkedTaskIds(prev => prev.filter(id => id !== task.id));
                            }
                          }}
                        />
                        <label htmlFor={`task-${task.id}`} className="text-sm truncate flex-1 cursor-pointer">
                          {task.text}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {newToolLinkedTaskIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{t('customTool.tasksLinked', { count: newToolLinkedTaskIds.length })}</p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={resetToolDialog} className="flex-1">{t('common.cancel')}</Button>
              <Button onClick={handleAddCustomTool} className="flex-1">{editingTool ? t('common.update') : t('common.add')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Theme Selector Dialog */}
      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Theme</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-2 gap-3">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id);
                    toast({ title: `Theme changed to ${theme.name}` });
                    setShowThemeDialog(false);
                  }}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all hover:scale-[1.02]",
                    currentTheme === theme.id ? "border-primary" : "border-transparent"
                  )}
                >
                  <div className={cn(
                    "w-full aspect-square rounded-lg mb-2",
                    theme.preview
                  )} />
                  <p className="text-sm font-medium text-center">{theme.name}</p>
                  {currentTheme === theme.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </TodoLayout>
  );
};

export default TodoSettings;

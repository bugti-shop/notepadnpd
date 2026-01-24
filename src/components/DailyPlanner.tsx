import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  X, CalendarDays, Plus, Clock, ChevronLeft, ChevronRight,
  Sun, Sunrise, Sunset, Moon, Target, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TodoItem } from '@/types/note';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from 'sonner';
import { loadTasksFromDB, updateTaskInDB } from '@/utils/taskStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';

interface DailyPlannerProps {
  isOpen: boolean;
  onClose: () => void;
}

type TimeBlock = 'morning' | 'afternoon' | 'evening' | 'night';

interface PlannedTask {
  taskId: string;
  timeBlock: TimeBlock;
  scheduledTime?: string;
}

interface DailyPlan {
  date: string;
  plannedTasks: PlannedTask[];
  dailyGoal?: string;
  reflection?: string;
}

const getTimeBlockConfig = (t: (key: string) => string) => ({
  morning: { icon: Sunrise, label: t('productivity.dailyPlanner.morning'), time: t('productivity.dailyPlanner.morningTime'), color: 'text-yellow-500' },
  afternoon: { icon: Sun, label: t('productivity.dailyPlanner.afternoon'), time: t('productivity.dailyPlanner.afternoonTime'), color: 'text-orange-500' },
  evening: { icon: Sunset, label: t('productivity.dailyPlanner.evening'), time: t('productivity.dailyPlanner.eveningTime'), color: 'text-purple-500' },
  night: { icon: Moon, label: t('productivity.dailyPlanner.night'), time: t('productivity.dailyPlanner.nightTime'), color: 'text-blue-500' },
});

export const DailyPlanner = ({ isOpen, onClose }: DailyPlannerProps) => {
  const { t } = useTranslation();
  const timeBlockConfig = getTimeBlockConfig(t);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [dailyGoal, setDailyGoal] = useState('');
  const [showTaskPicker, setShowTaskPicker] = useState<TimeBlock | null>(null);

  useEffect(() => {
    loadTasks();
    loadDailyPlan();
  }, [isOpen, selectedDate]);

  const loadTasks = async () => {
    const allTasks = await loadTasksFromDB();
    setTasks(allTasks.filter(t => !t.completed));
  };

  const loadDailyPlan = async () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const plans = await getSetting<DailyPlan[]>('dailyPlans', []);
    const plan = plans.find(p => p.date === dateStr);
    if (plan) {
      setDailyPlan(plan);
      setDailyGoal(plan.dailyGoal || '');
      return;
    }
    setDailyPlan({ date: dateStr, plannedTasks: [] });
    setDailyGoal('');
  };

  const saveDailyPlan = async (plan: DailyPlan) => {
    const plans = await getSetting<DailyPlan[]>('dailyPlans', []);
    const existingIdx = plans.findIndex(p => p.date === plan.date);
    if (existingIdx >= 0) {
      plans[existingIdx] = plan;
    } else {
      plans.push(plan);
    }
    await setSetting('dailyPlans', plans);
    setDailyPlan(plan);
  };

  const handleAddTask = async (taskId: string, timeBlock: TimeBlock) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}

    if (!dailyPlan) return;
    
    const newPlan: DailyPlan = {
      ...dailyPlan,
      plannedTasks: [...dailyPlan.plannedTasks, { taskId, timeBlock }]
    };
    saveDailyPlan(newPlan);
    setShowTaskPicker(null);
    toast.success(t('productivity.dailyPlanner.taskAddedToPlan'));
  };

  const handleRemoveTask = async (taskId: string) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}

    if (!dailyPlan) return;
    
    const newPlan: DailyPlan = {
      ...dailyPlan,
      plannedTasks: dailyPlan.plannedTasks.filter(pt => pt.taskId !== taskId)
    };
    saveDailyPlan(newPlan);
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}

    await updateTaskInDB(taskId, { completed: true });
    window.dispatchEvent(new Event('tasksUpdated'));

    handleRemoveTask(taskId);
    loadTasks();
    toast.success(t('toasts.taskCompleted'));
  };

  const handleSaveGoal = () => {
    if (!dailyPlan) return;
    const newPlan: DailyPlan = { ...dailyPlan, dailyGoal };
    saveDailyPlan(newPlan);
    toast.success(t('toasts.saved'));
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const dateLabel = isToday ? t('common.today') : selectedDate.toLocaleDateString(undefined, { 
    weekday: 'short', month: 'short', day: 'numeric' 
  });

  const getTasksForBlock = (block: TimeBlock) => {
    if (!dailyPlan) return [];
    return dailyPlan.plannedTasks
      .filter(pt => pt.timeBlock === block)
      .map(pt => tasks.find(t => t.id === pt.taskId))
      .filter(Boolean) as TodoItem[];
  };

  const unplannedTasks = tasks.filter(t => 
    !dailyPlan?.plannedTasks.some(pt => pt.taskId === t.id)
  );

  const totalPlanned = dailyPlan?.plannedTasks.length || 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">{t('productivity.dailyPlanner.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('productivity.dailyPlanner.subtitle')}</p>
          </div>
        </div>
      </header>

      {/* Date Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button
          onClick={() => navigateDate('prev')}
          className="p-2 hover:bg-muted rounded-lg"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className={cn("font-semibold", isToday && "text-primary")}>{dateLabel}</p>
          <p className="text-xs text-muted-foreground">{t('productivity.dailyPlanner.tasksPlanned', { count: totalPlanned })}</p>
        </div>
        <button
          onClick={() => navigateDate('next')}
          className="p-2 hover:bg-muted rounded-lg"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Daily Goal */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('productivity.dailyPlanner.todaysGoal')}</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={dailyGoal}
                onChange={(e) => setDailyGoal(e.target.value)}
                placeholder={t('productivity.dailyPlanner.goalPlaceholder')}
                className="flex-1"
              />
              <Button size="sm" onClick={handleSaveGoal} variant="outline">
                {t('common.save')}
              </Button>
            </div>
          </div>

          {/* Time Blocks */}
          {(Object.keys(timeBlockConfig) as TimeBlock[]).map((block) => {
            const config = timeBlockConfig[block];
            const Icon = config.icon;
            const blockTasks = getTasksForBlock(block);

            return (
              <div key={block} className="bg-card border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg bg-muted", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{config.label}</p>
                      <p className="text-xs text-muted-foreground">{config.time}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTaskPicker(block)}
                    className="p-2 hover:bg-muted rounded-lg"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-2">
                  {blockTasks.length > 0 ? (
                    <div className="space-y-1">
                      {blockTasks.map((task) => (
                        <div 
                          key={task.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group"
                        >
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="w-5 h-5 rounded border-2 border-muted-foreground/50 hover:border-green-500 hover:bg-green-500/10 flex items-center justify-center transition-colors"
                          >
                            <CheckCircle2 className="h-3 w-3 text-transparent group-hover:text-green-500" />
                          </button>
                          <span className="flex-1 text-sm">{task.text}</span>
                          <button
                            onClick={() => handleRemoveTask(task.id)}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded"
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('productivity.dailyPlanner.noTasksPlanned')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Task Picker Modal */}
      {showTaskPicker && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-md max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">{t('productivity.dailyPlanner.addTaskTo', { block: timeBlockConfig[showTaskPicker].label })}</h3>
              <button 
                onClick={() => setShowTaskPicker(null)}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="flex-1 p-4">
              {unplannedTasks.length > 0 ? (
                <div className="space-y-2">
                  {unplannedTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleAddTask(task.id, showTaskPicker)}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted/50 border border-border transition-colors"
                    >
                      <p className="text-sm font-medium line-clamp-1">{task.text}</p>
                      {task.dueDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t('productivity.dailyPlanner.noUnplannedTasks')}</p>
                  <p className="text-xs mt-1">{t('productivity.dailyPlanner.allTasksAssigned')}</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyPlanner;

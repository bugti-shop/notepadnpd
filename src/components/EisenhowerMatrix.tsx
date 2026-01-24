import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem, Priority } from '@/types/note';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from 'sonner';
import { loadTasksFromDB, saveTasksToDB } from '@/utils/taskStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';

interface MatrixTask {
  id: string;
  text: string;
  completed: boolean;
  quadrant: 'do' | 'schedule' | 'delegate' | 'eliminate';
}

interface EisenhowerMatrixProps {
  isOpen: boolean;
  onClose: () => void;
  onConvertToTask?: (task: MatrixTask) => void;
}

const quadrantInfo = {
  do: {
    title: 'Do First',
    subtitle: 'Urgent & Important',
    color: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-900',
    textColor: 'text-red-700 dark:text-red-300',
    priority: 'high' as Priority,
  },
  schedule: {
    title: 'Schedule',
    subtitle: 'Important, Not Urgent',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-900',
    textColor: 'text-blue-700 dark:text-blue-300',
    priority: 'medium' as Priority,
  },
  delegate: {
    title: 'Delegate',
    subtitle: 'Urgent, Not Important',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-900',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    priority: 'low' as Priority,
  },
  eliminate: {
    title: 'Eliminate',
    subtitle: 'Not Urgent, Not Important',
    color: 'bg-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-950/30',
    borderColor: 'border-gray-200 dark:border-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    priority: 'none' as Priority,
  },
};

export const EisenhowerMatrix = ({ isOpen, onClose, onConvertToTask }: EisenhowerMatrixProps) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<MatrixTask[]>([]);
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({
    do: '',
    schedule: '',
    delegate: '',
    eliminate: '',
  });

  useEffect(() => {
    getSetting<MatrixTask[]>('eisenhowerTasks', []).then(setTasks);
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      setSetting('eisenhowerTasks', tasks);
    }
  }, [tasks]);

  const addTask = async (quadrant: MatrixTask['quadrant']) => {
    const text = newTaskInputs[quadrant].trim();
    if (!text) return;

    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}

    const newTask: MatrixTask = {
      id: Date.now().toString(),
      text,
      completed: false,
      quadrant,
    };

    setTasks(prev => [...prev, newTask]);
    setNewTaskInputs(prev => ({ ...prev, [quadrant]: '' }));
  };

  const toggleTask = async (taskId: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = async (taskId: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const moveTask = async (taskId: string, newQuadrant: MatrixTask['quadrant']) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, quadrant: newQuadrant } : t));
  };

  const convertToMainTask = async (task: MatrixTask) => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    
    if (onConvertToTask) {
      onConvertToTask(task);
    } else {
      // Add directly to IndexedDB
      const existingTasks = await loadTasksFromDB();
      const newTodoItem: TodoItem = {
        id: `task-${Date.now()}`,
        text: task.text,
        completed: task.completed,
        priority: quadrantInfo[task.quadrant].priority,
      };
      await saveTasksToDB([...existingTasks, newTodoItem]);
      window.dispatchEvent(new Event('tasksUpdated'));
    }
    
    // Remove from matrix
    setTasks(prev => prev.filter(t => t.id !== task.id));
    toast.success(t('productivity.eisenhower.taskAddedToList'));
  };

  const clearCompleted = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    setTasks(prev => prev.filter(t => !t.completed));
    toast.success(t('productivity.eisenhower.clearedCompleted'));
  };

  const getTasksByQuadrant = (quadrant: MatrixTask['quadrant']) => 
    tasks.filter(t => t.quadrant === quadrant);

  const getQuadrantLabels = (quadrant: MatrixTask['quadrant']) => {
    const labels = {
      do: { title: t('productivity.eisenhower.doFirst'), subtitle: t('productivity.eisenhower.doFirstDesc') },
      schedule: { title: t('productivity.eisenhower.schedule'), subtitle: t('productivity.eisenhower.scheduleDesc') },
      delegate: { title: t('productivity.eisenhower.delegate'), subtitle: t('productivity.eisenhower.delegateDesc') },
      eliminate: { title: t('productivity.eisenhower.eliminate'), subtitle: t('productivity.eisenhower.eliminateDesc') },
    };
    return labels[quadrant];
  };

  const renderQuadrant = (quadrant: MatrixTask['quadrant']) => {
    const info = quadrantInfo[quadrant];
    const labels = getQuadrantLabels(quadrant);
    const quadrantTasks = getTasksByQuadrant(quadrant);
    const completedCount = quadrantTasks.filter(t => t.completed).length;

    return (
      <div className={cn("flex flex-col rounded-xl border overflow-hidden", info.borderColor)}>
        <div className={cn("px-3 py-2", info.bgColor)}>
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", info.color)} />
            <div className="flex-1">
              <h4 className={cn("text-sm font-semibold", info.textColor)}>{labels.title}</h4>
              <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{quadrantTasks.length}
            </span>
          </div>
        </div>

        <div className="flex-1 p-2 space-y-1 bg-background min-h-[120px]">
          <ScrollArea className="h-[100px]">
            {quadrantTasks.map(task => (
              <div 
                key={task.id}
                className="flex items-start gap-2 py-1.5 px-1 group hover:bg-muted/50 rounded"
              >
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => toggleTask(task.id)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className={cn(
                  "flex-1 text-xs",
                  task.completed && "line-through text-muted-foreground"
                )}>
                  {task.text}
                </span>
                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                  <button 
                    onClick={() => convertToMainTask(task)}
                    className="p-1 hover:bg-primary/10 rounded text-primary"
                    title={t('productivity.eisenhower.convertToTask')}
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="p-1 hover:bg-destructive/10 rounded text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        <div className="p-2 border-t border-border/50">
          <div className="flex gap-1">
            <Input
              value={newTaskInputs[quadrant]}
              onChange={(e) => setNewTaskInputs(prev => ({ ...prev, [quadrant]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && addTask(quadrant)}
              placeholder={t('productivity.eisenhower.addTask')}
              className="h-7 text-xs"
            />
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-7 w-7"
              onClick={() => addTask(quadrant)}
              disabled={!newTaskInputs[quadrant].trim()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const totalCompleted = tasks.filter(t => t.completed).length;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">{t('productivity.eisenhower.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('productivity.eisenhower.subtitle')}</p>
          </div>
        </div>
        {totalCompleted > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCompleted}>
            {t('productivity.eisenhower.clearDone')} ({totalCompleted})
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          {/* Matrix Labels */}
          <div className="grid grid-cols-3 gap-2 mb-2 text-center">
            <div />
            <div className="text-xs font-semibold text-muted-foreground">{t('productivity.eisenhower.urgent')}</div>
            <div className="text-xs font-semibold text-muted-foreground">{t('productivity.eisenhower.notUrgent')}</div>
          </div>

          <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
            {/* Important Row */}
            <div className="flex items-center justify-center">
              <span className="text-xs font-semibold text-muted-foreground transform -rotate-90 whitespace-nowrap">
                {t('productivity.eisenhower.important')}
              </span>
            </div>
            {renderQuadrant('do')}
            {renderQuadrant('schedule')}

            {/* Not Important Row */}
            <div className="flex items-center justify-center">
              <span className="text-xs font-semibold text-muted-foreground transform -rotate-90 whitespace-nowrap">
                {t('productivity.eisenhower.notImportant')}
              </span>
            </div>
            {renderQuadrant('delegate')}
            {renderQuadrant('eliminate')}
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">{t('productivity.eisenhower.quickTips')}</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• <strong>{t('productivity.eisenhower.doFirst')}:</strong> {t('productivity.eisenhower.tipDoFirst')}</li>
              <li>• <strong>{t('productivity.eisenhower.schedule')}:</strong> {t('productivity.eisenhower.tipSchedule')}</li>
              <li>• <strong>{t('productivity.eisenhower.delegate')}:</strong> {t('productivity.eisenhower.tipDelegate')}</li>
              <li>• <strong>{t('productivity.eisenhower.eliminate')}:</strong> {t('productivity.eisenhower.tipEliminate')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EisenhowerMatrix;

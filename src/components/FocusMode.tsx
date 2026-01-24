import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  X, Focus, ChevronLeft, ChevronRight, CheckCircle2, 
  Clock, Target, Zap, Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TodoItem } from '@/types/note';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from 'sonner';
import { loadTasksFromDB, updateTaskInDB } from '@/utils/taskStorage';

interface FocusModeProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FocusMode = ({ isOpen, onClose }: FocusModeProps) => {
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedInSession, setCompletedInSession] = useState(0);
  const [sessionStartTime] = useState(new Date());
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    const loadTasks = async () => {
      const allTasks = await loadTasksFromDB();
      const uncompletedTasks = allTasks.filter(t => !t.completed);
      // Sort by priority
      const sorted = uncompletedTasks.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 };
        return (priorityOrder[a.priority || 'none'] || 3) - (priorityOrder[b.priority || 'none'] || 3);
      });
      setTasks(sorted);
    };
    loadTasks();
  }, [isOpen]);

  const currentTask = tasks[currentIndex];
  const progress = tasks.length > 0 ? ((currentIndex + 1) / tasks.length) * 100 : 0;

  const handleComplete = async () => {
    if (!currentTask || isCompleting) return;
    setIsCompleting(true);
    
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}

    // Update task in IndexedDB
    await updateTaskInDB(currentTask.id, { completed: true });
    window.dispatchEvent(new Event('tasksUpdated'));

    setCompletedInSession(prev => prev + 1);
    
    // Remove from current list and move to next
    const newTasks = tasks.filter(t => t.id !== currentTask.id);
    setTasks(newTasks);
    
    if (newTasks.length === 0) {
      toast.success('🎉 All tasks completed!');
    } else if (currentIndex >= newTasks.length) {
      setCurrentIndex(newTasks.length - 1);
    }
    
    setTimeout(() => setIsCompleting(false), 300);
  };

  const handleSkip = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    
    if (currentIndex < tasks.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const getSessionDuration = () => {
    const now = new Date();
    const diff = now.getTime() - sessionStartTime.getTime();
    const minutes = Math.floor(diff / 60000);
    return minutes;
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-green-500 bg-green-500/10 border-green-500/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">Focus Mode</h2>
            <p className="text-xs text-muted-foreground">One task at a time</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{getSessionDuration()}m</span>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col">
        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <Trophy className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">All Done!</h3>
            <p className="text-muted-foreground mb-4">
              You completed {completedInSession} task{completedInSession !== 1 ? 's' : ''} in this session!
            </p>
            <Button onClick={onClose}>
              Exit Focus Mode
            </Button>
          </div>
        ) : (
          <>
            {/* Session Stats */}
            <div className="flex items-center justify-center gap-6 py-4 border-b border-border/50">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{completedInSession}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold">{tasks.length}</p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{currentIndex + 1}</p>
                <p className="text-xs text-muted-foreground">Current</p>
              </div>
            </div>

            {/* Current Task */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-md">
                <div 
                  className={cn(
                    "bg-card border rounded-2xl p-6 shadow-lg transition-all duration-300",
                    isCompleting && "scale-95 opacity-50"
                  )}
                >
                  {currentTask.priority && currentTask.priority !== 'none' && (
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded-full text-xs font-medium border mb-3 capitalize",
                      getPriorityColor(currentTask.priority)
                    )}>
                      {currentTask.priority} priority
                    </span>
                  )}
                  
                  <h3 className="text-xl font-semibold mb-4 leading-relaxed">
                    {currentTask.text}
                  </h3>

                  {currentTask.description && (
                    <p className="text-muted-foreground text-sm mb-4">
                      {currentTask.description}
                    </p>
                  )}

                  {currentTask.dueDate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Due: {new Date(currentTask.dueDate).toLocaleDateString()}</span>
                    </div>
                  )}

                  {currentTask.subtasks && currentTask.subtasks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">
                        Subtasks ({currentTask.subtasks.filter(s => s.completed).length}/{currentTask.subtasks.length})
                      </p>
                      <div className="space-y-1">
                        {currentTask.subtasks.slice(0, 3).map((subtask) => (
                          <div key={subtask.id} className="flex items-center gap-2 text-sm">
                            <div className={cn(
                              "w-3 h-3 rounded border",
                              subtask.completed ? "bg-green-500 border-green-500" : "border-muted-foreground"
                            )} />
                            <span className={cn(subtask.completed && "text-muted-foreground line-through")}>
                              {subtask.text}
                            </span>
                          </div>
                        ))}
                        {currentTask.subtasks.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{currentTask.subtasks.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation & Actions */}
            <div className="p-6 border-t border-border space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <Button
                  size="lg"
                  className="h-14 px-8 rounded-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleComplete}
                  disabled={isCompleting}
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Complete Task
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={handleSkip}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Swipe or use arrows to navigate • Focus on one task at a time
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FocusMode;

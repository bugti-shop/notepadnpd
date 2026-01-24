import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, BarChart3, TrendingUp, CheckCircle2, Clock, 
  Calendar, Target, Flame, Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TodoItem } from '@/types/note';

interface TaskAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DailyStats {
  date: string;
  completed: number;
  created: number;
}

interface WeeklyStats {
  weekStart: string;
  completed: number;
  avgCompletionRate: number;
}

export const TaskAnalytics = ({ isOpen, onClose }: TaskAnalyticsProps) => {
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TodoItem[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [thisWeekCompleted, setThisWeekCompleted] = useState(0);
  const [lastWeekCompleted, setLastWeekCompleted] = useState(0);
  const [mostProductiveDay, setMostProductiveDay] = useState<string>('');
  const [avgTasksPerDay, setAvgTasksPerDay] = useState(0);

  useEffect(() => {
    const loadTasks = async () => {
      const { loadTasksFromDB } = await import('@/utils/taskStorage');
      const allTasks = await loadTasksFromDB();
      setTasks(allTasks);
      setCompletedTasks(allTasks.filter(t => t.completed));
      calculateStats(allTasks);
    };
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen]);

  const calculateStats = (allTasks: TodoItem[]) => {
    const completed = allTasks.filter(t => t.completed);
    const now = new Date();
    
    // Daily stats for last 7 days
    const last7Days: DailyStats[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const completedOnDay = completed.filter(t => {
        const taskDate = new Date(t.dueDate || '').toISOString().split('T')[0];
        return taskDate === dateStr;
      }).length;
      
      last7Days.push({ date: dayName, completed: completedOnDay, created: 0 });
    }
    setDailyStats(last7Days);

    // This week vs last week
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeek = completed.filter(t => {
      const d = new Date(t.dueDate || '');
      return d >= weekStart;
    }).length;
    setThisWeekCompleted(thisWeek);

    const lastWeek = completed.filter(t => {
      const d = new Date(t.dueDate || '');
      return d >= lastWeekStart && d < weekStart;
    }).length;
    setLastWeekCompleted(lastWeek);

    // Calculate streaks
    let streak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const hasCompleted = completed.some(t => {
        const taskDate = new Date(t.dueDate || '').toISOString().split('T')[0];
        return taskDate === dateStr;
      });
      
      if (hasCompleted) {
        tempStreak++;
        if (i === 0 || streak > 0) streak = tempStreak;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        if (i === 0) streak = 0;
        tempStreak = 0;
      }
    }
    setCurrentStreak(streak);
    setLongestStreak(maxStreak);

    // Most productive day
    const dayCount: Record<string, number> = {};
    completed.forEach(t => {
      const day = new Date(t.dueDate || '').toLocaleDateString('en-US', { weekday: 'long' });
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    const topDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
    setMostProductiveDay(topDay ? topDay[0] : 'N/A');

    // Average tasks per day
    const activeDays = new Set(completed.map(t => 
      new Date(t.dueDate || '').toISOString().split('T')[0]
    )).size;
    setAvgTasksPerDay(activeDays > 0 ? Math.round((completed.length / activeDays) * 10) / 10 : 0);
  };

  const maxCompleted = Math.max(...dailyStats.map(d => d.completed), 1);
  const weeklyChange = lastWeekCompleted > 0 
    ? Math.round(((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100) 
    : thisWeekCompleted > 0 ? 100 : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">Task Analytics</h2>
            <p className="text-xs text-muted-foreground">Track your productivity</p>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-md mx-auto space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Completed</span>
              </div>
              <p className="text-3xl font-bold text-green-500">{completedTasks.length}</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Current Streak</span>
              </div>
              <p className="text-3xl font-bold text-orange-500">{currentStreak}</p>
              <p className="text-xs text-muted-foreground mt-1">days</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">This Week</span>
              </div>
              <p className="text-3xl font-bold text-blue-500">{thisWeekCompleted}</p>
              <p className={cn("text-xs mt-1", weeklyChange >= 0 ? "text-green-500" : "text-red-500")}>
                {weeklyChange >= 0 ? '+' : ''}{weeklyChange}% vs last week
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Best Streak</span>
              </div>
              <p className="text-3xl font-bold text-purple-500">{longestStreak}</p>
              <p className="text-xs text-muted-foreground mt-1">days</p>
            </div>
          </div>

          {/* Weekly Chart */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">Last 7 Days</h3>
            </div>
            <div className="flex items-end justify-between gap-2 h-32">
              {dailyStats.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-primary/20 rounded-t transition-all duration-500 relative group"
                    style={{ 
                      height: `${(day.completed / maxCompleted) * 100}%`,
                      minHeight: day.completed > 0 ? '8px' : '4px'
                    }}
                  >
                    <div 
                      className="absolute inset-0 bg-primary rounded-t"
                      style={{ opacity: day.completed > 0 ? 1 : 0.3 }}
                    />
                    {day.completed > 0 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium">
                        {day.completed}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{day.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-card border rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">Insights</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Most productive day</span>
                <span className="text-sm font-medium">{mostProductiveDay}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Avg tasks/day</span>
                <span className="text-sm font-medium">{avgTasksPerDay}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Pending tasks</span>
                <span className="text-sm font-medium">{tasks.length - completedTasks.length}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Completion rate</span>
                <span className="text-sm font-medium">
                  {tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Motivational Message */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 text-center">
            {currentStreak >= 7 ? (
              <>
                <p className="text-lg font-semibold">🔥 You're on fire!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentStreak} day streak! Keep the momentum going!
                </p>
              </>
            ) : currentStreak >= 3 ? (
              <>
                <p className="text-lg font-semibold">💪 Great progress!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentStreak} days and counting. You're building a habit!
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">🚀 Let's get started!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete tasks daily to build your streak!
                </p>
              </>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default TaskAnalytics;

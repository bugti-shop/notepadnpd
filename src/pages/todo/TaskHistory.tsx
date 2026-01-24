import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@/types/note';
import { TodoLayout } from './TodoLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  History, 
  CheckCircle2, 
  Repeat, 
  Calendar,
  Clock,
  ChevronRight,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadTodoItems } from '@/utils/todoItemsStorage';
import { getRepeatLabel } from '@/utils/recurringTasks';
import { 
  format, 
  isToday, 
  isYesterday, 
  isThisWeek,
  isThisMonth,
  subDays,
  startOfDay
} from 'date-fns';

type FilterType = 'all' | 'recurring' | 'today' | 'week' | 'month';
type SortType = 'newest' | 'oldest' | 'name';

const TaskHistory = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');

  useEffect(() => {
    const loadData = async () => {
      const loadedItems = await loadTodoItems();
      setItems(loadedItems);
    };
    loadData();

    const handleTasksUpdate = () => loadData();
    window.addEventListener('tasksUpdated', handleTasksUpdate);
    return () => window.removeEventListener('tasksUpdated', handleTasksUpdate);
  }, []);

  const completedTasks = useMemo(() => {
    let filtered = items.filter(t => t.completed);

    // Apply filter
    switch (filter) {
      case 'recurring':
        filtered = filtered.filter(t => t.repeatType && t.repeatType !== 'none');
        break;
      case 'today':
        filtered = filtered.filter(t => t.dueDate && isToday(new Date(t.dueDate)));
        break;
      case 'week':
        filtered = filtered.filter(t => t.dueDate && isThisWeek(new Date(t.dueDate)));
        break;
      case 'month':
        filtered = filtered.filter(t => t.dueDate && isThisMonth(new Date(t.dueDate)));
        break;
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : parseInt(a.id);
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : parseInt(b.id);
          return dateB - dateA;
        case 'oldest':
          const dateA2 = a.dueDate ? new Date(a.dueDate).getTime() : parseInt(a.id);
          const dateB2 = b.dueDate ? new Date(b.dueDate).getTime() : parseInt(b.id);
          return dateA2 - dateB2;
        case 'name':
          return a.text.localeCompare(b.text);
        default:
          return 0;
      }
    });

    return filtered;
  }, [items, filter, sortBy]);

  // Group tasks by date
  const groupedTasks = useMemo(() => {
    const groups: { [key: string]: TodoItem[] } = {};
    
    completedTasks.forEach(task => {
      const date = task.dueDate ? new Date(task.dueDate) : new Date(parseInt(task.id) || Date.now());
      let groupKey: string;
      
      if (isToday(date)) {
        groupKey = 'Today';
      } else if (isYesterday(date)) {
        groupKey = 'Yesterday';
      } else if (isThisWeek(date)) {
        groupKey = 'This Week';
      } else if (isThisMonth(date)) {
        groupKey = 'This Month';
      } else {
        groupKey = format(date, 'MMMM yyyy');
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });

    return groups;
  }, [completedTasks]);

  // Recurring task patterns
  const recurringPatterns = useMemo(() => {
    const patterns: { [key: string]: { count: number; tasks: TodoItem[] } } = {};
    
    items
      .filter(t => t.repeatType && t.repeatType !== 'none')
      .forEach(task => {
        const label = getRepeatLabel(task.repeatType, task.repeatDays, task.advancedRepeat);
        if (!patterns[label]) {
          patterns[label] = { count: 0, tasks: [] };
        }
        patterns[label].count++;
        if (task.completed) {
          patterns[label].tasks.push(task);
        }
      });

    return patterns;
  }, [items]);

  const formatTaskDate = (task: TodoItem): string => {
    const date = task.dueDate ? new Date(task.dueDate) : new Date(parseInt(task.id) || Date.now());
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a');
    return format(date, 'MMM d, h:mm a');
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-500/10';
      case 'medium': return 'text-orange-500 bg-orange-500/10';
      case 'low': return 'text-green-500 bg-green-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <TodoLayout title="Task History">
      <main className="container mx-auto px-4 py-6 pb-32">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="recurring" className="text-xs">Recurring</TabsTrigger>
              <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Sort Options */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{completedTasks.length} {t('taskHistory.completed')}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSortBy(prev => 
                prev === 'newest' ? 'oldest' : prev === 'oldest' ? 'name' : 'newest'
              )}
            >
              <ArrowUpDown className="h-4 w-4 mr-1" />
              {sortBy === 'newest' ? t('taskHistory.newest') : sortBy === 'oldest' ? t('taskHistory.oldest') : t('taskHistory.alphabetical')}
            </Button>
          </div>

          {/* Recurring Patterns Summary */}
          {filter === 'recurring' && Object.keys(recurringPatterns).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-purple-500" />
                  {t('taskHistory.recurringPatterns')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {Object.entries(recurringPatterns).map(([pattern, data]) => (
                    <div key={pattern} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{pattern}</Badge>
                      </div>
                      <div className="text-sm">
                        <span className="text-green-500 font-medium">{data.tasks.length}</span>
                        <span className="text-muted-foreground">/{data.count} {t('taskHistory.completed')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grouped Task List */}
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="space-y-6">
              {Object.entries(groupedTasks).map(([groupName, tasks]) => (
                <div key={groupName}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {groupName}
                    <Badge variant="secondary" className="ml-auto">{tasks.length}</Badge>
                  </h3>
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <Card key={task.id} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium line-through text-muted-foreground">{task.text}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTaskDate(task)}
                                </span>
                                {task.priority && task.priority !== 'none' && (
                                  <Badge className={cn("text-[10px] px-1.5", getPriorityColor(task.priority))}>
                                    {task.priority}
                                  </Badge>
                                )}
                                {task.repeatType && task.repeatType !== 'none' && (
                                  <Badge variant="outline" className="text-[10px] px-1.5">
                                    <Repeat className="h-2.5 w-2.5 mr-1" />
                                    {getRepeatLabel(task.repeatType, task.repeatDays, task.advancedRepeat)}
                                  </Badge>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}

              {completedTasks.length === 0 && (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium text-lg mb-1">No completed tasks</h3>
                  <p className="text-sm text-muted-foreground">
                    {filter === 'all' 
                      ? 'Complete some tasks to see them here'
                      : `No ${filter === 'recurring' ? 'recurring' : filter} tasks completed`
                    }
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </main>
    </TodoLayout>
  );
};

export default TaskHistory;

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem, Priority, LocationReminder } from '@/types/note';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import {
  X,
  Flag,
  Calendar as CalendarIcon,
  Tag,
  MoreHorizontal,
  Trash2,
  Check,
  Plus,
  Bell,
  Clock,
  Repeat,
  Copy,
  MapPin,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { TaskInputSheet } from './TaskInputSheet';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useToast } from '@/hooks/use-toast';
import { getCategoryById } from '@/utils/categories';
import { LocationReminderSheet } from './LocationReminderSheet';
import { LocationMapPreview } from './LocationMapPreview';

interface TaskDetailSheetProps {
  isOpen: boolean;
  task: TodoItem | null;
  onClose: () => void;
  onUpdate: (task: TodoItem) => void;
  onDelete: (taskId: string) => void;
  onDuplicate: (task: TodoItem) => void;
}

export const TaskDetailSheet = ({ isOpen, task, onClose, onUpdate, onDelete, onDuplicate }: TaskDetailSheetProps) => {
  const { t } = useTranslation();
  const [description, setDescription] = useState(task?.description || '');
  const [isSubtaskInputOpen, setIsSubtaskInputOpen] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showLocationReminder, setShowLocationReminder] = useState(false);
  const [recurringType, setRecurringType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const { toast } = useToast();

  // Sync description when task changes
  useEffect(() => {
    if (task) {
      setDescription(task.description || '');
    }
  }, [task?.id, task?.description]);

  // Handle hardware back button on Android
  const handleBack = useCallback(() => {
    onClose();
  }, [onClose]);

  useHardwareBackButton({
    onBack: handleBack,
    enabled: isOpen,
    priority: 'sheet',
  });

  if (!task) return null;

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-orange-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-400';
    }
  };

  const getPriorityName = (p: Priority) => {
    switch (p) {
      case 'high': return t('tasks.priority.high');
      case 'medium': return t('tasks.priority.medium');
      case 'low': return t('tasks.priority.low');
      default: return '';
    }
  };

  const handleAddSubtask = async (subtask: Omit<TodoItem, 'id' | 'completed'>) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}

    const newSubtask: TodoItem = {
      id: Date.now().toString(),
      completed: false,
      ...subtask,
    };

    onUpdate({
      ...task,
      subtasks: [...(task.subtasks || []), newSubtask]
    });
  };

  const handleToggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = (task.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    onUpdate({
      ...task,
      subtasks: updatedSubtasks
    });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    onUpdate({
      ...task,
      subtasks: (task.subtasks || []).filter(st => st.id !== subtaskId)
    });
  };

  const handleSubtaskDragEnd = async (result: DropResult) => {
    if (!result.destination || !task.subtasks) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}

    const reorderedSubtasks = Array.from(task.subtasks);
    const [movedSubtask] = reorderedSubtasks.splice(result.source.index, 1);
    reorderedSubtasks.splice(result.destination.index, 0, movedSubtask);

    onUpdate({
      ...task,
      subtasks: reorderedSubtasks
    });
  };

  const handleUpdateDescription = () => {
    onUpdate({
      ...task,
      description
    });
  };

  const handleToggleComplete = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    onUpdate({
      ...task,
      completed: !task.completed
    });
  };

  const handleDeleteTask = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
    onDelete(task.id);
    onClose();
  };

  const handleSetReminder = async (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const reminderDate = new Date();
    reminderDate.setHours(hours, minutes, 0, 0);

    if (reminderDate < new Date()) {
      reminderDate.setDate(reminderDate.getDate() + 1);
    }

    onUpdate({
      ...task,
      reminderTime: reminderDate
    });

    setShowTimePicker(false);
    setRecurringType('none');

    toast({
      title: t('toasts.reminderSet'),
      description: t('tasks.reminder.notifyAt', { time: format(reminderDate, 'h:mm a') }),
    });
  };

  const handleRemoveReminder = () => {
    onUpdate({
      ...task,
      reminderTime: undefined,
      notificationIds: undefined
    });

    toast({
      title: t('toasts.reminderRemoved'),
      description: t('tasks.reminder.notificationCancelled'),
    });
  };

  const handleDuplicate = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    onDuplicate(task);
    onClose();
    toast({
      title: t('toasts.taskDuplicated'),
      description: t('tasks.duplicateCreated'),
    });
  };

  const handleSaveLocationReminder = (reminder: LocationReminder) => {
    onUpdate({
      ...task,
      locationReminder: reminder
    });
    toast({
      title: t('tasks.location.reminderSet'),
      description: t('tasks.location.remindWhen', { action: reminder.triggerOnEnter ? t('tasks.location.arrive') : t('tasks.location.leave'), location: reminder.address.split(',')[0] }),
    });
  };

  const handleRemoveLocationReminder = () => {
    onUpdate({
      ...task,
      locationReminder: undefined
    });
    toast({
      title: t('tasks.location.reminderRemoved'),
      description: t('tasks.location.notificationRemoved'),
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-card z-50 rounded-t-[28px] shadow-2xl transition-all duration-500 ease-out max-h-[85vh] overflow-hidden flex flex-col",
          isOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-full scale-95 opacity-0"
        )}
      >
        <div className="px-5 pt-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3 flex-1">
              <button
                onClick={handleToggleComplete}
                className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-all",
                  task.completed ? "bg-primary border-primary" : "border-muted-foreground/30"
                )}
              >
                {task.completed && <Check className="h-4 w-4 text-primary-foreground" />}
              </button>
              <div className="flex-1">
                <h2 className={cn("text-xl font-semibold", task.completed && "line-through opacity-60")}>
                  {task.text}
                </h2>

                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {task.categoryId && getCategoryById(task.categoryId) && (
                    <div className={cn(
                      "text-sm px-2 py-1 rounded-full text-white flex items-center gap-1.5",
                      getCategoryById(task.categoryId)!.color
                    )}>
                      <span>{getCategoryById(task.categoryId)!.icon}</span>
                      <span>{getCategoryById(task.categoryId)!.name}</span>
                    </div>
                  )}

                  {task.priority && task.priority !== 'none' && (
                    <div className="flex items-center gap-1.5">
                      <Flag className={cn("h-4 w-4", getPriorityColor(task.priority))} />
                      <span className={cn("text-sm", getPriorityColor(task.priority))}>
                        {getPriorityName(task.priority)}
                      </span>
                    </div>
                  )}

                  {task.dueDate && (
                    <div className="flex items-center gap-1.5 text-cyan-500">
                      <CalendarIcon className="h-4 w-4" />
                      <span className="text-sm">
                        {format(new Date(task.dueDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}

                  {task.repeatType && task.repeatType !== 'none' && (
                    <div className="flex items-center gap-1.5 text-purple-500">
                      <Repeat className="h-4 w-4" />
                      <span className="text-sm font-medium capitalize">{task.repeatType}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button onClick={handleDeleteTask} className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors">
              <Trash2 className="h-5 w-5 text-red-500" />
            </button>
            <button onClick={handleDuplicate} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <Copy className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowTimePicker(true)}
              className={cn("p-2 hover:bg-muted rounded-lg transition-colors", task.reminderTime && "bg-cyan-50 dark:bg-cyan-950/20")}
            >
              <Bell className={cn("h-5 w-5", task.reminderTime ? "text-cyan-500" : "text-muted-foreground")} />
            </button>
            <button
              onClick={() => setShowLocationReminder(true)}
              className={cn("p-2 hover:bg-muted rounded-lg transition-colors", task.locationReminder?.enabled && "bg-pink-50 dark:bg-pink-950/20")}
            >
              <MapPin className={cn("h-5 w-5", task.locationReminder?.enabled ? "text-pink-500" : "text-muted-foreground")} />
            </button>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors">
              <Tag className="h-5 w-5 text-muted-foreground" />
            </button>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors">
              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-6">
            {/* Description Section */}
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{t('tasks.description')}</h3>
              </div>
              <Textarea
                placeholder={t('tasks.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleUpdateDescription}
                className="min-h-[100px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Location Reminder Preview */}
            {task.locationReminder?.enabled && task.locationReminder.address && (
              <LocationMapPreview 
                location={task.locationReminder.address} 
                onClose={handleRemoveLocationReminder}
              />
            )}

            {/* Subtasks Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">{t('tasks.subtasks')}</h3>
                <Button
                  onClick={() => setIsSubtaskInputOpen(true)}
                  size="sm"
                  variant="outline"
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('tasks.addSubtask')}
                </Button>
              </div>

              {task.subtasks && task.subtasks.length > 0 ? (
                <DragDropContext onDragEnd={handleSubtaskDragEnd}>
                  <Droppable droppableId="subtasks">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={cn("space-y-2 transition-colors rounded-lg", snapshot.isDraggingOver && "bg-muted/20 p-2")}
                      >
                        {task.subtasks!.map((subtask, index) => (
                          <Draggable key={subtask.id} draggableId={subtask.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-all group relative",
                                  snapshot.isDragging && "shadow-lg scale-105 rotate-1 ring-2 ring-primary/20"
                                )}
                              >
                                <Checkbox
                                  checked={subtask.completed}
                                  onCheckedChange={() => handleToggleSubtask(subtask.id)}
                                  className={cn("mt-0.5 h-5 w-5 rounded-full border-2", subtask.completed && "bg-primary border-primary")}
                                />
                                <div {...provided.dragHandleProps} className="flex-1 min-w-0 cursor-grab active:cursor-grabbing">
                                  <p className={cn("text-sm font-medium", subtask.completed && "line-through opacity-60")}>
                                    {subtask.text}
                                  </p>
                                  {subtask.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{subtask.description}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteSubtask(subtask.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">{t('tasks.noSubtasks')}</p>
              )}
            </div>
          </div>
        </div>

        <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }} />
      </div>

      {isSubtaskInputOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => setIsSubtaskInputOpen(false)}>
          <TaskInputSheet
            isOpen={isSubtaskInputOpen}
            onClose={() => setIsSubtaskInputOpen(false)}
            onAddTask={handleAddSubtask}
            folders={[]}
            selectedFolderId={null}
            onCreateFolder={() => {}}
          />
        </div>
      )}

      {showTimePicker && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5 text-cyan-500" />
                {t('tasks.reminder.setReminder')}
              </h3>
              <Button size="icon" variant="ghost" onClick={() => setShowTimePicker(false)} className="h-8 w-8">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {task.reminderTime && (
              <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('tasks.reminder.current')}:</p>
                <p className="text-sm font-medium flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-cyan-500" />
                  {format(new Date(task.reminderTime), 'MMM d, h:mm a')}
                </p>
                <Button
                  onClick={handleRemoveReminder}
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 text-xs text-red-500 hover:text-red-600"
                >
                  {t('tasks.reminder.removeReminder')}
                </Button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('tasks.repeat.title')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['none', 'daily', 'weekly', 'monthly'] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={recurringType === type ? 'default' : 'outline'}
                      onClick={() => setRecurringType(type)}
                      className="text-xs h-9 capitalize"
                    >
                      {type === 'none' ? t('tasks.repeat.once') : t(`tasks.repeat.${type}`)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('dateTime.time')}</label>
                <input
                  type="time"
                  onChange={(e) => handleSetReminder(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-lg"
                />
              </div>

              <p className="text-xs text-muted-foreground">{t('tasks.reminder.notificationInfo')}</p>
            </div>
          </div>
        </div>
      )}

      <LocationReminderSheet
        isOpen={showLocationReminder}
        onClose={() => setShowLocationReminder(false)}
        locationReminder={task.locationReminder}
        onSave={handleSaveLocationReminder}
        onRemove={handleRemoveLocationReminder}
      />
    </>
  );
};

import { useState, useEffect, useCallback, useRef } from 'react';
import { TodoItem, Priority, ColoredTag, LocationReminder, Folder } from '@/types/note';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import {
  X,
  Flag,
  Trash2,
  Tag,
  Check,
  Bell,
  Clock,
  Copy,
  MapPin,
  FileText,
  ArrowUpFromLine,
  Calendar as CalendarIcon,
  Repeat,
  Plus,
  MoreVertical,
  FolderIcon,
  ChevronDown,
  Pin,
  Paperclip,
  Link,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { LocationReminderSheet } from './LocationReminderSheet';
import { LocationMapPreview } from './LocationMapPreview';
import { TaskInputSheet } from './TaskInputSheet';
import { TaskDateTimePage, RepeatSettings } from './TaskDateTimePage';
import { TaskTimeTracker } from './TaskTimeTracker';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface SubtaskDetailSheetProps {
  isOpen: boolean;
  subtask: TodoItem | null;
  parentId: string | null;
  onClose: () => void;
  onUpdate: (parentId: string, subtaskId: string, updates: Partial<TodoItem>) => void;
  onDelete: (parentId: string, subtaskId: string) => void;
  onConvertToTask: (parentId: string, subtask: TodoItem) => void;
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];

export const SubtaskDetailSheet = ({
  isOpen,
  subtask,
  parentId,
  onClose,
  onUpdate,
  onDelete,
  onConvertToTask
}: SubtaskDetailSheetProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showDateTimePage, setShowDateTimePage] = useState(false);
  const [showLocationReminder, setShowLocationReminder] = useState(false);
  const [isNestedSubtaskInputOpen, setIsNestedSubtaskInputOpen] = useState(false);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  // Hardware back button support
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen && !showDateTimePage,
    priority: 'sheet',
  });

  useEffect(() => {
    if (subtask) {
      setTitle(subtask.text);
      setDescription(subtask.description || '');
    }
  }, [subtask]);

  useEffect(() => {
    if (showSubtaskInput && subtaskInputRef.current) {
      subtaskInputRef.current.focus();
    }
  }, [showSubtaskInput]);

  if (!isOpen || !subtask || !parentId) return null;

  const handleTitleBlur = () => {
    if (title.trim() !== subtask.text) {
      onUpdate(parentId, subtask.id, { text: title.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== (subtask.description || '')) {
      onUpdate(parentId, subtask.id, { description });
    }
  };

  const handleToggleComplete = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    onUpdate(parentId, subtask.id, { completed: !subtask.completed });
  };

  const handleSetPriority = async (priority: Priority) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    onUpdate(parentId, subtask.id, { priority });
    toast.success(`Priority set to ${priority === 'none' ? 'none' : priority}`);
  };

  const handleDelete = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    onDelete(parentId, subtask.id);
    onClose();
    toast.success('Subtask deleted');
  };

  const handleConvertToTask = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    onConvertToTask(parentId, subtask);
    onClose();
    toast.success('Converted to main task');
  };

  const handleDuplicate = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    toast.success('Subtask duplicated');
  };

  const handlePin = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    toast.success('Subtask pinned');
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    
    const newTag: ColoredTag = {
      name: newTagName.trim(),
      color: newTagColor
    };

    onUpdate(parentId, subtask.id, {
      coloredTags: [...(subtask.coloredTags || []), newTag]
    });

    setNewTagName('');
    setShowTagInput(false);
    toast.success('Tag added');
  };

  const handleRemoveTag = (tagName: string) => {
    onUpdate(parentId, subtask.id, {
      coloredTags: (subtask.coloredTags || []).filter(t => t.name !== tagName)
    });
  };

  const handleSaveLocationReminder = (reminder: LocationReminder) => {
    onUpdate(parentId, subtask.id, { locationReminder: reminder });
    toast.success(`Location reminder set for ${reminder.address.split(',')[0]}`);
  };

  const handleRemoveLocationReminder = () => {
    onUpdate(parentId, subtask.id, { locationReminder: undefined });
    toast.success('Location reminder removed');
  };

  const handleAddNestedSubtask = async () => {
    if (!newSubtaskText.trim()) return;
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    
    const now = new Date();
    const nested: TodoItem = {
      id: Date.now().toString(),
      text: newSubtaskText.trim(),
      completed: false,
      createdAt: now,
      modifiedAt: now,
    };

    onUpdate(parentId, subtask.id, {
      subtasks: [...(subtask.subtasks || []), nested]
    });
    setNewSubtaskText('');
    // Keep input open for continuous adding
  };

  const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNestedSubtask();
    }
  };

  const handleToggleNestedSubtask = async (nestedId: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    const updatedNested = (subtask.subtasks || []).map(st =>
      st.id === nestedId ? { ...st, completed: !st.completed } : st
    );
    onUpdate(parentId, subtask.id, { subtasks: updatedNested });
  };

  const handleDeleteNestedSubtask = (nestedId: string) => {
    onUpdate(parentId, subtask.id, {
      subtasks: (subtask.subtasks || []).filter(st => st.id !== nestedId)
    });
  };

  const handleDateTimeSave = (data: {
    selectedDate?: Date;
    selectedTime?: { hour: number; minute: number; period: 'AM' | 'PM' };
    reminder?: string;
    repeatSettings?: RepeatSettings;
  }) => {
    let reminderTime: Date | undefined;
    
    if (data.selectedDate) {
      if (data.selectedTime) {
        let hours = data.selectedTime.hour;
        if (data.selectedTime.period === 'PM' && hours !== 12) hours += 12;
        if (data.selectedTime.period === 'AM' && hours === 12) hours = 0;
        reminderTime = new Date(data.selectedDate);
        reminderTime.setHours(hours, data.selectedTime.minute, 0, 0);
      }
    }

    onUpdate(parentId, subtask.id, {
      dueDate: data.selectedDate,
      reminderTime,
      repeatType: data.repeatSettings?.frequency === 'daily' ? 'daily' 
        : data.repeatSettings?.frequency === 'weekly' ? 'weekly'
        : data.repeatSettings?.frequency === 'monthly' ? 'monthly'
        : 'none' as const,
    });

    setShowDateTimePage(false);
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-orange-500';
      case 'low': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <>
      <div className={cn(
        "fixed inset-0 bg-background z-50 flex flex-col transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header - Similar to TaskDetailPage */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          {/* Left: All Tasks label */}
          <Button variant="ghost" size="sm" className="gap-2">
            <FolderIcon className="h-4 w-4" />
            <span>All Tasks</span>
            <ChevronDown className="h-4 w-4" />
          </Button>

          {/* Right: Options Menu */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-lg z-[60]">
                <DropdownMenuItem onClick={handleToggleComplete} className="cursor-pointer">
                  <Check className="h-4 w-4 mr-2" />
                  {subtask.completed ? 'Mark as Incomplete' : 'Mark as Done'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleSetPriority('high')} className="cursor-pointer">
                  <Flag className="h-4 w-4 mr-2 text-red-500" />High Priority
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetPriority('medium')} className="cursor-pointer">
                  <Flag className="h-4 w-4 mr-2 text-orange-500" />Medium Priority
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetPriority('low')} className="cursor-pointer">
                  <Flag className="h-4 w-4 mr-2 text-green-500" />Low Priority
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetPriority('none')} className="cursor-pointer">
                  <Flag className="h-4 w-4 mr-2 text-muted-foreground" />No Priority
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDuplicate} className="cursor-pointer">
                  <Copy className="h-4 w-4 mr-2" />Duplicate Subtask
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePin} className="cursor-pointer">
                  <Pin className="h-4 w-4 mr-2" />Pin Subtask
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleConvertToTask} className="cursor-pointer">
                  <ArrowUpFromLine className="h-4 w-4 mr-2" />Convert to Task
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />Delete Subtask
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Subtask Title */}
          <div className="space-y-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Subtask title..."
              className={cn(
                "text-xl font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0",
                subtask.completed && "line-through opacity-60"
              )}
            />
            {subtask.priority && subtask.priority !== 'none' && (
              <div className="flex items-center gap-1.5">
                <Flag className={cn("h-4 w-4", getPriorityColor(subtask.priority))} />
                <span className={cn("text-sm capitalize", getPriorityColor(subtask.priority))}>
                  {subtask.priority} Priority
                </span>
              </div>
            )}
          </div>

          {/* Nested Subtasks */}
          <div className="space-y-3">
            <button
              onClick={() => setIsNestedSubtaskInputOpen(true)}
              className="flex items-center gap-2 text-primary font-medium"
            >
              <Plus className="h-5 w-5" />
              Add Sub-task
            </button>

            {/* Keep inline input as fallback if sheet fails */}

            {subtask.subtasks && subtask.subtasks.length > 0 && (
              <div className="space-y-2 pl-2">
                {subtask.subtasks.map((nested) => (
                  <div key={nested.id} className="flex items-center gap-3 py-2 group">
                    <Checkbox
                      checked={nested.completed}
                      onCheckedChange={() => handleToggleNestedSubtask(nested.id)}
                      className={cn(
                        "h-5 w-5 rounded-sm border-2",
                        nested.completed && "border-muted-foreground/50"
                      )}
                    />
                    <span className={cn("flex-1 text-sm", nested.completed && "line-through text-muted-foreground")}>
                      {nested.text}
                    </span>
                    <button
                      onClick={() => handleDeleteNestedSubtask(nested.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Time Tracking */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Time Tracking
            </div>
            <TaskTimeTracker
              timeTracking={subtask.timeTracking}
              onUpdate={(tracking) => onUpdate(parentId, subtask.id, { timeTracking: tracking })}
            />
          </div>

          {/* Dependencies */}
          <div className="space-y-2">
            <button
              className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
            >
              <Link className="h-5 w-5 text-purple-500" />
              <span className="flex-1 text-left">Dependencies</span>
              <span className="text-sm text-muted-foreground">
                {subtask.dependsOn?.length || 0} linked
              </span>
            </button>
          </div>

          {/* Action Items */}
          <div className="space-y-1 border-t border-border pt-4">
            {/* Date, Time & Reminder */}
            <button 
              onClick={() => setShowDateTimePage(true)}
              className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
            >
              <CalendarIcon className="h-5 w-5 text-cyan-500" />
              <span className="flex-1 text-left">Date, Time & Reminder</span>
              <span className="text-sm text-muted-foreground">
                {subtask.dueDate 
                  ? `${format(new Date(subtask.dueDate), 'MMM d')}${subtask.reminderTime ? ` • ${format(new Date(subtask.reminderTime), 'h:mm a')}` : ''}`
                  : 'Not set'}
              </span>
            </button>

            {/* Convert to Notes */}
            <button 
              onClick={handleConvertToTask}
              className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
            >
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="flex-1 text-left">Convert to Notes</span>
            </button>

            {/* Attachment */}
            <button 
              className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
            >
              <Paperclip className="h-5 w-5 text-pink-500" />
              <span className="flex-1 text-left">Attachment</span>
              {subtask.imageUrl && <ImageIcon className="h-4 w-4 text-muted-foreground" />}
            </button>

            {/* Tag */}
            <div className="space-y-2">
              <Popover open={showTagInput} onOpenChange={setShowTagInput}>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors">
                    <Tag className="h-5 w-5 text-yellow-500" />
                    <span className="flex-1 text-left">Tag</span>
                    <span className="text-sm text-muted-foreground">
                      {subtask.coloredTags?.length || 0} tag(s)
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 z-[60]" align="start">
                  <div className="space-y-3">
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Tag name..."
                      className="h-9"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={cn(
                            "w-6 h-6 rounded-full transition-transform",
                            newTagColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <Button onClick={handleAddTag} size="sm" className="w-full">
                      Add Tag
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Display existing tags */}
              {subtask.coloredTags && subtask.coloredTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-10">
                  {subtask.coloredTags.map((tag) => (
                    <span
                      key={tag.name}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                      <button onClick={() => handleRemoveTag(tag.name)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description Section - After Tag as requested */}
            <div className="pt-4 border-t border-border mt-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-medium">Description</h3>
              </div>
              <Textarea
                placeholder="Add notes or details about this subtask..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                className="min-h-[120px] resize-none border bg-muted/30 rounded-xl p-3 focus-visible:ring-1 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Subtask Timestamps Section */}
            <div className="pt-4 border-t border-border mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-medium">Subtask History</h3>
              </div>
              <div className="space-y-2 text-sm">
                {subtask.createdAt && (
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">{format(new Date(subtask.createdAt), 'MMM d, yyyy • h:mm a')}</span>
                  </div>
                )}
                {subtask.modifiedAt && (
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg">
                    <span className="text-muted-foreground">Last Modified</span>
                    <span className="font-medium">{format(new Date(subtask.modifiedAt), 'MMM d, yyyy • h:mm a')}</span>
                  </div>
                )}
                {subtask.completed && subtask.completedAt && (
                  <div className="flex items-center justify-between py-2 px-3 bg-green-500/10 rounded-lg">
                    <span className="text-green-600 dark:text-green-400">Completed</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{format(new Date(subtask.completedAt), 'MMM d, yyyy • h:mm a')}</span>
                  </div>
                )}
                {!subtask.createdAt && !subtask.modifiedAt && !subtask.completedAt && (
                  <div className="text-muted-foreground text-center py-2">No timestamp data available</div>
                )}
              </div>
            </div>
          </div>

          {/* Location Reminder Preview */}
          {subtask.locationReminder?.enabled && subtask.locationReminder.address && (
            <LocationMapPreview 
              location={subtask.locationReminder.address} 
              onClose={handleRemoveLocationReminder}
            />
          )}
        </div>

        {/* Safe area padding for bottom */}
        <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }} />

        {/* TaskDateTimePage */}
        <TaskDateTimePage
          isOpen={showDateTimePage}
          onClose={() => setShowDateTimePage(false)}
          onSave={handleDateTimeSave}
          initialDate={subtask.dueDate ? new Date(subtask.dueDate) : undefined}
          initialTime={subtask.reminderTime ? {
            hour: new Date(subtask.reminderTime).getHours() % 12 || 12,
            minute: new Date(subtask.reminderTime).getMinutes(),
            period: new Date(subtask.reminderTime).getHours() >= 12 ? 'PM' : 'AM'
          } : undefined}
        />
      </div>

      {/* Location Reminder Sheet */}
      <LocationReminderSheet
        isOpen={showLocationReminder}
        onClose={() => setShowLocationReminder(false)}
        locationReminder={subtask.locationReminder}
        onSave={handleSaveLocationReminder}
        onRemove={handleRemoveLocationReminder}
      />

      {/* Nested subtask input sheet */}
      <TaskInputSheet
        isOpen={isNestedSubtaskInputOpen}
        onClose={() => setIsNestedSubtaskInputOpen(false)}
        onAddTask={(task) => {
          const nested: TodoItem = {
            id: Date.now().toString(),
            completed: false,
            ...task,
          };
          onUpdate(parentId, subtask.id, {
            subtasks: [...(subtask.subtasks || []), nested]
          });
          setIsNestedSubtaskInputOpen(false);
        }}
        folders={[]}
        selectedFolderId={null}
        onCreateFolder={() => {}}
        sections={[]}
        selectedSectionId={null}
      />
    </>
  );
};

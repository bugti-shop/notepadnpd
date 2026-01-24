import { TaskStatus } from '@/types/note';
import { cn } from '@/lib/utils';
import { Circle, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TaskStatusBadgeProps {
  status?: TaskStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const getStatusConfig = (status?: TaskStatus) => {
  switch (status) {
    case 'in_progress':
      return {
        label: 'In Progress',
        color: 'bg-blue-500/20 text-blue-600',
        icon: Clock,
        dotColor: 'bg-blue-500',
      };
    case 'almost_done':
      return {
        label: 'Almost Done',
        color: 'bg-amber-500/20 text-amber-600',
        icon: AlertCircle,
        dotColor: 'bg-amber-500',
      };
    case 'completed':
      return {
        label: 'Completed',
        color: 'bg-green-500/20 text-green-600',
        icon: CheckCircle2,
        dotColor: 'bg-green-500',
      };
    case 'not_started':
    default:
      return {
        label: 'Not Started',
        color: 'bg-muted text-muted-foreground',
        icon: Circle,
        dotColor: 'bg-muted-foreground',
      };
  }
};

export const TaskStatusBadge = ({ status, showLabel = true, size = 'sm', className }: TaskStatusBadgeProps) => {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
      config.color,
      size === 'sm' ? 'text-[10px]' : 'text-xs',
      className
    )}>
      <Icon className={cn("flex-shrink-0", size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'almost_done', label: 'Almost Done' },
  { value: 'completed', label: 'Completed' },
];

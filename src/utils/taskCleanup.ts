import { TodoItem } from '@/types/note';
import { differenceInDays } from 'date-fns';

/**
 * Gets the completion date of a task.
 * Since TodoItem doesn't have completedAt, we use the task id (timestamp-based) 
 * for completed tasks as a proxy for when it was last modified.
 */
const getTaskCompletionDate = (task: TodoItem): Date => {
  // Use dueDate if available, otherwise use id timestamp
  if (task.dueDate) {
    return new Date(task.dueDate);
  }
  // Task id is timestamp-based
  const timestamp = parseInt(task.id.split('-')[0]) || Date.now();
  return new Date(timestamp);
};

/**
 * Cleans up completed tasks that are older than the specified number of days
 * @param tasks - Array of all tasks
 * @param daysThreshold - Number of days after which completed tasks should be deleted (default: 3)
 * @returns Object containing cleaned tasks array and count of deleted tasks
 */
export const cleanupCompletedTasks = (
  tasks: TodoItem[],
  daysThreshold: number = 3
): { cleanedTasks: TodoItem[]; deletedCount: number } => {
  const now = new Date();
  
  const cleanedTasks = tasks.filter(task => {
    // Keep all uncompleted tasks
    if (!task.completed) return true;
    
    // For completed tasks, check completion date
    const completionDate = getTaskCompletionDate(task);
    const daysSinceCompletion = differenceInDays(now, completionDate);
    
    // Keep tasks completed within the threshold
    return daysSinceCompletion < daysThreshold;
  });
  
  const deletedCount = tasks.length - cleanedTasks.length;
  
  return { cleanedTasks, deletedCount };
};

/**
 * Gets the count of tasks that will be auto-deleted soon
 * @param tasks - Array of all tasks
 * @param daysThreshold - Days threshold for deletion
 * @returns Count of tasks scheduled for deletion
 */
export const getTasksPendingDeletion = (
  tasks: TodoItem[],
  daysThreshold: number = 3
): { count: number; tasks: TodoItem[] } => {
  const now = new Date();
  
  const pendingTasks = tasks.filter(task => {
    if (!task.completed) return false;
    
    const completionDate = getTaskCompletionDate(task);
    const daysSinceCompletion = differenceInDays(now, completionDate);
    
    // Tasks that are completed but will be deleted within a day
    return daysSinceCompletion >= daysThreshold - 1 && daysSinceCompletion < daysThreshold;
  });
  
  return { count: pendingTasks.length, tasks: pendingTasks };
};

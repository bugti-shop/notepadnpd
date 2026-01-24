/**
 * Background Task Scheduler
 * Handles periodic checks for task rollovers and reminder scheduling
 */

import { loadTodoItems, saveTodoItems } from './todoItemsStorage';
import { processTaskRollovers } from './taskRollover';
import { notificationManager } from './notifications';

// Rollover check interval (1 hour in milliseconds)
const ROLLOVER_CHECK_INTERVAL = 60 * 60 * 1000;

let rolloverIntervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Check and rollover overdue repeat tasks
 */
export const checkAndRolloverTasks = async (): Promise<number> => {
  if (isRunning) return 0;
  isRunning = true;
  
  try {
    const items = await loadTodoItems();
    const { tasks: updatedTasks, rolledOverCount } = processTaskRollovers(items);
    
    if (rolledOverCount > 0) {
      await saveTodoItems(updatedTasks);
      // Reschedule notifications for updated tasks
      await notificationManager.rescheduleAllTasks(updatedTasks);
      console.log(`Auto-rolled over ${rolledOverCount} recurring task(s)`);
    }
    
    return rolledOverCount;
  } catch (e) {
    console.error('Task rollover check failed:', e);
    return 0;
  } finally {
    isRunning = false;
  }
};

/**
 * Start the background scheduler for periodic task rollovers
 */
export const startBackgroundScheduler = (): void => {
  if (rolloverIntervalId) {
    console.log('Background scheduler already running');
    return;
  }
  
  // Run immediately on start
  checkAndRolloverTasks();
  
  // Then run every hour
  rolloverIntervalId = setInterval(checkAndRolloverTasks, ROLLOVER_CHECK_INTERVAL);
  console.log('Background task scheduler started (hourly checks)');
};

/**
 * Stop the background scheduler
 */
export const stopBackgroundScheduler = (): void => {
  if (rolloverIntervalId) {
    clearInterval(rolloverIntervalId);
    rolloverIntervalId = null;
    console.log('Background task scheduler stopped');
  }
};

/**
 * Check if scheduler is running
 */
export const isSchedulerRunning = (): boolean => {
  return rolloverIntervalId !== null;
};
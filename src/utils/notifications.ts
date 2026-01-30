import { LocalNotifications, LocalNotificationSchema, ActionPerformed } from '@capacitor/local-notifications';
import { TodoItem, Note, Priority } from '@/types/note';
import { RepeatSettings, RepeatFrequency } from '@/components/TaskDateTimePage';
import { addMinutes, addHours, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { triggerTripleHeavyHaptic } from './haptics';
import { getSetting, setSetting } from './settingsStorage';

const DEFAULT_NOTIFICATION_ICON = 'npd_notification_icon';

export interface NotificationData {
  taskId?: string;
  noteId?: string;
  type: 'task' | 'note' | 'budget' | 'bill';
  recurring?: boolean;
  recurringType?: string;
  originalTitle?: string;
  originalBody?: string;
  category?: string;
  percentage?: number;
  billId?: string;
  dueDate?: string;
  priority?: Priority;
}

export type SnoozeOption = '5min' | '15min' | '1hour' | '3hours' | 'tomorrow';

export const TASK_REMINDER_ACTION_TYPE_ID = 'TASK_REMINDER_ACTION_TYPE';
export const SNOOZE_ACTION_TYPE_ID = 'SNOOZE_ACTION_TYPE'; // Keep for backward compatibility

export class NotificationManager {
  private static instance: NotificationManager;
  private permissionGranted = false;
  private initialized = false;

  private constructor() {}

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Request permissions
      await this.requestPermissions();

      // Register action types for snooze
      await this.registerActionTypes();

      // Set up notification listeners
      await this.setupListeners();

      this.initialized = true;
      console.log('NotificationManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NotificationManager:', error);
    }
  }

  private async registerActionTypes(): Promise<void> {
    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            // Main action type for task/note reminders with Complete, Schedule, Snooze
            id: TASK_REMINDER_ACTION_TYPE_ID,
            actions: [
              {
                id: 'complete',
                title: 'Complete',
              },
              {
                id: 'schedule',
                title: 'Schedule',
              },
              {
                id: 'snooze',
                title: 'Snooze',
              },
            ],
          },
          {
            // Legacy snooze action type for backward compatibility
            id: SNOOZE_ACTION_TYPE_ID,
            actions: [
              {
                id: 'complete',
                title: 'Complete',
              },
              {
                id: 'schedule',
                title: 'Schedule',
              },
              {
                id: 'snooze',
                title: 'Snooze',
              },
            ],
          },
        ],
      });
      console.log('Notification action types registered');
    } catch (error) {
      console.error('Error registering action types:', error);
    }
  }

  private async setupListeners(): Promise<void> {
    try {
      // Listen for notification received
      await LocalNotifications.addListener('localNotificationReceived', (notification) => {
        console.log('Notification received:', notification);
        this.handleNotificationReceived(notification);
      });

      // Listen for notification action performed (user tapped on notification or action button)
      await LocalNotifications.addListener('localNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Notification action performed:', action);
        this.handleNotificationAction(action);
      });

      console.log('Notification listeners set up successfully');
    } catch (error) {
      console.error('Error setting up notification listeners:', error);
    }
  }

  private async handleNotificationReceived(notification: LocalNotificationSchema): Promise<void> {
    // Triple heavy haptic burst for maximum attention on all reminders
    triggerTripleHeavyHaptic();

    // Store notification in history using IndexedDB
    const { getSetting, setSetting } = await import('@/utils/settingsStorage');
    const history = await getSetting<any[]>('notificationHistory', []);
    history.unshift({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      timestamp: new Date().toISOString(),
      read: false,
      extra: notification.extra,
    });
    // Keep only last 100 notifications
    await setSetting('notificationHistory', history.slice(0, 100));
    
    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('notificationReceived', { detail: notification }));
  }

  private async handleNotificationAction(action: ActionPerformed): Promise<void> {
    const notification = action.notification;
    const actionId = action.actionId;
    const extra = notification.extra as NotificationData | undefined;

    // Handle Complete action - mark task as done
    if (actionId === 'complete') {
      if (extra?.taskId) {
        window.dispatchEvent(new CustomEvent('completeTaskFromNotification', { 
          detail: { taskId: extra.taskId } 
        }));
      }
      this.markNotificationAsRead(notification.id);
      return;
    }

    // Handle Schedule action - open app to reschedule
    if (actionId === 'schedule') {
      if (extra?.taskId) {
        window.dispatchEvent(new CustomEvent('scheduleTaskFromNotification', { 
          detail: { taskId: extra.taskId, notification } 
        }));
      } else if (extra?.noteId) {
        window.dispatchEvent(new CustomEvent('scheduleNoteFromNotification', { 
          detail: { noteId: extra.noteId, notification } 
        }));
      }
      this.markNotificationAsRead(notification.id);
      return;
    }

    // Handle Snooze action - snooze for 1 hour by default
    if (actionId === 'snooze') {
      await this.snoozeNotification(notification, '1hour');
      return;
    }

    // Handle legacy snooze actions (backward compatibility)
    if (actionId.startsWith('snooze_')) {
      const snoozeType = actionId.replace('snooze_', '') as SnoozeOption;
      await this.snoozeNotification(notification, snoozeType);
      return;
    }

    // Handle dismiss action
    if (actionId === 'dismiss') {
      this.markNotificationAsRead(notification.id);
      return;
    }

    // Handle tap on notification (open app)
    if (extra?.taskId) {
      window.dispatchEvent(new CustomEvent('taskNotificationTapped', { detail: { taskId: extra.taskId } }));
    } else if (extra?.noteId) {
      window.dispatchEvent(new CustomEvent('noteNotificationTapped', { detail: { noteId: extra.noteId } }));
    }

    // Mark as read in history
    this.markNotificationAsRead(notification.id);
  }

  async snoozeNotification(notification: LocalNotificationSchema, snoozeOption: SnoozeOption): Promise<void> {
    try {
      let snoozeTime: Date;
      let snoozeLabel: string;

      switch (snoozeOption) {
        case '5min':
          snoozeTime = addMinutes(new Date(), 5);
          snoozeLabel = '5 minutes';
          break;
        case '15min':
          snoozeTime = addMinutes(new Date(), 15);
          snoozeLabel = '15 minutes';
          break;
        case '1hour':
          snoozeTime = addHours(new Date(), 1);
          snoozeLabel = '1 hour';
          break;
        case '3hours':
          snoozeTime = addHours(new Date(), 3);
          snoozeLabel = '3 hours';
          break;
        case 'tomorrow':
          snoozeTime = addDays(new Date(), 1);
          snoozeTime.setHours(9, 0, 0, 0); // Tomorrow at 9 AM
          snoozeLabel = 'tomorrow 9 AM';
          break;
        default:
          snoozeTime = addHours(new Date(), 1);
          snoozeLabel = '1 hour';
      }

      const extra = notification.extra as NotificationData | undefined;
      const snoozeNotificationId = Date.now();

      await LocalNotifications.schedule({
        notifications: [
          {
            id: snoozeNotificationId,
            title: `⏰ Snoozed: ${notification.title || 'Reminder'}`,
            body: notification.body || '',
            schedule: { at: snoozeTime },
            sound: undefined,
            attachments: undefined,
            actionTypeId: TASK_REMINDER_ACTION_TYPE_ID,
            smallIcon: DEFAULT_NOTIFICATION_ICON,
            largeIcon: DEFAULT_NOTIFICATION_ICON,
            extra: {
              ...extra,
              originalTitle: notification.title,
              originalBody: notification.body,
              snoozedFrom: notification.id,
            } as NotificationData,
          },
        ],
      });

      // Update history to show it was snoozed (async)
      getSetting<any[]>('notificationHistory', []).then(history => {
        const updatedHistory = history.map((item: any) =>
          item.id === notification.id 
            ? { ...item, snoozed: true, snoozedUntil: snoozeTime.toISOString(), snoozeLabel }
            : item
        );
        setSetting('notificationHistory', updatedHistory);
      });

      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('notificationSnoozed', { 
        detail: { 
          originalId: notification.id, 
          newId: snoozeNotificationId, 
          snoozeTime,
          snoozeLabel 
        } 
      }));

      console.log(`Notification snoozed for ${snoozeLabel}`);
    } catch (error) {
      console.error('Error snoozing notification:', error);
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const result = await LocalNotifications.requestPermissions();
      this.permissionGranted = result.display === 'granted';
      return this.permissionGranted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const result = await LocalNotifications.checkPermissions();
      this.permissionGranted = result.display === 'granted';
      return this.permissionGranted;
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return false;
    }
  }

  private calculateReminderTime(baseDate: Date, reminderOffset: string): Date {
    switch (reminderOffset) {
      case '5min':
        return addMinutes(baseDate, -5);
      case '10min':
        return addMinutes(baseDate, -10);
      case '15min':
        return addMinutes(baseDate, -15);
      case '30min':
        return addMinutes(baseDate, -30);
      case '1hour':
        return addHours(baseDate, -1);
      case '2hours':
        return addHours(baseDate, -2);
      case 'morning': {
        // Morning of the task day at 9:00 AM
        const morningDate = new Date(baseDate);
        morningDate.setHours(9, 0, 0, 0);
        return morningDate;
      }
      case 'evening_before': {
        // Evening before at 6:00 PM
        const eveningDate = addDays(baseDate, -1);
        eveningDate.setHours(18, 0, 0, 0);
        return eveningDate;
      }
      case '1day_9am': {
        // Day before at 9:00 AM
        const dayBefore9am = addDays(baseDate, -1);
        dayBefore9am.setHours(9, 0, 0, 0);
        return dayBefore9am;
      }
      case '1day':
        return addDays(baseDate, -1);
      case '2days':
        return addDays(baseDate, -2);
      case '1week':
        return addWeeks(baseDate, -1);
      default:
        return baseDate;
    }
  }

  private getNextOccurrence(baseDate: Date, frequency: RepeatFrequency, interval: number, occurrence: number): Date {
    const totalInterval = interval * occurrence;
    
    switch (frequency) {
      case 'hour':
        return addHours(baseDate, totalInterval);
      case 'daily':
        return addDays(baseDate, totalInterval);
      case 'weekly':
        return addWeeks(baseDate, totalInterval);
      case 'monthly':
        return addMonths(baseDate, totalInterval);
      case 'yearly':
        return addYears(baseDate, totalInterval);
      default:
        return baseDate;
    }
  }

  async scheduleTaskReminder(
    task: TodoItem,
    reminderOffset?: string,
    repeatSettings?: RepeatSettings
  ): Promise<number[]> {
    if (!task.dueDate && !task.reminderTime) return [];

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Notification permissions not granted');
      }
    }

    try {
      await this.cancelTaskReminder(task.id);

      const baseNotificationId = parseInt(task.id.slice(0, 8), 16) || Date.now();
      const baseDate = task.reminderTime 
        ? new Date(task.reminderTime) 
        : new Date(task.dueDate!);
      
      const notificationIds: number[] = [];
      const notifications: LocalNotificationSchema[] = [];

      // Calculate reminder time based on offset
      const reminderTime = reminderOffset 
        ? this.calculateReminderTime(baseDate, reminderOffset)
        : baseDate;

      if (repeatSettings && repeatSettings.frequency) {
        // Calculate how many occurrences to schedule
        let maxOccurrences = 30; // Default
        
        if (repeatSettings.endsType === 'after_occurrences' && repeatSettings.endsAfterOccurrences) {
          maxOccurrences = repeatSettings.endsAfterOccurrences;
        } else if (repeatSettings.endsType === 'on_date' && repeatSettings.endsOnDate) {
          // Calculate occurrences until end date
          const now = new Date();
          const endDate = new Date(repeatSettings.endsOnDate);
          let count = 0;
          let checkDate = reminderTime;
          
          while (checkDate <= endDate && count < 365) {
            if (checkDate > now) count++;
            checkDate = this.getNextOccurrence(reminderTime, repeatSettings.frequency, repeatSettings.interval, count + 1);
          }
          maxOccurrences = Math.min(count, 365);
        }

        for (let i = 0; i < maxOccurrences; i++) {
          const occurrenceDate = this.getNextOccurrence(reminderTime, repeatSettings.frequency, repeatSettings.interval, i);
          
          // For weekly repeats, check if day is in selected days
          if (repeatSettings.frequency === 'weekly' && repeatSettings.weeklyDays && repeatSettings.weeklyDays.length > 0) {
            if (!repeatSettings.weeklyDays.includes(occurrenceDate.getDay())) {
              continue;
            }
          }

          // For monthly repeats, set specific day
          if (repeatSettings.frequency === 'monthly' && repeatSettings.monthlyDay) {
            occurrenceDate.setDate(repeatSettings.monthlyDay);
          }

          if (occurrenceDate > new Date()) {
            const notificationId = baseNotificationId + i;
            notificationIds.push(notificationId);

            const frequencyLabel = repeatSettings.frequency.charAt(0).toUpperCase() + repeatSettings.frequency.slice(1);
            
            notifications.push({
              id: notificationId,
              title: `Task Reminder (${frequencyLabel})`,
              body: task.text,
              schedule: { at: occurrenceDate },
              sound: undefined,
              attachments: undefined,
              actionTypeId: TASK_REMINDER_ACTION_TYPE_ID,
              smallIcon: DEFAULT_NOTIFICATION_ICON,
              largeIcon: DEFAULT_NOTIFICATION_ICON,
              extra: {
                taskId: task.id,
                type: 'task',
                recurring: true,
                recurringType: repeatSettings.frequency,
                priority: task.priority,
              } as NotificationData,
            });
          }
        }
      } else {
        // Single notification
        if (reminderTime > new Date()) {
          notificationIds.push(baseNotificationId);
          notifications.push({
            id: baseNotificationId,
            title: 'Task Reminder',
            body: task.text,
            schedule: { at: reminderTime },
            sound: undefined,
            attachments: undefined,
            actionTypeId: TASK_REMINDER_ACTION_TYPE_ID,
            smallIcon: DEFAULT_NOTIFICATION_ICON,
            largeIcon: DEFAULT_NOTIFICATION_ICON,
            extra: {
              taskId: task.id,
              type: 'task',
              priority: task.priority,
            } as NotificationData,
          });
        }
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`Scheduled ${notifications.length} notification(s) for task: ${task.text}`);
      }

      return notificationIds;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  async scheduleNoteReminder(note: Note): Promise<number[]> {
    if (!note.reminderTime || !note.reminderEnabled) return [];

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Notification permissions not granted');
      }
    }

    try {
      await this.cancelNoteReminder(note.id);

      const baseNotificationId = parseInt(note.id.slice(0, 8), 16) || Date.now();
      const reminderDate = new Date(note.reminderTime);
      const notificationIds: number[] = [];
      const notifications: LocalNotificationSchema[] = [];

      const recurring = note.reminderRecurring && note.reminderRecurring !== 'none';
      const maxOccurrences = recurring ? 30 : 1;

      for (let i = 0; i < maxOccurrences; i++) {
        const occurrenceDate = new Date(reminderDate);

        if (note.reminderRecurring === 'daily') {
          occurrenceDate.setDate(occurrenceDate.getDate() + i);
        } else if (note.reminderRecurring === 'weekly') {
          occurrenceDate.setDate(occurrenceDate.getDate() + (i * 7));
        } else if (note.reminderRecurring === 'monthly') {
          occurrenceDate.setMonth(occurrenceDate.getMonth() + i);
        }

        if (occurrenceDate > new Date()) {
          const notificationId = baseNotificationId + i;
          notificationIds.push(notificationId);

          notifications.push({
            id: notificationId,
            title: recurring
              ? `Note Reminder (${note.reminderRecurring?.charAt(0).toUpperCase()}${note.reminderRecurring?.slice(1)})`
              : 'Note Reminder',
            body: note.title || 'You have a note reminder',
            schedule: { at: occurrenceDate },
            sound: undefined,
            attachments: undefined,
            actionTypeId: TASK_REMINDER_ACTION_TYPE_ID,
            smallIcon: DEFAULT_NOTIFICATION_ICON,
            largeIcon: DEFAULT_NOTIFICATION_ICON,
            extra: {
              noteId: note.id,
              type: 'note',
              recurring,
              recurringType: note.reminderRecurring,
            } as NotificationData,
          });
        }
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`Scheduled ${notifications.length} notification(s) for note: ${note.title}`);
      }

      return notificationIds;
    } catch (error) {
      console.error('Error scheduling note notification:', error);
      throw error;
    }
  }

  async cancelTaskReminder(taskId: string, notificationIds?: number[]): Promise<void> {
    try {
      if (notificationIds && notificationIds.length > 0) {
        await LocalNotifications.cancel({
          notifications: notificationIds.map(id => ({ id }))
        });
      } else {
        const baseNotificationId = parseInt(taskId.slice(0, 8), 16) || Date.now();
        const idsToCancel = [];
        for (let i = 0; i < 365; i++) {
          idsToCancel.push({ id: baseNotificationId + i });
        }
        await LocalNotifications.cancel({ notifications: idsToCancel });
      }
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async cancelNoteReminder(noteId: string, notificationIds?: number[]): Promise<void> {
    try {
      if (notificationIds && notificationIds.length > 0) {
        await LocalNotifications.cancel({
          notifications: notificationIds.map(id => ({ id }))
        });
      } else {
        const baseNotificationId = parseInt(noteId.slice(0, 8), 16) || Date.now();
        const idsToCancel = [];
        for (let i = 0; i < 100; i++) {
          idsToCancel.push({ id: baseNotificationId + i });
        }
        await LocalNotifications.cancel({ notifications: idsToCancel });
      }
    } catch (error) {
      console.error('Error canceling note notification:', error);
    }
  }

  /**
   * Get saved auto-reminder times from localStorage
   * Defaults: morning (9 AM), afternoon (2 PM), evening (7 PM)
   */
  async getAutoReminderTimes(): Promise<{ morning: number; afternoon: number; evening: number }> {
    try {
      const saved = await getSetting<{ morning: number; afternoon: number; evening: number } | null>('autoReminderTimes', null);
      if (saved) {
        return saved;
      }
    } catch (e) {
      console.error('Error loading auto-reminder times:', e);
    }
    return { morning: 9, afternoon: 14, evening: 19 };
  }

  /**
   * Schedule auto-reminders for tasks without specific date/time
   * Sends 3 reminders per day: morning, afternoon, evening (customizable in settings)
   */
  async scheduleAutoReminders(task: TodoItem): Promise<number[]> {
    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        return [];
      }
    }

    try {
      // Cancel any existing auto-reminders first
      await this.cancelAutoReminders(task.id);

      const baseNotificationId = parseInt(task.id.slice(0, 8), 16) + 1000000 || Date.now() + 1000000;
      const notificationIds: number[] = [];
      const notifications: LocalNotificationSchema[] = [];
      
      const now = new Date();
      
      // Get customizable reminder times from settings
      const times = await this.getAutoReminderTimes();
      const reminderHours = [times.morning, times.afternoon, times.evening];
      
      // Schedule for next 7 days
      for (let day = 0; day < 7; day++) {
        for (let i = 0; i < reminderHours.length; i++) {
          const reminderTime = new Date(now);
          reminderTime.setDate(reminderTime.getDate() + day);
          reminderTime.setHours(reminderHours[i], 0, 0, 0);
          
          // Skip if time has already passed today
          if (reminderTime <= now) continue;
          
          const notificationId = baseNotificationId + (day * 3) + i;
          notificationIds.push(notificationId);
          
          const timeLabel = i === 0 ? 'Morning' : i === 1 ? 'Afternoon' : 'Evening';
          
          notifications.push({
            id: notificationId,
            title: `${timeLabel} Reminder 📝`,
            body: `Pending task: ${task.text}`,
            schedule: { at: reminderTime },
            sound: undefined,
            attachments: undefined,
            actionTypeId: SNOOZE_ACTION_TYPE_ID,
            smallIcon: DEFAULT_NOTIFICATION_ICON,
            largeIcon: DEFAULT_NOTIFICATION_ICON,
            extra: {
              taskId: task.id,
              type: 'task',
              autoReminder: true,
              priority: task.priority,
            } as NotificationData,
          });
        }
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`Scheduled ${notifications.length} auto-reminder(s) for task: ${task.text}`);
      }

      return notificationIds;
    } catch (error) {
      console.error('Error scheduling auto-reminders:', error);
      return [];
    }
  }

  /**
   * Cancel auto-reminders for a specific task
   */
  async cancelAutoReminders(taskId: string): Promise<void> {
    try {
      const baseNotificationId = parseInt(taskId.slice(0, 8), 16) + 1000000 || Date.now() + 1000000;
      const idsToCancel = [];
      // Cancel 21 potential notifications (7 days * 3 per day)
      for (let i = 0; i < 21; i++) {
        idsToCancel.push({ id: baseNotificationId + i });
      }
      await LocalNotifications.cancel({ notifications: idsToCancel });
    } catch (error) {
      console.error('Error canceling auto-reminders:', error);
    }
  }

  async cancelAllReminders(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  async getPendingNotifications(): Promise<LocalNotificationSchema[]> {
    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications;
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }

  async rescheduleAllTasks(tasks: TodoItem[]): Promise<void> {
    await this.cancelAllReminders();
    for (const task of tasks) {
      if ((task.reminderTime || task.dueDate) && !task.completed) {
        try {
          await this.scheduleTaskReminder(task);
        } catch (error) {
          console.error(`Failed to schedule reminder for task ${task.id}:`, error);
        }
      }
    }
  }

  async getNotificationHistory(): Promise<any[]> {
    const { getSetting } = await import('@/utils/settingsStorage');
    return getSetting<any[]>('notificationHistory', []);
  }

  async clearNotificationHistory(): Promise<void> {
    const { setSetting } = await import('@/utils/settingsStorage');
    await setSetting('notificationHistory', []);
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    const { getSetting, setSetting } = await import('@/utils/settingsStorage');
    const history = await getSetting<any[]>('notificationHistory', []);
    const updatedHistory = history.map((item: any) =>
      item.id === notificationId ? { ...item, read: true } : item
    );
    await setSetting('notificationHistory', updatedHistory);
  }

  // Budget alert notifications
  async scheduleBudgetAlert(
    category: string,
    spent: number,
    budget: number,
    currencySymbol: string
  ): Promise<number | null> {
    if (budget <= 0) return null;

    const percentage = (spent / budget) * 100;
    const { getSetting, setSetting } = await import('@/utils/settingsStorage');
    const alertKey = `budget_alert_${category}_${new Date().toDateString()}`;
    const alertedPercentages = await getSetting<number[]>(alertKey, []);

    // Determine alert level
    let alertLevel: number | null = null;
    let title = '';
    let body = '';
    let emoji = '';

    if (percentage >= 100 && !alertedPercentages.includes(100)) {
      alertLevel = 100;
      emoji = '🚨';
      title = `${emoji} Budget Exceeded: ${category}`;
      body = `You've exceeded your ${category} budget! Spent ${currencySymbol}${spent.toLocaleString()} of ${currencySymbol}${budget.toLocaleString()} budget.`;
    } else if (percentage >= 90 && percentage < 100 && !alertedPercentages.includes(90)) {
      alertLevel = 90;
      emoji = '⚠️';
      title = `${emoji} Budget Warning: ${category}`;
      body = `You've used 90% of your ${category} budget. ${currencySymbol}${(budget - spent).toLocaleString()} remaining.`;
    } else if (percentage >= 80 && percentage < 90 && !alertedPercentages.includes(80)) {
      alertLevel = 80;
      emoji = '📊';
      title = `${emoji} Budget Alert: ${category}`;
      body = `You've used 80% of your ${category} budget. ${currencySymbol}${(budget - spent).toLocaleString()} remaining.`;
    } else if (percentage >= 70 && percentage < 80 && !alertedPercentages.includes(70)) {
      alertLevel = 70;
      emoji = '💰';
      title = `${emoji} Budget Update: ${category}`;
      body = `You've used 70% of your ${category} budget. ${currencySymbol}${(budget - spent).toLocaleString()} remaining.`;
    }

    if (alertLevel === null) return null;

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        console.log('Budget notification skipped - no permission');
        return null;
      }
    }

    try {
      const notificationId = Date.now();
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title,
            body,
            schedule: { at: new Date(Date.now() + 1000) }, // Show in 1 second
            sound: undefined,
            attachments: undefined,
            smallIcon: DEFAULT_NOTIFICATION_ICON,
            largeIcon: DEFAULT_NOTIFICATION_ICON,
            extra: {
              type: 'budget',
              category,
              percentage: alertLevel,
            } as NotificationData,
          },
        ],
      });

      // Mark this alert level as sent for today
      alertedPercentages.push(alertLevel);
      await setSetting(alertKey, alertedPercentages);

      console.log(`Budget alert scheduled: ${category} at ${alertLevel}%`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling budget alert:', error);
      return null;
    }
  }

  // Check and send budget alerts for all categories
  async checkBudgetAlerts(
    categorySpending: { [key: string]: number },
    budgets: { [key: string]: number },
    currencySymbol: string
  ): Promise<void> {
    for (const category of Object.keys(categorySpending)) {
      const spent = categorySpending[category] || 0;
      const budget = budgets[category] || 0;
      
      if (budget > 0 && spent > 0) {
        await this.scheduleBudgetAlert(category, spent, budget, currencySymbol);
      }
    }
  }

  // Clear budget alert history (call at start of new month)
  async clearBudgetAlertHistory(): Promise<void> {
    const { removeSetting, getSetting } = await import('./settingsStorage');
    // This is now handled via IndexedDB
    console.log('Budget alert history cleared');
  }

  // Schedule a bill reminder notification
  async scheduleBillReminder(
    billId: string,
    description: string,
    amount: number,
    dueDate: Date,
    reminderDays: number,
    currencySymbol: string
  ): Promise<number | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDateNormalized = new Date(dueDate);
    dueDateNormalized.setHours(0, 0, 0, 0);
    
    const daysUntilDue = Math.ceil((dueDateNormalized.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only notify if within reminder window and not past due
    if (daysUntilDue < 0 || daysUntilDue > reminderDays) {
      return null;
    }

    // Check if already reminded today for this bill using IndexedDB
    const { getSetting, setSetting } = await import('./settingsStorage');
    const reminderKey = `bill_reminder_${billId}_${today.toISOString().split('T')[0]}`;
    const alreadyReminded = await getSetting<boolean>(reminderKey, false);
    if (alreadyReminded) {
      return null;
    }

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        console.log('Bill reminder skipped - no permission');
        return null;
      }
    }

    try {
      const notificationId = Date.now();
      
      let title: string;
      let body: string;
      let emoji: string;
      
      if (daysUntilDue === 0) {
        emoji = '🔔';
        title = `${emoji} Bill Due Today: ${description}`;
        body = `Your ${description} payment of ${currencySymbol}${amount.toLocaleString()} is due today!`;
      } else if (daysUntilDue === 1) {
        emoji = '⏰';
        title = `${emoji} Bill Due Tomorrow: ${description}`;
        body = `Your ${description} payment of ${currencySymbol}${amount.toLocaleString()} is due tomorrow.`;
      } else {
        emoji = '📅';
        title = `${emoji} Upcoming Bill: ${description}`;
        body = `Your ${description} payment of ${currencySymbol}${amount.toLocaleString()} is due in ${daysUntilDue} days.`;
      }
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title,
            body,
            schedule: { at: new Date(Date.now() + 1000) }, // Show in 1 second
            sound: undefined,
            attachments: undefined,
            smallIcon: DEFAULT_NOTIFICATION_ICON,
            largeIcon: DEFAULT_NOTIFICATION_ICON,
            extra: {
              type: 'bill',
              billId,
              dueDate: dueDate.toISOString(),
            },
          },
        ],
      });

      // Mark as reminded for today using IndexedDB
      await setSetting(reminderKey, true);

      console.log(`Bill reminder scheduled: ${description} due in ${daysUntilDue} days`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling bill reminder:', error);
      return null;
    }
  }

  // Check and send bill reminders for all recurring expenses
  async checkBillReminders(
    recurringExpenses: Array<{
      id: string;
      description: string;
      amount: number;
      dayOfMonth: number;
      enabled: boolean;
      reminderDays?: number;
    }>,
    currencySymbol: string
  ): Promise<void> {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    for (const expense of recurringExpenses) {
      if (!expense.enabled || !expense.reminderDays || expense.reminderDays <= 0) {
        continue;
      }
      
      // Calculate due date for current month
      let dueDate = new Date(currentYear, currentMonth, expense.dayOfMonth);
      
      // If due date has passed this month, check next month
      if (dueDate < today) {
        dueDate = new Date(currentYear, currentMonth + 1, expense.dayOfMonth);
      }
      
      await this.scheduleBillReminder(
        expense.id,
        expense.description,
        expense.amount,
        dueDate,
        expense.reminderDays,
        currencySymbol
      );
    }
  }

  // Clear bill reminder history (for testing or monthly reset)
  async clearBillReminderHistory(): Promise<void> {
    const { getSetting, setSetting, removeSetting } = await import('./settingsStorage');
    // Clear from IndexedDB
    const allSettings = await getSetting<Record<string, any>>('_all_settings', {});
    const billKeys = Object.keys(allSettings).filter(key => key.startsWith('bill_reminder_'));
    for (const key of billKeys) {
      await removeSetting(key);
    }
  }

  // Schedule personalized motivational notifications
  async schedulePersonalizedNotifications(): Promise<void> {
    try {
      const { getAllPersonalizedNotifications, getSmartNotification } = await import('./personalizedNotifications');
      const { loadTasksFromDB } = await import('./taskStorage');
      
      const tasks = await loadTasksFromDB();
      const smartNotification = getSmartNotification(tasks);
      
      // Schedule smart notification for 15 minutes from now
      const scheduleTime = new Date();
      scheduleTime.setMinutes(scheduleTime.getMinutes() + 15);
      
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 100000) + 900000,
          title: smartNotification.title,
          body: smartNotification.body,
          schedule: { at: scheduleTime },
          smallIcon: DEFAULT_NOTIFICATION_ICON,
          extra: {
            type: 'personalized',
            category: smartNotification.category,
          },
        }],
      });
      
      console.log('Scheduled personalized notification:', smartNotification.title);
    } catch (error) {
      console.error('Failed to schedule personalized notification:', error);
    }
  }

  // Schedule daily motivational notifications
  async scheduleDailyMotivation(): Promise<void> {
    try {
      const { MORNING_MESSAGES, EVENING_MESSAGES } = await this.getMotivationMessages();
      
      // Schedule morning motivation (8 AM)
      const morningTime = new Date();
      morningTime.setHours(8, 0, 0, 0);
      if (morningTime <= new Date()) {
        morningTime.setDate(morningTime.getDate() + 1);
      }
      
      const morningMsg = MORNING_MESSAGES[Math.floor(Math.random() * MORNING_MESSAGES.length)];
      
      // Schedule evening reflection (9 PM)
      const eveningTime = new Date();
      eveningTime.setHours(21, 0, 0, 0);
      if (eveningTime <= new Date()) {
        eveningTime.setDate(eveningTime.getDate() + 1);
      }
      
      const eveningMsg = EVENING_MESSAGES[Math.floor(Math.random() * EVENING_MESSAGES.length)];
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 999001,
            title: morningMsg.title,
            body: morningMsg.body,
            schedule: { at: morningTime, every: 'day' },
            smallIcon: DEFAULT_NOTIFICATION_ICON,
            extra: { type: 'motivation', category: 'morning' },
          },
          {
            id: 999002,
            title: eveningMsg.title,
            body: eveningMsg.body,
            schedule: { at: eveningTime, every: 'day' },
            smallIcon: DEFAULT_NOTIFICATION_ICON,
            extra: { type: 'motivation', category: 'evening' },
          },
        ],
      });
      
      console.log('Scheduled daily motivation notifications');
    } catch (error) {
      console.error('Failed to schedule daily motivation:', error);
    }
  }

  private async getMotivationMessages() {
    return {
      MORNING_MESSAGES: [
        { title: '🌅 Good Morning!', body: 'Start your day with intention. What\'s your top priority today?' },
        { title: '☀️ Rise & Shine!', body: 'A new day means new opportunities. Let\'s make it count!' },
        { title: '🌞 Hello Champion!', body: 'Every morning is a fresh start. What will you accomplish today?' },
        { title: '🎯 Ready to Conquer?', body: 'Your tasks are waiting. Small steps lead to big achievements!' },
        { title: '💪 New Day, New Wins!', body: 'Yesterday is history. Today is your opportunity to shine!' },
      ],
      EVENING_MESSAGES: [
        { title: '🌙 Day\'s End Review', body: 'What did you accomplish today? Celebrate your progress!' },
        { title: '✨ Tomorrow Awaits', body: 'Rest well tonight. Tomorrow brings new opportunities!' },
        { title: '🌟 Daily Reflection', body: 'Take a moment to appreciate what you achieved today.' },
        { title: '😴 Wind Down', body: 'It\'s time to relax. You\'ve earned it!' },
        { title: '📝 Plan Ahead', body: 'Quick tip: Set your top 3 priorities for tomorrow before bed.' },
      ],
    };
  }
}

export const notificationManager = NotificationManager.getInstance();

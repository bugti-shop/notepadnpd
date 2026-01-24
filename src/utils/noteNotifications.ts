import { Note } from '@/types/note';
import { saveNotificationHistory } from '@/types/notificationHistory';
import { addMinutes, addHours, addDays, addWeeks } from 'date-fns';

// Calculate reminder time based on offset
const calculateReminderTime = (baseDate: Date, reminderOffset: string): Date => {
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
      const morningDate = new Date(baseDate);
      morningDate.setHours(9, 0, 0, 0);
      return morningDate;
    }
    case 'evening_before': {
      const eveningDate = addDays(baseDate, -1);
      eveningDate.setHours(18, 0, 0, 0);
      return eveningDate;
    }
    case '1day_9am': {
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
};

// Web-based notification implementation (fallback for non-Capacitor environments)
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

export const scheduleNoteReminder = async (note: Note): Promise<number | number[] | null> => {
  if (!note.reminderEnabled || !note.reminderTime) {
    return null;
  }

  try {
    const hasPermission = await requestNotificationPermission();

    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return null;
    }

    const reminderDate = new Date(note.reminderTime);
    const now = new Date();
    const recurring = note.reminderRecurring || 'none';

    if (recurring === 'none') {
      if (reminderDate <= now) {
        console.warn('Reminder time is in the past');
        return null;
      }

      const notificationId = note.notificationId || Date.now();
      const delay = reminderDate.getTime() - now.getTime();

      setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(note.title || 'Note Reminder', {
            body: note.content?.replace(/<[^>]*>/g, '').substring(0, 100) || 'You have a note reminder',
            icon: '/nota-logo.png',
          });
        }
      }, delay);

      console.log(`Scheduled notification ${notificationId} for ${reminderDate}`);
      return notificationId;
    }

    // For recurring reminders in web, we just schedule one
    const notificationId = Date.now();
    console.log(`Scheduled recurring notification ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

export const cancelNoteReminder = async (notificationId: number | number[]): Promise<void> => {
  console.log('Cancel notification:', notificationId);
};

export const updateNoteReminder = async (note: Note): Promise<number | number[] | null> => {
  if (note.notificationId) {
    await cancelNoteReminder(note.notificationId);
  }
  if (note.notificationIds && note.notificationIds.length > 0) {
    await cancelNoteReminder(note.notificationIds);
  }

  if (note.reminderEnabled && note.reminderTime) {
    return await scheduleNoteReminder(note);
  }

  return null;
};

export const getAllUpcomingReminders = async (): Promise<Array<{
  id: number;
  noteId: string;
  title: string;
  body: string;
  schedule: Date;
  recurring?: string;
}>> => {
  // Web implementation - return empty for now
  return [];
};

export const initializeNotificationListener = () => {
  console.log('Notification listener initialized');
};

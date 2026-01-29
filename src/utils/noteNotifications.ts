import { Note } from '@/types/note';
import { saveNotificationHistory } from '@/types/notificationHistory';
import { addMinutes, addHours, addDays, addWeeks } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Web-based notification implementation (fallback for non-Capacitor environments)
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    }
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

    if (reminderDate <= now && recurring === 'none') {
      console.warn('Reminder time is in the past');
      return null;
    }

    const notificationId = note.notificationId || Math.floor(Math.random() * 100000);
    const noteTitle = note.title || 'Note Reminder';
    const noteBody = note.content?.replace(/<[^>]*>/g, '').substring(0, 100) || 'You have a note reminder';

    if (Capacitor.isNativePlatform()) {
      // Use Capacitor Local Notifications on native
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: `📝 ${noteTitle}`,
          body: noteBody,
          schedule: { at: reminderDate },
          smallIcon: 'npd_notification_icon',
          largeIcon: 'npd_notification_icon',
          extra: { noteId: note.id, type: 'note_reminder' },
        }],
      });
      console.log(`[Note] Scheduled native notification ${notificationId} for ${reminderDate}`);
      return notificationId;
    } else {
      // Web fallback with setTimeout
      const delay = reminderDate.getTime() - now.getTime();
      if (delay > 0) {
        setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(noteTitle, {
              body: noteBody,
              icon: '/nota-logo.png',
            });
          }
        }, delay);
      }
      console.log(`[Note] Scheduled web notification ${notificationId} for ${reminderDate}`);
      return notificationId;
    }
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

export const cancelNoteReminder = async (notificationId: number | number[]): Promise<void> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const ids = Array.isArray(notificationId) ? notificationId : [notificationId];
      await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
    }
    console.log('Cancelled notification:', notificationId);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
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

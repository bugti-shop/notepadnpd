import { TodoItem } from '@/types/note';
import { GoogleCalendar, getAccessToken, isGoogleCalendarEnabled } from './googleCalendar';
import { loadTasksFromDB } from './taskStorage';
import { getSetting, setSetting } from './settingsStorage';

const CALENDAR_SYNC_ENABLED_KEY = 'calendarSyncEnabled';
const SELECTED_CALENDARS_KEY = 'selectedCalendars';
const LAST_SYNC_TIME_KEY = 'calendarLastSyncTime';

class CalendarSyncManager {
  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;

  async isCalendarSyncEnabled(): Promise<boolean> {
    return await getSetting<boolean>(CALENDAR_SYNC_ENABLED_KEY, false);
  }

  async setCalendarSyncEnabled(enabled: boolean): Promise<void> {
    await setSetting(CALENDAR_SYNC_ENABLED_KEY, enabled);
  }

  async getSelectedCalendars(): Promise<string[]> {
    return await getSetting<string[]>(SELECTED_CALENDARS_KEY, ['primary']);
  }

  async setSelectedCalendars(calendars: string[]): Promise<void> {
    await setSetting(SELECTED_CALENDARS_KEY, calendars);
  }

  async getLastSyncTime(): Promise<Date | null> {
    const stored = await getSetting<string | null>(LAST_SYNC_TIME_KEY, null);
    return stored ? new Date(stored) : null;
  }

  async setLastSyncTime(time: Date): Promise<void> {
    await setSetting(LAST_SYNC_TIME_KEY, time.toISOString());
  }

  async fetchAvailableCalendars(): Promise<GoogleCalendar[]> {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Not authenticated with Google');
      }

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch calendars');
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error fetching calendars:', error);
      return [];
    }
  }

  async importFromCalendar(): Promise<{ tasks: TodoItem[]; count: number }> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated with Google');
    }

    const selectedCalendars = await this.getSelectedCalendars();
    const tasks: TodoItem[] = [];

    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);

    for (const calendarId of selectedCalendars) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
            new URLSearchParams({
              timeMin: now.toISOString(),
              timeMax: futureDate.toISOString(),
              singleEvents: 'true',
              orderBy: 'startTime',
            }),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) continue;

        const data = await response.json();
        
        for (const event of data.items || []) {
          if (!event.summary) continue;

          const task: TodoItem = {
            id: `gcal-${event.id}`,
            text: event.summary,
            completed: false,
            description: event.description || '',
            dueDate: event.start?.dateTime 
              ? new Date(event.start.dateTime)
              : event.start?.date 
              ? new Date(event.start.date)
              : undefined,
            googleCalendarEventId: event.id,
          };

          tasks.push(task);
        }
      } catch (error) {
        console.error(`Error importing from calendar ${calendarId}:`, error);
      }
    }

    await this.setLastSyncTime(new Date());
    return { tasks, count: tasks.length };
  }

  async syncTwoWay(localTasks: TodoItem[]): Promise<{
    imported: TodoItem[];
    updated: number;
    conflicts: number;
  }> {
    const { tasks: importedTasks } = await this.importFromCalendar();
    
    const existingEventIds = new Set(
      localTasks
        .filter(t => t.googleCalendarEventId)
        .map(t => t.googleCalendarEventId)
    );

    const newTasks = importedTasks.filter(
      t => !existingEventIds.has(t.googleCalendarEventId)
    );

    await this.setLastSyncTime(new Date());

    return {
      imported: newTasks,
      updated: 0,
      conflicts: 0,
    };
  }

  async enableAutoSync(intervalMinutes: number = 15): Promise<void> {
    this.disableAutoSync();
    
    this.autoSyncInterval = setInterval(async () => {
      try {
        const isEnabled = await isGoogleCalendarEnabled();
        const syncEnabled = await this.isCalendarSyncEnabled();
        if (!isEnabled || !syncEnabled) {
          this.disableAutoSync();
          return;
        }

        const existingTasks = await loadTasksFromDB();
        await this.syncTwoWay(existingTasks);
      } catch (error) {
        console.error('Auto sync failed:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  disableAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }
}

export const calendarSyncManager = new CalendarSyncManager();
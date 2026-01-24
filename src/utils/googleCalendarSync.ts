// Google Calendar Sync Manager
import { CalendarEvent, TodoItem } from '@/types/note';
import { getSetting, setSetting } from './settingsStorage';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const CALENDAR_SYNC_KEY = 'google_calendar_sync_settings';
const SYNCED_EVENTS_KEY = 'google_calendar_synced_events';

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole: 'reader' | 'writer' | 'owner';
}

export interface CalendarSyncSettings {
  enabled: boolean;
  selectedCalendarId: string;
  syncTasksToCalendar: boolean;
  syncEventsFromCalendar: boolean;
  lastSyncTime?: string;
}

interface SyncedEventMapping {
  localId: string;
  googleEventId: string;
  calendarId: string;
  lastSynced: string;
}

export class GoogleCalendarSyncManager {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    return response;
  }

  // Get list of user's calendars
  async getCalendarList(): Promise<GoogleCalendarInfo[]> {
    try {
      const response = await this.makeRequest(`${CALENDAR_API_BASE}/users/me/calendarList`);
      
      if (!response.ok) return [];

      const data = await response.json();
      return data.items?.map((cal: any) => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
        primary: cal.primary,
        accessRole: cal.accessRole,
      })) || [];
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      return [];
    }
  }

  // Create a new event in Google Calendar
  async createEvent(calendarId: string, event: CalendarEvent): Promise<string | null> {
    try {
      const googleEvent = this.toGoogleEvent(event);
      
      const response = await this.makeRequest(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          body: JSON.stringify(googleEvent),
        }
      );

      if (!response.ok) {
        console.error('Failed to create event:', await response.text());
        return null;
      }

      const result = await response.json();
      
      // Save mapping
      await this.saveSyncMapping({
        localId: event.id,
        googleEventId: result.id,
        calendarId,
        lastSynced: new Date().toISOString(),
      });

      return result.id;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      return null;
    }
  }

  // Update an existing event
  async updateEvent(calendarId: string, googleEventId: string, event: CalendarEvent): Promise<boolean> {
    try {
      const googleEvent = this.toGoogleEvent(event);
      
      const response = await this.makeRequest(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
        {
          method: 'PUT',
          body: JSON.stringify(googleEvent),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      return false;
    }
  }

  // Delete an event
  async deleteEvent(calendarId: string, googleEventId: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        // Remove mapping
        await this.removeSyncMapping(googleEventId);
      }

      return response.ok;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      return false;
    }
  }

  // Get events from Google Calendar
  async getEvents(calendarId: string, timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> {
    try {
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });

      if (timeMin) params.set('timeMin', timeMin.toISOString());
      if (timeMax) params.set('timeMax', timeMax.toISOString());

      const response = await this.makeRequest(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.items?.map((item: any) => this.fromGoogleEvent(item)) || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  // Convert local CalendarEvent to Google Calendar format
  private toGoogleEvent(event: CalendarEvent): any {
    const googleEvent: any = {
      summary: event.title,
      description: event.description,
      location: event.location,
    };

    if (event.allDay) {
      googleEvent.start = {
        date: event.startDate.toISOString().split('T')[0],
        timeZone: event.timezone,
      };
      googleEvent.end = {
        date: event.endDate.toISOString().split('T')[0],
        timeZone: event.timezone,
      };
    } else {
      googleEvent.start = {
        dateTime: event.startDate.toISOString(),
        timeZone: event.timezone,
      };
      googleEvent.end = {
        dateTime: event.endDate.toISOString(),
        timeZone: event.timezone,
      };
    }

    // Handle recurrence
    if (event.repeat !== 'never') {
      const rrule = this.toRRule(event.repeat);
      if (rrule) googleEvent.recurrence = [rrule];
    }

    // Handle reminders
    if (event.reminder !== 'at_time') {
      const minutes = this.reminderToMinutes(event.reminder);
      googleEvent.reminders = {
        useDefault: false,
        overrides: [{ method: 'popup', minutes }],
      };
    }

    return googleEvent;
  }

  // Convert Google Calendar event to local format
  private fromGoogleEvent(item: any): CalendarEvent {
    const isAllDay = !!item.start?.date;
    
    return {
      id: `gcal-${item.id}`,
      title: item.summary || 'Untitled',
      description: item.description,
      location: item.location,
      allDay: isAllDay,
      startDate: new Date(isAllDay ? item.start.date : item.start.dateTime),
      endDate: new Date(isAllDay ? item.end.date : item.end.dateTime),
      timezone: item.start?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      repeat: this.fromRRule(item.recurrence),
      reminder: 'at_time',
      createdAt: new Date(item.created || Date.now()),
      updatedAt: new Date(item.updated || Date.now()),
    };
  }

  private toRRule(repeat: string): string | null {
    switch (repeat) {
      case 'daily': return 'RRULE:FREQ=DAILY';
      case 'weekly': return 'RRULE:FREQ=WEEKLY';
      case 'monthly': return 'RRULE:FREQ=MONTHLY';
      case 'yearly': return 'RRULE:FREQ=YEARLY';
      default: return null;
    }
  }

  private fromRRule(recurrence?: string[]): 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly' {
    if (!recurrence || recurrence.length === 0) return 'never';
    
    const rule = recurrence[0];
    if (rule.includes('FREQ=DAILY')) return 'daily';
    if (rule.includes('FREQ=WEEKLY')) return 'weekly';
    if (rule.includes('FREQ=MONTHLY')) return 'monthly';
    if (rule.includes('FREQ=YEARLY')) return 'yearly';
    return 'never';
  }

  private reminderToMinutes(reminder: string): number {
    switch (reminder) {
      case '5min': return 5;
      case '10min': return 10;
      case '15min': return 15;
      case '30min': return 30;
      case '1hour': return 60;
      case '1day': return 1440;
      default: return 10;
    }
  }

  // Sync mappings management
  private async getSyncMappings(): Promise<SyncedEventMapping[]> {
    return await getSetting<SyncedEventMapping[]>(SYNCED_EVENTS_KEY, []);
  }

  private async saveSyncMapping(mapping: SyncedEventMapping): Promise<void> {
    const mappings = await this.getSyncMappings();
    const index = mappings.findIndex(m => m.localId === mapping.localId);
    
    if (index >= 0) {
      mappings[index] = mapping;
    } else {
      mappings.push(mapping);
    }
    
    await setSetting(SYNCED_EVENTS_KEY, mappings);
  }

  private async removeSyncMapping(googleEventId: string): Promise<void> {
    const mappings = await this.getSyncMappings();
    const filtered = mappings.filter(m => m.googleEventId !== googleEventId);
    await setSetting(SYNCED_EVENTS_KEY, filtered);
  }

  async getMappingByLocalId(localId: string): Promise<SyncedEventMapping | null> {
    const mappings = await this.getSyncMappings();
    return mappings.find(m => m.localId === localId) || null;
  }

  // Sync a task to Google Calendar
  async syncTaskToCalendar(task: TodoItem, calendarId: string): Promise<string | null> {
    if (!task.dueDate) return null;

    const event: CalendarEvent = {
      id: task.id,
      title: task.text,
      description: task.description,
      location: task.location,
      allDay: !task.reminderTime,
      startDate: task.reminderTime || task.dueDate,
      endDate: new Date((task.reminderTime || task.dueDate).getTime() + 3600000), // 1 hour default
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      repeat: 'never',
      reminder: 'at_time',
      createdAt: task.createdAt || new Date(),
      updatedAt: task.modifiedAt || new Date(),
    };

    const existing = await this.getMappingByLocalId(task.id);
    
    if (existing) {
      await this.updateEvent(calendarId, existing.googleEventId, event);
      return existing.googleEventId;
    }

    return await this.createEvent(calendarId, event);
  }

  // Full calendar sync
  async performFullSync(): Promise<{
    imported: number;
    exported: number;
    errors: string[];
  }> {
    const settings = await getSetting<CalendarSyncSettings>(CALENDAR_SYNC_KEY, {
      enabled: false,
      selectedCalendarId: 'primary',
      syncTasksToCalendar: true,
      syncEventsFromCalendar: true,
    });

    const results = { imported: 0, exported: 0, errors: [] as string[] };

    if (!settings.enabled) return results;

    try {
      // Import events from Google Calendar
      if (settings.syncEventsFromCalendar) {
        const now = new Date();
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(now.getMonth() + 3);

        const events = await this.getEvents(settings.selectedCalendarId, now, threeMonthsLater);
        
        // Save imported events to local storage
        const existingEvents = await getSetting<CalendarEvent[]>('calendar_events', []);
        const newEvents = events.filter(e => !existingEvents.some(ex => ex.id === e.id));
        
        if (newEvents.length > 0) {
          await setSetting('calendar_events', [...existingEvents, ...newEvents]);
          results.imported = newEvents.length;
        }
      }

      // Update last sync time
      await setSetting(CALENDAR_SYNC_KEY, {
        ...settings,
        lastSyncTime: new Date().toISOString(),
      });
    } catch (error: any) {
      results.errors.push(error.message);
    }

    return results;
  }
}

// Settings management
export const getCalendarSyncSettings = async (): Promise<CalendarSyncSettings> => {
  return await getSetting<CalendarSyncSettings>(CALENDAR_SYNC_KEY, {
    enabled: false,
    selectedCalendarId: 'primary',
    syncTasksToCalendar: true,
    syncEventsFromCalendar: true,
  });
};

export const setCalendarSyncSettings = async (settings: Partial<CalendarSyncSettings>): Promise<void> => {
  const current = await getCalendarSyncSettings();
  await setSetting(CALENDAR_SYNC_KEY, { ...current, ...settings });
};

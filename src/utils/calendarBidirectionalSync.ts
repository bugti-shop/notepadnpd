// Bidirectional Real-time Google Calendar Sync Manager
// Syncs tasks and events between the app and Google Calendar in both directions

import { TodoItem, CalendarEvent } from '@/types/note';
import { loadTasksFromDB, saveTasksToDB, updateTaskInDB } from './taskStorage';
import { getSetting, setSetting } from './settingsStorage';
import { GoogleCalendarSyncManager, getCalendarSyncSettings, setCalendarSyncSettings } from './googleCalendarSync';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const CALENDAR_SYNC_TOKEN_KEY = 'google_calendar_sync_token';
const IMPORTED_EVENTS_KEY = 'google_calendar_imported_events';
const TASK_CALENDAR_MAPPINGS_KEY = 'task_to_calendar_mappings';

interface TaskCalendarMapping {
  taskId: string;
  googleEventId: string;
  calendarId: string;
  lastSyncedHash: string;
  lastSyncTime: string;
}

interface ImportedEvent {
  googleEventId: string;
  calendarId: string;
  localTaskId?: string;
  lastSyncedHash: string;
  lastSyncTime: string;
}

interface CalendarSyncState {
  isRunning: boolean;
  lastSyncTime?: string;
  syncToken?: string;
  importedEventsCount: number;
  exportedTasksCount: number;
}

// Global sync state
let calendarSyncInterval: ReturnType<typeof setInterval> | null = null;
let calendarSyncState: CalendarSyncState = {
  isRunning: false,
  importedEventsCount: 0,
  exportedTasksCount: 0,
};

// Hash function to detect changes
const hashItem = (item: any): string => {
  const normalized = JSON.stringify({
    title: item.title || item.text || item.summary,
    description: item.description,
    start: item.startDate || item.dueDate,
    end: item.endDate,
    location: item.location,
    completed: item.completed,
  });
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
};

export class CalendarBidirectionalSync {
  private accessToken: string;
  private calendarId: string;
  private calendarManager: GoogleCalendarSyncManager;

  constructor(accessToken: string, calendarId: string = 'primary') {
    this.accessToken = accessToken;
    this.calendarId = calendarId;
    this.calendarManager = new GoogleCalendarSyncManager(accessToken);
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

  // ============================================
  // IMPORT: Google Calendar → App
  // ============================================

  // Fetch all events from Google Calendar (with incremental sync support)
  async fetchGoogleCalendarEvents(fullSync: boolean = false): Promise<CalendarEvent[]> {
    try {
      const storedSyncToken = await getSetting<string | null>(CALENDAR_SYNC_TOKEN_KEY, null);
      
      let url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(this.calendarId)}/events?`;
      const params = new URLSearchParams({
        maxResults: '500',
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      if (!fullSync && storedSyncToken) {
        // Incremental sync using sync token
        params.set('syncToken', storedSyncToken);
      } else {
        // Full sync - get events from past month to 1 year ahead
        const timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - 1);
        const timeMax = new Date();
        timeMax.setFullYear(timeMax.getFullYear() + 1);
        
        params.set('timeMin', timeMin.toISOString());
        params.set('timeMax', timeMax.toISOString());
      }

      url += params.toString();

      const response = await this.makeRequest(url);
      
      if (response.status === 410) {
        // Sync token expired, do full sync
        console.log('[CalendarSync] Sync token expired, performing full sync...');
        return this.fetchGoogleCalendarEvents(true);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }

      const data = await response.json();
      
      // Save new sync token for incremental sync
      if (data.nextSyncToken) {
        await setSetting(CALENDAR_SYNC_TOKEN_KEY, data.nextSyncToken);
      }

      const events: CalendarEvent[] = (data.items || [])
        .filter((item: any) => item.status !== 'cancelled')
        .map((item: any) => this.googleEventToCalendarEvent(item));

      console.log(`[CalendarSync] Fetched ${events.length} events from Google Calendar`);
      return events;
    } catch (error) {
      console.error('[CalendarSync] Error fetching Google Calendar events:', error);
      return [];
    }
  }

  // Convert Google Calendar event to our CalendarEvent format
  private googleEventToCalendarEvent(item: any): CalendarEvent {
    const isAllDay = !!item.start?.date;
    
    return {
      id: `gcal-${item.id}`,
      title: item.summary || 'Untitled Event',
      description: item.description || '',
      location: item.location || '',
      allDay: isAllDay,
      startDate: new Date(isAllDay ? item.start.date : item.start.dateTime),
      endDate: new Date(isAllDay ? item.end.date : item.end.dateTime),
      timezone: item.start?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      repeat: this.parseRecurrence(item.recurrence),
      reminder: 'at_time',
      createdAt: new Date(item.created || Date.now()),
      updatedAt: new Date(item.updated || Date.now()),
    };
  }

  // Convert Google Calendar event to TodoItem for task integration
  private googleEventToTask(event: any, existingTask?: TodoItem): TodoItem {
    const isAllDay = !!event.start?.date;
    const startDate = new Date(isAllDay ? event.start.date : event.start.dateTime);
    
    return {
      id: existingTask?.id || `task-gcal-${event.id}`,
      text: event.summary || 'Untitled Event',
      description: event.description || '',
      location: event.location || '',
      completed: existingTask?.completed || false,
      dueDate: startDate,
      reminderTime: isAllDay ? undefined : startDate,
      priority: existingTask?.priority || 'medium',
      status: existingTask?.status || 'not_started',
      googleCalendarEventId: event.id,
      createdAt: existingTask?.createdAt || new Date(),
      modifiedAt: new Date(),
      tags: existingTask?.tags || ['calendar'],
      coloredTags: existingTask?.coloredTags || [{ name: 'Calendar', color: '#4285F4' }],
    };
  }

  private parseRecurrence(recurrence?: string[]): 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly' {
    if (!recurrence || recurrence.length === 0) return 'never';
    const rule = recurrence[0];
    if (rule.includes('FREQ=DAILY')) return 'daily';
    if (rule.includes('FREQ=WEEKLY')) return 'weekly';
    if (rule.includes('FREQ=MONTHLY')) return 'monthly';
    if (rule.includes('FREQ=YEARLY')) return 'yearly';
    return 'never';
  }

  // Import all events as tasks
  async importEventsAsTasks(): Promise<{ imported: number; updated: number }> {
    try {
      const events = await this.fetchGoogleCalendarEvents();
      const existingTasks = await loadTasksFromDB();
      const importedEvents = await getSetting<ImportedEvent[]>(IMPORTED_EVENTS_KEY, []);
      
      let importedCount = 0;
      let updatedCount = 0;
      const newImportedEvents: ImportedEvent[] = [...importedEvents];
      const updatedTasks = [...existingTasks];

      for (const eventData of events) {
        const googleEventId = eventData.id.replace('gcal-', '');
        const existingImport = importedEvents.find(e => e.googleEventId === googleEventId);
        const existingTask = existingTasks.find(t => t.googleCalendarEventId === googleEventId);
        
        // Fetch full event data for hash comparison
        const eventHash = hashItem(eventData);

        if (existingTask) {
          // Check if event was updated in Google Calendar
          if (!existingImport || existingImport.lastSyncedHash !== eventHash) {
            // Update existing task with new event data
            const taskIndex = updatedTasks.findIndex(t => t.id === existingTask.id);
            if (taskIndex >= 0) {
              updatedTasks[taskIndex] = {
                ...updatedTasks[taskIndex],
                text: eventData.title,
                description: eventData.description,
                location: eventData.location,
                dueDate: eventData.startDate,
                reminderTime: eventData.allDay ? undefined : eventData.startDate,
                modifiedAt: new Date(),
              };
              updatedCount++;
              
              // Update import record
              const importIndex = newImportedEvents.findIndex(e => e.googleEventId === googleEventId);
              if (importIndex >= 0) {
                newImportedEvents[importIndex].lastSyncedHash = eventHash;
                newImportedEvents[importIndex].lastSyncTime = new Date().toISOString();
              }
            }
          }
        } else {
          // Create new task from event
          const newTask: TodoItem = {
            id: `task-gcal-${googleEventId}`,
            text: eventData.title,
            description: eventData.description,
            location: eventData.location,
            completed: false,
            dueDate: eventData.startDate,
            reminderTime: eventData.allDay ? undefined : eventData.startDate,
            priority: 'medium',
            status: 'not_started',
            googleCalendarEventId: googleEventId,
            createdAt: new Date(),
            modifiedAt: new Date(),
            tags: ['calendar'],
            coloredTags: [{ name: 'Calendar', color: '#4285F4' }],
          };
          
          updatedTasks.push(newTask);
          importedCount++;
          
          // Record import
          newImportedEvents.push({
            googleEventId,
            calendarId: this.calendarId,
            localTaskId: newTask.id,
            lastSyncedHash: eventHash,
            lastSyncTime: new Date().toISOString(),
          });
        }
      }

      // Save updated tasks and import records
      if (importedCount > 0 || updatedCount > 0) {
        await saveTasksToDB(updatedTasks);
        await setSetting(IMPORTED_EVENTS_KEY, newImportedEvents);
        
        // Dispatch event to update UI
        window.dispatchEvent(new Event('tasksUpdated'));
        window.dispatchEvent(new CustomEvent('calendarSyncComplete', {
          detail: { imported: importedCount, updated: updatedCount }
        }));
      }

      console.log(`[CalendarSync] Imported: ${importedCount}, Updated: ${updatedCount} tasks from calendar`);
      return { imported: importedCount, updated: updatedCount };
    } catch (error) {
      console.error('[CalendarSync] Error importing events:', error);
      return { imported: 0, updated: 0 };
    }
  }

  // ============================================
  // EXPORT: App → Google Calendar
  // ============================================

  // Convert TodoItem to Google Calendar event format
  private taskToGoogleEvent(task: TodoItem): any {
    const hasTime = !!task.reminderTime;
    const startDate = task.reminderTime || task.dueDate;
    
    if (!startDate) return null;

    const event: any = {
      summary: task.text,
      description: task.description || '',
      location: task.location || '',
    };

    if (hasTime) {
      event.start = {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      event.end = {
        dateTime: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    } else {
      const dateStr = startDate.toISOString().split('T')[0];
      event.start = { date: dateStr };
      event.end = { date: dateStr };
    }

    // Handle completed status
    if (task.completed) {
      event.status = 'confirmed';
      event.summary = `✓ ${task.text}`;
    }

    return event;
  }

  // Sync a single task to Google Calendar
  async syncTaskToCalendar(task: TodoItem): Promise<string | null> {
    if (!task.dueDate) return null;

    try {
      const mappings = await getSetting<TaskCalendarMapping[]>(TASK_CALENDAR_MAPPINGS_KEY, []);
      const existingMapping = mappings.find(m => m.taskId === task.id);
      const googleEvent = this.taskToGoogleEvent(task);
      
      if (!googleEvent) return null;

      const taskHash = hashItem(task);

      if (existingMapping) {
        // Check if task has changed since last sync
        if (existingMapping.lastSyncedHash === taskHash) {
          console.log(`[CalendarSync] Task ${task.id} unchanged, skipping...`);
          return existingMapping.googleEventId;
        }

        // Update existing event
        const response = await this.makeRequest(
          `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(this.calendarId)}/events/${existingMapping.googleEventId}`,
          {
            method: 'PUT',
            body: JSON.stringify(googleEvent),
          }
        );

        if (response.ok) {
          // Update mapping
          const mappingIndex = mappings.findIndex(m => m.taskId === task.id);
          mappings[mappingIndex].lastSyncedHash = taskHash;
          mappings[mappingIndex].lastSyncTime = new Date().toISOString();
          await setSetting(TASK_CALENDAR_MAPPINGS_KEY, mappings);
          
          console.log(`[CalendarSync] Updated event for task: ${task.text}`);
          return existingMapping.googleEventId;
        } else if (response.status === 404) {
          // Event was deleted from calendar, create new one
          const newMapping = await this.createCalendarEvent(task, googleEvent, taskHash);
          return newMapping;
        }
      } else {
        // Create new event
        return await this.createCalendarEvent(task, googleEvent, taskHash);
      }

      return null;
    } catch (error) {
      console.error(`[CalendarSync] Error syncing task ${task.id}:`, error);
      return null;
    }
  }

  private async createCalendarEvent(task: TodoItem, googleEvent: any, taskHash: string): Promise<string | null> {
    try {
      const response = await this.makeRequest(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(this.calendarId)}/events`,
        {
          method: 'POST',
          body: JSON.stringify(googleEvent),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.status}`);
      }

      const result = await response.json();
      
      // Save mapping
      const mappings = await getSetting<TaskCalendarMapping[]>(TASK_CALENDAR_MAPPINGS_KEY, []);
      mappings.push({
        taskId: task.id,
        googleEventId: result.id,
        calendarId: this.calendarId,
        lastSyncedHash: taskHash,
        lastSyncTime: new Date().toISOString(),
      });
      await setSetting(TASK_CALENDAR_MAPPINGS_KEY, mappings);
      
      // Update task with calendar event ID
      await updateTaskInDB(task.id, { googleCalendarEventId: result.id });

      console.log(`[CalendarSync] Created event for task: ${task.text}`);
      return result.id;
    } catch (error) {
      console.error('[CalendarSync] Error creating event:', error);
      return null;
    }
  }

  // Delete calendar event when task is deleted
  async deleteCalendarEvent(taskId: string): Promise<boolean> {
    try {
      const mappings = await getSetting<TaskCalendarMapping[]>(TASK_CALENDAR_MAPPINGS_KEY, []);
      const mapping = mappings.find(m => m.taskId === taskId);
      
      if (!mapping) return true;

      const response = await this.makeRequest(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(this.calendarId)}/events/${mapping.googleEventId}`,
        { method: 'DELETE' }
      );

      // Remove mapping regardless of response (event might already be deleted)
      const newMappings = mappings.filter(m => m.taskId !== taskId);
      await setSetting(TASK_CALENDAR_MAPPINGS_KEY, newMappings);

      console.log(`[CalendarSync] Deleted event for task: ${taskId}`);
      return true;
    } catch (error) {
      console.error('[CalendarSync] Error deleting event:', error);
      return false;
    }
  }

  // Sync all tasks with due dates to calendar
  async syncAllTasksToCalendar(): Promise<{ synced: number; errors: number }> {
    try {
      const tasks = await loadTasksFromDB();
      const tasksWithDates = tasks.filter(t => t.dueDate && !t.completed);
      
      let synced = 0;
      let errors = 0;

      for (const task of tasksWithDates) {
        const result = await this.syncTaskToCalendar(task);
        if (result) {
          synced++;
        } else {
          errors++;
        }
      }

      console.log(`[CalendarSync] Synced ${synced} tasks to calendar (${errors} errors)`);
      return { synced, errors };
    } catch (error) {
      console.error('[CalendarSync] Error syncing all tasks:', error);
      return { synced: 0, errors: 1 };
    }
  }

  // ============================================
  // FULL BIDIRECTIONAL SYNC
  // ============================================

  async performFullSync(): Promise<{
    imported: number;
    updated: number;
    exported: number;
    errors: string[];
  }> {
    const results = {
      imported: 0,
      updated: 0,
      exported: 0,
      errors: [] as string[],
    };

    try {
      window.dispatchEvent(new CustomEvent('calendarSyncStatusChanged', {
        detail: { status: 'syncing' }
      }));

      // 1. Import events from Google Calendar
      console.log('[CalendarSync] Starting bidirectional sync...');
      const importResult = await this.importEventsAsTasks();
      results.imported = importResult.imported;
      results.updated = importResult.updated;

      // 2. Export tasks to Google Calendar
      const exportResult = await this.syncAllTasksToCalendar();
      results.exported = exportResult.synced;
      if (exportResult.errors > 0) {
        results.errors.push(`${exportResult.errors} tasks failed to sync`);
      }

      // Update sync settings
      await setCalendarSyncSettings({
        lastSyncTime: new Date().toISOString(),
      });

      window.dispatchEvent(new CustomEvent('calendarSyncStatusChanged', {
        detail: { 
          status: 'synced', 
          timestamp: new Date().toISOString(),
          ...results 
        }
      }));

      console.log(`[CalendarSync] Full sync complete:`, results);
    } catch (error: any) {
      console.error('[CalendarSync] Full sync error:', error);
      results.errors.push(error.message);
      
      window.dispatchEvent(new CustomEvent('calendarSyncStatusChanged', {
        detail: { status: 'error', message: error.message }
      }));
    }

    return results;
  }
}

// ============================================
// AUTO-SYNC MANAGEMENT
// ============================================

let syncInstance: CalendarBidirectionalSync | null = null;
let taskChangeDebounce: ReturnType<typeof setTimeout> | null = null;

export const startCalendarAutoSync = async (accessToken: string, intervalMinutes: number = 5): Promise<void> => {
  stopCalendarAutoSync();
  
  const settings = await getCalendarSyncSettings();
  const calendarId = settings.selectedCalendarId || 'primary';
  
  syncInstance = new CalendarBidirectionalSync(accessToken, calendarId);
  
  // Initial full sync
  await syncInstance.performFullSync();
  
  // Set up interval for periodic sync
  calendarSyncInterval = setInterval(async () => {
    if (syncInstance) {
      await syncInstance.performFullSync();
    }
  }, intervalMinutes * 60 * 1000);
  
  // Listen for task changes to sync immediately
  const handleTaskChange = async (event: Event) => {
    if (taskChangeDebounce) {
      clearTimeout(taskChangeDebounce);
    }
    
    // Debounce to prevent rapid-fire syncs
    taskChangeDebounce = setTimeout(async () => {
      if (syncInstance) {
        console.log('[CalendarSync] Task change detected, syncing...');
        await syncInstance.syncAllTasksToCalendar();
      }
    }, 2000); // 2 second debounce
  };
  
  window.addEventListener('tasksUpdated', handleTaskChange);
  window.addEventListener('taskCreated', handleTaskChange);
  window.addEventListener('taskDeleted', handleTaskChange);
  
  calendarSyncState.isRunning = true;
  
  // Store cleanup
  (calendarSyncInterval as any).__cleanup = () => {
    window.removeEventListener('tasksUpdated', handleTaskChange);
    window.removeEventListener('taskCreated', handleTaskChange);
    window.removeEventListener('taskDeleted', handleTaskChange);
    if (taskChangeDebounce) {
      clearTimeout(taskChangeDebounce);
    }
  };
  
  console.log(`[CalendarSync] Auto-sync started (${intervalMinutes} min interval)`);
};

export const stopCalendarAutoSync = (): void => {
  if (calendarSyncInterval) {
    if ((calendarSyncInterval as any).__cleanup) {
      (calendarSyncInterval as any).__cleanup();
    }
    clearInterval(calendarSyncInterval);
    calendarSyncInterval = null;
  }
  syncInstance = null;
  calendarSyncState.isRunning = false;
  console.log('[CalendarSync] Auto-sync stopped');
};

export const isCalendarSyncActive = (): boolean => {
  return calendarSyncState.isRunning;
};

export const getCalendarSyncState = (): CalendarSyncState => {
  return { ...calendarSyncState };
};

// Manual sync trigger
export const triggerCalendarSync = async (accessToken: string): Promise<void> => {
  const settings = await getCalendarSyncSettings();
  const sync = new CalendarBidirectionalSync(accessToken, settings.selectedCalendarId || 'primary');
  await sync.performFullSync();
};

// Get sync instance for direct use
export const getCalendarSyncInstance = (accessToken: string, calendarId?: string): CalendarBidirectionalSync => {
  return new CalendarBidirectionalSync(accessToken, calendarId || 'primary');
};

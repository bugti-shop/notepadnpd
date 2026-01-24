import { registerPlugin } from '@capacitor/core';
import { getSetting, setSetting } from '@/utils/settingsStorage';

/**
 * Capacitor Native Bridge Plugin for NPD Sync Managers
 * Connects React SyncSettings UI with Android Java sync/import managers
 */

// ============= Type Definitions =============

export interface CloudSyncSettings {
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number;
  wifiOnly: boolean;
}

export interface CalendarSyncSettings {
  enabled: boolean;
  twoWaySync: boolean;
  defaultCalendar: string;
}

export interface ConnectionStatus {
  connected: boolean;
  lastSync?: string;
  email?: string;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  itemsSynced?: number;
  conflicts?: number;
}

export interface ImportedTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  completed: boolean;
  source: string;
  sourceId: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  tasks: ImportedTask[];
  totalImported: number;
  errors?: string[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendarId: string;
}

export interface GoogleCalendar {
  id: string;
  name: string;
  color: string;
  primary: boolean;
}

// ============= Plugin Interface =============

export interface SyncBridgePlugin {
  // ---- Cloud Sync ----
  isCloudSyncEnabled(): Promise<{ enabled: boolean }>;
  setCloudSyncEnabled(options: { enabled: boolean }): Promise<void>;
  getCloudSyncSettings(): Promise<CloudSyncSettings>;
  setCloudSyncSettings(options: CloudSyncSettings): Promise<void>;
  syncNow(): Promise<SyncResult>;
  getLastSyncTime(): Promise<{ timestamp: string | null }>;
  
  // ---- Authentication ----
  isAuthenticated(): Promise<{ authenticated: boolean }>;
  signInWithGoogle(): Promise<{ success: boolean; email?: string; error?: string }>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<{ email: string | null; uid: string | null }>;

  // ---- Google Calendar ----
  isCalendarSyncEnabled(): Promise<{ enabled: boolean }>;
  setCalendarSyncEnabled(options: { enabled: boolean }): Promise<void>;
  getCalendarSettings(): Promise<CalendarSyncSettings>;
  setCalendarSettings(options: CalendarSyncSettings): Promise<void>;
  connectGoogleCalendar(): Promise<{ success: boolean; email?: string; error?: string }>;
  disconnectGoogleCalendar(): Promise<void>;
  getAvailableCalendars(): Promise<{ calendars: GoogleCalendar[] }>;
  setSelectedCalendars(options: { calendarIds: string[] }): Promise<void>;
  syncCalendarNow(): Promise<SyncResult>;

  // ---- Third-Party Integrations ----
  // ClickUp
  saveClickUpToken(options: { token: string }): Promise<{ success: boolean }>;
  getClickUpConnectionStatus(): Promise<ConnectionStatus>;
  disconnectClickUp(): Promise<void>;
  syncClickUp(): Promise<SyncResult>;

  // Notion
  saveNotionToken(options: { token: string }): Promise<{ success: boolean }>;
  getNotionConnectionStatus(): Promise<ConnectionStatus>;
  disconnectNotion(): Promise<void>;
  syncNotion(): Promise<SyncResult>;

  // HubSpot
  saveHubSpotToken(options: { token: string }): Promise<{ success: boolean }>;
  getHubSpotConnectionStatus(): Promise<ConnectionStatus>;
  disconnectHubSpot(): Promise<void>;
  syncHubSpot(): Promise<SyncResult>;

  // ---- Task Import ----
  // TickTick
  connectTickTick(): Promise<{ success: boolean; email?: string; error?: string }>;
  disconnectTickTick(): Promise<void>;
  getTickTickConnectionStatus(): Promise<ConnectionStatus>;
  importFromTickTick(): Promise<ImportResult>;

  // Todoist
  saveTodoistToken(options: { token: string }): Promise<{ success: boolean }>;
  disconnectTodoist(): Promise<void>;
  getTodoistConnectionStatus(): Promise<ConnectionStatus>;
  importFromTodoist(): Promise<ImportResult>;

  // Google Tasks
  connectGoogleTasks(): Promise<{ success: boolean; email?: string; error?: string }>;
  disconnectGoogleTasks(): Promise<void>;
  getGoogleTasksConnectionStatus(): Promise<ConnectionStatus>;
  importFromGoogleTasks(): Promise<ImportResult>;

  // Microsoft To Do
  connectMicrosoftTodo(): Promise<{ success: boolean; email?: string; error?: string }>;
  disconnectMicrosoftTodo(): Promise<void>;
  getMicrosoftTodoConnectionStatus(): Promise<ConnectionStatus>;
  importFromMicrosoftTodo(): Promise<ImportResult>;

  // Any.do (file-based import)
  importFromAnyDoFile(options: { fileUri: string }): Promise<ImportResult>;

  // ---- Utilities ----
  isNativeAvailable(): Promise<{ available: boolean }>;
  getNetworkStatus(): Promise<{ connected: boolean; type: 'wifi' | 'cellular' | 'none' }>;
}

// ============= Web Fallback Implementation =============

class SyncBridgeWeb implements SyncBridgePlugin {
  private cloudSyncSettings: CloudSyncSettings = {
    enabled: false,
    autoSync: true,
    syncInterval: 15,
    wifiOnly: false,
  };

  private calendarSettings: CalendarSyncSettings = {
    enabled: false,
    twoWaySync: true,
    defaultCalendar: '',
  };

  private tokens: Record<string, string> = {};
  private connections: Record<string, ConnectionStatus> = {};

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage() {
    try {
      const cloudSync = await getSetting<CloudSyncSettings | null>('npd-cloud-sync-settings', null);
      if (cloudSync) this.cloudSyncSettings = cloudSync;

      const calendar = await getSetting<CalendarSyncSettings | null>('npd-calendar-settings', null);
      if (calendar) this.calendarSettings = calendar;

      const tokens = await getSetting<Record<string, string> | null>('npd-integration-tokens', null);
      if (tokens) this.tokens = tokens;

      const connections = await getSetting<Record<string, ConnectionStatus> | null>('npd-connections', null);
      if (connections) this.connections = connections;
    } catch (e) {
      console.warn('Failed to load sync settings from storage:', e);
    }
  }

  private async saveToStorage() {
    await setSetting('npd-cloud-sync-settings', this.cloudSyncSettings);
    await setSetting('npd-calendar-settings', this.calendarSettings);
    await setSetting('npd-integration-tokens', this.tokens);
    await setSetting('npd-connections', this.connections);
  }

  // Cloud Sync
  async isCloudSyncEnabled(): Promise<{ enabled: boolean }> {
    return { enabled: this.cloudSyncSettings.enabled };
  }

  async setCloudSyncEnabled(options: { enabled: boolean }): Promise<void> {
    this.cloudSyncSettings.enabled = options.enabled;
    await this.saveToStorage();
  }

  async getCloudSyncSettings(): Promise<CloudSyncSettings> {
    return { ...this.cloudSyncSettings };
  }

  async setCloudSyncSettings(options: CloudSyncSettings): Promise<void> {
    this.cloudSyncSettings = { ...options };
    await this.saveToStorage();
  }

  async syncNow(): Promise<SyncResult> {
    await setSetting('npd-last-sync', new Date().toISOString());
    return { success: true, message: 'Sync completed (web fallback)', itemsSynced: 0 };
  }

  async getLastSyncTime(): Promise<{ timestamp: string | null }> {
    const timestamp = await getSetting<string | null>('npd-last-sync', null);
    return { timestamp };
  }

  // Authentication
  async isAuthenticated(): Promise<{ authenticated: boolean }> {
    return { authenticated: false };
  }

  async signInWithGoogle(): Promise<{ success: boolean; email?: string; error?: string }> {
    return { success: false, error: 'Native authentication required. Please use the mobile app.' };
  }

  async signOut(): Promise<void> {
    this.connections = {};
    await this.saveToStorage();
  }

  async getCurrentUser(): Promise<{ email: string | null; uid: string | null }> {
    return { email: null, uid: null };
  }

  // Google Calendar
  async isCalendarSyncEnabled(): Promise<{ enabled: boolean }> {
    return { enabled: this.calendarSettings.enabled };
  }

  async setCalendarSyncEnabled(options: { enabled: boolean }): Promise<void> {
    this.calendarSettings.enabled = options.enabled;
    await this.saveToStorage();
  }

  async getCalendarSettings(): Promise<CalendarSyncSettings> {
    return { ...this.calendarSettings };
  }

  async setCalendarSettings(options: CalendarSyncSettings): Promise<void> {
    this.calendarSettings = { ...options };
    await this.saveToStorage();
  }

  async connectGoogleCalendar(): Promise<{ success: boolean; email?: string; error?: string }> {
    return { success: false, error: 'Native Google Calendar connection required. Please use the mobile app.' };
  }

  async disconnectGoogleCalendar(): Promise<void> {
    delete this.connections['googleCalendar'];
    await this.saveToStorage();
  }

  async getAvailableCalendars(): Promise<{ calendars: GoogleCalendar[] }> {
    return { calendars: [] };
  }

  async setSelectedCalendars(options: { calendarIds: string[] }): Promise<void> {
    await setSetting('npd-selected-calendars', options.calendarIds);
  }

  async syncCalendarNow(): Promise<SyncResult> {
    return { success: false, message: 'Calendar sync requires native app' };
  }

  // ClickUp
  async saveClickUpToken(options: { token: string }): Promise<{ success: boolean }> {
    this.tokens['clickup'] = options.token;
    this.connections['clickup'] = { connected: true, lastSync: new Date().toISOString() };
    await this.saveToStorage();
    return { success: true };
  }

  async getClickUpConnectionStatus(): Promise<ConnectionStatus> {
    return this.connections['clickup'] || { connected: false };
  }

  async disconnectClickUp(): Promise<void> {
    delete this.tokens['clickup'];
    delete this.connections['clickup'];
    await this.saveToStorage();
  }

  async syncClickUp(): Promise<SyncResult> {
    if (!this.tokens['clickup']) {
      return { success: false, message: 'ClickUp not connected' };
    }
    return { success: true, message: 'ClickUp sync completed (web fallback)', itemsSynced: 0 };
  }

  // Notion
  async saveNotionToken(options: { token: string }): Promise<{ success: boolean }> {
    this.tokens['notion'] = options.token;
    this.connections['notion'] = { connected: true, lastSync: new Date().toISOString() };
    await this.saveToStorage();
    return { success: true };
  }

  async getNotionConnectionStatus(): Promise<ConnectionStatus> {
    return this.connections['notion'] || { connected: false };
  }

  async disconnectNotion(): Promise<void> {
    delete this.tokens['notion'];
    delete this.connections['notion'];
    await this.saveToStorage();
  }

  async syncNotion(): Promise<SyncResult> {
    if (!this.tokens['notion']) {
      return { success: false, message: 'Notion not connected' };
    }
    return { success: true, message: 'Notion sync completed (web fallback)', itemsSynced: 0 };
  }

  // HubSpot
  async saveHubSpotToken(options: { token: string }): Promise<{ success: boolean }> {
    this.tokens['hubspot'] = options.token;
    this.connections['hubspot'] = { connected: true, lastSync: new Date().toISOString() };
    await this.saveToStorage();
    return { success: true };
  }

  async getHubSpotConnectionStatus(): Promise<ConnectionStatus> {
    return this.connections['hubspot'] || { connected: false };
  }

  async disconnectHubSpot(): Promise<void> {
    delete this.tokens['hubspot'];
    delete this.connections['hubspot'];
    await this.saveToStorage();
  }

  async syncHubSpot(): Promise<SyncResult> {
    if (!this.tokens['hubspot']) {
      return { success: false, message: 'HubSpot not connected' };
    }
    return { success: true, message: 'HubSpot sync completed (web fallback)', itemsSynced: 0 };
  }

  // TickTick
  async connectTickTick(): Promise<{ success: boolean; email?: string; error?: string }> {
    return { success: false, error: 'TickTick OAuth requires native app' };
  }

  async disconnectTickTick(): Promise<void> {
    delete this.connections['ticktick'];
    await this.saveToStorage();
  }

  async getTickTickConnectionStatus(): Promise<ConnectionStatus> {
    return this.connections['ticktick'] || { connected: false };
  }

  async importFromTickTick(): Promise<ImportResult> {
    return { success: false, message: 'TickTick import requires native app', tasks: [], totalImported: 0 };
  }

  // Todoist
  async saveTodoistToken(options: { token: string }): Promise<{ success: boolean }> {
    this.tokens['todoist'] = options.token;
    this.connections['todoist'] = { connected: true, lastSync: new Date().toISOString() };
    await this.saveToStorage();
    return { success: true };
  }

  async disconnectTodoist(): Promise<void> {
    delete this.tokens['todoist'];
    delete this.connections['todoist'];
    await this.saveToStorage();
  }

  async getTodoistConnectionStatus(): Promise<ConnectionStatus> {
    return this.connections['todoist'] || { connected: false };
  }

  async importFromTodoist(): Promise<ImportResult> {
    if (!this.tokens['todoist']) {
      return { success: false, message: 'Todoist not connected', tasks: [], totalImported: 0 };
    }
    return { success: true, message: 'Import requires native app for full functionality', tasks: [], totalImported: 0 };
  }

  // Google Tasks
  async connectGoogleTasks(): Promise<{ success: boolean; email?: string; error?: string }> {
    return { success: false, error: 'Google Tasks requires native app' };
  }

  async disconnectGoogleTasks(): Promise<void> {
    delete this.connections['googleTasks'];
    await this.saveToStorage();
  }

  async getGoogleTasksConnectionStatus(): Promise<ConnectionStatus> {
    return this.connections['googleTasks'] || { connected: false };
  }

  async importFromGoogleTasks(): Promise<ImportResult> {
    return { success: false, message: 'Google Tasks import requires native app', tasks: [], totalImported: 0 };
  }

  // Microsoft To Do
  async connectMicrosoftTodo(): Promise<{ success: boolean; email?: string; error?: string }> {
    return { success: false, error: 'Microsoft To Do requires native app' };
  }

  async disconnectMicrosoftTodo(): Promise<void> {
    delete this.connections['microsoftTodo'];
    await this.saveToStorage();
  }

  async getMicrosoftTodoConnectionStatus(): Promise<ConnectionStatus> {
    return this.connections['microsoftTodo'] || { connected: false };
  }

  async importFromMicrosoftTodo(): Promise<ImportResult> {
    return { success: false, message: 'Microsoft To Do import requires native app', tasks: [], totalImported: 0 };
  }

  // Any.do
  async importFromAnyDoFile(options: { fileUri: string }): Promise<ImportResult> {
    console.log('Importing from Any.do file:', options.fileUri);
    return { success: false, message: 'File import requires native app', tasks: [], totalImported: 0 };
  }

  // Utilities
  async isNativeAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  }

  async getNetworkStatus(): Promise<{ connected: boolean; type: 'wifi' | 'cellular' | 'none' }> {
    return { connected: navigator.onLine, type: navigator.onLine ? 'wifi' : 'none' };
  }
}

// ============= Plugin Registration =============

const SyncBridge = registerPlugin<SyncBridgePlugin>('SyncBridge', {
  web: () => Promise.resolve(new SyncBridgeWeb()),
});

export default SyncBridge;

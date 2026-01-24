import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import SyncBridge, { 
  CloudSyncSettings, 
  CalendarSyncSettings, 
  ConnectionStatus,
  SyncResult,
  ImportResult 
} from '@/plugins/SyncBridgePlugin';

/**
 * React hook for using the SyncBridge Capacitor plugin
 * Provides reactive state and methods for sync/import operations
 */
export function useSyncBridge() {
  const [isNative, setIsNative] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Cloud Sync State
  const [cloudSyncSettings, setCloudSyncSettings] = useState<CloudSyncSettings>({
    enabled: false,
    autoSync: true,
    syncInterval: 15,
    wifiOnly: false,
  });
  
  // Calendar State
  const [calendarSettings, setCalendarSettings] = useState<CalendarSyncSettings>({
    enabled: false,
    twoWaySync: true,
    defaultCalendar: '',
  });
  
  // Connection States
  const [connections, setConnections] = useState<{
    clickup: ConnectionStatus;
    notion: ConnectionStatus;
    hubspot: ConnectionStatus;
    ticktick: ConnectionStatus;
    todoist: ConnectionStatus;
    googleTasks: ConnectionStatus;
    microsoftTodo: ConnectionStatus;
    googleCalendar: ConnectionStatus;
  }>({
    clickup: { connected: false },
    notion: { connected: false },
    hubspot: { connected: false },
    ticktick: { connected: false },
    todoist: { connected: false },
    googleTasks: { connected: false },
    microsoftTodo: { connected: false },
    googleCalendar: { connected: false },
  });

  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const native = Capacitor.isNativePlatform();
        setIsNative(native);

        // Load settings
        const [cloudSettings, calSettings, lastSync] = await Promise.all([
          SyncBridge.getCloudSyncSettings(),
          SyncBridge.getCalendarSettings(),
          SyncBridge.getLastSyncTime(),
        ]);

        setCloudSyncSettings(cloudSettings);
        setCalendarSettings(calSettings);
        setLastSyncTime(lastSync.timestamp);

        // Load connection statuses
        await refreshConnectionStatuses();
      } catch (error) {
        console.error('Failed to initialize SyncBridge:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const refreshConnectionStatuses = useCallback(async () => {
    try {
      const [clickup, notion, hubspot, ticktick, todoist, googleTasks, microsoftTodo] = await Promise.all([
        SyncBridge.getClickUpConnectionStatus(),
        SyncBridge.getNotionConnectionStatus(),
        SyncBridge.getHubSpotConnectionStatus(),
        SyncBridge.getTickTickConnectionStatus(),
        SyncBridge.getTodoistConnectionStatus(),
        SyncBridge.getGoogleTasksConnectionStatus(),
        SyncBridge.getMicrosoftTodoConnectionStatus(),
      ]);

      setConnections({
        clickup,
        notion,
        hubspot,
        ticktick,
        todoist,
        googleTasks,
        microsoftTodo,
        googleCalendar: connections.googleCalendar,
      });
    } catch (error) {
      console.error('Failed to refresh connection statuses:', error);
    }
  }, [connections.googleCalendar]);

  // Cloud Sync Methods
  const updateCloudSyncSettings = useCallback(async (settings: Partial<CloudSyncSettings>) => {
    const newSettings = { ...cloudSyncSettings, ...settings };
    await SyncBridge.setCloudSyncSettings(newSettings);
    setCloudSyncSettings(newSettings);
  }, [cloudSyncSettings]);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    const result = await SyncBridge.syncNow();
    if (result.success) {
      const { timestamp } = await SyncBridge.getLastSyncTime();
      setLastSyncTime(timestamp);
    }
    return result;
  }, []);

  // Calendar Methods
  const updateCalendarSettings = useCallback(async (settings: Partial<CalendarSyncSettings>) => {
    const newSettings = { ...calendarSettings, ...settings };
    await SyncBridge.setCalendarSettings(newSettings);
    setCalendarSettings(newSettings);
  }, [calendarSettings]);

  const connectGoogleCalendar = useCallback(async () => {
    const result = await SyncBridge.connectGoogleCalendar();
    if (result.success) {
      setConnections(prev => ({
        ...prev,
        googleCalendar: { connected: true, email: result.email },
      }));
    }
    return result;
  }, []);

  const disconnectGoogleCalendar = useCallback(async () => {
    await SyncBridge.disconnectGoogleCalendar();
    setConnections(prev => ({
      ...prev,
      googleCalendar: { connected: false },
    }));
  }, []);

  // Integration Methods
  const saveApiToken = useCallback(async (
    service: 'clickup' | 'notion' | 'hubspot' | 'todoist',
    token: string
  ): Promise<{ success: boolean }> => {
    let result: { success: boolean };
    
    switch (service) {
      case 'clickup':
        result = await SyncBridge.saveClickUpToken({ token });
        break;
      case 'notion':
        result = await SyncBridge.saveNotionToken({ token });
        break;
      case 'hubspot':
        result = await SyncBridge.saveHubSpotToken({ token });
        break;
      case 'todoist':
        result = await SyncBridge.saveTodoistToken({ token });
        break;
    }

    if (result.success) {
      await refreshConnectionStatuses();
    }
    return result;
  }, [refreshConnectionStatuses]);

  const disconnectService = useCallback(async (
    service: 'clickup' | 'notion' | 'hubspot' | 'ticktick' | 'todoist' | 'googleTasks' | 'microsoftTodo'
  ) => {
    switch (service) {
      case 'clickup':
        await SyncBridge.disconnectClickUp();
        break;
      case 'notion':
        await SyncBridge.disconnectNotion();
        break;
      case 'hubspot':
        await SyncBridge.disconnectHubSpot();
        break;
      case 'ticktick':
        await SyncBridge.disconnectTickTick();
        break;
      case 'todoist':
        await SyncBridge.disconnectTodoist();
        break;
      case 'googleTasks':
        await SyncBridge.disconnectGoogleTasks();
        break;
      case 'microsoftTodo':
        await SyncBridge.disconnectMicrosoftTodo();
        break;
    }
    await refreshConnectionStatuses();
  }, [refreshConnectionStatuses]);

  // OAuth Connect Methods
  const connectOAuthService = useCallback(async (
    service: 'ticktick' | 'googleTasks' | 'microsoftTodo'
  ): Promise<{ success: boolean; email?: string; error?: string }> => {
    let result: { success: boolean; email?: string; error?: string };
    
    switch (service) {
      case 'ticktick':
        result = await SyncBridge.connectTickTick();
        break;
      case 'googleTasks':
        result = await SyncBridge.connectGoogleTasks();
        break;
      case 'microsoftTodo':
        result = await SyncBridge.connectMicrosoftTodo();
        break;
    }

    if (result.success) {
      await refreshConnectionStatuses();
    }
    return result;
  }, [refreshConnectionStatuses]);

  // Import Methods
  const importTasks = useCallback(async (
    source: 'ticktick' | 'todoist' | 'googleTasks' | 'microsoftTodo'
  ): Promise<ImportResult> => {
    switch (source) {
      case 'ticktick':
        return SyncBridge.importFromTickTick();
      case 'todoist':
        return SyncBridge.importFromTodoist();
      case 'googleTasks':
        return SyncBridge.importFromGoogleTasks();
      case 'microsoftTodo':
        return SyncBridge.importFromMicrosoftTodo();
    }
  }, []);

  const importFromAnyDoFile = useCallback(async (fileUri: string): Promise<ImportResult> => {
    return SyncBridge.importFromAnyDoFile({ fileUri });
  }, []);

  // Sync Integration Methods
  const syncIntegration = useCallback(async (
    service: 'clickup' | 'notion' | 'hubspot'
  ): Promise<SyncResult> => {
    switch (service) {
      case 'clickup':
        return SyncBridge.syncClickUp();
      case 'notion':
        return SyncBridge.syncNotion();
      case 'hubspot':
        return SyncBridge.syncHubSpot();
    }
  }, []);

  return {
    // State
    isNative,
    isLoading,
    cloudSyncSettings,
    calendarSettings,
    connections,
    lastSyncTime,

    // Cloud Sync
    updateCloudSyncSettings,
    syncNow,

    // Calendar
    updateCalendarSettings,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    getAvailableCalendars: SyncBridge.getAvailableCalendars,
    setSelectedCalendars: SyncBridge.setSelectedCalendars,
    syncCalendar: SyncBridge.syncCalendarNow,

    // Integrations
    saveApiToken,
    disconnectService,
    syncIntegration,

    // OAuth Services
    connectOAuthService,

    // Import
    importTasks,
    importFromAnyDoFile,

    // Utilities
    refreshConnectionStatuses,
    getNetworkStatus: SyncBridge.getNetworkStatus,
  };
}

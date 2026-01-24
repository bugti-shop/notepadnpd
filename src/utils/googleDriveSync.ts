// Google Drive Sync Manager for app data backup
import { Note, TodoItem, Folder, TaskSection } from '@/types/note';
import { loadNotesFromDB, saveNotesToDB } from './noteStorage';
import { loadTasksFromDB, saveTasksToDB } from './taskStorage';
import { getSetting, setSetting, getAllSettings } from './settingsStorage';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const BACKUP_FILENAME = 'npd_app_backup.json';
const SYNC_METADATA_KEY = 'google_drive_sync_metadata';

interface SyncMetadata {
  lastSyncTime: string;
  lastLocalChange: string;
  driveFileId?: string;
  version: number;
}

interface BackupData {
  version: number;
  timestamp: string;
  notes: Note[];
  tasks: TodoItem[];
  notesFolders: Folder[];
  todoFolders: any[];
  todoSections: TaskSection[];
  settings: Record<string, any>;
  activityLog: any[];
}

export class GoogleDriveSyncManager {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    return response;
  }

  // Find or create backup file in appDataFolder
  async getBackupFileId(): Promise<string | null> {
    try {
      const response = await this.makeRequest(
        `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id,name,modifiedTime)`
      );

      if (!response.ok) return null;

      const data = await response.json();
      return data.files?.[0]?.id || null;
    } catch (error) {
      console.error('Error getting backup file ID:', error);
      return null;
    }
  }

  // Collect all app data for backup
  async collectBackupData(): Promise<BackupData> {
    const [notes, tasks, notesFolders, todoFolders, todoSections, settings, activityLog] = await Promise.all([
      loadNotesFromDB(),
      loadTasksFromDB(),
      getSetting<Folder[]>('folders', []),
      getSetting<any[]>('todoFolders', []),
      getSetting<TaskSection[]>('todoSections', []),
      getAllSettings(),
      getSetting<any[]>('activity_log', []),
    ]);

    // Exclude sync metadata from backup settings
    const cleanSettings = { ...settings };
    delete cleanSettings[SYNC_METADATA_KEY];
    delete cleanSettings['google_user'];
    delete cleanSettings['google_tokens'];

    return {
      version: 2,
      timestamp: new Date().toISOString(),
      notes,
      tasks,
      notesFolders,
      todoFolders,
      todoSections,
      settings: cleanSettings,
      activityLog,
    };
  }

  // Upload backup to Google Drive appDataFolder
  async uploadBackup(data: BackupData): Promise<{ success: boolean; fileId?: string }> {
    try {
      const existingFileId = await this.getBackupFileId();
      const jsonData = JSON.stringify(data);
      const blob = new Blob([jsonData], { type: 'application/json' });

      let response: Response;

      if (existingFileId) {
        // Update existing file
        response = await this.makeRequest(
          `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
          {
            method: 'PATCH',
            body: blob,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } else {
        // Create new file in appDataFolder
        const metadata = {
          name: BACKUP_FILENAME,
          parents: ['appDataFolder'],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        response = await this.makeRequest(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            body: form,
          }
        );
      }

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Update sync metadata
      const metadata: SyncMetadata = {
        lastSyncTime: new Date().toISOString(),
        lastLocalChange: data.timestamp,
        driveFileId: result.id,
        version: data.version,
      };
      await setSetting(SYNC_METADATA_KEY, metadata);

      return { success: true, fileId: result.id };
    } catch (error) {
      console.error('Error uploading backup:', error);
      return { success: false };
    }
  }

  // Download backup from Google Drive
  async downloadBackup(): Promise<BackupData | null> {
    try {
      const fileId = await this.getBackupFileId();
      if (!fileId) return null;

      const response = await this.makeRequest(
        `${DRIVE_API_BASE}/files/${fileId}?alt=media`
      );

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error('Error downloading backup:', error);
      return null;
    }
  }

  // Restore data from backup
  async restoreFromBackup(data: BackupData): Promise<boolean> {
    try {
      // Hydrate dates for notes
      const hydratedNotes = data.notes.map((n: any) => ({
        ...n,
        createdAt: new Date(n.createdAt),
        updatedAt: new Date(n.updatedAt),
        archivedAt: n.archivedAt ? new Date(n.archivedAt) : undefined,
        deletedAt: n.deletedAt ? new Date(n.deletedAt) : undefined,
        reminderTime: n.reminderTime ? new Date(n.reminderTime) : undefined,
        voiceRecordings: n.voiceRecordings?.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp),
        })) || [],
      }));

      // Hydrate dates for tasks
      const hydratedTasks = data.tasks.map((t: any) => ({
        ...t,
        dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
        reminderTime: t.reminderTime ? new Date(t.reminderTime) : undefined,
        createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
        modifiedAt: t.modifiedAt ? new Date(t.modifiedAt) : undefined,
        completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
      }));

      // Hydrate folders
      const hydratedFolders = data.notesFolders.map((f: any) => ({
        ...f,
        createdAt: new Date(f.createdAt),
      }));

      // Save all data
      await Promise.all([
        saveNotesToDB(hydratedNotes),
        saveTasksToDB(hydratedTasks),
        setSetting('folders', hydratedFolders),
        setSetting('todoFolders', data.todoFolders),
        setSetting('todoSections', data.todoSections),
        setSetting('activity_log', data.activityLog || []),
      ]);

      // Restore other settings
      for (const [key, value] of Object.entries(data.settings)) {
        if (!['folders', 'todoFolders', 'todoSections', 'activity_log'].includes(key)) {
          await setSetting(key, value);
        }
      }

      // Update sync metadata
      const metadata: SyncMetadata = {
        lastSyncTime: new Date().toISOString(),
        lastLocalChange: data.timestamp,
        version: data.version,
      };
      await setSetting(SYNC_METADATA_KEY, metadata);

      // Dispatch events to refresh UI
      window.dispatchEvent(new Event('notesUpdated'));
      window.dispatchEvent(new Event('tasksUpdated'));
      window.dispatchEvent(new Event('foldersUpdated'));

      return true;
    } catch (error) {
      console.error('Error restoring backup:', error);
      return false;
    }
  }

  // Get cloud backup info
  async getCloudBackupInfo(): Promise<{ exists: boolean; lastModified?: Date; size?: number } | null> {
    try {
      const response = await this.makeRequest(
        `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id,name,modifiedTime,size)`
      );

      if (!response.ok) return null;

      const data = await response.json();
      const file = data.files?.[0];

      if (!file) {
        return { exists: false };
      }

      return {
        exists: true,
        lastModified: new Date(file.modifiedTime),
        size: parseInt(file.size) || 0,
      };
    } catch (error) {
      console.error('Error getting backup info:', error);
      return null;
    }
  }

  // Full sync: Compare local and cloud, merge or upload
  async performSync(): Promise<{ 
    success: boolean; 
    action: 'uploaded' | 'downloaded' | 'merged' | 'none'; 
    error?: string 
  }> {
    try {
      const [localData, cloudData, metadata] = await Promise.all([
        this.collectBackupData(),
        this.downloadBackup(),
        getSetting<SyncMetadata | null>(SYNC_METADATA_KEY, null),
      ]);

      if (!cloudData) {
        // No cloud backup, upload local data
        const result = await this.uploadBackup(localData);
        return { 
          success: result.success, 
          action: result.success ? 'uploaded' : 'none',
          error: result.success ? undefined : 'Upload failed'
        };
      }

      const cloudTime = new Date(cloudData.timestamp).getTime();
      const localTime = new Date(localData.timestamp).getTime();

      // If cloud is newer, download and merge
      if (cloudTime > localTime) {
        await this.restoreFromBackup(cloudData);
        return { success: true, action: 'downloaded' };
      }

      // If local is newer, upload
      if (localTime > cloudTime) {
        const result = await this.uploadBackup(localData);
        return { 
          success: result.success, 
          action: result.success ? 'uploaded' : 'none' 
        };
      }

      // Same timestamp, no action needed
      return { success: true, action: 'none' };
    } catch (error: any) {
      console.error('Sync error:', error);
      return { 
        success: false, 
        action: 'none', 
        error: error.message === 'UNAUTHORIZED' ? 'Session expired' : 'Sync failed' 
      };
    }
  }
}

// Singleton for easy access
let syncManagerInstance: GoogleDriveSyncManager | null = null;

export const getGoogleDriveSyncManager = (accessToken: string): GoogleDriveSyncManager => {
  if (!syncManagerInstance || syncManagerInstance['accessToken'] !== accessToken) {
    syncManagerInstance = new GoogleDriveSyncManager(accessToken);
  }
  return syncManagerInstance;
};

// Network status tracking
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let pendingSync = false;

// Auto-sync interval management (reduced to 1 minute for faster sync)
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

export const startAutoSync = (accessToken: string, intervalMinutes: number = 1): void => {
  stopAutoSync();
  
  const sync = async () => {
    if (!isOnline) {
      pendingSync = true;
      console.log('[Sync] Offline - sync pending');
      return;
    }
    
    const manager = getGoogleDriveSyncManager(accessToken);
    const result = await manager.performSync();
    
    if (result.success) {
      window.dispatchEvent(new CustomEvent('syncStatusChanged', { 
        detail: { status: 'synced', timestamp: new Date().toISOString() } 
      }));
    }
  };

  // Set up network listeners for instant sync when coming back online
  const handleOnline = () => {
    isOnline = true;
    console.log('[Sync] Back online');
    if (pendingSync) {
      console.log('[Sync] Syncing pending changes...');
      pendingSync = false;
      sync();
    }
  };

  const handleOffline = () => {
    isOnline = false;
    console.log('[Sync] Went offline');
    window.dispatchEvent(new CustomEvent('syncStatusChanged', { 
      detail: { status: 'offline' } 
    }));
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial sync
  sync();

  // Background interval sync (1 minute fallback)
  autoSyncInterval = setInterval(sync, intervalMinutes * 60 * 1000);
  
  // Store cleanup functions
  (autoSyncInterval as any).__cleanup = () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

export const stopAutoSync = (): void => {
  if (autoSyncInterval) {
    if ((autoSyncInterval as any).__cleanup) {
      (autoSyncInterval as any).__cleanup();
    }
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
};

// Listen for local changes to trigger INSTANT sync
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isUploading = false;

export const setupChangeListeners = (accessToken: string): () => void => {
  const handleChange = async () => {
    // Clear any existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Very short debounce (500ms) for instant feel while preventing rapid-fire uploads
    debounceTimer = setTimeout(async () => {
      if (!isOnline) {
        console.log('[Sync] Offline - queuing change for later');
        pendingSync = true;
        return;
      }
      
      if (isUploading) {
        console.log('[Sync] Upload in progress, will retry...');
        pendingSync = true;
        return;
      }
      
      try {
        isUploading = true;
        window.dispatchEvent(new CustomEvent('syncStatusChanged', { 
          detail: { status: 'syncing' } 
        }));
        
        console.log('[Sync] Instant sync triggered...');
        const manager = getGoogleDriveSyncManager(accessToken);
        const data = await manager.collectBackupData();
        const result = await manager.uploadBackup(data);
        
        if (result.success) {
          console.log('[Sync] Instant sync complete');
          window.dispatchEvent(new CustomEvent('syncStatusChanged', { 
            detail: { status: 'synced', timestamp: new Date().toISOString() } 
          }));
        } else {
          console.error('[Sync] Upload failed');
          window.dispatchEvent(new CustomEvent('syncStatusChanged', { 
            detail: { status: 'error', message: 'Upload failed' } 
          }));
        }
      } catch (error) {
        console.error('[Sync] Error during upload:', error);
        window.dispatchEvent(new CustomEvent('syncStatusChanged', { 
          detail: { status: 'error', message: 'Sync error' } 
        }));
      } finally {
        isUploading = false;
        
        // If there was a pending change while uploading, sync again
        if (pendingSync) {
          pendingSync = false;
          handleChange();
        }
      }
    }, 500); // 500ms debounce for instant sync
  };

  // Listen for all data change events
  window.addEventListener('notesUpdated', handleChange);
  window.addEventListener('tasksUpdated', handleChange);
  window.addEventListener('foldersUpdated', handleChange);
  
  console.log('[Sync] Instant sync listeners active');

  return () => {
    window.removeEventListener('notesUpdated', handleChange);
    window.removeEventListener('tasksUpdated', handleChange);
    window.removeEventListener('foldersUpdated', handleChange);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    console.log('[Sync] Change listeners removed');
  };
};

// Check if sync is currently active
export const isSyncActive = (): boolean => {
  return autoSyncInterval !== null;
};

// Check network status
export const isNetworkOnline = (): boolean => {
  return isOnline;
};

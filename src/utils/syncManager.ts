// Simplified sync manager using IndexedDB storage
import { getSetting, setSetting } from '@/utils/settingsStorage';

const STORAGE_KEYS = {
  NOTES: 'nota-notes',
  FOLDERS: 'nota-folders',
  TODO_ITEMS: 'nota-todo-items',
  LAST_SYNC: 'nota-last-sync',
  SYNC_ENABLED: 'nota-sync-enabled',
};

class SyncManager {
  private static instance: SyncManager;
  private syncEnabled: boolean | null = null;
  private lastSyncTime: Date | null = null;

  private constructor() {
    this.loadSettings();
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private async loadSettings() {
    this.syncEnabled = await getSetting(STORAGE_KEYS.SYNC_ENABLED, false);
    const lastSync = await getSetting<string | null>(STORAGE_KEYS.LAST_SYNC, null);
    this.lastSyncTime = lastSync ? new Date(lastSync) : null;
  }

  isSyncEnabled(): boolean {
    return this.syncEnabled ?? false;
  }

  async setSyncEnabled(enabled: boolean) {
    this.syncEnabled = enabled;
    await setSetting(STORAGE_KEYS.SYNC_ENABLED, enabled);
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  private async setLastSyncTime() {
    const now = new Date();
    this.lastSyncTime = now;
    await setSetting(STORAGE_KEYS.LAST_SYNC, now.toISOString());
  }

  async isAuthenticated(): Promise<boolean> {
    return false;
  }

  async syncAllData(): Promise<{
    success: boolean;
    error?: string;
    conflicts?: number;
  }> {
    // Local only - no sync needed
    await this.setLastSyncTime();
    return { success: true };
  }

  async updateProfileSyncTime(): Promise<void> {
    await this.setLastSyncTime();
  }
}

export const syncManager = SyncManager.getInstance();

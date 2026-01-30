import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getSetting, setSetting } from './settingsStorage';

// Persistent notification IDs
const PERSISTENT_NOTIFICATION_ID = 888888;
const PERSISTENT_ACTION_TYPE_ID = 'PERSISTENT_QUICK_ADD';

// Storage keys
const STORAGE_KEYS = {
  ENABLED: 'persistent_notification_enabled',
};

export interface PersistentNotificationManager {
  initialize: () => Promise<void>;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  isEnabled: () => Promise<boolean>;
  handleAction: (actionId: string) => void;
}

class PersistentNotificationService implements PersistentNotificationManager {
  private static instance: PersistentNotificationService;
  private actionListeners: ((actionId: string) => void)[] = [];

  private constructor() {}

  static getInstance(): PersistentNotificationService {
    if (!PersistentNotificationService.instance) {
      PersistentNotificationService.instance = new PersistentNotificationService();
    }
    return PersistentNotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[PersistentNotification] Not on native platform, skipping');
      return;
    }

    try {
      // Register action types for persistent notification
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: PERSISTENT_ACTION_TYPE_ID,
            actions: [
              {
                id: 'add_note',
                title: '📝 Add Note',
              },
              {
                id: 'add_task',
                title: '✅ Add Task',
              },
            ],
          },
        ],
      });

      // Setup action listener
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        if (action.notification.id === PERSISTENT_NOTIFICATION_ID) {
          const actionId = action.actionId;
          console.log('[PersistentNotification] Action performed:', actionId);
          
          // Dispatch custom event for the app to handle
          window.dispatchEvent(new CustomEvent('persistentNotificationAction', {
            detail: { actionId }
          }));
          
          // Call registered listeners
          this.actionListeners.forEach(listener => listener(actionId));
          
          // Re-show the persistent notification after action (since it was dismissed)
          this.showPersistentNotification();
        }
      });

      // Check if should be enabled and restore
      const enabled = await this.isEnabled();
      if (enabled) {
        await this.showPersistentNotification();
      }

      console.log('[PersistentNotification] Initialized successfully');
    } catch (error) {
      console.error('[PersistentNotification] Initialization error:', error);
    }
  }

  async isEnabled(): Promise<boolean> {
    return await getSetting<boolean>(STORAGE_KEYS.ENABLED, false);
  }

  async enable(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[PersistentNotification] Not on native platform');
      return;
    }

    try {
      await setSetting(STORAGE_KEYS.ENABLED, true);
      await this.showPersistentNotification();
      console.log('[PersistentNotification] Enabled');
    } catch (error) {
      console.error('[PersistentNotification] Error enabling:', error);
      throw error;
    }
  }

  async disable(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await setSetting(STORAGE_KEYS.ENABLED, false);
      await this.hidePersistentNotification();
      console.log('[PersistentNotification] Disabled');
    } catch (error) {
      console.error('[PersistentNotification] Error disabling:', error);
    }
  }

  private async showPersistentNotification(): Promise<void> {
    try {
      // Cancel existing first to avoid duplicates
      await this.hidePersistentNotification();

      const notification: LocalNotificationSchema = {
        id: PERSISTENT_NOTIFICATION_ID,
        title: 'Npd Quick Add',
        body: 'Tap to add notes or tasks quickly',
        actionTypeId: PERSISTENT_ACTION_TYPE_ID,
        ongoing: true, // Makes it persistent (can't be swiped away)
        autoCancel: false, // Stays after tap
        smallIcon: 'npd_notification_icon',
        largeIcon: 'npd_notification_icon',
        extra: {
          type: 'persistent_quick_add',
          isPersistent: true,
        },
      };

      await LocalNotifications.schedule({
        notifications: [notification],
      });

      console.log('[PersistentNotification] Shown');
    } catch (error) {
      console.error('[PersistentNotification] Error showing:', error);
    }
  }

  private async hidePersistentNotification(): Promise<void> {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: PERSISTENT_NOTIFICATION_ID }],
      });
    } catch (error) {
      console.error('[PersistentNotification] Error hiding:', error);
    }
  }

  handleAction(actionId: string): void {
    // Dispatch event for the app to handle
    window.dispatchEvent(new CustomEvent('persistentNotificationAction', {
      detail: { actionId }
    }));
  }

  onAction(listener: (actionId: string) => void): () => void {
    this.actionListeners.push(listener);
    return () => {
      this.actionListeners = this.actionListeners.filter(l => l !== listener);
    };
  }
}

export const persistentNotificationManager = PersistentNotificationService.getInstance();

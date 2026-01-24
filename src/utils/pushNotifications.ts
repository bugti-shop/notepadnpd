import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { setSetting } from '@/utils/settingsStorage';

export class PushNotificationManager {
  private static instance: PushNotificationManager;

  private constructor() {}

  static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager();
    }
    return PushNotificationManager.instance;
  }

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications are only available on native platforms');
      return;
    }

    await this.requestPermissions();
    await this.registerListeners();
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting push notification permissions:', error);
      return false;
    }
  }

  async registerListeners(): Promise<void> {
    await PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      // Store token in IndexedDB for server-side push notifications
      await setSetting('pushToken', token.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Registration error: ', err.error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed', notification.actionId, notification.inputValue);
    });
  }

  async getDeliveredNotifications(): Promise<any> {
    const notificationList = await PushNotifications.getDeliveredNotifications();
    return notificationList.notifications;
  }

  async removeAllDeliveredNotifications(): Promise<void> {
    await PushNotifications.removeAllDeliveredNotifications();
  }
}

export const pushNotificationManager = PushNotificationManager.getInstance();

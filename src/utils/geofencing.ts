import { TodoItem, LocationReminder } from '@/types/note';
import { notificationManager } from './notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const DEFAULT_NOTIFICATION_ICON = 'npd_notification_icon';

interface GeofenceState {
  taskId: string;
  wasInside: boolean;
  lastCheckTime: number;
}

// Store geofence states in memory
const geofenceStates: Map<string, GeofenceState> = new Map();

// Haversine formula to calculate distance between two coordinates in meters
export const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Check if a point is inside a geofence
export const isInsideGeofence = (
  userLat: number,
  userLon: number,
  locationReminder: LocationReminder
): boolean => {
  const distance = calculateDistance(
    userLat,
    userLon,
    locationReminder.latitude,
    locationReminder.longitude
  );
  return distance <= locationReminder.radius;
};

// Trigger a geofence notification
export const triggerGeofenceNotification = async (
  task: TodoItem,
  isEntering: boolean
): Promise<void> => {
  if (!task.locationReminder) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {}

  const locationName = task.locationReminder.address.split(',')[0] || 'Location';
  const action = isEntering ? 'Arrived at' : 'Left';
  
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now(),
          title: `📍 ${action} ${locationName}`,
          body: task.text,
          schedule: { at: new Date(Date.now() + 100) }, // Trigger immediately
          sound: undefined,
          attachments: undefined,
          smallIcon: DEFAULT_NOTIFICATION_ICON,
          largeIcon: DEFAULT_NOTIFICATION_ICON,
          extra: {
            taskId: task.id,
            type: 'task',
            locationBased: true,
            action: isEntering ? 'enter' : 'exit',
          },
        },
      ],
    });
    console.log(`Geofence notification triggered for task: ${task.text}`);
  } catch (error) {
    console.error('Error triggering geofence notification:', error);
  }
};

// Check all tasks with location reminders against current position
export const checkGeofences = async (
  tasks: TodoItem[],
  userLat: number,
  userLon: number
): Promise<void> => {
  const tasksWithLocation = tasks.filter(
    (task) => 
      !task.completed && 
      task.locationReminder?.enabled &&
      task.locationReminder.latitude &&
      task.locationReminder.longitude
  );

  for (const task of tasksWithLocation) {
    if (!task.locationReminder) continue;

    const isInside = isInsideGeofence(userLat, userLon, task.locationReminder);
    const state = geofenceStates.get(task.id);

    if (!state) {
      // First check - just store the state
      geofenceStates.set(task.id, {
        taskId: task.id,
        wasInside: isInside,
        lastCheckTime: Date.now(),
      });
      continue;
    }

    // Check for transition
    if (isInside !== state.wasInside) {
      const isEntering = isInside;
      const isExiting = !isInside;

      // Trigger notification based on task settings
      if (isEntering && task.locationReminder.triggerOnEnter) {
        await triggerGeofenceNotification(task, true);
      } else if (isExiting && task.locationReminder.triggerOnExit) {
        await triggerGeofenceNotification(task, false);
      }

      // Update state
      geofenceStates.set(task.id, {
        ...state,
        wasInside: isInside,
        lastCheckTime: Date.now(),
      });
    }
  }
};

// Start watching user position for geofencing
let watchId: number | null = null;
let isWatching = false;

export const startGeofenceWatching = (
  getTasksFn: () => TodoItem[]
): (() => void) => {
  if (isWatching) return () => {};

  if (!('geolocation' in navigator)) {
    console.warn('Geolocation not supported');
    return () => {};
  }

  isWatching = true;

  // Initial check with current position
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const tasks = getTasksFn();
      checkGeofences(tasks, position.coords.latitude, position.coords.longitude);
    },
    (error) => console.warn('Initial geolocation error:', error),
    { enableHighAccuracy: true }
  );

  // Watch for position changes
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const tasks = getTasksFn();
      checkGeofences(tasks, position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      console.warn('Geolocation watch error:', error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 30000, // 30 seconds
      timeout: 10000, // 10 seconds
    }
  );

  console.log('Started geofence watching');

  // Return cleanup function
  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    isWatching = false;
    geofenceStates.clear();
    console.log('Stopped geofence watching');
  };
};

// Check if any task has location reminders enabled
export const hasLocationReminders = (tasks: TodoItem[]): boolean => {
  return tasks.some(
    (task) => 
      !task.completed && 
      task.locationReminder?.enabled
  );
};

// Clear geofence state for a specific task
export const clearGeofenceState = (taskId: string): void => {
  geofenceStates.delete(taskId);
};

// Clear all geofence states
export const clearAllGeofenceStates = (): void => {
  geofenceStates.clear();
};

export type NoteType = 'sticky' | 'lined' | 'regular' | 'sketch' | 'code' | 'mindmap' | 'expense';

// Calendar Event Types
export type EventRepeatType = 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type EventReminderType = 'at_time' | '5min' | '10min' | '15min' | '30min' | '1hour' | '1day';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  allDay: boolean;
  startDate: Date;
  endDate: Date;
  timezone: string;
  repeat: EventRepeatType;
  reminder: EventReminderType;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseEntry {
  id: string;
  date: string; // DD/MM/YYYY format
  category: string; // Predefined or custom category
  description: string;
  amount: number;
  paymentMethod: string; // Predefined or custom payment method
  notes: string;
  receiptId?: string; // Reference to receipt image in IndexedDB
}

export type Priority = 'high' | 'medium' | 'low' | 'none';
export type RepeatType = 'none' | 'hourly' | 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'monthly' | 'yearly' | 'custom';
export type TaskStatus = 'not_started' | 'in_progress' | 'almost_done' | 'completed';


export interface AdvancedRepeatPattern {
  frequency: RepeatType;
  interval?: number; // every X hours/days/weeks/months
  weeklyDays?: number[]; // 0-6 for Sunday-Saturday
  monthlyType?: 'date' | 'weekday'; // "on the 15th" vs "on the 2nd Tuesday"
  monthlyWeek?: 1 | 2 | 3 | 4 | -1; // 1st, 2nd, 3rd, 4th, or last (-1)
  monthlyDay?: number; // 0-6 for weekday, or 1-31 for date
}

export interface TimeTracking {
  totalSeconds: number;
  isRunning: boolean;
  lastStarted?: Date;
  sessions?: { start: Date; end: Date; duration: number }[];
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface ColoredTag {
  name: string;
  color: string;
}

// Multi-reminder configuration
export type ReminderIntervalType = '30min' | '1hour' | '2hours' | '4hours' | 'custom';

export interface MultiReminder {
  enabled: boolean;
  intervalType: ReminderIntervalType;
  customIntervalMinutes?: number; // For custom interval
  activeHoursStart?: string; // e.g., "06:00"
  activeHoursEnd?: string; // e.g., "17:00"
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday, empty means all days
}

// Location-based reminder configuration
export interface LocationReminder {
  enabled: boolean;
  latitude: number;
  longitude: number;
  address: string;
  radius: number; // in meters
  triggerOnEnter: boolean;
  triggerOnExit: boolean;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority?: Priority;
  status?: TaskStatus; // Task status (not started, in progress, almost done, completed)
  dueDate?: Date;
  reminderTime?: Date;
  multiReminder?: MultiReminder; // Support for multiple reminders throughout the day
  locationReminder?: LocationReminder; // Location-based reminder
  repeatType?: RepeatType;
  repeatDays?: number[];
  advancedRepeat?: AdvancedRepeatPattern;
  tags?: string[];
  coloredTags?: ColoredTag[];
  folderId?: string;
  sectionId?: string;
  imageUrl?: string;
  description?: string;
  location?: string;
  subtasks?: TodoItem[];
  categoryId?: string;
  googleCalendarEventId?: string;
  notificationIds?: number[];
  voiceRecording?: VoiceRecording;
  dependsOn?: string[]; // IDs of tasks that must be completed first
  timeTracking?: TimeTracking;
  // Timestamp fields
  createdAt?: Date;
  modifiedAt?: Date;
  completedAt?: Date;
}

export interface TaskTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  taskText: string;
  priority?: Priority;
  categoryId?: string;
  subtasks?: string[];
}

export interface TaskSection {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  order: number;
}

export interface CornellSection {
  id: string;
  title: string;
  content: string;
  color: string;
}

export type StickyColor = 'yellow' | 'blue' | 'green' | 'pink' | 'orange';

export interface VoiceRecording {
  id: string;
  audioUrl: string;
  duration: number;
  timestamp: Date;
}

export interface Note {
  id: string;
  type: NoteType;
  title: string;
  content: string;
  color?: StickyColor;
  images?: string[];
  voiceRecordings: VoiceRecording[];
  folderId?: string;
  todoItems?: TodoItem[];
  todoSections?: TaskSection[];
  todoName?: string;
  todoDate?: string;
  todoNotes?: string;
  cornellSections?: CornellSection[];
  meetingTitle?: string;
  meetingDate?: string;
  meetingTime?: string;
  meetingLocation?: string;
  isPinned?: boolean;
  isFavorite?: boolean;
  pinnedOrder?: number;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  letterSpacing?: string;
  isItalic?: boolean;
  lineHeight?: string;
  reminderEnabled?: boolean;
  reminderTime?: Date;
  reminderRecurring?: 'none' | 'daily' | 'weekly' | 'monthly';
  reminderSound?: string;
  reminderVibration?: boolean;
  notificationId?: number;
  notificationIds?: number[];
  codeContent?: string;
  codeLanguage?: string;
  isArchived?: boolean;
  archivedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  // Hidden/Protected note properties
  isHidden?: boolean;
  isProtected?: boolean;
  // Meta description for note
  metaDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  noteType?: NoteType;
  isDefault: boolean;
  createdAt: Date;
  color?: string;
}

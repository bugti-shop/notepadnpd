import { addDays, addWeeks, addMonths, addHours, addMinutes, setHours, setMinutes, startOfDay, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, isMonday, isTuesday, isWednesday, isThursday, isFriday, isSaturday, isSunday, getDay, setDate, lastDayOfMonth, getDate } from 'date-fns';
import { RepeatType, AdvancedRepeatPattern, ColoredTag } from '@/types/note';

export interface ParsedTask {
  text: string;
  dueDate?: Date;
  reminderTime?: Date;
  reminderOffset?: string; // 'exact', '5min', '10min', '15min', '30min', '1hour', '1day'
  priority?: 'high' | 'medium' | 'low';
  repeatType?: RepeatType;
  repeatDays?: number[]; // 0-6 for Sunday-Saturday
  advancedRepeat?: AdvancedRepeatPattern;
  location?: string;
  tags?: string[]; // Parsed from #tag syntax
  folderName?: string; // Parsed from @folder syntax
}

// Time patterns
const timePatterns = [
  // "at 5pm", "at 5:30pm", "at 17:00"
  /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  // "5pm", "5:30pm", "5:30 pm"
  /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  // "17:00", "9:30"
  /\b(\d{1,2}):(\d{2})\b/,
  // "in the morning", "in the evening", etc.
  /\bin the (morning|afternoon|evening|night)\b/i,
];

// Relative time patterns for reminders
const relativeTimePatterns: { pattern: RegExp; getDate: (match: RegExpMatchArray) => Date }[] = [
  // "in 5 minutes", "in 30 mins"
  { pattern: /\bin\s+(\d+)\s*(?:min(?:ute)?s?)\b/i, getDate: (m) => addMinutes(new Date(), parseInt(m[1])) },
  // "in 2 hours", "in 1 hour"
  { pattern: /\bin\s+(\d+)\s*(?:hour?s?|hr?s?)\b/i, getDate: (m) => addHours(new Date(), parseInt(m[1])) },
  // "in half an hour", "in 30 minutes"
  { pattern: /\bin\s+(?:half\s+an?\s+hour|30\s*min)/i, getDate: () => addMinutes(new Date(), 30) },
  // "in an hour"
  { pattern: /\bin\s+an?\s+hour\b/i, getDate: () => addHours(new Date(), 1) },
];

// Recurring patterns
const recurringPatterns: { pattern: RegExp; getRepeat: (match: RegExpMatchArray) => { type: RepeatType; days?: number[] } }[] = [
  // "every hour", "hourly"
  { pattern: /\b(?:every\s*hour|hourly)\b/i, getRepeat: () => ({ type: 'hourly' }) },
  // "every day", "daily"
  { pattern: /\b(?:every\s*day|daily)\b/i, getRepeat: () => ({ type: 'daily' }) },
  // "every week", "weekly"
  { pattern: /\b(?:every\s*week|weekly)\b/i, getRepeat: () => ({ type: 'weekly' }) },
  // "every month", "monthly"
  { pattern: /\b(?:every\s*month|monthly)\b/i, getRepeat: () => ({ type: 'monthly' }) },
  // "every year", "yearly", "annually"
  { pattern: /\b(?:every\s*year|yearly|annually)\b/i, getRepeat: () => ({ type: 'yearly' }) },
  // "every weekday", "weekdays"
  { pattern: /\b(?:every\s*weekday|weekdays|on\s*weekdays)\b/i, getRepeat: () => ({ type: 'weekdays' }) },
  // "every weekend", "weekends"
  { pattern: /\b(?:every\s*weekend|weekends|on\s*weekends)\b/i, getRepeat: () => ({ type: 'weekends' }) },
  // "every monday", "every tuesday", etc.
  { pattern: /\bevery\s*(monday|mon)\b/i, getRepeat: () => ({ type: 'custom', days: [1] }) },
  { pattern: /\bevery\s*(tuesday|tue|tues)\b/i, getRepeat: () => ({ type: 'custom', days: [2] }) },
  { pattern: /\bevery\s*(wednesday|wed)\b/i, getRepeat: () => ({ type: 'custom', days: [3] }) },
  { pattern: /\bevery\s*(thursday|thu|thurs)\b/i, getRepeat: () => ({ type: 'custom', days: [4] }) },
  { pattern: /\bevery\s*(friday|fri)\b/i, getRepeat: () => ({ type: 'custom', days: [5] }) },
  { pattern: /\bevery\s*(saturday|sat)\b/i, getRepeat: () => ({ type: 'custom', days: [6] }) },
  { pattern: /\bevery\s*(sunday|sun)\b/i, getRepeat: () => ({ type: 'custom', days: [0] }) },
  // "every mon and wed", "every monday, wednesday and friday"
  { pattern: /\bevery\s+((?:(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*(?:,|and|&)\s*)+(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))\b/i, 
    getRepeat: (m) => {
      const dayMap: { [key: string]: number } = {
        sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
        wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
        fri: 5, friday: 5, sat: 6, saturday: 6
      };
      const days = m[1].toLowerCase().match(/\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi) || [];
      const dayNumbers = [...new Set(days.map(d => dayMap[d.toLowerCase().replace(/day$/, '')] ?? dayMap[d.toLowerCase()]))];
      return { type: 'custom', days: dayNumbers.sort() };
    }
  },
];

// Location patterns
const locationPatterns = [
  // "at the office", "at home", "at work"
  /\bat\s+(?:the\s+)?(office|home|work|gym|school|store|market|mall|hospital|clinic|bank|library|cafe|restaurant|airport|station)\b/i,
  // "at [place name]" - captures location after "at"
  /\bat\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)*)\b/,
  // "@location"
  /@([a-zA-Z][a-zA-Z0-9\s]+)/,
];

// Date patterns
const datePatterns: { pattern: RegExp; getDate: (match: RegExpMatchArray) => Date }[] = [
  { pattern: /\btoday\b/i, getDate: () => startOfDay(new Date()) },
  { pattern: /\btomorrow\b/i, getDate: () => startOfDay(addDays(new Date(), 1)) },
  { pattern: /\bday after tomorrow\b/i, getDate: () => startOfDay(addDays(new Date(), 2)) },
  { pattern: /\byesterday\b/i, getDate: () => startOfDay(addDays(new Date(), -1)) },
  { pattern: /\bthis weekend\b/i, getDate: () => {
    const today = new Date();
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
    return startOfDay(addDays(today, daysUntilSaturday));
  }},
  { pattern: /\bnext week\b/i, getDate: () => startOfDay(addWeeks(new Date(), 1)) },
  { pattern: /\bnext month\b/i, getDate: () => startOfDay(addMonths(new Date(), 1)) },
  { pattern: /\bin (\d+) days?\b/i, getDate: (m) => startOfDay(addDays(new Date(), parseInt(m[1]))) },
  { pattern: /\bin (\d+) weeks?\b/i, getDate: (m) => startOfDay(addWeeks(new Date(), parseInt(m[1]))) },
  { pattern: /\bin (\d+) months?\b/i, getDate: (m) => startOfDay(addMonths(new Date(), parseInt(m[1]))) },
  // Days of the week
  { pattern: /\b(next\s+)?monday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isMonday(today)) return nextMonday(addDays(today, 1));
    return nextMonday(today);
  }},
  { pattern: /\b(next\s+)?tuesday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isTuesday(today)) return nextTuesday(addDays(today, 1));
    return nextTuesday(today);
  }},
  { pattern: /\b(next\s+)?wednesday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isWednesday(today)) return nextWednesday(addDays(today, 1));
    return nextWednesday(today);
  }},
  { pattern: /\b(next\s+)?thursday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isThursday(today)) return nextThursday(addDays(today, 1));
    return nextThursday(today);
  }},
  { pattern: /\b(next\s+)?friday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isFriday(today)) return nextFriday(addDays(today, 1));
    return nextFriday(today);
  }},
  { pattern: /\b(next\s+)?saturday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isSaturday(today)) return nextSaturday(addDays(today, 1));
    return nextSaturday(today);
  }},
  { pattern: /\b(next\s+)?sunday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isSunday(today)) return nextSunday(addDays(today, 1));
    return nextSunday(today);
  }},
  // Specific date formats: "Dec 25", "December 25", "25th December", "12/25"
  { pattern: /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, 
    getDate: (m) => {
      const monthMap: { [key: string]: number } = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
        may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
        sep: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
      };
      const month = monthMap[m[1].toLowerCase()];
      const day = parseInt(m[2]);
      const date = new Date();
      date.setMonth(month, day);
      date.setHours(0, 0, 0, 0);
      if (date < new Date()) {
        date.setFullYear(date.getFullYear() + 1);
      }
      return date;
    }
  },
  { pattern: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
    getDate: (m) => {
      const monthMap: { [key: string]: number } = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
        may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
        sep: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
      };
      const day = parseInt(m[1]);
      const month = monthMap[m[2].toLowerCase()];
      const date = new Date();
      date.setMonth(month, day);
      date.setHours(0, 0, 0, 0);
      if (date < new Date()) {
        date.setFullYear(date.getFullYear() + 1);
      }
      return date;
    }
  },
  // MM/DD format
  { pattern: /\b(\d{1,2})\/(\d{1,2})\b/, getDate: (m) => {
    const month = parseInt(m[1]) - 1;
    const day = parseInt(m[2]);
    const date = new Date();
    date.setMonth(month, day);
    date.setHours(0, 0, 0, 0);
    if (date < new Date()) {
      date.setFullYear(date.getFullYear() + 1);
    }
    return date;
  }},
];

// Priority patterns
const priorityPatterns: { pattern: RegExp; priority: 'high' | 'medium' | 'low' }[] = [
  { pattern: /\b(high priority|urgent|important|asap|critical|!{2,})\b/i, priority: 'high' },
  { pattern: /\b(medium priority|normal|moderate)\b/i, priority: 'medium' },
  { pattern: /\b(low priority|later|whenever|someday)\b/i, priority: 'low' },
  { pattern: /!{3,}/, priority: 'high' },
  { pattern: /!!/, priority: 'medium' },
  // Priority shortcuts: p1, p2, p3
  { pattern: /\bp1\b/i, priority: 'high' },
  { pattern: /\bp2\b/i, priority: 'medium' },
  { pattern: /\bp3\b/i, priority: 'low' },
  // Quick add syntax: !high, !medium, !low
  { pattern: /!high\b/i, priority: 'high' },
  { pattern: /!med(?:ium)?\b/i, priority: 'medium' },
  { pattern: /!low\b/i, priority: 'low' },
];

// Advanced recurring patterns (e.g., "every 2nd Tuesday", "last Friday of month")
const advancedRecurringPatterns: { pattern: RegExp; getRepeat: (match: RegExpMatchArray) => { advancedRepeat: AdvancedRepeatPattern; firstOccurrence?: Date } }[] = [
  // "every 2nd Tuesday", "every 1st Monday", "every 3rd Wednesday"
  { 
    pattern: /\bevery\s+(1st|2nd|3rd|4th|last|first|second|third|fourth)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
    getRepeat: (m) => {
      const weekMap: { [key: string]: 1 | 2 | 3 | 4 | -1 } = {
        '1st': 1, 'first': 1, '2nd': 2, 'second': 2, '3rd': 3, 'third': 3, '4th': 4, 'fourth': 4, 'last': -1
      };
      const dayMap: { [key: string]: number } = {
        sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
        wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6
      };
      const weekNum = weekMap[m[1].toLowerCase()];
      const dayNum = dayMap[m[2].toLowerCase()];
      
      // Calculate first occurrence
      const firstOccurrence = getNthWeekdayOfMonth(new Date(), weekNum, dayNum);
      
      return {
        advancedRepeat: {
          frequency: 'monthly',
          monthlyType: 'weekday',
          monthlyWeek: weekNum,
          monthlyDay: dayNum,
        },
        firstOccurrence,
      };
    }
  },
  // "every 2 hours", "every 3 hours"
  {
    pattern: /\bevery\s+(\d+)\s*(?:hour?s?|hr?s?)\b/i,
    getRepeat: (m) => {
      const interval = parseInt(m[1]);
      return {
        advancedRepeat: {
          frequency: 'hourly',
          interval,
        },
      };
    }
  },
  // "every 2 weeks", "every 3 days"
  {
    pattern: /\bevery\s+(\d+)\s+(day|week|month)s?\b/i,
    getRepeat: (m) => {
      const interval = parseInt(m[1]);
      const unit = m[2].toLowerCase();
      const freqMap: { [key: string]: RepeatType } = { day: 'daily', week: 'weekly', month: 'monthly' };
      return {
        advancedRepeat: {
          frequency: freqMap[unit],
          interval,
        },
      };
    }
  },
  // "last day of month"
  {
    pattern: /\b(?:every\s+)?last\s+day\s+(?:of\s+(?:the\s+)?)?month\b/i,
    getRepeat: () => {
      const today = new Date();
      const lastDay = lastDayOfMonth(today);
      return {
        advancedRepeat: {
          frequency: 'monthly',
          monthlyType: 'date',
          monthlyDay: getDate(lastDay),
        },
        firstOccurrence: lastDay,
      };
    }
  },
];

// Helper function to get the nth weekday of a month
function getNthWeekdayOfMonth(baseDate: Date, weekNum: 1 | 2 | 3 | 4 | -1, dayOfWeek: number): Date {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  
  if (weekNum === -1) {
    // Last occurrence of the day in the month
    const lastDay = lastDayOfMonth(baseDate);
    let date = new Date(year, month, getDate(lastDay));
    while (getDay(date) !== dayOfWeek) {
      date = addDays(date, -1);
    }
    // If the date is in the past, get next month's
    if (date < baseDate) {
      return getNthWeekdayOfMonth(addMonths(baseDate, 1), weekNum, dayOfWeek);
    }
    return startOfDay(date);
  }
  
  // Find the first occurrence of the day
  let date = new Date(year, month, 1);
  while (getDay(date) !== dayOfWeek) {
    date = addDays(date, 1);
  }
  // Add weeks for nth occurrence
  date = addDays(date, (weekNum - 1) * 7);
  
  // If the date is in the past, get next month's
  if (date < baseDate) {
    return getNthWeekdayOfMonth(addMonths(baseDate, 1), weekNum, dayOfWeek);
  }
  return startOfDay(date);
}

// Quick add syntax parsers
function parseTags(text: string): { tags: string[]; cleanedText: string } {
  const tags: string[] = [];
  const tagMatches = text.match(/#(\w+)/g);
  
  if (tagMatches) {
    tagMatches.forEach(match => {
      tags.push(match.substring(1)); // Remove the #
    });
  }
  
  const cleanedText = text.replace(/#\w+/g, '').trim();
  return { tags, cleanedText };
}

function parseFolderName(text: string): { folderName?: string; cleanedText: string } {
  const folderMatch = text.match(/@(\w+)/);
  if (folderMatch) {
    const cleanedText = text.replace(/@\w+/, '').trim();
    return { folderName: folderMatch[1], cleanedText };
  }
  return { cleanedText: text };
}

// Reminder patterns - "remind me", "notify me" with offset options
const reminderPatterns: { pattern: RegExp; getOffset: (match: RegExpMatchArray) => { offset: string; matched: string } }[] = [
  // "remind me at exact time", "notify me at exact time"
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\s+(?:at\s+)?(?:the\s+)?exact\s+time\b/i, getOffset: (m) => ({ offset: 'exact', matched: m[0] }) },
  // "remind me 5 minutes before", "notify me 5 min before"
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\s+(\d+)\s*(?:min(?:ute)?s?)\s*(?:before|earlier)?\b/i, getOffset: (m) => {
    const mins = parseInt(m[1]);
    if (mins <= 5) return { offset: '5min', matched: m[0] };
    if (mins <= 10) return { offset: '10min', matched: m[0] };
    if (mins <= 15) return { offset: '15min', matched: m[0] };
    if (mins <= 30) return { offset: '30min', matched: m[0] };
    return { offset: '1hour', matched: m[0] };
  }},
  // "remind me 1 hour before", "notify me an hour before"
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\s+(?:1|one|an?)\s*(?:hour?s?|hr?s?)\s*(?:before|earlier)?\b/i, getOffset: (m) => ({ offset: '1hour', matched: m[0] }) },
  // "remind me 1 day before", "notify me a day before"
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\s+(?:1|one|a)\s*(?:day)\s*(?:before|earlier)?\b/i, getOffset: (m) => ({ offset: '1day', matched: m[0] }) },
  // Generic "remind me" or "notify me" - defaults to exact time
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\b/i, getOffset: (m) => ({ offset: 'exact', matched: m[0] }) },
];

// Parse reminder offset from text
function parseReminderOffset(text: string): { offset: string; matched: string } | null {
  for (const { pattern, getOffset } of reminderPatterns) {
    const match = text.match(pattern);
    if (match) {
      return getOffset(match);
    }
  }
  return null;
}

function parseTime(text: string): { hours: number; minutes: number; matched: string } | null {
  // Check for "at X:XX am/pm" or "at Xam/pm"
  let match = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3]?.toLowerCase();
    
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return { hours, minutes, matched: match[0] };
  }
  
  // Check for "Xpm" or "X:XXpm"
  match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3].toLowerCase();
    
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return { hours, minutes, matched: match[0] };
  }
  
  // Check for 24-hour format "17:00"
  match = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (match) {
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes, matched: match[0] };
    }
  }
  
  // Check for "in the morning/afternoon/evening/night"
  match = text.match(/\bin the (morning|afternoon|evening|night)\b/i);
  if (match) {
    const timeOfDay = match[1].toLowerCase();
    let hours = 9; // default morning
    if (timeOfDay === 'afternoon') hours = 14;
    else if (timeOfDay === 'evening') hours = 18;
    else if (timeOfDay === 'night') hours = 21;
    
    return { hours, minutes: 0, matched: match[0] };
  }
  
  return null;
}

function parseRelativeTime(text: string): { date: Date; matched: string } | null {
  for (const { pattern, getDate } of relativeTimePatterns) {
    const match = text.match(pattern);
    if (match) {
      return { date: getDate(match), matched: match[0] };
    }
  }
  return null;
}

function parseAdvancedRecurring(text: string): { advancedRepeat: AdvancedRepeatPattern; firstOccurrence?: Date; matched: string } | null {
  for (const { pattern, getRepeat } of advancedRecurringPatterns) {
    const match = text.match(pattern);
    if (match) {
      const result = getRepeat(match);
      return { ...result, matched: match[0] };
    }
  }
  return null;
}

function parseRecurring(text: string): { type: RepeatType; days?: number[]; matched: string } | null {
  for (const { pattern, getRepeat } of recurringPatterns) {
    const match = text.match(pattern);
    if (match) {
      const result = getRepeat(match);
      return { ...result, matched: match[0] };
    }
  }
  return null;
}

function parseLocation(text: string): { location: string; matched: string } | null {
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      const location = match[1]?.trim();
      if (location && location.length > 1) {
        return { location, matched: match[0] };
      }
    }
  }
  return null;
}

function parseDate(text: string): { date: Date; matched: string } | null {
  for (const { pattern, getDate } of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return { date: getDate(match), matched: match[0] };
    }
  }
  return null;
}

function parsePriority(text: string): { priority: 'high' | 'medium' | 'low'; matched: string } | null {
  for (const { pattern, priority } of priorityPatterns) {
    const match = text.match(pattern);
    if (match) {
      return { priority, matched: match[0] };
    }
  }
  return null;
}

export function parseNaturalLanguageTask(input: string): ParsedTask {
  let text = input.trim();
  let dueDate: Date | undefined;
  let reminderTime: Date | undefined;
  let reminderOffset: string | undefined;
  let priority: 'high' | 'medium' | 'low' | undefined;
  let repeatType: RepeatType | undefined;
  let repeatDays: number[] | undefined;
  let advancedRepeat: AdvancedRepeatPattern | undefined;
  let location: string | undefined;
  let tags: string[] | undefined;
  let folderName: string | undefined;
  
  // Parse quick add syntax first: #tags and @folder
  const tagsResult = parseTags(text);
  if (tagsResult.tags.length > 0) {
    tags = tagsResult.tags;
    text = tagsResult.cleanedText;
  }
  
  const folderResult = parseFolderName(text);
  if (folderResult.folderName) {
    folderName = folderResult.folderName;
    text = folderResult.cleanedText;
  }
  
  // Parse reminder offset (e.g., "remind me 5 min before", "notify me at exact time")
  const reminderOffsetResult = parseReminderOffset(text);
  if (reminderOffsetResult) {
    reminderOffset = reminderOffsetResult.offset;
    text = text.replace(reminderOffsetResult.matched, '').trim();
  }
  
  // Parse advanced recurring patterns first (e.g., "every 2nd Tuesday")
  const advancedRecurringResult = parseAdvancedRecurring(text);
  if (advancedRecurringResult) {
    advancedRepeat = advancedRecurringResult.advancedRepeat;
    if (advancedRecurringResult.firstOccurrence) {
      dueDate = advancedRecurringResult.firstOccurrence;
    }
    text = text.replace(advancedRecurringResult.matched, '').trim();
    repeatType = advancedRepeat.frequency;
  }
  
  // Parse recurring pattern (before date, as "every monday" shouldn't be parsed as a date)
  if (!advancedRepeat) {
    const recurringResult = parseRecurring(text);
    if (recurringResult) {
      repeatType = recurringResult.type;
      repeatDays = recurringResult.days;
      text = text.replace(recurringResult.matched, '').trim();
      
      // For recurring tasks, set the first occurrence date
      if (repeatDays && repeatDays.length > 0) {
        const today = new Date();
        const currentDay = today.getDay();
        const nextDay = repeatDays.find(d => d > currentDay) ?? repeatDays[0];
        const daysUntil = (nextDay - currentDay + 7) % 7 || 7;
        dueDate = startOfDay(addDays(today, daysUntil));
      } else if (repeatType === 'weekdays') {
        const today = new Date();
        const currentDay = today.getDay();
        // Find next weekday
        let daysUntil = 1;
        if (currentDay === 5) daysUntil = 3; // Friday -> Monday
        else if (currentDay === 6) daysUntil = 2; // Saturday -> Monday
        dueDate = startOfDay(addDays(today, daysUntil));
      } else if (repeatType === 'weekends') {
        const today = new Date();
        const currentDay = today.getDay();
        const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7;
        dueDate = startOfDay(addDays(today, daysUntilSaturday));
      }
    }
  }
  
  // Parse relative time ("in 2 hours", "in 30 minutes")
  const relativeTimeResult = parseRelativeTime(text);
  if (relativeTimeResult) {
    dueDate = relativeTimeResult.date;
    reminderTime = relativeTimeResult.date;
    // Default to exact time reminder for relative time
    if (!reminderOffset) {
      reminderOffset = 'exact';
    }
    text = text.replace(relativeTimeResult.matched, '').trim();
  }
  
  // Parse date (if not already set by recurring/relative)
  if (!dueDate) {
    const dateResult = parseDate(text);
    if (dateResult) {
      dueDate = dateResult.date;
      text = text.replace(dateResult.matched, '').trim();
    }
  }
  
  // Parse time
  const timeResult = parseTime(input); // Use original input for time parsing
  if (timeResult) {
    if (dueDate) {
      dueDate = setHours(setMinutes(dueDate, timeResult.minutes), timeResult.hours);
      // Set reminderTime to the same as dueDate when time is explicitly specified
      reminderTime = new Date(dueDate);
    } else {
      // If no date specified but time is, assume today
      dueDate = setHours(setMinutes(startOfDay(new Date()), timeResult.minutes), timeResult.hours);
      // Set reminderTime to the same as dueDate when time is explicitly specified
      reminderTime = new Date(dueDate);
    }
    // Default to exact time reminder when time is specified
    if (!reminderOffset) {
      reminderOffset = 'exact';
    }
    text = text.replace(timeResult.matched, '').trim();
  }
  
  // Apply reminder offset to calculate actual reminder time
  if (reminderTime && reminderOffset && reminderOffset !== 'exact') {
    const offsetMinutes: { [key: string]: number } = {
      '5min': 5,
      '10min': 10,
      '15min': 15,
      '30min': 30,
      '1hour': 60,
      '1day': 1440,
    };
    const mins = offsetMinutes[reminderOffset];
    if (mins) {
      reminderTime = addMinutes(reminderTime, -mins);
    }
  }
  
  // Parse priority
  const priorityResult = parsePriority(text);
  if (priorityResult) {
    priority = priorityResult.priority;
    text = text.replace(priorityResult.matched, '').trim();
  }
  
  // Parse location
  const locationResult = parseLocation(text);
  if (locationResult) {
    location = locationResult.location;
    text = text.replace(locationResult.matched, '').trim();
  }
  
  // Clean up the text
  text = text
    .replace(/\s+/g, ' ')  // Multiple spaces to single
    .replace(/^\s*,\s*/, '') // Leading comma
    .replace(/\s*,\s*$/, '') // Trailing comma
    .replace(/\s+at\s*$/, '') // Trailing "at"
    .replace(/\s+on\s*$/, '') // Trailing "on"
    .replace(/\s+by\s*$/, '') // Trailing "by"
    .replace(/\s+in\s*$/, '') // Trailing "in"
    .replace(/\s+every\s*$/, '') // Trailing "every"
    .trim();
  
  return {
    text: text || input.trim(), // Fallback to original if empty
    dueDate,
    reminderTime,
    reminderOffset,
    priority,
    repeatType,
    repeatDays,
    advancedRepeat,
    location,
    tags,
    folderName,
  };
}

// Helper to detect if input contains natural language patterns
export function hasNaturalLanguagePatterns(input: string): boolean {
  // Check for quick add syntax first
  if (/#\w+/.test(input) || /@\w+/.test(input) || /!(?:high|med|low)\b/i.test(input)) {
    return true;
  }
  
  // Check for remind me / notify me patterns
  if (/\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\b/i.test(input)) {
    return true;
  }
  
  const allPatterns = [
    ...datePatterns.map(p => p.pattern),
    ...timePatterns,
    ...priorityPatterns.map(p => p.pattern),
    ...recurringPatterns.map(p => p.pattern),
    ...advancedRecurringPatterns.map(p => p.pattern),
    ...relativeTimePatterns.map(p => p.pattern),
    ...locationPatterns,
  ];
  
  return allPatterns.some(pattern => pattern.test(input));
}

// Format parsed result for display
export function formatParsedResult(parsed: ParsedTask): string[] {
  const results: string[] = [];
  
  if (parsed.dueDate) {
    const now = new Date();
    const diffMs = parsed.dueDate.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    
    if (diffMins < 60) {
      results.push(`in ${diffMins} min`);
    } else if (diffHours < 24) {
      results.push(`in ${diffHours} hour${diffHours > 1 ? 's' : ''}`);
    }
  }
  
  if (parsed.reminderOffset) {
    const offsetLabels: { [key: string]: string } = {
      'exact': '🔔 At exact time',
      '5min': '🔔 5 min before',
      '10min': '🔔 10 min before',
      '15min': '🔔 15 min before',
      '30min': '🔔 30 min before',
      '1hour': '🔔 1 hour before',
      '1day': '🔔 1 day before',
    };
    results.push(offsetLabels[parsed.reminderOffset] || '🔔 Reminder set');
  }
  
  if (parsed.repeatType) {
    if (parsed.repeatType === 'custom' && parsed.repeatDays) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      results.push(`🔄 Every ${parsed.repeatDays.map(d => dayNames[d]).join(', ')}`);
    } else {
      results.push(`🔄 ${parsed.repeatType.charAt(0).toUpperCase() + parsed.repeatType.slice(1)}`);
    }
  }
  
  if (parsed.location) {
    results.push(`📍 ${parsed.location}`);
  }
  
  if (parsed.priority) {
    results.push(`⚡ ${parsed.priority} priority`);
  }
  
  return results;
}

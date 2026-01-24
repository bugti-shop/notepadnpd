/**
 * Personalized Notifications
 * Smart, context-aware notifications based on user behavior and task patterns
 */

import { TodoItem } from '@/types/note';
import { format, isToday, isTomorrow, differenceInDays, differenceInHours, startOfDay, addDays } from 'date-fns';

export interface PersonalizedNotification {
  id: string;
  title: string;
  body: string;
  category: 'motivation' | 'reminder' | 'achievement' | 'productivity' | 'wellness';
  priority: 'low' | 'medium' | 'high';
  icon?: string;
}

// Morning motivational messages
const MORNING_MESSAGES: PersonalizedNotification[] = [
  { id: 'morning-1', title: '🌅 Good Morning!', body: 'Start your day with intention. What\'s your top priority today?', category: 'motivation', priority: 'medium' },
  { id: 'morning-2', title: '☀️ Rise & Shine!', body: 'A new day means new opportunities. Let\'s make it count!', category: 'motivation', priority: 'medium' },
  { id: 'morning-3', title: '🌞 Hello Champion!', body: 'Every morning is a fresh start. What will you accomplish today?', category: 'motivation', priority: 'medium' },
  { id: 'morning-4', title: '🎯 Ready to Conquer?', body: 'Your tasks are waiting. Small steps lead to big achievements!', category: 'motivation', priority: 'medium' },
  { id: 'morning-5', title: '💪 New Day, New Wins!', body: 'Yesterday is history. Today is your opportunity to shine!', category: 'motivation', priority: 'medium' },
];

// Productivity reminders
const PRODUCTIVITY_MESSAGES: PersonalizedNotification[] = [
  { id: 'prod-1', title: '⏰ Focus Time', body: 'Take a 25-minute focus session. You\'ve got this!', category: 'productivity', priority: 'medium' },
  { id: 'prod-2', title: '🎯 Stay on Track', body: 'Quick check: Are you working on your most important task?', category: 'productivity', priority: 'medium' },
  { id: 'prod-3', title: '🧠 Deep Work Alert', body: 'Time to eliminate distractions and dive deep into your work.', category: 'productivity', priority: 'medium' },
  { id: 'prod-4', title: '📝 Progress Check', body: 'How\'s your task list looking? Celebrate small wins!', category: 'productivity', priority: 'low' },
  { id: 'prod-5', title: '🚀 Momentum Builder', body: 'Complete one small task right now to build momentum!', category: 'productivity', priority: 'medium' },
];

// Achievement celebrations
const ACHIEVEMENT_MESSAGES: PersonalizedNotification[] = [
  { id: 'achieve-1', title: '🎉 Task Champion!', body: 'You\'re crushing it! Keep up the amazing work!', category: 'achievement', priority: 'low' },
  { id: 'achieve-2', title: '⭐ Productivity Star!', body: 'Your consistency is paying off. You\'re doing great!', category: 'achievement', priority: 'low' },
  { id: 'achieve-3', title: '🏆 Goal Getter!', body: 'Look at you go! Every completed task is a victory!', category: 'achievement', priority: 'low' },
  { id: 'achieve-4', title: '💫 Superstar Alert!', body: 'You\'ve been incredibly productive. Take pride in your progress!', category: 'achievement', priority: 'low' },
  { id: 'achieve-5', title: '🌟 High Performer!', body: 'Your dedication shows. You\'re making real progress!', category: 'achievement', priority: 'low' },
];

// Wellness & break reminders
const WELLNESS_MESSAGES: PersonalizedNotification[] = [
  { id: 'wellness-1', title: '🧘 Mindful Moment', body: 'Take a deep breath. You deserve a short mental break.', category: 'wellness', priority: 'low' },
  { id: 'wellness-2', title: '💧 Hydration Check', body: 'Remember to drink some water and stretch a bit!', category: 'wellness', priority: 'low' },
  { id: 'wellness-3', title: '🚶 Movement Break', body: 'Stand up, stretch, or take a short walk. Your body will thank you!', category: 'wellness', priority: 'low' },
  { id: 'wellness-4', title: '👀 Eye Rest', body: 'Look away from the screen for 20 seconds. Rest your eyes!', category: 'wellness', priority: 'low' },
  { id: 'wellness-5', title: '🌿 Breathe Easy', body: 'Take 5 deep breaths. Reset and refocus!', category: 'wellness', priority: 'low' },
];

// Smart task-based reminders
const SMART_REMINDERS: PersonalizedNotification[] = [
  { id: 'smart-1', title: '📋 Task Review', body: 'Take a moment to review your upcoming tasks and priorities.', category: 'reminder', priority: 'medium' },
  { id: 'smart-2', title: '🔄 Weekly Planning', body: 'Plan your week ahead for better productivity and less stress.', category: 'reminder', priority: 'medium' },
  { id: 'smart-3', title: '📊 Progress Report', body: 'How are you doing on your goals? Let\'s check in!', category: 'reminder', priority: 'low' },
  { id: 'smart-4', title: '🎯 Priority Check', body: 'Are your most important tasks at the top of your list?', category: 'reminder', priority: 'medium' },
  { id: 'smart-5', title: '📅 Tomorrow Prep', body: 'Prepare for tomorrow by reviewing what needs to be done.', category: 'reminder', priority: 'low' },
];

// Evening wrap-up messages
const EVENING_MESSAGES: PersonalizedNotification[] = [
  { id: 'evening-1', title: '🌙 Day\'s End Review', body: 'What did you accomplish today? Celebrate your progress!', category: 'motivation', priority: 'low' },
  { id: 'evening-2', title: '✨ Tomorrow Awaits', body: 'Rest well tonight. Tomorrow brings new opportunities!', category: 'motivation', priority: 'low' },
  { id: 'evening-3', title: '🌟 Daily Reflection', body: 'Take a moment to appreciate what you achieved today.', category: 'motivation', priority: 'low' },
  { id: 'evening-4', title: '😴 Wind Down', body: 'It\'s time to relax. You\'ve earned it!', category: 'wellness', priority: 'low' },
  { id: 'evening-5', title: '📝 Plan Ahead', body: 'Quick tip: Set your top 3 priorities for tomorrow before bed.', category: 'productivity', priority: 'low' },
];

/**
 * Get all personalized notifications
 */
export const getAllPersonalizedNotifications = (): PersonalizedNotification[] => {
  return [
    ...MORNING_MESSAGES,
    ...PRODUCTIVITY_MESSAGES,
    ...ACHIEVEMENT_MESSAGES,
    ...WELLNESS_MESSAGES,
    ...SMART_REMINDERS,
    ...EVENING_MESSAGES,
  ];
};

/**
 * Get contextual notifications based on time of day
 */
export const getTimeBasedNotifications = (): PersonalizedNotification[] => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 10) {
    return MORNING_MESSAGES;
  } else if (hour >= 10 && hour < 17) {
    return [...PRODUCTIVITY_MESSAGES, ...WELLNESS_MESSAGES];
  } else if (hour >= 17 && hour < 21) {
    return EVENING_MESSAGES;
  } else {
    return WELLNESS_MESSAGES;
  }
};

/**
 * Get task-aware notifications based on user's task state
 */
export const getTaskAwareNotifications = (tasks: TodoItem[]): PersonalizedNotification[] => {
  const notifications: PersonalizedNotification[] = [];
  const now = new Date();
  
  // Check for overdue tasks
  const overdueTasks = tasks.filter(t => 
    !t.completed && t.dueDate && new Date(t.dueDate) < now
  );
  
  if (overdueTasks.length > 0) {
    notifications.push({
      id: 'overdue-alert',
      title: '⚠️ Overdue Tasks',
      body: `You have ${overdueTasks.length} overdue task(s). Let's tackle them!`,
      category: 'reminder',
      priority: 'high',
    });
  }
  
  // Check for tasks due today
  const todayTasks = tasks.filter(t => 
    !t.completed && t.dueDate && isToday(new Date(t.dueDate))
  );
  
  if (todayTasks.length > 0) {
    notifications.push({
      id: 'today-tasks',
      title: '📅 Today\'s Focus',
      body: `${todayTasks.length} task(s) due today. You can do this!`,
      category: 'reminder',
      priority: 'high',
    });
  }
  
  // Check for tasks due tomorrow
  const tomorrowTasks = tasks.filter(t => 
    !t.completed && t.dueDate && isTomorrow(new Date(t.dueDate))
  );
  
  if (tomorrowTasks.length > 0) {
    notifications.push({
      id: 'tomorrow-prep',
      title: '🔮 Tomorrow Preview',
      body: `${tomorrowTasks.length} task(s) due tomorrow. Plan ahead!`,
      category: 'reminder',
      priority: 'medium',
    });
  }
  
  // Check completion rate
  const recentTasks = tasks.filter(t => {
    const createdDate = parseInt(t.id);
    return !isNaN(createdDate) && differenceInDays(now, new Date(createdDate)) <= 7;
  });
  
  const completedRecent = recentTasks.filter(t => t.completed).length;
  const completionRate = recentTasks.length > 0 ? (completedRecent / recentTasks.length) * 100 : 0;
  
  if (completionRate >= 80) {
    notifications.push({
      id: 'high-performer',
      title: '🏆 High Performer!',
      body: `${Math.round(completionRate)}% completion rate this week! Amazing work!`,
      category: 'achievement',
      priority: 'low',
    });
  } else if (completionRate >= 50) {
    notifications.push({
      id: 'good-progress',
      title: '📈 Making Progress!',
      body: `${Math.round(completionRate)}% completion rate. Keep pushing!`,
      category: 'achievement',
      priority: 'low',
    });
  }
  
  // High priority tasks
  const highPriorityTasks = tasks.filter(t => 
    !t.completed && t.priority === 'high'
  );
  
  if (highPriorityTasks.length > 0) {
    notifications.push({
      id: 'high-priority-alert',
      title: '🔴 High Priority',
      body: `${highPriorityTasks.length} high-priority task(s) need your attention!`,
      category: 'reminder',
      priority: 'high',
    });
  }
  
  return notifications;
};

/**
 * Get a random notification from a category
 */
export const getRandomNotification = (category?: PersonalizedNotification['category']): PersonalizedNotification => {
  let pool = getAllPersonalizedNotifications();
  
  if (category) {
    pool = pool.filter(n => n.category === category);
  }
  
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
};

/**
 * Get smart notification based on current context
 */
export const getSmartNotification = (tasks: TodoItem[]): PersonalizedNotification => {
  const taskAware = getTaskAwareNotifications(tasks);
  
  // Prioritize task-aware notifications
  const highPriority = taskAware.find(n => n.priority === 'high');
  if (highPriority) return highPriority;
  
  // Then time-based
  const timeBased = getTimeBasedNotifications();
  const randomTime = timeBased[Math.floor(Math.random() * timeBased.length)];
  
  return taskAware.length > 0 ? taskAware[0] : randomTime;
};
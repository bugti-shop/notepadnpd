import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TodoItem, Priority, RepeatType, ColoredTag } from '@/types/note';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import {
  Briefcase,
  Coffee,
  Dumbbell,
  Heart,
  Home,
  ShoppingCart,
  BookOpen,
  Phone,
  Mail,
  Calendar,
  Pill,
  DollarSign,
  Car,
  Plane,
  Baby,
  Dog,
  Leaf,
  Sparkles,
  Clock,
  Bell,
  Repeat,
  Flag,
  Plus,
  Trash2,
  Edit2,
  Search,
  X,
  CheckCircle2,
  Zap,
  Target,
  Users,
  FileText,
  Utensils,
  Droplets,
  Moon,
  Sun,
  Music,
  Camera,
  Gift,
  Laptop,
  Wrench,
  Star
} from 'lucide-react';

export interface TaskTemplate {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  taskText: string;
  priority: Priority;
  repeatType: RepeatType;
  repeatDays?: number[];
  tags?: ColoredTag[];
  subtasks?: string[];
  isCustom?: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase, Coffee, Dumbbell, Heart, Home, ShoppingCart, BookOpen, Phone, Mail,
  Calendar, Pill, DollarSign, Car, Plane, Baby, Dog, Leaf, Sparkles, Clock, Bell,
  Repeat, Flag, Plus, CheckCircle2, Zap, Target, Users, FileText, Utensils,
  Droplets, Moon, Sun, Music, Camera, Gift, Laptop, Wrench, Star
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const DEFAULT_TEMPLATES: TaskTemplate[] = [
  // Daily Health & Wellness
  {
    id: 'morning-routine',
    name: 'Morning Routine',
    icon: 'Sun',
    category: 'Health & Wellness',
    description: 'Start your day right with a morning routine',
    taskText: 'Complete morning routine',
    priority: 'medium',
    repeatType: 'daily',
    tags: [{ name: 'routine', color: '#f59e0b' }],
    subtasks: ['Wake up at set time', 'Drink water', 'Stretch/Exercise', 'Shower', 'Healthy breakfast']
  },
  {
    id: 'take-vitamins',
    name: 'Take Vitamins',
    icon: 'Pill',
    category: 'Health & Wellness',
    description: 'Daily vitamin reminder',
    taskText: 'Take daily vitamins',
    priority: 'high',
    repeatType: 'daily',
    tags: [{ name: 'health', color: '#10b981' }]
  },
  {
    id: 'drink-water',
    name: 'Drink Water',
    icon: 'Droplets',
    category: 'Health & Wellness',
    description: 'Stay hydrated throughout the day',
    taskText: 'Drink 8 glasses of water',
    priority: 'medium',
    repeatType: 'daily',
    tags: [{ name: 'health', color: '#10b981' }]
  },
  {
    id: 'exercise',
    name: 'Exercise',
    icon: 'Dumbbell',
    category: 'Health & Wellness',
    description: 'Daily workout reminder',
    taskText: 'Complete workout session',
    priority: 'high',
    repeatType: 'daily',
    tags: [{ name: 'fitness', color: '#ef4444' }],
    subtasks: ['Warm up', 'Main workout', 'Cool down', 'Stretch']
  },
  {
    id: 'meditation',
    name: 'Meditation',
    icon: 'Sparkles',
    category: 'Health & Wellness',
    description: 'Daily mindfulness practice',
    taskText: 'Meditate for 10 minutes',
    priority: 'medium',
    repeatType: 'daily',
    tags: [{ name: 'mindfulness', color: '#8b5cf6' }]
  },
  {
    id: 'sleep-routine',
    name: 'Sleep Routine',
    icon: 'Moon',
    category: 'Health & Wellness',
    description: 'Evening wind-down routine',
    taskText: 'Complete bedtime routine',
    priority: 'medium',
    repeatType: 'daily',
    tags: [{ name: 'sleep', color: '#6366f1' }],
    subtasks: ['No screens 1 hour before bed', 'Prepare clothes for tomorrow', 'Read for 20 minutes', 'Lights out by 10pm']
  },
  
  // Work & Productivity
  {
    id: 'weekly-planning',
    name: 'Weekly Planning',
    icon: 'Calendar',
    category: 'Work & Productivity',
    description: 'Plan your week ahead',
    taskText: 'Weekly planning session',
    priority: 'high',
    repeatType: 'weekly',
    repeatDays: [0], // Sunday
    tags: [{ name: 'planning', color: '#3b82f6' }],
    subtasks: ['Review last week', 'Set weekly goals', 'Schedule important tasks', 'Block focus time']
  },
  {
    id: 'daily-standup',
    name: 'Daily Standup',
    icon: 'Users',
    category: 'Work & Productivity',
    description: 'Daily team sync meeting',
    taskText: 'Attend daily standup',
    priority: 'high',
    repeatType: 'weekdays',
    tags: [{ name: 'work', color: '#0ea5e9' }]
  },
  {
    id: 'check-emails',
    name: 'Check Emails',
    icon: 'Mail',
    category: 'Work & Productivity',
    description: 'Process and respond to emails',
    taskText: 'Check and respond to emails',
    priority: 'medium',
    repeatType: 'daily',
    tags: [{ name: 'work', color: '#0ea5e9' }]
  },
  {
    id: 'end-of-day-review',
    name: 'End of Day Review',
    icon: 'Target',
    category: 'Work & Productivity',
    description: 'Review what you accomplished today',
    taskText: 'End of day review',
    priority: 'medium',
    repeatType: 'weekdays',
    tags: [{ name: 'review', color: '#f97316' }],
    subtasks: ['Review completed tasks', 'Note blockers', 'Plan tomorrow\'s priorities']
  },
  
  // Home & Chores
  {
    id: 'weekly-cleaning',
    name: 'Weekly Cleaning',
    icon: 'Home',
    category: 'Home & Chores',
    description: 'Weekly house cleaning',
    taskText: 'Weekly house cleaning',
    priority: 'medium',
    repeatType: 'weekly',
    repeatDays: [6], // Saturday
    tags: [{ name: 'chores', color: '#14b8a6' }],
    subtasks: ['Vacuum/mop floors', 'Clean bathrooms', 'Change bed sheets', 'Do laundry', 'Take out trash']
  },
  {
    id: 'grocery-shopping',
    name: 'Grocery Shopping',
    icon: 'ShoppingCart',
    category: 'Home & Chores',
    description: 'Weekly grocery run',
    taskText: 'Go grocery shopping',
    priority: 'medium',
    repeatType: 'weekly',
    repeatDays: [0], // Sunday
    tags: [{ name: 'shopping', color: '#ec4899' }]
  },
  {
    id: 'meal-prep',
    name: 'Meal Prep',
    icon: 'Utensils',
    category: 'Home & Chores',
    description: 'Prepare meals for the week',
    taskText: 'Weekly meal prep',
    priority: 'medium',
    repeatType: 'weekly',
    repeatDays: [0], // Sunday
    tags: [{ name: 'cooking', color: '#f59e0b' }],
    subtasks: ['Plan weekly menu', 'Prep ingredients', 'Cook and portion meals', 'Store properly']
  },
  {
    id: 'water-plants',
    name: 'Water Plants',
    icon: 'Leaf',
    category: 'Home & Chores',
    description: 'Keep your plants healthy',
    taskText: 'Water indoor plants',
    priority: 'low',
    repeatType: 'weekly',
    repeatDays: [3], // Wednesday
    tags: [{ name: 'plants', color: '#22c55e' }]
  },
  
  // Personal & Finance
  {
    id: 'pay-bills',
    name: 'Pay Bills',
    icon: 'DollarSign',
    category: 'Personal & Finance',
    description: 'Monthly bill payments',
    taskText: 'Pay monthly bills',
    priority: 'high',
    repeatType: 'monthly',
    tags: [{ name: 'finance', color: '#16a34a' }],
    subtasks: ['Rent/Mortgage', 'Utilities', 'Credit cards', 'Subscriptions']
  },
  {
    id: 'budget-review',
    name: 'Budget Review',
    icon: 'FileText',
    category: 'Personal & Finance',
    description: 'Review monthly spending',
    taskText: 'Review monthly budget',
    priority: 'medium',
    repeatType: 'monthly',
    tags: [{ name: 'finance', color: '#16a34a' }]
  },
  {
    id: 'call-family',
    name: 'Call Family',
    icon: 'Phone',
    category: 'Personal & Finance',
    description: 'Stay connected with loved ones',
    taskText: 'Call family members',
    priority: 'medium',
    repeatType: 'weekly',
    repeatDays: [0], // Sunday
    tags: [{ name: 'family', color: '#ec4899' }]
  },
  
  // Learning & Growth
  {
    id: 'read-book',
    name: 'Read Book',
    icon: 'BookOpen',
    category: 'Learning & Growth',
    description: 'Daily reading habit',
    taskText: 'Read for 30 minutes',
    priority: 'medium',
    repeatType: 'daily',
    tags: [{ name: 'learning', color: '#8b5cf6' }]
  },
  {
    id: 'learn-skill',
    name: 'Learn New Skill',
    icon: 'Laptop',
    category: 'Learning & Growth',
    description: 'Practice a new skill',
    taskText: 'Practice new skill for 1 hour',
    priority: 'medium',
    repeatType: 'daily',
    tags: [{ name: 'learning', color: '#8b5cf6' }]
  },
  {
    id: 'journal',
    name: 'Journal',
    icon: 'FileText',
    category: 'Learning & Growth',
    description: 'Daily journaling practice',
    taskText: 'Write in journal',
    priority: 'low',
    repeatType: 'daily',
    tags: [{ name: 'reflection', color: '#a855f7' }],
    subtasks: ['Gratitude list', 'Today\'s highlights', 'Tomorrow\'s intentions']
  },
  
  // Pet Care
  {
    id: 'walk-dog',
    name: 'Walk Dog',
    icon: 'Dog',
    category: 'Pet Care',
    description: 'Daily dog walking',
    taskText: 'Walk the dog',
    priority: 'high',
    repeatType: 'daily',
    tags: [{ name: 'pet', color: '#f97316' }]
  },
  {
    id: 'feed-pet',
    name: 'Feed Pet',
    icon: 'Heart',
    category: 'Pet Care',
    description: 'Daily pet feeding',
    taskText: 'Feed pet',
    priority: 'high',
    repeatType: 'daily',
    tags: [{ name: 'pet', color: '#f97316' }]
  }
];

const CATEGORIES = [...new Set(DEFAULT_TEMPLATES.map(t => t.category))];

interface TaskTemplateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TaskTemplate) => void;
}

export const TaskTemplateSheet = ({ isOpen, onClose, onSelectTemplate }: TaskTemplateSheetProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<TaskTemplate[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load custom templates from IndexedDB
  useEffect(() => {
    import('@/utils/settingsStorage').then(({ getSetting }) => {
      getSetting<TaskTemplate[]>('customTaskTemplates', []).then(templates => {
        setCustomTemplates(templates);
        setIsLoaded(true);
      });
    });
  }, []);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  
  // Form state for creating/editing templates
  const [formName, setFormName] = useState('');
  const [formTaskText, setFormTaskText] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('Star');
  const [formPriority, setFormPriority] = useState<Priority>('medium');
  const [formRepeatType, setFormRepeatType] = useState<RepeatType>('daily');
  const [formSubtasks, setFormSubtasks] = useState('');

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
  
  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.taskText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === null || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const category = template.isCustom ? t('templates.myTemplates') : template.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, TaskTemplate[]>);

  const handleSelectTemplate = (template: TaskTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormTaskText('');
    setFormDescription('');
    setFormIcon('Star');
    setFormPriority('medium');
    setFormRepeatType('daily');
    setFormSubtasks('');
    setShowCreateDialog(true);
  };

  const handleEditTemplate = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormTaskText(template.taskText);
    setFormDescription(template.description);
    setFormIcon(template.icon);
    setFormPriority(template.priority);
    setFormRepeatType(template.repeatType);
    setFormSubtasks(template.subtasks?.join('\n') || '');
    setShowCreateDialog(true);
  };

  const handleSaveTemplate = () => {
    const newTemplate: TaskTemplate = {
      id: editingTemplate?.id || `custom-${Date.now()}`,
      name: formName,
      icon: formIcon,
      category: t('templates.myTemplates'),
      description: formDescription,
      taskText: formTaskText,
      priority: formPriority,
      repeatType: formRepeatType,
      subtasks: formSubtasks.split('\n').filter(s => s.trim()),
      isCustom: true
    };

    let updatedTemplates: TaskTemplate[];
    if (editingTemplate) {
      updatedTemplates = customTemplates.map(t => t.id === editingTemplate.id ? newTemplate : t);
    } else {
      updatedTemplates = [...customTemplates, newTemplate];
    }

    setCustomTemplates(updatedTemplates);
    import('@/utils/settingsStorage').then(({ setSetting }) => {
      setSetting('customTaskTemplates', updatedTemplates);
    });
    setShowCreateDialog(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = customTemplates.filter(t => t.id !== templateId);
    setCustomTemplates(updatedTemplates);
    import('@/utils/settingsStorage').then(({ setSetting }) => {
      setSetting('customTaskTemplates', updatedTemplates);
    });
  };

  const getIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName] || Star;
    return Icon;
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };

  const getRepeatLabel = (repeatType: RepeatType) => {
    switch (repeatType) {
      case 'daily': return t('tasks.repeat.daily');
      case 'weekly': return t('tasks.repeat.weekly');
      case 'weekdays': return t('templates.weekdays');
      case 'weekends': return t('templates.weekends');
      case 'monthly': return t('tasks.repeat.monthly');
      default: return t('templates.oneTime');
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                {t('templates.title')}
              </SheetTitle>
              <Button size="sm" onClick={handleCreateTemplate}>
                <Plus className="w-4 h-4 mr-1" />
                {t('common.create')}
              </Button>
            </div>
            
            {/* Search */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('templates.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {/* Category filters */}
            <ScrollArea className="w-full whitespace-nowrap mt-3">
              <div className="flex gap-2">
                <Badge
                  variant={selectedCategory === null ? "default" : "outline"}
                  className="cursor-pointer shrink-0"
                  onClick={() => setSelectedCategory(null)}
                >
                  {t('common.all')}
                </Badge>
                {customTemplates.length > 0 && (
                  <Badge
                    variant={selectedCategory === t('templates.myTemplates') ? "default" : "outline"}
                    className="cursor-pointer shrink-0"
                    onClick={() => setSelectedCategory(t('templates.myTemplates'))}
                  >
                    {t('templates.myTemplates')}
                  </Badge>
                )}
                {CATEGORIES.map(category => (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    className="cursor-pointer shrink-0"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </SheetHeader>

          <ScrollArea className="h-[calc(85vh-180px)]">
            <div className="p-4 space-y-6">
              {Object.entries(groupedTemplates).map(([category, templates]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">{category}</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {templates.map(template => {
                      const Icon = getIcon(template.icon);
                      return (
                        <div
                          key={template.id}
                          className="bg-card border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => handleSelectTemplate(template)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium truncate">{template.name}</h4>
                                {template.isCustom && (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditTemplate(template);
                                      }}
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTemplate(template.id);
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-1">{template.description}</p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  <Repeat className="w-3 h-3 mr-1" />
                                  {getRepeatLabel(template.repeatType)}
                                </Badge>
                                <Badge variant="secondary" className={cn("text-xs", getPriorityColor(template.priority))}>
                                  <Flag className="w-3 h-3 mr-1" />
                                  {template.priority}
                                </Badge>
                                {template.subtasks && template.subtasks.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {t('templates.subtasksCount', { count: template.subtasks.length })}
                                  </Badge>
                                )}
                                {template.tags?.map(tag => (
                                  <Badge
                                    key={tag.name}
                                    variant="outline"
                                    className="text-xs"
                                    style={{ borderColor: tag.color, color: tag.color }}
                                  >
                                    {tag.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {filteredTemplates.length === 0 && (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">{t('templates.noTemplates')}</p>
                  <Button variant="outline" className="mt-4" onClick={handleCreateTemplate}>
                    {t('templates.createCustom')}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Create/Edit Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? t('templates.editTemplate') : t('templates.createTemplate')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('templates.templateName')}</Label>
              <Input
                placeholder={t('templates.templateNamePlaceholder')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('templates.taskText')}</Label>
              <Input
                placeholder={t('templates.taskTextPlaceholder')}
                value={formTaskText}
                onChange={(e) => setFormTaskText(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('tasks.description')}</Label>
              <Input
                placeholder={t('templates.descriptionPlaceholder')}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('templates.icon')}</Label>
                <Select value={formIcon} onValueChange={setFormIcon}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = getIcon(formIcon);
                          return <Icon className="w-4 h-4" />;
                        })()}
                        {formIcon}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ICON_OPTIONS.map(icon => {
                      const Icon = ICON_MAP[icon];
                      return (
                        <SelectItem key={icon} value={icon}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {icon}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{t('tasks.priority.title')}</Label>
                <Select value={formPriority} onValueChange={(v) => setFormPriority(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">{t('tasks.priority.high')}</SelectItem>
                    <SelectItem value="medium">{t('tasks.priority.medium')}</SelectItem>
                    <SelectItem value="low">{t('tasks.priority.low')}</SelectItem>
                    <SelectItem value="none">{t('tasks.priority.none')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>{t('tasks.repeat.title')}</Label>
              <Select value={formRepeatType} onValueChange={(v) => setFormRepeatType(v as RepeatType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('templates.oneTime')}</SelectItem>
                  <SelectItem value="daily">{t('tasks.repeat.daily')}</SelectItem>
                  <SelectItem value="weekdays">{t('templates.weekdays')}</SelectItem>
                  <SelectItem value="weekends">{t('templates.weekends')}</SelectItem>
                  <SelectItem value="weekly">{t('tasks.repeat.weekly')}</SelectItem>
                  <SelectItem value="monthly">{t('tasks.repeat.monthly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>{t('templates.subtasksLabel')}</Label>
              <Textarea
                placeholder={t('templates.subtasksPlaceholder')}
                value={formSubtasks}
                onChange={(e) => setFormSubtasks(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!formName || !formTaskText}>
              {editingTemplate ? t('templates.saveChanges') : t('templates.createTemplate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

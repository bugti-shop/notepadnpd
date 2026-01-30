import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TasksSettings {
  defaultPriority: 'none' | 'low' | 'medium' | 'high';
  defaultDueDate: 'none' | 'today' | 'tomorrow';
  showCompletedTasks: boolean;
  autoArchiveCompleted: boolean;
  archiveAfterDays: number;
  confirmBeforeDelete: boolean;
  swipeToComplete: boolean;
}

const DEFAULT_TASKS_SETTINGS: TasksSettings = {
  defaultPriority: 'none',
  defaultDueDate: 'none',
  showCompletedTasks: true,
  autoArchiveCompleted: false,
  archiveAfterDays: 7,
  confirmBeforeDelete: true,
  swipeToComplete: true,
};

interface TasksSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TasksSettingsSheet = ({ isOpen, onClose }: TasksSettingsSheetProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<TasksSettings>(DEFAULT_TASKS_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const saved = await getSetting<TasksSettings | null>('tasksSettings', null);
      if (saved) {
        setSettings({ ...DEFAULT_TASKS_SETTINGS, ...saved });
      }
    } catch (error) {
      console.error('Error loading tasks settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: TasksSettings) => {
    setSettings(newSettings);
    await setSetting('tasksSettings', newSettings);
    toast.success(t('settings.settingsSaved', 'Settings saved'));
  };

  const updateSetting = async <K extends keyof TasksSettings>(key: K, value: TasksSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
  };

  const SectionHeading = ({ title }: { title: string }) => (
    <div className="px-4 py-2 bg-muted/50">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-lg">{t('settings.tasksSettings', 'Tasks Settings')}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="py-2">
            {/* Defaults Section */}
            <SectionHeading title={t('settings.defaults', 'Defaults')} />
            
            <div className="px-4 py-3 border-b border-border/50">
              <label className="text-sm text-muted-foreground mb-2 block">
                {t('settings.defaultPriority', 'Default Priority')}
              </label>
              <Select 
                value={settings.defaultPriority} 
                onValueChange={(v: TasksSettings['defaultPriority']) => updateSetting('defaultPriority', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('priority.none', 'None')}</SelectItem>
                  <SelectItem value="low">{t('priority.low', 'Low')}</SelectItem>
                  <SelectItem value="medium">{t('priority.medium', 'Medium')}</SelectItem>
                  <SelectItem value="high">{t('priority.high', 'High')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="px-4 py-3 border-b border-border/50">
              <label className="text-sm text-muted-foreground mb-2 block">
                {t('settings.defaultDueDate', 'Default Due Date')}
              </label>
              <Select 
                value={settings.defaultDueDate} 
                onValueChange={(v: TasksSettings['defaultDueDate']) => updateSetting('defaultDueDate', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('dueDate.none', 'None')}</SelectItem>
                  <SelectItem value="today">{t('dueDate.today', 'Today')}</SelectItem>
                  <SelectItem value="tomorrow">{t('dueDate.tomorrow', 'Tomorrow')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Behavior Section */}
            <SectionHeading title={t('settings.behavior', 'Behavior')} />

            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex-1 pr-4">
                <span className="text-foreground text-sm block">
                  {t('settings.showCompletedTasks', 'Show Completed Tasks')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('settings.showCompletedTasksDesc', 'Display completed tasks in the list')}
                </span>
              </div>
              <Switch
                checked={settings.showCompletedTasks}
                onCheckedChange={(checked) => updateSetting('showCompletedTasks', checked)}
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex-1 pr-4">
                <span className="text-foreground text-sm block">
                  {t('settings.confirmBeforeDelete', 'Confirm Before Delete')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('settings.confirmBeforeDeleteDesc', 'Show confirmation dialog before deleting tasks')}
                </span>
              </div>
              <Switch
                checked={settings.confirmBeforeDelete}
                onCheckedChange={(checked) => updateSetting('confirmBeforeDelete', checked)}
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex-1 pr-4">
                <span className="text-foreground text-sm block">
                  {t('settings.swipeToComplete', 'Swipe to Complete')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('settings.swipeToCompleteDesc', 'Swipe right on a task to mark it complete')}
                </span>
              </div>
              <Switch
                checked={settings.swipeToComplete}
                onCheckedChange={(checked) => updateSetting('swipeToComplete', checked)}
              />
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

// Hook to access tasks settings
export const useTasksSettings = () => {
  const [settings, setSettings] = useState<TasksSettings>(DEFAULT_TASKS_SETTINGS);

  useEffect(() => {
    getSetting<TasksSettings | null>('tasksSettings', null).then((saved) => {
      if (saved) {
        setSettings({ ...DEFAULT_TASKS_SETTINGS, ...saved });
      }
    });
  }, []);

  return settings;
};

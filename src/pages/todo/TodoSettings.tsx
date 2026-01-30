import { ChevronRight, Settings as SettingsIcon, Palette, Check, Bell } from 'lucide-react';
import { useDarkMode, themes } from '@/hooks/useDarkMode';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TodoLayout } from './TodoLayout';
import { loadTasksFromDB, saveTasksToDB } from '@/utils/taskStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TodoSettings = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentTheme, setTheme } = useDarkMode();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  
  // Auto-reminder time settings
  const [showAutoReminderDialog, setShowAutoReminderDialog] = useState(false);
  const [morningReminderHour, setMorningReminderHour] = useState(9);
  const [afternoonReminderHour, setAfternoonReminderHour] = useState(14);
  const [eveningReminderHour, setEveningReminderHour] = useState(19);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load auto-reminder times
        const savedReminderTimes = await getSetting<{ morning: number; afternoon: number; evening: number } | null>('autoReminderTimes', null);
        if (savedReminderTimes) {
          setMorningReminderHour(savedReminderTimes.morning || 9);
          setAfternoonReminderHour(savedReminderTimes.afternoon || 14);
          setEveningReminderHour(savedReminderTimes.evening || 19);
        }
      } catch (error) {
        console.error('Error loading settings data:', error);
      }
    };
    loadSettings();
  }, []);

  const handleSaveAutoReminderTimes = async () => {
    const times = {
      morning: morningReminderHour,
      afternoon: afternoonReminderHour,
      evening: eveningReminderHour,
    };
    await setSetting('autoReminderTimes', times);
    setShowAutoReminderDialog(false);
    toast({ title: t('settings.reminderTimesSaved') });
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12:00 AM';
    if (hour === 12) return '12:00 PM';
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };

  const handleBackupData = async () => {
    const tasks = await loadTasksFromDB();
    const folders = await getSetting('todoFolders', []);
    const backup = { 
      todoItems: JSON.stringify(tasks), 
      todoFolders: JSON.stringify(folders), 
      timestamp: new Date().toISOString() 
    };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `npd-todo-backup-${Date.now()}.json`;
    a.click();
    toast({ title: t('settings.dataBackedUp') });
  };

  const handleRestoreData = () => {
    setShowRestoreDialog(true);
  };

  const confirmRestoreData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const backup = JSON.parse(event.target?.result as string);
            if (backup.todoItems) {
              const tasks = JSON.parse(backup.todoItems);
              await saveTasksToDB(tasks);
            }
            if (backup.todoFolders) {
              const folders = JSON.parse(backup.todoFolders);
              await setSetting('todoFolders', folders);
            }
            toast({ title: t('settings.dataRestored') });
            setTimeout(() => window.location.reload(), 1000);
          } catch (error) {
            toast({ title: t('settings.restoreFailed'), variant: "destructive" });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
    setShowRestoreDialog(false);
  };

  const handleDownloadData = async () => {
    const tasks = await loadTasksFromDB();
    const folders = await getSetting('todoFolders', []);
    const allData = {
      todoItems: tasks,
      todoFolders: folders,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `npd-todo-data-${Date.now()}.json`;
    a.click();
    toast({ title: t('settings.dataDownloaded') });
  };

  const handleDeleteData = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteData = async () => {
    const { removeSetting } = await import('@/utils/settingsStorage');
    const { saveTasksToDB } = await import('@/utils/taskStorage');
    await saveTasksToDB([]);
    await removeSetting('todoFolders');
    toast({ title: t('settings.allDataDeleted') });
    setShowDeleteDialog(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleRateAndShare = () => {
    window.open('https://play.google.com/store/apps/details?id=nota.npd.com', '_blank');
  };

  const settingsItems = [
    { label: t('settings.backupData'), onClick: handleBackupData },
    { label: t('settings.restoreData'), onClick: handleRestoreData },
    { label: t('settings.downloadData'), onClick: handleDownloadData },
    { label: t('settings.deleteData'), onClick: handleDeleteData },
  ];

  const otherItems = [
    { label: t('settings.shareWithFriends'), onClick: handleRateAndShare },
    { label: t('settings.termsOfService'), onClick: () => setShowTermsDialog(true) },
    { label: t('settings.helpFeedback'), onClick: () => setShowHelpDialog(true) },
    { label: t('settings.privacy'), onClick: () => setShowPrivacyDialog(true) },
    { label: t('settings.rateApp'), onClick: handleRateAndShare },
  ];

  return (
    <TodoLayout title={t('settings.title')}>
      <main className="container mx-auto px-4 py-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Theme Switcher Section */}
          <div className="bg-card border rounded-lg">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">{t('settings.appearance')}</h2>
              </div>
            </div>
            <button
              onClick={() => setShowThemeDialog(true)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full border border-border",
                  themes.find(t => t.id === currentTheme)?.preview
                )} />
                <span className="text-foreground text-sm">
                  {themes.find(t => t.id === currentTheme)?.name || 'Light Mode'}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>


          {/* Auto-Reminder Settings */}
          <div className="bg-card border rounded-lg">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">{t('settings.autoReminderSettings')}</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings.autoReminderNote')}
              </p>
            </div>
            <button
              onClick={() => setShowAutoReminderDialog(true)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="text-foreground text-sm">{t('settings.reminderTimes')}</span>
                <span className="text-xs text-muted-foreground">
                  {formatHour(morningReminderHour)}, {formatHour(afternoonReminderHour)}, {formatHour(eveningReminderHour)}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Settings Items */}
          <div className="space-y-1">
            {settingsItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/50 transition-colors"
              >
                <span className="text-foreground text-sm">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}

            <div className="flex items-center gap-2 px-4 py-3">
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground text-sm font-medium">{t('settings.other')}</span>
            </div>

            {otherItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/50 transition-colors"
              >
                <span className="text-foreground text-sm">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.deleteTodoTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.deleteTodoDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.restoreTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.restoreDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestoreData}>
              {t('common.restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-Reminder Times Dialog */}
      <Dialog open={showAutoReminderDialog} onOpenChange={setShowAutoReminderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('settings.autoReminderSettings')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.morningReminder')}</label>
              <select
                value={morningReminderHour}
                onChange={(e) => setMorningReminderHour(Number(e.target.value))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{formatHour(i)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.afternoonReminder')}</label>
              <select
                value={afternoonReminderHour}
                onChange={(e) => setAfternoonReminderHour(Number(e.target.value))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{formatHour(i)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.eveningReminder')}</label>
              <select
                value={eveningReminderHour}
                onChange={(e) => setEveningReminderHour(Number(e.target.value))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{formatHour(i)}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAutoReminderDialog(false)} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveAutoReminderTimes} className="flex-1">
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Terms of Service Dialog */}
      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Terms of Service</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
                <p className="text-muted-foreground">By accessing and using NPD, you accept and agree to be bound by the terms and provision of this agreement.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. Use License</h3>
                <p className="text-muted-foreground">Permission is granted to temporarily use NPD for personal, non-commercial transitory viewing only.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. User Data</h3>
                <p className="text-muted-foreground">All tasks and data are stored locally on your device. You are responsible for backing up your data regularly.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. Disclaimer</h3>
                <p className="text-muted-foreground">The app is provided "as is" without warranty of any kind. We do not guarantee that the app will be error-free or uninterrupted.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Limitations</h3>
                <p className="text-muted-foreground">In no event shall NPD or its suppliers be liable for any damages arising out of the use or inability to use the app.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. Modifications</h3>
                <p className="text-muted-foreground">We may revise these terms at any time without notice. By using this app, you agree to be bound by the current version of these terms.</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">1. Information We Collect</h3>
                <p className="text-muted-foreground">NPD stores all your tasks and data locally on your device. We do not collect, transmit, or store any personal information on external servers.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. Local Storage</h3>
                <p className="text-muted-foreground">Your tasks, folders, and settings are stored using your device's local storage. This data remains on your device and is not accessible to us.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. Data Security</h3>
                <p className="text-muted-foreground">Since all data is stored locally, the security of your information depends on your device's security measures. We recommend using device encryption and strong passwords.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. Third-Party Services</h3>
                <p className="text-muted-foreground">We do not use any third-party analytics or tracking services. Your data is completely private and stays on your device.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Data Backup</h3>
                <p className="text-muted-foreground">You can backup your data using the backup feature. Backup files are stored on your device and you control where they are kept.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. Changes to Privacy Policy</h3>
                <p className="text-muted-foreground">We may update this privacy policy from time to time. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Help and Feedback Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Help & Feedback</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">Getting Started</h3>
                <p className="text-muted-foreground">Create your first task by tapping the "Add Task" button. Set priorities, due dates, and reminders to stay organized.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Organizing Tasks</h3>
                <p className="text-muted-foreground">Use folders and categories to organize your tasks. Add subtasks to break down larger projects into manageable steps.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Backup & Restore</h3>
                <p className="text-muted-foreground">Regularly backup your data using the "Back up data" option. Keep your backup files in a safe location like cloud storage.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Common Issues</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Tasks not saving? Check your device storage space.</li>
                  <li>App running slow? Try completing or archiving old tasks.</li>
                  <li>Lost data? Restore from your latest backup file.</li>
                </ul>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Contact Support</h3>
                <p className="text-muted-foreground">For additional help or to report issues, please contact us through the app store review section or reach out via our support channels.</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Feedback</h3>
                <p className="text-muted-foreground">We value your feedback! Let us know how we can improve NPD by rating the app and leaving a review.</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Theme Selector Dialog */}
      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Theme</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-2 gap-3">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id);
                    toast({ title: `Theme changed to ${theme.name}` });
                    setShowThemeDialog(false);
                  }}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all hover:scale-[1.02]",
                    currentTheme === theme.id ? "border-primary" : "border-transparent"
                  )}
                >
                  <div className={cn(
                    "w-full aspect-square rounded-lg mb-2",
                    theme.preview
                  )} />
                  <p className="text-sm font-medium text-center">{theme.name}</p>
                  {currentTheme === theme.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </TodoLayout>
  );
};

export default TodoSettings;

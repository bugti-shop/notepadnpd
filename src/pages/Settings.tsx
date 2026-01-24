import { BottomNavigation } from '@/components/BottomNavigation';
import { ChevronRight, Settings as SettingsIcon, Crown, CreditCard, Palette, Check, Clock, Vibrate, ExternalLink, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import appLogo from '@/assets/app-logo.png';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { Capacitor } from '@capacitor/core';
import { useDarkMode, themes, ThemeId } from '@/hooks/useDarkMode';
import { differenceInDays, differenceInHours, differenceInMinutes, addDays } from 'date-fns';
import { Note } from '@/types/note';
import { useTranslation } from 'react-i18next';
import { languages } from '@/i18n';
import { loadNotesFromDB, saveNotesToDB } from '@/utils/noteStorage';
import { getSetting, setSetting, getAllSettings, clearAllSettings } from '@/utils/settingsStorage';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const Settings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isPro, customerInfo, presentPaywall, presentCustomerCenter, restorePurchases, isInitialized } = useRevenueCat();
  const { currentTheme, setTheme } = useDarkMode();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showHapticDialog, setShowHapticDialog] = useState(false);
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [hapticIntensity, setHapticIntensity] = useState<'off' | 'light' | 'medium' | 'heavy'>('medium');
  const [isRestoring, setIsRestoring] = useState(false);

  // Load haptic intensity from IndexedDB
  useEffect(() => {
    getSetting<'off' | 'light' | 'medium' | 'heavy'>('haptic_intensity', 'medium').then(setHapticIntensity);
  }, []);

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  const handleLanguageChange = async (langCode: string) => {
    i18n.changeLanguage(langCode);
    await setSetting('npd_language', langCode);
    const lang = languages.find(l => l.code === langCode);
    toast({ title: t('settings.languageChanged', { language: lang?.nativeName || langCode }) });
    setShowLanguageDialog(false);
  };
  const [notes, setNotes] = useState<Note[]>([]);

  // Load notes for hidden notes section
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const loadedNotes = await loadNotesFromDB();
        setNotes(loadedNotes);
      } catch (error) {
        console.error('Error loading notes:', error);
      }
    };
    loadNotes();
  }, []);

  // Check for admin bypass (using state to avoid sync access)
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [hasLocalProAccess, setHasLocalProAccess] = useState(false);
  
  useEffect(() => {
    getSetting<boolean>('npd_admin_bypass', false).then(setHasAdminAccess);
    getSetting<boolean>('npd_pro_access', false).then(setHasLocalProAccess);
  }, []);
  
  const isProUser = isPro || hasAdminAccess || hasLocalProAccess;

  // Trial countdown calculation
  const [trialRemaining, setTrialRemaining] = useState<{ days: number; hours: number; minutes: number } | null>(null);
  const [hasShownTrialWarning, setHasShownTrialWarning] = useState(false);
  
  useEffect(() => {
    const loadTrialData = async () => {
      const trialStartStr = await getSetting<string | null>('npd_trial_start', null);
      if (trialStartStr && isProUser && !hasAdminAccess) {
        const trialStart = new Date(trialStartStr);
        const trialEnd = addDays(trialStart, 3); // 3-day trial
        
        const updateCountdown = () => {
          const now = new Date();
          if (now < trialEnd) {
            const totalMinutesRemaining = differenceInMinutes(trialEnd, now);
            const days = Math.floor(totalMinutesRemaining / (24 * 60));
            const hours = Math.floor((totalMinutesRemaining % (24 * 60)) / 60);
            const minutes = totalMinutesRemaining % 60;
            setTrialRemaining({ days, hours, minutes });
            
            // Show warning toast when less than 24 hours remaining (once per session)
            const sessionWarningShown = sessionStorage.getItem('npd_trial_warning_shown');
            if (days === 0 && !sessionWarningShown && !hasShownTrialWarning) {
              toast({
                title: `⏰ ${t('trial.endingSoon')}`,
                description: t('trial.expiresIn', { hours, minutes }),
                duration: 10000,
              });
              sessionStorage.setItem('npd_trial_warning_shown', 'true');
              setHasShownTrialWarning(true);
            }
          } else {
            setTrialRemaining(null); // Trial ended
          }
        };
        
        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // Update every minute
        return () => clearInterval(interval);
      }
    };
    loadTrialData();
  }, [isProUser, hasAdminAccess, hasShownTrialWarning, toast, t]);

  const handleBackupData = async () => {
    try {
      const notesData = await loadNotesFromDB();
      const folders = await getSetting<any[]>('folders', []);
      const backup = { notes: JSON.stringify(notesData), folders: JSON.stringify(folders), timestamp: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `npd-backup-${Date.now()}.json`;
      a.click();
      toast({ title: t('toasts.dataBackedUp') });
    } catch (error) {
      console.error('Backup error:', error);
      toast({ title: t('toasts.backupFailed'), variant: "destructive" });
    }
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
            if (backup.notes) {
              const notesData = JSON.parse(backup.notes);
              const hydratedNotes = notesData.map((n: any) => ({
                ...n,
                createdAt: new Date(n.createdAt),
                updatedAt: new Date(n.updatedAt),
                voiceRecordings: n.voiceRecordings?.map((r: any) => ({
                  ...r,
                  timestamp: new Date(r.timestamp),
                })) || [],
              }));
              await saveNotesToDB(hydratedNotes);
            }
              if (backup.folders) {
                const foldersData = JSON.parse(backup.folders);
                await setSetting('folders', foldersData);
              }
              toast({ title: t('toasts.dataRestored') });
              setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
              toast({ title: t('toasts.restoreFailed'), variant: "destructive" });
            }
          };
          reader.readAsText(file);
      }
    };
    input.click();
    setShowRestoreDialog(false);
  };

  const handleDownloadData = async () => {
    try {
      const notesData = await loadNotesFromDB();
      const folders = await getSetting<any[]>('folders', []);
      const allData = {
        notes: notesData,
        folders,
        timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `npd-data-${Date.now()}.json`;
      a.click();
      toast({ title: t('toasts.dataDownloaded') });
    } catch (error) {
      console.error('Download error:', error);
      toast({ title: t('toasts.downloadFailed'), variant: "destructive" });
    }
  };

  const handleDeleteData = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteData = async () => {
    // Clear IndexedDB settings
    await clearAllSettings();
    toast({ title: t('toasts.dataDeleted') });
    setShowDeleteDialog(false);
    setTimeout(() => window.location.href = '/', 1000);
  };

  const handleShareApp = () => {
    if (navigator.share) {
      navigator.share({
        title: t('share.appTitle'),
        text: t('share.appDescription'),
        url: window.location.origin
      });
    } else {
      toast({ title: t('toasts.shareNotAvailable') });
    }
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      await restorePurchases();
      toast({ title: t('toasts.purchasesRestored') });
    } catch (error) {
      toast({ title: t('toasts.purchasesFailed'), variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    if (Capacitor.isNativePlatform()) {
      await presentCustomerCenter();
    } else {
      window.open('https://play.google.com/store/account/subscriptions', '_blank');
    }
  };

  const settingsItems = [
    { label: t('settings.backupData'), onClick: handleBackupData },
    { label: t('settings.restoreData'), onClick: handleRestoreData },
    { label: t('settings.downloadData'), onClick: handleDownloadData },
    { label: t('settings.deleteData'), onClick: handleDeleteData },
  ];

  const handleRateAndShare = () => {
    window.open('https://play.google.com/store/apps/details?id=nota.npd.com', '_blank');
  };

  const otherItems = [
    { label: t('settings.shareWithFriends'), onClick: handleRateAndShare },
    { label: t('settings.termsOfService'), onClick: () => setShowTermsDialog(true) },
    { label: t('settings.helpFeedback'), onClick: () => setShowHelpDialog(true) },
    { label: t('settings.privacy'), onClick: () => setShowPrivacyDialog(true) },
    { label: t('settings.rateApp'), onClick: handleRateAndShare },
  ];

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-background pb-16 sm:pb-20">
      <header className="border-b sticky top-0 bg-card z-10">
        <div className="container mx-auto px-2 xs:px-3 sm:px-4 py-2 xs:py-3 sm:py-4">
          <div className="flex items-center gap-1.5 xs:gap-2 min-w-0">
            <img src={appLogo} alt="Npd" className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 flex-shrink-0" />
            <h1 className="text-base xs:text-lg sm:text-xl font-bold truncate">{t('settings.title')}</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-2 xs:px-3 sm:px-4 py-3 xs:py-4 sm:py-6">
        <div className="max-w-2xl mx-auto space-y-4 xs:space-y-6">
          {/* Theme Switcher */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-4 py-3">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground text-sm font-medium">{t('settings.appearance')}</span>
            </div>
            <button
              onClick={() => setShowThemeDialog(true)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
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

          {/* Language */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-4 py-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground text-sm font-medium">{t('settings.language')}</span>
            </div>
            <button
              onClick={() => setShowLanguageDialog(true)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-foreground text-sm">{currentLanguage.nativeName}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Haptic Feedback */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-4 py-3">
              <Vibrate className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground text-sm font-medium">{t('settings.hapticFeedback')}</span>
            </div>
            <button
              onClick={() => setShowHapticDialog(true)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-foreground text-sm">
                  {hapticIntensity === 'off' ? t('settings.hapticOff') : t(`settings.haptic${hapticIntensity.charAt(0).toUpperCase() + hapticIntensity.slice(1)}`)}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Integrations & Import */}
          <div className="space-y-1">
            <button
              onClick={() => navigate('/settings/sync')}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5 text-emerald-500" />
                <span className="text-foreground text-sm">{t('settings.integrationsImport')}</span>
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
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
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
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
            >
              <span className="text-foreground text-sm">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          </div>
        </div>
      </main>

      <BottomNavigation />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-destructive">⚠️ {t('dialogs.deleteWarning')}</p>
              <p>{t('dialogs.deleteDesc')}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('dialogs.deleteNotes')}</li>
                <li>{t('dialogs.deleteSettings')}</li>
                <li>{t('dialogs.deleteLocal')}</li>
              </ul>
              <p className="font-medium mt-2">{t('dialogs.deleteConfirm')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteData} className="bg-destructive hover:bg-destructive/90">
              {t('dialogs.deleteEverything')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.restoreTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-orange-600">⚠️ {t('dialogs.restoreNotice')}</p>
              <p>{t('dialogs.restoreDesc')}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('dialogs.restoreReplace')}</li>
                <li>{t('dialogs.restoreOverwrite')}</li>
                <li>{t('dialogs.restoreReload')}</li>
              </ul>
              <p className="font-medium mt-2">{t('dialogs.restoreBackup')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestoreData}>
              {t('dialogs.continueRestore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terms of Service Dialog */}
      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('terms.title')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">1. {t('terms.acceptance')}</h3>
                <p className="text-muted-foreground">{t('terms.acceptanceDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. {t('terms.license')}</h3>
                <p className="text-muted-foreground">{t('terms.licenseDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. {t('terms.userData')}</h3>
                <p className="text-muted-foreground">{t('terms.userDataDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. {t('terms.disclaimer')}</h3>
                <p className="text-muted-foreground">{t('terms.disclaimerDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. {t('terms.limitations')}</h3>
                <p className="text-muted-foreground">{t('terms.limitationsDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. {t('terms.modifications')}</h3>
                <p className="text-muted-foreground">{t('terms.modificationsDesc')}</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('privacy.title')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">1. {t('privacy.infoCollect')}</h3>
                <p className="text-muted-foreground">{t('privacy.infoCollectDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. {t('privacy.localStorage')}</h3>
                <p className="text-muted-foreground">{t('privacy.localStorageDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. {t('privacy.dataSecurity')}</h3>
                <p className="text-muted-foreground">{t('privacy.dataSecurityDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. {t('privacy.thirdParty')}</h3>
                <p className="text-muted-foreground">{t('privacy.thirdPartyDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. {t('privacy.dataBackup')}</h3>
                <p className="text-muted-foreground">{t('privacy.dataBackupDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. {t('privacy.changes')}</h3>
                <p className="text-muted-foreground">{t('privacy.changesDesc')}</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Help and Feedback Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('help.title')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">{t('help.gettingStarted')}</h3>
                <p className="text-muted-foreground">{t('help.gettingStartedDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.organizing')}</h3>
                <p className="text-muted-foreground">{t('help.organizingDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.backupRestore')}</h3>
                <p className="text-muted-foreground">{t('help.backupRestoreDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.commonIssues')}</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{t('help.issueNotSaving')}</li>
                  <li>{t('help.issueSlow')}</li>
                  <li>{t('help.issueLostData')}</li>
                </ul>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.contactSupport')}</h3>
                <p className="text-muted-foreground">{t('help.contactSupportDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.feedback')}</h3>
                <p className="text-muted-foreground">{t('help.feedbackDesc')}</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Theme Switcher Dialog */}
      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('settings.chooseTheme')}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="grid grid-cols-2 gap-3">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id);
                    toast({ title: t('settings.themeChanged', { theme: theme.name }) });
                  }}
                  className={cn(
                    "relative rounded-xl p-3 border-2 transition-all",
                    currentTheme === theme.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "w-full h-16 rounded-lg mb-2",
                    theme.preview
                  )} />
                  <span className="text-sm font-medium text-foreground">{theme.name}</span>
                  {currentTheme === theme.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Haptic Feedback Dialog */}
      <Dialog open={showHapticDialog} onOpenChange={setShowHapticDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Vibrate className="h-5 w-5" />
              {t('settings.hapticFeedback')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(['off', 'light', 'medium', 'heavy'] as const).map((intensity) => (
              <button
                key={intensity}
                onClick={async () => {
                  setHapticIntensity(intensity);
                  await setSetting('haptic_intensity', intensity);
                  const label = intensity === 'off' ? t('settings.hapticOff') : t(`settings.haptic${intensity.charAt(0).toUpperCase() + intensity.slice(1)}`);
                  toast({ title: t('settings.hapticSet', { intensity: label }) });
                  setShowHapticDialog(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                  hapticIntensity === intensity
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium text-foreground">
                    {intensity === 'off' ? t('settings.hapticOff') : t(`settings.haptic${intensity.charAt(0).toUpperCase() + intensity.slice(1)}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`settings.haptic${intensity.charAt(0).toUpperCase() + intensity.slice(1)}Desc`)}
                  </span>
                </div>
                {hapticIntensity === intensity && (
                  <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Language Dialog */}
      <Dialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
        <DialogContent className="max-w-md max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('settings.chooseLanguage')}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                    i18n.language === lang.code
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-foreground">{lang.nativeName}</span>
                    <span className="text-xs text-muted-foreground">{lang.name}</span>
                  </div>
                  {i18n.language === lang.code && (
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default Settings;

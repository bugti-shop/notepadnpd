import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw, Check, LogOut, Calendar, Cloud, CloudOff, Wifi, ArrowLeftRight, Download, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGoogleAuth } from "@/contexts/GoogleAuthContext";
import { getGoogleDriveSyncManager, startAutoSync, stopAutoSync, isSyncActive } from "@/utils/googleDriveSync";
import { GoogleCalendarSyncManager, getCalendarSyncSettings, setCalendarSyncSettings, GoogleCalendarInfo } from "@/utils/googleCalendarSync";
import { startCalendarAutoSync, stopCalendarAutoSync, isCalendarSyncActive, triggerCalendarSync } from "@/utils/calendarBidirectionalSync";
import { getSetting, setSetting } from "@/utils/settingsStorage";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Import logos
import logoGoogleDrive from "@/assets/logo-google-drive.png";
import logoGoogleCalendar from "@/assets/logo-google-calendar.png";
import logoClickUp from "@/assets/logo-clickup.png";
import logoNotion from "@/assets/logo-notion.png";
import logoHubSpot from "@/assets/logo-hubspot.png";
import logoTickTick from "@/assets/logo-ticktick.png";
import logoTodoist from "@/assets/logo-todoist.png";
import logoEvernote from "@/assets/logo-evernote.png";

interface SyncStatus {
  status: 'synced' | 'syncing' | 'error' | 'idle' | 'offline';
  timestamp?: string;
  message?: string;
}

interface CalendarSyncStatus {
  status: 'synced' | 'syncing' | 'error' | 'idle';
  imported?: number;
  exported?: number;
  timestamp?: string;
}

const SyncSettings = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user, tokens, isAuthenticated, isLoading: authLoading, isRestoring, signIn, signOut } = useGoogleAuth();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [cloudBackupInfo, setCloudBackupInfo] = useState<{ exists: boolean; lastModified?: Date; size?: number } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: 'idle' });
  const [backgroundSyncActive, setBackgroundSyncActive] = useState(false);
  
  // Calendar sync settings
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [calendarSyncStatus, setCalendarSyncStatus] = useState<CalendarSyncStatus>({ status: 'idle' });
  const [isCalendarSyncing, setIsCalendarSyncing] = useState(false);
  const [calendarBidirectionalEnabled, setCalendarBidirectionalEnabled] = useState(false);

  // Listen for sync status changes
  useEffect(() => {
    const handleSyncStatus = (event: CustomEvent<SyncStatus>) => {
      setSyncStatus(event.detail);
      if (event.detail.timestamp) {
        setLastSyncTime(event.detail.timestamp);
      }
    };

    const handleCalendarSyncStatus = (event: CustomEvent<CalendarSyncStatus>) => {
      setCalendarSyncStatus(event.detail);
      if (event.detail.status === 'syncing') {
        setIsCalendarSyncing(true);
      } else {
        setIsCalendarSyncing(false);
      }
    };

    window.addEventListener('syncStatusChanged', handleSyncStatus as EventListener);
    window.addEventListener('calendarSyncStatusChanged', handleCalendarSyncStatus as EventListener);
    return () => {
      window.removeEventListener('syncStatusChanged', handleSyncStatus as EventListener);
      window.removeEventListener('calendarSyncStatusChanged', handleCalendarSyncStatus as EventListener);
    };
  }, []);

  // Load settings and cloud info when authenticated
  useEffect(() => {
    const loadData = async () => {
      if (isAuthenticated && tokens?.accessToken) {
        // Check if background sync is active
        setBackgroundSyncActive(isSyncActive());
        
        // Load calendar sync settings
        const calSettings = await getCalendarSyncSettings();
        setCalendarSyncEnabled(calSettings.enabled);
        setSelectedCalendarId(calSettings.selectedCalendarId);
        
        // Check if bidirectional calendar sync is active
        setCalendarBidirectionalEnabled(isCalendarSyncActive());
        
        // Load auto sync setting
        const autoSync = await getSetting<boolean>('google_auto_sync_enabled', false);
        setAutoSyncEnabled(autoSync);
        
        // Load last sync time
        const syncMetadata = await getSetting<{ lastSyncTime?: string } | null>('google_drive_sync_metadata', null);
        if (syncMetadata?.lastSyncTime) {
          setLastSyncTime(syncMetadata.lastSyncTime);
        }
        
        // Get cloud backup info
        try {
          const driveManager = getGoogleDriveSyncManager(tokens.accessToken);
          const info = await driveManager.getCloudBackupInfo();
          setCloudBackupInfo(info);
        } catch (error) {
          console.error('Error getting backup info:', error);
        }
        
        // Fetch available calendars
        fetchCalendars();
      }
    };
    
    loadData();
  }, [isAuthenticated, tokens?.accessToken]);

  const fetchCalendars = async () => {
    if (!tokens?.accessToken) return;
    
    setLoadingCalendars(true);
    try {
      const calManager = new GoogleCalendarSyncManager(tokens.accessToken);
      const cals = await calManager.getCalendarList();
      setCalendars(cals);
    } catch (error) {
      console.error('Error fetching calendars:', error);
    }
    setLoadingCalendars(false);
  };

  const handleSignIn = async () => {
    const success = await signIn();
    if (success) {
      toast({
        title: t('sync.signedIn'),
        description: t('sync.signedInDesc'),
      });
    }
    // No error toast - user cancellation and other issues are handled silently
    // The context already logs errors for debugging
  };

  const handleSignOut = async () => {
    stopAutoSync();
    await signOut();
    setLastSyncTime(null);
    setCloudBackupInfo(null);
    setCalendars([]);
    toast({
      title: t('sync.signedOut'),
      description: t('sync.signedOutDesc'),
    });
  };

  const handleSyncNow = async () => {
    if (!tokens?.accessToken) return;
    
    setIsSyncing(true);
    try {
      const driveManager = getGoogleDriveSyncManager(tokens.accessToken);
      const result = await driveManager.performSync();
      
      if (result.success) {
        setLastSyncTime(new Date().toISOString());
        const info = await driveManager.getCloudBackupInfo();
        setCloudBackupInfo(info);
        
        toast({
          title: t('sync.syncComplete'),
          description: result.action === 'uploaded' 
            ? t('sync.dataUploaded')
            : result.action === 'downloaded'
            ? t('sync.dataDownloaded')
            : t('sync.alreadySynced'),
        });
      } else {
        toast({
          title: t('sync.syncFailed'),
          description: result.error || t('errors.generic'),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('sync.syncFailed'),
        description: t('errors.generic'),
        variant: "destructive",
      });
    }
    setIsSyncing(false);
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    await setSetting('google_auto_sync_enabled', enabled);
    
    if (enabled && tokens?.accessToken) {
      startAutoSync(tokens.accessToken, 5);
      toast({
        title: t('sync.autoSyncEnabled'),
        description: t('sync.autoSyncEnabledDesc'),
      });
    } else {
      stopAutoSync();
      toast({
        title: t('sync.autoSyncDisabled'),
        description: t('sync.autoSyncDisabledDesc'),
      });
    }
  };

  const handleCalendarSyncToggle = async (enabled: boolean) => {
    setCalendarSyncEnabled(enabled);
    await setCalendarSyncSettings({ enabled });
    
    if (enabled && tokens?.accessToken) {
      // Start bidirectional calendar sync
      setIsCalendarSyncing(true);
      try {
        await startCalendarAutoSync(tokens.accessToken, 5);
        setCalendarBidirectionalEnabled(true);
        toast({
          title: t('sync.calendarSyncEnabled'),
          description: t('sync.bidirectionalSyncStarted'),
        });
      } catch (error) {
        console.error('Calendar sync error:', error);
        toast({
          title: t('sync.syncFailed'),
          description: t('errors.generic'),
          variant: "destructive",
        });
      }
      setIsCalendarSyncing(false);
    } else {
      stopCalendarAutoSync();
      setCalendarBidirectionalEnabled(false);
    }
  };

  const handleCalendarSyncNow = async () => {
    if (!tokens?.accessToken) return;
    
    setIsCalendarSyncing(true);
    try {
      await triggerCalendarSync(tokens.accessToken);
      toast({
        title: t('sync.syncComplete'),
        description: t('sync.calendarSynced'),
      });
    } catch (error) {
      toast({
        title: t('sync.syncFailed'),
        description: t('errors.generic'),
        variant: "destructive",
      });
    }
    setIsCalendarSyncing(false);
  };

  const handleCalendarSelect = async (calendarId: string) => {
    setSelectedCalendarId(calendarId);
    await setCalendarSyncSettings({ selectedCalendarId: calendarId });
  };

  const handleConnect = async (service: string) => {
    toast({
      title: t('toasts.comingSoon'),
      description: t('toasts.integrationComingSoon', { service }),
    });
  };

  // Removed loading state to prevent showing spinner while auth state loads

  const connectButtonStyles = "w-full h-12 justify-start gap-3 border border-border bg-background hover:bg-muted/50 text-foreground font-medium rounded-xl";

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      {/* Google Drive Cloud Sync Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background border border-border">
              <img src={logoGoogleDrive} alt="Google Drive" className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{t('sync.cloudSync')}</CardTitle>
              <CardDescription>{t('sync.cloudSyncDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAuthenticated && user ? (
            <>
              {/* Restoring data indicator */}
              {isRestoring && (
                <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{t('sync.restoringData')}</p>
                    <p className="text-xs text-muted-foreground">{t('sync.restoringDataDesc')}</p>
                  </div>
                </div>
              )}

              {/* User info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {user.imageUrl ? (
                  <img 
                    src={user.imageUrl} 
                    alt={user.name} 
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                    {user.name?.charAt(0) || user.email?.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>

              {/* Real-time sync status indicator */}
              {backgroundSyncActive && (
                <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                  syncStatus.status === 'offline' 
                    ? 'bg-orange-500/10 border-orange-500/20' 
                    : 'bg-emerald-500/10 border-emerald-500/20'
                }`}>
                  {syncStatus.status === 'offline' ? (
                    <>
                      <CloudOff className="h-4 w-4 text-orange-500" />
                      <span className="text-xs text-orange-600 dark:text-orange-400">
                        {t('sync.offlineMode')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t('sync.instantSyncActive')}
                      </span>
                      {syncStatus.status === 'syncing' && (
                        <Loader2 className="h-3 w-3 animate-spin text-emerald-500 ml-auto" />
                      )}
                      {syncStatus.status === 'synced' && (
                        <Check className="h-3 w-3 text-emerald-500 ml-auto" />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Cloud backup status */}
              {cloudBackupInfo && (
                <div className="p-3 bg-muted/30 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('sync.cloudBackup')}</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Check className="h-4 w-4" />
                      {cloudBackupInfo.exists ? t('sync.available') : t('sync.notAvailable')}
                    </span>
                  </div>
                  {cloudBackupInfo.lastModified && (
                    <p className="text-xs text-muted-foreground">
                      {t('sync.lastBackup')}: {cloudBackupInfo.lastModified.toLocaleString()}
                    </p>
                  )}
                  {cloudBackupInfo.size && (
                    <p className="text-xs text-muted-foreground">
                      {t('sync.backupSize')}: {(cloudBackupInfo.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
              )}

              {/* Sync controls */}
              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {t('sync.syncNow')}
                </Button>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-sync" className="flex-1">
                    <span className="font-medium">{t('sync.autoSync')}</span>
                    <p className="text-xs text-muted-foreground">{t('sync.autoSyncInfo')}</p>
                  </Label>
                  <Switch
                    id="auto-sync"
                    checked={autoSyncEnabled}
                    onCheckedChange={handleAutoSyncToggle}
                  />
                </div>
              </div>

              {lastSyncTime && (
                <p className="text-xs text-muted-foreground text-center">
                  {t('sync.lastSynced', { time: new Date(lastSyncTime).toLocaleString() })}
                </p>
              )}
            </>
          ) : (
            <Button 
              variant="outline" 
              className={connectButtonStyles}
              onClick={handleSignIn}
            >
              <img 
                src={logoGoogleDrive} 
                alt="Google" 
                className="h-5 w-5"
              />
              {t('sync.signInWithGoogle')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Google Calendar Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background border border-border">
              <img src={logoGoogleCalendar} alt="Google Calendar" className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{t('sync.googleCalendar')}</CardTitle>
              <CardDescription>{t('sync.bidirectionalSync')}</CardDescription>
            </div>
            {isAuthenticated && (
              <Switch
                checked={calendarSyncEnabled}
                onCheckedChange={handleCalendarSyncToggle}
                disabled={isCalendarSyncing}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isAuthenticated ? (
            <Button 
              variant="outline" 
              className={connectButtonStyles}
              onClick={handleSignIn}
            >
              <img 
                src={logoGoogleCalendar} 
                alt="Google Calendar" 
                className="h-5 w-5"
              />
              {t('sync.signInWithGoogle')}
            </Button>
          ) : calendarSyncEnabled ? (
            <div className="space-y-4">
              {/* Bidirectional sync status indicator */}
              {calendarBidirectionalEnabled && (
                <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                  calendarSyncStatus.status === 'syncing' 
                    ? 'bg-blue-500/10 border-blue-500/20' 
                    : calendarSyncStatus.status === 'synced'
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-muted/50 border-border'
                }`}>
                  <ArrowLeftRight className={`h-4 w-4 ${
                    calendarSyncStatus.status === 'syncing' 
                      ? 'text-blue-500 animate-pulse' 
                      : 'text-emerald-500'
                  }`} />
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      {calendarSyncStatus.status === 'syncing' 
                        ? t('sync.syncingCalendar')
                        : t('sync.bidirectionalActive')}
                    </span>
                    {calendarSyncStatus.imported !== undefined && calendarSyncStatus.exported !== undefined && (
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {calendarSyncStatus.imported} {t('sync.imported')}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Upload className="h-3 w-3" />
                          {calendarSyncStatus.exported} {t('sync.exported')}
                        </span>
                      </div>
                    )}
                  </div>
                  {calendarSyncStatus.status === 'syncing' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                  {calendarSyncStatus.status === 'synced' && (
                    <Check className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
              )}

              {/* Calendar selector */}
              <div className="space-y-2">
                <Label>{t('sync.selectCalendar')}</Label>
                <Select value={selectedCalendarId} onValueChange={handleCalendarSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('sync.selectCalendar')} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCalendars ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      calendars.map((cal) => (
                        <SelectItem key={cal.id} value={cal.id}>
                          <div className="flex items-center gap-2">
                            {cal.backgroundColor && (
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: cal.backgroundColor }}
                              />
                            )}
                            {cal.summary}
                            {cal.primary && <span className="text-xs text-muted-foreground">(Primary)</span>}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Sync now button */}
              <Button 
                className="w-full" 
                onClick={handleCalendarSyncNow}
                disabled={isCalendarSyncing}
              >
                {isCalendarSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {t('sync.syncCalendarNow')}
              </Button>

              {/* Sync info */}
              <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <span>{t('sync.importFromCalendar')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span>{t('sync.exportToCalendar')}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('sync.calendarSyncInfo')}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('sync.enableBidirectionalSync')}</p>
          )}
        </CardContent>
      </Card>

      {/* Integrations Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sync.integrations')}</CardTitle>
          <CardDescription>{t('sync.integrationsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* ClickUp */}
            <AccordionItem value="clickup" className="border-b">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <img src={logoClickUp} alt="ClickUp" className="w-8 h-8 rounded-lg" />
                  <span className="font-medium">ClickUp</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <Button 
                  variant="outline" 
                  className={connectButtonStyles}
                  onClick={() => handleConnect("ClickUp")}
                >
                  <img src={logoClickUp} alt="ClickUp" className="h-5 w-5 rounded" />
                  {t('sync.continueAccount', { service: 'ClickUp' })}
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* Notion */}
            <AccordionItem value="notion" className="border-b">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <img src={logoNotion} alt="Notion" className="w-8 h-8 rounded-lg" />
                  <span className="font-medium">Notion</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <Button 
                  variant="outline" 
                  className={connectButtonStyles}
                  onClick={() => handleConnect("Notion")}
                >
                  <img src={logoNotion} alt="Notion" className="h-5 w-5 rounded" />
                  {t('sync.continueAccount', { service: 'Notion' })}
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* HubSpot */}
            <AccordionItem value="hubspot" className="border-b-0">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <img src={logoHubSpot} alt="HubSpot" className="w-8 h-8 rounded-lg" />
                  <span className="font-medium">HubSpot</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <Button 
                  variant="outline" 
                  className={connectButtonStyles}
                  onClick={() => handleConnect("HubSpot")}
                >
                  <img src={logoHubSpot} alt="HubSpot" className="h-5 w-5 rounded" />
                  {t('sync.continueAccount', { service: 'HubSpot' })}
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Task Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sync.importTasks')}</CardTitle>
          <CardDescription>{t('sync.importTasksDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* TickTick */}
            <AccordionItem value="ticktick" className="border-b">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <img src={logoTickTick} alt="TickTick" className="w-8 h-8 rounded-lg" />
                  <span className="font-medium">TickTick</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <Button 
                  variant="outline" 
                  className={connectButtonStyles}
                  onClick={() => handleConnect("TickTick")}
                >
                  <img src={logoTickTick} alt="TickTick" className="h-5 w-5 rounded" />
                  {t('sync.importFrom', { service: 'TickTick' })}
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* Todoist */}
            <AccordionItem value="todoist" className="border-b">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <img src={logoTodoist} alt="Todoist" className="w-8 h-8 rounded-lg" />
                  <span className="font-medium">Todoist</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <Button 
                  variant="outline" 
                  className={connectButtonStyles}
                  onClick={() => handleConnect("Todoist")}
                >
                  <img src={logoTodoist} alt="Todoist" className="h-5 w-5 rounded" />
                  {t('sync.importFrom', { service: 'Todoist' })}
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* Evernote */}
            <AccordionItem value="evernote" className="border-b-0">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <img src={logoEvernote} alt="Evernote" className="w-8 h-8 rounded-lg" />
                  <span className="font-medium">Evernote</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <Button 
                  variant="outline" 
                  className={connectButtonStyles}
                  onClick={() => handleConnect("Evernote")}
                >
                  <img src={logoEvernote} alt="Evernote" className="h-5 w-5 rounded" />
                  {t('sync.importFrom', { service: 'Evernote' })}
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncSettings;

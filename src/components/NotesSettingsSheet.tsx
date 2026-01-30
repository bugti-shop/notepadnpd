import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronRight, ChevronLeft, Type, Wand2, FileText } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
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

// Types for settings
export interface FontSettings {
  fontFamily: string;
  fontSize: string;
  fontColor: string;
}

export interface NotesSettings {
  normalText: FontSettings;
  headings: FontSettings;
  startNotesIn: 'title' | 'body';
  smartDetection: {
    urls: boolean;
    phoneNumbers: boolean;
    emailAddresses: boolean;
  };
}

const DEFAULT_NOTES_SETTINGS: NotesSettings = {
  normalText: {
    fontFamily: 'System Default',
    fontSize: '16',
    fontColor: '#000000',
  },
  headings: {
    fontFamily: 'System Default',
    fontSize: '24',
    fontColor: '#000000',
  },
  startNotesIn: 'title',
  smartDetection: {
    urls: true,
    phoneNumbers: true,
    emailAddresses: true,
  },
};

const FONT_FAMILIES = [
  'System Default',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Courier New',
  'Trebuchet MS',
  'Palatino',
  'Garamond',
];

const FONT_SIZES = ['12', '14', '16', '18', '20', '22', '24', '28', '32', '36', '40', '48'];

const FONT_COLORS = [
  { label: 'Default', value: '#000000' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink', value: '#ec4899' },
];

type SubPage = 'main' | 'defaultFont' | 'advancedEditing' | 'startNotesIn';

interface NotesSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotesSettingsSheet = ({ isOpen, onClose }: NotesSettingsSheetProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotesSettings>(DEFAULT_NOTES_SETTINGS);
  const [currentPage, setCurrentPage] = useState<SubPage>('main');
  const [isLoading, setIsLoading] = useState(true);

  useHardwareBackButton({
    onBack: () => {
      if (currentPage !== 'main') {
        setCurrentPage('main');
      } else {
        onClose();
      }
    },
    enabled: isOpen,
    priority: 'sheet',
  });

  // Load settings
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Reset to main page when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage('main');
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const saved = await getSetting<NotesSettings | null>('notesEditorSettings', null);
      if (saved) {
        setSettings({ ...DEFAULT_NOTES_SETTINGS, ...saved });
      }
    } catch (error) {
      console.error('Error loading notes settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotesSettings) => {
    setSettings(newSettings);
    await setSetting('notesEditorSettings', newSettings);
  };

  const updateNormalText = async (key: keyof FontSettings, value: string) => {
    const newSettings = {
      ...settings,
      normalText: { ...settings.normalText, [key]: value },
    };
    await saveSettings(newSettings);
  };

  const updateHeadings = async (key: keyof FontSettings, value: string) => {
    const newSettings = {
      ...settings,
      headings: { ...settings.headings, [key]: value },
    };
    await saveSettings(newSettings);
  };

  const updateSmartDetection = async (key: keyof NotesSettings['smartDetection'], value: boolean) => {
    const newSettings = {
      ...settings,
      smartDetection: { ...settings.smartDetection, [key]: value },
    };
    await saveSettings(newSettings);
    toast.success(t('settings.settingsSaved', 'Settings saved'));
  };

  const updateStartNotesIn = async (value: 'title' | 'body') => {
    const newSettings = { ...settings, startNotesIn: value };
    await saveSettings(newSettings);
    toast.success(t('settings.settingsSaved', 'Settings saved'));
  };

  const SettingsRow = ({ 
    label, 
    subtitle,
    onClick, 
    rightElement 
  }: { 
    label: string; 
    subtitle?: string;
    onClick?: () => void; 
    rightElement?: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 border-b border-border/50",
        onClick && "hover:bg-muted/50 transition-colors"
      )}
    >
      <div className="flex flex-col items-start">
        <span className="text-foreground text-sm">{label}</span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {rightElement || (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
    </button>
  );

  const SectionHeading = ({ title }: { title: string }) => (
    <div className="px-4 py-2 bg-muted/50">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
    </div>
  );

  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors">
      <ChevronLeft className="h-5 w-5" />
    </button>
  );

  // Main page
  const renderMainPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <SheetTitle className="text-lg">{t('settings.notesSettings', 'Notes Settings')}</SheetTitle>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <SettingsRow 
            label={t('settings.defaultFontSettings', 'Default Font Settings')}
            subtitle={t('settings.defaultFontSettingsDesc', 'Customize fonts for text and headings')}
            onClick={() => setCurrentPage('defaultFont')}
          />
          <SettingsRow 
            label={t('settings.advancedEditing', 'Advanced Editing')}
            subtitle={t('settings.advancedEditingDesc', 'Smart detection for URLs, phone, email')}
            onClick={() => setCurrentPage('advancedEditing')}
          />
          <SettingsRow 
            label={t('settings.startNotesIn', 'Start Notes In')}
            subtitle={settings.startNotesIn === 'title' ? t('settings.title', 'Title') : t('settings.body', 'Body')}
            onClick={() => setCurrentPage('startNotesIn')}
          />
        </div>
      </ScrollArea>
    </>
  );

  // Default Font Settings page
  const renderDefaultFontPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.defaultFontSettings', 'Default Font Settings')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Normal Text Section */}
          <SectionHeading title={t('settings.normalText', 'Normal Text')} />
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontFamily', 'Font Style')}</label>
            <Select value={settings.normalText.fontFamily} onValueChange={(v) => updateNormalText('fontFamily', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font} value={font} style={{ fontFamily: font === 'System Default' ? 'inherit' : font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontSize', 'Font Size')}</label>
            <Select value={settings.normalText.fontSize} onValueChange={(v) => updateNormalText('fontSize', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>{size}px</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontColor', 'Font Color')}</label>
            <div className="flex flex-wrap gap-2">
              {FONT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateNormalText('fontColor', color.value)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    settings.normalText.fontColor === color.value 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-border"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Headings Section */}
          <SectionHeading title={t('settings.headings', 'Headings')} />
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontFamily', 'Font Style')}</label>
            <Select value={settings.headings.fontFamily} onValueChange={(v) => updateHeadings('fontFamily', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font} value={font} style={{ fontFamily: font === 'System Default' ? 'inherit' : font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontSize', 'Font Size')}</label>
            <Select value={settings.headings.fontSize} onValueChange={(v) => updateHeadings('fontSize', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>{size}px</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontColor', 'Font Color')}</label>
            <div className="flex flex-wrap gap-2">
              {FONT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateHeadings('fontColor', color.value)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    settings.headings.fontColor === color.value 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-border"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  );

  // Advanced Editing page
  const renderAdvancedEditingPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.advancedEditing', 'Advanced Editing')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <SectionHeading title={t('settings.smartDetection', 'Smart Detection')} />
          
          {/* URLs */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">{t('settings.urls', 'URLs')}</span>
              <span className="text-xs text-muted-foreground">
                {t('settings.urlsDesc', 'Auto-detect URLs and make them clickable (opens in browser)')}
              </span>
            </div>
            <Switch
              checked={settings.smartDetection.urls}
              onCheckedChange={(checked) => updateSmartDetection('urls', checked)}
            />
          </div>

          {/* Phone Numbers */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">{t('settings.phoneNumbers', 'Phone Numbers')}</span>
              <span className="text-xs text-muted-foreground">
                {t('settings.phoneNumbersDesc', 'Auto-detect phone numbers with country codes (+1, +9, etc.) and make them callable')}
              </span>
            </div>
            <Switch
              checked={settings.smartDetection.phoneNumbers}
              onCheckedChange={(checked) => updateSmartDetection('phoneNumbers', checked)}
            />
          </div>

          {/* Email Addresses */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">{t('settings.emailAddresses', 'Email Addresses')}</span>
              <span className="text-xs text-muted-foreground">
                {t('settings.emailAddressesDesc', 'Auto-detect email addresses and make them clickable (opens email app)')}
              </span>
            </div>
            <Switch
              checked={settings.smartDetection.emailAddresses}
              onCheckedChange={(checked) => updateSmartDetection('emailAddresses', checked)}
            />
          </div>
        </div>
      </ScrollArea>
    </>
  );

  // Start Notes In page
  const renderStartNotesInPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.startNotesIn', 'Start Notes In')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <p className="px-4 py-2 text-sm text-muted-foreground">
            {t('settings.startNotesInDesc', 'Choose where the cursor should be placed when creating a new note')}
          </p>
          
          <button
            onClick={() => updateStartNotesIn('title')}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 border-b border-border/50 transition-colors",
              settings.startNotesIn === 'title' ? "bg-primary/10" : "hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-3">
              <Type className="h-5 w-5 text-muted-foreground" />
              <div className="flex flex-col items-start">
                <span className="text-foreground text-sm">{t('settings.title', 'Title')}</span>
                <span className="text-xs text-muted-foreground">{t('settings.titleDesc', 'Start typing in the title field')}</span>
              </div>
            </div>
            {settings.startNotesIn === 'title' && (
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          <button
            onClick={() => updateStartNotesIn('body')}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 transition-colors",
              settings.startNotesIn === 'body' ? "bg-primary/10" : "hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex flex-col items-start">
                <span className="text-foreground text-sm">{t('settings.body', 'Body')}</span>
                <span className="text-xs text-muted-foreground">{t('settings.bodyDesc', 'Start typing in the note body')}</span>
              </div>
            </div>
            {settings.startNotesIn === 'body' && (
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </ScrollArea>
    </>
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        {currentPage === 'main' && renderMainPage()}
        {currentPage === 'defaultFont' && renderDefaultFontPage()}
        {currentPage === 'advancedEditing' && renderAdvancedEditingPage()}
        {currentPage === 'startNotesIn' && renderStartNotesInPage()}
      </SheetContent>
    </Sheet>
  );
};

// Hook to access notes settings
export const useNotesSettings = () => {
  const [settings, setSettings] = useState<NotesSettings>(DEFAULT_NOTES_SETTINGS);

  useEffect(() => {
    getSetting<NotesSettings | null>('notesEditorSettings', null).then((saved) => {
      if (saved) {
        setSettings({ ...DEFAULT_NOTES_SETTINGS, ...saved });
      }
    });
  }, []);

  return settings;
};

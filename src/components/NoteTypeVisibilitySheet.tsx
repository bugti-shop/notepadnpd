import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { FileText, PenLine, StickyNote, Code, Brush, AlertCircle, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NoteType } from '@/types/note';
import { 
  ALL_NOTE_TYPES, 
  getVisibleNoteTypes, 
  toggleNoteTypeVisibility,
  getNoteTypeDisplayName 
} from '@/utils/noteTypeVisibility';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface NoteTypeVisibilitySheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const noteTypeIcons: Record<NoteType, React.ReactNode> = {
  regular: <FileText className="h-5 w-5" />,
  lined: <PenLine className="h-5 w-5" />,
  sticky: <StickyNote className="h-5 w-5" />,
  code: <Code className="h-5 w-5" />,
  sketch: <Brush className="h-5 w-5" />,
  voice: <Mic className="h-5 w-5" />,
};

const noteTypeColors: Record<NoteType, string> = {
  regular: 'text-blue-500',
  lined: 'text-purple-500',
  sticky: 'text-yellow-500',
  code: 'text-green-500',
  sketch: 'text-pink-500',
  voice: 'text-red-500',
};

export const NoteTypeVisibilitySheet = ({ isOpen, onClose }: NoteTypeVisibilitySheetProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [visibleTypes, setVisibleTypes] = useState<NoteType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadVisibleTypes();
    }
  }, [isOpen]);

  const loadVisibleTypes = async () => {
    setIsLoading(true);
    const types = await getVisibleNoteTypes();
    setVisibleTypes(types);
    setIsLoading(false);
  };

  const handleToggle = async (type: NoteType) => {
    const result = await toggleNoteTypeVisibility(type);
    
    if (!result.success) {
      toast({
        title: t('settings.cannotHideLastType', 'Cannot hide last note type'),
        description: t('settings.atLeastOneRequired', 'At least one note type must remain visible'),
        variant: 'destructive',
      });
      return;
    }
    
    setVisibleTypes(result.visible);
    
    const isNowVisible = result.visible.includes(type);
    toast({
      title: isNowVisible 
        ? t('settings.noteTypeShown', '{{type}} is now visible', { type: getNoteTypeDisplayName(type) })
        : t('settings.noteTypeHidden', '{{type}} is now hidden', { type: getNoteTypeDisplayName(type) }),
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
        <SheetHeader className="pb-4">
          <SheetTitle>{t('settings.noteTypeVisibility', 'Note Type Visibility')}</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-2 py-2 bg-muted/50 rounded-lg mb-4">
            <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              {t('settings.noteTypeVisibilityHint', 'At least one note type must remain visible')}
            </span>
          </div>
          
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              {t('common.loading', 'Loading...')}
            </div>
          ) : (
            ALL_NOTE_TYPES.map((type) => {
              const isVisible = visibleTypes.includes(type);
              const isLastVisible = visibleTypes.length === 1 && isVisible;
              
              return (
                <div 
                  key={type}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                    isVisible ? "bg-card" : "bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={noteTypeColors[type]}>
                      {noteTypeIcons[type]}
                    </div>
                    <span className={cn(
                      "font-medium",
                      !isVisible && "text-muted-foreground"
                    )}>
                      {getNoteTypeDisplayName(type)}
                    </span>
                  </div>
                  <Switch
                    checked={isVisible}
                    onCheckedChange={() => handleToggle(type)}
                    disabled={isLastVisible}
                  />
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

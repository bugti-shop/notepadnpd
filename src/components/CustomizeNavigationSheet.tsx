import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, RotateCcw, Home, FileText, Calendar, Settings, CheckSquare, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  visible: boolean;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'Home', visible: true },
  { id: 'notes', label: 'Notes', icon: 'FileText', visible: true },
  { id: 'calendar', label: 'Calendar', icon: 'Calendar', visible: true },
  { id: 'settings', label: 'Settings', icon: 'Settings', visible: true },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  Home: <Home className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  CheckSquare: <CheckSquare className="h-5 w-5" />,
  Clock: <Clock className="h-5 w-5" />,
};

interface CustomizeNavigationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomizeNavigationSheet = ({ isOpen, onClose }: CustomizeNavigationSheetProps) => {
  const { t } = useTranslation();
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV_ITEMS);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      loadNavItems();
    }
  }, [isOpen]);

  const loadNavItems = async () => {
    try {
      const saved = await getSetting<NavItem[] | null>('customNavItems', null);
      if (saved && saved.length > 0) {
        // Merge with defaults to include any new items
        const savedIds = new Set(saved.map(item => item.id));
        const merged = [...saved];
        DEFAULT_NAV_ITEMS.forEach(item => {
          if (!savedIds.has(item.id)) {
            merged.push(item);
          }
        });
        setNavItems(merged);
      }
    } catch (error) {
      console.error('Error loading nav items:', error);
    }
  };

  const saveNavItems = async (items: NavItem[]) => {
    setNavItems(items);
    await setSetting('customNavItems', items);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}

    const newItems = [...navItems];
    const [removed] = newItems.splice(sourceIndex, 1);
    newItems.splice(destIndex, 0, removed);

    await saveNavItems(newItems);
    toast.success(t('settings.navigationOrderUpdated', 'Navigation order updated'));
  };

  const toggleVisibility = async (id: string) => {
    // Ensure at least 2 items remain visible
    const visibleCount = navItems.filter(item => item.visible).length;
    const item = navItems.find(i => i.id === id);
    
    if (item?.visible && visibleCount <= 2) {
      toast.error(t('settings.minNavItems', 'At least 2 navigation items must be visible'));
      return;
    }

    const newItems = navItems.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    await saveNavItems(newItems);
  };

  const handleReset = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    await saveNavItems([...DEFAULT_NAV_ITEMS]);
    toast.success(t('settings.navigationReset', 'Navigation reset to default'));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">{t('settings.customizeNavigation', 'Customize Navigation')}</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {t('common.reset', 'Reset')}
            </Button>
          </div>
        </SheetHeader>

        <p className="px-4 py-2 text-sm text-muted-foreground">
          {t('settings.customizeNavigationDesc', 'Drag to reorder and toggle visibility of navigation items')}
        </p>

        <ScrollArea className="flex-1 px-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="nav-items">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-1 pb-4"
                >
                  {navItems.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50",
                            "transition-all duration-200",
                            snapshot.isDragging && "bg-primary/10 border-primary shadow-lg scale-[1.02]",
                            !item.visible && "opacity-50"
                          )}
                        >
                          <div {...provided.dragHandleProps}>
                            <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </div>
                          <div className="text-muted-foreground">
                            {ICON_MAP[item.icon]}
                          </div>
                          <span className="text-sm font-medium flex-1">
                            {t(`nav.${item.id}`, item.label)}
                          </span>
                          <Switch
                            checked={item.visible}
                            onCheckedChange={() => toggleVisibility(item.id)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

// Hook to access nav items
export const useCustomNavigation = () => {
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV_ITEMS);

  useEffect(() => {
    getSetting<NavItem[] | null>('customNavItems', null).then((saved) => {
      if (saved && saved.length > 0) {
        setNavItems(saved);
      }
    });
  }, []);

  return navItems.filter(item => item.visible);
};

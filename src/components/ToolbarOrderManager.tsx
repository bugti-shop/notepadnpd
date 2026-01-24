import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, RotateCcw, Settings2 } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { getSetting, setSetting } from '@/utils/settingsStorage';

export type ToolbarItemId = 
  | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'subscript' | 'superscript' 
  | 'clearFormatting' | 'codeBlock' | 'horizontalRule' | 'blockquote' | 'emoji'
  | 'bulletList' | 'numberedList' | 'image' | 'table' | 'highlight' | 'textColor'
  | 'undo' | 'redo' | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'fontFamily' | 'fontSize' | 'headings' | 'textCase' | 'textDirection'
  | 'comment' | 'link' | 'noteLink' | 'attachment' | 'zoom';

const TOOLBAR_ORDER_KEY = 'wordToolbarOrder';

export const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  'bold', 'italic', 'underline', 'fontFamily', 'fontSize', 'strikethrough', 'subscript', 'superscript',
  'clearFormatting', 'codeBlock', 'horizontalRule', 'blockquote', 'emoji',
  'bulletList', 'numberedList', 'image', 'table', 'highlight', 'textColor',
  'undo', 'redo', 'alignLeft', 'alignCenter', 'alignRight', 'alignJustify',
  'headings', 'textCase', 'textDirection',
  'comment', 'link', 'noteLink', 'attachment', 'zoom'
];

const TOOLBAR_ITEM_LABELS: Record<ToolbarItemId, string> = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  subscript: 'Subscript',
  superscript: 'Superscript',
  clearFormatting: 'Clear Formatting',
  codeBlock: 'Code Block',
  horizontalRule: 'Horizontal Rule',
  blockquote: 'Blockquote',
  emoji: 'Emoji Picker',
  bulletList: 'Bullet List',
  numberedList: 'Numbered List',
  image: 'Insert Image',
  table: 'Insert Table',
  highlight: 'Highlight',
  textColor: 'Text Color',
  undo: 'Undo',
  redo: 'Redo',
  alignLeft: 'Align Left',
  alignCenter: 'Align Center',
  alignRight: 'Align Right',
  alignJustify: 'Justify',
  fontFamily: 'Font Family',
  fontSize: 'Font Size',
  headings: 'Headings',
  textCase: 'Text Case',
  textDirection: 'Text Direction',
  comment: 'Comment',
  link: 'Insert Link',
  noteLink: 'Link to Note',
  attachment: 'Attachment',
  zoom: 'Zoom Controls',
};

export const getToolbarOrder = async (): Promise<ToolbarItemId[]> => {
  try {
    const saved = await getSetting<ToolbarItemId[] | null>(TOOLBAR_ORDER_KEY, null);
    if (saved) {
      // Merge with defaults to include any new items
      const existing = new Set(saved);
      const merged = [...saved];
      DEFAULT_TOOLBAR_ORDER.forEach(item => {
        if (!existing.has(item)) merged.push(item);
      });
      return merged;
    }
  } catch {}
  return [...DEFAULT_TOOLBAR_ORDER];
};

export const saveToolbarOrder = async (order: ToolbarItemId[]) => {
  await setSetting(TOOLBAR_ORDER_KEY, order);
};

interface ToolbarOrderManagerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderChange: (order: ToolbarItemId[]) => void;
  currentOrder: ToolbarItemId[];
}

export const ToolbarOrderManager = ({
  isOpen,
  onOpenChange,
  onOrderChange,
  currentOrder,
}: ToolbarOrderManagerProps) => {
  const [localOrder, setLocalOrder] = useState<ToolbarItemId[]>(currentOrder);

  useHardwareBackButton({
    onBack: () => {
      onOpenChange(false);
    },
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    setLocalOrder(currentOrder);
  }, [currentOrder]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}

    const newOrder = [...localOrder];
    const [removed] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(destIndex, 0, removed);

    setLocalOrder(newOrder);
    saveToolbarOrder(newOrder);
    onOrderChange(newOrder);
    toast.success('Toolbar order updated');
  };

  const handleReset = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    setLocalOrder([...DEFAULT_TOOLBAR_ORDER]);
    saveToolbarOrder(DEFAULT_TOOLBAR_ORDER);
    onOrderChange([...DEFAULT_TOOLBAR_ORDER]);
    toast.success('Toolbar reset to default order');
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Customize Toolbar Order
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </SheetTitle>
        </SheetHeader>

        <p className="text-sm text-muted-foreground mb-4">
          Drag and drop to reorder toolbar items. Changes are saved automatically.
        </p>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="toolbar-items">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-1 max-h-[calc(70vh-140px)] overflow-y-auto pr-2"
              >
                {localOrder.map((itemId, index) => (
                  <Draggable key={itemId} draggableId={itemId} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50",
                          "transition-all duration-200",
                          snapshot.isDragging && "bg-primary/10 border-primary shadow-lg scale-[1.02]"
                        )}
                      >
                        <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium flex-1">
                          {TOOLBAR_ITEM_LABELS[itemId]}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {index + 1}
                        </span>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </SheetContent>
    </Sheet>
  );
};

// Custom hook for managing toolbar order
export const useToolbarOrder = () => {
  const [order, setOrder] = useState<ToolbarItemId[]>(DEFAULT_TOOLBAR_ORDER);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    getToolbarOrder().then(setOrder);
  }, []);

  const updateOrder = (newOrder: ToolbarItemId[]) => {
    setOrder(newOrder);
  };

  return {
    order,
    updateOrder,
    isManagerOpen,
    setIsManagerOpen,
    openManager: () => setIsManagerOpen(true),
  };
};

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Priority } from '@/types/note';
import { Flag, Circle } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface PrioritySelectSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (priority: Priority) => void;
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'high', label: 'High Priority', color: 'text-red-500' },
  { value: 'medium', label: 'Medium Priority', color: 'text-orange-500' },
  { value: 'low', label: 'Low Priority', color: 'text-blue-500' },
  { value: 'none', label: 'No Priority', color: 'text-muted-foreground' },
];

export const PrioritySelectSheet = ({ isOpen, onClose, onSelect }: PrioritySelectSheetProps) => {
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleSelect = (priority: Priority) => {
    onSelect(priority);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Set Priority
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-2">
          {PRIORITIES.map(({ value, label, color }) => (
            <Button
              key={value}
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => handleSelect(value)}
            >
              <Circle className={`h-4 w-4 mr-3 fill-current ${color}`} />
              {label}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGoogleAuth } from "@/contexts/GoogleAuthContext";
import { GoogleCalendarSyncManager, getCalendarSyncSettings } from "@/utils/googleCalendarSync";
import { useToast } from "@/hooks/use-toast";
import { TodoItem } from "@/types/note";
import { getSetting, setSetting } from "@/utils/settingsStorage";

interface AddToCalendarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  task: TodoItem;
  onEventCreated?: (googleEventId: string) => void;
}

export const AddToCalendarDialog = ({
  isOpen,
  onClose,
  task,
  onEventCreated,
}: AddToCalendarDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { tokens, isAuthenticated } = useGoogleAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleAddToCalendar = async () => {
    if (!tokens?.accessToken || !task.dueDate) {
      onClose();
      return;
    }

    // Save preference if "Don't ask again" is checked
    if (dontAskAgain) {
      await setSetting('calendar_prompt_disabled', true);
    }

    setIsCreating(true);
    try {
      const calSettings = await getCalendarSyncSettings();
      const calManager = new GoogleCalendarSyncManager(tokens.accessToken);
      
      const eventId = await calManager.syncTaskToCalendar(task, calSettings.selectedCalendarId);
      
      if (eventId) {
        toast({
          title: t('sync.eventCreated'),
        });
        onEventCreated?.(eventId);
      } else {
        toast({
          title: t('sync.eventCreateFailed'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating calendar event:', error);
      toast({
        title: t('sync.eventCreateFailed'),
        variant: "destructive",
      });
    }
    setIsCreating(false);
    onClose();
  };

  const handleClose = async () => {
    // Save preference if "Don't ask again" is checked even when cancelling
    if (dontAskAgain) {
      await setSetting('calendar_prompt_disabled', true);
    }
    onClose();
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('sync.addToCalendar')}
          </DialogTitle>
          <DialogDescription>
            {t('sync.addToCalendarQuestion')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="font-medium">{task.text}</p>
          {task.dueDate && (
            <p className="text-sm text-muted-foreground mt-1">
              {task.dueDate.toLocaleDateString()} {task.reminderTime && task.reminderTime.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox 
            id="dont-ask-again" 
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked === true)}
          />
          <label 
            htmlFor="dont-ask-again" 
            className="text-sm text-muted-foreground cursor-pointer"
          >
            {t('sync.dontAskAgain', "Don't ask me again")}
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAddToCalendar} disabled={isCreating}>
            {isCreating ? t('common.loading') : t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Hook to check if calendar event prompt should be shown
export const useCalendarEventPrompt = () => {
  const { isAuthenticated, tokens } = useGoogleAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingTask, setPendingTask] = useState<TodoItem | null>(null);

  const promptAddToCalendar = async (task: TodoItem) => {
    if (!isAuthenticated || !tokens?.accessToken || !task.dueDate) {
      return false;
    }

    // Check if user disabled the prompt
    const promptDisabled = await getSetting<boolean>('calendar_prompt_disabled', false);
    if (promptDisabled) {
      return false;
    }

    // Check if calendar sync is enabled
    const settings = await getCalendarSyncSettings();
    if (!settings.enabled) {
      return false;
    }

    // Check if task already has a calendar event
    if (task.googleCalendarEventId) {
      return false;
    }

    setPendingTask(task);
    setShowPrompt(true);
    return true;
  };

  const closePrompt = () => {
    setShowPrompt(false);
    setPendingTask(null);
  };

  return {
    showPrompt,
    pendingTask,
    promptAddToCalendar,
    closePrompt,
  };
};

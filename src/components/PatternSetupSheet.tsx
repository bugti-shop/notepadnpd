import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lock, Check, ChevronLeft, ShieldQuestion, Trash2 } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import { PatternLockInput } from './PatternLockInput';
import {
  setPatternLock,
  getPatternLockState,
  removePatternLock,
  PATTERN_SECURITY_QUESTIONS,
} from '@/utils/patternLock';
import { cn } from '@/lib/utils';

type SetupStep = 'draw' | 'confirm' | 'security';

interface PatternSetupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  onPatternSet?: () => void;
}

export const PatternSetupSheet = ({
  isOpen,
  onClose,
  noteId,
  onPatternSet,
}: PatternSetupSheetProps) => {
  const [step, setStep] = useState<SetupStep>('draw');
  const [pattern, setPattern] = useState<number[]>([]);
  const [confirmPattern, setConfirmPattern] = useState<number[]>([]);
  const [patternError, setPatternError] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [hasExistingPattern, setHasExistingPattern] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useHardwareBackButton({
    onBack: () => {
      if (step === 'confirm') {
        setStep('draw');
        setPattern([]);
        setConfirmPattern([]);
      } else if (step === 'security') {
        setStep('confirm');
      } else {
        onClose();
      }
    },
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      // Check for existing pattern
      getPatternLockState(noteId).then((state) => {
        setHasExistingPattern(state.hasPattern);
      });
      // Reset state
      setStep('draw');
      setPattern([]);
      setConfirmPattern([]);
      setPatternError(false);
      setSecurityQuestion('');
      setSecurityAnswer('');
      setIsLoading(false);
    }
  }, [isOpen, noteId]);

  const handlePatternDrawn = async (drawnPattern: number[]) => {
    await triggerHaptic('medium');
    setPattern(drawnPattern);
    setStep('confirm');
  };

  const handlePatternConfirm = async (confirmedPattern: number[]) => {
    // Check if patterns match
    const match = 
      pattern.length === confirmedPattern.length &&
      pattern.every((dot, i) => dot === confirmedPattern[i]);

    if (match) {
      await triggerHaptic('heavy');
      setConfirmPattern(confirmedPattern);
      setStep('security');
    } else {
      await triggerHaptic('heavy');
      setPatternError(true);
      toast.error('Patterns do not match. Try again.');
      setTimeout(() => {
        setPatternError(false);
        setConfirmPattern([]);
      }, 500);
    }
  };

  const handleSave = async () => {
    await triggerHaptic('heavy');

    if (!securityQuestion) {
      toast.error('Please select a security question');
      return;
    }
    if (!securityAnswer.trim()) {
      toast.error('Please enter an answer');
      return;
    }
    if (securityAnswer.trim().length < 2) {
      toast.error('Answer must be at least 2 characters');
      return;
    }

    setIsLoading(true);
    try {
      await setPatternLock(noteId, pattern, securityQuestion, securityAnswer.trim());
      toast.success('Pattern lock enabled!');
      onPatternSet?.();
      onClose();
    } catch (error) {
      console.error('Error setting pattern lock:', error);
      toast.error('Failed to set pattern lock');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePattern = async () => {
    await triggerHaptic('heavy');
    setIsLoading(true);
    try {
      await removePatternLock(noteId);
      toast.success('Pattern lock removed');
      onPatternSet?.();
      onClose();
    } catch (error) {
      console.error('Error removing pattern lock:', error);
      toast.error('Failed to remove pattern lock');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('draw');
      setPattern([]);
      setConfirmPattern([]);
    } else if (step === 'security') {
      setStep('confirm');
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'draw':
        return hasExistingPattern ? 'Change Pattern' : 'Draw Pattern';
      case 'confirm':
        return 'Confirm Pattern';
      case 'security':
        return 'Security Question';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'draw':
        return 'Draw a pattern connecting at least 4 dots';
      case 'confirm':
        return 'Draw the same pattern again to confirm';
      case 'security':
        return 'Set up a security question for pattern recovery';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            {step !== 'draw' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <SheetTitle className="flex items-center gap-2">
              {step === 'security' ? (
                <ShieldQuestion className="h-5 w-5 text-primary" />
              ) : (
                <Lock className="h-5 w-5 text-primary" />
              )}
              {getStepTitle()}
            </SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-2 pl-10">
            {getStepDescription()}
          </p>
        </SheetHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(['draw', 'confirm', 'security'] as SetupStep[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                step === s ? "w-8 bg-primary" : "w-2 bg-muted"
              )}
            />
          ))}
        </div>

        <div className="space-y-6">
          {/* Draw Pattern Step */}
          {step === 'draw' && (
            <div className="flex flex-col items-center py-4">
              <PatternLockInput
                onPatternComplete={handlePatternDrawn}
                size="large"
              />
            </div>
          )}

          {/* Confirm Pattern Step */}
          {step === 'confirm' && (
            <div className="flex flex-col items-center py-4">
              <PatternLockInput
                onPatternComplete={handlePatternConfirm}
                error={patternError}
                size="large"
              />
              {patternError && (
                <p className="text-destructive text-sm mt-4 animate-fade-in">
                  Patterns don't match. Try again.
                </p>
              )}
            </div>
          )}

          {/* Security Question Step */}
          {step === 'security' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-8 w-8 text-primary" />
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground mb-6">
                Pattern set! Now set up a security question for recovery.
              </p>

              <div className="space-y-2">
                <Label>Security Question</Label>
                <Select value={securityQuestion} onValueChange={setSecurityQuestion}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select a question" />
                  </SelectTrigger>
                  <SelectContent>
                    {PATTERN_SECURITY_QUESTIONS.map((q) => (
                      <SelectItem key={q} value={q}>
                        {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="answer">Your Answer</Label>
                <Input
                  id="answer"
                  type="text"
                  placeholder="Enter your answer"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">
                  This will be used to recover your pattern if you forget it.
                </p>
              </div>

              <Button
                onClick={handleSave}
                className="w-full"
                disabled={isLoading}
              >
                <Lock className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving...' : 'Enable Pattern Lock'}
              </Button>
            </div>
          )}

          {/* Remove pattern option */}
          {step === 'draw' && hasExistingPattern && (
            <Button
              variant="outline"
              onClick={handleRemovePattern}
              className="w-full text-destructive"
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Pattern Lock
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

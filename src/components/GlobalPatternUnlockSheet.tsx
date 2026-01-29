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
import { Lock, HelpCircle, ChevronLeft, ShieldQuestion, Check } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import { PatternLockInput } from './PatternLockInput';
import {
  verifyGlobalPatternLock,
  getGlobalPatternSecurityQuestion,
  verifyGlobalPatternSecurityAnswer,
  resetGlobalPatternLock,
  PATTERN_SECURITY_QUESTIONS,
} from '@/utils/patternLock';
import { cn } from '@/lib/utils';

type UnlockStep = 'pattern' | 'forgot' | 'reset';

interface GlobalPatternUnlockSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export const GlobalPatternUnlockSheet = ({
  isOpen,
  onClose,
  onUnlocked,
}: GlobalPatternUnlockSheetProps) => {
  const [step, setStep] = useState<UnlockStep>('pattern');
  const [patternError, setPatternError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [securityQuestion, setSecurityQuestion] = useState<string | null>(null);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Reset pattern state
  const [newPattern, setNewPattern] = useState<number[]>([]);
  const [confirmPattern, setConfirmPattern] = useState<number[]>([]);
  const [resetStep, setResetStep] = useState<'draw' | 'confirm' | 'security'>('draw');
  const [newSecurityQuestion, setNewSecurityQuestion] = useState('');
  const [newSecurityAnswer, setNewSecurityAnswer] = useState('');

  useHardwareBackButton({
    onBack: () => {
      if (step === 'forgot') {
        setStep('pattern');
        setSecurityAnswer('');
      } else if (step === 'reset') {
        if (resetStep === 'confirm') {
          setResetStep('draw');
          setNewPattern([]);
        } else if (resetStep === 'security') {
          setResetStep('confirm');
        } else {
          setStep('forgot');
        }
      } else {
        onClose();
      }
    },
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      setStep('pattern');
      setPatternError(false);
      setAttempts(0);
      setSecurityAnswer('');
      setNewPattern([]);
      setConfirmPattern([]);
      setResetStep('draw');
      setNewSecurityQuestion('');
      setNewSecurityAnswer('');
      
      // Load security question
      getGlobalPatternSecurityQuestion().then(setSecurityQuestion);
    }
  }, [isOpen]);

  const handlePatternAttempt = async (pattern: number[]) => {
    setIsVerifying(true);
    
    try {
      const isValid = await verifyGlobalPatternLock(pattern);
      
      if (isValid) {
        await triggerHaptic('heavy');
        toast.success('Unlocked!');
        onUnlocked();
        onClose();
      } else {
        await triggerHaptic('heavy');
        setPatternError(true);
        setAttempts(prev => prev + 1);
        
        if (attempts >= 4) {
          toast.error('Too many attempts. Use "Forgot Pattern" to reset.');
        } else {
          toast.error(`Incorrect pattern. ${5 - attempts - 1} attempts remaining.`);
        }
        
        setTimeout(() => setPatternError(false), 500);
      }
    } catch (error) {
      console.error('Error verifying pattern:', error);
      toast.error('Error verifying pattern');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleForgotPattern = () => {
    setStep('forgot');
  };

  const handleVerifySecurityAnswer = async () => {
    await triggerHaptic('heavy');

    if (!securityAnswer.trim()) {
      toast.error('Please enter your answer');
      return;
    }

    setIsVerifying(true);
    try {
      const isValid = await verifyGlobalPatternSecurityAnswer(securityAnswer);
      
      if (isValid) {
        toast.success('Answer verified! Set a new pattern.');
        setStep('reset');
        setResetStep('draw');
      } else {
        toast.error('Incorrect answer. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying security answer:', error);
      toast.error('Error verifying answer');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleNewPatternDrawn = async (pattern: number[]) => {
    await triggerHaptic('medium');
    setNewPattern(pattern);
    setResetStep('confirm');
  };

  const handleNewPatternConfirm = async (confirmedPattern: number[]) => {
    const match = 
      newPattern.length === confirmedPattern.length &&
      newPattern.every((dot, i) => dot === confirmedPattern[i]);

    if (match) {
      await triggerHaptic('heavy');
      setConfirmPattern(confirmedPattern);
      setResetStep('security');
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

  const handleSaveNewPattern = async () => {
    await triggerHaptic('heavy');

    if (!newSecurityQuestion) {
      toast.error('Please select a security question');
      return;
    }
    if (!newSecurityAnswer.trim()) {
      toast.error('Please enter an answer');
      return;
    }

    setIsVerifying(true);
    try {
      await resetGlobalPatternLock(
        newPattern,
        newSecurityQuestion,
        newSecurityAnswer.trim()
      );
      toast.success('Pattern reset successfully!');
      onUnlocked();
      onClose();
    } catch (error) {
      console.error('Error resetting pattern:', error);
      toast.error('Failed to reset pattern');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBack = () => {
    if (step === 'forgot') {
      setStep('pattern');
      setSecurityAnswer('');
    } else if (step === 'reset') {
      if (resetStep === 'confirm') {
        setResetStep('draw');
        setNewPattern([]);
      } else if (resetStep === 'security') {
        setResetStep('confirm');
      } else {
        setStep('forgot');
      }
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            {step !== 'pattern' && (
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
              {step === 'forgot' ? (
                <>
                  <HelpCircle className="h-5 w-5 text-primary" />
                  Forgot Pattern
                </>
              ) : step === 'reset' ? (
                <>
                  <ShieldQuestion className="h-5 w-5 text-primary" />
                  Reset Pattern
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5 text-primary" />
                  Unlock App
                </>
              )}
            </SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-2 pl-10">
            {step === 'pattern' && 'Draw your pattern to access all notes'}
            {step === 'forgot' && 'Answer your security question to reset'}
            {step === 'reset' && resetStep === 'draw' && 'Draw a new pattern'}
            {step === 'reset' && resetStep === 'confirm' && 'Confirm your new pattern'}
            {step === 'reset' && resetStep === 'security' && 'Set up a new security question'}
          </p>
        </SheetHeader>

        <div className="space-y-6">
          {/* Pattern unlock step */}
          {step === 'pattern' && (
            <div className="flex flex-col items-center py-4">
              <PatternLockInput
                onPatternComplete={handlePatternAttempt}
                error={patternError}
                disabled={isVerifying}
                size="large"
              />
              
              {attempts > 0 && (
                <p className="text-destructive text-sm mt-4 animate-fade-in">
                  {5 - attempts} attempts remaining
                </p>
              )}

              <Button
                variant="link"
                onClick={handleForgotPattern}
                className="mt-6 text-primary"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Forgot Pattern?
              </Button>
            </div>
          )}

          {/* Forgot pattern step */}
          {step === 'forgot' && (
            <div className="space-y-4 animate-fade-in">
              {securityQuestion ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Security Question</Label>
                    <p className="font-medium">{securityQuestion}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="security-answer">Your Answer</Label>
                    <Input
                      id="security-answer"
                      type="text"
                      placeholder="Enter your answer"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifySecurityAnswer()}
                      className="h-12"
                    />
                  </div>

                  <Button
                    onClick={handleVerifySecurityAnswer}
                    className="w-full"
                    disabled={isVerifying}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify Answer'}
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <ShieldQuestion className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    No security question was set for the app pattern lock.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Unfortunately, the pattern cannot be recovered.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Reset pattern step */}
          {step === 'reset' && (
            <div className="animate-fade-in">
              {resetStep === 'draw' && (
                <div className="flex flex-col items-center py-4">
                  <PatternLockInput
                    onPatternComplete={handleNewPatternDrawn}
                    size="large"
                  />
                </div>
              )}

              {resetStep === 'confirm' && (
                <div className="flex flex-col items-center py-4">
                  <PatternLockInput
                    onPatternComplete={handleNewPatternConfirm}
                    error={patternError}
                    size="large"
                  />
                </div>
              )}

              {resetStep === 'security' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center mb-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="h-8 w-8 text-primary" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Security Question</Label>
                    <Select value={newSecurityQuestion} onValueChange={setNewSecurityQuestion}>
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
                    <Label htmlFor="new-answer">Your Answer</Label>
                    <Input
                      id="new-answer"
                      type="text"
                      placeholder="Enter your answer"
                      value={newSecurityAnswer}
                      onChange={(e) => setNewSecurityAnswer(e.target.value)}
                      className="h-12"
                    />
                  </div>

                  <Button
                    onClick={handleSaveNewPattern}
                    className="w-full"
                    disabled={isVerifying}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {isVerifying ? 'Saving...' : 'Save New Pattern'}
                  </Button>
                </div>
              )}
            </div>
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

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Lock, Fingerprint, Eye, EyeOff, Shield, Trash2 } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import {
  getNoteProtection,
  setNoteProtection,
  removeNoteProtection,
  checkBiometricAvailability,
  BiometricStatus,
} from '@/utils/noteProtection';

interface NoteProtectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  onProtectionChanged?: () => void;
}

export const NoteProtectionSheet = ({
  isOpen,
  onClose,
  noteId,
  onProtectionChanged,
}: NoteProtectionSheetProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [useBiometric, setUseBiometric] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>({ isAvailable: false, biometryType: 'none' });
  const [isProtected, setIsProtected] = useState(false);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      checkBiometricAvailability().then(setBiometricStatus);
      getNoteProtection(noteId).then((protection) => {
        setIsProtected(protection.hasPassword || protection.useBiometric);
        setUseBiometric(protection.useBiometric);
        setUsePassword(protection.hasPassword);
      });
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, noteId]);

  const handleSave = async () => {
    await triggerHaptic('heavy');

    if (usePassword) {
      if (!password) {
        toast.error('Please enter a password');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      if (password.length < 4) {
        toast.error('Password must be at least 4 characters');
        return;
      }
    }

    await setNoteProtection(
      noteId,
      { hasPassword: usePassword, useBiometric },
      usePassword ? password : undefined
    );

    toast.success('Note protection updated');
    onProtectionChanged?.();
    onClose();
  };

  const handleRemoveProtection = async () => {
    await triggerHaptic('heavy');
    removeNoteProtection(noteId);
    toast.success('Note protection removed');
    onProtectionChanged?.();
    onClose();
  };

  const getBiometricLabel = () => {
    switch (biometricStatus.biometryType) {
      case 'face':
        return 'Use Face ID';
      case 'fingerprint':
        return 'Use Fingerprint';
      case 'iris':
        return 'Use Iris Scan';
      default:
        return 'Use Biometric';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Protect Note
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Password Protection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="use-password">Password Protection</Label>
              </div>
              <Switch
                id="use-password"
                checked={usePassword}
                onCheckedChange={setUsePassword}
              />
            </div>

            {usePassword && (
              <div className="space-y-3 pl-6">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Biometric Protection */}
          {biometricStatus.isAvailable && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="use-biometric">{getBiometricLabel()}</Label>
              </div>
              <Switch
                id="use-biometric"
                checked={useBiometric}
                onCheckedChange={setUseBiometric}
              />
            </div>
          )}

          {!biometricStatus.isAvailable && (
            <p className="text-xs text-muted-foreground">
              Biometric authentication is not available on this device.
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4">
            <Button onClick={handleSave} className="w-full">
              <Shield className="h-4 w-4 mr-2" />
              {isProtected ? 'Update Protection' : 'Enable Protection'}
            </Button>

            {isProtected && (
              <Button
                variant="outline"
                onClick={handleRemoveProtection}
                className="w-full text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Protection
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

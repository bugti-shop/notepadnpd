import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Lock, Shield, Fingerprint } from "lucide-react";
import { isGlobalPatternLockEnabled, hasGlobalPatternLock } from "@/utils/patternLock";
import { isBiometricEnabled, authenticateWithBiometric, getBiometricTypeName } from "@/utils/biometricAuth";
import { getSetting } from "@/utils/settingsStorage";
import { GlobalPatternUnlockSheet } from "./GlobalPatternUnlockSheet";
import { useAutoLock, AutoLockTimeout } from "@/hooks/useAutoLock";
import { triggerHaptic } from "@/utils/haptics";
import { toast } from "sonner";

interface AppPatternGateProps {
  children: React.ReactNode;
}

const AppPatternGate = ({ children }: AppPatternGateProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const [requiresUnlock, setRequiresUnlock] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockSheet, setShowUnlockSheet] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricName, setBiometricName] = useState('Biometric');
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);

  // Handle locking the app
  const handleLock = useCallback(() => {
    setIsUnlocked(false);
    setShowUnlockSheet(false);
  }, []);

  // Auto-lock hook
  useAutoLock({
    onLock: handleLock,
    enabled: requiresUnlock && isUnlocked,
  });

  useEffect(() => {
    const checkGlobalLock = async () => {
      try {
        const [enabled, hasPattern] = await Promise.all([
          isGlobalPatternLockEnabled(),
          hasGlobalPatternLock()
        ]);
        
        if (enabled && hasPattern) {
          setRequiresUnlock(true);
          
          // Check biometric availability
          const [biometricEnabled, bioName] = await Promise.all([
            isBiometricEnabled(),
            getBiometricTypeName()
          ]);
          
          setBiometricAvailable(biometricEnabled);
          setBiometricName(bioName);
          
          // Try biometric first if enabled
          if (biometricEnabled) {
            try {
              setIsBiometricAuthenticating(true);
              const success = await authenticateWithBiometric();
              if (success) {
                await triggerHaptic('heavy');
                setIsUnlocked(true);
                setIsChecking(false);
                return;
              }
            } catch (error) {
              console.warn('Biometric failed, showing pattern:', error);
            } finally {
              setIsBiometricAuthenticating(false);
            }
          }
          
          setShowUnlockSheet(true);
        }
      } catch (error) {
        console.error('Error checking global pattern lock:', error);
      }
      setIsChecking(false);
    };

    checkGlobalLock();
  }, []);

  const handleUnlock = () => {
    setIsUnlocked(true);
    setShowUnlockSheet(false);
  };

  const handleBiometricUnlock = async () => {
    try {
      setIsBiometricAuthenticating(true);
      const success = await authenticateWithBiometric();
      if (success) {
        await triggerHaptic('heavy');
        toast.success('Unlocked!');
        handleUnlock();
      }
    } catch (error) {
      console.warn('Biometric authentication failed:', error);
      toast.error('Biometric authentication failed');
    } finally {
      setIsBiometricAuthenticating(false);
    }
  };

  // Still checking - show nothing to prevent flash
  if (isChecking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          {isBiometricAuthenticating ? (
            <>
              <Fingerprint className="w-12 h-12 text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Authenticating...</p>
            </>
          ) : (
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </motion.div>
      </div>
    );
  }

  // Requires unlock and not yet unlocked - show locked screen
  if (requiresUnlock && !isUnlocked) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 flex flex-col items-center justify-center bg-background p-6"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-6 max-w-sm text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">App Locked</h1>
              <p className="text-muted-foreground">
                This app is protected with a pattern lock. Draw your pattern to continue.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {biometricAvailable && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBiometricUnlock}
                  disabled={isBiometricAuthenticating}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg disabled:opacity-50"
                >
                  <Fingerprint className="w-5 h-5" />
                  {isBiometricAuthenticating ? 'Authenticating...' : `Unlock with ${biometricName}`}
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowUnlockSheet(true)}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium ${
                  biometricAvailable 
                    ? 'bg-secondary text-secondary-foreground' 
                    : 'bg-primary text-primary-foreground shadow-lg'
                }`}
              >
                <Lock className="w-5 h-5" />
                Use Pattern
              </motion.button>
            </div>
          </motion.div>
        </motion.div>

        <GlobalPatternUnlockSheet
          isOpen={showUnlockSheet}
          onClose={() => setShowUnlockSheet(false)}
          onUnlocked={handleUnlock}
        />
      </>
    );
  }

  // Either no lock required or already unlocked - show app
  return <>{children}</>;
};

export default AppPatternGate;

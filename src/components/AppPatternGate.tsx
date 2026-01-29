import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Shield } from "lucide-react";
import { isGlobalPatternLockEnabled, hasGlobalPatternLock } from "@/utils/patternLock";
import { GlobalPatternUnlockSheet } from "./GlobalPatternUnlockSheet";

interface AppPatternGateProps {
  children: React.ReactNode;
}

const AppPatternGate = ({ children }: AppPatternGateProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const [requiresUnlock, setRequiresUnlock] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockSheet, setShowUnlockSheet] = useState(false);

  useEffect(() => {
    const checkGlobalLock = async () => {
      try {
        const [enabled, hasPattern] = await Promise.all([
          isGlobalPatternLockEnabled(),
          hasGlobalPatternLock()
        ]);
        
        if (enabled && hasPattern) {
          setRequiresUnlock(true);
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

  // Still checking - show nothing to prevent flash
  if (isChecking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowUnlockSheet(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg"
            >
              <Lock className="w-5 h-5" />
              Unlock App
            </motion.button>
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

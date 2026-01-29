// Auto-lock hook for app inactivity timeout
import { useEffect, useRef, useCallback } from 'react';
import { getSetting } from '@/utils/settingsStorage';

export type AutoLockTimeout = 'off' | '30s' | '1m' | '5m' | '15m' | '30m';

const TIMEOUT_VALUES: Record<AutoLockTimeout, number> = {
  'off': 0,
  '30s': 30 * 1000,
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
};

interface UseAutoLockOptions {
  onLock: () => void;
  enabled: boolean;
}

export const useAutoLock = ({ onLock, enabled }: UseAutoLockOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutValueRef = useRef<number>(0);
  const isActiveRef = useRef(true);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!enabled || timeoutValueRef.current === 0) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      if (isActiveRef.current && document.visibilityState === 'visible') {
        onLock();
      }
    }, timeoutValueRef.current);
  }, [enabled, onLock]);

  // Load timeout setting and set up activity listeners
  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const loadTimeoutAndStart = async () => {
      const timeout = await getSetting<AutoLockTimeout>('npd_auto_lock_timeout', 'off');
      timeoutValueRef.current = TIMEOUT_VALUES[timeout];
      resetTimer();
    };

    loadTimeoutAndStart();

    // Activity events that reset the timer
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetTimer();
    };

    // Handle visibility change (app going to background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // When app goes to background, start a shorter timer
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        // Lock after short delay when app goes to background
        if (timeoutValueRef.current > 0) {
          timeoutRef.current = setTimeout(() => {
            onLock();
          }, Math.min(timeoutValueRef.current, 30000)); // Max 30s when in background
        }
      } else if (document.visibilityState === 'visible') {
        // App came back to foreground - reset timer
        resetTimer();
      }
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, resetTimer, onLock]);

  // Clean up on unmount
  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { resetTimer };
};

export const AUTO_LOCK_OPTIONS: { value: AutoLockTimeout; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: '30s', label: '30 seconds' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
];

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSetting, setSetting, removeSetting } from '@/utils/settingsStorage';

interface WelcomeContextType {
  hasSeenWelcome: boolean;
  isLoading: boolean;
  completeWelcome: () => void;
  resetWelcome: () => void;
}

const WelcomeContext = createContext<WelcomeContextType | undefined>(undefined);

export function WelcomeProvider({ children }: { children: ReactNode }) {
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadWelcomeState = async () => {
      const seen = await getSetting<boolean>('hasSeenWelcome', false);
      setHasSeenWelcome(seen);
      setIsLoading(false);
    };
    loadWelcomeState();
  }, []);

  const completeWelcome = () => {
    setHasSeenWelcome(true);
    setSetting('hasSeenWelcome', true);
  };

  const resetWelcome = async () => {
    setHasSeenWelcome(false);
    await removeSetting('hasSeenWelcome');
    await removeSetting('npd_pro_access');
    await removeSetting('npd_trial_start');
    sessionStorage.removeItem('npd_trial_warning_shown');
  };

  return (
    <WelcomeContext.Provider value={{ hasSeenWelcome, isLoading, completeWelcome, resetWelcome }}>
      {children}
    </WelcomeContext.Provider>
  );
}

export function useWelcome() {
  const context = useContext(WelcomeContext);
  if (context === undefined) {
    throw new Error('useWelcome must be used within a WelcomeProvider');
  }
  return context;
}

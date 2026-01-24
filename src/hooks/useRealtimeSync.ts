import { useEffect, useState } from 'react';
import { syncManager } from '@/utils/syncManager';

export const useRealtimeSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const manualSync = async () => {
    setIsSyncing(true);
    setHasError(false);

    const result = await syncManager.syncAllData();

    if (!result.success) {
      setHasError(true);
    }

    setIsSyncing(false);
  };

  return {
    isOnline,
    isSyncing,
    hasError,
    manualSync,
    lastSync: syncManager.getLastSyncTime(),
  };
};

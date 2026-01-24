import { createContext, useContext, useState, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

export type SubscriptionTier = 'free' | 'premium';

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isLoading: boolean;
  purchaseMonthly: () => Promise<void>;
  purchaseYearly: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  canUseFeature: (feature: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const FREE_LIMITS = {
  maxJars: 5,
  maxCategories: 2,
  transactionHistoryDays: 30,
  maxStickyNotes: 5,
  maxCurrencies: 1,
  darkModes: 0,
  calculatorModes: ['monthly'],
  maxReminders: 0,
  maxActiveChallenges: 0,
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [tier] = useState<SubscriptionTier>('premium'); // Always premium - app is free
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const purchaseMonthly = async () => {
    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'App is Free!',
        description: 'All features are now available to everyone.',
      });
    } catch (error) {
      console.error('Purchase error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseYearly = async () => {
    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'App is Free!',
        description: 'All features are now available to everyone.',
      });
    } catch (error) {
      console.error('Purchase error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'Restore Complete',
        description: 'Your purchases have been restored.',
      });
    } catch (error) {
      console.error('Restore error:', error);
      toast({
        title: 'Restore Failed',
        description: 'Unable to restore purchases.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canUseFeature = (feature: string): boolean => {
    return true; // All features are free
  };

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        isLoading,
        purchaseMonthly,
        purchaseYearly,
        restorePurchases,
        canUseFeature,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

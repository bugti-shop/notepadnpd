import { useCallback } from 'react';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { Capacitor } from '@capacitor/core';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  onSubscriptionExpired?: () => void;
}

// SubscriptionGuard is now disabled - only OnboardingFlow paywall is active
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  // No subscription checks - just render children
  return <>{children}</>;
}

// Hook for components that need to check subscription status (disabled)
export function useSubscriptionGuard() {
  const { isPro, customerInfo } = useRevenueCat();

  // Always return true - no subscription enforcement
  const requireSubscription = useCallback(async (): Promise<boolean> => {
    return true;
  }, []);

  // Get subscription status info (for display only, not enforcement)
  const getSubscriptionStatus = useCallback(() => {
    if (!customerInfo) {
      return { isActive: true, expirationDate: null, willRenew: false };
    }

    const entitlement = customerInfo.entitlements.active['npd Pro'];
    
    if (!entitlement) {
      return { isActive: true, expirationDate: null, willRenew: false };
    }

    return {
      isActive: true,
      expirationDate: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
      willRenew: entitlement.willRenew ?? false,
    };
  }, [customerInfo]);

  return {
    isPro: true, // Always return true
    requireSubscription,
    getSubscriptionStatus,
  };
}

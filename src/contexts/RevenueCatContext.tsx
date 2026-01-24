import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  Purchases, 
  LOG_LEVEL,
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  PACKAGE_TYPE,
  PAYWALL_RESULT,
  PurchasesCallbackId
} from '@revenuecat/purchases-capacitor';
import { RevenueCatUI } from '@revenuecat/purchases-capacitor-ui';
import { Capacitor } from '@capacitor/core';

// RevenueCat API Key - This is a public key safe to include in the app
const REVENUECAT_API_KEY = 'goog_WLSvWlyHHLzNAgIfhCzAYsGaZyh';

// Entitlement identifier
const ENTITLEMENT_ID = 'npd Pro';

// Product identifiers
const PRODUCT_IDS = {
  monthly: 'monthly',
  yearly: 'yearly',
} as const;

export type ProductType = keyof typeof PRODUCT_IDS;

interface RevenueCatContextType {
  isInitialized: boolean;
  isLoading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  error: string | null;
  
  // Actions
  initialize: (appUserID?: string) => Promise<void>;
  checkEntitlement: () => Promise<boolean>;
  getOfferings: () => Promise<PurchasesOfferings | null>;
  purchase: (productType: ProductType) => Promise<boolean>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  presentPaywall: () => Promise<PAYWALL_RESULT>;
  presentPaywallIfNeeded: () => Promise<PAYWALL_RESULT>;
  presentCustomerCenter: () => Promise<void>;
  logout: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

interface RevenueCatProviderProps {
  children: ReactNode;
  appUserID?: string;
}

export function RevenueCatProvider({ children, appUserID }: RevenueCatProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listenerHandle, setListenerHandle] = useState<PurchasesCallbackId | null>(null);

  // Initialize RevenueCat SDK
  const initialize = useCallback(async (userID?: string) => {
    // Only initialize on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat: Skipping initialization on web platform');
      setIsInitialized(true);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Enable debug logs in development
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

      // Configure RevenueCat
      await Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserID: userID || appUserID,
      });

      console.log('RevenueCat: SDK configured successfully');

      // Get initial customer info
      const { customerInfo: info } = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      
      // Check entitlement
      const hasEntitlement = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPro(hasEntitlement);

      // Pre-fetch offerings
      const offeringsData = await Purchases.getOfferings();
      setOfferings(offeringsData);

      setIsInitialized(true);
      console.log('RevenueCat: Initialization complete', { isPro: hasEntitlement });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize RevenueCat';
      console.error('RevenueCat: Initialization error', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [appUserID]);

  // Check entitlement status
  const checkEntitlement = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      const { customerInfo: info } = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      
      const hasEntitlement = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPro(hasEntitlement);
      
      return hasEntitlement;
    } catch (err) {
      console.error('RevenueCat: Error checking entitlement', err);
      return false;
    }
  }, []);

  // Get offerings
  const getOfferingsData = useCallback(async (): Promise<PurchasesOfferings | null> => {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    try {
      setIsLoading(true);
      const offeringsData = await Purchases.getOfferings();
      setOfferings(offeringsData);
      return offeringsData;
    } catch (err) {
      console.error('RevenueCat: Error fetching offerings', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Purchase a product by type
  const purchase = useCallback(async (productType: ProductType): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat: Purchase not available on web platform');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get the current offering
      const currentOfferings = await Purchases.getOfferings();
      
      if (!currentOfferings?.current) {
        throw new Error('No offerings available');
      }

      // Find the package by type
      const packageType = productType === 'monthly' ? PACKAGE_TYPE.MONTHLY : PACKAGE_TYPE.ANNUAL;
      const pkg = currentOfferings.current.availablePackages.find(
        p => p.packageType === packageType
      );

      if (!pkg) {
        // Try to find by identifier
        const pkgById = currentOfferings.current.availablePackages.find(
          p => p.identifier === PRODUCT_IDS[productType]
        );
        
        if (!pkgById) {
          throw new Error(`Package not found for ${productType}`);
        }
        
        return await purchasePackage(pkgById);
      }

      return await purchasePackage(pkg);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      console.error('RevenueCat: Purchase error', err);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Purchase a specific package
  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await Purchases.purchasePackage({ aPackage: pkg });
      setCustomerInfo(result.customerInfo);

      const hasEntitlement = result.customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPro(hasEntitlement);

      console.log('RevenueCat: Purchase successful', { isPro: hasEntitlement });
      return hasEntitlement;
    } catch (err: any) {
      // Check if user cancelled
      if (err.code === 'PURCHASE_CANCELLED' || err.userCancelled) {
        console.log('RevenueCat: Purchase cancelled by user');
        return false;
      }

      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      console.error('RevenueCat: Purchase error', err);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { customerInfo: info } = await Purchases.restorePurchases();
      setCustomerInfo(info);

      const hasEntitlement = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPro(hasEntitlement);

      console.log('RevenueCat: Restore successful', { isPro: hasEntitlement });
      return hasEntitlement;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Restore failed';
      console.error('RevenueCat: Restore error', err);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Present RevenueCat Paywall
  const presentPaywall = useCallback(async (): Promise<PAYWALL_RESULT> => {
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat: Paywall not available on web platform');
      return PAYWALL_RESULT.NOT_PRESENTED;
    }

    try {
      setIsLoading(true);
      const { result } = await RevenueCatUI.presentPaywall();
      
      // Refresh customer info after paywall
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await checkEntitlement();
      }
      
      return result;
    } catch (err) {
      console.error('RevenueCat: Paywall error', err);
      return PAYWALL_RESULT.ERROR;
    } finally {
      setIsLoading(false);
    }
  }, [checkEntitlement]);

  // Present Paywall if needed (only if user doesn't have entitlement)
  const presentPaywallIfNeeded = useCallback(async (): Promise<PAYWALL_RESULT> => {
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat: Paywall not available on web platform');
      return PAYWALL_RESULT.NOT_PRESENTED;
    }

    try {
      setIsLoading(true);
      const { result } = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });
      
      // Refresh customer info after paywall
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await checkEntitlement();
      }
      
      return result;
    } catch (err) {
      console.error('RevenueCat: Paywall error', err);
      return PAYWALL_RESULT.ERROR;
    } finally {
      setIsLoading(false);
    }
  }, [checkEntitlement]);

  // Present Customer Center
  const presentCustomerCenter = useCallback(async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat: Customer Center not available on web platform');
      return;
    }

    try {
      await RevenueCatUI.presentCustomerCenter();
      // Refresh customer info after customer center
      await checkEntitlement();
    } catch (err) {
      console.error('RevenueCat: Customer Center error', err);
    }
  }, [checkEntitlement]);

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await Purchases.logOut();
      setCustomerInfo(null);
      setIsPro(false);
      setIsInitialized(false);
    } catch (err) {
      console.error('RevenueCat: Logout error', err);
    }
  }, []);

  // Auto-initialize on mount
  useEffect(() => {
    if (!isInitialized && Capacitor.isNativePlatform()) {
      initialize();
    } else if (!Capacitor.isNativePlatform()) {
      setIsInitialized(true);
    }
  }, [initialize, isInitialized]);

  // Listen for customer info updates
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isMounted = true;

    const setupListener = async () => {
      try {
        const handle = await Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
          if (isMounted) {
            console.log('RevenueCat: Customer info updated');
            setCustomerInfo(info);
            const hasEntitlement = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
            setIsPro(hasEntitlement);
          }
        });
        if (isMounted) {
          setListenerHandle(handle);
        }
      } catch (err) {
        console.error('RevenueCat: Error setting up listener', err);
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (listenerHandle) {
        Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerHandle }).catch(console.error);
      }
    };
  }, []);

  const value: RevenueCatContextType = {
    isInitialized,
    isLoading,
    isPro,
    customerInfo,
    offerings,
    error,
    initialize,
    checkEntitlement,
    getOfferings: getOfferingsData,
    purchase,
    purchasePackage,
    restorePurchases,
    presentPaywall,
    presentPaywallIfNeeded,
    presentCustomerCenter,
    logout,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}

// Export constants for use elsewhere
export { ENTITLEMENT_ID, PRODUCT_IDS, REVENUECAT_API_KEY };

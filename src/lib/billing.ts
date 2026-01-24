// RevenueCat Billing Configuration
// Product and entitlement identifiers must match your RevenueCat dashboard setup

import { Capacitor } from '@capacitor/core';

// Entitlement identifier - matches RevenueCat dashboard
export const ENTITLEMENT_ID = 'npd Pro';

// Product identifiers - matches RevenueCat dashboard and store products
export const BILLING_CONFIG = {
  // Weekly Subscription
  weekly: {
    productId: 'npd_wk', // RevenueCat package identifier
    basePlanId: 'npd-wk-plan',
    offerId: 'npd-wk-trial',
  },
  
  // Monthly Subscription
  monthly: {
    productId: 'monthly', // RevenueCat package identifier
    basePlanId: 'npd-mo',
    offerId: 'npd-monthly-offer',
  },
  
  // Yearly Subscription
  yearly: {
    productId: 'yearly', // RevenueCat package identifier
    basePlanId: 'npd-yearly-plan',
    offerId: 'npd-yearly-trial',
  },
} as const;

export type PlanType = keyof typeof BILLING_CONFIG;

export interface SubscriptionProduct {
  productId: string;
  basePlanId: string;
  offerId: string;
}

// Get subscription details for a plan
export const getSubscriptionDetails = (plan: PlanType): SubscriptionProduct => {
  return BILLING_CONFIG[plan];
};

// Pricing display (for UI only - actual pricing comes from RevenueCat/Store)
export const PRICING_DISPLAY = {
  weekly: {
    price: '$2.99',
    period: 'week',
    displayPrice: '$2.99/wk',
    trialDays: 1,
  },
  monthly: {
    price: '$4.99',
    period: 'month',
    displayPrice: '$4.99/mo',
  },
  yearly: {
    price: '$35.88',
    period: 'year',
    monthlyEquivalent: '$2.99/mo',
    displayPrice: '$2.99/mo',
    trialDays: 3,
  },
} as const;

// Helper to check if we're on a native platform
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

// Legacy function - now handled by RevenueCatContext
// Kept for backward compatibility
export const initiatePurchase = async (plan: PlanType): Promise<boolean> => {
  console.log('initiatePurchase called for plan:', plan);
  console.log('Note: Use useRevenueCat().purchase() instead for proper RevenueCat integration');
  
  // This is now a placeholder - actual purchases should go through RevenueCatContext
  // Import and use useRevenueCat hook for purchases
  return true;
};

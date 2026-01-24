/**
 * Native Authentication Bridge
 * 
 * This module provides a JavaScript bridge interface for native Android Google Sign-In.
 * It allows the WebView to trigger native authentication flows and receive callbacks
 * with tokens and user info.
 * 
 * On Android, the native app should inject a JavaScript interface named "NativeAuthBridge"
 * that implements the required methods.
 */

import { Capacitor } from '@capacitor/core';

// Type definitions for the native bridge interface
export interface NativeGoogleUser {
  id: string;
  email: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  photoUrl?: string;
  idToken?: string;
  serverAuthCode?: string;
}

export interface NativeAuthResult {
  success: boolean;
  user?: NativeGoogleUser;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

// Callback type for auth results
type AuthCallback = (result: NativeAuthResult) => void;

// Global callback storage for native bridge
declare global {
  interface Window {
    NativeAuthBridge?: {
      signIn: () => void;
      signOut: () => void;
      isSignedIn: () => boolean;
      getLastUser: () => string | null; // JSON string of NativeGoogleUser
    };
    // Callback that native code will call
    onNativeAuthResult?: AuthCallback;
    onNativeSignOutResult?: (success: boolean) => void;
  }
}

// Pending promise resolvers
let signInResolver: ((result: NativeAuthResult) => void) | null = null;
let signOutResolver: ((success: boolean) => void) | null = null;

/**
 * Check if native auth bridge is available
 */
export const isNativeAuthAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && typeof window.NativeAuthBridge !== 'undefined';
};

/**
 * Check if user is currently signed in (native)
 */
export const isNativeSignedIn = (): boolean => {
  if (!isNativeAuthAvailable()) return false;
  try {
    return window.NativeAuthBridge!.isSignedIn();
  } catch (e) {
    console.error('[NativeAuth] Error checking sign-in status:', e);
    return false;
  }
};

/**
 * Get the last signed-in user from native storage
 */
export const getNativeUser = (): NativeGoogleUser | null => {
  if (!isNativeAuthAvailable()) return null;
  try {
    const userJson = window.NativeAuthBridge!.getLastUser();
    if (userJson) {
      return JSON.parse(userJson);
    }
  } catch (e) {
    console.error('[NativeAuth] Error getting native user:', e);
  }
  return null;
};

/**
 * Trigger native Google Sign-In
 * Returns a promise that resolves when authentication completes
 */
export const nativeSignIn = (): Promise<NativeAuthResult> => {
  return new Promise((resolve) => {
    if (!isNativeAuthAvailable()) {
      resolve({
        success: false,
        error: 'Native auth bridge not available',
      });
      return;
    }

    // Set up callback for native code
    signInResolver = resolve;
    window.onNativeAuthResult = (result: NativeAuthResult) => {
      console.log('[NativeAuth] Received auth result:', result.success);
      if (signInResolver) {
        signInResolver(result);
        signInResolver = null;
      }
    };

    // Trigger native sign-in
    try {
      console.log('[NativeAuth] Triggering native sign-in...');
      window.NativeAuthBridge!.signIn();
    } catch (e) {
      console.error('[NativeAuth] Error triggering sign-in:', e);
      resolve({
        success: false,
        error: 'Failed to trigger native sign-in',
      });
    }

    // Timeout after 2 minutes
    setTimeout(() => {
      if (signInResolver) {
        console.log('[NativeAuth] Sign-in timeout');
        signInResolver({
          success: false,
          error: 'Sign-in timeout',
        });
        signInResolver = null;
      }
    }, 2 * 60 * 1000);
  });
};

/**
 * Trigger native Google Sign-Out
 */
export const nativeSignOut = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!isNativeAuthAvailable()) {
      resolve(true); // Consider it success if bridge not available
      return;
    }

    signOutResolver = resolve;
    window.onNativeSignOutResult = (success: boolean) => {
      console.log('[NativeAuth] Sign-out result:', success);
      if (signOutResolver) {
        signOutResolver(success);
        signOutResolver = null;
      }
    };

    try {
      console.log('[NativeAuth] Triggering native sign-out...');
      window.NativeAuthBridge!.signOut();
    } catch (e) {
      console.error('[NativeAuth] Error triggering sign-out:', e);
      resolve(false);
    }

    // Timeout after 10 seconds
    setTimeout(() => {
      if (signOutResolver) {
        signOutResolver(true);
        signOutResolver = null;
      }
    }, 10 * 1000);
  });
};

/**
 * Exchange server auth code for access/refresh tokens
 * This should be called on your backend, but for client-side we can call Google's token endpoint
 */
export const exchangeAuthCode = async (
  serverAuthCode: string,
  clientId: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number } | null> => {
  try {
    // Note: For production, this should be done server-side to protect client_secret
    // For web client IDs without a secret, this can work client-side
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        code: serverAuthCode,
        grant_type: 'authorization_code',
        redirect_uri: '', // Required but can be empty for native apps
      }),
    });

    if (!response.ok) {
      console.error('[NativeAuth] Token exchange failed:', await response.text());
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
    };
  } catch (e) {
    console.error('[NativeAuth] Error exchanging auth code:', e);
    return null;
  }
};

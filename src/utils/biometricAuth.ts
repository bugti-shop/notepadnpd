// Biometric authentication utilities
// Uses Capacitor biometric plugin for native and Web Authentication API for web

import { Capacitor } from '@capacitor/core';
import { getSetting, setSetting } from './settingsStorage';

// Storage keys
const BIOMETRIC_ENABLED_KEY = 'npd_biometric_enabled';

// Check if biometric authentication is available
export const isBiometricAvailable = async (): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Dynamic import for native biometric plugin
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      const result = await BiometricAuth.checkBiometry();
      return result.isAvailable;
    } else {
      // Web fallback - check if Web Authentication API is available
      return !!(window.PublicKeyCredential && navigator.credentials);
    }
  } catch (error) {
    console.warn('Biometric check failed:', error);
    return false;
  }
};

// Get biometric type name for display
export const getBiometricTypeName = async (): Promise<string> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const { BiometricAuth, BiometryType } = await import('@aparajita/capacitor-biometric-auth');
      const result = await BiometricAuth.checkBiometry();
      
      switch (result.biometryType) {
        case BiometryType.faceId:
          return 'Face ID';
        case BiometryType.touchId:
          return 'Touch ID';
        case BiometryType.fingerprintAuthentication:
          return 'Fingerprint';
        case BiometryType.faceAuthentication:
          return 'Face Unlock';
        case BiometryType.irisAuthentication:
          return 'Iris';
        default:
          return 'Biometric';
      }
    }
    return 'Biometric';
  } catch {
    return 'Biometric';
  }
};

// Check if biometric unlock is enabled
export const isBiometricEnabled = async (): Promise<boolean> => {
  return getSetting<boolean>(BIOMETRIC_ENABLED_KEY, false);
};

// Enable or disable biometric unlock
export const setBiometricEnabled = async (enabled: boolean): Promise<void> => {
  await setSetting(BIOMETRIC_ENABLED_KEY, enabled);
};

// Authenticate using biometrics
export const authenticateWithBiometric = async (): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      
      await BiometricAuth.authenticate({
        reason: 'Unlock Notepad',
        cancelTitle: 'Use Pattern',
        allowDeviceCredential: true,
      });
      
      return true;
    } else {
      // Web fallback - no native biometric available
      console.warn('Biometric authentication not available on web');
      return false;
    }
  } catch (error: any) {
    console.warn('Biometric authentication failed:', error);
    // Check if user cancelled
    if (error?.code === 'userCancel' || error?.message?.includes('cancel')) {
      return false;
    }
    throw error;
  }
};

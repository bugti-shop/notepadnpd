import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin, GoogleLoginResponse, GoogleLoginResponseOnline } from '@capgo/capacitor-social-login';
import { getSetting, setSetting, removeSetting } from '@/utils/settingsStorage';
import { getGoogleDriveSyncManager, startAutoSync, stopAutoSync, setupChangeListeners } from '@/utils/googleDriveSync';
import { startCalendarAutoSync, stopCalendarAutoSync } from '@/utils/calendarBidirectionalSync';
import { getCalendarSyncSettings } from '@/utils/googleCalendarSync';

// Google Auth types
export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  imageUrl?: string;
}

export interface GoogleAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken: string; // REQUIRED - ID Token is the only valid proof of Google identity
  expiresAt?: number;
}

interface GoogleAuthContextType {
  user: GoogleUser | null;
  tokens: GoogleAuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoring: boolean;
  hasCalendarAccess: boolean;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  requestCalendarAccess: () => Promise<boolean>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

// Web Client ID (required for native Google Sign-In SDK)
const GOOGLE_WEB_CLIENT_ID = '52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com';

// INITIAL SCOPES - Minimal for login (NO calendar scopes)
const INITIAL_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.appdata',
];

// CALENDAR SCOPES - Requested incrementally when user enables calendar features
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendars',
];

const STORAGE_KEYS = {
  USER: 'google_user',
  TOKENS: 'google_tokens',
  CALENDAR_ACCESS: 'google_calendar_access_granted',
};

// Type guard for online response
const isOnlineResponse = (result: GoogleLoginResponse): result is GoogleLoginResponseOnline => {
  return result.responseType === 'online';
};

export const GoogleAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [tokens, setTokens] = useState<GoogleAuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const changeListenerCleanup = useRef<(() => void) | null>(null);
  const isPluginInitialized = useRef(false);

  // Load calendar access state on mount
  useEffect(() => {
    getSetting<boolean>(STORAGE_KEYS.CALENDAR_ACCESS, false).then(setHasCalendarAccess);
  }, []);

  // Initialize native Google Sign-In plugin
  useEffect(() => {
    const initializePlugin = async () => {
      if (isPluginInitialized.current) return;
      
      try {
        if (Capacitor.isNativePlatform()) {
          console.log('[GoogleAuth] Initializing native Google Sign-In SDK...');
          await SocialLogin.initialize({
            google: {
              webClientId: GOOGLE_WEB_CLIENT_ID,
              mode: 'online',
            },
          });
          isPluginInitialized.current = true;
          console.log('[GoogleAuth] Native Google Sign-In SDK initialized');
        }
      } catch (error) {
        console.error('[GoogleAuth] Error initializing plugin:', error);
      }
    };

    initializePlugin();
  }, []);

  // Refresh access token using Google's token endpoint
  const refreshAccessToken = useCallback(async (refreshToken: string): Promise<boolean> => {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_WEB_CLIENT_ID,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      const newTokens: GoogleAuthTokens = {
        accessToken: data.access_token,
        refreshToken: refreshToken,
        idToken: data.id_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
      };

      setTokens(newTokens);
      await setSetting(STORAGE_KEYS.TOKENS, newTokens);
      return true;
    } catch (error) {
      console.error('[GoogleAuth] Error refreshing token:', error);
      return false;
    }
  }, []);

  // Start background sync when we have valid tokens
  const startBackgroundSync = useCallback(async (accessToken: string) => {
    console.log('[GoogleAuth] Starting background sync...');
    
    stopAutoSync();
    stopCalendarAutoSync();
    if (changeListenerCleanup.current) {
      changeListenerCleanup.current();
    }
    
    startAutoSync(accessToken, 1);
    changeListenerCleanup.current = setupChangeListeners(accessToken);
    
    try {
      const calendarSettings = await getCalendarSyncSettings();
      if (calendarSettings.enabled) {
        await startCalendarAutoSync(accessToken, 5);
        console.log('[GoogleAuth] Calendar bidirectional sync started');
      }
    } catch (error) {
      console.warn('[GoogleAuth] Calendar sync initialization failed:', error);
    }
    
    console.log('[GoogleAuth] Background sync started');
  }, []);

  // Auto-restore data from Google Drive after login (non-blocking)
  const restoreFromCloud = useCallback(async (accessToken: string) => {
    startBackgroundSync(accessToken);
    
    try {
      setIsRestoring(true);
      console.log('[GoogleAuth] Checking for cloud backup (background)...');
      
      const syncManager = getGoogleDriveSyncManager(accessToken);
      const backupInfo = await syncManager.getCloudBackupInfo();
      
      if (backupInfo?.exists) {
        console.log('[GoogleAuth] Cloud backup found, downloading...');
        const backup = await syncManager.downloadBackup();
        
        if (backup) {
          console.log('[GoogleAuth] Restoring data from cloud backup...');
          const restored = await syncManager.restoreFromBackup(backup);
          
          if (restored) {
            console.log('[GoogleAuth] Data restored successfully!');
            window.dispatchEvent(new CustomEvent('cloudRestoreComplete', { 
              detail: { success: true, action: 'restored' } 
            }));
          }
        }
      } else {
        console.log('[GoogleAuth] No cloud backup found, uploading local data...');
        const localData = await syncManager.collectBackupData();
        await syncManager.uploadBackup(localData);
        window.dispatchEvent(new CustomEvent('cloudRestoreComplete', { 
          detail: { success: true, action: 'uploaded' } 
        }));
      }
    } catch (error) {
      console.error('[GoogleAuth] Error restoring from cloud:', error);
      window.dispatchEvent(new CustomEvent('cloudRestoreComplete', { 
        detail: { success: false, error } 
      }));
    } finally {
      setIsRestoring(false);
    }
  }, [startBackgroundSync]);

  // Load saved auth state on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadAuthState = async () => {
      try {
        console.log('[GoogleAuth] Loading saved auth state...');
        const savedUser = await getSetting<GoogleUser | null>(STORAGE_KEYS.USER, null);
        const savedTokens = await getSetting<GoogleAuthTokens | null>(STORAGE_KEYS.TOKENS, null);
        
        if (!isMounted) return;
        
        if (savedUser && savedTokens) {
          console.log('[GoogleAuth] Found saved credentials for:', savedUser.email);
          
          const bufferTime = 5 * 60 * 1000;
          const isTokenValid = savedTokens.expiresAt && (savedTokens.expiresAt - bufferTime) > Date.now();
          
          if (isTokenValid) {
            console.log('[GoogleAuth] Token still valid, restoring session...');
            setUser(savedUser);
            setTokens(savedTokens);
            
            if (savedTokens.accessToken) {
              console.log('[GoogleAuth] Resuming background sync with saved token...');
              startBackgroundSync(savedTokens.accessToken);
            }
          } else if (savedTokens.refreshToken) {
            console.log('[GoogleAuth] Token expired, refreshing...');
            const refreshed = await refreshAccessToken(savedTokens.refreshToken);
            if (refreshed && isMounted) {
              const newTokens = await getSetting<GoogleAuthTokens | null>(STORAGE_KEYS.TOKENS, null);
              setUser(savedUser);
              if (newTokens?.accessToken) {
                setTokens(newTokens);
                console.log('[GoogleAuth] Session restored with refreshed token');
                startBackgroundSync(newTokens.accessToken);
              }
            }
          } else {
            console.log('[GoogleAuth] No refresh token available, clearing stale session');
            await removeSetting(STORAGE_KEYS.USER);
            await removeSetting(STORAGE_KEYS.TOKENS);
          }
        } else {
          console.log('[GoogleAuth] No saved credentials found');
        }
      } catch (error) {
        console.error('[GoogleAuth] Error loading auth state:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAuthState();
    
    return () => {
      isMounted = false;
      stopAutoSync();
      if (changeListenerCleanup.current) {
        changeListenerCleanup.current();
      }
    };
  }, [startBackgroundSync, refreshAccessToken]);

  // NATIVE GOOGLE SIGN-IN SDK - No browser redirect, no OAuth URLs, no deep links
  const signIn = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('[GoogleAuth] Starting native Google Sign-In...');
      
      if (!Capacitor.isNativePlatform()) {
        console.log('[GoogleAuth] Web platform - using popup OAuth');
        return await signInWeb();
      }

      // NATIVE SIGN-IN using Google Sign-In SDK (play-services-auth)
      const result = await SocialLogin.login({
        provider: 'google',
        options: {
          scopes: INITIAL_SCOPES,
        },
      });

      console.log('[GoogleAuth] Native sign-in raw result:', JSON.stringify(result, null, 2));

      // Check if it's an online response (we initialized with mode: 'online')
      if (!result?.result || !isOnlineResponse(result.result)) {
        console.error('[GoogleAuth] Expected online response but got offline');
        setIsLoading(false);
        return false;
      }

      const onlineResult = result.result;
      const profile = onlineResult.profile;
      const accessToken = onlineResult.accessToken?.token;
      const idToken = onlineResult.idToken;

      console.log('[GoogleAuth] Parsed - profile:', profile, 'accessToken:', !!accessToken, 'idToken:', !!idToken);

      if (!profile) {
        console.error('[GoogleAuth] No profile data received');
        setIsLoading(false);
        return false;
      }

      // CRITICAL: ID Token is REQUIRED
      if (!idToken) {
        console.error('[GoogleAuth] CRITICAL: ID Token is missing!');
        setIsLoading(false);
        return false;
      }

      // Map profile data
      const googleUser: GoogleUser = {
        id: profile.id || '',
        email: profile.email || '',
        name: profile.name || `${profile.givenName || ''} ${profile.familyName || ''}`.trim(),
        givenName: profile.givenName || undefined,
        familyName: profile.familyName || undefined,
        imageUrl: profile.imageUrl || undefined,
      };

      const googleTokens: GoogleAuthTokens = {
        accessToken: accessToken || '',
        idToken,
        expiresAt: Date.now() + (3600 * 1000), // Default 1 hour
      };

      console.log('[GoogleAuth] Sign-in successful:', googleUser.email);

      // Update state immediately
      setUser(() => googleUser);
      setTokens(() => googleTokens);
      setIsLoading(false);

      // Persist to storage
      await setSetting(STORAGE_KEYS.USER, googleUser);
      await setSetting(STORAGE_KEYS.TOKENS, googleTokens);

      // Dispatch custom event to force UI update
      window.dispatchEvent(new CustomEvent('googleAuthChanged', { 
        detail: { user: googleUser, isAuthenticated: true } 
      }));

      // Start cloud restore in background
      if (accessToken) {
        restoreFromCloud(accessToken);
      }

      return true;
    } catch (error: any) {
      console.error('[GoogleAuth] Sign-in error:', error);
      setIsLoading(false);
      return false;
    }
  }, [restoreFromCloud]);

  // Web popup OAuth fallback
  const signInWeb = async (): Promise<boolean> => {
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('google_oauth_state', state);

    const redirectUri = window.location.origin + '/auth/callback';

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_WEB_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token id_token');
    authUrl.searchParams.set('scope', INITIAL_SCOPES.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', Math.random().toString(36).substring(7));
    authUrl.searchParams.set('prompt', 'select_account');

    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl.toString(),
      'google-signin',
      `width=${width},height=${height},left=${left},top=${top},popup=true`
    );

    if (!popup) {
      console.error('[GoogleAuth] Failed to open popup');
      setIsLoading(false);
      return false;
    }

    return new Promise((resolve) => {
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'google-auth-success') {
          window.removeEventListener('message', handleMessage);
          
          const { accessToken, idToken } = event.data;
          
          if (!idToken) {
            console.error('[GoogleAuth] No ID token from web OAuth');
            setIsLoading(false);
            resolve(false);
            return;
          }

          const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!userResponse.ok) {
            setIsLoading(false);
            resolve(false);
            return;
          }

          const userData = await userResponse.json();

          const googleUser: GoogleUser = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            givenName: userData.given_name,
            familyName: userData.family_name,
            imageUrl: userData.picture,
          };

          const googleTokens: GoogleAuthTokens = {
            accessToken,
            idToken,
            expiresAt: Date.now() + (3600 * 1000),
          };

          setUser(googleUser);
          setTokens(googleTokens);
          await setSetting(STORAGE_KEYS.USER, googleUser);
          await setSetting(STORAGE_KEYS.TOKENS, googleTokens);

          setIsLoading(false);
          resolve(true);
        } else if (event.data.type === 'google-auth-error') {
          window.removeEventListener('message', handleMessage);
          setIsLoading(false);
          resolve(false);
        }
      };

      window.addEventListener('message', handleMessage);

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsLoading(false);
          resolve(false);
        }
      }, 500);
    });
  };

  const signOut = useCallback(async () => {
    try {
      console.log('[GoogleAuth] Signing out...');
      
      stopAutoSync();
      stopCalendarAutoSync();
      if (changeListenerCleanup.current) {
        changeListenerCleanup.current();
        changeListenerCleanup.current = null;
      }

      if (Capacitor.isNativePlatform()) {
        try {
          await SocialLogin.logout({ provider: 'google' });
        } catch (e) {
          console.warn('[GoogleAuth] Native logout failed:', e);
        }
      }

      setUser(null);
      setTokens(null);
      setHasCalendarAccess(false);

      await removeSetting(STORAGE_KEYS.USER);
      await removeSetting(STORAGE_KEYS.TOKENS);
      await removeSetting(STORAGE_KEYS.CALENDAR_ACCESS);

      window.dispatchEvent(new CustomEvent('googleAuthChanged', { 
        detail: { user: null, isAuthenticated: false } 
      }));

      console.log('[GoogleAuth] Signed out successfully');
    } catch (error) {
      console.error('[GoogleAuth] Error signing out:', error);
    }
  }, []);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    if (!tokens?.refreshToken) return false;
    return refreshAccessToken(tokens.refreshToken);
  }, [tokens, refreshAccessToken]);

  // Request calendar access incrementally
  const requestCalendarAccess = useCallback(async (): Promise<boolean> => {
    if (hasCalendarAccess) return true;

    try {
      console.log('[GoogleAuth] Requesting calendar access...');
      
      if (Capacitor.isNativePlatform()) {
        const result = await SocialLogin.login({
          provider: 'google',
          options: {
            scopes: [...INITIAL_SCOPES, ...CALENDAR_SCOPES],
          },
        });

        if (result?.result && isOnlineResponse(result.result)) {
          const accessToken = result.result.accessToken?.token;
          const idToken = result.result.idToken;

          if (accessToken && idToken) {
            const newTokens: GoogleAuthTokens = {
              ...tokens!,
              accessToken,
              idToken,
              expiresAt: Date.now() + (3600 * 1000),
            };

            setTokens(newTokens);
            await setSetting(STORAGE_KEYS.TOKENS, newTokens);
            setHasCalendarAccess(true);
            await setSetting(STORAGE_KEYS.CALENDAR_ACCESS, true);

            console.log('[GoogleAuth] Calendar access granted');
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[GoogleAuth] Error requesting calendar access:', error);
      return false;
    }
  }, [hasCalendarAccess, tokens]);

  const isAuthenticated = !!user && !!tokens?.idToken;

  const value: GoogleAuthContextType = {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    isRestoring,
    hasCalendarAccess,
    signIn,
    signOut,
    refreshTokens,
    requestCalendarAccess,
  };

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  );
};

export const useGoogleAuth = (): GoogleAuthContextType => {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    console.warn('[GoogleAuth] useGoogleAuth called outside provider, returning safe default');
    return {
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,
      isRestoring: false,
      hasCalendarAccess: false,
      signIn: async () => false,
      signOut: async () => {},
      refreshTokens: async () => false,
      requestCalendarAccess: async () => false,
    };
  }
  return context;
};

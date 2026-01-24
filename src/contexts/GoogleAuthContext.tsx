import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
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
  idToken?: string;
  expiresAt?: number;
}

interface GoogleAuthContextType {
  user: GoogleUser | null;
  tokens: GoogleAuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoring: boolean;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

// Web Client ID (required for OAuth)
const GOOGLE_WEB_CLIENT_ID = '52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com';

// Scopes for Google APIs
const SCOPES = [
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendars',
].join(' ');

const STORAGE_KEYS = {
  USER: 'google_user',
  TOKENS: 'google_tokens',
  PKCE_VERIFIER: 'google_pkce_verifier',
};

// Custom URL scheme for deep linking (matches capacitor.config.ts appId)
const APP_SCHEME = 'nota.npd.com';

// Generate PKCE code verifier and challenge
const generatePKCE = async () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return { verifier, challenge };
};

export const GoogleAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [tokens, setTokens] = useState<GoogleAuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const changeListenerCleanup = useRef<(() => void) | null>(null);
  const signInResolver = useRef<((value: boolean) => void) | null>(null);

  // Refresh access token
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
      console.error('Error refreshing token:', error);
      return false;
    }
  }, []);

  // Start background sync when we have valid tokens
  const startBackgroundSync = useCallback(async (accessToken: string) => {
    console.log('[GoogleAuth] Starting background sync...');
    
    // Stop any existing sync
    stopAutoSync();
    stopCalendarAutoSync();
    if (changeListenerCleanup.current) {
      changeListenerCleanup.current();
    }
    
    // Start 1-minute auto-sync for Drive backup
    startAutoSync(accessToken, 1);
    
    // Set up real-time change listeners
    changeListenerCleanup.current = setupChangeListeners(accessToken);
    
    // Start Calendar bidirectional sync (5-min interval + instant on task change)
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

  // Auto-restore data from Google Drive after login
  const restoreFromCloud = useCallback(async (accessToken: string) => {
    try {
      setIsRestoring(true);
      console.log('[GoogleAuth] Checking for cloud backup...');
      
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
          } else {
            console.warn('[GoogleAuth] Failed to restore data');
          }
        }
      } else {
        console.log('[GoogleAuth] No cloud backup found, uploading local data...');
        const localData = await syncManager.collectBackupData();
        await syncManager.uploadBackup(localData);
      }
      
      // Start background sync after restore
      startBackgroundSync(accessToken);
    } catch (error) {
      console.error('[GoogleAuth] Error restoring from cloud:', error);
    } finally {
      setIsRestoring(false);
    }
  }, [startBackgroundSync]);

  // Handle OAuth callback - now handles authorization code exchange
  const handleOAuthCallback = useCallback(async (url: string): Promise<boolean> => {
    try {
      const urlObj = new URL(url);
      
      // Check for authorization code in query params (code flow)
      const code = urlObj.searchParams.get('code');
      const error = urlObj.searchParams.get('error');
      const state = urlObj.searchParams.get('state');
      
      // Also check hash for implicit flow fallback (web)
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      const accessTokenFromHash = hashParams.get('access_token');
      
      if (error) {
        console.error('[GoogleAuth] OAuth error:', error);
        return false;
      }
      
      // Verify state
      const savedState = sessionStorage.getItem('google_oauth_state');
      if (state && savedState && state !== savedState) {
        console.error('[GoogleAuth] State mismatch');
        return false;
      }
      
      let accessToken: string | null = null;
      let refreshToken: string | undefined;
      let expiresIn: number = 3600;
      
      if (code) {
        // Authorization code flow - exchange code for tokens
        const verifier = await getSetting<string>(STORAGE_KEYS.PKCE_VERIFIER, '');
        
        // Determine redirect URI based on platform
        const redirectUri = Capacitor.isNativePlatform() 
          ? `${APP_SCHEME}://oauth/callback`
          : window.location.origin + '/auth/callback';
        
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_WEB_CLIENT_ID,
            code,
            code_verifier: verifier,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        });
        
        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          console.error('[GoogleAuth] Token exchange failed:', errorData);
          return false;
        }
        
        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token;
        expiresIn = tokenData.expires_in || 3600;
        
        // Clean up PKCE verifier
        await removeSetting(STORAGE_KEYS.PKCE_VERIFIER);
      } else if (accessTokenFromHash) {
        // Implicit flow fallback (web popup)
        accessToken = accessTokenFromHash;
        expiresIn = parseInt(hashParams.get('expires_in') || '3600');
      }
      
      if (!accessToken) {
        console.error('[GoogleAuth] No access token received');
        return false;
      }
      
      // Fetch user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (!userResponse.ok) {
        console.error('[GoogleAuth] Failed to fetch user info');
        return false;
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
        refreshToken,
        expiresAt: Date.now() + (expiresIn * 1000),
      };

      setUser(googleUser);
      setTokens(googleTokens);
      await setSetting(STORAGE_KEYS.USER, googleUser);
      await setSetting(STORAGE_KEYS.TOKENS, googleTokens);

      // Auto-restore data from cloud after login
      restoreFromCloud(accessToken);
      
      return true;
    } catch (error) {
      console.error('[GoogleAuth] Error handling OAuth callback:', error);
      return false;
    }
  }, [restoreFromCloud]);

  // Load saved auth state on mount and set up deep link listener
  useEffect(() => {
    let isMounted = true;
    let appUrlListener: any = null;
    
    const loadAuthState = async () => {
      try {
        console.log('[GoogleAuth] Loading saved auth state...');
        const savedUser = await getSetting<GoogleUser | null>(STORAGE_KEYS.USER, null);
        const savedTokens = await getSetting<GoogleAuthTokens | null>(STORAGE_KEYS.TOKENS, null);
        
        if (!isMounted) return;
        
        if (savedUser && savedTokens) {
          console.log('[GoogleAuth] Found saved credentials for:', savedUser.email);
          
          // Check if token is still valid (with 5 min buffer)
          const bufferTime = 5 * 60 * 1000; // 5 minutes
          const isTokenValid = savedTokens.expiresAt && (savedTokens.expiresAt - bufferTime) > Date.now();
          
          if (isTokenValid) {
            console.log('[GoogleAuth] Token still valid, restoring session...');
            setUser(savedUser);
            setTokens(savedTokens);
            
            // Start background sync with existing valid token
            if (savedTokens.accessToken) {
              console.log('[GoogleAuth] Resuming background sync with saved token...');
              startBackgroundSync(savedTokens.accessToken);
            }
          } else if (savedTokens.refreshToken) {
            // Try to refresh the token
            console.log('[GoogleAuth] Token expired, refreshing...');
            const refreshed = await refreshAccessToken(savedTokens.refreshToken);
            if (refreshed && isMounted) {
              // Get the new tokens after refresh
              const newTokens = await getSetting<GoogleAuthTokens | null>(STORAGE_KEYS.TOKENS, null);
              setUser(savedUser);
              if (newTokens?.accessToken) {
                setTokens(newTokens);
                console.log('[GoogleAuth] Session restored with refreshed token');
                startBackgroundSync(newTokens.accessToken);
              }
            } else {
              console.log('[GoogleAuth] Token refresh failed, user needs to sign in again');
            }
          } else {
            console.log('[GoogleAuth] No refresh token available, clearing stale session');
            // Clear stale data
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

    // Set up deep link listener for native platforms
    const setupDeepLinkListener = async () => {
      if (Capacitor.isNativePlatform()) {
        appUrlListener = await App.addListener('appUrlOpen', async (event) => {
          console.log('[GoogleAuth] Deep link received:', event.url);
          
          // Check if this is an OAuth callback
          if (event.url.includes('access_token') || event.url.includes('error')) {
            // Close the browser
            try {
              await Browser.close();
            } catch {
              // Browser might already be closed
            }
            
            const success = await handleOAuthCallback(event.url);
            
            // Resolve the pending sign-in promise
            if (signInResolver.current) {
              signInResolver.current(success);
              signInResolver.current = null;
            }
          }
        });
      }
    };

    loadAuthState();
    setupDeepLinkListener();
    
    // Cleanup on unmount
    return () => {
      isMounted = false;
      stopAutoSync();
      if (changeListenerCleanup.current) {
        changeListenerCleanup.current();
      }
      if (appUrlListener) {
        appUrlListener.remove();
      }
    };
  }, [startBackgroundSync, refreshAccessToken, handleOAuthCallback]);

  const signIn = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const state = Math.random().toString(36).substring(7);
      sessionStorage.setItem('google_oauth_state', state);
      
      // Generate PKCE challenge
      const { verifier, challenge } = await generatePKCE();
      await setSetting(STORAGE_KEYS.PKCE_VERIFIER, verifier);
      
      if (Capacitor.isNativePlatform()) {
        // Use authorization code flow with PKCE for native platforms
        const redirectUri = `${APP_SCHEME}://oauth/callback`;
        
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_WEB_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', SCOPES);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', challenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');

        // Open OAuth URL in in-app browser
        await Browser.open({ 
          url: authUrl.toString(),
          presentationStyle: 'popover',
        });
        
        // Return a promise that resolves when we get the deep link callback
        return new Promise((resolve) => {
          signInResolver.current = resolve;
          
          // Timeout after 5 minutes
          setTimeout(() => {
            if (signInResolver.current) {
              signInResolver.current(false);
              signInResolver.current = null;
            }
          }, 5 * 60 * 1000);
        });
      } else {
        // Web OAuth flow using popup
        const redirectUri = window.location.origin + '/auth/callback';
        
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_WEB_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'token');
        authUrl.searchParams.set('scope', SCOPES);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('prompt', 'select_account');

        const popup = window.open(authUrl.toString(), 'google-auth', 'width=500,height=600');
        
        return new Promise((resolve) => {
          const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            
            if (event.data?.type === 'google-auth-success') {
              window.removeEventListener('message', handleMessage);
              
              const { accessToken, expiresIn } = event.data;
              
              const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              
              if (userResponse.ok) {
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
                  expiresAt: Date.now() + (expiresIn * 1000),
                };

                setUser(googleUser);
                setTokens(googleTokens);
                await setSetting(STORAGE_KEYS.USER, googleUser);
                await setSetting(STORAGE_KEYS.TOKENS, googleTokens);

                // Auto-restore data from cloud after login
                if (accessToken) {
                  restoreFromCloud(accessToken);
                }

                resolve(true);
              } else {
                resolve(false);
              }
            } else if (event.data?.type === 'google-auth-error') {
              window.removeEventListener('message', handleMessage);
              resolve(false);
            }
          };

          window.addEventListener('message', handleMessage);

          const checkClosed = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkClosed);
              window.removeEventListener('message', handleMessage);
              setIsLoading(false);
              resolve(false);
            }
          }, 1000);
        });
      }
    } catch (error) {
      console.error('[GoogleAuth] Sign-in error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [restoreFromCloud]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      // Stop all background sync
      stopAutoSync();
      stopCalendarAutoSync();
      if (changeListenerCleanup.current) {
        changeListenerCleanup.current();
        changeListenerCleanup.current = null;
      }

      // Revoke token if we have one
      if (tokens?.accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.accessToken}`, {
          method: 'POST',
        }).catch(() => {});
      }

      setUser(null);
      setTokens(null);
      await removeSetting(STORAGE_KEYS.USER);
      await removeSetting(STORAGE_KEYS.TOKENS);
    } catch {
      // Silent error handling for sign-out
    }
  }, [tokens]);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    if (!tokens?.refreshToken) return false;
    return refreshAccessToken(tokens.refreshToken);
  }, [tokens, refreshAccessToken]);

  const value: GoogleAuthContextType = {
    user,
    tokens,
    isAuthenticated: !!user && !!tokens,
    isLoading,
    isRestoring,
    signIn,
    signOut,
    refreshTokens,
  };

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  );
};

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
};

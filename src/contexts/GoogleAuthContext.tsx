import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { SocialLogin } from '@capgo/capacitor-social-login';
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

// Web Client ID (required for OAuth)
const GOOGLE_WEB_CLIENT_ID = '52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com';

// INITIAL SCOPES - Minimal for login (NO calendar scopes)
// ID Token is guaranteed via 'openid' scope
const INITIAL_SCOPES = [
  'openid', // Required for ID Token
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.appdata', // For cloud sync
];

// CALENDAR SCOPES - Requested incrementally when user enables calendar features
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendars',
];

const STORAGE_KEYS_CALENDAR_ACCESS = 'google_calendar_access_granted';

const STORAGE_KEYS = {
  USER: 'google_user',
  TOKENS: 'google_tokens',
  PKCE_VERIFIER: 'google_pkce_verifier',
  CALENDAR_ACCESS: 'google_calendar_access_granted',
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

// Initialize the SocialLogin plugin
let socialLoginInitialized = false;
const initializeSocialLogin = async () => {
  if (socialLoginInitialized) return;
  
  try {
    if (Capacitor.isNativePlatform()) {
      await SocialLogin.initialize({
        google: {
          webClientId: GOOGLE_WEB_CLIENT_ID,
          mode: 'online',
        },
      });
      socialLoginInitialized = true;
      console.log('[GoogleAuth] SocialLogin plugin initialized');
    }
  } catch (error) {
    console.error('[GoogleAuth] Failed to initialize SocialLogin:', error);
  }
};

export const GoogleAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [tokens, setTokens] = useState<GoogleAuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const changeListenerCleanup = useRef<(() => void) | null>(null);
  const signInResolver = useRef<((value: boolean) => void) | null>(null);

  // Load calendar access state on mount
  useEffect(() => {
    getSetting<boolean>(STORAGE_KEYS.CALENDAR_ACCESS, false).then(setHasCalendarAccess);
  }, []);

  // Initialize plugin on mount
  useEffect(() => {
    initializeSocialLogin();
  }, []);

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

  // Auto-restore data from Google Drive after login (non-blocking)
  const restoreFromCloud = useCallback((accessToken: string) => {
    // Run restore in the background without blocking UI
    // Use setTimeout to ensure UI updates first
    setTimeout(async () => {
      try {
        setIsRestoring(true);
        console.log('[GoogleAuth] Checking for cloud backup (background)...');
        
        const syncManager = getGoogleDriveSyncManager(accessToken);
        
        // Start background sync immediately (don't wait for restore)
        startBackgroundSync(accessToken);
        
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
      } catch (error) {
        console.error('[GoogleAuth] Error restoring from cloud:', error);
      } finally {
        setIsRestoring(false);
      }
    }, 0);
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
      let idToken: string | null = null;
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
        idToken = tokenData.id_token;
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

      // CRITICAL: ID Token is REQUIRED for authentication
      if (!idToken) {
        console.error('[GoogleAuth] CRITICAL: ID Token is missing from OAuth callback!');
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
        idToken, // REQUIRED - guaranteed non-null (checked above)
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

    // Set up deep link listener for native platforms (fallback for web OAuth)
    const setupDeepLinkListener = async () => {
      if (Capacitor.isNativePlatform()) {
        appUrlListener = await App.addListener('appUrlOpen', async (event) => {
          console.log('[GoogleAuth] Deep link received:', event.url);
          
          // Check if this is an OAuth callback
          const isOAuthCallback = event.url.includes('oauth/callback') || 
                                   event.url.includes('code=') || 
                                   event.url.includes('access_token') || 
                                   event.url.includes('error=');
          
          if (isOAuthCallback) {
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
      // Use Capgo SocialLogin plugin for native platforms
      if (Capacitor.isNativePlatform()) {
        console.log('[GoogleAuth] Using Capgo SocialLogin plugin...');
        
        try {
          // Ensure plugin is initialized
          await initializeSocialLogin();
          
          const result = await SocialLogin.login({
            provider: 'google',
            options: {
              scopes: INITIAL_SCOPES,
            },
          });
          
          console.log('[GoogleAuth] SocialLogin result:', JSON.stringify(result, null, 2));
          
          if (result?.provider === 'google' && result.result) {
            const loginResult = result.result as any;
            
            // Handle various response types from the plugin
            // The plugin may return data in different structures depending on Android/iOS
            let profile: any = null;
            let accessToken: string | null = null;
            let idToken: string | null = null;
            let expiresAt: number = Date.now() + 3600000;
            
            // Check for online response type
            if (loginResult.responseType === 'online' || loginResult.profile) {
              profile = loginResult.profile;
              accessToken = loginResult.accessToken?.token || loginResult.accessToken;
              idToken = loginResult.idToken;
              
              if (loginResult.accessToken?.expires) {
                expiresAt = new Date(loginResult.accessToken.expires).getTime();
              }
            }
            
            // Fallback: check for direct credential structure (some Android responses)
            if (!profile && loginResult.credential) {
              profile = loginResult.credential;
              accessToken = loginResult.credential?.accessToken || loginResult.accessToken?.token;
              idToken = loginResult.credential?.idToken || loginResult.idToken;
            }
            
            // Another fallback: the result itself might be the profile
            if (!profile && (loginResult.email || loginResult.id || loginResult.sub)) {
              profile = loginResult;
              accessToken = loginResult.accessToken?.token || loginResult.accessToken;
              idToken = loginResult.idToken;
            }
            
            console.log('[GoogleAuth] Parsed profile:', profile);
            console.log('[GoogleAuth] Access token exists:', !!accessToken);
            console.log('[GoogleAuth] ID token exists:', !!idToken);
            
            // CRITICAL: ID Token is REQUIRED for authentication
            // ID Token is the only valid proof of Google identity
            if (!idToken) {
              console.error('[GoogleAuth] CRITICAL: ID Token is missing! Sign-in cannot be considered successful without ID Token.');
              console.error('[GoogleAuth] This may indicate a configuration issue with the native plugin or Google Cloud Console setup.');
              setIsLoading(false);
              return false;
            }
            
            if (profile && accessToken) {
              // Map profile fields - handle different field names from different Android SDK versions
              const googleUser: GoogleUser = {
                id: profile.id || profile.sub || profile.userId || profile.email || '',
                email: profile.email || '',
                name: profile.name || profile.displayName || `${profile.givenName || ''} ${profile.familyName || ''}`.trim() || profile.email?.split('@')[0] || '',
                givenName: profile.givenName || profile.given_name || undefined,
                familyName: profile.familyName || profile.family_name || undefined,
                imageUrl: profile.imageUrl || profile.picture || profile.photoUrl || undefined,
              };
              
              console.log('[GoogleAuth] Mapped user:', googleUser);
              
              // ID Token is guaranteed to exist at this point (checked above)
              const googleTokens: GoogleAuthTokens = {
                accessToken: accessToken,
                refreshToken: undefined, // Not available in online mode
                idToken: idToken, // REQUIRED - guaranteed non-null
                expiresAt: expiresAt,
              };
              
              // Set user and tokens immediately for instant UI update
              setUser(googleUser);
              setTokens(googleTokens);
              
              // Set loading to false IMMEDIATELY for instant UI feedback
              setIsLoading(false);
              
              console.log('[GoogleAuth] Sign-in successful - UI updated immediately');
              
              // Save to storage and restore from cloud in background (non-blocking)
              Promise.all([
                setSetting(STORAGE_KEYS.USER, googleUser),
                setSetting(STORAGE_KEYS.TOKENS, googleTokens),
              ]).then(() => {
                console.log('[GoogleAuth] User and tokens saved to storage');
                // Start cloud restore in background
                if (googleTokens.accessToken) {
                  restoreFromCloud(googleTokens.accessToken);
                }
              }).catch(error => {
                console.error('[GoogleAuth] Error saving to storage:', error);
              });
              
              return true;
            } else {
              console.error('[GoogleAuth] Missing profile or accessToken:', { hasProfile: !!profile, hasToken: !!accessToken });
            }
          }
          
          console.error('[GoogleAuth] SocialLogin failed: Invalid result');
          setIsLoading(false);
          return false;
        } catch (pluginError: any) {
          console.error('[GoogleAuth] SocialLogin plugin error:', pluginError);
          
          // Check if user cancelled
          if (pluginError?.message?.includes('cancel') || pluginError?.code === 'USER_CANCELLED') {
            console.log('[GoogleAuth] User cancelled sign-in');
            setIsLoading(false);
            return false;
          }
          
          // For other errors on native, show error instead of falling back to browser
          // Browser fallback causes the "Access blocked" error
          console.error('[GoogleAuth] Native sign-in failed. Make sure MainActivity.java implements ModifiedMainActivityForSocialLoginPlugin');
          setIsLoading(false);
          return false;
        }
      }
      
      // Web OAuth flow or fallback for native
      const state = Math.random().toString(36).substring(7);
      sessionStorage.setItem('google_oauth_state', state);
      
      // Generate PKCE challenge
      const { verifier, challenge } = await generatePKCE();
      await setSetting(STORAGE_KEYS.PKCE_VERIFIER, verifier);
      
      if (Capacitor.isNativePlatform()) {
        // Use authorization code flow with PKCE for native platforms (Browser plugin fallback)
        const redirectUri = `${APP_SCHEME}://oauth/callback`;
        
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_WEB_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', INITIAL_SCOPES.join(' '));
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', challenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');

        console.log('[GoogleAuth] Opening OAuth URL in browser (fallback)...');
        await Browser.open({ 
          url: authUrl.toString(),
          presentationStyle: 'popover',
          windowName: '_blank',
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
        // Web OAuth flow using authorization code flow (required for ID token)
        const redirectUri = window.location.origin + '/auth/callback';
        
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_WEB_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code'); // Changed from 'token' to get id_token
        authUrl.searchParams.set('scope', INITIAL_SCOPES.join(' '));
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', challenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');

        // Navigate in same window for web (will redirect back via /auth/callback)
        window.location.href = authUrl.toString();
        
        // Return a promise that never resolves (page will navigate away)
        return new Promise(() => {});
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

      // Use Capgo SocialLogin for logout on native
      if (Capacitor.isNativePlatform()) {
        try {
          console.log('[GoogleAuth] Using SocialLogin logout...');
          await SocialLogin.logout({ provider: 'google' });
        } catch (error) {
          console.warn('[GoogleAuth] SocialLogin logout error:', error);
        }
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

  // Request calendar access incrementally (when user enables calendar features)
  const requestCalendarAccess = useCallback(async (): Promise<boolean> => {
    if (!tokens?.accessToken) {
      console.error('[GoogleAuth] Cannot request calendar access: not authenticated');
      return false;
    }

    try {
      console.log('[GoogleAuth] Requesting incremental calendar access...');
      
      if (Capacitor.isNativePlatform()) {
        // Native: Use SocialLogin with calendar scopes
        await initializeSocialLogin();
        
        const result = await SocialLogin.login({
          provider: 'google',
          options: {
            scopes: [...INITIAL_SCOPES, ...CALENDAR_SCOPES],
          },
        });
        
        console.log('[GoogleAuth] Calendar access result:', JSON.stringify(result, null, 2));
        
        if (result?.provider === 'google' && result.result) {
          const loginResult = result.result as any;
          
          // Extract tokens from the response
          let newAccessToken: string | null = null;
          let newIdToken: string | null = null;
          
          if (loginResult.responseType === 'online' || loginResult.profile) {
            newAccessToken = loginResult.accessToken?.token || loginResult.accessToken;
            newIdToken = loginResult.idToken;
          } else if (loginResult.credential) {
            newAccessToken = loginResult.credential?.accessToken || loginResult.accessToken?.token;
            newIdToken = loginResult.credential?.idToken || loginResult.idToken;
          } else {
            newAccessToken = loginResult.accessToken?.token || loginResult.accessToken;
            newIdToken = loginResult.idToken;
          }
          
          if (newAccessToken && newIdToken) {
            // Update tokens with new scopes
            const updatedTokens: GoogleAuthTokens = {
              ...tokens,
              accessToken: newAccessToken,
              idToken: newIdToken,
            };
            
            setTokens(updatedTokens);
            await setSetting(STORAGE_KEYS.TOKENS, updatedTokens);
            setHasCalendarAccess(true);
            await setSetting(STORAGE_KEYS.CALENDAR_ACCESS, true);
            
            console.log('[GoogleAuth] Calendar access granted successfully');
            return true;
          }
        }
        
        console.error('[GoogleAuth] Failed to get calendar access');
        return false;
      } else {
        // Web: Redirect with incremental scopes
        const state = Math.random().toString(36).substring(7);
        sessionStorage.setItem('google_oauth_state', state);
        sessionStorage.setItem('google_calendar_request', 'true');
        
        const { verifier, challenge } = await generatePKCE();
        await setSetting(STORAGE_KEYS.PKCE_VERIFIER, verifier);
        
        const redirectUri = window.location.origin + '/auth/callback';
        const allScopes = [...INITIAL_SCOPES, ...CALENDAR_SCOPES];
        
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_WEB_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', allScopes.join(' '));
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', challenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('include_granted_scopes', 'true'); // Incremental auth
        
        window.location.href = authUrl.toString();
        return true; // Will redirect
      }
    } catch (error) {
      console.error('[GoogleAuth] Error requesting calendar access:', error);
      return false;
    }
  }, [tokens]);

  const value: GoogleAuthContextType = {
    user,
    tokens,
    isAuthenticated: !!user && !!tokens,
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
    // Return a safe default during initial render or HMR
    console.warn('[GoogleAuth] Context not available, returning default state');
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

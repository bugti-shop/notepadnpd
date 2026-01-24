import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// OAuth callback handler for web-based Google sign in
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Parse the hash fragment for OAuth response
    const hash = location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    const error = params.get('error');
    const state = params.get('state');

    // Verify state to prevent CSRF
    const savedState = sessionStorage.getItem('google_oauth_state');
    
    if (error) {
      // Send error to parent window
      if (window.opener) {
        window.opener.postMessage({ type: 'google-auth-error', error }, window.location.origin);
        window.close();
      } else {
        navigate('/', { replace: true });
      }
      return;
    }

    if (accessToken && state === savedState) {
      sessionStorage.removeItem('google_oauth_state');
      
      // Send success to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'google-auth-success',
          accessToken,
          expiresIn: parseInt(expiresIn || '3600'),
        }, window.location.origin);
        window.close();
      } else {
        // Direct navigation (not popup)
        navigate('/', { replace: true });
      }
    } else {
      // Invalid or missing token
      if (window.opener) {
        window.opener.postMessage({ type: 'google-auth-error', error: 'Invalid token' }, window.location.origin);
        window.close();
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;

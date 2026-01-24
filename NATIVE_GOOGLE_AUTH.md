# Native Google Sign-In Implementation Guide

This guide explains how to implement the native Android side of the Google Sign-In bridge for the NPD app.

## Overview

The app uses a JavaScript bridge pattern to communicate between the WebView (Capacitor) and native Android code. This allows for a seamless Google Sign-In experience without relying on third-party Capacitor plugins.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WebView (Capacitor)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           GoogleAuthContext.tsx                      │    │
│  │   - Checks if NativeAuthBridge is available          │    │
│  │   - Calls window.NativeAuthBridge.signIn()           │    │
│  │   - Receives callback via window.onNativeAuthResult  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ JavaScript Interface
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Native Android Code                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           NativeAuthBridge.kt                        │    │
│  │   - Exposes signIn(), signOut(), isSignedIn()        │    │
│  │   - Uses Google Sign-In SDK                          │    │
│  │   - Calls JavaScript callback with result            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Android Implementation

### Step 1: Add Google Sign-In SDK

Add to your `android/app/build.gradle`:

```gradle
dependencies {
    // Google Sign-In
    implementation 'com.google.android.gms:play-services-auth:21.0.0'
    
    // For credential management (optional, for newer API)
    implementation 'androidx.credentials:credentials:1.3.0'
    implementation 'androidx.credentials:credentials-play-services-auth:1.3.0'
    implementation 'com.google.android.libraries.identity.googleid:googleid:1.1.1'
}
```

### Step 2: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Create an **OAuth 2.0 Client ID** for Android:
   - Application type: Android
   - Package name: `nota.npd.com`
   - SHA-1 certificate fingerprint: Get this by running:
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
5. Also ensure you have a **Web Client ID** (the one already in the app: `52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90`)

### Step 3: Create the Native Bridge

Create `android/app/src/main/java/nota/npd/com/NativeAuthBridge.java`:

```java
package nota.npd.com;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Task;

import org.json.JSONException;
import org.json.JSONObject;

public class NativeAuthBridge {
    private static final String TAG = "NativeAuthBridge";
    public static final int RC_SIGN_IN = 9001;
    
    // Your Web Client ID (same as in the TypeScript code)
    private static final String WEB_CLIENT_ID = "52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com";

    private final Activity activity;
    private final WebView webView;
    private final GoogleSignInClient googleSignInClient;

    public NativeAuthBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(WEB_CLIENT_ID)
                .requestServerAuthCode(WEB_CLIENT_ID)
                .requestEmail()
                .requestProfile()
                .requestScopes(
                        new Scope("https://www.googleapis.com/auth/drive.appdata"),
                        new Scope("https://www.googleapis.com/auth/calendar.events"),
                        new Scope("https://www.googleapis.com/auth/calendar.calendars")
                )
                .build();

        googleSignInClient = GoogleSignIn.getClient(activity, gso);
    }

    @JavascriptInterface
    public void signIn() {
        Log.d(TAG, "signIn() called");
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Intent signInIntent = googleSignInClient.getSignInIntent();
                activity.startActivityForResult(signInIntent, RC_SIGN_IN);
            }
        });
    }

    @JavascriptInterface
    public void signOut() {
        Log.d(TAG, "signOut() called");
        googleSignInClient.signOut().addOnCompleteListener(task -> {
            boolean success = task.isSuccessful();
            Log.d(TAG, "signOut completed: " + success);
            callJavaScript("window.onNativeSignOutResult && window.onNativeSignOutResult(" + success + ")");
        });
    }

    @JavascriptInterface
    public boolean isSignedIn() {
        GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(activity);
        return account != null && !account.isExpired();
    }

    @JavascriptInterface
    public String getLastUser() {
        GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(activity);
        if (account != null) {
            return accountToJson(account);
        }
        return null;
    }

    // Called from MainActivity when sign-in activity returns
    public void handleSignInResult(Intent data) {
        try {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            GoogleSignInAccount account = task.getResult(ApiException.class);
            
            Log.d(TAG, "Sign-in successful: " + account.getEmail());
            
            // Create result JSON
            String userJson = accountToJson(account);
            JSONObject resultJson = new JSONObject();
            try {
                resultJson.put("success", true);
                resultJson.put("user", new JSONObject(userJson));
                resultJson.put("accessToken", ""); // Will be exchanged from serverAuthCode
                resultJson.put("serverAuthCode", account.getServerAuthCode() != null ? account.getServerAuthCode() : "");
            } catch (JSONException e) {
                Log.e(TAG, "JSON error", e);
            }
            
            callJavaScript("window.onNativeAuthResult && window.onNativeAuthResult(" + resultJson.toString() + ")");
            
        } catch (ApiException e) {
            Log.e(TAG, "Sign-in failed: " + e.getStatusCode(), e);
            JSONObject errorJson = new JSONObject();
            try {
                errorJson.put("success", false);
                errorJson.put("error", "Sign-in failed: " + e.getStatusCode());
            } catch (JSONException jsonEx) {
                Log.e(TAG, "JSON error", jsonEx);
            }
            callJavaScript("window.onNativeAuthResult && window.onNativeAuthResult(" + errorJson.toString() + ")");
        }
    }

    private String accountToJson(GoogleSignInAccount account) {
        JSONObject json = new JSONObject();
        try {
            json.put("id", account.getId() != null ? account.getId() : "");
            json.put("email", account.getEmail() != null ? account.getEmail() : "");
            json.put("displayName", account.getDisplayName() != null ? account.getDisplayName() : "");
            json.put("givenName", account.getGivenName() != null ? account.getGivenName() : "");
            json.put("familyName", account.getFamilyName() != null ? account.getFamilyName() : "");
            json.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "");
            json.put("idToken", account.getIdToken() != null ? account.getIdToken() : "");
            json.put("serverAuthCode", account.getServerAuthCode() != null ? account.getServerAuthCode() : "");
        } catch (JSONException e) {
            Log.e(TAG, "JSON error", e);
        }
        return json.toString();
    }

    private void callJavaScript(final String script) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript(script, null);
            }
        });
    }
}
```

### Step 4: Register the Bridge in MainActivity

Modify `android/app/src/main/java/nota/npd/com/MainActivity.java`:

```java
package nota.npd.com;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private NativeAuthBridge nativeAuthBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Get the WebView from Capacitor bridge
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            // Add JavaScript interface
            nativeAuthBridge = new NativeAuthBridge(this, webView);
            webView.addJavascriptInterface(nativeAuthBridge, "NativeAuthBridge");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == NativeAuthBridge.RC_SIGN_IN && nativeAuthBridge != null) {
            nativeAuthBridge.handleSignInResult(data);
        }
    }
}
```

### Step 5: Exchange Server Auth Code for Tokens

The native sign-in returns a `serverAuthCode`. You need to exchange this for access/refresh tokens. This can be done:

**Option A: Client-side (in the WebView)**

The `NativeAuthBridge.ts` already has the `exchangeAuthCode` function. Update `GoogleAuthContext.tsx` to use it when `serverAuthCode` is present.

**Option B: Server-side (recommended for production)**

Create a backend endpoint that exchanges the auth code securely with Google's token endpoint using your client secret.

### Step 6: Update GoogleAuthContext to Exchange Auth Code

If using client-side exchange, modify the native sign-in handler in `GoogleAuthContext.tsx`:

```typescript
if (result.success && result.user) {
  // If we have a server auth code, exchange it for tokens
  let accessToken = result.accessToken || '';
  let refreshToken = result.refreshToken;
  let expiresIn = result.expiresIn;
  
  if (result.user.serverAuthCode && !accessToken) {
    const tokens = await exchangeAuthCode(
      result.user.serverAuthCode,
      GOOGLE_WEB_CLIENT_ID
    );
    if (tokens) {
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      expiresIn = tokens.expiresIn;
    }
  }
  
  // ... rest of the code
}
```

## Testing

1. Build and run the Android app:
   ```bash
   npm run build
   npx cap sync android
   npx cap run android
   ```

2. Check logs for debug output:
   ```bash
   adb logcat | grep NativeAuthBridge
   ```

3. Verify the JavaScript interface is registered by checking in browser devtools:
   ```javascript
   console.log(typeof window.NativeAuthBridge); // Should be "object"
   ```

## Troubleshooting

### "Sign-in failed: 10" (DEVELOPER_ERROR)

- SHA-1 fingerprint in Google Cloud Console doesn't match your signing key
- Package name mismatch
- Web Client ID not correctly configured

### "Sign-in failed: 12501" (SIGN_IN_CANCELLED)

- User cancelled the sign-in flow
- This is expected behavior, not an error

### JavaScript interface not available

- Check that `addJavascriptInterface` is called before page load
- Verify the WebView is the correct instance from Capacitor

### Tokens not exchanging

- Client-side exchange requires the auth code to be used immediately
- Server auth codes are single-use and expire quickly

## Security Considerations

1. **Never store client secrets in client-side code**
2. **Use server-side token exchange for production apps**
3. **Implement token refresh logic for long-lived sessions**
4. **Consider using Google Identity Services for newer implementations**

## Alternative: Google Identity Services (GIS)

For a more modern approach, consider using [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/overview). This library works directly in WebViews and doesn't require native code:

```html
<script src="https://accounts.google.com/gsi/client" async></script>
```

However, GIS has some limitations in WebView contexts and may require additional configuration.

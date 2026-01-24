# Cross-Platform Sync Guide

This guide covers setting up Google Drive sync across Web, Android, and iOS devices.

## Overview

The app uses Google Drive's `appDataFolder` for seamless cross-platform sync. Data syncs instantly when changes are made and automatically when the device comes back online.

## How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│    Web      │────▶│   Google Drive   │◀────│   Android   │
│   Browser   │◀────│  (appDataFolder) │────▶│     App     │
└─────────────┘     └──────────────────┘     └─────────────┘
                            ▲
                            │
                    ┌───────┴───────┐
                    │    iOS App    │
                    └───────────────┘
```

## Sync Features

| Feature | Description |
|---------|-------------|
| **Instant Sync** | Changes sync within 500ms when online |
| **Offline Support** | Changes queue and sync when back online |
| **Auto-Restore** | Data restores automatically on new device sign-in |
| **Conflict Resolution** | Newer data wins (timestamp-based) |
| **Background Sync** | 1-minute fallback sync interval |

## What Gets Synced

- ✅ Notes (content, formatting, attachments)
- ✅ Tasks (all properties, subtasks, attachments)
- ✅ Folders (notes and todo folders)
- ✅ Sections (task sections/groups)
- ✅ Settings (app preferences)
- ✅ Activity Log

## Platform Setup

### Web (No Setup Required)

Web works out of the box. Users sign in with Google and sync starts automatically.

### Android Setup

1. **Google Cloud Console Configuration:**
   - Create an **Android OAuth Client ID**
   - Package name: `app.lovable.c4920824037c4205bb9ed6cc0d5a0385`
   - Add SHA-1 fingerprint from your debug/release keystore

2. **Enable APIs:**
   - Google Drive API
   - Google Calendar API

3. **Build & Test:**
   ```bash
   git pull
   npx cap sync android
   npx cap run android
   ```

### iOS Setup

1. **Google Cloud Console Configuration:**
   - Create an **iOS OAuth Client ID**
   - Bundle ID: `app.lovable.c4920824037c4205bb9ed6cc0d5a0385`

2. **Update App Code:**
   In `src/contexts/GoogleAuthContext.tsx`:
   ```typescript
   const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
   ```

3. **Update Info.plist:**
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
       <dict>
           <key>CFBundleURLSchemes</key>
           <array>
               <string>com.googleusercontent.apps.YOUR_CLIENT_ID</string>
           </array>
       </dict>
   </array>
   ```

4. **Build & Test:**
   ```bash
   git pull
   npx cap sync ios
   npx cap run ios
   ```

## Google Cloud Console Setup

### Required OAuth Client IDs

| Platform | Type | Identifier |
|----------|------|------------|
| Web | Web application | Authorized JavaScript origins |
| Android | Android | Package name + SHA-1 fingerprint |
| iOS | iOS | Bundle ID |

### Required OAuth Scopes

Add these to your OAuth consent screen:

```
openid
email
profile
https://www.googleapis.com/auth/drive.appdata
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.calendars
```

### Required APIs

Enable these in the API Library:
- Google Drive API
- Google Calendar API
- Google People API (optional, for profile info)

## Troubleshooting

### Sync Not Working on Android

1. **Error 10 (Developer Error):**
   - SHA-1 fingerprint mismatch
   - Check that your keystore SHA-1 matches Google Cloud Console

2. **No Access Token:**
   - Ensure `mode: 'online'` is set in capacitor.config.ts
   - Check that scopes are properly requested

3. **Network Error:**
   - Check internet connection
   - Verify Google APIs are enabled

### Sync Not Working on iOS

1. **Cannot find provider 'google':**
   - Add iOS Client ID to GoogleAuthContext.tsx
   - Add URL scheme to Info.plist

2. **Redirect Not Working:**
   - Verify CFBundleURLSchemes matches your Reversed Client ID

### Data Not Appearing on Other Devices

1. Sign out and sign back in to trigger restore
2. Tap "Sync Now" button manually
3. Check that same Google account is used on all devices

## Technical Details

### Sync Flow

1. **On Data Change:**
   - Change event dispatched (`notesUpdated`, `tasksUpdated`, `foldersUpdated`)
   - 500ms debounce applied
   - Data uploaded to Google Drive appDataFolder

2. **On App Launch (Authenticated):**
   - Check for cloud backup
   - Compare timestamps
   - Restore if cloud is newer, upload if local is newer

3. **On Network Reconnect:**
   - Pending changes immediately synced
   - Conflict resolution applied

### Files

| File | Purpose |
|------|---------|
| `src/contexts/GoogleAuthContext.tsx` | Auth & token management |
| `src/utils/googleDriveSync.ts` | Sync logic & cloud operations |
| `src/components/SyncSettings.tsx` | Sync UI & controls |
| `capacitor.config.ts` | Plugin configuration |

## Security

- Uses `appDataFolder` - hidden folder only accessible by this app
- No data shared with other apps or users
- OAuth 2.0 with secure token refresh
- Tokens stored securely in device storage

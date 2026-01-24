# Android Setup Guide for Npd

This guide covers the required Android permissions and setup for push notifications, voice recording, and location-based reminders.
dependencies {
    implementation "com.android.billingclient:billing:7.1.1"
}
<item name="android:windowBackground">#3a6cc9</item>



## Prerequisites

1. Android Studio installed
2. Project exported to GitHub and cloned locally
3. Run `npm install` to install dependencies
4. Run `npx cap add android` to add Android platform
5. Run `npx cap sync` to sync the project

## Android Manifest Permissions

After running `npx cap add android`, you need to add the following permissions to your `android/app/src/main/AndroidManifest.xml` file:

### Required Permissions

Add these permissions inside the `<manifest>` tag, before `<application>`:

```xml
<!-- Push Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Voice Recording -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<!-- Local Notifications -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />

<!-- Location-Based Reminders -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Internet (usually already present) -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Storage for voice recordings -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

### Full AndroidManifest.xml Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Push Notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <!-- Voice Recording -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <!-- Local Notifications -->
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />

    <!-- Location-Based Reminders -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- Internet -->
    <uses-permission android:name="android.permission.INTERNET" />

    <!-- Storage -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        
        <!-- Foreground Service for Background Location -->
        <service
            android:name="com.transistorsoft.locationmanager.service.LocationService"
            android:foregroundServiceType="location"
            android:exported="false" />
        
        <!-- Your activities and other components here -->
        
    </application>

</manifest>
```

## Location-Based Reminders Setup

### Required Permissions Explained

| Permission | Purpose |
|------------|---------|
| `ACCESS_FINE_LOCATION` | High-accuracy GPS location for geofencing |
| `ACCESS_COARSE_LOCATION` | Network-based location (fallback) |
| `ACCESS_BACKGROUND_LOCATION` | Track location when app is in background |
| `FOREGROUND_SERVICE` | Run location service in foreground |
| `FOREGROUND_SERVICE_LOCATION` | Android 14+ requirement for location foreground service |
| `WAKE_LOCK` | Keep CPU awake for location updates |

### Background Location Permission (Android 10+)

Starting from Android 10 (API 29), background location access requires a separate permission. The app must:

1. First request `ACCESS_FINE_LOCATION` or `ACCESS_COARSE_LOCATION`
2. Then separately request `ACCESS_BACKGROUND_LOCATION`

**Important:** Google Play requires you to justify background location usage in your app listing.

### Android 11+ Background Location

On Android 11+, users must manually enable "Allow all the time" in Settings:
1. Go to Settings > Apps > Npd > Permissions > Location
2. Select "Allow all the time"

### Foreground Service Configuration (Android 14+)

For Android 14 (API 34)+, you must declare the foreground service type:

```xml
<service
    android:name="com.transistorsoft.locationmanager.service.LocationService"
    android:foregroundServiceType="location"
    android:exported="false" />
```

## Local Notifications Permissions (Detailed Guide)

### Android 13+ (API 33+) - POST_NOTIFICATIONS

Starting from Android 13, apps must request the `POST_NOTIFICATIONS` runtime permission to show notifications.

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

**Important:** This permission must be requested at runtime. The app handles this automatically when scheduling notifications.

### Exact Alarm Permissions (Android 12+)

For precise notification timing, exact alarm permissions are required:

```xml
<!-- For scheduling notifications at exact times -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />

<!-- Alternative for Android 14+ -->
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
```

**Note:** On Android 14+, users may need to manually grant exact alarm permission in Settings > Apps > Npd > Alarms & reminders.

### Boot Receiver for Persistent Notifications

To reschedule notifications after device reboot:

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

Add the boot receiver inside `<application>` tag:

```xml
<receiver android:name="com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver"
    android:exported="false">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
    </intent-filter>
</receiver>
```

### Vibration Permission

For haptic feedback on notifications:

```xml
<uses-permission android:name="android.permission.VIBRATE" />
```

## Push Notifications Setup

### Firebase Cloud Messaging (FCM) Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Add an Android app with your package name: `app.lovable.c4920824037c4205bb9ed6cc0d5a0385`
4. Download `google-services.json` and place it in `android/app/`
5. Add Firebase dependencies to `android/app/build.gradle`:

```gradle
dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.0.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

6. Add Google services plugin to `android/build.gradle`:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```

7. Apply plugin in `android/app/build.gradle`:

```gradle
apply plugin: 'com.google.gms.google-services'
```

## Voice Recording Setup

Voice recording uses the Web Audio API on the web and native permissions on Android. The `RECORD_AUDIO` permission is required.

### Runtime Permission Request

Android 6.0+ requires runtime permission requests. The app will automatically request microphone permission when the user tries to record.

## Local Notifications Configuration

Add the following to your `capacitor.config.ts`:

```typescript
plugins: {
  LocalNotifications: {
    smallIcon: "ic_stat_icon_config_sample",
    iconColor: "#488AFF",
    sound: "beep.wav",
  },
}
```

### Notification Icons

Create notification icons in multiple densities:
- `android/app/src/main/res/drawable-mdpi/ic_stat_icon_config_sample.png` (24x24)
- `android/app/src/main/res/drawable-hdpi/ic_stat_icon_config_sample.png` (36x36)
- `android/app/src/main/res/drawable-xhdpi/ic_stat_icon_config_sample.png` (48x48)
- `android/app/src/main/res/drawable-xxhdpi/ic_stat_icon_config_sample.png` (72x72)
- `android/app/src/main/res/drawable-xxxhdpi/ic_stat_icon_config_sample.png` (96x96)

### Custom Notification Sounds

Place custom sounds in:
- `android/app/src/main/res/raw/beep.wav`

## Building the App

1. Sync your project: `npx cap sync android`
2. Open in Android Studio: `npx cap open android`
3. Build and run from Android Studio

## Troubleshooting

### Location reminders not triggering in background

1. **Background Location Permission**: Ensure "Allow all the time" is selected
   - Go to Settings > Apps > Npd > Permissions > Location
   - Select "Allow all the time"

2. **Battery Optimization**: Disable battery optimization
   - Settings > Apps > Npd > Battery > Unrestricted

3. **Battery Saver Mode**: Disable battery saver or add app to exceptions

4. **Manufacturer-specific restrictions**: Some manufacturers (Xiaomi, Huawei, Samsung) have aggressive battery optimization. Search for "[manufacturer] background app restrictions" for device-specific instructions.

### Notifications not showing

1. **Android 13+**: Ensure `POST_NOTIFICATIONS` permission is granted
   - Go to Settings > Apps > Npd > Notifications > Enable
   
2. **Battery Optimization**: Disable battery optimization for the app
   - Settings > Apps > Npd > Battery > Unrestricted

3. **Do Not Disturb**: Check if DND mode is blocking notifications

### Exact Alarms not working (Android 14+)

1. Go to Settings > Apps > Npd > Alarms & reminders
2. Enable "Allow setting alarms and reminders"

### Voice recording not working

- Ensure `RECORD_AUDIO` permission is granted
- Check microphone is not being used by another app

### Push notifications not registering

- Verify `google-services.json` is in the correct location
- Check Firebase project configuration matches your app ID

### Notifications disappearing on reboot

- Ensure `RECEIVE_BOOT_COMPLETED` permission is added
- Add the boot receiver to AndroidManifest.xml

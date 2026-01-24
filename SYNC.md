# NPD App - Sync & Integration Implementation Guide

**Package Name:** `nota.npd.com`  
**Last Updated:** January 2026

---

## Quick Start Checklist

### ✅ Already Created (React/TypeScript - in this project)
These files already exist in the Lovable project:

| File | Location | Purpose |
|------|----------|---------|
| SyncBridgePlugin.ts | `src/plugins/SyncBridgePlugin.ts` | Capacitor plugin definition |
| useSyncBridge.ts | `src/hooks/useSyncBridge.ts` | React hook for sync operations |
| SyncSettings.tsx | `src/components/SyncSettings.tsx` | Settings UI component |
| SyncSettingsPage.tsx | `src/pages/SyncSettingsPage.tsx` | Dedicated settings page |

### 📋 To Create (Android Native - in Android Studio)
These files need to be created in the Android project after running `npx cap add android`:

---

## Step 1: Firebase Setup

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project: `npd-notes-app`
3. Enable: Authentication (Email/Google), Firestore Database, Cloud Storage

### 1.2 Download Config File
1. Project Settings → Add Android App
2. Package name: `nota.npd.com`
3. Download `google-services.json`
4. **Place in:** `android/app/google-services.json`

---

## Step 2: Android Gradle Configuration

### 2.1 Project-level build.gradle
**File:** `android/build.gradle`

Add to `buildscript.dependencies`:
```gradle
classpath 'com.google.gms:google-services:4.4.0'
```

### 2.2 App-level build.gradle  
**File:** `android/app/build.gradle`

Add plugin:
```gradle
plugins {
    id 'com.android.application'
    id 'com.google.gms.google-services'
}
```

Add dependencies:
```gradle
dependencies {
    // Firebase
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-auth'
    implementation 'com.google.firebase:firebase-firestore'
    implementation 'com.google.firebase:firebase-storage'
    
    // Google APIs
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
    implementation 'com.google.apis:google-api-services-calendar:v3-rev20231123-2.0.0'
    implementation 'com.google.api-client:google-api-client-android:2.2.0'
    
    // Utilities
    implementation 'androidx.work:work-runtime:2.9.0'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'com.google.code.gson:gson:2.10.1'
}
```

---

## Step 3: AndroidManifest Permissions

**File:** `android/app/src/main/AndroidManifest.xml`

Add permissions:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.READ_CALENDAR" />
<uses-permission android:name="android.permission.WRITE_CALENDAR" />
<uses-permission android:name="android.permission.GET_ACCOUNTS" />
```

---

## Step 4: Create Java Files

### Directory Structure to Create
```
android/app/src/main/java/nota/npd/com/
├── MainActivity.java          ← UPDATE (register plugin)
├── plugins/
│   └── SyncBridgePlugin.java  ← CREATE
├── sync/
│   └── CloudSyncManager.java  ← CREATE
├── calendar/
│   └── CalendarSyncManager.java ← CREATE
├── integrations/
│   ├── ClickUpIntegration.java  ← CREATE
│   ├── NotionIntegration.java   ← CREATE
│   └── HubSpotIntegration.java  ← CREATE
└── imports/
    ├── ImportedTask.java           ← CREATE
    ├── TickTickImportManager.java  ← CREATE
    ├── TodoistImportManager.java   ← CREATE
    ├── GoogleTasksImportManager.java ← CREATE
    ├── MicrosoftTodoImportManager.java ← CREATE
    └── AnyDoImportManager.java     ← CREATE
```

---

## Step 5: Core Files to Create

### 5.1 MainActivity.java (UPDATE)
**File:** `android/app/src/main/java/nota/npd/com/MainActivity.java`

```java
package nota.npd.com;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import nota.npd.com.plugins.SyncBridgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SyncBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

### 5.2 SyncBridgePlugin.java (CREATE)
**File:** `android/app/src/main/java/nota/npd/com/plugins/SyncBridgePlugin.java`

```java
package nota.npd.com.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import nota.npd.com.sync.CloudSyncManager;
import nota.npd.com.calendar.CalendarSyncManager;
import nota.npd.com.integrations.*;
import nota.npd.com.imports.*;

@CapacitorPlugin(name = "SyncBridge")
public class SyncBridgePlugin extends Plugin {

    private CloudSyncManager cloudSyncManager;
    private CalendarSyncManager calendarSyncManager;

    @Override
    public void load() {
        cloudSyncManager = CloudSyncManager.getInstance(getContext());
        calendarSyncManager = CalendarSyncManager.getInstance(getContext());
    }

    @PluginMethod
    public void getCloudSyncSettings(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", cloudSyncManager.isSyncEnabled());
        ret.put("autoSync", cloudSyncManager.isAutoSyncEnabled());
        ret.put("syncInterval", cloudSyncManager.getSyncInterval());
        ret.put("wifiOnly", cloudSyncManager.isWifiOnlyEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void setCloudSyncSettings(PluginCall call) {
        cloudSyncManager.setSyncEnabled(call.getBoolean("enabled", false));
        cloudSyncManager.setAutoSyncEnabled(call.getBoolean("autoSync", true));
        cloudSyncManager.setSyncInterval(call.getInt("syncInterval", 15));
        cloudSyncManager.setWifiOnlyEnabled(call.getBoolean("wifiOnly", false));
        call.resolve();
    }

    @PluginMethod
    public void syncNow(PluginCall call) {
        cloudSyncManager.syncAllData(success -> {
            JSObject ret = new JSObject();
            ret.put("success", success);
            ret.put("message", success ? "Sync completed" : "Sync failed");
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void isNativeAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }
    
    // Add more methods as needed for integrations and imports
}
```

### 5.3 CloudSyncManager.java (CREATE)
**File:** `android/app/src/main/java/nota/npd/com/sync/CloudSyncManager.java`

```java
package nota.npd.com.sync;

import android.content.Context;
import android.content.SharedPreferences;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;

public class CloudSyncManager {
    private static CloudSyncManager instance;
    private final SharedPreferences prefs;
    private final FirebaseFirestore db;
    private final FirebaseAuth auth;

    public interface SyncCallback {
        void onComplete(boolean success);
    }

    private CloudSyncManager(Context context) {
        prefs = context.getSharedPreferences("npd_sync", Context.MODE_PRIVATE);
        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();
    }

    public static synchronized CloudSyncManager getInstance(Context context) {
        if (instance == null) {
            instance = new CloudSyncManager(context.getApplicationContext());
        }
        return instance;
    }

    public boolean isSyncEnabled() {
        return prefs.getBoolean("sync_enabled", false);
    }

    public void setSyncEnabled(boolean enabled) {
        prefs.edit().putBoolean("sync_enabled", enabled).apply();
    }

    public boolean isAutoSyncEnabled() {
        return prefs.getBoolean("auto_sync", true);
    }

    public void setAutoSyncEnabled(boolean enabled) {
        prefs.edit().putBoolean("auto_sync", enabled).apply();
    }

    public int getSyncInterval() {
        return prefs.getInt("sync_interval", 15);
    }

    public void setSyncInterval(int minutes) {
        prefs.edit().putInt("sync_interval", minutes).apply();
    }

    public boolean isWifiOnlyEnabled() {
        return prefs.getBoolean("wifi_only", false);
    }

    public void setWifiOnlyEnabled(boolean enabled) {
        prefs.edit().putBoolean("wifi_only", enabled).apply();
    }

    public void syncAllData(SyncCallback callback) {
        // Implement Firebase sync logic here
        callback.onComplete(true);
    }
}
```

### 5.4 ImportedTask.java (CREATE)
**File:** `android/app/src/main/java/nota/npd/com/imports/ImportedTask.java`

```java
package nota.npd.com.imports;

public class ImportedTask {
    public String id;
    public String title;
    public String description;
    public String dueDate;
    public String priority;
    public boolean completed;
    public String source;
    public String sourceId;

    public ImportedTask(String id, String title, String source) {
        this.id = id;
        this.title = title;
        this.source = source;
    }
}
```

---

## Step 6: Integration Manager Templates

### Template for API-based Integration
Use this template for ClickUp, Notion, HubSpot, Todoist:

**File:** `android/app/src/main/java/nota/npd/com/integrations/[ServiceName]Integration.java`

```java
package nota.npd.com.integrations;

import android.content.Context;
import android.content.SharedPreferences;
import okhttp3.*;
import java.io.IOException;

public class [ServiceName]Integration {
    private static [ServiceName]Integration instance;
    private final SharedPreferences prefs;
    private final OkHttpClient client;
    private static final String API_BASE = "[API_URL]";

    private [ServiceName]Integration(Context context) {
        prefs = context.getSharedPreferences("npd_[service]", Context.MODE_PRIVATE);
        client = new OkHttpClient();
    }

    public static synchronized [ServiceName]Integration getInstance(Context context) {
        if (instance == null) {
            instance = new [ServiceName]Integration(context.getApplicationContext());
        }
        return instance;
    }

    public boolean saveApiToken(String token) {
        prefs.edit().putString("api_token", token).apply();
        return true;
    }

    public boolean isConnected() {
        return prefs.getString("api_token", null) != null;
    }

    public void disconnect() {
        prefs.edit().remove("api_token").apply();
    }
}
```

---

## API Access Information

| Service | Free Tier | API Token Location |
|---------|-----------|-------------------|
| **ClickUp** | ✅ FREE | Settings → Apps → API Token |
| **Notion** | ✅ FREE | notion.so/my-integrations |
| **HubSpot** | ✅ FREE | Settings → Integrations → Private Apps |
| **Todoist** | ✅ FREE | Settings → Integrations → Developer |
| **TickTick** | ✅ FREE | OAuth (developer.ticktick.com) |
| **Google Tasks** | ✅ FREE | Google Cloud Console OAuth |
| **Microsoft To Do** | ✅ FREE | Azure Portal OAuth |
| **Any.do** | ✅ FREE | JSON file export |

---

## Testing Checklist

1. [ ] Firebase project created and `google-services.json` added
2. [ ] Gradle files updated with dependencies
3. [ ] AndroidManifest permissions added
4. [ ] MainActivity updated to register SyncBridgePlugin
5. [ ] SyncBridgePlugin.java created
6. [ ] CloudSyncManager.java created
7. [ ] Run `npx cap sync android`
8. [ ] Build and test on device/emulator

---

## Commands Reference

```bash
# Add Android platform
npx cap add android

# Sync web assets to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Run on connected device
npx cap run android
```

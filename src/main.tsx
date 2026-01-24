import React, { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { migrateLocalStorageToIndexedDB } from "./utils/settingsStorage";
import { migrateNotesToIndexedDB } from "./utils/noteStorage";
import { startBackgroundScheduler } from "./utils/backgroundScheduler";
import { initializeTaskOrder } from "./utils/taskOrderStorage";
import { initializeNotificationHistory } from "./types/notificationHistory";
import { initializeProtectionSettings } from "./utils/noteProtection";

// Simple loading fallback for slow connections - inline styled for instant render
const LoadingFallback = () => (
  <div style={{
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--background, #ffffff)',
    color: 'var(--foreground, #000000)',
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      border: '4px solid currentColor',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Wrapper component that handles migration before rendering the app
const AppWithMigration = () => {
  const [isMigrated, setIsMigrated] = useState(false);

  useEffect(() => {
    const runMigrations = async () => {
      try {
        // Run migrations in parallel
        await Promise.all([
          migrateLocalStorageToIndexedDB(),
          migrateNotesToIndexedDB(),
          initializeTaskOrder(),
          initializeNotificationHistory(),
          initializeProtectionSettings(),
        ]);
        
        // Start background scheduler for automatic task rollovers
        startBackgroundScheduler();
      } catch (error) {
        console.error('Migration error:', error);
      }
      setIsMigrated(true);
    };
    runMigrations();
  }, []);

  if (!isMigrated) {
    return <LoadingFallback />;
  }

  return <App />;
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<LoadingFallback />}>
      <AppWithMigration />
    </Suspense>
  </React.StrictMode>
);

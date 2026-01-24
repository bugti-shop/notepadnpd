import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WelcomeProvider, useWelcome } from "@/contexts/WelcomeContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import { GoogleAuthProvider } from "@/contexts/GoogleAuthContext";
import OnboardingFlow from "@/components/OnboardingFlow";
import { NavigationLoader } from "@/components/NavigationLoader";
import Index from "./pages/Index";
import Notes from "./pages/Notes";
import NotesCalendar from "./pages/NotesCalendar";
import WebClipper from "./pages/WebClipper";
import Settings from "./pages/Settings";
import SyncSettingsPage from "./pages/SyncSettingsPage";
import Reminders from "./pages/Reminders";
import Today from "./pages/todo/Today";
import Upcoming from "./pages/todo/Upcoming";
import TodoCalendar from "./pages/todo/TodoCalendar";
import TodoSettings from "./pages/todo/TodoSettings";
import CustomToolDetail from "./pages/todo/CustomToolDetail";
import WeeklyReview from "./pages/todo/WeeklyReview";
import WidgetsDashboard from "./pages/todo/WidgetsDashboard";
import TaskHistory from "./pages/todo/TaskHistory";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import { NavigationBackProvider } from "@/components/NavigationBackProvider";
import { notificationManager } from "@/utils/notifications";
import { getSetting, setSetting } from "@/utils/settingsStorage";

const queryClient = new QueryClient();

// Global error handler for unhandled errors (prevents white screen on mobile)
if (typeof window !== 'undefined') {
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global error:', { message, source, lineno, colno, error });
    return false;
  };
  
  window.onunhandledrejection = (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  };
}

// Component to track and save last visited dashboard
const DashboardTracker = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Save dashboard type when navigating between Notes and Todo sections
    const path = location.pathname;
    if (path.startsWith('/todo')) {
      setSetting('lastDashboard', 'todo');
    } else if (path === '/' || path === '/notes' || path === '/calendar' || path === '/settings') {
      setSetting('lastDashboard', 'notes');
    }
  }, [location.pathname]);
  
  return null;
};

// Root redirect component that checks last dashboard - renders Index immediately to prevent freeze
const RootRedirect = () => {
  const navigate = useNavigate();
  const [isChecked, setIsChecked] = useState(false);
  
  useEffect(() => {
    const checkLastDashboard = async () => {
      try {
        const lastDashboard = await getSetting<string>('lastDashboard', 'notes');
        if (lastDashboard === 'todo') {
          navigate('/todo/today', { replace: true });
        }
      } catch (e) {
        console.warn('Failed to check last dashboard:', e);
      }
      setIsChecked(true);
    };
    checkLastDashboard();
  }, [navigate]);
  
  // Always render Index immediately to prevent blank screen/freeze
  return <Index />;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <NavigationBackProvider>
        <NavigationLoader />
        <DashboardTracker />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/calendar" element={<NotesCalendar />} />
          <Route path="/clip" element={<WebClipper />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/sync" element={<SyncSettingsPage />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/todo/today" element={<Today />} />
          <Route path="/todo/upcoming" element={<Upcoming />} />
          <Route path="/todo/calendar" element={<TodoCalendar />} />
          <Route path="/todo/settings" element={<TodoSettings />} />
          <Route path="/todo/tool/:toolId" element={<CustomToolDetail />} />
          <Route path="/todo/weekly-review" element={<WeeklyReview />} />
          <Route path="/todo/dashboard" element={<WidgetsDashboard />} />
          <Route path="/todo/history" element={<TaskHistory />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </NavigationBackProvider>
    </BrowserRouter>
  );
};

const AppContent = () => {
  const { hasSeenWelcome, completeWelcome } = useWelcome();

  useEffect(() => {
    notificationManager.initialize().catch(console.error);
  }, []);

  if (!hasSeenWelcome) {
    return <OnboardingFlow onComplete={completeWelcome} />;
  }

  return (
    <>
      <Toaster />
      <Sonner />
      <AppRoutes />
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RevenueCatProvider>
          <GoogleAuthProvider>
            <WelcomeProvider>
              <SubscriptionProvider>
                <AppContent />
              </SubscriptionProvider>
            </WelcomeProvider>
          </GoogleAuthProvider>
        </RevenueCatProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

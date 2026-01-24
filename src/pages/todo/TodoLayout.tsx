import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Search, Sun, Moon, X } from 'lucide-react';
import { TodoBottomNavigation } from '@/components/TodoBottomNavigation';
import { SyncBadge } from '@/components/SyncStatusIndicator';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { syncManager } from '@/utils/syncManager';
import { useDarkMode } from '@/hooks/useDarkMode';
import appLogo from '@/assets/app-logo.png';
import { triggerHaptic } from '@/utils/haptics';

interface TodoLayoutProps {
  children: ReactNode;
  title: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export const TodoLayout = ({ children, title, searchValue, onSearchChange }: TodoLayoutProps) => {
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { isOnline, isSyncing, hasError, lastSync } = useRealtimeSync();
  const syncEnabled = syncManager.isSyncEnabled();

  return (
    <div className="min-h-screen bg-background">
      <header 
        className="border-b sticky top-0 bg-background z-10"
        style={{
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
        }}
      >
        <div className="container mx-auto px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <img src={appLogo} alt="Npd" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" style={{ minWidth: '28px', minHeight: '28px' }} />
              <h1 className="text-lg sm:text-xl font-bold truncate">{title}</h1>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              {syncEnabled && (
                <SyncBadge
                  isOnline={isOnline}
                  isSyncing={isSyncing}
                  lastSync={lastSync}
                  hasError={hasError}
                />
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleDarkMode}
                className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-transparent active:bg-transparent"
                title="Toggle theme"
              >
                {isDarkMode ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  await triggerHaptic('heavy');
                  navigate('/');
                }}
                className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-transparent active:bg-transparent"
                title="Switch to Notes"
              >
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks"
              className="pl-10 pr-10 bg-secondary/50 border-none text-sm sm:text-base"
              value={searchValue || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
            {searchValue && (
              <button
                onClick={() => onSearchChange?.('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="pb-16 sm:pb-20">
        {children}
      </main>
      <TodoBottomNavigation />
    </div>
  );
};

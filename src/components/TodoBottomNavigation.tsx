import { Home, Calendar, Settings, LayoutDashboard, History, BookOpen, MoreHorizontal } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';

const triggerNavHaptic = async () => {
  await triggerHaptic('heavy');
};

export const TodoBottomNavigation = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { icon: Home, label: t('nav.home'), path: '/todo/today' },
    { icon: Calendar, label: t('nav.calendar'), path: '/todo/calendar' },
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/todo/dashboard' },
    { icon: Settings, label: t('nav.settings'), path: '/todo/settings' },
  ];

  const moreItems = [
    { icon: BookOpen, label: t('nav.weeklyReview'), path: '/todo/weekly-review' },
    { icon: History, label: t('nav.taskHistory'), path: '/todo/history' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
      }}
    >
      <div className="grid grid-cols-5 h-14 sm:h-16 max-w-screen-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={triggerNavHaptic}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-colors min-w-0 px-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs font-medium truncate max-w-full">{item.label}</span>
            </Link>
          );
        })}
        
        {/* More Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={triggerNavHaptic}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-colors min-w-0 px-1",
                moreItems.some(item => location.pathname === item.path) 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs font-medium truncate max-w-full">{t('nav.more')}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="mb-2 w-48">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <DropdownMenuItem key={item.path} asChild>
                  <Link
                    to={item.path}
                    onClick={triggerNavHaptic}
                    className={cn(
                      "flex items-center gap-2 w-full",
                      isActive && "text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

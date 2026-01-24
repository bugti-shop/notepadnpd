import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const NavigationLoader = () => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prevPath, setPrevPath] = useState(location.pathname);

  useEffect(() => {
    // Detect dashboard switch (Notes <-> Todo)
    const isNotesSection = (path: string) => 
      path === '/' || path === '/notes' || path === '/calendar' || path === '/settings';
    const isTodoSection = (path: string) => path.startsWith('/todo');

    const wasTodo = isTodoSection(prevPath);
    const wasNotes = isNotesSection(prevPath);
    const isTodo = isTodoSection(location.pathname);
    const isNotes = isNotesSection(location.pathname);

    // Only show loader when switching between dashboards
    if ((wasTodo && isNotes) || (wasNotes && isTodo)) {
      setIsLoading(true);
      setProgress(0);

      // Animate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 15;
        });
      }, 50);

      // Complete after short delay
      const completeTimeout = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setIsLoading(false);
          setProgress(0);
        }, 200);
      }, 300);

      return () => {
        clearInterval(progressInterval);
        clearTimeout(completeTimeout);
      };
    }

    setPrevPath(location.pathname);
  }, [location.pathname, prevPath]);

  // Update prevPath after effect runs
  useEffect(() => {
    setPrevPath(location.pathname);
  }, [location.pathname]);

  if (!isLoading && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      {/* Progress bar */}
      <div 
        className={cn(
          "h-1 bg-primary transition-all duration-150 ease-out",
          progress === 100 && "opacity-0"
        )}
        style={{ width: `${progress}%` }}
      />
      
      {/* Removed spinner overlay - only progress bar remains */}
    </div>
  );
};

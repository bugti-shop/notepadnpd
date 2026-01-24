import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 300);
          return 100;
        }
        return prev + 0.5;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center px-6">
      <div className="animate-scale-in mb-12">
        <img
          src="/src/assets/app-logo.png"
          alt="Npd Logo"
          className="w-32 h-32 object-contain"
        />
      </div>

      <h1 className="text-4xl font-bold mb-2 animate-fade-in">
        Welcome to Npd
      </h1>

      <p className="text-muted-foreground text-center mb-16 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        Your personal note-taking companion
      </p>

      <div className="w-full max-w-md">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-out rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.7) 100%)'
            }}
          />
        </div>
      </div>
    </div>
  );
};

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import i18n from '@/i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const t = i18n.t.bind(i18n);

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('errorBoundary.somethingWentWrong')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || t('errorBoundary.unexpectedError')}
          </p>
          <Button onClick={this.handleRetry} variant="outline">
            {t('errorBoundary.tryAgain')}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper for components that might crash
export const SafeComponent = ({ 
  children, 
  fallback 
}: { 
  children: ReactNode; 
  fallback?: ReactNode 
}) => {
  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

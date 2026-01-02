import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SyncErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface SyncErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Error boundary specifically for sync-related errors
 * Provides retry options and user-friendly error messages
 */
export class SyncErrorBoundary extends Component<
  SyncErrorBoundaryProps,
  SyncErrorBoundaryState
> {
  constructor(props: SyncErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<SyncErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SyncErrorBoundary] Caught error:', error);
    console.error('[SyncErrorBoundary] Error info:', errorInfo);

    this.setState({
      errorInfo: errorInfo.componentStack || null,
    });

    // Log to monitoring service if available
    try {
      // Could integrate with error tracking service here
    } catch (logError) {
      console.error('[SyncErrorBoundary] Failed to log error:', logError);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  getUserFriendlyMessage(): string {
    const { error } = this.state;
    
    if (!error) return 'An unexpected error occurred.';

    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('offline')) {
      return 'Unable to sync due to network issues. Please check your connection.';
    }

    if (message.includes('conflict')) {
      return 'There was a data conflict. Please review and resolve the conflicts.';
    }

    if (message.includes('indexeddb') || message.includes('storage')) {
      return 'There was an issue with local storage. Try clearing your cache.';
    }

    if (message.includes('auth') || message.includes('session')) {
      return 'Your session may have expired. Please sign in again.';
    }

    return 'An error occurred while syncing. Please try again.';
  }

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base text-destructive">
                Sync Error
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {this.getUserFriendlyMessage()}
            </p>

            {error && process.env.NODE_ENV === 'development' && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                  {error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return children;
  }
}

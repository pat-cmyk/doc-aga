import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureError, submitOneTapReport, CaptureHandle } from "@/lib/errorMonitor";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  handle: CaptureHandle | null;
  reported: boolean;
}

/**
 * Root error boundary. Catches render crashes anywhere in the app, reports
 * them to the error monitor (severity: crash), and shows a Taglish recovery
 * screen with one-tap Report + Reload.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, handle: null, reported: false };
  }

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AppErrorBoundary] Caught crash:", error, errorInfo);
    const handle = captureError(error, {
      severity: "crash",
      context: "render",
      stack: `${error.stack ?? ""}\n${errorInfo.componentStack ?? ""}`,
    });
    this.setState({ handle });
  }

  handleReport = async () => {
    const { handle } = this.state;
    if (!handle) return;
    await submitOneTapReport(handle);
    this.setState({ reported: true });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">May nangyaring problema</h1>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Nagka-error ang app. Paki-reload, o i-report para maayos namin agad.
          (Something went wrong. Please reload, or report it so we can fix it.)
        </p>
        <div className="flex gap-3">
          {this.state.reported ? (
            <Button variant="outline" disabled>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Nai-report na
            </Button>
          ) : (
            <Button variant="outline" onClick={this.handleReport} disabled={!this.state.handle}>
              <Send className="h-4 w-4 mr-2" />
              I-report
            </Button>
          )}
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            I-reload
          </Button>
        </div>
      </div>
    );
  }
}

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Send, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureError, CaptureHandle } from "@/lib/errorMonitor";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

type ReportState = "idle" | "sending" | "sent" | "queued" | "failed";

interface AppErrorBoundaryState {
  hasError: boolean;
  handle: CaptureHandle | null;
  reportState: ReportState;
}

/**
 * Root error boundary. Catches render crashes anywhere in the app, reports
 * them to the error monitor (severity: crash), and shows a Taglish recovery
 * screen with one-tap Report + Reload.
 *
 * FIX4: this screen renders its own inline status instead of routing through
 * submitOneTapReport()'s sonner toasts — the app's <Toaster/> is mounted
 * inside the tree this boundary just replaced, so any toast fired from here
 * is invisible. It also must never claim success before requestReport()
 * actually resolves: the crash screen is the one place a false "Nai-report
 * na" is most damaging, since there's no other UI left for the farmer to
 * retry from.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, handle: null, reportState: "idle" };
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
    this.setState({ reportState: "sending" });
    const result = await handle.requestReport();
    if (result.status === "submitted") {
      this.setState({ reportState: "sent" });
    } else if (result.status === "queued") {
      this.setState({ reportState: "queued" });
    } else {
      this.setState({ reportState: "failed" });
    }
  };

  renderReportButton() {
    const { reportState, handle } = this.state;

    if (reportState === "sent") {
      return (
        <Button variant="outline" disabled>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Nai-report na
        </Button>
      );
    }

    if (reportState === "queued") {
      return (
        <Button variant="outline" disabled>
          <Clock className="h-4 w-4 mr-2" />
          Naitala — ipapadala kapag online
        </Button>
      );
    }

    const label = reportState === "failed" ? "Subukan ulit i-report" : "I-report";

    return (
      <div className="flex flex-col items-center gap-1">
        <Button
          variant="outline"
          onClick={this.handleReport}
          disabled={!handle || reportState === "sending"}
        >
          <Send className="h-4 w-4 mr-2" />
          {label}
        </Button>
        {reportState === "failed" && (
          <p className="text-xs text-muted-foreground">
            Hindi naipadala. (Could not send.)
          </p>
        )}
      </div>
    );
  }

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
        <div className="flex gap-3 items-start">
          {this.renderReportButton()}
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            I-reload
          </Button>
        </div>
      </div>
    );
  }
}

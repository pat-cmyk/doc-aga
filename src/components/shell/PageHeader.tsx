/**
 * Page-mode header for focused flows (UX redesign Phase 3).
 *
 * Back chevron + title, used by full-screen flows that hide the bottom nav
 * (/animals/new, and later checkout-style pages). Back walks history and
 * falls back to a caller-provided path when the app cold-started here.
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Where back lands when there is no history (deep-link cold start). */
  fallbackPath: string;
  /** Optional right-aligned actions. */
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, fallbackPath, children }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    const historyState = window.history.state as { idx?: number } | null;
    if (typeof historyState?.idx === "number" && historyState.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 pt-safe">
      <div className="container mx-auto px-2 py-2 flex items-center gap-1">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="h-12 w-12 flex items-center justify-center rounded-xl text-foreground hover:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
      </div>
    </header>
  );
}

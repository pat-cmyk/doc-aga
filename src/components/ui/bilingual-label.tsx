import * as React from "react";
import { cn } from "@/lib/utils";
import { labels } from "@/lib/filipinoLabels";

type LabelKey = keyof typeof labels;

interface BilingualLabelProps extends React.HTMLAttributes<HTMLLabelElement> {
  /**
   * Dictionary key from src/lib/filipinoLabels.ts — the preferred way to
   * label a field (SSOT for bilingual copy; UX redesign Phase 5). Inline
   * english/filipino props remain for one-off labels and override the
   * dictionary entry when both are given.
   */
  k?: LabelKey;
  english?: string;
  filipino?: string;
  required?: boolean;
  htmlFor?: string;
}

/**
 * English-primary field label with a smaller Tagalog support line — the
 * app-wide language rule (farmers' UI literacy comes from English-labeled
 * apps like Facebook/GCash; decision 2026-08-31).
 */
const BilingualLabel = React.forwardRef<HTMLLabelElement, BilingualLabelProps>(
  ({ k, english, filipino, required, className, htmlFor, ...props }, ref) => {
    const entry = k ? labels[k] : undefined;
    const en = english ?? entry?.english ?? "";
    const fil = filipino ?? entry?.filipino ?? "";
    return (
      <label
        ref={ref}
        htmlFor={htmlFor}
        className={cn(
          "flex flex-col gap-0.5 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className
        )}
        {...props}
      >
        <span className="text-sm font-medium leading-none text-foreground">
          {en}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
        {fil && <span className="text-xs text-muted-foreground leading-none">{fil}</span>}
      </label>
    );
  }
);
BilingualLabel.displayName = "BilingualLabel";

export { BilingualLabel };

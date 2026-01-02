import * as React from "react";
import { cn } from "@/lib/utils";

interface BilingualLabelProps extends React.HTMLAttributes<HTMLLabelElement> {
  filipino: string;
  english: string;
  required?: boolean;
  htmlFor?: string;
}

const BilingualLabel = React.forwardRef<HTMLLabelElement, BilingualLabelProps>(
  ({ filipino, english, required, className, htmlFor, ...props }, ref) => {
    return (
      <label
        ref={ref}
        htmlFor={htmlFor}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className
        )}
        {...props}
      >
        <span className="text-foreground">{filipino}</span>
        <span className="text-muted-foreground text-xs ml-1">/ {english}</span>
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
    );
  }
);
BilingualLabel.displayName = "BilingualLabel";

export { BilingualLabel };

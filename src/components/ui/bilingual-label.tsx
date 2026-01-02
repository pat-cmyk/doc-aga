import * as React from "react";
import { cn } from "@/lib/utils";

interface BilingualLabelProps extends React.HTMLAttributes<HTMLLabelElement> {
  english: string;
  filipino: string;
  required?: boolean;
  htmlFor?: string;
}

const BilingualLabel = React.forwardRef<HTMLLabelElement, BilingualLabelProps>(
  ({ english, filipino, required, className, htmlFor, ...props }, ref) => {
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
          {english}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
        <span className="text-xs text-muted-foreground leading-none">{filipino}</span>
      </label>
    );
  }
);
BilingualLabel.displayName = "BilingualLabel";

export { BilingualLabel };

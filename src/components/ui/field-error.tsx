import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface FieldErrorProps {
  message?: string;
  className?: string;
}

export const FieldError = ({ message, className }: FieldErrorProps) => {
  if (!message) return null;

  return (
    <div className={cn("flex items-center gap-1 text-sm text-destructive mt-1", className)}>
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

import { cn } from "@/lib/utils";

interface GenderSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

export function GenderSelector({ value, onChange, error }: GenderSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium leading-none">
          Gender <span className="text-destructive">*</span>
        </label>
        <span className="text-xs text-muted-foreground">Kasarian</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Female Button */}
        <button
          type="button"
          onClick={() => onChange("Female")}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 p-4 min-h-[80px] rounded-lg border-2 transition-all duration-200",
            "hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/20",
            value === "Female" 
              ? "border-pink-500 bg-pink-50 dark:bg-pink-950/30 ring-2 ring-pink-500/20" 
              : "border-border bg-background",
            error && !value && "border-destructive"
          )}
        >
          {/* Female Icon */}
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
            value === "Female" 
              ? "bg-pink-500 text-white" 
              : "bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400"
          )}>
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <circle cx="12" cy="8" r="5" />
              <path d="M12 13v8" />
              <path d="M9 18h6" />
            </svg>
          </div>
          
          <div className="text-center">
            <span className={cn(
              "block text-sm font-semibold",
              value === "Female" ? "text-pink-700 dark:text-pink-300" : "text-foreground"
            )}>
              Female
            </span>
            <span className={cn(
              "block text-xs",
              value === "Female" ? "text-pink-600 dark:text-pink-400" : "text-muted-foreground"
            )}>
              Babae
            </span>
          </div>

          {/* Selected checkmark */}
          {value === "Female" && (
            <div className="absolute top-2 right-2 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>

        {/* Male Button */}
        <button
          type="button"
          onClick={() => onChange("Male")}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 p-4 min-h-[80px] rounded-lg border-2 transition-all duration-200",
            "hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20",
            value === "Male" 
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500/20" 
              : "border-border bg-background",
            error && !value && "border-destructive"
          )}
        >
          {/* Male Icon */}
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
            value === "Male" 
              ? "bg-blue-500 text-white" 
              : "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
          )}>
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <circle cx="10" cy="14" r="5" />
              <path d="M19 5l-5.4 5.4" />
              <path d="M15 5h4v4" />
            </svg>
          </div>
          
          <div className="text-center">
            <span className={cn(
              "block text-sm font-semibold",
              value === "Male" ? "text-blue-700 dark:text-blue-300" : "text-foreground"
            )}>
              Male
            </span>
            <span className={cn(
              "block text-xs",
              value === "Male" ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
            )}>
              Lalaki
            </span>
          </div>

          {/* Selected checkmark */}
          {value === "Male" && (
            <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>
      </div>

      {error && !value && (
        <p className="text-xs text-destructive">Please select the animal's gender</p>
      )}
    </div>
  );
}
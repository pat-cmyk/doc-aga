import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";

interface PhilippineTimeBannerProps {
  compact?: boolean;
}

export const PhilippineTimeBanner = ({ compact = false }: PhilippineTimeBannerProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Format for Philippine timezone (UTC+8)
  const dateFormatter = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: compact ? 'short' : 'long',
    year: 'numeric',
    month: compact ? 'short' : 'long',
    day: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const formattedDate = dateFormatter.format(currentTime);
  const formattedTime = timeFormatter.format(currentTime);

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span>{formattedDate} • {formattedTime} PHT</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Calendar className="h-3.5 w-3.5" />
      <span>{formattedDate}, {formattedTime} PHT</span>
    </div>
  );
};

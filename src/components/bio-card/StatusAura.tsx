import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, Heart, Activity } from "lucide-react";

export type StatusAuraType = 'green' | 'yellow' | 'orange' | 'red' | 'purple';

interface StatusAuraProps {
  status: StatusAuraType;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

const auraStyles: Record<StatusAuraType, { ring: string; glow: string; animate?: string }> = {
  green: {
    ring: 'ring-green-500/50 dark:ring-green-400/50',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.3)]',
  },
  yellow: {
    ring: 'ring-yellow-500/50 dark:ring-yellow-400/50',
    glow: 'shadow-[0_0_12px_rgba(234,179,8,0.3)]',
    animate: 'animate-pulse-glow',
  },
  orange: {
    ring: 'ring-orange-500/50 dark:ring-orange-400/50',
    glow: 'shadow-[0_0_12px_rgba(249,115,22,0.4)]',
    animate: 'animate-pulse-warning',
  },
  red: {
    ring: 'ring-red-500/60 dark:ring-red-400/60',
    glow: 'shadow-[0_0_16px_rgba(239,68,68,0.5)]',
    animate: 'animate-pulse-warning',
  },
  purple: {
    ring: 'ring-purple-500/50 dark:ring-purple-400/50',
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.4)]',
  },
};

const sizeClasses = {
  sm: 'ring-2',
  md: 'ring-[3px]',
  lg: 'ring-4',
};

export function StatusAura({ status, size = 'md', children, className }: StatusAuraProps) {
  const style = auraStyles[status];

  return (
    <div
      className={cn(
        "rounded-full",
        sizeClasses[size],
        style.ring,
        style.glow,
        style.animate,
        className
      )}
    >
      {children}
    </div>
  );
}

// Badge version for compact display
interface StatusBadgeProps {
  status: StatusAuraType;
  className?: string;
}

const statusLabels: Record<StatusAuraType, { en: string; tl: string; icon: React.ComponentType<{ className?: string }> }> = {
  green: { en: 'Healthy', tl: 'Malusog', icon: Activity },
  yellow: { en: 'Monitor', tl: 'Bantayan', icon: AlertTriangle },
  orange: { en: 'Attention', tl: 'Pansin', icon: AlertTriangle },
  red: { en: 'Critical', tl: 'Kritikal', icon: ShieldAlert },
  purple: { en: 'In Heat', tl: 'Nag-iinit', icon: Heart },
};

const badgeVariants: Record<StatusAuraType, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = statusLabels[status];
  const Icon = label.icon;

  return (
    <Badge
      variant="secondary"
      className={cn(badgeVariants[status], "gap-1", className)}
    >
      <Icon className="w-3 h-3" />
      <span>{label.en}</span>
    </Badge>
  );
}

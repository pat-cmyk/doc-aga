import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Users, 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Activity
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useFarmhandProductivity, FarmhandProductivity } from '@/hooks/useFarmhandProductivity';

interface FarmhandProductivityDashboardProps {
  farmId: string;
}

function MiniSparkline({ data }: { data: { activitiesCount: number }[] }) {
  const max = Math.max(...data.map(d => d.activitiesCount), 1);
  const height = 20;
  const width = 60;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (d.activitiesCount / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="text-primary">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function getTrendIcon(dailyStats: { activitiesCount: number }[]) {
  if (dailyStats.length < 2) return <Minus className="h-3 w-3 text-muted-foreground" />;
  
  const recent = dailyStats.slice(-3).reduce((sum, d) => sum + d.activitiesCount, 0);
  const earlier = dailyStats.slice(0, 3).reduce((sum, d) => sum + d.activitiesCount, 0);
  
  if (recent > earlier) return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (recent < earlier) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function getRoleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  switch (role) {
    case 'owner':
      return 'default';
    case 'manager':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function FarmhandProductivityDashboard({ farmId }: FarmhandProductivityDashboardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { data: farmhands, isLoading } = useFarmhandProductivity(farmId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!farmhands || farmhands.length === 0) {
    return null;
  }

  const totalTodayActivities = farmhands.reduce((sum, f) => sum + f.todayCount, 0);
  const activeMembersCount = farmhands.filter(f => f.todayCount > 0).length;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Productivity
                <Badge variant="secondary" className="ml-1">
                  {activeMembersCount}/{farmhands.length} active
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Summary Row */}
            <div className="flex items-center justify-between p-3 mb-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Today's Total</span>
              </div>
              <span className="text-lg font-bold">{totalTodayActivities} activities</span>
            </div>

            {/* Team Members */}
            <div className="space-y-3">
              {farmhands.map(farmhand => (
                <FarmhandRow key={farmhand.userId} farmhand={farmhand} />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function FarmhandRow({ farmhand }: { farmhand: FarmhandProductivity }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
      {/* Avatar */}
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={farmhand.avatarUrl || undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(farmhand.userName)}
          </AvatarFallback>
        </Avatar>
        {farmhand.isActive && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{farmhand.userName}</span>
          <Badge variant={getRoleBadgeVariant(farmhand.role)} className="text-[10px] px-1.5 py-0">
            {farmhand.role}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {farmhand.lastActivityAt ? (
            <>
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(farmhand.lastActivityAt), { addSuffix: true })}</span>
            </>
          ) : (
            <span>No activity today</span>
          )}
        </div>
      </div>

      {/* Sparkline */}
      <div className="hidden sm:block">
        <MiniSparkline data={farmhand.dailyStats} />
      </div>

      {/* Stats */}
      <div className="text-right">
        <div className="flex items-center gap-1 justify-end">
          <span className="text-lg font-bold">{farmhand.todayCount}</span>
          {getTrendIcon(farmhand.dailyStats)}
        </div>
        <p className="text-xs text-muted-foreground">
          {farmhand.weekCount} this week
        </p>
      </div>
    </div>
  );
}

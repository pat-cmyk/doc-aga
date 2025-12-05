import { Card, CardContent } from "@/components/ui/card";
import { Activity, Baby, TrendingUp, Calendar, Dna } from "lucide-react";

interface BreedingOverviewCardsProps {
  totalAIProcedures: number;
  totalAIPerformed: number;
  currentlyPregnant: number;
  aiSuccessRate: number;
  dueThisQuarter: number;
  uniqueSemenCodes?: number;
  isLoading?: boolean;
}

export const BreedingOverviewCards = ({
  totalAIProcedures,
  totalAIPerformed,
  currentlyPregnant,
  aiSuccessRate,
  dueThisQuarter,
  uniqueSemenCodes,
  isLoading,
}: BreedingOverviewCardsProps) => {
  const cards = [
    {
      title: "AI Procedures",
      value: totalAIProcedures,
      subtitle: `${totalAIPerformed} performed`,
      icon: Activity,
      colorClass: "text-blue-500",
      bgClass: "bg-blue-500/10",
    },
    {
      title: "Currently Pregnant",
      value: currentlyPregnant,
      subtitle: "Awaiting delivery",
      icon: Baby,
      colorClass: "text-purple-500",
      bgClass: "bg-purple-500/10",
    },
    {
      title: "AI Success Rate",
      value: `${aiSuccessRate}%`,
      subtitle: totalAIPerformed > 0 ? "Of performed procedures" : "No data yet",
      icon: TrendingUp,
      colorClass: "text-emerald-500",
      bgClass: "bg-emerald-500/10",
    },
    {
      title: "Due This Quarter",
      value: dueThisQuarter,
      subtitle: "Next 90 days",
      icon: Calendar,
      colorClass: "text-orange-500",
      bgClass: "bg-orange-500/10",
    },
    {
      title: "Semen Sources",
      value: uniqueSemenCodes ?? 0,
      subtitle: "Unique genetic lines",
      icon: Dna,
      colorClass: "text-pink-500",
      bgClass: "bg-pink-500/10",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-8 bg-muted rounded w-16" />
                <div className="h-3 bg-muted rounded w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${card.bgClass}`}>
                  <Icon className={`h-6 w-6 ${card.colorClass}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground truncate">{card.title}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{card.subtitle}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

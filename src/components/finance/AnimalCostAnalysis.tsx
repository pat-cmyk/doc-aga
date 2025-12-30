import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, ChevronRight } from "lucide-react";
import { useAnimalCostAggregates, CategoryExpenseBreakdown } from "@/hooks/useAnimalCostAggregates";
import { useNavigate } from "react-router-dom";

interface AnimalCostAnalysisProps {
  farmId: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const categoryColors: Record<string, string> = {
  "Veterinary Services": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "Medicine & Vaccines": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  "Feed & Supplements": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "Breeding & AI Services": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  "Equipment & Supplies": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  "Transport": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Other": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export function AnimalCostAnalysis({ farmId }: AnimalCostAnalysisProps) {
  const { data, isLoading } = useAnimalCostAggregates(farmId);
  const navigate = useNavigate();

  const handleViewAnimal = (animalId: string) => {
    navigate(`/dashboard?animalId=${animalId}&tab=costs`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalAnimalExpenses === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Per-Animal Cost Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No animal-specific expenses recorded yet. Add expenses from individual animal pages to see cost analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Per-Animal Cost Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Total Animal Expenses</p>
            <p className="text-lg font-bold">{formatCurrency(data.totalAnimalExpenses)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Avg Cost per Animal</p>
            <p className="text-lg font-bold">{formatCurrency(data.averageCostPerAnimal)}</p>
          </div>
        </div>

        {/* Category Breakdown */}
        {data.categoryBreakdown.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3">Expense Categories</p>
            <div className="space-y-2">
              {data.categoryBreakdown.slice(0, 4).map((category) => (
                <CategoryBar
                  key={category.category}
                  category={category}
                  maxAmount={data.categoryBreakdown[0].totalAmount}
                />
              ))}
            </div>
          </div>
        )}

        {/* Top Expensive Animals */}
        {data.topExpensiveAnimals.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3">Highest Investment Animals</p>
            <div className="space-y-2">
              {data.topExpensiveAnimals
                .filter((animal) => animal.totalCost > 0)
                .slice(0, 3)
                .map((animal, index) => (
                  <Button
                    key={animal.animalId}
                    variant="ghost"
                    className="w-full justify-between h-auto py-2 px-3"
                    onClick={() => handleViewAnimal(animal.animalId)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">#{index + 1}</span>
                      <div className="text-left">
                        <p className="text-sm font-medium">
                          {animal.animalName || animal.earTag || "Unnamed"}
                        </p>
                        {animal.earTag && animal.animalName && (
                          <p className="text-xs text-muted-foreground">{animal.earTag}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{formatCurrency(animal.totalCost)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Button>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryBar({ category, maxAmount }: { category: CategoryExpenseBreakdown; maxAmount: number }) {
  const percentage = maxAmount > 0 ? (category.totalAmount / maxAmount) * 100 : 0;
  const colorClass = categoryColors[category.category] || categoryColors["Other"];

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{category.category}</span>
        <span className="font-medium">{formatCurrency(category.totalAmount)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass.split(" ")[0]} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

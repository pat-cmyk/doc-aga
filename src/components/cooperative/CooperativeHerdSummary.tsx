import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useCooperativeHerdSummary } from "@/hooks/useCooperative";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  cooperativeId: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 72% 51%)",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
  "hsl(25 95% 53%)",
];

export const CooperativeHerdSummary = ({ cooperativeId }: Props) => {
  const { data: herd, isLoading } = useCooperativeHerdSummary(cooperativeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        Herd Summary — {herd?.total_animals ?? 0} Animals
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* By Species */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Species</CardTitle>
          </CardHeader>
          <CardContent>
            {herd?.by_species && herd.by_species.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={herd.by_species}
                    dataKey="count"
                    nameKey="species"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ species, count }) => `${species}: ${count}`}
                  >
                    {herd.by_species.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data</p>
            )}
          </CardContent>
        </Card>

        {/* By Breed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Breed (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {herd?.by_breed && herd.by_breed.length > 0 ? (
              <div className="space-y-2">
                {herd.by_breed.slice(0, 10).map((b: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{b.breed}</span>
                    <span className="font-medium">{b.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

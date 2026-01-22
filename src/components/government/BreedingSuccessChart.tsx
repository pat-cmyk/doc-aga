import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";

interface BreedingSuccessChartProps {
  cattleSuccessRate: number;
  goatSuccessRate: number;
  carabaoSuccessRate: number;
  sheepSuccessRate: number;
  isLoading?: boolean;
}

export const BreedingSuccessChart = ({
  cattleSuccessRate,
  goatSuccessRate,
  carabaoSuccessRate,
  sheepSuccessRate,
  isLoading,
}: BreedingSuccessChartProps) => {
  const data = [
    { name: "Cattle", rate: cattleSuccessRate, color: "#3b82f6" },
    { name: "Goat", rate: goatSuccessRate, color: "#8b5cf6" },
    { name: "Carabao", rate: carabaoSuccessRate, color: "#f59e0b" },
    { name: "Sheep", rate: sheepSuccessRate, color: "#10b981" },
  ].filter(item => item.rate > 0); // Only show types with data

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Success Rate by Livestock Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Success Rate by Livestock Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">No breeding data available</p>
              <p className="text-xs mt-1">Data will appear once AI procedures are recorded</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { isMobile, fontSize } = useResponsiveChart({ size: 'medium' });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Success Rate by Livestock Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              type="number" 
              domain={[0, 100]} 
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize }}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={isMobile ? 65 : 80}
              tick={{ fontSize }}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, "Success Rate"]}
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
            />
            <Bar dataKey="rate" radius={[0, 8, 8, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

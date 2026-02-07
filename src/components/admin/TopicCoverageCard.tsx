import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { categorizeQueries, QueryWithTopic } from "@/lib/queryTopicCategorizer";
import { AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";

interface TopicCoverageCardProps {
  queries: QueryWithTopic[] | undefined;
}

export const TopicCoverageCard = ({ queries }: TopicCoverageCardProps) => {
  const coverageData = useMemo(() => {
    if (!queries || queries.length === 0) return [];
    
    return categorizeQueries(queries)
      .sort((a, b) => b.gapPercentage - a.gapPercentage);
  }, [queries]);

  if (!queries || queries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Topic Coverage Analysis
          </CardTitle>
          <CardDescription>FAQ coverage by topic area</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No query data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Topic Coverage Analysis
        </CardTitle>
        <CardDescription>
          Identify knowledge gaps - topics with high unmatched percentages need more FAQs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Matched</TableHead>
                <TableHead className="text-center">Unmatched</TableHead>
                <TableHead className="w-[180px]">Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverageData.map((topic) => {
                const coveragePercent = 100 - topic.gapPercentage;
                const isHighGap = topic.gapPercentage > 50;
                const isMediumGap = topic.gapPercentage > 30 && topic.gapPercentage <= 50;
                
                return (
                  <TableRow key={topic.key}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isHighGap && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        {!isHighGap && coveragePercent >= 80 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        <span className="truncate max-w-[200px]">{topic.topic}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{topic.count}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {topic.matched}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={isHighGap ? "destructive" : isMediumGap ? "outline" : "secondary"}
                      >
                        {topic.unmatched}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={coveragePercent} 
                          className={`h-2 flex-1 ${isHighGap ? '[&>div]:bg-destructive' : isMediumGap ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
                        />
                        <span className={`text-xs font-medium w-10 text-right ${isHighGap ? 'text-destructive' : isMediumGap ? 'text-amber-600' : 'text-green-600'}`}>
                          {coveragePercent}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <span>High gap (&gt;50%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Medium gap (30-50%)</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>Good coverage (&ge;80%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

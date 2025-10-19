import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTestSuites } from "@/hooks/useTestResults";

interface TestSuiteOverviewProps {
  testRunId?: string;
}

export const TestSuiteOverview = ({ testRunId }: TestSuiteOverviewProps) => {
  const { data: suites, isLoading } = useTestSuites(testRunId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Suites</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suites || suites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Suites</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No test suites available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Suites</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suites.map((suite: any) => (
            <Card key={suite.name}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{suite.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="default" className="bg-green-500">
                    ✓ {suite.passed}
                  </Badge>
                  {suite.failed > 0 && (
                    <Badge variant="destructive">
                      ✗ {suite.failed}
                    </Badge>
                  )}
                  {suite.skipped > 0 && (
                    <Badge variant="secondary">
                      ○ {suite.skipped}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Total: {suite.total} tests
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

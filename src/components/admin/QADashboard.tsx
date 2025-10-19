import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLatestTestRun } from "@/hooks/useTestRuns";
import { TestSuiteOverview } from "./TestSuiteOverview";
import { TestResultsTable } from "./TestResultsTable";
import { TrendingUp, TrendingDown, CheckCircle, XCircle, Clock } from "lucide-react";

export const QADashboard = () => {
  const { data: latestRun, isLoading } = useLatestTestRun();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!latestRun) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>QA Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No test data available yet. Test results will appear here once tests are run.
          </p>
        </CardContent>
      </Card>
    );
  }

  const passRate = latestRun.total_tests > 0 
    ? ((latestRun.passed_tests / latestRun.total_tests) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">QA Dashboard</h2>
        <p className="text-muted-foreground">
          Monitor test results and code coverage
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestRun.total_tests}</div>
            <p className="text-xs text-muted-foreground">
              {latestRun.duration_ms}ms execution time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            {parseFloat(passRate) >= 90 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passRate}%</div>
            <p className="text-xs text-muted-foreground">
              {latestRun.passed_tests} passed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Tests</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestRun.failed_tests}</div>
            <p className="text-xs text-muted-foreground">
              {latestRun.skipped_tests} skipped
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestRun.coverage_percentage?.toFixed(1) ?? "N/A"}%
            </div>
            <p className="text-xs text-muted-foreground">
              Code coverage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test Suites Overview */}
      <TestSuiteOverview testRunId={latestRun.id} />

      {/* Detailed Test Results */}
      <TestResultsTable testRunId={latestRun.id} />
    </div>
  );
};

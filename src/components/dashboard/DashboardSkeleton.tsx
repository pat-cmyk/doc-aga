import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </div>

      {/* Tab Navigation Skeleton */}
      <div className="border-b">
        <div className="container px-4">
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="h-12 w-full justify-start rounded-none border-b-0 bg-transparent p-0">
              <TabsTrigger value="dashboard" className="rounded-none">
                <Skeleton className="h-4 w-20" />
              </TabsTrigger>
              <TabsTrigger value="animals" className="rounded-none">
                <Skeleton className="h-4 w-16" />
              </TabsTrigger>
              <TabsTrigger value="feed" className="rounded-none">
                <Skeleton className="h-4 w-12" />
              </TabsTrigger>
              <TabsTrigger value="finance" className="rounded-none">
                <Skeleton className="h-4 w-16" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="container space-y-6 px-4 py-6">
        {/* Stats Grid Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[360px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[360px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

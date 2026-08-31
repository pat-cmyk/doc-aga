import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Header/back/nav come from the farm shell (UX redesign Phase 6).
const DistributorFinder = () => (
  <Card>
    <CardHeader>
      <CardTitle>Distributor Map</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">
        Interactive map showing nearby distributors coming soon. You'll be able to view
        locations, contact info, and get directions.
      </p>
    </CardContent>
  </Card>
);

export default DistributorFinder;

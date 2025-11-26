import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, CheckCircle, XCircle, Calendar, AlertCircle } from "lucide-react";
import { usePendingActivities, PendingActivity } from "@/hooks/usePendingActivities";
import { formatDistanceToNow } from "date-fns";

interface MySubmissionsProps {
  userId: string;
}

export const MySubmissions = ({ userId }: MySubmissionsProps) => {
  const { activities, pendingCount, approvedCount, rejectedCount, isLoading } = 
    usePendingActivities(undefined, userId);

  const getActivityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      milking: 'Milking',
      feeding: 'Feeding',
      health_observation: 'Health Check',
      weight_measurement: 'Weight',
      injection: 'Injection'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "Pending Review", icon: Clock },
      approved: { variant: "default", label: "Approved", icon: CheckCircle },
      auto_approved: { variant: "outline", label: "Auto-Approved", icon: CheckCircle },
      rejected: { variant: "destructive", label: "Rejected", icon: XCircle }
    };
    
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatActivityDetails = (activity: PendingActivity) => {
    const data = activity.activity_data;
    const details = [];

    if (data.quantity) {
      details.push(`${data.quantity} ${data.unit || 'kg'}`);
    }
    if (data.feed_type) {
      details.push(data.feed_type);
    }
    if (data.medicine_name) {
      details.push(data.medicine_name);
    }
    if (activity.animal_ids.length > 0) {
      details.push(`${activity.animal_ids.length} animal(s)`);
    }

    return details.join(' • ');
  };

  const renderActivityCard = (activity: PendingActivity) => (
    <Card key={activity.id} className="mb-3">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">
                  {getActivityTypeLabel(activity.activity_type)}
                </h4>
                {getStatusBadge(activity.status)}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatActivityDetails(activity)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Submitted {formatDistanceToNow(new Date(activity.submitted_at), { addSuffix: true })}
            </span>
          </div>

          {activity.status === 'pending' && activity.auto_approve_at && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-muted-foreground">
                Auto-approves {formatDistanceToNow(new Date(activity.auto_approve_at), { addSuffix: true })}
              </span>
            </div>
          )}

          {activity.status === 'rejected' && activity.rejection_reason && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Rejection reason:</strong> {activity.rejection_reason}
              </AlertDescription>
            </Alert>
          )}

          {activity.reviewed_at && (
            <div className="text-sm text-muted-foreground">
              Reviewed {formatDistanceToNow(new Date(activity.reviewed_at), { addSuffix: true })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Submissions</CardTitle>
          <CardDescription>Loading your activity submissions...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pendingActivities = activities.filter(a => a.status === 'pending');
  const approvedActivities = activities.filter(a => ['approved', 'auto_approved'].includes(a.status));
  const rejectedActivities = activities.filter(a => a.status === 'rejected');

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Submissions</CardTitle>
        <CardDescription>Track the status of your activity submissions</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="gap-2">
              Pending
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              Approved
              {approvedCount > 0 && (
                <Badge variant="outline" className="ml-1">
                  {approvedCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              Rejected
              {rejectedCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {rejectedCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {pendingActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No pending submissions</p>
                </div>
              ) : (
                pendingActivities.map(renderActivityCard)
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {approvedActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No approved submissions yet</p>
                </div>
              ) : (
                approvedActivities.map(renderActivityCard)
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="rejected" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {rejectedActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No rejected submissions</p>
                </div>
              ) : (
                rejectedActivities.map(renderActivityCard)
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

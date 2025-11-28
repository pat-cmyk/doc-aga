import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, CheckCircle, XCircle, User, Calendar, Eye } from "lucide-react";
import { usePendingActivities, PendingActivity } from "@/hooks/usePendingActivities";
import { ActivityDetailsDialog } from "./ActivityDetailsDialog";
import { formatDistanceToNow } from "date-fns";

interface PendingActivitiesQueueProps {
  farmId: string;
}

export const PendingActivitiesQueue = ({ farmId }: PendingActivitiesQueueProps) => {
  const { activities, pendingCount, approveActivity, rejectActivity, isReviewing } = 
    usePendingActivities(farmId);
  
  const [selectedActivity, setSelectedActivity] = useState<PendingActivity | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const pendingActivities = activities.filter(a => a.status === 'pending');

  const handleViewDetails = (activity: PendingActivity) => {
    setSelectedActivity(activity);
    setDetailsDialogOpen(true);
  };

  const handleApprove = (activity: PendingActivity) => {
    approveActivity(activity.id);
  };

  const handleReject = (reason: string) => {
    if (selectedActivity) {
      rejectActivity(selectedActivity.id, reason);
    }
  };

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
      pending: { variant: "secondary", label: "Pending", icon: Clock },
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

  if (pendingActivities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Review and approve farmhand submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No pending activities to review</p>
            <p className="text-sm mt-1">All submissions have been processed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Review farmhand submissions awaiting approval</CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {pendingCount}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {pendingActivities.map((activity) => (
                <Card 
                  key={activity.id} 
                  className="border-2 hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => handleViewDetails(activity)}
                >
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(activity);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Submitter & Time Info */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{activity.submitter?.full_name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {formatDistanceToNow(new Date(activity.submitted_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {/* Auto-approve countdown */}
                      {activity.auto_approve_at && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span className="text-muted-foreground">
                            Auto-approves {formatDistanceToNow(new Date(activity.auto_approve_at), { addSuffix: true })}
                          </span>
                        </div>
                      )}

                      {/* Quick Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(activity);
                          }}
                          disabled={isReviewing}
                          className="flex-1"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Quick Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(activity);
                          }}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Activity Details Dialog */}
      <ActivityDetailsDialog
        activity={selectedActivity}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onApprove={() => selectedActivity && handleApprove(selectedActivity)}
        onReject={handleReject}
        isReviewing={isReviewing}
      />
    </>
  );
};

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Mail, 
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Milk,
  Wheat,
  Activity,
  Weight,
  Syringe,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { PendingActivity } from "@/hooks/usePendingActivities";
import { useActivityDetails } from "@/hooks/useActivityDetails";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ActivityDetailsDialogProps {
  activity: PendingActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  isReviewing: boolean;
}

export const ActivityDetailsDialog = ({
  activity,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isReviewing,
}: ActivityDetailsDialogProps) => {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { animals, historicalMilking, previousWeights, isLoading } = useActivityDetails(
    activity?.activity_type || '',
    activity?.animal_ids || [],
    open && !!activity
  );

  if (!activity) return null;

  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case 'milking': return <Milk className="h-5 w-5" />;
      case 'feeding': return <Wheat className="h-5 w-5" />;
      case 'health_observation': return <Activity className="h-5 w-5" />;
      case 'weight_measurement': return <Weight className="h-5 w-5" />;
      case 'injection': return <Syringe className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getActivityLabel = (type: string) => {
    const labels: Record<string, string> = {
      milking: 'Milking Record',
      feeding: 'Feeding Record',
      health_observation: 'Health Observation',
      weight_measurement: 'Weight Measurement',
      injection: 'Injection Record'
    };
    return labels[type] || type;
  };

  const getStatusBadge = () => {
    const variants: Record<string, { variant: any; label: string; icon: any }> = {
      pending: { variant: "secondary", label: "Pending Review", icon: Clock },
      approved: { variant: "default", label: "Approved", icon: CheckCircle },
      auto_approved: { variant: "outline", label: "Auto-Approved", icon: CheckCircle },
      rejected: { variant: "destructive", label: "Rejected", icon: XCircle }
    };
    
    const config = variants[activity.status] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleReject = () => {
    if (rejectionReason.trim()) {
      onReject(rejectionReason);
      setRejectDialogOpen(false);
      setRejectionReason("");
      onOpenChange(false);
    }
  };

  const handleApprove = () => {
    onApprove();
    onOpenChange(false);
  };

  const renderMilkingDetails = () => {
    const quantity = activity.activity_data.quantity;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Milk className="h-5 w-5 text-primary" />
          <span>Milking Details</span>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Milk Recorded</span>
            <span className="text-2xl font-bold text-primary">{quantity} L</span>
          </div>
        </div>

        {animals.map((animal) => {
          const historical = historicalMilking.get(animal.id);
          const average = historical?.average || 0;
          const records = historical?.records || [];
          const deviation = average > 0 ? ((quantity - average) / average) * 100 : 0;
          const isAnomaly = Math.abs(deviation) > 50;

          return (
            <div key={animal.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={animal.avatar_url || undefined} />
                  <AvatarFallback>{animal.name?.[0] || animal.ear_tag?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-semibold">{animal.name || 'Unnamed Animal'}</div>
                  <div className="text-sm text-muted-foreground">
                    {animal.ear_tag && `Ear Tag: ${animal.ear_tag}`}
                    {animal.ear_tag && animal.life_stage && ' • '}
                    {animal.life_stage && `${animal.life_stage}`}
                    {(animal.ear_tag || animal.life_stage) && animal.livestock_type && ' • '}
                    {animal.livestock_type && animal.livestock_type.charAt(0).toUpperCase() + animal.livestock_type.slice(1)}
                  </div>
                </div>
              </div>

              {records.length > 0 ? (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">7-Day Average</span>
                      <span className="font-medium">{average.toFixed(1)} L/day</span>
                    </div>
                    
                    {isAnomaly && (
                      <div className="flex items-center gap-2 text-sm p-2 bg-orange-500/10 rounded border border-orange-500/20">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-orange-700 dark:text-orange-400">
                          {deviation > 0 ? '+' : ''}{deviation.toFixed(0)}% {deviation > 0 ? 'above' : 'below'} average
                        </span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="text-sm font-medium">Recent Records (Last 7 Days)</div>
                      <div className="flex flex-wrap gap-2">
                        {records.slice(0, 5).map((record, idx) => (
                          <div key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                            {format(new Date(record.record_date), 'MMM d')}: {record.liters}L
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground italic">
                  No historical milking data available
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFeedingDetails = () => {
    const data = activity.activity_data;
    const distributions = data.distributions || [];
    const hasBulkDistribution = distributions.length > 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Wheat className="h-5 w-5 text-primary" />
          <span>Feeding Details</span>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Feed Type</span>
            <span className="font-semibold">{data.feed_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Quantity</span>
            <span className="font-semibold">{data.quantity} {data.unit || 'units'}</span>
          </div>
          {data.weight_per_unit && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weight per Unit</span>
              <span className="font-semibold">{data.weight_per_unit} kg</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Weight</span>
            <span className="text-xl font-bold text-primary">
              {data.total_kg || (data.quantity * (data.weight_per_unit || 1))} kg
            </span>
          </div>
        </div>

        {hasBulkDistribution ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Animals Fed</span>
              <Badge variant="outline">{distributions.length} animals</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Animal</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Proportion</TableHead>
                  <TableHead className="text-right">Feed Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributions.map((dist: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{dist.animal_name}</div>
                        <div className="text-sm text-muted-foreground">{dist.ear_tag}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{dist.weight_kg} kg</TableCell>
                    <TableCell className="text-right">{(dist.proportion * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-medium">{dist.feed_amount.toFixed(2)} kg</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="font-medium">Animals Fed ({animals.length})</span>
            <div className="space-y-2">
              {animals.map((animal) => (
                <div key={animal.id} className="flex items-center gap-3 p-2 border rounded">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={animal.avatar_url || undefined} />
                    <AvatarFallback>{animal.name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">{animal.name || 'Unnamed'}</div>
                    <div className="text-xs text-muted-foreground">{animal.ear_tag}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.notes && (
          <div className="space-y-1">
            <span className="text-sm font-medium">Notes</span>
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
              {data.notes}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderHealthDetails = () => {
    const notes = activity.activity_data.notes;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5 text-primary" />
          <span>Health Observation</span>
        </div>

        <div className="space-y-3">
          {animals.map((animal) => (
            <div key={animal.id} className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={animal.avatar_url || undefined} />
                  <AvatarFallback>{animal.name?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{animal.name || 'Unnamed Animal'}</div>
                  <div className="text-sm text-muted-foreground">
                    {animal.ear_tag && `Ear Tag: ${animal.ear_tag}`}
                  </div>
                </div>
              </div>
              
              {notes && (
                <div className="bg-muted/50 p-3 rounded text-sm">
                  <div className="font-medium mb-1">Observations</div>
                  <p className="text-muted-foreground">{notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWeightDetails = () => {
    const quantity = activity.activity_data.quantity;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Weight className="h-5 w-5 text-primary" />
          <span>Weight Measurement</span>
        </div>

        {animals.map((animal) => {
          const previousWeight = previousWeights.get(animal.id);
          const weightChange = previousWeight ? quantity - previousWeight : null;
          const percentChange = previousWeight ? (weightChange! / previousWeight) * 100 : null;
          const isSignificantChange = percentChange ? Math.abs(percentChange) > 20 : false;

          return (
            <div key={animal.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={animal.avatar_url || undefined} />
                  <AvatarFallback>{animal.name?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-semibold">{animal.name || 'Unnamed Animal'}</div>
                  <div className="text-sm text-muted-foreground">
                    {animal.ear_tag && `Ear Tag: ${animal.ear_tag}`}
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">New Weight</span>
                  <span className="text-2xl font-bold text-primary">{quantity} kg</span>
                </div>
                
                {previousWeight && (
                  <>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Previous Weight</span>
                      <span className="font-medium">{previousWeight} kg</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Change</span>
                      <div className="flex items-center gap-1">
                        {weightChange! > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={weightChange! > 0 ? 'text-green-600' : 'text-red-600'}>
                          {weightChange! > 0 ? '+' : ''}{weightChange!.toFixed(1)} kg 
                          ({percentChange! > 0 ? '+' : ''}{percentChange!.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {isSignificantChange && (
                      <div className="flex items-center gap-2 text-sm p-2 bg-orange-500/10 rounded border border-orange-500/20 mt-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-orange-700 dark:text-orange-400">
                          Significant weight change detected ({Math.abs(percentChange!).toFixed(0)}%)
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {activity.activity_data.notes && (
                <div className="text-sm">
                  <span className="font-medium">Notes: </span>
                  <span className="text-muted-foreground">{activity.activity_data.notes}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderInjectionDetails = () => {
    const data = activity.activity_data;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Syringe className="h-5 w-5 text-primary" />
          <span>Injection Record</span>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Medicine</span>
            <span className="font-semibold">{data.medicine_name}</span>
          </div>
          {data.dosage && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dosage</span>
              <span className="font-semibold">{data.dosage}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <span className="font-medium">Animals Treated ({animals.length})</span>
          <div className="space-y-2">
            {animals.map((animal) => (
              <div key={animal.id} className="flex items-center gap-3 p-3 border rounded">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={animal.avatar_url || undefined} />
                  <AvatarFallback>{animal.name?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{animal.name || 'Unnamed Animal'}</div>
                  <div className="text-sm text-muted-foreground">{animal.ear_tag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {data.notes && (
          <div className="space-y-1">
            <span className="text-sm font-medium">Instructions/Notes</span>
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
              {data.notes}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderActivitySpecificDetails = () => {
    if (isLoading) {
      return <div className="text-center py-8 text-muted-foreground">Loading details...</div>;
    }

    switch (activity.activity_type) {
      case 'milking':
        return renderMilkingDetails();
      case 'feeding':
        return renderFeedingDetails();
      case 'health_observation':
        return renderHealthDetails();
      case 'weight_measurement':
        return renderWeightDetails();
      case 'injection':
        return renderInjectionDetails();
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {getActivityIcon()}
                </div>
                <div>
                  <DialogTitle>{getActivityLabel(activity.activity_type)}</DialogTitle>
                  <DialogDescription className="mt-1">
                    Review submission details and approve or reject
                  </DialogDescription>
                </div>
              </div>
              {getStatusBadge()}
            </div>
          </DialogHeader>

          <Separator />

          <ScrollArea className="flex-1 max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Submitter Information */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Submitted By
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-semibold">{activity.submitter?.full_name || 'Unknown'}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {activity.submitter?.email || 'No email'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(activity.submitted_at), 'PPp')}
                    {' '}
                    ({formatDistanceToNow(new Date(activity.submitted_at), { addSuffix: true })})
                  </span>
                </div>
              </div>

              {/* Activity-Specific Details */}
              {renderActivitySpecificDetails()}

              {/* Auto-approve Timer */}
              {activity.auto_approve_at && activity.status === 'pending' && (
                <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">Auto-approval Scheduled</div>
                    <div className="text-sm text-muted-foreground">
                      Will auto-approve {formatDistanceToNow(new Date(activity.auto_approve_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {activity.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={isReviewing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isReviewing}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this activity. The farmhand will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Activity
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

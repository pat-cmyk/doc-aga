import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useGovernmentFeedback } from "@/hooks/useGovernmentFeedback";
import { formatDistanceToNow } from "date-fns";
import { Eye, CheckCircle, AlertCircle, Filter } from "lucide-react";

export const FeedbackPriorityQueue = () => {
  const [filters, setFilters] = useState<any>({});
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [department, setDepartment] = useState("");

  const { feedbackList, isLoading, updateStatus } = useGovernmentFeedback(filters);

  const handleAction = () => {
    if (!selectedFeedback || !newStatus) return;

    updateStatus({
      feedbackId: selectedFeedback.id,
      status: newStatus,
      notes: notes || undefined,
      actionTaken: actionTaken || undefined,
      assignedDepartment: department || undefined,
    });

    setActionDialog(false);
    setSelectedFeedback(null);
    setNotes("");
    setActionTaken("");
    setDepartment("");
  };

  const priorityColors = {
    critical: "destructive",
    high: "orange",
    medium: "blue",
    low: "secondary",
  };

  const categoryLabels: Record<string, string> = {
    policy_concern: "Policy",
    market_access: "Market",
    veterinary_support: "Veterinary",
    training_request: "Training",
    infrastructure: "Infrastructure",
    financial_assistance: "Financial",
    emergency_support: "Emergency",
    disease_outbreak: "Disease",
    feed_shortage: "Feed",
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading feedback queue...</div>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-wrap gap-2 flex-1">
            <Select
              value={filters.priority || "all"}
              onValueChange={(value) =>
                setFilters({ ...filters, priority: value === "all" ? undefined : value })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value === "all" ? undefined : value })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="action_taken">Action Taken</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {feedbackList && feedbackList.length > 0 ? (
          feedbackList.map((feedback: any) => (
            <Card key={feedback.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={priorityColors[feedback.auto_priority as keyof typeof priorityColors] as any}>
                          {feedback.auto_priority.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {categoryLabels[feedback.primary_category] || feedback.primary_category}
                        </Badge>
                        {feedback.sentiment === "urgent" && (
                          <Badge variant="destructive" className="text-xs">URGENT</Badge>
                        )}
                      </div>
                      <p className="font-medium">{feedback.ai_summary}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {feedback.farms 
                          ? `${feedback.farms.municipality || 'Unknown municipality'}, ${feedback.farms.province || 'Unknown province'}`
                          : 'Unknown location'} • {" "}
                        {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {feedback.detected_entities && (
                    <div className="flex flex-wrap gap-1">
                      {feedback.detected_entities.diseases?.map((d: string) => (
                        <Badge key={d} variant="destructive" className="text-xs">
                          🦠 {d}
                        </Badge>
                      ))}
                      {feedback.detected_entities.livestock_types?.map((l: string) => (
                        <Badge key={l} variant="secondary" className="text-xs">
                          🐄 {l}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedFeedback(feedback);
                        setActionDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View & Action
                    </Button>
                    {feedback.status === "submitted" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          updateStatus({
                            feedbackId: feedback.id,
                            status: "acknowledged",
                          });
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No feedback found matching filters</p>
          </Card>
        )}
      </div>

      <Dialog open={actionDialog} onOpenChange={setActionDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Farmer Feedback Details</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Farm Location:</p>
                <p className="text-sm text-muted-foreground">
                  {selectedFeedback.farms 
                    ? `${selectedFeedback.farms.name || 'Unknown farm'} - ${selectedFeedback.farms.municipality || 'Unknown municipality'}, ${selectedFeedback.farms.province || 'Unknown province'}`
                    : 'Unknown location'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Full Transcription:</p>
                <p className="text-sm p-3 bg-muted rounded">{selectedFeedback.transcription}</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">AI Summary:</p>
                <p className="text-sm">{selectedFeedback.ai_summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Priority Score:</p>
                  <p className="text-sm">{selectedFeedback.priority_score}/100</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Sentiment:</p>
                  <Badge variant={selectedFeedback.sentiment === "urgent" ? "destructive" : "secondary"}>
                    {selectedFeedback.sentiment}
                  </Badge>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Change Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="action_taken">Action Taken</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Assign to Department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />

                <Textarea
                  placeholder="Government Notes (visible to farmer)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />

                <Textarea
                  placeholder="Action Taken (what was done to address this)"
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={!newStatus}>
              Update Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

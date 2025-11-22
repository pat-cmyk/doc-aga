import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFarmerFeedback } from "@/hooks/useFarmerFeedback";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock, AlertCircle, FileText } from "lucide-react";

interface FarmerFeedbackListProps {
  farmId: string;
}

const statusConfig = {
  submitted: { label: "Naisumite", icon: Clock, color: "bg-blue-500" },
  acknowledged: { label: "Natanggap", icon: CheckCircle2, color: "bg-green-500" },
  under_review: { label: "Sinusuri", icon: AlertCircle, color: "bg-yellow-500" },
  action_taken: { label: "May Aksyon", icon: CheckCircle2, color: "bg-purple-500" },
  resolved: { label: "Nasolusyunan", icon: CheckCircle2, color: "bg-emerald-500" },
  closed: { label: "Sarado na", icon: FileText, color: "bg-gray-500" },
};

const priorityConfig = {
  critical: { label: "Kritikal", color: "destructive" },
  high: { label: "Mataas", color: "orange" },
  medium: { label: "Katamtaman", color: "blue" },
  low: { label: "Mababa", color: "secondary" },
};

const categoryLabels: Record<string, string> = {
  policy_concern: "Patakaran",
  market_access: "Pagbebenta",
  veterinary_support: "Veterinaryo",
  training_request: "Pagsasanay",
  infrastructure: "Imprastraktura",
  financial_assistance: "Tulong Pinansyal",
  emergency_support: "Emergency",
  disease_outbreak: "Sakit ng Hayop",
  feed_shortage: "Kakulangan ng Feeds",
};

export const FarmerFeedbackList = ({ farmId }: FarmerFeedbackListProps) => {
  const { feedbackList, isLoading } = useFarmerFeedback(farmId);

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!feedbackList || feedbackList.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Wala pang naisumiteng feedback</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {feedbackList.map((feedback) => {
        const status = statusConfig[feedback.status as keyof typeof statusConfig];
        const StatusIcon = status.icon;
        const priority = priorityConfig[feedback.auto_priority as keyof typeof priorityConfig];

        return (
          <Card key={feedback.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-full ${status.color}`}>
                <StatusIcon className="h-4 w-4 text-white" />
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium line-clamp-2">{feedback.ai_summary || feedback.transcription}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant={priority.color as any}>
                    {priority.label}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    {categoryLabels[feedback.primary_category] || feedback.primary_category}
                  </Badge>
                  {feedback.tags?.slice(0, 3).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm">
                    <span className="font-medium">Status:</span> {status.label}
                  </p>
                  {feedback.assigned_department && (
                    <p className="text-sm text-muted-foreground">
                      Department: {feedback.assigned_department}
                    </p>
                  )}
                  {feedback.government_notes && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <p className="font-medium text-xs mb-1">Government Response:</p>
                      <p>{feedback.government_notes}</p>
                    </div>
                  )}
                  {feedback.action_taken && (
                    <div className="mt-2 p-2 bg-emerald-50 rounded text-sm">
                      <p className="font-medium text-xs mb-1 text-emerald-700">Action Taken:</p>
                      <p className="text-emerald-900">{feedback.action_taken}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

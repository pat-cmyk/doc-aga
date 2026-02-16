import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock } from "lucide-react";
import { useCooperativePendingInvitations } from "@/hooks/useCooperative";

interface Props {
  cooperativeId: string;
}

export const CooperativePendingInvitations = ({ cooperativeId }: Props) => {
  const { data: invitations, isLoading } = useCooperativePendingInvitations(cooperativeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!invitations || invitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Pending Invitations ({invitations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((inv: any) => (
            <div key={inv.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{inv.invited_email}</p>
                <p className="text-xs text-muted-foreground">
                  {(inv.farms as any)?.name || "Unknown farm"} · Invited {new Date(inv.invited_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import {
  useUserInvitations,
  useRevokeUserInvitation,
  useResendUserInvitation,
} from "@/hooks/useUserInvitations";
import { Loader2, RefreshCw, Ban } from "lucide-react";
import { formatPHDate } from "@/lib/dateUtils";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "default",
  accepted: "secondary",
  revoked: "destructive",
  expired: "outline",
};

export const PendingInvitationsTable = () => {
  const { data: invitations, isLoading } = useUserInvitations();
  const revoke = useRevokeUserInvitation();
  const resend = useResendUserInvitation();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Invitations</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
          Loading invitations...
        </CardContent>
      </Card>
    );
  }

  const rows = invitations ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Invitations</CardTitle>
        <CardDescription>
          Pending and recent invitations for platform-level roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center py-6 text-sm text-muted-foreground">
            No invitations yet.
          </p>
        ) : (
          <Table style={{ minWidth: "800px" }}>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{inv.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant[inv.invitation_status] ?? "outline"}
                    >
                      {inv.invitation_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatPHDate(inv.invited_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatPHDate(inv.token_expires_at)}
                  </TableCell>
                  <TableCell>
                    {inv.invitation_status === "pending" ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Resend email"
                          disabled={resend.isPending}
                          onClick={() =>
                            resend.mutate(
                              { email: inv.email, role: inv.role },
                              {
                                onSuccess: () =>
                                  toast({
                                    title: "Invitation resent",
                                    description: `Email re-sent to ${inv.email}.`,
                                  }),
                                onError: (err) =>
                                  showErrorToastLegacy(
                                    toast,
                                    err,
                                    "resending invitation"
                                  ),
                              }
                            )
                          }
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Revoke"
                          disabled={revoke.isPending}
                          onClick={() =>
                            revoke.mutate(inv.id, {
                              onSuccess: () =>
                                toast({
                                  title: "Invitation revoked",
                                  description: `Invitation for ${inv.email} has been revoked.`,
                                }),
                              onError: (err) =>
                                showErrorToastLegacy(
                                  toast,
                                  err,
                                  "revoking invitation"
                                ),
                            })
                          }
                        >
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

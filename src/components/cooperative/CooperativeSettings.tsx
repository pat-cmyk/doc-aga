import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CooperativeInviteFarmDialog } from "./CooperativeInviteFarmDialog";
import { CooperativePendingInvitations } from "./CooperativePendingInvitations";

interface Props {
  cooperativeId: string;
  cooperativeName: string;
}

export const CooperativeSettings = ({ cooperativeId, cooperativeName }: Props) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cooperative Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <strong>Name:</strong> {cooperativeName}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Invite a Farm</CardTitle>
          <CooperativeInviteFarmDialog cooperativeId={cooperativeId} />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Invite farms by the owner's email address. The farm must already exist in the system.
          </p>
        </CardContent>
      </Card>

      <CooperativePendingInvitations cooperativeId={cooperativeId} />
    </div>
  );
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Header/back/nav come from the farm shell (UX redesign Phase 6).
const MessagingPage = () => (
  <Card>
    <CardHeader>
      <CardTitle>Conversations</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">
        Messaging system for farmer-merchant communication coming soon.
      </p>
    </CardContent>
  </Card>
);

export default MessagingPage;

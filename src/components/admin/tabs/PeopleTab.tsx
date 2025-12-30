import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ScrollText, Bug } from "lucide-react";
import { UserManagement } from "../UserManagement";
import { UserActivityLogs } from "../UserActivityLogs";
import { RoleDebugger } from "../RoleDebugger";
import { useSearchParams } from "react-router-dom";

export const PeopleTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subtab = searchParams.get("subtab") || "users";

  const handleSubtabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("subtab", value);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-6">
      <Tabs value={subtab} onValueChange={handleSubtabChange}>
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Activity Logs
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Role Debugger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <UserActivityLogs />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <RoleDebugger />
        </TabsContent>
      </Tabs>
    </div>
  );
};

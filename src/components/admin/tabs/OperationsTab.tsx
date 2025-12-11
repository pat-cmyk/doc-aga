import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Store, Ticket } from "lucide-react";
import { FarmOversight } from "../FarmOversight";
import MerchantOversight from "../MerchantOversight";
import { SupportTicketsTab } from "../SupportTicketsTab";
import { useSearchParams } from "react-router-dom";

export const OperationsTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subtab = searchParams.get("subtab") || "farms";

  const handleSubtabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("subtab", value);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-6">
      <Tabs value={subtab} onValueChange={handleSubtabChange}>
        <TabsList>
          <TabsTrigger value="farms" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Farms
          </TabsTrigger>
          <TabsTrigger value="merchants" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Merchants
          </TabsTrigger>
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Support Tickets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="farms" className="mt-6">
          <FarmOversight />
        </TabsContent>

        <TabsContent value="merchants" className="mt-6">
          <MerchantOversight />
        </TabsContent>

        <TabsContent value="tickets" className="mt-6">
          <SupportTicketsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Store, Ticket, BarChart3 } from "lucide-react";
import { FarmOversight } from "../FarmOversight";
import MerchantOversight from "../MerchantOversight";
import { SupportTicketsTab } from "../SupportTicketsTab";
import { DataEntryAnalytics } from "../DataEntryAnalytics";
import { useSearchParams } from "react-router-dom";
import { DataCategory } from "@/types/government";

interface OperationsTabProps {
  dataCategory?: DataCategory;
}

export const OperationsTab = ({ dataCategory = 'all' }: OperationsTabProps) => {
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
          <TabsTrigger value="entry-methods" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Entry Methods
          </TabsTrigger>
        </TabsList>

        <TabsContent value="farms" className="mt-6">
          <FarmOversight dataCategory={dataCategory} />
        </TabsContent>

        <TabsContent value="merchants" className="mt-6">
          <MerchantOversight />
        </TabsContent>

        <TabsContent value="tickets" className="mt-6">
          <SupportTicketsTab />
        </TabsContent>

        <TabsContent value="entry-methods" className="mt-6">
          <DataEntryAnalytics dataCategory={dataCategory} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

import { useState } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { InvoiceCard } from "./InvoiceCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";

export const InvoiceList = () => {
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const { invoices, isLoading } = useInvoices();

  const filteredInvoices = invoices.filter((invoice) => {
    if (paymentFilter === "paid") return invoice.is_paid;
    if (paymentFilter === "unpaid") return !invoice.is_paid;
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All Invoices</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredInvoices.length > 0 ? (
        <div className="space-y-4">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Invoices Found</h3>
          <p className="text-muted-foreground">
            {paymentFilter === "all"
              ? "Generate invoices from delivered orders"
              : `No ${paymentFilter} invoices`}
          </p>
        </div>
      )}
    </div>
  );
};

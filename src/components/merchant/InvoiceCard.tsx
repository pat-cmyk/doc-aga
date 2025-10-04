import { Invoice, useInvoices } from "@/hooks/useInvoices";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvoiceCardProps {
  invoice: Invoice;
}

export const InvoiceCard = ({ invoice }: InvoiceCardProps) => {
  const { markAsPaid, isMarkingPaid } = useInvoices();
  const { toast } = useToast();

  const handleMarkAsPaid = () => {
    markAsPaid(invoice.id, {
      onSuccess: () => {
        toast({
          title: "Invoice Updated",
          description: "Invoice marked as paid",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Update Failed",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold">{invoice.invoice_number}</h3>
            <p className="text-sm text-muted-foreground">
              Order: {invoice.order.order_number}
            </p>
            <p className="text-sm text-muted-foreground">
              Customer: {invoice.order.farmer.full_name || "N/A"}
            </p>
          </div>
          <Badge variant={invoice.is_paid ? "default" : "secondary"}>
            {invoice.is_paid ? "Paid" : "Unpaid"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Issued Date</span>
            <span>{format(new Date(invoice.issued_date), "MMM dd, yyyy")}</span>
          </div>
          {invoice.due_date && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due Date</span>
              <span>{format(new Date(invoice.due_date), "MMM dd, yyyy")}</span>
            </div>
          )}
          {invoice.is_paid && invoice.paid_date && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid Date</span>
              <span>{format(new Date(invoice.paid_date), "MMM dd, yyyy")}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax (16%)</span>
            <span>KES {invoice.tax_amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total Amount</span>
            <span>KES {invoice.amount.toLocaleString()}</span>
          </div>
        </div>
        {!invoice.is_paid && (
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={handleMarkAsPaid}
            disabled={isMarkingPaid}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark as Paid
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

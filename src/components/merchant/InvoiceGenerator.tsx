import { useState } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvoiceGeneratorProps {
  orderId: string;
  orderNumber: string;
}

export const InvoiceGenerator = ({ orderId, orderNumber }: InvoiceGeneratorProps) => {
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const { generateInvoice, isGenerating } = useInvoices();
  const { toast } = useToast();

  const handleGenerate = () => {
    generateInvoice(
      { orderId, dueDate: dueDate || undefined },
      {
        onSuccess: () => {
          toast({
            title: "Invoice Generated",
            description: `Invoice created for order ${orderNumber}`,
          });
          setOpen(false);
          setDueDate("");
        },
        onError: (error: any) => {
          toast({
            title: "Generation Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Generate Invoice
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="dueDate">Due Date (Optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-2"
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? "Generating..." : "Generate Invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

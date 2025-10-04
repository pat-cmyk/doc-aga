import { Invoice } from "@/hooks/useInvoices";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InvoicePreviewProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InvoicePreview = ({ invoice, open, onOpenChange }: InvoicePreviewProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Invoice Preview</DialogTitle>
        </DialogHeader>
        <div className="text-center py-8 text-muted-foreground">
          Invoice preview and printing functionality coming soon
        </div>
      </DialogContent>
    </Dialog>
  );
};

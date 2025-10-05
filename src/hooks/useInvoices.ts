import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Invoice {
  id: string;
  order_id: string;
  invoice_number: string;
  issued_date: string;
  due_date: string | null;
  amount: number;
  tax_amount: number;
  is_paid: boolean;
  paid_date: string | null;
  created_at: string;
  order: {
    order_number: string;
    farmer: {
      full_name: string | null;
    };
  };
}

export const useInvoices = () => {
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      // Get current user's merchant ID
      const { data: merchantData } = await supabase
        .from("merchants")
        .select("id")
        .single();

      if (!merchantData) throw new Error("Not a merchant");

      const { data: invoicesData, error } = await supabase
        .from("invoices")
        .select(`
          *,
          order:orders!inner(
            order_number,
            merchant_id,
            farmer_id
          )
        `)
        .eq("order.merchant_id", merchantData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get farmer names separately
      const invoicesWithFarmers = await Promise.all(
        (invoicesData || []).map(async (invoice) => {
          const { data: farmer } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", (invoice.order as any).farmer_id)
            .single();

          return {
            ...invoice,
            order: {
              ...(invoice.order as any),
              farmer: { full_name: farmer?.full_name || null },
            },
          };
        })
      );

      return invoicesWithFarmers as Invoice[];
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async ({ orderId, dueDate }: { orderId: string; dueDate?: string }) => {
      // Get order details
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      // Generate invoice number
      const { data: invoiceNumber, error: invoiceNumberError } = await supabase
        .rpc('generate_invoice_number');

      if (invoiceNumberError) throw invoiceNumberError;

      // Calculate tax (12% VAT for Philippines)
      const taxAmount = order.total_amount * 0.12;
      const totalWithTax = order.total_amount + taxAmount;

      // Create invoice
      const { error } = await supabase.from("invoices").insert({
        order_id: orderId,
        invoice_number: invoiceNumber,
        amount: totalWithTax,
        tax_amount: taxAmount,
        due_date: dueDate || null,
        issued_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({
          is_paid: true,
          paid_date: new Date().toISOString().split('T')[0],
        })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  return {
    invoices: invoices || [],
    isLoading,
    generateInvoice: generateInvoiceMutation.mutate,
    isGenerating: generateInvoiceMutation.isPending,
    markAsPaid: markAsPaidMutation.mutate,
    isMarkingPaid: markAsPaidMutation.isPending,
  };
};

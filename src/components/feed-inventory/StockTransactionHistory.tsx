import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FeedStockTransaction } from "@/lib/feedInventory";
import { useToast } from "@/hooks/use-toast";

interface StockTransactionHistoryProps {
  feedInventoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockTransactionHistory({
  feedInventoryId,
  open,
  onOpenChange,
}: StockTransactionHistoryProps) {
  const [transactions, setTransactions] = useState<FeedStockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedInfo, setFeedInfo] = useState<{ feed_type: string; unit: string; weight_per_unit?: number }>({ 
    feed_type: "", 
    unit: "kg" 
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && feedInventoryId) {
      fetchTransactions();
      fetchFeedType();
    }
  }, [feedInventoryId, open]);

  const fetchFeedType = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_inventory')
        .select('feed_type, unit, weight_per_unit')
        .eq('id', feedInventoryId)
        .single();

      if (error) throw error;
      setFeedInfo({
        feed_type: data.feed_type,
        unit: data.unit,
        weight_per_unit: data.weight_per_unit || undefined
      });
    } catch (error) {
      console.error('Error fetching feed info:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_stock_transactions')
        .select('*')
        .eq('feed_inventory_id', feedInventoryId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions((data as FeedStockTransaction[]) || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "Error",
        description: "Failed to load transaction history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Quantity Change', 'Balance After', 'Notes'];
    const rows = transactions.map(t => [
      format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
      t.transaction_type,
      t.quantity_change_kg,
      t.balance_after,
      t.notes || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${feedInfo.feed_type}_transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatBalance = (balanceKg: number) => {
    const needsConversion = feedInfo.unit === 'bags' || feedInfo.unit === 'bales' || feedInfo.unit === 'barrels';
    
    if (needsConversion && feedInfo.weight_per_unit) {
      const units = balanceKg / feedInfo.weight_per_unit;
      const unitLabel = feedInfo.unit === 'bags' ? 'bags' : feedInfo.unit === 'bales' ? 'bales' : 'barrels';
      return `${units.toFixed(1)} ${unitLabel} × ${feedInfo.weight_per_unit} kg = ${balanceKg.toLocaleString()} kg`;
    }
    
    return `${balanceKg.toLocaleString()} kg`;
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'addition':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'consumption':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'adjustment':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle>Transaction History</DialogTitle>
              <DialogDescription>
                {feedInfo.feed_type} - All stock movements
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions recorded yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Change (kg)</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Badge className={getTransactionColor(transaction.transaction_type)}>
                      {transaction.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={transaction.quantity_change_kg >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {transaction.quantity_change_kg >= 0 ? '+' : ''}
                      {transaction.quantity_change_kg.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatBalance(transaction.balance_after)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {transaction.notes || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

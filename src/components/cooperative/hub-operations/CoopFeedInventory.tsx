import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package } from "lucide-react";
import { useCoopFeedInventory } from "@/hooks/useCoopFeedInventory";
import { AddCoopFeedStockDialog } from "./AddCoopFeedStockDialog";
import { format } from "date-fns";

interface Props {
  cooperativeId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  roughage: "bg-green-100 text-green-800",
  concentrates: "bg-amber-100 text-amber-800",
  minerals: "bg-blue-100 text-blue-800",
  supplements: "bg-purple-100 text-purple-800",
};

export const CoopFeedInventory = ({ cooperativeId }: Props) => {
  const { data: inventory, isLoading } = useCoopFeedInventory(cooperativeId);

  const totalKg = inventory?.reduce((sum, i) => sum + i.quantity_kg, 0) || 0;
  const totalValue = inventory?.reduce((sum, i) => sum + i.total_value, 0) || 0;
  const itemCount = inventory?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Stock</p>
            <p className="text-2xl font-bold">{totalKg.toFixed(0)} kg</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">₱{totalValue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Items</p>
            <p className="text-2xl font-bold">{itemCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Hub Feed Inventory
          </CardTitle>
          <AddCoopFeedStockDialog cooperativeId={cooperativeId} />
        </CardHeader>
        <CardContent>
          {!inventory || inventory.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No feed stock in hub inventory.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feed Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock (kg)</TableHead>
                    <TableHead className="text-right">₱/kg</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.feed_type}</TableCell>
                      <TableCell>
                        <Badge className={CATEGORY_COLORS[item.category] || ""} variant="outline">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity_kg.toFixed(1)}</TableCell>
                      <TableCell className="text-right">₱{item.cost_per_kg.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₱{item.total_value.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.supplier || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.expiry_date ? format(new Date(item.expiry_date), "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

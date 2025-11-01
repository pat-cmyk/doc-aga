import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface FeedDistribution {
  animal_id: string;
  animal_name: string;
  ear_tag: string;
  weight_kg: number;
  proportion: number;
  feed_amount: number;
}

interface Feed {
  feed_type: string;
  quantity: number;
  unit: string;
  total_kg: number;
  weight_per_unit: number;
  notes?: string;
  distributions: FeedDistribution[];
}

interface BulkFeedingTableProps {
  feeds: Feed[];
  availableInventory: Array<{ id: string; feed_type: string; unit: string; weight_per_unit: number | null }>;
  onFeedChange: (index: number, field: 'feed_type' | 'quantity' | 'unit', value: string | number) => void;
}

/**
 * Table component for editing bulk feeding distribution across multiple animals
 * Shows editable feed types, quantities, and calculated distribution per animal
 */
export const BulkFeedingTable = ({ feeds, availableInventory, onFeedChange }: BulkFeedingTableProps) => {
  return (
    <div className="space-y-6">
      {feeds.map((feed, feedIndex) => (
        <div key={feedIndex} className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Feed Type {feedIndex + 1}</h4>
            <Badge variant="outline">{feed.distributions.length} animals</Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Feed Type</label>
              <Select
                value={feed.feed_type}
                onValueChange={(value) => onFeedChange(feedIndex, 'feed_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableInventory.map((item) => (
                    <SelectItem key={item.id} value={item.feed_type}>
                      {item.feed_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Quantity</label>
              <Input
                type="number"
                value={feed.quantity}
                onChange={(e) => onFeedChange(feedIndex, 'quantity', parseFloat(e.target.value))}
                min="0"
                step="0.1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Unit</label>
              <Input
                value={feed.unit}
                onChange={(e) => onFeedChange(feedIndex, 'unit', e.target.value)}
                placeholder="kg, bales, etc."
              />
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-medium text-foreground">{feed.total_kg.toFixed(2)} kg</span>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Animal</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Proportion</TableHead>
                <TableHead className="text-right">Feed Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feed.distributions.map((dist, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{dist.animal_name}</div>
                      <div className="text-sm text-muted-foreground">{dist.ear_tag}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{dist.weight_kg} kg</TableCell>
                  <TableCell className="text-right">{(dist.proportion * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-medium">{dist.feed_amount.toFixed(2)} kg</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
};

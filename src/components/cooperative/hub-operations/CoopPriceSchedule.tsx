import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Tag } from "lucide-react";
import { useCoopPriceSchedule } from "@/hooks/useCoopPriceSchedule";
import { SetMilkPriceDialog } from "./SetMilkPriceDialog";
import { format } from "date-fns";

interface Props {
  cooperativeId: string;
}

const SPECIES_LIST = ["cattle", "goat", "carabao", "sheep"] as const;

export const CoopPriceSchedule = ({ cooperativeId }: Props) => {
  const { data: prices, isLoading } = useCoopPriceSchedule(cooperativeId);

  // Get the current active price per species (first entry per species since sorted DESC)
  const activePrices = SPECIES_LIST.map((species) => {
    const entry = prices?.find((p) => p.species === species);
    return { species, price: entry?.price_per_liter ?? null, effectiveDate: entry?.effective_date ?? null };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Active Prices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Milk Price Schedule
          </CardTitle>
          <SetMilkPriceDialog cooperativeId={cooperativeId} />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {activePrices.map(({ species, price, effectiveDate }) => (
              <Card key={species} className="bg-muted/50">
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium capitalize text-muted-foreground">{species}</p>
                  {price !== null ? (
                    <>
                      <p className="text-2xl font-bold">₱{price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        per liter · since {effectiveDate ? format(new Date(effectiveDate), "MMM d") : "—"}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg text-muted-foreground">Not set</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Price History */}
      {prices && prices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Species</TableHead>
                  <TableHead>Price/Liter</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="capitalize">{entry.species}</TableCell>
                    <TableCell className="font-medium">₱{entry.price_per_liter.toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(entry.effective_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

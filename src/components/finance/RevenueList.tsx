import { useState } from "react";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenues, useDeleteRevenue, type Revenue } from "@/hooks/useRevenues";
import { getRevenueSourceIcon } from "@/lib/revenueCategories";
import { formatPHP } from "@/lib/currency";
import { AddRevenueDialog } from "./AddRevenueDialog";
import { DateRange } from "@/components/finance/FinanceDateRangePicker";

interface RevenueListProps {
  farmId: string;
  canManage: boolean;
  dateRange?: DateRange;
}

export function RevenueList({ farmId, canManage, dateRange }: RevenueListProps) {
  const { data: revenues, isLoading } = useRevenues(farmId, dateRange);
  const deleteRevenue = useDeleteRevenue();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editRevenue, setEditRevenue] = useState<Revenue | undefined>(undefined);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteRevenue.mutateAsync({ id: deleteId, farmId });
      setDeleteId(null);
    }
  };

  const isSystemGenerated = (revenue: Revenue) =>
    !!(revenue.linked_milk_log_id || revenue.linked_animal_id);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!revenues || revenues.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground mb-4">No revenues recorded yet</p>
        {canManage && (
          <AddRevenueDialog
            farmId={farmId}
            trigger={<Button>Add Your First Revenue</Button>}
          />
        )}
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {canManage && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {revenues.map((revenue) => (
              <TableRow key={revenue.id}>
                <TableCell className="font-medium">
                  {format(new Date(revenue.transaction_date), "MMM dd, yyyy")}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span>{getRevenueSourceIcon(revenue.source)}</span>
                    <span>{revenue.source}</span>
                    {isSystemGenerated(revenue) && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        Auto
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {revenue.notes || "-"}
                </TableCell>
                <TableCell className="text-right font-semibold text-green-600">
                  {formatPHP(Number(revenue.amount), true)}
                </TableCell>
                {canManage && (
                  <TableCell>
                    {!isSystemGenerated(revenue) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditRevenue(revenue)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(revenue.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-xs text-muted-foreground" title="System-generated from milk sale or animal sale">
                        &nbsp;
                      </span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Revenue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this revenue? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editRevenue && (
        <AddRevenueDialog
          farmId={farmId}
          revenue={editRevenue}
          trigger={<div />}
          onSuccess={() => setEditRevenue(undefined)}
        />
      )}
    </>
  );
}

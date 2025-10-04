import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Store, CheckCircle, XCircle, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

export const MerchantOversight = () => {
  const { data: merchants, isLoading, refetch } = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select(`
          *,
          products:products(count),
          orders:orders(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleVerifyMerchant = async (merchantId: string, verified: boolean) => {
    const { error } = await supabase
      .from("merchants")
      .update({ is_verified: verified })
      .eq("id", merchantId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update merchant status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Merchant ${verified ? "verified" : "suspended"} successfully`,
      });
      refetch();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const verifiedCount = merchants?.filter(m => m.is_verified).length || 0;
  const pendingCount = merchants?.filter(m => !m.is_verified).length || 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Merchants</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{merchants?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verifiedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <XCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Merchants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Merchant Management</CardTitle>
        </CardHeader>
        <CardContent>
          {merchants && merchants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants.map((merchant) => (
                  <TableRow key={merchant.id}>
                    <TableCell className="font-medium">{merchant.business_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{merchant.contact_email}</div>
                        <div className="text-muted-foreground">{merchant.contact_phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>{merchant.products?.[0]?.count || 0}</TableCell>
                    <TableCell>{merchant.orders?.[0]?.count || 0}</TableCell>
                    <TableCell>
                      {merchant.is_verified ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!merchant.is_verified ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerifyMerchant(merchant.id, true)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Verify
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerifyMerchant(merchant.id, false)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Suspend
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No merchants registered yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantOversight;

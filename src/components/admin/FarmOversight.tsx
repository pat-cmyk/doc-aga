import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export const FarmOversight = () => {
  const { data: farms, isLoading } = useQuery({
    queryKey: ["admin-farms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select(`
          id,
          name,
          region,
          created_at,
          profiles:owner_id (full_name),
          animals:animals(count)
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading farms...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Farm Oversight</CardTitle>
        <CardDescription>Monitor and manage all farms in the system</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Farm Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Animals</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {farms?.map((farm) => (
              <TableRow key={farm.id}>
                <TableCell className="font-medium">{farm.name}</TableCell>
                <TableCell>{farm.profiles?.full_name || "Unknown"}</TableCell>
                <TableCell>{farm.region || "N/A"}</TableCell>
                <TableCell>{farm.animals?.[0]?.count || 0}</TableCell>
                <TableCell>
                  {new Date(farm.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, TrendingUp, Image as ImageIcon, Filter, Download, Eye, Copy, AlertCircle, Mic } from "lucide-react";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { STTAnalyticsDashboard } from "./STTAnalyticsDashboard";

export const DocAgaManagement = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("analytics");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchFilter, setMatchFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "",
    is_active: true,
  });

  const { data: faqs, isLoading } = useQuery({
    queryKey: ["admin-faqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doc_aga_faqs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: queryStats } = useQuery({
    queryKey: ["admin-query-stats"],
    queryFn: async () => {
      const { count: totalCount } = await supabase
        .from("doc_aga_queries")
        .select("*", { count: "exact", head: true });

      const { count: unmatchedCount } = await supabase
        .from("doc_aga_queries")
        .select("*", { count: "exact", head: true })
        .is("matched_faq_id", null);

      const { count: imageCount } = await supabase
        .from("doc_aga_queries")
        .select("*", { count: "exact", head: true })
        .not("image_url", "is", null);

      return { 
        totalQueries: totalCount || 0,
        unmatchedQueries: unmatchedCount || 0,
        queriesWithImages: imageCount || 0,
      };
    },
  });

  const { data: recentQueries } = useQuery({
    queryKey: ["admin-recent-queries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doc_aga_queries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const { data: queryTimeline } = useQuery({
    queryKey: ["admin-query-timeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doc_aga_queries")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by date
      const grouped = data?.reduce((acc: any, query) => {
        const date = format(new Date(query.created_at), "MMM dd");
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(grouped || {}).map(([date, count]) => ({
        date,
        queries: count,
      }));
    },
  });

  const { data: faqsWithMatches } = useQuery({
    queryKey: ["admin-faqs-with-matches"],
    queryFn: async () => {
      const { data: faqsData, error: faqsError } = await supabase
        .from("doc_aga_faqs")
        .select("*")
        .order("created_at", { ascending: false });

      if (faqsError) throw faqsError;

      // Get match counts for each FAQ
      const faqsWithCounts = await Promise.all(
        (faqsData || []).map(async (faq) => {
          const { count } = await supabase
            .from("doc_aga_queries")
            .select("*", { count: "exact", head: true })
            .eq("matched_faq_id", faq.id);

          return { ...faq, matchCount: count || 0 };
        })
      );

      return faqsWithCounts.sort((a, b) => b.matchCount - a.matchCount);
    },
  });

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("doc_aga_faqs")
          .update(data)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("doc_aga_faqs")
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-faqs-with-matches"] });
      queryClient.invalidateQueries({ queryKey: ["admin-query-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-recent-queries"] });
      setIsDialogOpen(false);
      setEditingFaq(null);
      setFormData({ question: "", answer: "", category: "", is_active: true });
      toast({
        title: "Success",
        description: editingFaq ? "FAQ updated successfully" : "FAQ created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save FAQ: " + error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("doc_aga_faqs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      toast({
        title: "Success",
        description: "FAQ deleted successfully",
      });
    },
  });

  const handleEdit = (faq: any) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || "",
      is_active: faq.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      toast({
        title: "Validation Error",
        description: "Question and answer are required",
        variant: "destructive",
      });
      return;
    }

    if (editingFaq) {
      createOrUpdateMutation.mutate({ ...formData, id: editingFaq.id });
    } else {
      createOrUpdateMutation.mutate(formData);
    }
  };

  const handleExportCSV = () => {
    if (!recentQueries) return;

    const csv = [
      ["Question", "Answer", "Matched FAQ", "Has Image", "User ID", "Farm ID", "Created At"],
      ...recentQueries.map((q) => [
        q.question,
        q.answer || "",
        q.matched_faq_id ? "Yes" : "No",
        q.image_url ? "Yes" : "No",
        q.user_id || "",
        q.farm_id || "",
        format(new Date(q.created_at), "yyyy-MM-dd HH:mm:ss"),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doc-aga-queries-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Queries exported to CSV successfully",
    });
  };

  const handleExportFAQsCSV = () => {
    if (!faqsWithMatches) return;

    const csv = [
      ["Question", "Answer", "Category", "Status", "Match Count", "Created At"],
      ...faqsWithMatches.map((faq) => [
        faq.question,
        faq.answer,
        faq.category || "",
        faq.is_active ? "Active" : "Inactive",
        faq.matchCount || 0,
        format(new Date(faq.created_at), "yyyy-MM-dd HH:mm:ss"),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doc-aga-faqs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "FAQs exported to CSV successfully",
    });
  };

  const filteredQueries = recentQueries?.filter((q) => {
    const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      matchFilter === "all" ||
      (matchFilter === "matched" && q.matched_faq_id) ||
      (matchFilter === "unmatched" && !q.matched_faq_id) ||
      (matchFilter === "with-image" && q.image_url);

    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading Doc Aga data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queryStats?.totalQueries || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active FAQs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{faqs?.filter((f) => f.is_active).length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Knowledge base entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Unmatched Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queryStats?.unmatchedQueries || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Knowledge gaps to address</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-blue-500" />
              Queries with Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queryStats?.queriesWithImages || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Visual diagnostics</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Different Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="queries">Recent Queries</TabsTrigger>
          <TabsTrigger value="faqs">FAQ Management</TabsTrigger>
          <TabsTrigger value="voice-stt" className="flex items-center gap-1">
            <Mic className="h-3 w-3" />
            Voice STT
          </TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Query Timeline (Last 30 Days)</CardTitle>
              <CardDescription>Track Doc Aga usage over time</CardDescription>
            </CardHeader>
            <CardContent>
              {queryTimeline && queryTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={queryTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="queries" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No query data available for the last 30 days
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unmatched Queries</CardTitle>
              <CardDescription>Questions that didn't match any FAQ - consider adding these to knowledge base</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentQueries?.filter((q) => !q.matched_faq_id).slice(0, 10).map((query) => (
                  <div key={query.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{query.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(query.created_at), "MMM dd, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingFaq(null);
                        setFormData({
                          question: query.question,
                          answer: query.answer || "",
                          category: "",
                          is_active: true,
                        });
                        setIsDialogOpen(true);
                        setActiveTab("faqs");
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create FAQ
                    </Button>
                  </div>
                ))}
                {(!recentQueries || recentQueries.filter((q) => !q.matched_faq_id).length === 0) && (
                  <p className="text-center py-4 text-muted-foreground">No unmatched queries found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Queries Tab */}
        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Queries</CardTitle>
                  <CardDescription>Last 50 questions asked to Doc Aga</CardDescription>
                </div>
                <Button onClick={handleExportCSV} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              <div className="flex gap-2 mt-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search queries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select
                  className="px-3 py-2 border rounded-md bg-background"
                  value={matchFilter}
                  onChange={(e) => setMatchFilter(e.target.value)}
                >
                  <option value="all">All Queries</option>
                  <option value="matched">Matched FAQ</option>
                  <option value="unmatched">AI Generated</option>
                  <option value="with-image">With Image</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueries?.map((query) => (
                    <TableRow key={query.id}>
                      <TableCell className="max-w-md">
                        <p className="font-medium line-clamp-2">{query.question}</p>
                        {query.answer && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {query.answer}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={query.matched_faq_id ? "default" : "secondary"}>
                          {query.matched_faq_id ? "FAQ Match" : "AI Generated"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {query.image_url && <ImageIcon className="h-4 w-4 text-blue-500" />}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(query.created_at), "MMM dd, h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedQuery(query)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ Management Tab */}
        <TabsContent value="faqs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>FAQ Management</CardTitle>
                  <CardDescription>Manage Doc Aga's knowledge base</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleExportFAQsCSV} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingFaq(null);
                      setFormData({ question: "", answer: "", category: "", is_active: true });
                      setIsDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add FAQ
                  </Button>
                </div>
            </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Match Count</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faqsWithMatches?.map((faq) => (
                    <TableRow key={faq.id} className={faq.matchCount === 0 ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{faq.question}</TableCell>
                      <TableCell>{faq.category || "Uncategorized"}</TableCell>
                      <TableCell>
                        <Badge variant={faq.matchCount > 0 ? "default" : "secondary"}>
                          {faq.matchCount} matches
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={faq.is_active ? "default" : "secondary"}>
                          {faq.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(faq)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(faq.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice STT Analytics Tab */}
        <TabsContent value="voice-stt" className="space-y-4">
          <STTAnalyticsDashboard />
        </TabsContent>
      </Tabs>

      {/* FAQ Dialog - Always mounted */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingFaq ? "Edit FAQ" : "Create New FAQ"}</DialogTitle>
            <DialogDescription>
              Add or update FAQ entries for Doc Aga's knowledge base
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="What is the question?"
              />
            </div>
            <div>
              <Label htmlFor="answer">Answer</Label>
              <Textarea
                id="answer"
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                placeholder="Provide the answer..."
                rows={5}
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., health, breeding, feeding"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{editingFaq ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Query Detail Dialog */}
      <Dialog open={!!selectedQuery} onOpenChange={() => setSelectedQuery(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Query Details</DialogTitle>
            <DialogDescription>
              {selectedQuery && format(new Date(selectedQuery.created_at), "MMMM dd, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>
          {selectedQuery && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Question</Label>
                <p className="mt-1 text-sm">{selectedQuery.question}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Answer</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedQuery.answer || "No answer recorded"}</p>
              </div>
              {selectedQuery.image_url && (
                <div>
                  <Label className="text-sm font-semibold">Attached Image</Label>
                  <img
                    src={selectedQuery.image_url}
                    alt="Query attachment"
                    className="mt-2 rounded-lg max-h-64 object-contain"
                  />
                </div>
              )}
              <div className="flex gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">User ID</Label>
                  <p className="flex items-center gap-1 mt-1">
                    {selectedQuery.user_id || "Anonymous"}
                    {selectedQuery.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedQuery.user_id);
                          toast({ title: "Copied to clipboard" });
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Farm ID</Label>
                  <p className="flex items-center gap-1 mt-1">
                    {selectedQuery.farm_id || "N/A"}
                    {selectedQuery.farm_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedQuery.farm_id);
                          toast({ title: "Copied to clipboard" });
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="mt-1">
                    <Badge variant={selectedQuery.matched_faq_id ? "default" : "secondary"}>
                      {selectedQuery.matched_faq_id ? "FAQ Match" : "AI Generated"}
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelectedQuery(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

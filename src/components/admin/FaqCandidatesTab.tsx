import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Check, X, Edit, RefreshCw, Lightbulb, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FaqCandidate {
  id: string;
  question_pattern: string;
  normalized_text: string;
  occurrence_count: number;
  sample_query_ids: string[];
  suggested_answer: string | null;
  suggested_category: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  created_at: string;
  updated_at: string;
}

export const FaqCandidatesTab = () => {
  const queryClient = useQueryClient();
  const [selectedCandidate, setSelectedCandidate] = useState<FaqCandidate | null>(null);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [expandedSamples, setExpandedSamples] = useState<Set<string>>(new Set());
  const [sampleQueries, setSampleQueries] = useState<Record<string, any[]>>({});
  const [convertFormData, setConvertFormData] = useState({
    question: "",
    answer: "",
    category: ""
  });
  const [isExtracting, setIsExtracting] = useState(false);

  // Fetch FAQ candidates
  const { data: candidates, isLoading } = useQuery({
    queryKey: ["admin-faq-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faq_candidates")
        .select("*")
        .order("occurrence_count", { ascending: false });

      if (error) throw error;
      return data as FaqCandidate[];
    },
  });

  // Run extraction
  const handleRunExtraction = async () => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-faq-candidates');
      
      if (error) throw error;
      
      toast({
        title: "Extraction Complete",
        description: `Processed ${data?.queriesProcessed || 0} queries, found ${data?.clustersFound || 0} clusters`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["admin-faq-candidates"] });
    } catch (error: any) {
      toast({
        title: "Extraction Failed",
        description: error.message || "Could not run FAQ extraction",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Load sample queries for a candidate
  const loadSampleQueries = async (candidateId: string, queryIds: string[]) => {
    if (sampleQueries[candidateId]) return;
    
    const { data, error } = await supabase
      .from("doc_aga_queries")
      .select("id, question, answer, created_at")
      .in("id", queryIds);

    if (!error && data) {
      setSampleQueries(prev => ({ ...prev, [candidateId]: data }));
    }
  };

  // Toggle sample expansion
  const toggleSamples = (candidateId: string, queryIds: string[]) => {
    const newExpanded = new Set(expandedSamples);
    if (newExpanded.has(candidateId)) {
      newExpanded.delete(candidateId);
    } else {
      newExpanded.add(candidateId);
      loadSampleQueries(candidateId, queryIds);
    }
    setExpandedSamples(newExpanded);
  };

  // Update candidate status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("faq_candidates")
        .update({ 
          status, 
          reviewed_at: new Date().toISOString() 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faq-candidates"] });
      toast({ title: "Status updated" });
    },
  });

  // Convert to FAQ
  const convertToFaqMutation = useMutation({
    mutationFn: async (data: { candidateId: string; question: string; answer: string; category: string }) => {
      // Create the FAQ
      const { data: newFaq, error: faqError } = await supabase
        .from("doc_aga_faqs")
        .insert({
          question: data.question,
          answer: data.answer,
          category: data.category || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (faqError) throw faqError;

      // Update the candidate
      const { error: updateError } = await supabase
        .from("faq_candidates")
        .update({
          status: "converted",
          converted_faq_id: newFaq.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", data.candidateId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faq-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-faqs-with-matches"] });
      setIsConvertDialogOpen(false);
      setSelectedCandidate(null);
      setConvertFormData({ question: "", answer: "", category: "" });
      toast({ title: "FAQ created successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create FAQ",
        variant: "destructive",
      });
    },
  });

  const openConvertDialog = (candidate: FaqCandidate) => {
    setSelectedCandidate(candidate);
    setConvertFormData({
      question: candidate.question_pattern,
      answer: candidate.suggested_answer || "",
      category: candidate.suggested_category || "",
    });
    setIsConvertDialogOpen(true);
  };

  const handleConvert = () => {
    if (!selectedCandidate || !convertFormData.question || !convertFormData.answer) {
      toast({
        title: "Validation Error",
        description: "Question and answer are required",
        variant: "destructive",
      });
      return;
    }

    convertToFaqMutation.mutate({
      candidateId: selectedCandidate.id,
      question: convertFormData.question,
      answer: convertFormData.answer,
      category: convertFormData.category,
    });
  };

  const pendingCandidates = candidates?.filter(c => c.status === 'pending') || [];
  const processedCandidates = candidates?.filter(c => c.status !== 'pending') || [];

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                FAQ Candidates
              </CardTitle>
              <CardDescription>
                Automatically extracted frequent questions from farmers. Review and convert to FAQ entries.
              </CardDescription>
            </div>
            <Button onClick={handleRunExtraction} disabled={isExtracting}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isExtracting ? 'animate-spin' : ''}`} />
              {isExtracting ? "Extracting..." : "Run Extraction"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Pending Candidates */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Review ({pendingCandidates.length})</CardTitle>
          <CardDescription>Questions that appear frequently and may need FAQ entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question Pattern</TableHead>
                <TableHead>Occurrences</TableHead>
                <TableHead>First Seen</TableHead>
                <TableHead>Samples</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingCandidates.map((candidate) => (
                <>
                  <TableRow key={candidate.id}>
                    <TableCell className="max-w-md">
                      <p className="font-medium">{candidate.question_pattern}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {candidate.occurrence_count}x
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(candidate.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSamples(candidate.id, candidate.sample_query_ids || [])}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {expandedSamples.has(candidate.id) ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openConvertDialog(candidate)}
                          title="Convert to FAQ"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: candidate.id, status: 'rejected' })}
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedSamples.has(candidate.id) && sampleQueries[candidate.id] && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/50">
                        <div className="p-2 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Sample Questions:</p>
                          {sampleQueries[candidate.id].map((q) => (
                            <div key={q.id} className="p-2 bg-background rounded border text-sm">
                              <p className="font-medium">"{q.question}"</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(q.created_at), "MMM dd, h:mm a")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {pendingCandidates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No pending candidates. Run extraction to find patterns.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Processed Candidates */}
      {processedCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processed ({processedCandidates.length})</CardTitle>
            <CardDescription>Previously reviewed candidates</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question Pattern</TableHead>
                  <TableHead>Occurrences</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedCandidates.slice(0, 10).map((candidate) => (
                  <TableRow key={candidate.id} className="opacity-70">
                    <TableCell className="max-w-md">
                      <p className="line-clamp-1">{candidate.question_pattern}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{candidate.occurrence_count}x</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          candidate.status === 'converted' ? 'default' : 
                          candidate.status === 'rejected' ? 'destructive' : 'secondary'
                        }
                      >
                        {candidate.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {candidate.updated_at && format(new Date(candidate.updated_at), "MMM dd")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Convert to FAQ Dialog */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convert to FAQ</DialogTitle>
            <DialogDescription>
              Create a new FAQ entry from this candidate. Review and edit the question and answer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="convert-question">Question</Label>
              <Textarea
                id="convert-question"
                value={convertFormData.question}
                onChange={(e) => setConvertFormData({ ...convertFormData, question: e.target.value })}
                placeholder="The question farmers ask"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="convert-answer">Answer</Label>
              <Textarea
                id="convert-answer"
                value={convertFormData.answer}
                onChange={(e) => setConvertFormData({ ...convertFormData, answer: e.target.value })}
                placeholder="Provide a helpful answer in Taglish..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Write the answer as Doc Aga would speak - friendly, practical, in Taglish
              </p>
            </div>
            <div>
              <Label htmlFor="convert-category">Category</Label>
              <Input
                id="convert-category"
                value={convertFormData.category}
                onChange={(e) => setConvertFormData({ ...convertFormData, category: e.target.value })}
                placeholder="e.g., health, breeding, feeding, general"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConvert}
              disabled={convertToFaqMutation.isPending}
            >
              {convertToFaqMutation.isPending ? "Creating..." : "Create FAQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

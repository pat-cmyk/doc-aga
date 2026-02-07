import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getUnmatchedTopics, QueryWithTopic, TopicStats, TopicLabel } from "@/lib/queryTopicCategorizer";
import { Plus, Tag, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface TopicBrowseCardProps {
  queries: QueryWithTopic[] | undefined;
  onCreateFaq: (query: QueryWithTopic) => void;
}

export const TopicBrowseCard = ({ queries, onCreateFaq }: TopicBrowseCardProps) => {
  const [selectedTopic, setSelectedTopic] = useState<TopicLabel | null>(null);
  
  const unmatchedTopics = useMemo(() => {
    if (!queries) return [];
    return getUnmatchedTopics(queries);
  }, [queries]);

  const selectedTopicData = useMemo(() => {
    if (!selectedTopic) return null;
    return unmatchedTopics.find(t => t.topic === selectedTopic) || null;
  }, [selectedTopic, unmatchedTopics]);

  const unmatchedQueries = useMemo(() => {
    if (!selectedTopicData) return [];
    return selectedTopicData.queries
      .filter(q => !q.matched_faq_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [selectedTopicData]);

  if (!queries || queries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Browse by Topic
          </CardTitle>
          <CardDescription>Explore unmatched queries by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No query data available
          </div>
        </CardContent>
      </Card>
    );
  }

  if (unmatchedTopics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Browse by Topic
          </CardTitle>
          <CardDescription>Explore unmatched queries by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            🎉 All queries are matched to FAQs! Great coverage.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          Browse Unmatched Queries by Topic
        </CardTitle>
        <CardDescription>
          Select a topic to view unmatched queries and create FAQs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Topic Pills */}
        <div className="flex flex-wrap gap-2">
          {unmatchedTopics.map((topic) => {
            const isSelected = selectedTopic === topic.topic;
            const isHighPriority = topic.unmatched > 10;
            
            return (
              <Button
                key={topic.key}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={`gap-2 ${isHighPriority && !isSelected ? 'border-destructive text-destructive hover:bg-destructive/10' : ''}`}
                onClick={() => setSelectedTopic(isSelected ? null : topic.topic)}
              >
                <Tag className="h-3 w-3" />
                {topic.topic.length > 20 ? topic.topic.substring(0, 18) + '...' : topic.topic}
                <Badge 
                  variant={isHighPriority ? "destructive" : "secondary"} 
                  className="ml-1 h-5 px-1.5 text-xs"
                >
                  {topic.unmatched}
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* Query List for Selected Topic */}
        {selectedTopicData && (
          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{selectedTopicData.topic}</span>
                </div>
                <Badge variant="outline">
                  {unmatchedQueries.length} unmatched
                </Badge>
              </div>
            </div>
            
            <ScrollArea className="h-[300px]">
              <div className="p-2 space-y-2">
                {unmatchedQueries.map((query) => (
                  <div 
                    key={query.id} 
                    className="flex items-start justify-between gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">
                        "{query.question}"
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(query.created_at), "MMM dd, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => onCreateFaq(query)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Create FAQ
                    </Button>
                  </div>
                ))}
                
                {unmatchedQueries.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No unmatched queries in this topic
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {!selectedTopic && (
          <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
            Select a topic above to browse its unmatched queries
          </div>
        )}
      </CardContent>
    </Card>
  );
};

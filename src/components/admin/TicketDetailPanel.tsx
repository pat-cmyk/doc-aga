import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Send, 
  User, 
  Building2, 
  Clock, 
  MessageSquare,
  Lock,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { useSupportTicket, useSupportTickets, TicketStatus, TicketPriority } from "@/hooks/useSupportTickets";
import { Checkbox } from "@/components/ui/checkbox";

interface TicketDetailPanelProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_customer", label: "Waiting on Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const TicketDetailPanel = ({
  ticketId,
  open,
  onOpenChange,
}: TicketDetailPanelProps) => {
  const { ticket, comments, isLoading, commentsLoading, addComment } = useSupportTicket(ticketId);
  const { updateTicket } = useSupportTickets();
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  // Fetch admins for assignment
  const { data: admins } = useQuery({
    queryKey: ["admin-assignees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles!user_roles_user_id_fkey(id, full_name)
        `)
        .eq("role", "admin");
      if (error) throw error;
      return data?.map((d) => ({
        id: d.user_id,
        full_name: (d.profiles as any)?.full_name || "Unknown Admin",
      })) || [];
    },
    enabled: open,
  });

  const handleStatusChange = (status: TicketStatus) => {
    if (!ticketId) return;
    
    const updates: any = { status };
    if (status === "resolved") {
      updates.resolved_at = new Date().toISOString();
    } else if (status === "closed") {
      updates.closed_at = new Date().toISOString();
    }
    
    updateTicket.mutate({ ticketId, updates });
  };

  const handlePriorityChange = (priority: TicketPriority) => {
    if (!ticketId) return;
    updateTicket.mutate({ ticketId, updates: { priority } });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    if (!ticketId) return;
    updateTicket.mutate({
      ticketId,
      updates: { assigned_to: assigneeId || null },
    });
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    await addComment.mutateAsync({
      content: newComment,
      isInternal,
    });
    
    setNewComment("");
    setIsInternal(false);
  };

  if (!ticketId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="font-mono text-sm">{ticket?.ticket_number}</span>
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {ticket?.subject}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : ticket ? (
          <div className="flex flex-col flex-1 overflow-hidden mt-4">
            {/* Ticket Controls */}
            <div className="grid grid-cols-3 gap-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={ticket.status}
                  onValueChange={(v) => handleStatusChange(v as TicketStatus)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select
                  value={ticket.priority}
                  onValueChange={(v) => handlePriorityChange(v as TicketPriority)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Assigned To</Label>
                <Select
                  value={ticket.assigned_to || ""}
                  onValueChange={handleAssigneeChange}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {admins?.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Linked Resources */}
            {(ticket.linked_farm || ticket.linked_user) && (
              <div className="py-3 space-y-2">
                {ticket.linked_farm && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>Farm: {ticket.linked_farm.name}</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {ticket.linked_user && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>User: {ticket.linked_user.full_name}</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <Separator />
              </div>
            )}

            {/* Description */}
            {ticket.description && (
              <div className="py-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {ticket.description}
                </p>
                <Separator className="mt-3" />
              </div>
            )}

            {/* Comments Section */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 py-2">
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm font-medium">Comments ({comments.length})</span>
              </div>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-3 pb-4">
                  {commentsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No comments yet
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-3 rounded-lg ${
                          comment.is_internal
                            ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium flex items-center gap-1">
                            {comment.author?.full_name || "Unknown"}
                            {comment.is_internal && (
                              <Badge variant="outline" className="text-xs ml-1">
                                <Lock className="h-2 w-2 mr-1" />
                                Internal
                              </Badge>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), "MMM d, HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Add Comment */}
              <div className="pt-3 border-t space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="internal"
                      checked={isInternal}
                      onCheckedChange={(c) => setIsInternal(c === true)}
                    />
                    <label
                      htmlFor="internal"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Internal note (not visible to customer)
                    </label>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addComment.isPending}
                  >
                    {addComment.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer Info */}
            <div className="pt-3 border-t text-xs text-muted-foreground flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Created {format(new Date(ticket.created_at), "MMM d, yyyy HH:mm")}
              </span>
              {ticket.creator && (
                <span>by {ticket.creator.full_name}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1">
            <p className="text-muted-foreground">Ticket not found</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

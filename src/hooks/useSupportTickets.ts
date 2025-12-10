import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type TicketStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  created_by: string | null;
  assigned_to: string | null;
  linked_farm_id: string | null;
  linked_user_id: string | null;
  linked_animal_id: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  // Joined data
  creator?: { full_name: string | null; email?: string };
  assignee?: { full_name: string | null };
  linked_farm?: { name: string };
  linked_user?: { full_name: string | null };
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: { full_name: string | null };
}

export interface CreateTicketData {
  subject: string;
  description?: string;
  priority: TicketPriority;
  linked_farm_id?: string;
  linked_user_id?: string;
  linked_animal_id?: string;
  tags?: string[];
}

export function useSupportTickets(filters?: {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  assignedTo?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ["support-tickets", filters],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select(`
          *,
          creator:profiles!support_tickets_created_by_fkey(full_name),
          assignee:profiles!support_tickets_assigned_to_fkey(full_name),
          linked_farm:farms!support_tickets_linked_farm_id_fkey(name),
          linked_user:profiles!support_tickets_linked_user_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status.length > 0) {
        query = query.in("status", filters.status);
      }
      if (filters?.priority && filters.priority.length > 0) {
        query = query.in("priority", filters.priority);
      }
      if (filters?.assignedTo) {
        query = query.eq("assigned_to", filters.assignedTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SupportTicket[];
    },
  });

  const createTicket = useMutation({
    mutationFn: async (ticketData: CreateTicketData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const insertData: Record<string, any> = {
        subject: ticketData.subject,
        description: ticketData.description || null,
        priority: ticketData.priority,
        created_by: user.id,
        linked_farm_id: ticketData.linked_farm_id || null,
        linked_user_id: ticketData.linked_user_id || null,
        linked_animal_id: ticketData.linked_animal_id || null,
        tags: ticketData.tags || null,
      };

      const { data, error } = await supabase
        .from("support_tickets")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Ticket Created",
        description: `Ticket ${data.ticket_number} has been created.`,
      });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTicket = useMutation({
    mutationFn: async ({
      ticketId,
      updates,
    }: {
      ticketId: string;
      updates: Partial<{
        status: TicketStatus;
        priority: TicketPriority;
        assigned_to: string | null;
        resolved_at: string | null;
        closed_at: string | null;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Ticket Updated",
        description: "The ticket has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    tickets: tickets || [],
    isLoading,
    error,
    createTicket,
    updateTicket,
  };
}

export function useSupportTicket(ticketId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["support-ticket", ticketId],
    queryFn: async () => {
      if (!ticketId) return null;

      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          creator:profiles!support_tickets_created_by_fkey(full_name),
          assignee:profiles!support_tickets_assigned_to_fkey(full_name),
          linked_farm:farms!support_tickets_linked_farm_id_fkey(name),
          linked_user:profiles!support_tickets_linked_user_id_fkey(full_name)
        `)
        .eq("id", ticketId)
        .single();

      if (error) throw error;
      return data as SupportTicket;
    },
    enabled: !!ticketId,
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["ticket-comments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];

      const { data, error } = await supabase
        .from("ticket_comments")
        .select(`
          *,
          author:profiles!ticket_comments_author_id_fkey(full_name)
        `)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TicketComment[];
    },
    enabled: !!ticketId,
  });

  const addComment = useMutation({
    mutationFn: async ({
      content,
      isInternal = false,
    }: {
      content: string;
      isInternal?: boolean;
    }) => {
      if (!ticketId) throw new Error("No ticket selected");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("ticket_comments")
        .insert({
          ticket_id: ticketId,
          author_id: user.id,
          content,
          is_internal: isInternal,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    ticket,
    comments: comments || [],
    isLoading,
    commentsLoading,
    addComment,
  };
}

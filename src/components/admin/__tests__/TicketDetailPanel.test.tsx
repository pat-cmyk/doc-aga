import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { TicketDetailPanel } from '../TicketDetailPanel';

// Regression test: Radix Select throws at mount if a <SelectItem> has value=""
// (SelectContent children render into a hidden DocumentFragment even while
// closed), which crashed the whole panel for tickets with no assignee.

vi.mock('@/hooks/useSupportTickets', () => ({
  useSupportTicket: vi.fn(),
  useSupportTickets: vi.fn(),
}));

import { useSupportTicket, useSupportTickets } from '@/hooks/useSupportTickets';

const baseTicket = {
  id: 'ticket-1',
  ticket_number: 'TKT-0001',
  subject: 'Milk sync issue',
  description: 'Milk records not syncing',
  status: 'open',
  priority: 'medium',
  assigned_to: null,
  linked_farm: null,
  linked_user: null,
  creator: { full_name: 'Admin One' },
  created_at: '2026-08-01T08:00:00Z',
};

describe('TicketDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSupportTicket as any).mockReturnValue({
      ticket: baseTicket,
      comments: [],
      isLoading: false,
      commentsLoading: false,
      addComment: { mutateAsync: vi.fn(), isPending: false },
    });
    (useSupportTickets as any).mockReturnValue({
      updateTicket: { mutate: vi.fn() },
    });
  });

  it('mounts without crashing when the ticket has no assignee', () => {
    renderWithProviders(
      <TicketDetailPanel ticketId="ticket-1" open={true} onOpenChange={() => {}} />
    );

    expect(screen.getByText('TKT-0001')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('mounts without crashing when the ticket has an assignee', () => {
    (useSupportTicket as any).mockReturnValue({
      ticket: { ...baseTicket, assigned_to: 'admin-1' },
      comments: [],
      isLoading: false,
      commentsLoading: false,
      addComment: { mutateAsync: vi.fn(), isPending: false },
    });

    renderWithProviders(
      <TicketDetailPanel ticketId="ticket-1" open={true} onOpenChange={() => {}} />
    );

    expect(screen.getByText('TKT-0001')).toBeInTheDocument();
  });
});

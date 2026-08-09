import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { TicketDetailPanel } from "../TicketDetailPanel";

let mockAssignedTo: string | null = null;

// jsdom doesn't implement these, but Radix Select's Sheet-nested popper needs
// them on mount/interaction — without stubs the effect throws and the
// dropdown never opens.
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.setPointerCapture = vi.fn();

const updateTicketMutate = vi.fn();

vi.mock("@/hooks/useSupportTickets", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useSupportTickets")>(
    "@/hooks/useSupportTickets",
  );
  return {
    ...actual,
    useSupportTicket: () => ({
      ticket: {
        id: "ticket-1",
        ticket_number: "TKT-2608-0002",
        subject: "Something Went Wrong",
        description: "Auto-generated from a one-tap error report.",
        status: "open",
        priority: "high",
        created_by: "user-1",
        // Regression trigger: an unassigned ticket previously rendered
        // <SelectItem value=""> which Radix Select v2 throws on at mount,
        // crashing the whole panel the moment it opened.
        get assigned_to() {
          return mockAssignedTo;
        },
        linked_farm_id: null,
        linked_user_id: "user-1",
        linked_animal_id: null,
        tags: ["auto-error"],
        created_at: "2026-08-09T10:55:00.000Z",
        updated_at: "2026-08-09T10:55:00.000Z",
        resolved_at: null,
        closed_at: null,
        creator: { full_name: "Pat Erick Buna" },
      },
      comments: [],
      isLoading: false,
      commentsLoading: false,
      addComment: { mutateAsync: vi.fn(), isPending: false },
    }),
    useSupportTickets: () => ({
      tickets: [],
      isLoading: false,
      error: null,
      createTicket: { mutateAsync: vi.fn(), isPending: false },
      updateTicket: { mutate: updateTicketMutate, isPending: false },
    }),
  };
});

// The panel queries admin assignees directly via the supabase client.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              {
                user_id: "admin-1",
                profiles: { id: "admin-1", full_name: "Admin One" },
              },
            ],
            error: null,
          }),
      }),
    }),
  },
}));

describe("TicketDetailPanel", () => {
  beforeEach(() => {
    updateTicketMutate.mockClear();
    mockAssignedTo = null;
  });

  it("renders an unassigned ticket without crashing (regression: empty-string SelectItem)", () => {
    renderWithProviders(
      <TicketDetailPanel ticketId="ticket-1" open={true} onOpenChange={vi.fn()} />,
    );

    // The old code threw during render before anything could appear.
    expect(screen.getByText("TKT-2608-0002")).toBeInTheDocument();
    expect(screen.getByText("Something Went Wrong")).toBeInTheDocument();
    // Radix mounts the closed dropdown's items into a hidden fragment, so the
    // sentinel "Unassigned" item exists (and no longer throws).
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
  });

  it("maps the Unassigned sentinel back to null when chosen", async () => {
    mockAssignedTo = "admin-1"; // start assigned so choosing Unassigned is a real change
    renderWithProviders(
      <TicketDetailPanel ticketId="ticket-1" open={true} onOpenChange={vi.fn()} />,
    );

    const assigneeLabel = screen.getByText("Assigned To");
    const assigneeContainer = assigneeLabel.parentElement as HTMLElement;
    const trigger = within(assigneeContainer).getByRole("combobox");

    fireEvent.click(trigger);
    const option = await screen.findByText("Unassigned");
    fireEvent.click(option);

    expect(updateTicketMutate).toHaveBeenCalledWith({
      ticketId: "ticket-1",
      updates: { assigned_to: null },
    });
  });
});

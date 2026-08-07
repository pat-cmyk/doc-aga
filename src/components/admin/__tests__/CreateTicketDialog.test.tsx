import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { CreateTicketDialog } from "../CreateTicketDialog";

// jsdom doesn't implement these, but Radix Select needs them on mount —
// without stubs the effect throws (see ErrorMonitoringTab.test.tsx).
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.setPointerCapture = vi.fn();

const createTicketMutateAsync = vi.fn();

vi.mock("@/hooks/useSupportTickets", () => ({
  useSupportTickets: () => ({
    createTicket: { mutateAsync: createTicketMutateAsync, isPending: false },
  }),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
  getIsOnline: () => true,
}));

// Local override of the global supabase mock (src/test-setup.ts) — this
// component's farm/user lookups chain `.select().eq().order().limit()`,
// which the default mock doesn't implement.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

describe("CreateTicketDialog seeding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds only on the false->true open transition, not on every re-render while open", () => {
    const { rerender } = renderWithProviders(
      <CreateTicketDialog open={true} onOpenChange={vi.fn()} initialSubject="A" />,
    );

    const subjectInput = screen.getByLabelText(/Subject/i) as HTMLInputElement;
    expect(subjectInput.value).toBe("A");

    // User edits the field.
    fireEvent.change(subjectInput, { target: { value: "B" } });
    expect(subjectInput.value).toBe("B");

    // Parent re-renders with a changed initialSubject while still open (e.g. a
    // background refetch of the source error/ticket data) — must NOT clobber
    // the user's in-progress edit.
    rerender(
      <CreateTicketDialog open={true} onOpenChange={vi.fn()} initialSubject="C" />,
    );
    expect(subjectInput.value).toBe("B");

    // Close, then reopen with the latest initialSubject — now it should seed.
    rerender(
      <CreateTicketDialog open={false} onOpenChange={vi.fn()} initialSubject="C" />,
    );
    rerender(
      <CreateTicketDialog open={true} onOpenChange={vi.fn()} initialSubject="C" />,
    );

    const reseededInput = screen.getByLabelText(/Subject/i) as HTMLInputElement;
    expect(reseededInput.value).toBe("C");
  });
});

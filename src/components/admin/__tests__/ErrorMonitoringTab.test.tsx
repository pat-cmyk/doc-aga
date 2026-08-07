import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils";
import { ErrorMonitoringTab } from "../ErrorMonitoringTab";
import { ErrorLogGroup } from "@/hooks/useErrorLogs";

// jsdom doesn't implement these, but Radix Select's Sheet-nested popper needs
// them on mount/interaction — without stubs the effect throws and the
// dropdown never opens.
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.setPointerCapture = vi.fn();

const updateStatusMutate = vi.fn();
const linkTicketMutate = vi.fn();
const refetch = vi.fn();

let mockGroups: ErrorLogGroup[] = [];

vi.mock("@/hooks/useErrorLogs", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useErrorLogs")>(
    "@/hooks/useErrorLogs",
  );
  return {
    ...actual,
    useErrorLogs: () => ({
      summary: undefined,
      groups: mockGroups,
      counts: { new: 1, investigating: 1, crashes_24h: 1, total_24h: 2 },
      isLoading: false,
      error: null,
      refetch,
      updateStatus: { mutate: updateStatusMutate, isPending: false },
      linkTicket: { mutate: linkTicketMutate, isPending: false },
    }),
  };
});

vi.mock("@/hooks/useSupportTickets", () => ({
  useSupportTickets: () => ({
    createTicket: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
  getIsOnline: () => true,
}));

const crashGroup: ErrorLogGroup = {
  id: "err-1",
  fingerprint: "fp-1",
  severity: "crash",
  message: "TypeError: cannot read properties of undefined",
  stack: "at foo.tsx:10",
  translated_title: "App crashed while saving",
  context: { route: "/animals/123", user_agent: "Android WebView" },
  user_id: "user-1",
  farm_id: "farm-1",
  farm_name: "Golden Forage Farm",
  affected_user_count: 3,
  occurrence_count: 12,
  first_seen_at: "2026-08-01T00:00:00.000Z",
  last_seen_at: "2026-08-06T00:00:00.000Z",
  status: "new",
  linked_ticket_id: null,
  linked_ticket_number: null,
};

const silentGroup: ErrorLogGroup = {
  id: "err-2",
  fingerprint: "fp-2",
  severity: "silent",
  message: "Network request failed",
  stack: null,
  translated_title: null,
  context: {},
  user_id: null,
  farm_id: null,
  farm_name: null,
  affected_user_count: 1,
  occurrence_count: 2,
  first_seen_at: "2026-08-02T00:00:00.000Z",
  last_seen_at: "2026-08-05T00:00:00.000Z",
  status: "investigating",
  linked_ticket_id: "ticket-1",
  linked_ticket_number: "TCK-100",
};

describe("ErrorMonitoringTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroups = [crashGroup, silentGroup];
  });

  it("renders a card for each error group", () => {
    renderWithProviders(<ErrorMonitoringTab />);

    expect(screen.getByText("App crashed while saving")).toBeInTheDocument();
    expect(screen.getByText("Network request failed")).toBeInTheDocument();
  });

  it("opens the detail sheet when a card is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErrorMonitoringTab />);

    await user.click(screen.getByText("App crashed while saving"));

    expect(screen.getByText("Raw message")).toBeInTheDocument();
    // Sheet shows the full raw message text
    expect(
      screen.getByText("TypeError: cannot read properties of undefined"),
    ).toBeInTheDocument();
  });

  it("calls updateStatus.mutate with the id and new status when the status select changes", async () => {
    renderWithProviders(<ErrorMonitoringTab />);

    fireEvent.click(screen.getByText("App crashed while saving"));
    expect(screen.getByText("Raw message")).toBeInTheDocument();

    // The status Select in the detail panel — find it via its current value "new".
    const statusLabel = screen.getByText("Status");
    const statusContainer = statusLabel.parentElement as HTMLElement;
    const trigger = within(statusContainer).getByRole("combobox");

    fireEvent.click(trigger);
    const option = await screen.findByText("Resolved");
    fireEvent.click(option);

    expect(updateStatusMutate).toHaveBeenCalledWith({ id: "err-1", status: "resolved" });
  });

  it("shows an empty state when no groups match the filters", () => {
    mockGroups = [];
    renderWithProviders(<ErrorMonitoringTab />);

    expect(screen.getByText(/No errors match/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UnifiedInviteAccept from "./UnifiedInviteAccept";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signOut: vi.fn(),
      signInWithPassword: vi.fn(),
      setSession: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";

function renderWithToken(token: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/invite/${token}`]}>
        <Routes>
          <Route path="/invite/:token" element={<UnifiedInviteAccept />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe("UnifiedInviteAccept", () => {
  it("shows NewUserCard for pending invite with no session", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{ type: "user", status: "pending", email: "a@b.com", role: "admin", role_label: "System Administrator", inviter_name: "Pat", inviter_email: "pat@x.com", target_name: "Doc Aga", invited_at: new Date().toISOString(), expires_at: new Date(Date.now()+86400e3).toISOString() }],
      error: null,
    });
    renderWithToken("token-a");
    await waitFor(() => expect(screen.getByRole("heading", { name: /welcome/i })).toBeInTheDocument());
    expect(screen.getByText(/invited as/i)).toHaveTextContent("System Administrator");
  });

  it("shows ExpiredCard when status is expired", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{ type: "user", status: "expired", email: "a@b.com", role: "admin", role_label: "System Administrator", inviter_name: "Pat", inviter_email: "", target_name: "Doc Aga", invited_at: "", expires_at: "" }],
      error: null,
    });
    renderWithToken("token-b");
    await waitFor(() => expect(screen.getByText(/this invite has expired/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /request a new link/i })).toBeInTheDocument();
  });

  it("shows AlreadyAcceptedCard for accepted status", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{ type: "user", status: "accepted", email: "a@b.com", role: "admin", role_label: "Admin", inviter_name: "Pat", inviter_email: "", target_name: "Doc Aga", invited_at: "", expires_at: "" }],
      error: null,
    });
    renderWithToken("token-c");
    await waitFor(() => expect(screen.getByText(/already joined/i)).toBeInTheDocument());
  });

  it("shows InfoCard 'Invite not found' for missing token", async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [], error: null });
    renderWithToken("token-d");
    await waitFor(() => expect(screen.getByText(/invite not found/i)).toBeInTheDocument());
  });

  it("shows MismatchCard when session email differs", async () => {
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { email: "other@x.com" } } });
    (supabase.rpc as any).mockResolvedValue({
      data: [{ type: "user", status: "pending", email: "a@b.com", role: "admin", role_label: "Admin", inviter_name: "Pat", inviter_email: "", target_name: "Doc Aga", invited_at: "", expires_at: new Date(Date.now()+86400e3).toISOString() }],
      error: null,
    });
    renderWithToken("token-e");
    await waitFor(() => expect(screen.getByText(/signed in as a different account/i)).toBeInTheDocument());
  });
});

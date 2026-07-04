import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Hoisted spies (referenced inside vi.mock factories) ──────────────────────
const { toastSpy, navigateSpy, logAuthEventSpy } = vi.hoisted(() => ({
  toastSpy: vi.fn(),
  navigateSpy: vi.fn(),
  logAuthEventSpy: vi.fn(),
}));

// ── Mock the Supabase auth client ────────────────────────────────────────────
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

// Keep MemoryRouter/Link/useSearchParams real, spy on navigation.
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigateSpy,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy, dismiss: vi.fn(), toasts: [] }),
}));

vi.mock("@/lib/authLogger", () => ({ logAuthEvent: logAuthEventSpy }));

// Stub heavy / environment-coupled children so the page renders in jsdom.
vi.mock("@/components/seo/RouteSeo", () => ({ RouteSeo: () => null }));
vi.mock("@/components/AppDownloadSection", () => ({ AppDownloadSection: () => null }));
vi.mock("@/components/PasswordStrengthIndicator", () => ({ default: () => null }));
vi.mock("@/components/voice-training/VoiceTrainingOnboarding", () => ({
  VoiceTrainingOnboarding: () => null,
}));

import Auth from "./Auth";
import { supabase } from "@/integrations/supabase/client";

function renderAuth(initialEntry = "/auth") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Patterns that would constitute account-enumeration leakage.
const ENUMERATION_LEAK =
  /no account|not found|no user|does ?n[o']t exist|isn'?t registered|not registered|unknown email|user not found/i;

/** Collect every title/description string passed to the toast spy. */
function allToastText(): string {
  return toastSpy.mock.calls
    .map((c) => `${c[0]?.title ?? ""} ${c[0]?.description ?? ""}`)
    .join(" | ");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null });
});

describe("Auth — failure paths", () => {
  it("login with a wrong password shows a generic, non-enumerating message and keeps the UI usable", async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400, code: "invalid_credentials", name: "AuthApiError", __isAuthError: true } as any,
    });

    renderAuth();
    await screen.findByLabelText(/email/i);

    await user.type(screen.getByLabelText(/^email$/i), "farmer@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => expect(toastSpy).toHaveBeenCalled());

    const text = allToastText();
    // Generic credential error — does not reveal whether the email exists.
    expect(text).toMatch(/wrong email or password/i);
    expect(text).not.toMatch(ENUMERATION_LEAK);
    expect(text).not.toContain("farmer@example.com");

    // No redirect, and the form is still usable (not stuck in a loading state).
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^log in$/i })).toBeEnabled();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
  });

  it("repeated wrong-password attempts each show the same generic error and never break the UI", async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400, code: "invalid_credentials", name: "AuthApiError", __isAuthError: true } as any,
    });

    renderAuth();
    await screen.findByLabelText(/^email$/i);
    await user.type(screen.getByLabelText(/^email$/i), "farmer@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "nope");

    for (let attempt = 1; attempt <= 3; attempt++) {
      await user.click(screen.getByRole("button", { name: /^log in$/i }));
      await waitFor(() => expect(toastSpy).toHaveBeenCalledTimes(attempt));
      // Button re-enables between attempts; no lockout detail is leaked.
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^log in$/i })).toBeEnabled()
      );
    }

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(3);
    const text = allToastText();
    expect(text).toMatch(/wrong email or password/i);
    expect(text).not.toMatch(ENUMERATION_LEAK);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("password reset for a non-existent email shows the same neutral message (no enumeration)", async () => {
    const user = userEvent.setup();
    // Supabase intentionally returns success regardless of whether the email exists.
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null });

    renderAuth();
    await user.click(await screen.findByRole("button", { name: /forgot password/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/email/i), "ghost@nowhere.test");
    await user.click(within(dialog).getByRole("button", { name: /send reset link/i }));

    await waitFor(() => expect(toastSpy).toHaveBeenCalled());

    const text = allToastText();
    // Neutral "check your email" response — identical for existing/non-existing emails.
    expect(text).toMatch(/check your email/i);
    expect(text).not.toMatch(ENUMERATION_LEAK);
    expect(text).not.toContain("ghost@nowhere.test");
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "ghost@nowhere.test",
      expect.any(Object)
    );
  });

  it("signup with an already-registered email shows a neutral confirmation prompt, not 'already registered'", async () => {
    const user = userEvent.setup();
    // Supabase's anti-enumeration response for an existing email: an obfuscated
    // user with no identities and no session, and NO error.
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: "obfuscated", identities: [] }, session: null },
      error: null,
    });

    renderAuth();
    await user.click(await screen.findByRole("tab", { name: /sign up/i }));

    await user.type(await screen.findByLabelText(/full name/i), "Juan Dela Cruz");
    await user.type(screen.getByLabelText(/^email$/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "Sup3r$ecret!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(toastSpy).toHaveBeenCalled());

    const text = allToastText();
    // Must NOT reveal that the email is already registered.
    expect(text).not.toMatch(/already registered|already exists|email.*taken/i);
    expect(text).not.toContain("taken@example.com");
    expect(text).toMatch(/check your email|confirm your email/i);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("signup is non-enumerating even when Supabase returns an explicit 'already registered' error", async () => {
    const user = userEvent.setup();
    // Auto-confirm projects return an explicit error instead of obfuscating —
    // the page must still NOT confirm the email exists.
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered", status: 400 } as never,
    } as never);

    renderAuth();
    await user.click(await screen.findByRole("tab", { name: /sign up/i }));
    await user.type(await screen.findByLabelText(/full name/i), "Juan Dela Cruz");
    await user.type(screen.getByLabelText(/^email$/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "Sup3r$ecret!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(toastSpy).toHaveBeenCalled());

    const text = allToastText();
    expect(text).not.toMatch(/already registered|already exists|email.*taken/i);
    expect(text).not.toContain("taken@example.com");
    expect(text).toMatch(/check your email/i);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("an already-used confirmation link lands on a safe sign-in page without leaking internal error detail", async () => {
    // Second click on a confirmation link: the user is not authenticated and the
    // provider appends an error fragment to the URL.
    renderAuth(
      "/auth#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+already+been+used"
    );

    // The page renders the normal sign-in UI (safe, not a broken/error state)...
    expect(await screen.findByRole("button", { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /log in/i })).toBeInTheDocument();

    // ...and does not echo the raw provider error text to the user.
    await waitFor(() => expect(supabase.auth.getUser).toHaveBeenCalled());
    expect(document.body.textContent || "").not.toMatch(/invalid or has already been used/i);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

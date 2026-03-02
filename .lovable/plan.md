

# P0 + P1: Doc Aga Enterprise Hardening (SSOT-Aligned Revision)

## SSOT Audit Findings

Before implementing, I traced the existing patterns and found opportunities to maximize reuse:

1. **Server-side rate limiting already exists** in `doc-aga/index.ts` and `rico/index.ts` (15 req/60s, in-memory `checkRateLimit`). The same function is copy-pasted across 6+ edge functions. P1 does NOT need to add server-side rate limiting -- it already works.

2. **Zod validation already exists** server-side with a 2000-char per-message limit. This is defense-in-depth layer one.

3. **`src/lib/localStorage.ts` is the SSOT** for all localStorage operations and already follows a get/set pattern with defaults. Conversation ID persistence belongs here.

4. **`handleSendMessage` is duplicated** across DocAga (641 lines), DocAgaConsultation, and RicoChat with the same SSE streaming logic. The new utilities (truncation, cooldown) should be shared via a single `chatUtils.ts` rather than modified in each component individually.

5. **`checkRateLimit` in `_shared/`** does not exist. The identical function is duplicated in 6+ edge functions. The sanitization guard should go in `_shared/` to follow the existing shared utilities pattern (like `analyst-tools.ts`).

---

## P0: Conversation Persistence

### File: `src/lib/localStorage.ts` (extend existing SSOT)

Add conversation ID management following the existing `getDocAgaPreferences` / `setDocAgaPreferences` pattern:

- `getConversationId(key: string, ttlMs: number): string` -- Returns existing ID from localStorage if within TTL, otherwise generates and stores a new one
- `resetConversationId(key: string): string` -- Forces a new ID and returns it
- Keys: `doc_aga_conversation_id`, `doc_aga_consultation_id`, `rico_conversation_id`
- TTLs: 24 hours for DocAga/Rico, 1 hour for Consultation

### Files: `DocAga.tsx`, `DocAgaConsultation.tsx`, `RicoChat.tsx`

Replace `useState(() => crypto.randomUUID())` with `useState(() => getConversationId(...))`. Add a "New Chat" button that calls `resetConversationId()` and clears local messages.

---

## P0: Sliding Window Context Management

### File: `src/lib/chatUtils.ts` (new shared utility)

- `truncateMessages(messages, maxMessages = 20)`: Keeps first user message (topic grounding) + last N-1 messages. Shared across all 3 chat components.
- `estimateTokenCount(messages)`: Simple heuristic (chars / 4) for optional logging.

### Files: `DocAga.tsx`, `DocAgaConsultation.tsx`, `RicoChat.tsx`

Apply `truncateMessages()` to the `messagesToSend` array before sending to the edge function. One-line addition in each component's `handleSendMessage`.

---

## P1: Client-Side Send Cooldown

### File: `src/lib/chatUtils.ts` (same new file)

- `useSendCooldown(cooldownMs = 2000)`: A React hook returning `{ canSend: boolean, markSent: () => void }`. Uses `useRef` + `setTimeout` internally.

### Files: `DocAga.tsx`, `DocAgaConsultation.tsx`, `RicoChat.tsx`

- Call `useSendCooldown()` hook
- Guard `handleSendMessage` with `if (!canSend) return`
- Call `markSent()` after successful send
- Disable send button when `!canSend` (in addition to existing `loading` check)

Note: Server-side rate limiting (15 req/60s) already exists in both edge functions. This client-side cooldown is a UX layer to prevent accidental double-sends, not a replacement.

---

## P1: Prompt Injection Guard

### File: `supabase/functions/_shared/sanitizeMessage.ts` (new shared utility)

Following the existing `_shared/` pattern (like `analyst-tools.ts`), create a shared sanitization function:

- `sanitizeUserMessage(content: string): string`
  - Strips: `[SYSTEM]`, `[INST]`, `<|system|>`, `<|user|>`, `Ignore previous instructions`, `You are now`, `Pretend you are`
  - Case-insensitive regex matching
  - Logs sanitization events to console for monitoring
  - Preserves the rest of the message (farmers may use brackets in normal speech)

### Files: `supabase/functions/doc-aga/index.ts`, `supabase/functions/rico/index.ts`

Import and apply `sanitizeUserMessage()` to each user message in `transformedMessages` before sending to the AI gateway. Two-line change per file (import + map).

---

## File Summary

| File | Action | Priority | Reuse Pattern |
|------|--------|----------|---------------|
| `src/lib/localStorage.ts` | Extend with conversation ID persistence | P0 | Existing SSOT for localStorage |
| `src/lib/chatUtils.ts` | New: truncation + cooldown utilities | P0/P1 | Shared across 3 chat components |
| `src/components/DocAga.tsx` | Use persistent ID, truncation, cooldown | P0/P1 | Consumes shared utilities |
| `src/components/farmhand/DocAgaConsultation.tsx` | Same | P0/P1 | Consumes shared utilities |
| `src/components/government/RicoChat.tsx` | Same | P0/P1 | Consumes shared utilities |
| `supabase/functions/_shared/sanitizeMessage.ts` | New: prompt injection guard | P1 | Shared across edge functions |
| `supabase/functions/doc-aga/index.ts` | Apply sanitization | P1 | Consumes shared utility |
| `supabase/functions/rico/index.ts` | Apply sanitization | P1 | Consumes shared utility |

## What Was Removed From the Original Plan

- **Server-side rate limiting**: Already exists in both edge functions (15 req/60s). No duplication needed.
- **Server-side message length validation**: Already exists via Zod schema (2000 char max). No duplication needed.
- **Separate rate limit utility per edge function**: The `checkRateLimit` duplication across 6+ functions is a pre-existing tech debt issue but is out of scope for this P0/P1 effort.

## Governance

After implementation, update:
- `docs/ssot-architecture.md`: Add chat session persistence to the Read Path table
- `changelog.md`: Document P0/P1 changes


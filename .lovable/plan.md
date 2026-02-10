

# Update Reply-To Address

## Change

**File:** `supabase/functions/send-team-invitation/index.ts` (line 54)

Update the `resend.emails.send()` call:

```
Before:
  from: "GoldenForage <onboarding@resend.dev>",

After:
  from: "Doc Aga <updates@doc-aga.goldenforage.com>",
  reply_to: "support@goldenforage.com",
```

Single edit. No other files affected.


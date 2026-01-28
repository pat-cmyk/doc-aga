

# Fix Farm Invitation Email - Option B Implementation

## Overview

This fix addresses the broken invitation email links by passing the correct app URL from the frontend to the edge function, ensuring invitation links work properly.

## Changes Summary

### File 1: `supabase/functions/send-team-invitation/index.ts`

**What changes:**
1. Add `appUrl` to the `InvitationRequest` interface
2. Use `appUrl` parameter to generate the correct accept URL instead of the broken Supabase URL transformation
3. Add better logging for debugging email delivery issues

**Key change:**
```typescript
// Before (broken):
const acceptUrl = `${supabaseUrl.replace("supabase.co", "lovableproject.com")}/invite/accept/${invitationToken}`;

// After (fixed):
const acceptUrl = `${appUrl}/invite/accept/${invitationToken}`;
```

---

### File 2: `src/components/FarmTeamManagement.tsx`

**What changes:**
1. Add `appUrl: window.location.origin` to the invite mutation's edge function call (line 139-147)
2. Add `appUrl: window.location.origin` to the resend mutation's edge function call (line 202-214)

**Example:**
```typescript
const { error: emailError } = await supabase.functions.invoke(
  "send-team-invitation",
  {
    body: {
      // ... existing params
      appUrl: window.location.origin, // NEW: Correct app URL
    },
  }
);
```

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/send-team-invitation/index.ts` | Accept `appUrl` param, fix URL generation, add logging |
| `src/components/FarmTeamManagement.tsx` | Pass `appUrl` in invite and resend mutations |

---

## Important Note About Email Delivery

This fix corrects the **invitation link URL** in emails. However, emails will still only be delivered to the Resend account owner's email address because of the `onboarding@resend.dev` sandbox limitation.

To enable delivery to all recipients, you'll need to:
1. Verify a custom domain in Resend ([resend.com/domains](https://resend.com/domains))
2. Let me know once verified so I can update the `from` address

**In the meantime**, the QR code flow works perfectly as a workaround since it uses the correct URL from `window.location.origin`.


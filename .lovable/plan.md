

# Fix RICO Edge Function API Key Configuration

## Problem Identified

The RICO edge function is failing with the error "Missing LOVABLE_AI_KEY" because:

| What's Configured | What RICO is Looking For |
|-------------------|-------------------------|
| `LOVABLE_API_KEY` | `LOVABLE_AI_KEY` |

The secret name is `LOVABLE_API_KEY` (standard Lovable AI gateway key), but the RICO function code uses `LOVABLE_AI_KEY`.

---

## Root Cause

When the RICO edge function was created, it used incorrect environment variable names:
- Line 270: `LOVABLE_AI_URL` (incorrect)
- Line 271: `LOVABLE_AI_KEY` (incorrect)

The correct names (matching Lovable AI documentation) are:
- Lovable AI Gateway URL: `https://ai.gateway.lovable.dev/v1/chat/completions` (hardcoded)
- API Key: `LOVABLE_API_KEY`

---

## Fix Required

**File: `supabase/functions/rico/index.ts`**

| Line | Current | Fix |
|------|---------|-----|
| 270 | `Deno.env.get('LOVABLE_AI_URL') \|\| "https://ai-gateway.lovable.ai"` | Use correct URL: `"https://ai.gateway.lovable.dev/v1/chat/completions"` |
| 271 | `Deno.env.get('LOVABLE_AI_KEY')` | Change to `Deno.env.get('LOVABLE_API_KEY')` |
| 273-274 | Error message | Update to reflect correct variable name |

---

## Code Changes

```typescript
// Before (lines 269-275):
const LOVABLE_AI_URL = Deno.env.get('LOVABLE_AI_URL') || "https://ai-gateway.lovable.ai";
const LOVABLE_AI_KEY = Deno.env.get('LOVABLE_AI_KEY');

if (!LOVABLE_AI_KEY) {
  console.error('[RICO] Missing LOVABLE_AI_KEY');
  ...
}

// After:
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

if (!LOVABLE_API_KEY) {
  console.error('[RICO] Missing LOVABLE_API_KEY');
  ...
}
```

Also update line 304:
```typescript
// Before:
"Authorization": `Bearer ${LOVABLE_AI_KEY}`

// After:
"Authorization": `Bearer ${LOVABLE_API_KEY}`
```

---

## Implementation Steps

1. Update `supabase/functions/rico/index.ts`:
   - Line 270: Use correct Lovable AI gateway URL
   - Line 271: Change `LOVABLE_AI_KEY` to `LOVABLE_API_KEY`
   - Line 274: Update error message
   - Line 304: Update Authorization header variable

2. Deploy the updated RICO edge function

3. Test the RICO chat on the government dashboard

---

## Verification

After deployment:
- [ ] RICO responds to queries without "AI service unavailable" error
- [ ] Government dashboard analytics work correctly
- [ ] No console errors about missing API keys


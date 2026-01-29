
# Plan: Add Zod Input Validation to Edge Functions

## Overview
This plan addresses the security finding by adding comprehensive Zod schema validation to edge functions that currently parse JSON without proper validation. The `doc-aga` function already uses Zod and will serve as the pattern reference.

## Analysis Summary

| Function | Current State | Risk Level | Changes Needed |
|----------|--------------|------------|----------------|
| `admin-create-user` | Basic null checks only | High | Full Zod schema for email, password, role, UUID token |
| `process-animal-voice` | Type check only | Medium | Length validation, sanitization |
| `voice-to-text` | Base64 regex + size check | Medium | Explicit length limits, structured validation |
| `merchant-signup` | No validation | Medium | Full Zod schema for business details |

## Existing Pattern (from doc-aga)

The project already uses Zod validation in `doc-aga/index.ts`:
```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const docAgaRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(2000).trim(),
    imageUrl: z.string().url().nullish()
  })).min(1),
  farmId: z.string().uuid().optional(),
  context: z.enum(['farmer', 'government']).optional().default('farmer')
});
```

## Implementation Details

### 1. admin-create-user/index.ts

Add Zod schema after imports:

```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const createUserSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email format')
    .max(255, 'Email must be under 255 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be under 128 characters'),
  fullName: z.string()
    .trim()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be under 100 characters'),
  role: z.enum([
    'farmer_owner', 
    'farmhand', 
    'admin', 
    'government'
  ]).optional().default('farmer_owner'),
  invitationToken: z.string()
    .uuid('Invalid invitation token format')
    .optional()
});
```

Replace manual JSON parsing with schema validation:
```typescript
// Before (current code)
const { email, password, fullName, role, invitationToken } = await req.json();
if (!email || !password || !fullName) { ... }

// After (with Zod)
const rawBody = await req.json();
const parseResult = createUserSchema.safeParse(rawBody);
if (!parseResult.success) {
  return new Response(
    JSON.stringify({ 
      error: 'Validation failed', 
      details: parseResult.error.flatten().fieldErrors 
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
const { email, password, fullName, role, invitationToken } = parseResult.data;
```

### 2. process-animal-voice/index.ts

Add validation with length limits:

```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const MAX_TRANSCRIPTION_LENGTH = 5000;

const animalVoiceSchema = z.object({
  transcription: z.string()
    .trim()
    .min(1, 'Transcription cannot be empty')
    .max(MAX_TRANSCRIPTION_LENGTH, `Transcription must be under ${MAX_TRANSCRIPTION_LENGTH} characters`)
});
```

Update the parsing logic:
```typescript
// Before
const { transcription } = await req.json();
if (!transcription || typeof transcription !== 'string') { ... }

// After
const rawBody = await req.json();
const parseResult = animalVoiceSchema.safeParse(rawBody);
if (!parseResult.success) {
  return new Response(
    JSON.stringify({ error: parseResult.error.errors[0]?.message || 'Invalid input' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
const { transcription } = parseResult.data;
```

### 3. voice-to-text/index.ts

Add explicit audio validation schema:

```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const MAX_BASE64_LENGTH = 15_000_000; // ~10MB decoded

const voiceToTextSchema = z.object({
  audio: z.string()
    .min(100, 'Audio data too short')
    .max(MAX_BASE64_LENGTH, 'Audio data exceeds maximum size')
    .regex(/^[A-Za-z0-9+/=]+$/, 'Invalid base64 encoding')
});
```

Update validation:
```typescript
// Before
const { audio } = await req.json();
if (!audio || typeof audio !== 'string') { ... }
if (!/^[A-Za-z0-9+/=]+$/.test(audio)) { ... }

// After
const rawBody = await req.json();
const parseResult = voiceToTextSchema.safeParse(rawBody);
if (!parseResult.success) {
  return new Response(
    JSON.stringify({ error: parseResult.error.errors[0]?.message || 'Invalid audio data' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
const { audio } = parseResult.data;
// Continue with size validation...
```

### 4. merchant-signup/index.ts

Add comprehensive business validation:

```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const merchantSignupSchema = z.object({
  fullName: z.string()
    .trim()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be under 100 characters'),
  businessName: z.string()
    .trim()
    .min(1, 'Business name is required')
    .max(150, 'Business name must be under 150 characters'),
  businessDescription: z.string()
    .trim()
    .max(1000, 'Description must be under 1000 characters')
    .optional(),
  contactPhone: z.string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number format')
    .optional(),
  contactEmail: z.string()
    .trim()
    .email('Invalid email format')
    .max(255, 'Email must be under 255 characters')
    .optional(),
  businessAddress: z.string()
    .trim()
    .max(500, 'Address must be under 500 characters')
    .optional()
});
```

## Files to Modify

1. `supabase/functions/admin-create-user/index.ts`
   - Add Zod import
   - Add createUserSchema
   - Replace manual validation with schema.safeParse()

2. `supabase/functions/process-animal-voice/index.ts`
   - Add Zod import
   - Add animalVoiceSchema with MAX_TRANSCRIPTION_LENGTH
   - Replace type check with schema validation

3. `supabase/functions/voice-to-text/index.ts`
   - Add Zod import
   - Add voiceToTextSchema
   - Consolidate base64 regex check into schema

4. `supabase/functions/merchant-signup/index.ts`
   - Add Zod import
   - Add merchantSignupSchema
   - Add validation before database call

## Security Benefits

- **Injection Prevention**: Validates and constrains all string inputs
- **Type Safety**: Ensures correct types before processing
- **Length Limits**: Prevents resource exhaustion attacks
- **Format Validation**: Email, UUID, phone patterns enforced
- **Consistent Errors**: Structured error responses for debugging

## Technical Notes

- Uses same Zod version as doc-aga: `https://deno.land/x/zod@v3.22.4/mod.ts`
- Uses `safeParse()` to avoid throwing exceptions
- Returns 400 status with detailed field errors
- All schemas use `.trim()` to normalize whitespace
- Optional fields use `.optional()` appropriately

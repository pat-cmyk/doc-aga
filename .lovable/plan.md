

# Plan: Fix QR Code Invitation URLs to Use Published App URL

## Problem

The QR codes for farm invitations currently use `window.location.origin` to generate the invitation URL:

```typescript
const getInviteUrl = (token: string) => 
  `${window.location.origin}/invite/accept/${token}`;
```

When a farm owner generates a QR code from the Lovable preview environment (e.g., `id-preview--...lovable.app`), the QR code points to that private preview URL. External users scanning the QR code are redirected to Lovable's login page instead of the app's invitation flow.

## Solution

Update `appConfig.ts` to include the published app URL and use it consistently for all invitation-related URLs (QR codes and invitation emails).

## Changes

### 1. Update App Configuration

**File:** `src/lib/appConfig.ts`

Add a `publishedUrl` property to the centralized config:

```typescript
export const APP_CONFIG = {
  appId: 'com.goldenforage.docaga',
  appName: 'Doc Aga',
  publishedUrl: 'https://doc-aga.lovable.app',
} as const;

/**
 * Get the base URL for public-facing links (invitations, shares, etc.)
 * Always uses the published URL to ensure external users can access
 */
export const getPublicAppUrl = () => APP_CONFIG.publishedUrl;
```

### 2. Update FarmTeamManagement Component

**File:** `src/components/FarmTeamManagement.tsx`

Import and use the new `getPublicAppUrl` function:

```typescript
import { getPublicAppUrl } from "@/lib/appConfig";

// Update the getInviteUrl function (line 41-42)
const getInviteUrl = (token: string) => 
  `${getPublicAppUrl()}/invite/accept/${token}`;
```

Also update the invitation email calls to use the public URL:

- Line 146: `appUrl: getPublicAppUrl(),` (instead of `window.location.origin`)
- Line 213: `appUrl: getPublicAppUrl(),` (instead of `window.location.origin`)

## Technical Rationale

| Approach | Pros | Cons |
|----------|------|------|
| Hardcode in appConfig | Simple, centralized, always correct | Needs manual update if domain changes |
| Environment variable | Configurable per environment | .env is auto-managed, can't add custom vars |
| Detect from hostname | No hardcoding | Complex logic, still needs fallback |

The **centralized config** approach is best because:
- It's already established in `appConfig.ts` for other app-wide constants
- The published URL rarely changes
- Single source of truth for all public-facing URLs

## Files to Modify

1. **`src/lib/appConfig.ts`** - Add `publishedUrl` and helper function
2. **`src/components/FarmTeamManagement.tsx`** - Use the new helper for QR codes and email invitations

## Testing Checklist

- [ ] QR codes display URLs starting with `https://doc-aga.lovable.app`
- [ ] Scanning QR code on external device opens the correct invitation page
- [ ] Invitation emails contain the published URL
- [ ] Copy invite link copies the correct public URL
- [ ] Works from both preview and published environments


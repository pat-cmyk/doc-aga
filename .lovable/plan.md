

# Plan: Update APK Download URL to Published Release

## Summary

Update the fallback APK download URL to point to the newly published GitHub release, which will be publicly accessible on all devices.

## Change Required

### File: `src/components/AppDownloadSection.tsx`

Update line 7 - change the `FALLBACK_APK_URL` constant:

```typescript
// Before
const FALLBACK_APK_URL = "https://github.com/pat-cmyk/doc-aga/releases/download/untagged-7e459e239b3cc1b7533d/app-release.apk";

// After
const FALLBACK_APK_URL = "https://github.com/pat-cmyk/doc-aga/releases/download/Beta_Launch/app-release.apk";
```

## Why This Fixes the Issue

| URL Type | Accessibility |
|----------|---------------|
| `untagged-...` (old) | Private - requires GitHub auth |
| `Beta_Launch` (new) | Public - works for all users |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AppDownloadSection.tsx` | Update FALLBACK_APK_URL constant |

## Testing Checklist

1. Navigate to `/auth` page
2. Click the "Download APK" button
3. Verify the APK downloads successfully
4. Test on an Android device to confirm public access works


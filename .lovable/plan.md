
# Plan: Add Android APK Download Link to Auth Page

## Summary

Add a direct download link to the Android APK on the `/auth` page, replacing the "Android APK coming soon" placeholder with a functional download button.

## Current Behavior

The `AppDownloadSection` component:
1. Tries to fetch `version.json` from storage (`app-releases/android/version.json`)
2. If found: Shows download button with version info
3. If not found: Shows "Android APK coming soon" placeholder

Currently, no `version.json` exists, so users see the placeholder.

## Solution

Add a hardcoded fallback URL in `AppDownloadSection.tsx` that will be used when no `version.json` is available. This ensures the download button always works while still supporting dynamic version info from storage in the future.

## Changes Required

### File: `src/components/AppDownloadSection.tsx`

**Add Fallback Constants** (at top of file):

```typescript
const FALLBACK_APK_URL = "https://github.com/pat-cmyk/doc-aga/releases/download/untagged-7e459e239b3cc1b7533d/app-release.apk";
const FALLBACK_VERSION = "1.0.0";
```

**Update the Android Download Section** (lines 111-150):

Replace the conditional rendering to show download button even when `versionInfo` is null:

```text
Before:
  versionInfo ? (show download button) : (show "coming soon")

After:
  Always show download button using:
  - versionInfo.downloadUrl if available
  - FALLBACK_APK_URL as fallback
```

**Update `handleDownload` function** (lines 82-95):

```typescript
const handleDownload = async () => {
  const downloadUrl = versionInfo?.downloadUrl || FALLBACK_APK_URL;
  
  try {
    window.open(downloadUrl, "_blank");
  } catch (error) {
    console.error("Download error:", error);
    setDownloadError("Failed to start download. Please try again.");
  }
};
```

**Update Button Display**:

```tsx
<Button onClick={handleDownload} className="w-full gap-2" variant="default">
  <Download className="h-4 w-4" />
  Download APK {versionInfo?.version ? `(v${versionInfo.version})` : ""}
</Button>
```

**Always Show Install Instructions**:

Remove the conditional `{versionInfo && ...}` wrapper around the "How to install?" button so it's always visible.

## Expected Result

| State | Before | After |
|-------|--------|-------|
| No version.json | "Android APK coming soon" | Download button → GitHub APK |
| With version.json | Download button → storage URL | Download button → storage URL |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/AppDownloadSection.tsx` | Add fallback URL, update download logic and UI |

## Testing Checklist

1. Navigate to `/auth` page
2. Verify the "Download APK" button appears (not "coming soon")
3. Click the download button
4. Verify it opens the GitHub release URL in a new tab
5. Verify "How to install?" link is visible and opens the instructions dialog


# Unify Animal Avatar into a Single SSOT Component

## Problem

The same animal (NDA 123) renders with **three different avatars** across three views:
- **Profile header**: Cow photo (avatar_url with cache-busting)
- **List card**: Letter "N" in gray circle (avatar_url without cache-busting, different fallback)
- **BioCard**: Cow emoji/icon (avatar_url without cache-busting, emoji fallback)

Root causes:
1. Avatar rendering is **duplicated in 6+ locations** with inconsistent logic
2. Cache-busting (`?t=timestamp`) is applied in some places but not others
3. Fallback behavior differs: some show first letter, others show livestock emoji

## Solution

Create a single `AnimalAvatar` component that is the SSOT for all animal avatar rendering, then replace every inline `<Avatar>` across the codebase.

## SSOT Data Flow

```text
animals.avatar_url (DB column)
       |
       v
AnimalAvatar component (NEW - single SSOT)
       |
       v
AnimalDetails.tsx (profile header - desktop + mobile)
AnimalList.tsx (list card variant)
AnimalCard.tsx (swipeable card)
BioCard.tsx (performance summary)
AnimalProfile.tsx (legacy profile)
ActivityDetailsDialog.tsx (approval flow)
```

## Changes

### 1. NEW: `src/components/ui/animal-avatar.tsx`

A reusable component that:
- Accepts `avatarUrl`, `animalName`, `earTag`, `livestockType`, `size`
- Always applies cache-busting to avatar URLs (append `?t=hash` based on URL, not `Date.now()` to avoid re-renders)
- Uses a consistent fallback hierarchy: uploaded photo, then first letter of name/tag, with livestock emoji as ultimate fallback
- Supports size variants: `xs` (32px), `sm` (40px), `md` (48px), `lg` (64px), `xl` (80px)

```tsx
interface AnimalAvatarProps {
  avatarUrl?: string | null;
  animalName?: string | null;
  earTag?: string | null;
  livestockType?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}
```

### 2. Replace inline Avatars in 6 files

| File | Current | Change |
|------|---------|--------|
| `src/components/AnimalDetails.tsx` (2 locations: mobile line 597, desktop line 731) | Inline Avatar with cache-busting, letter fallback | Replace with `<AnimalAvatar>` |
| `src/components/AnimalList.tsx` (line 768) | Inline Avatar with cache-busting, letter fallback | Replace with `<AnimalAvatar>` |
| `src/components/animal-list/AnimalCard.tsx` (2 locations: mobile line 117, desktop line 207) | Inline Avatar, no cache-busting, letter fallback | Replace with `<AnimalAvatar>` |
| `src/components/bio-card/BioCard.tsx` (line 60) | Inline Avatar, no cache-busting, emoji fallback | Replace with `<AnimalAvatar>` |
| `src/components/animal-details/AnimalProfile.tsx` (line 161) | Inline Avatar with cache-busting, letter fallback | Replace with `<AnimalAvatar>` |
| `src/components/approval/ActivityDetailsDialog.tsx` (2 locations) | Inline Avatar, no cache-busting | Replace with `<AnimalAvatar>` |

### 3. Consistent Fallback Logic (in the new component)

```
1. If avatar_url exists -> show image (with cache-busting)
2. If no image -> show first letter of (name || ear_tag)
3. If no name/tag -> show livestock emoji (cow/carabao/goat)
```

This ensures the same animal always looks the same everywhere.

### 4. DRM Update

Add `AnimalAvatar` to the component reuse inventory in `docs/data-relationships-map.md`.

## What This Does NOT Change

- No database changes
- No hook changes
- Avatar upload logic stays in AnimalDetails/AnimalProfile (the upload button wraps around `AnimalAvatar`)
- The `StatusAura` wrapper in BioCard and `StatusDot` overlay in cards remain as parent wrappers -- `AnimalAvatar` just handles the avatar itself

## Files Summary (8 files)

| File | Action |
|------|--------|
| `src/components/ui/animal-avatar.tsx` | **CREATE** - SSOT avatar component |
| `src/components/AnimalDetails.tsx` | EDIT - replace 2 inline Avatars |
| `src/components/AnimalList.tsx` | EDIT - replace 1 inline Avatar |
| `src/components/animal-list/AnimalCard.tsx` | EDIT - replace 2 inline Avatars |
| `src/components/bio-card/BioCard.tsx` | EDIT - replace 1 inline Avatar |
| `src/components/animal-details/AnimalProfile.tsx` | EDIT - replace 1 inline Avatar |
| `src/components/approval/ActivityDetailsDialog.tsx` | EDIT - replace 2 inline Avatars |
| `docs/data-relationships-map.md` | EDIT - add to component reuse inventory |

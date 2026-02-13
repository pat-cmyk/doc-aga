

# Add Name/Ear Tag Display Toggle to Animal List

## What Changes

A small toggle button will be placed next to the "Filters" button that lets the user switch the card's highlighted (primary) text between the animal's **Name** and **Ear Tag**. The preference is saved to localStorage so it persists across sessions.

## Visual Result

```text
[ Filters ]  [ Name | Tag ]          9 of 9 animals
```

When "Tag" is selected, cards will show the ear tag as the bold title and the name in the subtitle line (swapped from default).

## Technical Details

### 1. Edit `src/lib/localStorage.ts`

- Add a `displayPrimary: 'name' | 'ear_tag'` preference
- Add getter/setter functions: `getAnimalDisplayPrimary()` and `setAnimalDisplayPrimary()`

### 2. Edit `src/components/AnimalList.tsx`

- Add state: `const [displayPrimary, setDisplayPrimary] = useState(getAnimalDisplayPrimary())`
- Place a small toggle (using the existing `ToggleGroup` component or two compact buttons) next to the Filters button in the toolbar row (line ~474)
- On toggle change, update state and persist via `setAnimalDisplayPrimary()`
- In the desktop card rendering (~line 755): swap the CardTitle and CardDescription content based on `displayPrimary`
- Pass the preference as a prop to `AnimalCard` for mobile rendering

### 3. Edit `src/components/animal-list/AnimalCard.tsx`

- Add an optional `displayPrimary?: 'name' | 'ear_tag'` prop
- In both mobile and desktop card layouts, swap the bold title text and subtitle text based on the prop (defaulting to `'name'`)

## Files Summary

| File | Action |
|------|--------|
| `src/lib/localStorage.ts` | Edit - add display preference getter/setter |
| `src/components/AnimalList.tsx` | Edit - add toggle UI + swap card content |
| `src/components/animal-list/AnimalCard.tsx` | Edit - accept displayPrimary prop, swap title/subtitle |

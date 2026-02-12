

# Fix: Link Animal Names in Breeding Hub to Animal Profiles

## Problem

All animal name links in the Breeding Hub navigate to `/animal/{id}`, but **this route does not exist**. The app uses a query-parameter pattern instead: `/?tab=animals&animalId={id}`. This causes the 404 error you're seeing.

## What Changes

Update every `navigate('/animal/...')` call across all breeding components to use the correct pattern: `navigate('/?tab=animals&animalId=...')`.

## Files to Fix

| File | Current (broken) | Correct |
|------|------------------|---------|
| `src/components/breeding/BreedingHub.tsx` (line 87) | `navigate('/animal/${animalId}')` | `navigate('/?tab=animals&animalId=${animalId}')` |
| `src/components/breeding/BreedingStatusAnimalList.tsx` (line 37) | `navigate('/animal/${animalId}')` | `navigate('/?tab=animals&animalId=${animalId}')` |
| `src/components/breeding/BreedingAlertsSection.tsx` (line 45) | `navigate('/animal/${animalId}')` | `navigate('/?tab=animals&animalId=${animalId}')` |
| `src/components/breeding/analytics/CalvingIntervalCard.tsx` (line 147) | `navigate('/animal/${animal.id}')` | `navigate('/?tab=animals&animalId=${animal.id}')` |
| `src/components/breeding/analytics/ServicesPerConceptionCard.tsx` (line 144) | `navigate('/animal/${animal.id}')` | `navigate('/?tab=animals&animalId=${animal.id}')` |

## Technical Detail

The app's animal profile viewer is embedded inside the Dashboard page under the "Animals" tab. The `Dashboard.tsx` already handles the `animalId` query parameter by calling `setSelectedAnimalId(animalIdParam)` and switching to the animals tab. No route changes or new pages are needed -- just correcting the navigation URLs in 5 files.


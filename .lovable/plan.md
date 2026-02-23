

# Offline-First Photo Queue and AI Record Support

## Problem
Photos (animal avatars and health record attachments) currently require an active internet connection. When offline, health records are queued but photos are silently dropped. AI/breeding records (pregnancy confirmations) also have no offline path.

## Solution Overview
Create a dedicated offline photo queue (modeled after the existing `offlineAudioQueue.ts`) and extend the sync service to handle photo uploads and AI records when connectivity returns.

## Changes

### 1. New File: `src/lib/offlinePhotoQueue.ts`
A dedicated IndexedDB store for photo blobs, following the same pattern as `offlineAudioQueue.ts`:
- Store photo `Blob` with metadata (target: avatar or health-record, animalId, farmId, linked queue item ID)
- Max 20 photos, max 10MB per photo, 7-day retention
- CRUD operations: `addPhoto`, `getPendingPhotos`, `removePhoto`, `getPhotoCount`
- Auto-cleanup of expired items

### 2. Extend Queue Types in `src/lib/offlineQueue.ts`
- Add `'ai_record'` and `'pregnancy_confirm'` to the `QueueItem.type` union
- Add payload fields for AI record data (`performedDate`, `technicianName`, `bullInfo`) and pregnancy confirmation (`recordId`, `expectedDeliveryDate`, `gestationDays`)
- Add optional `pendingPhotoIds: string[]` field to payload to link queued photos to their parent record

### 3. Update `src/lib/syncService.ts`
- Add `syncAIRecord()` handler for AI record queue items
- Add `syncPregnancyConfirm()` handler for pregnancy confirmation items
- Add `syncPendingPhotos()` utility that processes linked photo IDs:
  1. Read blob from photo queue
  2. Upload to storage bucket (`animal-photos`) using the correct farm-prefixed path
  3. Insert `animal_photos` row or update `animals.avatar_url`
  4. Remove from photo queue on success
- Wire new handlers into the main `syncQueue()` switch statement

### 4. Update `src/components/animal-details/AnimalProfile.tsx`
- When offline: store photo blob in `offlinePhotoQueue` instead of failing
- Show "Queued" toast instead of blocking the user
- Display a pending indicator on the avatar when a photo is queued

### 5. Update `src/components/health-recording/RecordSingleHealthDialog.tsx`
- When offline: store selected photos in `offlinePhotoQueue` and attach their IDs to the `single_health` queue item payload
- Remove the "photos disabled offline" limitation
- Show queued photo count in the UI

### 6. Update `src/components/health-records/AddHealthRecordDialog.tsx`
- Same offline photo support as RecordSingleHealthDialog

### 7. Update `src/components/ConfirmPregnancyDialog.tsx`
- When offline: queue pregnancy confirmation via `addToQueue` with type `'pregnancy_confirm'`
- Show "Queued for Sync" toast
- Add `useOnlineStatus` check

### 8. Update `src/lib/cacheManager.ts`
- Add `'ai-record'` and `'pregnancy-confirm'` to `CACHE_DEPENDENCIES` map

---

## Technical Details

### Photo Queue Schema (IndexedDB)

```text
Store: photoQueue
  key: string (UUID)
  value:
    id: string
    blob: Blob
    fileName: string
    mimeType: string
    target: 'avatar' | 'health_record'
    animalId: string
    farmId: string
    linkedQueueItemId?: string  (parent offline queue item)
    createdAt: number
    status: 'pending' | 'uploading' | 'completed' | 'failed'
    retries: number
    lastError?: string
  indexes:
    by-status: status
    by-farm: farmId
```

### Sync Order
Photos linked to a parent record (health record) are synced AFTER the parent record succeeds, because the photo needs the server-generated record ID for proper association. The sync service handles this by:
1. Processing the health record queue item first
2. On success, processing linked photos using the server-returned record ID

### Storage Limits
- Max 20 queued photos (prevents IndexedDB bloat on mobile)
- Max 10MB per photo (covers high-res camera photos)
- 7-day retention with auto-cleanup
- Photos beyond limit trigger a capacity warning via the existing listener pattern

### Files Modified Summary

| File | Change |
|------|--------|
| `src/lib/offlinePhotoQueue.ts` | NEW -- dedicated photo blob IndexedDB store |
| `src/lib/offlineQueue.ts` | Add `ai_record`, `pregnancy_confirm` types + `pendingPhotoIds` |
| `src/lib/syncService.ts` | Add `syncAIRecord`, `syncPregnancyConfirm`, `syncPendingPhotos` |
| `src/components/animal-details/AnimalProfile.tsx` | Offline avatar queuing |
| `src/components/health-recording/RecordSingleHealthDialog.tsx` | Offline photo queuing |
| `src/components/health-records/AddHealthRecordDialog.tsx` | Offline photo queuing |
| `src/components/ConfirmPregnancyDialog.tsx` | Offline pregnancy confirm queuing |
| `src/lib/cacheManager.ts` | Add new cache dependency entries |
| `docs/data-relationships-map.md` | Document new offline photo flow |
| `changelog.md` | Log the change |


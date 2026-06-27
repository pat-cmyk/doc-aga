# Data Privacy Map — Where User Data Lives

> Operational reference for "know where your data lives" (privacy checklist item #1).
> Source of truth is the code/schema; update this when data flows change.
> **This is engineering documentation, not legal advice.** Have counsel review the
> public-facing [Privacy Policy](../src/pages/PrivacyPolicy.tsx) before relying on it.

Last reviewed: 2026-06-27

## 1. Personal data we collect, and where it is stored

| Data category | Examples | Primary store | Notes |
|---|---|---|---|
| Account identity | Full name, email, phone | `auth.users` (email, managed by Supabase Auth) + `public.profiles` (name, phone) | Email is immutable in-app. |
| Credentials | Password | `auth.users` (hashed by Supabase/GoTrue) | App never stores raw passwords. HIBP leaked-password check enabled. |
| Roles & access | Global role, farm membership | `user_roles`, `farm_memberships`, `cooperative_memberships` | Drives authorization (RLS). |
| Farm operational data | Farm name, **GPS location**, animals, milk/health/feed/weight/breeding records, finances | `farms`, `animals`, `milking_records`, `health_records`, `feeding_records`, `weight_records`, `ai_records`, `farm_revenues`, `farm_expenses`, … | Farm GPS is precise; surfaced on government regional maps. |
| Voice data | Voice recordings, transcripts, training samples | `voice-training-samples` storage bucket + `voice_training_samples` rows; transcript text in `farmer_feedback`, `doc_aga_queries` | Audio is sent to **ElevenLabs** for transcription/TTS (see §2). |
| Photos | Animal & farm photos, receipts | Storage buckets: `animal-photos`, `doc-aga-images`, `farm-logos`, `merchant-logos`, `product-images`, `ad-campaign-images` | |
| AI chat history | Questions/answers to Doc Aga & RICO | `doc_aga_queries` | Content is sent to the **Lovable AI gateway** (see §2). |
| Activity / audit logs | Auth events, IP address, user agent | `user_activity_logs` | IP is derived **server-side** (not client-supplied). |
| Farmer feedback | "Boses ng Magsasaka" submissions, sentiment, location, farm snapshot | `farmer_feedback` | **Shared with government** (DA/NDA) users — see §3. |
| Client-side cache | Offline copy of the user's farm data; UI preferences | Browser **IndexedDB** + **localStorage** on the device | Offline-first PWA. Cleared on logout/cache-clear; see §4. |

## 2. Subprocessors (third parties data flows to)

| Subprocessor | Purpose | Data sent | Where |
|---|---|---|---|
| **Supabase** (via Lovable Cloud) | Database, Auth, file storage | All of the above | Cloud (hosted) |
| **Lovable AI Gateway** | AI for Doc Aga / RICO / feedback analysis (Gemini) | User questions, farm context, feedback transcripts | Cloud (US-region gateway) |
| **ElevenLabs** | Speech-to-text & text-to-speech | Voice audio, text to speak | US |
| **Mapbox** | Map tiles for farm/region maps | Map viewport requests, farm coordinates (client-side) | US |
| **Cloudflare Turnstile** | Bot protection on public forms | IP + browser challenge signals | Global |
| **Resend** | Transactional email (invites, notifications) | Email address, message content | US |

> These are US-based / global services — i.e. data leaves the Philippines.
> International-transfer disclosure belongs in the Privacy Policy.

## 3. Cross-tenant / government visibility

- `farmer_feedback` and the regional analytics views are readable by users with the
  `government` or `admin` role via `has_government_access()`. A farmer's feedback,
  farm location, and (unless submitted anonymously) identity can be seen by
  government officials. This is core product behavior and **must be disclosed**.
- Cooperative and merchant data is visible to the relevant cooperative/merchant
  admins through `SECURITY DEFINER` RPCs, scoped by membership.

## 4. Retention & deletion

| Store | Retention | Deletion path |
|---|---|---|
| Postgres (account + farm data) | While the account is active | Self-service **Delete my account** (Profile page → `delete-user-account`): deletes owned farms (cascades animals/records) then the auth user (cascades profile + all `user_id`-keyed rows). |
| Storage buckets | While referenced | Removed with the owning farm/animal/user records. |
| Client IndexedDB / localStorage | Until logout or cache clear | Profile → Cache Settings, or browser clear. Never leaves the device except via the syncs above. |
| Voice training samples | Until the user clears them | Profile → Voice Training → "Clear Data", or account deletion. |

### Key FK behavior (for correct erasure)
- `profiles.id → auth.users.id` (cascade): deleting the auth user removes the profile.
- `farms.owner_id → profiles.id` **ON DELETE RESTRICT**: owned farms must be deleted
  **before** the user — handled by `delete-user-account`.
- `animals.farm_id → farms.id` **ON DELETE CASCADE**: deleting a farm removes its animals/records.
- ~31 `user_id → auth.users ON DELETE CASCADE` references clean up per-user rows on auth delete.

## 5. Data-subject controls in the app

| Right | Where |
|---|---|
| Access / portability | Profile → "Export my data" (`export-user-data`) returns a JSON of the user's own records. |
| Erasure | Profile → "Delete my account" (`delete-user-account`). |
| Rectification | Profile → Account Information (name/phone); records editable in-app. |
| Storage transparency | First-run storage notice + Privacy Policy. |

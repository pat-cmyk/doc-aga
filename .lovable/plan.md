

# Codifying the Anti-Gravity Audit Rules for Long-Term Consistency

The cache-first and online-only read-path rules need to be documented in **three places** to ensure future development stays consistent. Here is where each rule belongs and what to add.

---

## 1. Custom Knowledge (Project Settings -- Always-On Rules)

The Custom Knowledge block in project settings is loaded into every AI session. The existing "SSOT DATA FLOWS" table should be extended with a new entry:

**Add to the SSOT DATA FLOWS table:**

| Domain | Flow |
|--------|------|
| Read Path (Farm) | Farm-level hooks -> IndexedDB cache first -> Supabase if online -> update cache |
| Read Path (Gov/Coop) | Government/Regional/Cooperative hooks -> online-only, no local cache (RLS boundary) |

This ensures the AI enforces the pattern on every interaction without needing to read docs.

---

## 2. `docs/ssot-architecture.md` (Detailed Reference)

Add a new **Section 3.5: Read-Path Classification** after the existing data flows table. This section will contain:

- The three hook categories (A: Farm/cache-first, B: Government/online-only, C: Cooperative/online-only)
- The canonical cache-first implementation pattern (check IndexedDB, fetch if online, update cache, graceful offline fallback)
- A living inventory table listing each hook and its classification
- Rules for new hooks: "If farm-scoped, implement cache-first. If cross-farm aggregation, mark `@online-only`."

---

## 3. `docs/enhanced-governance-protocol.md` (Review Checklist)

Add a checklist item to **Section 9 (Security Checklist)** and a rule to **Section 3D (Cache Invalidation)**:

- Security Checklist: "New hooks aggregating cross-farm data must NOT cache locally (online-only)"
- Cache Invalidation section: "New farm-level read hooks must use the cache-first pattern via `dataCache.ts`. Add corresponding `getCached*` / `update*Cache` functions and register invalidation in `CacheManager.CACHE_DEPENDENCIES`."

---

## 4. Memory Entry (Already Done)

The memory `ssot-read-path-cache-first-pattern` was already created during the previous implementation. No changes needed here.

---

## Summary of Changes

| Location | What to Add | Why |
|----------|------------|-----|
| Custom Knowledge | Two new SSOT flow entries | Enforced every session, zero-effort |
| `ssot-architecture.md` | New Section 3.5 with hook classification table | Detailed reference for audits |
| `enhanced-governance-protocol.md` | Checklist items in Sections 3D and 9 | Caught during pre-coding review |


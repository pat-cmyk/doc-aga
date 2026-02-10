

# Clean Up Stale Vet Role Warning in DRM

## Change

Single line edit in `docs/data-relationships-map.md` at line 626:

**Before:**
```
| `vet` | Veterinarian | Farm-scoped (⚠️ see open questions) |
```

**After:**
```
| `vet` | Veterinarian | Farm-scoped (via `is_vet()` helper) |
```

This removes the outdated warning and replaces it with a reference to the `is_vet()` function that was created in the earlier migration, consistent with how other roles reference their helpers.

No other files affected.


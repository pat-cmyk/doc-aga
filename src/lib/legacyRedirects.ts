/**
 * Legacy dashboard URL mapping (UX redesign Phase 2).
 *
 * Before the app shell, every farmer screen lived at "/" with state encoded in
 * query params (?tab=, ?animalId=, ?filter=). Those URLs persist in local
 * notifications, bookmarks, and the service worker queue, so RoleLanding keeps
 * this shim permanently: it maps any legacy query onto the new route tree.
 *
 * Returns the new path (with preserved params) or null when the URL carries no
 * legacy navigation state.
 */
export function mapLegacyDashboardUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  const subtab = params.get("subtab");
  const animalId = params.get("animalId");
  const filter = params.get("filter");
  const prefillFeedType = params.get("prefillFeedType");

  // Params that are consumed by the mapping itself; everything else is
  // forwarded so links like &highlight=milk-species keep working.
  const passthrough = new URLSearchParams(params);
  for (const key of ["tab", "subtab", "animalId", "filter", "prefillFeedType"]) {
    passthrough.delete(key);
  }

  const withPassthrough = (path: string, own: Record<string, string> = {}) => {
    const qs = new URLSearchParams(passthrough);
    for (const [k, v] of Object.entries(own)) qs.set(k, v);
    const q = qs.toString();
    return q ? `${path}?${q}` : path;
  };

  if (animalId) {
    // Animal profiles are real routes since Phase 3; editWeight rides along
    // via passthrough.
    return withPassthrough(`/animals/${animalId}`);
  }

  if (filter === "missing-weight") {
    return withPassthrough("/animals", { filter });
  }

  if (tab === "operations" || tab === "feed" || tab === "milk") {
    const target =
      subtab === "feed" || subtab === "milk" || subtab === "breeding"
        ? subtab
        : tab === "feed"
          ? "feed"
          : "milk";
    const own: Record<string, string> = {};
    if (prefillFeedType) own.prefillFeedType = prefillFeedType;
    return withPassthrough(`/operations/${target}`, own);
  }

  if (prefillFeedType) {
    return withPassthrough("/operations/feed", { prefillFeedType });
  }

  if (tab === "finance") {
    return withPassthrough("/money");
  }

  if (tab === "approvals" || tab === "government") {
    return withPassthrough("/more", { tab });
  }

  if (tab === "animals") {
    return withPassthrough("/animals");
  }

  return null;
}

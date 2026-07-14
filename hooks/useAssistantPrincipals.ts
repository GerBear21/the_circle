import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export interface AssignedPrincipal {
  userId: string;
  name: string;
  positionTitle: string;
  email: string;
}

/**
 * Session-scoped cache so the on-behalf list is fetched once, not on every
 * form navigation. The list changes rarely (only when an admin edits
 * assignments), so a short TTL is plenty and keeps the field instant across
 * forms within a session.
 */
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; principals: AssignedPrincipal[] } | null = null;
let inflight: Promise<AssignedPrincipal[]> | null = null;

function loadPrincipals(): Promise<AssignedPrincipal[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.principals);
  if (inflight) return inflight;
  inflight = fetch('/api/user/assistant-principals')
    .then((res) => (res.ok ? res.json() : { principals: [] }))
    .then((data) => {
      const principals: AssignedPrincipal[] = data.principals || [];
      cache = { at: Date.now(), principals };
      return principals;
    })
    .catch(() => [] as AssignedPrincipal[])
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Clear the cache (e.g. after an admin changes assignments). */
export function invalidateAssistantPrincipals() {
  cache = null;
}

/**
 * Fetches the people the current user may file requests on behalf of — the
 * principals a systems admin has assigned them to as an assistant. Returns an
 * empty list when the user has no assignments, so the on-behalf field hides
 * itself. Backed by a session cache so it's instant after the first form.
 */
export function useAssistantPrincipals() {
  const { status } = useSession();
  // Seed synchronously from cache so a warm field renders on first paint.
  const [principals, setPrincipals] = useState<AssignedPrincipal[]>(() => cache?.principals ?? []);
  const [loading, setLoading] = useState(() => !cache);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    loadPrincipals().then((list) => {
      if (!cancelled) {
        setPrincipals(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return { principals, loading };
}

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface HrimsUserProfile {
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    job_title: string | null;
    department_id: string | null;
    business_unit_id: string;
  } | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  businessUnit: {
    id: string;
    name: string;
    code: string;
  } | null;
  position: {
    id: string;
    position_title: string;
    grade: string | null;
    level: number;
  } | null;
  found: boolean;
}

const CACHE_PREFIX = 'hrims:profile:';
/** Cache freshness window — older entries are still served as a fallback when the
 *  network is unreachable, but a refresh attempt happens in the background. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedEntry {
  profile: HrimsUserProfile;
  cachedAt: number;
}

function readCache(email: string): CachedEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + email);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry;
    if (!parsed || typeof parsed.cachedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(email: string, profile: HrimsUserProfile) {
  if (typeof window === 'undefined') return;
  try {
    const entry: CachedEntry = { profile, cachedAt: Date.now() };
    window.localStorage.setItem(CACHE_PREFIX + email, JSON.stringify(entry));
  } catch {
    /* storage quota / private mode — caching is best-effort */
  }
}

export function useUserHrimsProfile() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<HrimsUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  /** True when the profile we're showing came from the local cache because the
   *  HRIMS API was unreachable. Surfaces a "showing cached data" UI hint. */
  const [usingCache, setUsingCache] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchProfile() {
      const email = session?.user?.email;
      if (!email) {
        setLoading(false);
        return;
      }

      // Prime the UI from cache immediately so the form doesn't flash N/A
      // while the network request is in-flight, AND to keep the user
      // productive when HRIMS is unreachable.
      const cached = readCache(email);
      if (cached) {
        setProfile(cached.profile);
        setUsingCache(true);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const response = await fetch(`/api/hrims/employee-by-email?email=${encodeURIComponent(email)}`);
        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.ok && data.found) {
          const fresh: HrimsUserProfile = {
            employee: data.employee,
            department: data.department,
            businessUnit: data.businessUnit,
            position: data.position,
            found: true,
          };
          setProfile(fresh);
          setUsingCache(false);
          setError(null);
          writeCache(email, fresh);
        } else if (response.status === 404 || (response.ok && data.found === false)) {
          // Authoritative "user not in HRIMS" — this is a SUCCESSFUL response,
          // not a network failure. Don't fall back to cache and don't surface
          // an "unreachable" banner.
          const empty: HrimsUserProfile = {
            employee: null,
            department: null,
            businessUnit: null,
            position: null,
            found: false,
          };
          setProfile(empty);
          setUsingCache(false);
          setError(null);
          writeCache(email, empty);
        } else {
          // 5xx / network glitch — keep whatever cache we have on screen.
          throw new Error(data?.error || `HRIMS responded ${response.status}`);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching HRIMS profile:', err);
        setError(err as Error);
        if (!cached) {
          setProfile({
            employee: null,
            department: null,
            businessUnit: null,
            position: null,
            found: false,
          });
        }
        // If we did have cached data, leave it on screen — usingCache stays true.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, [session?.user?.email]);

  const cached = readCache(session?.user?.email || '');
  const cacheAgeMs = cached ? Date.now() - cached.cachedAt : null;
  const cacheStale = cacheAgeMs != null && cacheAgeMs > CACHE_TTL_MS;

  return {
    profile,
    loading,
    error,
    usingCache,
    cacheStale,
    departmentName: profile?.department?.name || null,
    businessUnitName: profile?.businessUnit?.name || null,
    jobTitle: profile?.employee?.job_title || null,
    positionTitle: profile?.position?.position_title || null,
  };
}

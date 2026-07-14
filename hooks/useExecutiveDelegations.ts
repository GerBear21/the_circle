import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export interface EligibleExecutive {
  userId: string;
  name: string;
  positionTitle: string;
  email: string;
}

/**
 * Fetches the executives the current user may file forms on behalf of (the CEO
 * and direct CEO reports who have an active delegation to this user). Returns an
 * empty list when the user has no such delegations — the on-behalf field then
 * hides itself.
 */
export function useExecutiveDelegations() {
  const { status } = useSession();
  const [executives, setExecutives] = useState<EligibleExecutive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/hrims/executives');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setExecutives(data.executives || []);
      } catch {
        // Non-fatal — leave list empty.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return { executives, loading };
}

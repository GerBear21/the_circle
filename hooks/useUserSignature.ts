import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export function useUserSignature() {
  const { data: session, status } = useSession();
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSignature() {
      if (status === 'loading') return;
      
      if (!session?.user) {
        setSignatureUrl(null);
        setLoading(false);
        return;
      }

      const userId = (session.user as any).id;
      const displayName = session.user.name || (session.user as any).display_name;
      setUserName(displayName || null);

      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Private bucket: resolve via the API, which returns the authenticated
        // proxy URL only when the signature actually exists.
        const res = await fetch('/api/signature/has-signature');
        if (res.ok) {
          const data = await res.json();
          setSignatureUrl(data.hasSignature ? data.signatureUrl : null);
        } else {
          setSignatureUrl(null);
        }
      } catch (err) {
        console.error('Error fetching signature:', err);
        setSignatureUrl(null);
      } finally {
        setLoading(false);
      }
    }

    fetchSignature();
  }, [session, status]);

  return {
    signatureUrl,
    userName,
    loading: loading || status === 'loading',
    hasSignature: !!signatureUrl,
  };
}

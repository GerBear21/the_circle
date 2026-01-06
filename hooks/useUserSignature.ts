import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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
        // Get the public URL for the user's signature
        const { data } = supabase.storage.from('signatures').getPublicUrl(`${userId}.png`);
        
        // Check if the signature actually exists
        const res = await fetch(data.publicUrl, { method: 'HEAD' });
        if (res.ok) {
          setSignatureUrl(data.publicUrl);
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

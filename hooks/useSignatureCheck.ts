import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface SignatureCheckResult {
  hasSignature: boolean;
  signatureUrl: string | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSignatureCheck(): SignatureCheckResult {
  const { data: session, status } = useSession();
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const checkSignature = useCallback(async () => {
    if (status === 'loading') return;
    
    if (!session) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/signature/has-signature');
      
      if (!response.ok) {
        throw new Error('Failed to check signature');
      }

      const data = await response.json();
      setHasSignature(data.hasSignature);
      setSignatureUrl(data.signatureUrl);
    } catch (err) {
      setError(err as Error);
      console.error('Error checking signature:', err);
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    checkSignature();
  }, [checkSignature]);

  return {
    hasSignature,
    signatureUrl,
    loading,
    error,
    refetch: checkSignature,
  };
}

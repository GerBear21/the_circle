import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface SignatureCheckResult {
  hasSignature: boolean;
  signatureUrl: string | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const SIGNATURE_CACHE_KEY = 'signature_check_cache';
const SIGNATURE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface SignatureCache {
  hasSignature: boolean;
  signatureUrl: string | null;
  timestamp: number;
  userId: string;
}

function getSignatureCache(userId: string): SignatureCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(SIGNATURE_CACHE_KEY);
    if (!cached) return null;
    const parsed: SignatureCache = JSON.parse(cached);
    // Check if cache is valid (same user and not expired)
    if (parsed.userId === userId && Date.now() - parsed.timestamp < SIGNATURE_CACHE_TTL) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function setSignatureCache(userId: string, hasSignature: boolean, signatureUrl: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const cache: SignatureCache = {
      hasSignature,
      signatureUrl,
      timestamp: Date.now(),
      userId,
    };
    sessionStorage.setItem(SIGNATURE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

export function useSignatureCheck(): SignatureCheckResult {
  const { data: session, status } = useSession();
  const [hasSignature, setHasSignature] = useState(true); // Default to true to prevent flash
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const userId = (session?.user as any)?.id;

  const checkSignature = useCallback(async (forceRefresh = false) => {
    if (status === 'loading') return;
    
    if (!session || !userId) {
      setLoading(false);
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getSignatureCache(userId);
      if (cached) {
        setHasSignature(cached.hasSignature);
        setSignatureUrl(cached.signatureUrl);
        setLoading(false);
        return;
      }
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
      
      // Cache the result
      setSignatureCache(userId, data.hasSignature, data.signatureUrl);
    } catch (err) {
      setError(err as Error);
      console.error('Error checking signature:', err);
    } finally {
      setLoading(false);
    }
  }, [session, status, userId]);

  // Force refresh function that clears cache
  const refetch = useCallback(async () => {
    await checkSignature(true);
  }, [checkSignature]);

  useEffect(() => {
    checkSignature();
  }, [checkSignature]);

  return {
    hasSignature,
    signatureUrl,
    loading,
    error,
    refetch,
  };
}

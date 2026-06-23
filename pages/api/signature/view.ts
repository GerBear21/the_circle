/**
 * Authenticated signature proxy.
 *
 * Streams signature images from the PRIVATE `signatures` bucket after an
 * authorization check, replacing the old public-bucket URLs. Modes:
 *
 *   ?userId=<uuid>   session required; allowed if it's the caller's own
 *                    signature or the target user is in the caller's org.
 *   ?path=<object>   session required; same-org check derived from the path.
 *                    Restricted to known-safe object shapes.
 *   ?temp=<id>       NO session (mobile QR hand-off, which is pre-auth). The
 *                    high-entropy sessionId is the capability; we only ever
 *                    expose the matching temp/<id>.png object.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  userSignaturePath,
  tempSignaturePath,
  downloadSignature,
  signatureExists,
  ownerIdFromPath,
  isAllowedSignaturePath,
} from '@/lib/signatureStorage';
import { validateQuery, z } from '@/lib/validate';

const QuerySchema = z
  .object({
    userId: z.string().uuid().optional(),
    path: z.string().min(1).max(256).optional(),
    temp: z.string().min(8).max(128).optional(),
  })
  .refine((q) => !!(q.userId || q.path || q.temp), {
    message: 'One of userId, path or temp is required',
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server not configured' });
  }
  const isHead = req.method === 'HEAD';

  const query = validateQuery(req, res, QuerySchema);
  if (!query) return;

  let objectPath: string;

  if (query.temp) {
    // Capability-based: possession of the sessionId grants access to that
    // single temp object. No session required (QR upload is pre-auth).
    if (!/^[0-9a-zA-Z_-]{8,128}$/.test(query.temp)) {
      return res.status(400).json({ error: 'Invalid temp id' });
    }
    objectPath = tempSignaturePath(query.temp);
  } else {
    // userId / path modes require an authenticated, same-org caller.
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const callerId = (session.user as any).id as string | undefined;
    const callerOrg = (session.user as any).org_id as string | undefined;

    let ownerId: string | null;
    if (query.userId) {
      ownerId = query.userId;
      objectPath = userSignaturePath(query.userId);
    } else {
      // path mode
      if (!isAllowedSignaturePath(query.path!)) {
        return res.status(400).json({ error: 'Invalid signature path' });
      }
      objectPath = query.path!;
      ownerId = ownerIdFromPath(query.path!);
    }

    // Authorize: own signature, or same organization as the owner.
    if (ownerId && ownerId !== callerId) {
      if (!callerOrg) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { data: owner } = await supabaseAdmin
        .from('app_users')
        .select('organization_id')
        .eq('id', ownerId)
        .maybeSingle();
      if (!owner || (owner as any).organization_id !== callerOrg) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
  }

  // HEAD: existence check only, no body (used by client signature probes).
  if (isHead) {
    const exists = await signatureExists(objectPath);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(exists ? 200 : 404).end();
  }

  const file = await downloadSignature(objectPath);
  if (!file) {
    return res.status(404).json({ error: 'Signature not found' });
  }

  res.setHeader('Content-Type', file.contentType || 'image/png');
  // Private: a signature is per-user PII; allow short-lived browser caching only.
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Length', String(file.buffer.length));
  return res.status(200).send(file.buffer);
}

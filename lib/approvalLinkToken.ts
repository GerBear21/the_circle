import crypto from 'crypto';

/**
 * Stateless, HMAC-signed magic-link token for approval emails.
 *
 * The token binds a specific approver to a specific request and is signed with
 * NEXTAUTH_SECRET, so it cannot be forged. Clicking an approval email link
 * carrying a valid token signs the approver in (via the `approval-link`
 * credentials provider) and drops them straight on the request — no login page.
 *
 * Security posture:
 *   - signed (HMAC-SHA256) → unforgeable without the server secret
 *   - bound to { approverId, requestId } → only useful for that approval
 *   - short-lived (14 days by default, matched to approval SLAs)
 *   - the provider ALSO re-checks the user is an approver on that request
 * Treat the link like a password: anyone who receives the email can act as that
 * approver until it expires.
 */

const PURPOSE = 'approval-access';
const DEFAULT_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days

interface ApprovalTokenPayload {
  p: string;
  aid: string; // approver app_users.id
  rid: string; // request id
  iat: number;
  exp: number;
}

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || '';
}

function hmac(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function createApprovalLinkToken(params: {
  approverId: string;
  requestId: string;
  ttlSeconds?: number;
}): string {
  const secret = getSecret();
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured');
  const now = Math.floor(Date.now() / 1000);
  const payload: ApprovalTokenPayload = {
    p: PURPOSE,
    aid: params.approverId,
    rid: params.requestId,
    iat: now,
    exp: now + (params.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${hmac(payloadB64, secret)}`;
}

export function verifyApprovalLinkToken(token: string): { approverId: string; requestId: string } | null {
  try {
    const secret = getSecret();
    if (!secret || typeof token !== 'string') return null;
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;

    const expected = hmac(payloadB64, secret);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as ApprovalTokenPayload;
    if (payload.p !== PURPOSE) return null;
    if (typeof payload.exp !== 'number' || Math.floor(Date.now() / 1000) > payload.exp) return null;
    if (!payload.aid || !payload.rid) return null;
    return { approverId: payload.aid, requestId: payload.rid };
  } catch {
    return null;
  }
}

/** Build the absolute magic-link URL for an approval email. */
export function approvalLinkUrl(baseUrl: string, approverId: string, requestId: string): string {
  const token = createApprovalLinkToken({ approverId, requestId });
  const next = encodeURIComponent(`/requests/${requestId}`);
  return `${baseUrl.replace(/\/+$/, '')}/approvals/go?token=${encodeURIComponent(token)}&next=${next}`;
}

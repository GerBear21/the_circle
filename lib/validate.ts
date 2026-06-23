/**
 * Request validation (Zod) for API routes.
 *
 * Two usage styles:
 *
 *   // 1. Inline guards — validate then bail; returns null after sending 400.
 *   const body = validateBody(req, res, MySchema);
 *   if (!body) return;
 *
 *   // 2. Wrapper — validate body/query before the handler runs.
 *   export default withValidation({ body: MySchema }, handler);
 *
 * On failure a 400 is returned with a compact field→messages map. Schemas
 * should be strict about the fields they care about; use `.passthrough()` only
 * when a route legitimately forwards arbitrary extra keys.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { z, ZodSchema, ZodError } from 'zod';

function formatZodError(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (out[key] ||= []).push(issue.message);
  }
  return out;
}

/** Validate `req.body`. Returns the parsed value, or null after sending 400. */
export function validateBody<T>(
  req: NextApiRequest,
  res: NextApiResponse,
  schema: ZodSchema<T>
): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request body', details: formatZodError(result.error) });
    return null;
  }
  return result.data;
}

/** Validate `req.query`. Returns the parsed value, or null after sending 400. */
export function validateQuery<T>(
  req: NextApiRequest,
  res: NextApiResponse,
  schema: ZodSchema<T>
): T | null {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request parameters', details: formatZodError(result.error) });
    return null;
  }
  return result.data;
}

/** Wrap a handler so body/query are validated before it runs. */
export function withValidation<B = unknown, Q = unknown>(
  schemas: { body?: ZodSchema<B>; query?: ZodSchema<Q> },
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown | Promise<unknown>
) {
  return async function validated(req: NextApiRequest, res: NextApiResponse) {
    if (schemas.query) {
      const q = schemas.query.safeParse(req.query);
      if (!q.success) {
        return res.status(400).json({ error: 'Invalid request parameters', details: formatZodError(q.error) });
      }
    }
    if (schemas.body && req.method !== 'GET' && req.method !== 'HEAD') {
      const b = schemas.body.safeParse(req.body);
      if (!b.success) {
        return res.status(400).json({ error: 'Invalid request body', details: formatZodError(b.error) });
      }
    }
    return handler(req, res);
  };
}

// ---------------------------------------------------------------------------
// Shared primitives reused across routes.
// ---------------------------------------------------------------------------
export const zUuid = z.string().uuid();
/** A single `id` query param (Next puts dynamic route params on req.query). */
export const zIdQuery = z.object({ id: z.string().min(1) });
export const zUuidIdQuery = z.object({ id: zUuid });
/** Common list pagination, coercing string query params to numbers. */
export const zPagination = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export { z };

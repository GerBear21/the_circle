-- ============================================================
-- Migration: Distributed rate-limit counters
--
-- Fixed-window rate limiting that is correct across every serverless
-- instance (Vercel functions + edge middleware) by keeping the counters
-- in Postgres instead of per-instance memory.
--
-- A "window" is aligned to a fixed boundary (floor(now / window) * window)
-- so concurrent requests deterministically land in the same bucket and the
-- increment is atomic via INSERT ... ON CONFLICT DO UPDATE.
--
-- Callers identify a bucket by an opaque key, e.g.
--   'global:203.0.113.7'         (per-IP flood protection)
--   'login:203.0.113.7'          (auth brute-force protection)
--   'api:user-<uuid>:/api/x'     (per-user, per-route)
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_counters (
    bucket_key    TEXT        NOT NULL,
    window_start  TIMESTAMPTZ NOT NULL,
    request_count INTEGER     NOT NULL DEFAULT 0,
    expires_at    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (bucket_key, window_start)
);

-- Supports cheap pruning of stale windows.
CREATE INDEX IF NOT EXISTS idx_rate_limit_expires ON rate_limit_counters(expires_at);

-- ------------------------------------------------------------
-- Atomically record a hit and report whether it is allowed.
--
-- Returns one row:
--   allowed       -- false once the window count exceeds p_max_requests
--   current_count -- hits recorded in the current window (incl. this one)
--   remaining     -- requests left before blocking (never negative)
--   reset_at      -- when the current window rolls over
--   retry_after   -- seconds until reset (0 while still allowed)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key            TEXT,
    p_max_requests   INTEGER,
    p_window_seconds INTEGER
)
RETURNS TABLE (
    allowed       BOOLEAN,
    current_count INTEGER,
    remaining     INTEGER,
    reset_at      TIMESTAMPTZ,
    retry_after   INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_reset_at     TIMESTAMPTZ;
    v_count        INTEGER;
BEGIN
    -- Align to the fixed window boundary so all instances agree on the bucket.
    v_window_start := to_timestamp(
        floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
    );
    v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

    INSERT INTO rate_limit_counters AS r (bucket_key, window_start, request_count, expires_at)
    VALUES (p_key, v_window_start, 1, v_reset_at)
    ON CONFLICT (bucket_key, window_start)
    DO UPDATE SET request_count = r.request_count + 1
    RETURNING r.request_count INTO v_count;

    RETURN QUERY SELECT
        v_count <= p_max_requests,
        v_count,
        GREATEST(0, p_max_requests - v_count),
        v_reset_at,
        CASE
            WHEN v_count <= p_max_requests THEN 0
            ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_reset_at - clock_timestamp()))))::INTEGER
        END;
END;
$$;

-- ------------------------------------------------------------
-- Housekeeping: drop windows that have already reset. Safe to run anytime;
-- schedule via pg_cron (e.g. every 5 min) if the extension is available:
--   SELECT cron.schedule('prune-rate-limits', '*/5 * * * *',
--                        'SELECT prune_rate_limit_counters()');
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION prune_rate_limit_counters()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limit_counters WHERE expires_at < clock_timestamp();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- Counters are written and read exclusively by the service role (API/edge).
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE rate_limit_counters IS
    'Fixed-window rate-limit counters shared across serverless instances. Written via check_rate_limit(); pruned via prune_rate_limit_counters().';

-- ============================================================
-- Fully approve a published CAPEX request + land it on the tracker
-- ============================================================
-- Marks every approval step as approved, records an approval row per
-- step, flips the request to 'approved', and ensures a capex_tracker
-- row exists with status "CAPEX Approved – Awaiting Funding" so the
-- request shows up on /finance/capex-tracker.
--
-- Targets the request published on 2026-06-05 ("CAPEX: Testing project
-- name"). Change v_request_id to re-use for another CAPEX.
-- Idempotent: safe to run more than once.
-- ============================================================

DO $$
DECLARE
    v_request_id   UUID := '23f429e2-6844-4235-b0ce-ed63362b4e87';
    v_request      requests%ROWTYPE;
    v_meta         JSONB;
    v_cost         NUMERIC(14,2);
    v_supplier     TEXT;
    v_fy           INTEGER;
    v_capex_date   DATE;
    v_step         RECORD;
BEGIN
    SELECT * INTO v_request FROM requests WHERE id = v_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request % not found', v_request_id;
    END IF;

    v_meta := COALESCE(v_request.metadata, '{}'::jsonb);

    -- 1. Approve every step + record an approval row (skip already-approved).
    FOR v_step IN
        SELECT id, approver_user_id FROM request_steps WHERE request_id = v_request_id
    LOOP
        UPDATE request_steps
           SET status = 'approved'
         WHERE id = v_step.id
           AND status <> 'approved';

        IF NOT EXISTS (
            SELECT 1 FROM approvals WHERE step_id = v_step.id AND decision = 'approved'
        ) THEN
            INSERT INTO approvals (request_id, step_id, approver_id, decision, comment, signed_at, signature_type)
            VALUES (v_request_id, v_step.id, v_step.approver_user_id, 'approved',
                    'Approved via administrative back-fill.', now(), 'manual');
        END IF;
    END LOOP;

    -- 2. Flip the request itself to approved.
    UPDATE requests
       SET status = 'approved',
           metadata = jsonb_set(v_meta, '{current_step}', to_jsonb(
               (SELECT COUNT(*) FROM request_steps WHERE request_id = v_request_id)), true),
           updated_at = now()
     WHERE id = v_request_id;

    -- 3. Ensure a tracker row exists (none was created for this legacy request).
    --    Cost may carry thousands separators (e.g. "3,434") — strip non-numeric chars.
    v_cost := NULLIF(regexp_replace(COALESCE(v_meta->>'amount', '0'), '[^0-9.]', '', 'g'), '')::numeric;
    v_cost := COALESCE(v_cost, 0);

    -- Supplier: prefer the selected quotation, else the first named supplier.
    SELECT q->>'supplierName' INTO v_supplier
      FROM jsonb_array_elements(COALESCE(v_meta->'quotations', '[]'::jsonb)) q
     WHERE COALESCE(q->>'isSelectedSupplier', 'false') = 'true'
       AND COALESCE(NULLIF(trim(q->>'supplierName'), ''), '') <> ''
     LIMIT 1;
    IF v_supplier IS NULL THEN
        SELECT q->>'supplierName' INTO v_supplier
          FROM jsonb_array_elements(COALESCE(v_meta->'quotations', '[]'::jsonb)) q
         WHERE COALESCE(NULLIF(trim(q->>'supplierName'), ''), '') <> ''
         LIMIT 1;
    END IF;

    v_capex_date := COALESCE(NULLIF(v_meta->>'startDate', '')::date, v_request.created_at::date);
    v_fy := EXTRACT(YEAR FROM v_capex_date)::int;

    INSERT INTO capex_tracker (
        request_id, organization_id, ranking, supplier, description, capex_date,
        cost, funded, champion_user_id, status_update, department, financial_year,
        is_budgeted, created_by, last_updated_by
    ) VALUES (
        v_request_id, v_request.organization_id, NULL, v_supplier,
        COALESCE(v_meta->>'projectName', v_request.title, 'CAPEX Request'),
        v_capex_date, v_cost, 0, v_request.creator_id,
        'CAPEX Approved – Awaiting Funding', v_meta->>'department', v_fy,
        COALESCE((v_meta->>'isBudgeted')::boolean, true),
        v_request.creator_id, v_request.creator_id
    )
    ON CONFLICT (request_id) DO UPDATE
        SET status_update = 'CAPEX Approved – Awaiting Funding',
            last_updated_at = now();

    RAISE NOTICE 'CAPEX % fully approved; tracker cost=%, supplier=%', v_request_id, v_cost, v_supplier;
END $$;

-- ============================================================================
-- BACKFILL: Create notifications for existing pending delegation requests
-- ============================================================================
-- This migration creates notifications for system admins about delegation
-- requests that were created before the notification system was implemented.
-- Run this after deploying the notification feature.
-- ============================================================================

DO $$
DECLARE
    v_pending_delegation RECORD;
    v_admin_user RECORD;
    v_notification_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting backfill of notifications for pending delegations...';

    -- Loop through all pending delegations
    FOR v_pending_delegation IN
        SELECT
            d.id AS delegation_id,
            d.delegator_id,
            d.delegate_id,
            delegator.organization_id,
            d.created_by,
            d.created_at,
            delegator.display_name AS delegator_name,
            delegate.display_name AS delegate_name
        FROM approval_delegations d
        LEFT JOIN app_users delegator ON d.delegator_id = delegator.id
        LEFT JOIN app_users delegate ON d.delegate_id = delegate.id
        WHERE d.status = 'pending'
    LOOP
        -- Skip if organization_id is null (shouldn't happen but be safe)
        IF v_pending_delegation.organization_id IS NULL THEN
            RAISE NOTICE 'Skipping delegation % - no organization found for delegator %', 
                v_pending_delegation.delegation_id, v_pending_delegation.delegator_id;
            CONTINUE;
        END IF;
        -- Find all system admins and super admins for this organization
        FOR v_admin_user IN
            SELECT DISTINCT au.id AS admin_user_id
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            JOIN app_users au ON ur.user_id = au.id
            WHERE r.slug IN ('super_admin', 'system_admin')
              AND r.organization_id = v_pending_delegation.organization_id
              AND ur.is_active = true
              AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        LOOP
            -- Check if notification already exists for this admin + delegation
            IF NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.recipient_id = v_admin_user.admin_user_id
                  AND n.metadata->>'delegation_id' = v_pending_delegation.delegation_id::text
                  AND n.metadata->>'notification_type' = 'delegation_request'
            ) THEN
                -- Create notification
                INSERT INTO notifications (
                    organization_id,
                    recipient_id,
                    sender_id,
                    type,
                    title,
                    message,
                    metadata,
                    is_read,
                    created_at
                ) VALUES (
                    v_pending_delegation.organization_id,
                    v_admin_user.admin_user_id,
                    v_pending_delegation.created_by,
                    'task',
                    'Delegation Approval Required',
                    COALESCE(v_pending_delegation.delegator_name, v_pending_delegation.delegator_id) ||
                        ' has requested to delegate their approval authority to ' ||
                        COALESCE(v_pending_delegation.delegate_name, v_pending_delegation.delegate_id) ||
                        '. Your review is required.',
                    jsonb_build_object(
                        'delegation_id', v_pending_delegation.delegation_id,
                        'action_label', 'Review Delegation',
                        'action_url', '/admin/settings?tab=delegations',
                        'notification_type', 'delegation_request'
                    ),
                    false,
                    v_pending_delegation.created_at
                );

                v_notification_count := v_notification_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Backfill complete. Created % notifications for pending delegations.', v_notification_count;
END $$;

-- ============================================================================
-- Verify the results
-- ============================================================================
SELECT
    'Pending delegations' as metric,
    COUNT(*) as count
FROM approval_delegations
WHERE status = 'pending'
UNION ALL
SELECT
    'Notifications created for delegations' as metric,
    COUNT(*) as count
FROM notifications
WHERE metadata->>'notification_type' = 'delegation_request';

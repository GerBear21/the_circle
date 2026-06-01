/**
 * Auto-create a petty-cash request from a fully-approved travel authorisation.
 *
 * Flow (per the IPD):
 *   Employee submits Travel Auth
 *       ↓
 *   Travel auth approval chain runs
 *       ↓
 *   Travel auth reaches "approved"  ← (we hook in here)
 *       ↓
 *   This module spawns a NEW petty-cash request, pre-filled with the trip's
 *   purpose / total / linkage, routed through HOD → Accountant → Finance Director,
 *   and notifies the requester that the voucher has been generated for them.
 *
 * Failure modes (any of the below ⇒ fall back to the old "would you like to
 * process petty cash?" CTA):
 *   - HRIMS not configured / approver chain incomplete
 *   - A petty-cash voucher is already linked to this travel auth
 *   - Travel auth has no usable budget data
 *
 * The function is best-effort: errors are logged but never propagate to the
 * approval engine. A failed auto-create must not break the travel auth's
 * own approval workflow.
 */

import { supabaseAdmin } from './supabaseAdmin';
import { hrimsClient, findEmployeeByPositionTitle, type HrimsEmployee } from './hrimsClient';

interface ResolvedApprover {
    userId: string;
    displayName: string;
    email: string;
    positionTitle: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Approver resolution — mirrors the petty-cash branch of
// pages/api/hrims/resolve-approvers.ts but is callable from server code
// without an HTTP round-trip.
// ─────────────────────────────────────────────────────────────────────────────

async function findAppUserByEmail(
    email: string,
    organizationId: string,
): Promise<{ id: string; display_name: string; email: string } | null> {
    const { data } = await supabaseAdmin
        .from('app_users')
        .select('id, display_name, email')
        .eq('organization_id', organizationId)
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
    return data || null;
}

async function findEmployeeForPosition(positionId: string, employeeIdOnPosition?: string | null): Promise<HrimsEmployee | null> {
    if (!hrimsClient) return null;
    const { data: empByPos } = await hrimsClient
        .from('employees')
        .select('id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id')
        .eq('current_position_id', positionId)
        .eq('employment_status', 'active')
        .limit(1)
        .single();
    if (empByPos) return empByPos as HrimsEmployee;

    if (employeeIdOnPosition) {
        const { data: empById } = await hrimsClient
            .from('employees')
            .select('id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id')
            .eq('id', employeeIdOnPosition)
            .eq('employment_status', 'active')
            .single();
        if (empById) return empById as HrimsEmployee;
    }
    return null;
}

async function resolveByTitle(title: string, organizationId: string): Promise<ResolvedApprover | null> {
    const result = await findEmployeeByPositionTitle(title);
    if (!result?.employee?.email) return null;
    const appUser = await findAppUserByEmail(result.employee.email, organizationId);
    if (!appUser) return null;
    return {
        userId: appUser.id,
        displayName: appUser.display_name,
        email: appUser.email,
        positionTitle: result.position.position_title,
    };
}

async function resolveDepartmentHead(requesterEmail: string, organizationId: string): Promise<ResolvedApprover | null> {
    if (!hrimsClient) return null;

    const { data: requesterEmp } = await hrimsClient
        .from('employees')
        .select('id, first_name, last_name, email, current_position_id, department_id')
        .ilike('email', requesterEmail)
        .eq('employment_status', 'active')
        .single();
    if (!requesterEmp) return null;

    // 1. Authoritative source: departments.department_head_id
    if (requesterEmp.department_id) {
        const { data: dept } = await hrimsClient
            .from('departments')
            .select('id, name, department_head_id')
            .eq('id', requesterEmp.department_id)
            .single();
        if (dept?.department_head_id && dept.department_head_id !== requesterEmp.id) {
            const { data: headEmp } = await hrimsClient
                .from('employees')
                .select('id, first_name, last_name, email, phone, job_title, employee_number, employment_status, manager_id, department_id, business_unit_id, current_position_id')
                .eq('id', dept.department_head_id)
                .eq('employment_status', 'active')
                .single();
            if (headEmp?.email) {
                const appUser = await findAppUserByEmail(headEmp.email, organizationId);
                if (appUser) {
                    return {
                        userId: appUser.id,
                        displayName: appUser.display_name,
                        email: appUser.email,
                        positionTitle: headEmp.job_title || `Head of ${dept.name}`,
                    };
                }
            }
        }
    }

    // 2. Walk up the organogram chain for a head-like title
    if (requesterEmp.current_position_id) {
        let currentPosId: string | null = requesterEmp.current_position_id;
        let safety = 0;
        while (currentPosId && safety < 10) {
            safety++;
            const { data: pos } = await hrimsClient
                .from('organogram_positions')
                .select('id, position_title, parent_position_id, employee_id, is_active')
                .eq('id', currentPosId)
                .single();
            if (!pos) break;

            const looksLikeHead = /head\s+of|hod|director|general\s+manager|chief/i.test(pos.position_title || '');
            if (pos.id !== requesterEmp.current_position_id && pos.is_active && looksLikeHead) {
                const headEmp = await findEmployeeForPosition(pos.id, pos.employee_id);
                if (headEmp && headEmp.id !== requesterEmp.id && headEmp.email) {
                    const appUser = await findAppUserByEmail(headEmp.email, organizationId);
                    if (appUser) {
                        return {
                            userId: appUser.id,
                            displayName: appUser.display_name,
                            email: appUser.email,
                            positionTitle: pos.position_title,
                        };
                    }
                }
            }

            currentPosId = pos.parent_position_id;
        }
    }
    return null;
}

async function resolvePettyCashApprovers(
    requesterEmail: string,
    organizationId: string,
): Promise<{
    department_head: ResolvedApprover | null;
    accountant: ResolvedApprover | null;
    finance_director: ResolvedApprover | null;
}> {
    if (!hrimsClient) {
        return { department_head: null, accountant: null, finance_director: null };
    }

    const department_head = await resolveDepartmentHead(requesterEmail, organizationId);

    // Accountant — try a few common titles
    let accountant = await resolveByTitle('Accountant', organizationId);
    if (!accountant) accountant = await resolveByTitle('Senior Accountant', organizationId);
    if (!accountant) accountant = await resolveByTitle('Group Accountant', organizationId);

    // Finance Director — per the user's IPD, the third gate.
    let finance_director = await resolveByTitle('Finance Director', organizationId);
    if (!finance_director) finance_director = await resolveByTitle('Director of Finance', organizationId);
    if (!finance_director) finance_director = await resolveByTitle('Finance Manager', organizationId);
    if (!finance_director) finance_director = await resolveByTitle('Head of Finance', organizationId);

    return { department_head, accountant, finance_director };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-fill: turn a travel auth's budget into petty-cash line items.
// ─────────────────────────────────────────────────────────────────────────────

interface PrefillLineItem {
    description: string;
    amount: string;
    chargeTo: string;
}

function buildLineItemsFromTravelAuth(metadata: any): { lineItems: PrefillLineItem[]; total: number } {
    const allocation: Record<string, any> = metadata?.costAllocation || {};
    const dominantCode = Object.entries(allocation)
        .filter(([, v]) => parseFloat(String(v)) > 0)
        .sort(([, a], [, b]) => parseFloat(String(b)) - parseFloat(String(a)))
        .map(([k]) => k.toUpperCase())[0] || '';

    const budget = metadata?.budget || {};
    const items: PrefillLineItem[] = [];

    const tryAdd = (label: string, data: any) => {
        if (!data) return;
        const total = parseFloat(String(data.totalCost ?? '0')) || 0;
        if (total > 0) {
            items.push({ description: label, amount: total.toFixed(2), chargeTo: dominantCode });
        }
    };

    tryAdd('Fuel', budget.fuel);
    tryAdd('AA Rates (Personal Vehicle)', budget.aaRates);
    tryAdd('Air / Bus Tickets', budget.airBusTickets);
    tryAdd('Overnight Accommodation', budget.bnb || budget.accommodation);
    tryAdd('Lunch / Dinner', budget.lunchDinner);
    tryAdd('Conferencing Cost', budget.conferencingCost);

    if (Array.isArray(budget.tollgates)) {
        for (const t of budget.tollgates) {
            const total = parseFloat(String(t?.totalCost ?? '0')) || 0;
            if (total > 0) {
                items.push({
                    description: `Tollgate${t.road ? ` — ${t.road}` : ''}`,
                    amount: total.toFixed(2),
                    chargeTo: dominantCode,
                });
            }
        }
    }

    if (budget.other) {
        const total = parseFloat(String(budget.other.totalCost ?? '0')) || 0;
        if (total > 0) {
            items.push({
                description: budget.other.description || 'Other expenses',
                amount: total.toFixed(2),
                chargeTo: dominantCode,
            });
        }
    }

    // If we couldn't derive any line items but a grand total exists, fall back
    // to a single line so the voucher still has SOMETHING to anchor on.
    const grand = parseFloat(String(metadata?.grandTotal ?? '0')) || 0;
    if (items.length === 0 && grand > 0) {
        items.push({
            description: metadata?.purposeOfTravel
                ? `Petty cash for: ${metadata.purposeOfTravel}`
                : 'Travel-related petty cash',
            amount: grand.toFixed(2),
            chargeTo: dominantCode,
        });
    }

    const total = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
    return { lineItems: items, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point.
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoPettyCashResult {
    success: boolean;
    pettyCashRequestId?: string;
    error?: string;
    /** True when we deliberately did not auto-create (e.g. already linked, no data). */
    skipped?: boolean;
}

/**
 * Auto-create a petty cash request linked to a fully-approved travel auth.
 *
 * Returns success even if approver resolution partially fails — the caller
 * (approvalEngine) decides whether to surface the manual fallback notification
 * based on `result.skipped`.
 */
export async function autoCreatePettyCashFromTravelAuth(
    travelAuthId: string,
): Promise<AutoPettyCashResult> {
    // Load the travel-auth + creator details.
    const { data: travelAuth, error: travelError } = await supabaseAdmin
        .from('requests')
        .select(`
            id, organization_id, creator_id, status, title, metadata,
            creator:app_users!requests_creator_id_fkey ( id, display_name, email )
        `)
        .eq('id', travelAuthId)
        .single();

    if (travelError || !travelAuth) {
        return { success: false, error: 'Travel authorisation not found' };
    }

    const metadata = (travelAuth.metadata as any) || {};
    const requestType = metadata.type || metadata.requestType;
    const isTravelAuth = requestType === 'travel_authorization' || requestType === 'international_travel_authorization';
    const isCompWithTravel = (
        requestType === 'hotel_booking'
        || requestType === 'external_hotel_booking'
        || requestType === 'voucher_request'
    ) && metadata.processTravelDocument && metadata.travelDocument;
    if (!isTravelAuth && !isCompWithTravel) return { success: true, skipped: true };

    // Idempotency — if a petty cash is already linked, do nothing.
    if (metadata.linkedPettyCashId) return { success: true, skipped: true };

    // For comp requests, the budget/purpose/itinerary live inside the embedded
    // travel document rather than at the top level. Build a unified "travel
    // source" object the rest of this function can read uniformly.
    const travelSource: any = isCompWithTravel
        ? {
            ...metadata.travelDocument,
            grandTotal: metadata.grandTotal ?? metadata.travelDocument?.grandTotal,
            referenceCode: metadata.referenceCode,
            // costAllocation may live at top level for comp forms; fall back
            // through to the travel doc itself if not present.
            costAllocation: metadata.costAllocation || metadata.travelDocument?.costAllocation,
        }
        : metadata;

    const creator = Array.isArray(travelAuth.creator) ? travelAuth.creator[0] : travelAuth.creator;
    if (!creator?.email) {
        return { success: false, error: 'Creator email not available; cannot resolve approvers' };
    }

    const organizationId = travelAuth.organization_id as string;

    // Resolve approvers. If we can't get a full chain we DO NOT auto-create —
    // the user will see the legacy "would you like to process petty cash?" CTA
    // instead, letting them pick approvers themselves.
    const approvers = await resolvePettyCashApprovers(creator.email, organizationId);
    if (!approvers.department_head || !approvers.accountant || !approvers.finance_director) {
        return {
            success: false,
            skipped: true,
            error: 'Could not resolve full petty-cash approver chain — falling back to manual creation',
        };
    }

    // Build the pre-filled metadata.
    const { lineItems, total } = buildLineItemsFromTravelAuth(travelSource);
    if (lineItems.length === 0) {
        return { success: false, skipped: true, error: 'Travel source has no budget data to seed a petty cash voucher' };
    }

    const todayISO = new Date().toISOString().split('T')[0];

    const selectedApprovers = {
        department_head: approvers.department_head.userId,
        accountant: approvers.accountant.userId,
        finance_manager: approvers.finance_director.userId, // role key kept for compat
    };

    const pettyCashMetadata = {
        type: 'petty_cash',
        requestType: 'petty_cash',
        // Share the parent's reference code so the trip has ONE identifier.
        referenceCode: metadata.referenceCode,
        receiptDate: todayISO,
        purpose: travelSource.purposeOfTravel
            ? `Petty cash for: ${travelSource.purposeOfTravel}`
            : `Petty cash for travel — ${travelAuth.title}`,
        lineItems,
        totalAmount: total.toFixed(2),
        currency: 'USD',
        receivedBy: {
            name: creator.display_name,
            date: todayISO,
            isExternal: false,
        },
        linkedTravelAuthId: travelAuth.id,
        linkedTravelAuth: {
            id: travelAuth.id,
            title: travelAuth.title,
            referenceCode: metadata.referenceCode,
            purposeOfTravel: travelSource.purposeOfTravel,
            dateOfIntendedTravel: travelSource.dateOfIntendedTravel,
            // Tag the parent type so the linked voucher page can render
            // appropriate context (e.g. "from a comp booking" vs. "from a
            // travel auth").
            parentType: requestType,
        },
        approvers: [
            selectedApprovers.department_head,
            selectedApprovers.accountant,
            selectedApprovers.finance_manager,
        ],
        approverRoles: selectedApprovers,
        useParallelApprovals: false,
        watchers: [],
        // Provenance — useful in the UI to surface "auto-generated from
        // your approved travel authorisation" and in audits to show this
        // wasn't manually-typed by the requester.
        autoGenerated: true,
        autoGeneratedFrom: isCompWithTravel ? requestType : 'travel_authorization',
        autoGeneratedAt: new Date().toISOString(),
    };

    // Insert the petty cash request.
    const { data: pcRequest, error: pcError } = await supabaseAdmin
        .from('requests')
        .insert({
            organization_id: organizationId,
            creator_id: travelAuth.creator_id,
            title: `Petty Cash — ${metadata.purposeOfTravel || travelAuth.title}`,
            description: pettyCashMetadata.purpose,
            metadata: pettyCashMetadata,
            status: 'pending',
        })
        .select('id')
        .single();

    if (pcError || !pcRequest) {
        console.error('autoCreatePettyCash: failed to insert request:', pcError);
        return { success: false, error: pcError?.message || 'Failed to create petty cash request' };
    }

    // Insert sequential approval steps: HOD → Accountant → Finance Director.
    const approverChain = [
        { id: selectedApprovers.department_head, role: 'department_head', name: approvers.department_head.positionTitle },
        { id: selectedApprovers.accountant, role: 'accountant', name: approvers.accountant.positionTitle },
        { id: selectedApprovers.finance_manager, role: 'finance_director', name: approvers.finance_director.positionTitle },
    ];

    const stepsToCreate = approverChain.map((a, index) => ({
        request_id: pcRequest.id,
        step_index: index + 1,
        step_type: 'approval',
        approver_user_id: a.id,
        approver_role: a.role,
        status: index === 0 ? 'pending' : 'waiting',
        step_definition: { name: a.name, type: 'approval', approverType: 'specific_user', approverValue: a.id },
    }));

    const { error: stepsError } = await supabaseAdmin
        .from('request_steps')
        .insert(stepsToCreate);

    if (stepsError) {
        console.error('autoCreatePettyCash: failed to insert request_steps:', stepsError);
        // Don't roll back the request — we'd rather leave it in an inspectable
        // state than orphan it silently. The requester can re-trigger if needed.
        return { success: false, error: stepsError.message };
    }

    // Notify the first approver (HOD).
    try {
        await supabaseAdmin
            .from('notifications')
            .insert({
                organization_id: organizationId,
                recipient_id: selectedApprovers.department_head,
                sender_id: travelAuth.creator_id,
                type: 'task',
                title: 'Petty Cash Approval Required',
                message: `An auto-generated petty cash voucher for "${metadata.purposeOfTravel || travelAuth.title}" is ready for your approval (Step 1 of 3).`,
                metadata: {
                    request_id: pcRequest.id,
                    request_type: 'petty_cash',
                    action_label: 'Review Request',
                    action_url: `/requests/${pcRequest.id}`,
                    step_number: 1,
                    total_steps: 3,
                    auto_generated: true,
                },
                is_read: false,
            });
    } catch (notifError) {
        console.error('autoCreatePettyCash: failed to notify first approver:', notifError);
    }

    // Notify the requester so they know a voucher was spawned on their behalf.
    try {
        await supabaseAdmin
            .from('notifications')
            .insert({
                organization_id: organizationId,
                recipient_id: travelAuth.creator_id,
                type: 'info',
                title: 'Petty Cash Request Auto-Generated',
                message:
                    `A petty cash request (${metadata.referenceCode || 'PC'}, USD ${total.toFixed(2)}) has been auto-generated from your approved ${
                        isCompWithTravel ? 'complimentary booking' : 'travel authorisation'
                    } "${travelAuth.title}". ` +
                    `It is now routed to ${approvers.department_head.displayName} → ${approvers.accountant.displayName} → ${approvers.finance_director.displayName}. ` +
                    `You will be notified at each step.`,
                metadata: {
                    request_id: pcRequest.id,
                    request_type: 'petty_cash',
                    action_label: 'View Request',
                    action_url: `/requests/${pcRequest.id}`,
                    auto_generated_from: travelAuth.id,
                },
                is_read: false,
            });
    } catch (notifError) {
        console.error('autoCreatePettyCash: failed to notify requester:', notifError);
    }

    // Persist the back-link on the travel auth so the parent page can surface it.
    try {
        await supabaseAdmin
            .from('requests')
            .update({
                metadata: {
                    ...metadata,
                    linkedPettyCashId: pcRequest.id,
                    autoGeneratedPettyCashAt: new Date().toISOString(),
                },
            })
            .eq('id', travelAuth.id);
    } catch (linkError) {
        console.error('autoCreatePettyCash: failed to write back-link:', linkError);
    }

    return { success: true, pettyCashRequestId: pcRequest.id };
}

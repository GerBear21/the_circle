/**
 * travelAuthPreview
 * -----------------
 * Single source of truth for the Travel Authorisation document layout.
 *
 * Both the pre-submission preview (rendered inside `/requests/new/travel-auth`)
 * and the post-submission preview (rendered inside `/requests/[id]` and the
 * approved-archive modal) must look identical — the user has been bitten by
 * "submit looked perfect, the detail page looks completely different" before,
 * so this module is the contract. Whenever the form layout changes, change
 * it here and both call sites pick it up.
 *
 * The builder accepts a normalised data shape that can be populated from
 * either form state (when the user hasn't submitted yet) or stored metadata
 * + request_steps (after submission), so call sites don't have to pre-shape
 * the data themselves.
 */

import type { ReactNode } from 'react';
import type { PreviewSection, DocumentHeader } from '../../components/ui';

// ──────────────────────────────────────────────────────────────────────
// Shared inline styles — copied verbatim from the form so the visual
// layout matches pixel-for-pixel.
// ──────────────────────────────────────────────────────────────────────
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 11 };
const cellStyle: React.CSSProperties = { border: '1px solid #333', padding: '6px 8px', verticalAlign: 'top' };
const headCellStyle: React.CSSProperties = { ...cellStyle, background: '#F3EADC', color: '#5E4426', fontWeight: 700, textAlign: 'left' };
const labelCellStyle: React.CSSProperties = { ...cellStyle, background: '#FAF7F0', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em', width: '28%' };

// ──────────────────────────────────────────────────────────────────────
// Reference lists — duplicated from the form rather than imported, to
// keep this lib free of any client-side dependencies. If the canonical
// list changes, update this constant alongside the form's.
// ──────────────────────────────────────────────────────────────────────
const TRAVEL_LOCATIONS: Record<string, string> = {
    MRC: 'Montclaire Resort and Conferencing (MRC)',
    NAH: 'New Ambassador Hotel (NAH)',
    RTH: 'Rainbow Towers Hotel (RTH)',
    KHCC: 'KHCC Conference Centre',
    BRH: 'Bulawayo Rainbow Hotel (BRH)',
    VFRH: 'Victoria Falls Rainbow Hotel (VFRH)',
    AZAM: "A'Zambezi River Lodge (AZAM)",
};

const TRAVEL_MODE_LABELS: Record<string, string> = {
    personal_motor_vehicle: 'Personal Motor Vehicle',
    air_transport: 'Air Transport',
    bus_public_transport: 'Bus / Public Transport',
};

function locationLabel(code?: string, custom?: string): string {
    if (!code) return custom || '—';
    if (code === 'OTHER') return custom || 'Other';
    return TRAVEL_LOCATIONS[code] || code;
}

function travelModeText(mode?: string, vehicleRegistration?: string): string {
    if (!mode) return '—';
    const base = TRAVEL_MODE_LABELS[mode] || mode;
    if (mode === 'personal_motor_vehicle' && vehicleRegistration) {
        return `${base} — Reg: ${vehicleRegistration}`;
    }
    return base;
}

function num(value: any): number {
    const n = parseFloat(String(value ?? '0'));
    return Number.isFinite(n) ? n : 0;
}

// ──────────────────────────────────────────────────────────────────────
// Approval row labels — must mirror the form's roles list exactly.
// ──────────────────────────────────────────────────────────────────────
const APPROVAL_ROLES: Array<{ key: string; label: string; description: string }> = [
    { key: 'line_manager', label: 'Line Manager', description: 'Recommendation' },
    { key: 'functional_head', label: 'Functional Head', description: 'Functional Approval' },
    { key: 'hrd', label: 'HR Director', description: 'HR Director Approval' },
    { key: 'ceo', label: 'CEO', description: 'Authorisation' },
];

// ──────────────────────────────────────────────────────────────────────
// Input shape — what the builder needs to render the full document.
// ──────────────────────────────────────────────────────────────────────
export interface TravelAuthPreviewInput {
    /** Whose request — name, department, business unit. */
    employee: {
        name?: string;
        department?: string;
        businessUnit?: string;
    };
    /** Display-only timestamp shown on the document header. */
    requestTimestamp?: string;

    /** Core trip fields (mirror TravelData). */
    dateOfIntendedTravel?: string;
    purposeOfTravel?: string;
    accompanyingAssociates?: string;
    travelMode?: string;
    vehicleRegistration?: string;

    isInternational?: boolean;
    isEmergencyRequest?: boolean;
    emergencyReason?: string;

    /** Itinerary rows; structure matches form state. */
    itinerary?: Array<{
        date?: string;
        from?: string;
        fromCustom?: string;
        to?: string;
        toCustom?: string;
        km?: string;
        justification?: string;
    }>;

    /** Budget breakdown — `tollgates` is an array of road-specific entries. */
    budget?: {
        aaRates?: { quantity?: string; unitCost?: string; totalCost?: string };
        airBusTickets?: { quantity?: string; unitCost?: string; totalCost?: string };
        conferencingCost?: { quantity?: string; unitCost?: string; totalCost?: string };
        tollgates?: Array<{ road?: string; quantity?: string; unitCost?: string; totalCost?: string }>;
        other?: { description?: string; quantity?: string; unitCost?: string; totalCost?: string };
    };

    /** Pre-computed grand total; falls back to summing the budget. */
    grandTotal?: string;

    /**
     * Approval row data. For the form preview this is just the selected
     * approver names (no signatures yet); for the [id] preview it can
     * include the signature URL + signed-at timestamp.
     */
    approvers?: {
        [roleKey: string]: {
            name?: string;
            signatureUrl?: string | null;
            signedAt?: string | null;
            decision?: 'approved' | 'rejected' | null;
        };
    };

    /** Optional approver comments — rendered into the Additional Comments box. */
    comments?: string;
}

// ──────────────────────────────────────────────────────────────────────
// Document header — title/document-id strip at the top of every form.
// ──────────────────────────────────────────────────────────────────────
export function buildTravelAuthDocumentHeader(isInternational?: boolean): DocumentHeader {
    return {
        logoUrl: '/images/RTG_LOGO.png',
        docNo: isInternational
            ? 'DOC NO: HR APX – 27 INTERNATIONAL TRAVEL AUTHORISATION'
            : 'DOC NO: HR APX – 27 LOCAL TRAVEL AUTHORISATION',
        department: 'DEPARTMENT: HUMAN RESOURCES',
        page: 'PAGE: 1 of 1',
    };
}

// ──────────────────────────────────────────────────────────────────────
// Main builder.
// ──────────────────────────────────────────────────────────────────────
export function buildTravelAuthPreviewSections(input: TravelAuthPreviewInput): PreviewSection[] {
    const {
        employee,
        requestTimestamp,
        dateOfIntendedTravel,
        purposeOfTravel,
        accompanyingAssociates,
        travelMode,
        vehicleRegistration,
        isEmergencyRequest,
        emergencyReason,
        itinerary = [],
        budget = {},
        grandTotal,
        approvers = {},
        comments,
    } = input;

    // Total distance + grand total fall back to derived values when not supplied.
    const totalKm = itinerary.reduce((sum, r) => sum + num(r?.km), 0);

    const tollgates = Array.isArray(budget.tollgates) ? budget.tollgates : [];
    const computedGrand = num(budget.aaRates?.totalCost)
        + num(budget.airBusTickets?.totalCost)
        + num(budget.conferencingCost?.totalCost)
        + num(budget.other?.totalCost)
        + tollgates.reduce((sum, t) => sum + num(t?.totalCost), 0);
    const grandTotalText = grandTotal ? String(grandTotal) : computedGrand.toFixed(2);

    return [
        // 1. Header table — employee + trip-level fields.
        {
            content: (
                <table style={tableStyle}>
                    <tbody>
                        <tr>
                            <td style={labelCellStyle}>Name of Employee</td>
                            <td style={cellStyle}>{employee.name || '—'}</td>
                            <td style={labelCellStyle}>Department</td>
                            <td style={cellStyle}>{employee.department || '—'}</td>
                        </tr>
                        <tr>
                            <td style={labelCellStyle}>Business Unit</td>
                            <td style={cellStyle}>{employee.businessUnit || '—'}</td>
                            <td style={labelCellStyle}>Date &amp; Time of Request</td>
                            <td style={cellStyle}>{requestTimestamp || '—'}</td>
                        </tr>
                        <tr>
                            <td style={labelCellStyle}>Date of Intended Travel</td>
                            <td style={cellStyle} colSpan={3}>{dateOfIntendedTravel || '—'}</td>
                        </tr>
                        <tr>
                            <td style={labelCellStyle}>Purpose of Travel</td>
                            <td style={cellStyle} colSpan={3}>{purposeOfTravel || '—'}</td>
                        </tr>
                        <tr>
                            <td style={labelCellStyle}>Accompanying Associates</td>
                            <td style={cellStyle} colSpan={3}>{accompanyingAssociates || '—'}</td>
                        </tr>
                        <tr>
                            <td style={labelCellStyle}>Travel Mode (Vehicle Registration if driving)</td>
                            <td style={cellStyle} colSpan={3}>{travelModeText(travelMode, vehicleRegistration)}</td>
                        </tr>
                    </tbody>
                </table>
            ),
        },
        // 2. Conditions.
        {
            title: 'Conditions',
            content: (
                <div
                    style={{
                        fontSize: 10.5,
                        lineHeight: 1.5,
                        color: '#222',
                        background: '#FAF7F0',
                        border: '1px solid #E5DFD2',
                        padding: '10px 12px',
                    }}
                >
                    <p style={{ margin: 0 }}>
                        The employee is to travel for the stated business purpose only. All travel
                        must comply with the Rainbow Tourism Group travel policy. Where personal
                        motor vehicles are used, the driver warrants that the vehicle is licensed,
                        insured and roadworthy. Receipts must be retained for all reimbursable
                        expenditure and submitted with the retirement of the travel advance.
                    </p>
                    {isEmergencyRequest && (
                        <p style={{ margin: '8px 0 0', fontWeight: 600, color: '#8A3B1A' }}>
                            Emergency travel reason: {emergencyReason || '—'}
                        </p>
                    )}
                </div>
            ),
        },
        // 3. Itinerary table.
        {
            title: 'Travel Itinerary',
            content: (
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={headCellStyle}>Date / Time</th>
                            <th style={headCellStyle}>From</th>
                            <th style={headCellStyle}>To</th>
                            <th style={{ ...headCellStyle, textAlign: 'right', width: '12%' }}>Distance (km)</th>
                            <th style={headCellStyle}>Justification</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itinerary.length === 0 ? (
                            <tr><td style={cellStyle} colSpan={5}>No itinerary entries.</td></tr>
                        ) : (
                            itinerary.map((it, i) => (
                                <tr key={i}>
                                    <td style={cellStyle}>{it.date || '—'}</td>
                                    <td style={cellStyle}>{locationLabel(it.from, it.fromCustom)}</td>
                                    <td style={cellStyle}>{locationLabel(it.to, it.toCustom)}</td>
                                    <td style={{ ...cellStyle, textAlign: 'right' }}>{it.km || '—'}</td>
                                    <td style={cellStyle}>{it.justification || '—'}</td>
                                </tr>
                            ))
                        )}
                        <tr>
                            <td style={{ ...cellStyle, fontWeight: 700 }} colSpan={3}>Total Distance</td>
                            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>{totalKm.toFixed(1)}</td>
                            <td style={cellStyle}></td>
                        </tr>
                    </tbody>
                </table>
            ),
        },
        // 4. Hotel reservation placeholder (the form has an inline note here).
        {
            title: 'Hotel Reservation',
            content: (
                <table style={tableStyle}>
                    <tbody>
                        <tr>
                            <td style={labelCellStyle}>Hotel Reservation Details</td>
                            <td style={cellStyle}>
                                <span style={{ color: '#666', fontStyle: 'italic' }}>
                                    Submit a separate Hotel Booking request if accommodation is required.
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            ),
        },
        // 5. Travel budget.
        {
            title: 'Travel Budget',
            content: (
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={headCellStyle}>Item</th>
                            <th style={{ ...headCellStyle, textAlign: 'right', width: '12%' }}>Quantity</th>
                            <th style={{ ...headCellStyle, textAlign: 'right', width: '16%' }}>Unit Cost (USD)</th>
                            <th style={{ ...headCellStyle, textAlign: 'right', width: '18%' }}>Total (USD)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={cellStyle}>AA Rates (Personal Vehicle)</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.aaRates?.quantity || '—'}</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.aaRates?.unitCost || '—'}</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.aaRates?.totalCost || '0.00'}</td>
                        </tr>
                        <tr>
                            <td style={cellStyle}>Air / Bus Tickets</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.airBusTickets?.quantity || '—'}</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.airBusTickets?.unitCost || '—'}</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.airBusTickets?.totalCost || '0.00'}</td>
                        </tr>
                        <tr>
                            <td style={cellStyle}>Conferencing Cost</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.conferencingCost?.quantity || '—'}</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.conferencingCost?.unitCost || '—'}</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.conferencingCost?.totalCost || '0.00'}</td>
                        </tr>
                        {tollgates.map((t, i) => (
                            <tr key={`toll-${i}`}>
                                <td style={cellStyle}>Tollgate{t.road ? ` — ${t.road}` : ''}</td>
                                <td style={{ ...cellStyle, textAlign: 'right' }}>{t.quantity || '—'}</td>
                                <td style={{ ...cellStyle, textAlign: 'right' }}>{t.unitCost || '—'}</td>
                                <td style={{ ...cellStyle, textAlign: 'right' }}>{t.totalCost || '0.00'}</td>
                            </tr>
                        ))}
                        <tr>
                            <td style={cellStyle}>
                                Other{budget.other?.description ? ` — ${budget.other.description}` : ''}
                            </td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.other?.quantity || '—'}</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.other?.unitCost || '—'}</td>
                            <td style={{ ...cellStyle, textAlign: 'right' }}>{budget.other?.totalCost || '0.00'}</td>
                        </tr>
                        <tr>
                            <td style={{ ...cellStyle, fontWeight: 700, background: '#F3EADC' }} colSpan={3}>Grand Total</td>
                            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700, background: '#F3EADC' }}>
                                {grandTotalText}
                            </td>
                        </tr>
                    </tbody>
                </table>
            ),
        },
        // 6. Approval row — same four columns as the form, populated with
        // signatures + signed-at when available on the persisted record.
        {
            title: 'Approval',
            content: (
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            {APPROVAL_ROLES.map(r => (
                                <th key={r.key} style={{ ...headCellStyle, textAlign: 'center', width: '25%' }}>
                                    {r.label}
                                    <div style={{ fontSize: 9, fontWeight: 500, color: '#7C5A33', textTransform: 'none' }}>
                                        {r.description}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            {APPROVAL_ROLES.map(r => {
                                const a = approvers[r.key];
                                const decisionColor =
                                    a?.decision === 'approved' ? '#15803d' :
                                    a?.decision === 'rejected' ? '#b91c1c' : '#666';
                                return (
                                    <td key={r.key} style={{ ...cellStyle, width: '25%' }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Name</div>
                                        <div style={{ fontSize: 11, marginBottom: 8 }}>{a?.name || '—'}</div>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Signature</div>
                                        <div style={{ borderBottom: '1px solid #666', minHeight: 32, marginTop: 4, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {a?.signatureUrl ? (
                                                <img
                                                    src={a.signatureUrl}
                                                    alt={`${a.name || r.label} signature`}
                                                    style={{ maxHeight: 32, maxWidth: '100%', display: 'block' }}
                                                />
                                            ) : null}
                                        </div>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>Date</div>
                                        <div style={{ borderBottom: '1px solid #666', minHeight: 18, marginTop: 4, fontSize: 10, color: decisionColor }}>
                                            {a?.signedAt ? new Date(a.signedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            ),
        },
        // 7. Additional comments box.
        {
            title: 'Additional Comments',
            content: (
                <div
                    style={{
                        border: '1px solid #333',
                        minHeight: 60,
                        padding: '8px 10px',
                        fontSize: 11,
                        color: '#222',
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {comments && comments.trim().length > 0 ? comments : ' '}
                </div>
            ),
        },
    ];
}

// ──────────────────────────────────────────────────────────────────────
// Adapter: build the input from persisted metadata + request_steps so
// the [id]-page preview matches the form preview without each call site
// having to do the conversion.
// ──────────────────────────────────────────────────────────────────────
export function travelAuthInputFromRequest(request: any): TravelAuthPreviewInput {
    const metadata = request?.metadata || {};
    const creator = request?.creator || {};
    const steps: any[] = Array.isArray(request?.request_steps) ? request.request_steps : [];

    // Resolve each role's name + signature from request_steps. We match by
    // approver_role (line_manager, hrd, etc.); fall back to metadata's
    // approverRoles map (id-only) when steps haven't been resolved with
    // names yet.
    const supabaseBase = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const sigUrlFor = (userId?: string | null) =>
        userId && supabaseBase ? `${supabaseBase}/storage/v1/object/public/signatures/${userId}.png` : null;

    const approvers: TravelAuthPreviewInput['approvers'] = {};
    for (const step of steps) {
        const role = String(step.approver_role || '').toLowerCase();
        if (!role) continue;
        const approval = Array.isArray(step.approvals) ? step.approvals[0] : null;
        const approverName =
            step.approver?.display_name || approval?.approver?.display_name || null;
        const approverId =
            step.approver?.id || step.approver_user_id || approval?.approver?.id || approval?.approver_id || null;
        approvers[role] = {
            name: approverName || undefined,
            signatureUrl: approval?.signed_at ? sigUrlFor(approverId) : null,
            signedAt: approval?.signed_at || null,
            decision: approval?.decision || null,
        };
    }

    // Aggregate any comments left during the approval chain into the
    // additional-comments box so they're visible on the document.
    const comments = steps
        .map(s => {
            const a = Array.isArray(s.approvals) ? s.approvals[0] : null;
            if (!a?.comment) return null;
            const name = s.approver?.display_name || a?.approver?.display_name || s.approver_role || 'Approver';
            return `${name}: ${a.comment}`;
        })
        .filter(Boolean)
        .join('\n');

    return {
        employee: {
            name: creator.display_name,
            department: metadata.department || creator.department?.name,
            businessUnit: metadata.businessUnit || metadata.business_unit_name,
        },
        requestTimestamp: request?.created_at
            ? new Date(request.created_at).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })
            : undefined,
        dateOfIntendedTravel: metadata.dateOfIntendedTravel,
        purposeOfTravel: metadata.purposeOfTravel,
        accompanyingAssociates: metadata.accompanyingAssociates,
        travelMode: metadata.travelMode,
        vehicleRegistration: metadata.vehicleRegistration,
        isInternational: metadata.type === 'international_travel_authorization',
        isEmergencyRequest: !!metadata.isEmergencyRequest,
        emergencyReason: metadata.emergencyReason,
        itinerary: metadata.itinerary,
        budget: metadata.budget,
        grandTotal: metadata.grandTotal,
        approvers,
        comments: comments || undefined,
    };
}

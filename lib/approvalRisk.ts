/**
 * Risk-Based Authentication for Approvals
 * ----------------------------------------
 * Classifies an approval action as low / medium / high risk. The classification
 * drives which authentication ceremony the user must pass before their decision
 * is recorded:
 *
 *   low    -> valid session + in-product confirmation modal
 *   medium -> Microsoft Entra step-up (prompt=login, tenant-enforced MFA)
 *   high   -> WebAuthn biometric (Windows Hello / Touch ID / Face ID)
 *            (fallback to medium if the user has no registered credential)
 *
 * Signals (any one is sufficient to escalate):
 *   - monetary value          -> >= HIGH_VALUE_THRESHOLD -> high
 *                                >= MEDIUM_VALUE_THRESHOLD -> medium
 *   - creator / step department is sensitive (Finance, HR, Legal, Exec) -> high
 *   - request category is sensitive (payroll, contract, policy)        -> medium+
 *   - this is the FINAL approval in the chain (last gate before commit) -> high
 *
 * Everything else (small-ticket departmental approvals, intermediate steps,
 * informational workflows) settles at low risk.
 *
 * The function is pure and side-effect free so it can be called from both
 * the browser (to pre-select the UI flow) and the server (which is
 * authoritative — the server verdict governs auth enforcement).
 */

export type ApprovalRisk = 'low' | 'medium' | 'high';

export type AuthenticationMethod = 'session' | 'microsoft_mfa' | 'biometric';

// ---------------------------------------------------------------------------
// Thresholds / configuration — adjust here, not in call sites.
// ---------------------------------------------------------------------------

/** Any approval whose value >= this is HIGH risk. USD-equivalent. */
export const HIGH_VALUE_THRESHOLD = 50_000;

/** Any approval whose value >= this (and below HIGH) is MEDIUM risk. */
export const MEDIUM_VALUE_THRESHOLD = 5_000;

/** Department names that always escalate to HIGH. Compared case-insensitively. */
const HIGH_RISK_DEPARTMENTS = new Set([
  'finance',
  'hr',
  'human resources',
  'legal',
  'executive',
  'executives',
  'c-suite',
  'board',
]);

/** Department / category hints that escalate to MEDIUM (or higher if combined). */
const MEDIUM_RISK_DEPARTMENTS = new Set([
  'procurement',
  'operations',
  'it',
  'security',
  'compliance',
]);

/** Workflow categories that are inherently sensitive. */
const SENSITIVE_CATEGORIES = new Set([
  'payroll',
  'compensation',
  'contract',
  'legal',
  'policy',
  'hr',
  'finance',
  'budget',
  'capex',
  'termination',
  'hiring',
]);

/** Request types that are inherently sensitive, regardless of value. */
const SENSITIVE_REQUEST_TYPES = new Set([
  'contract_approval',
  'salary_change',
  'termination_request',
  'policy_change',
  'capex_request',
]);

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

/**
 * Everything the risk evaluator needs. All fields optional so callers can
 * supply whatever they have — missing signals mean "no signal", not "low risk".
 */
export interface ApprovalRiskInput {
  /** Monetary value of the request, in the organization's primary currency. */
  value?: number | null;

  /** Department name or slug of the creator (or the subject of the request). */
  creatorDepartment?: string | null;

  /** Department the CURRENT step belongs to (may differ from creator department). */
  stepDepartment?: string | null;

  /** Workflow category (from workflow_definitions.category). */
  workflowCategory?: string | null;

  /** Free-form request type hint (e.g. metadata.type / metadata.requestType). */
  requestType?: string | null;

  /** Zero-indexed position of the step being actioned. */
  currentStepIndex?: number | null;

  /** Total number of approval steps in the chain. */
  totalSteps?: number | null;

  /** Optional raw form data — scanned for common value field names. */
  formData?: Record<string, any> | null;

  /** Optional explicit risk override from the workflow definition. */
  explicitRisk?: ApprovalRisk | null;
}

export interface RiskEvaluation {
  risk: ApprovalRisk;
  /** Human-readable reasons, for audit logs and tooltips. */
  reasons: string[];
  /** The authentication method the user must pass to satisfy this risk. */
  requiredAuth: AuthenticationMethod;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(value: string | null | undefined): string {
  return (value || '').toString().trim().toLowerCase();
}

/**
 * Pull the monetary value from a form data blob without knowing the exact
 * field name. We probe common names (total, amount, value, cost, ...) and
 * take the first numeric hit. This keeps the risk engine decoupled from
 * every workflow's bespoke form schema.
 */
function extractValueFromFormData(formData: Record<string, any> | null | undefined): number | null {
  if (!formData) return null;
  const candidates = [
    'total', 'total_amount', 'total_cost', 'total_value',
    'amount', 'value', 'cost', 'price',
    'grand_total', 'estimated_cost', 'budget',
  ];
  for (const key of candidates) {
    const raw = formData[key];
    if (raw == null) continue;
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

function isHighRiskDepartment(name: string | null | undefined): boolean {
  const n = normalize(name);
  if (!n) return false;
  return [...HIGH_RISK_DEPARTMENTS].some(d => n === d || n.includes(d));
}

function isMediumRiskDepartment(name: string | null | undefined): boolean {
  const n = normalize(name);
  if (!n) return false;
  return [...MEDIUM_RISK_DEPARTMENTS].some(d => n === d || n.includes(d));
}

function isSensitiveCategory(category: string | null | undefined): boolean {
  const c = normalize(category);
  if (!c) return false;
  return [...SENSITIVE_CATEGORIES].some(cat => c === cat || c.includes(cat));
}

function isSensitiveRequestType(type: string | null | undefined): boolean {
  const t = normalize(type);
  if (!t) return false;
  return SENSITIVE_REQUEST_TYPES.has(t);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate the risk of a pending approval action.
 *
 * Pure function — the same input always yields the same output so we can
 * run this on the server (authoritative) and the client (UI hint) and
 * trust that they agree when given the same data.
 */
export function getApprovalRisk(input: ApprovalRiskInput): RiskEvaluation {
  // Respect explicit risk override (e.g. a workflow author marked a step
  // "always high"). Still compute reasons for audit visibility.
  if (input.explicitRisk) {
    return {
      risk: input.explicitRisk,
      reasons: [`Workflow-declared risk: ${input.explicitRisk}`],
      requiredAuth: authForRisk(input.explicitRisk),
    };
  }

  const reasons: string[] = [];
  let risk: ApprovalRisk = 'low';

  // Helper that only *raises* the risk level — low -> medium -> high, never backwards.
  const raise = (to: ApprovalRisk, reason: string) => {
    if (rank(to) > rank(risk)) risk = to;
    reasons.push(reason);
  };

  // ---- monetary value ---------------------------------------------------
  const rawValue = input.value ?? extractValueFromFormData(input.formData);
  if (rawValue != null && rawValue >= HIGH_VALUE_THRESHOLD) {
    raise('high', `High monetary value (${formatCurrency(rawValue)} >= ${formatCurrency(HIGH_VALUE_THRESHOLD)})`);
  } else if (rawValue != null && rawValue >= MEDIUM_VALUE_THRESHOLD) {
    raise('medium', `Moderate monetary value (${formatCurrency(rawValue)} >= ${formatCurrency(MEDIUM_VALUE_THRESHOLD)})`);
  }

  // ---- department sensitivity ------------------------------------------
  if (isHighRiskDepartment(input.creatorDepartment)) {
    raise('high', `Creator department is high-risk: ${input.creatorDepartment}`);
  } else if (isMediumRiskDepartment(input.creatorDepartment)) {
    raise('medium', `Creator department is sensitive: ${input.creatorDepartment}`);
  }

  if (isHighRiskDepartment(input.stepDepartment)) {
    raise('high', `Approval step department is high-risk: ${input.stepDepartment}`);
  } else if (isMediumRiskDepartment(input.stepDepartment)) {
    raise('medium', `Approval step department is sensitive: ${input.stepDepartment}`);
  }

  // ---- category / request type ----------------------------------------
  if (isSensitiveCategory(input.workflowCategory)) {
    raise('medium', `Sensitive workflow category: ${input.workflowCategory}`);
  }
  if (isSensitiveRequestType(input.requestType)) {
    raise('medium', `Sensitive request type: ${input.requestType}`);
  }

  // ---- final-step escalation ------------------------------------------
  // The last gate commits the decision irreversibly — treat it like signing
  // the cheque, even if earlier steps were low risk.
  if (
    typeof input.currentStepIndex === 'number' &&
    typeof input.totalSteps === 'number' &&
    input.totalSteps > 0 &&
    input.currentStepIndex === input.totalSteps - 1
  ) {
    // Only escalate to HIGH if there's already *some* elevated signal, OR if
    // it's a multi-step workflow (single-step workflows are already the final
    // step by definition — don't blanket-HIGH everything).
    if (input.totalSteps > 1) {
      raise('high', 'Final approval step in the chain');
    }
  }

  return {
    risk,
    reasons: reasons.length > 0 ? reasons : ['No elevated-risk signals'],
    requiredAuth: authForRisk(risk),
  };
}

/**
 * Map a risk level to the authentication method required to satisfy it.
 * Exported so UI can label the ceremony ("Verify with biometrics") before
 * making the server call.
 */
export function authForRisk(risk: ApprovalRisk): AuthenticationMethod {
  switch (risk) {
    case 'high':
      return 'biometric';
    case 'medium':
      return 'microsoft_mfa';
    case 'low':
    default:
      return 'session';
  }
}

/**
 * Human-readable label for audit trails and PDF annotations.
 * Mirrors the language required in the generated approval documents.
 */
export function authMethodLabel(method: AuthenticationMethod): string {
  switch (method) {
    case 'biometric':
      return 'Verified via biometric authentication';
    case 'microsoft_mfa':
      return 'Verified via Microsoft authentication';
    case 'session':
    default:
      return 'Verified via authenticated session';
  }
}

/**
 * Determine whether a claimed authentication method satisfies the required
 * one. Biometric always satisfies; microsoft_mfa satisfies medium+low;
 * session satisfies only low.
 *
 * Used server-side to accept a fallback (e.g. user without biometric
 * credentials completing microsoft_mfa for a high-risk approval).
 */
export function satisfiesAuth(
  provided: AuthenticationMethod,
  required: AuthenticationMethod
): boolean {
  return rankAuth(provided) >= rankAuth(required);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function rank(r: ApprovalRisk): number {
  return r === 'high' ? 2 : r === 'medium' ? 1 : 0;
}

function rankAuth(m: AuthenticationMethod): number {
  return m === 'biometric' ? 2 : m === 'microsoft_mfa' ? 1 : 0;
}

function formatCurrency(value: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
}

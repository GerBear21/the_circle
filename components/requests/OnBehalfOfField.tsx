import React from 'react';
import { useAssistantPrincipals } from '../../hooks/useAssistantPrincipals';

export interface OnBehalfOf {
  userId: string;
  name?: string;
  positionTitle?: string;
  email?: string;
}

interface OnBehalfOfFieldProps {
  value: OnBehalfOf | null;
  onChange: (value: OnBehalfOf | null) => void;
  disabled?: boolean;
}

/**
 * "Filing on behalf of" selector.
 *
 * Assistants file forms for the people they support (their principals). This
 * field only appears when a systems admin has assigned the current user as an
 * assistant for at least one person — otherwise it renders nothing. The chosen
 * beneficiary is re-verified server-side on submit.
 */
export function OnBehalfOfField({ value, onChange, disabled }: OnBehalfOfFieldProps) {
  const { principals, loading } = useAssistantPrincipals();

  // Nothing to offer — hide entirely.
  if (loading || principals.length === 0) return null;

  const handleSelect = (userId: string) => {
    if (!userId) {
      onChange(null);
      return;
    }
    const principal = principals.find((p) => p.userId === userId);
    if (!principal) {
      onChange(null);
      return;
    }
    onChange({
      userId: principal.userId,
      name: principal.name,
      positionTitle: principal.positionTitle,
      email: principal.email,
    });
  };

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Filing on behalf of</h3>
        <p className="text-xs text-text-secondary mt-0.5">
          You may file this request on behalf of someone you assist. Leave as
          &ldquo;Myself&rdquo; to file it for yourself.
        </p>
      </div>
      <select
        value={value?.userId || ''}
        disabled={disabled}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm bg-white disabled:opacity-60"
      >
        <option value="">Myself</option>
        {principals.map((principal) => (
          <option key={principal.userId} value={principal.userId}>
            {principal.name}
            {principal.positionTitle ? ` — ${principal.positionTitle}` : ''}
          </option>
        ))}
      </select>
      {value?.userId && (
        <p className="text-xs text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
          This request will be filed on behalf of <strong>{value.name}</strong>
          {value.positionTitle ? ` (${value.positionTitle})` : ''}. You remain the filer of record and
          will receive the approval updates; {value.name?.split(' ')[0] || 'they'} will be notified once it is
          fully approved.
        </p>
      )}
    </div>
  );
}

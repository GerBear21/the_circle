import React, { useEffect, useState } from 'react';
import { Card, Button } from '../../ui';

interface ContactRow {
  business_unit_id: string;
  business_unit_code: string | null;
  business_unit_name: string;
  reception_email: string;
  reservations_email: string;
}

/**
 * Reception + reservations mailboxes per hotel. Fully approved vouchers are
 * emailed to these addresses. Editable by Super Admin / System Admin only
 * (enforced by /api/admin/business-unit-contacts).
 */
export function VoucherEmailsConfig() {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/business-unit-contacts');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load hotel emails');
        }
        const data = await res.json();
        setRows(data.contacts || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load hotel emails');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateRow = (id: string, field: 'reception_email' | 'reservations_email', value: string) => {
    setRows((prev) => prev.map((r) => (r.business_unit_id === id ? { ...r, [field]: value } : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/business-unit-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: rows }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      setMessage({ type: 'success', text: 'Hotel emails saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save hotel emails.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-danger-50 border-danger-200">
        <p className="text-danger-600 text-sm">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Hotel Voucher Emails</h2>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            When a voucher is fully approved it is automatically emailed to the reception and
            reservations mailboxes of the selected hotel(s). Vouchers marked for
            &ldquo;Any RTG Hotel of Choice&rdquo; are sent to every hotel below.
          </p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {message && (
        <div
          className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${
            message.type === 'success'
              ? 'bg-success-50 text-success-600 border-success-100'
              : 'bg-danger-50 text-danger-600 border-danger-100'
          }`}
        >
          {message.text}
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-text-secondary">
            No hotels available (the HRIMS business-unit list could not be loaded).
          </p>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  <th className="px-4 py-3">Hotel</th>
                  <th className="px-4 py-3">Reception Email</th>
                  <th className="px-4 py-3">Reservations Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.business_unit_id}>
                    <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                      {r.business_unit_name}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="email"
                        value={r.reception_email}
                        onChange={(e) => updateRow(r.business_unit_id, 'reception_email', e.target.value)}
                        placeholder="reception@hotel.co.zw"
                        className="w-full min-w-[220px] px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="email"
                        value={r.reservations_email}
                        onChange={(e) => updateRow(r.business_unit_id, 'reservations_email', e.target.value)}
                        placeholder="reservations@hotel.co.zw"
                        className="w-full min-w-[220px] px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default VoucherEmailsConfig;

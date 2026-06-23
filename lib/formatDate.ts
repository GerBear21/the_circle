/**
 * Centralised date formatting for The Circle.
 *
 * The whole system displays dates as DD/MM/YYYY. Use these helpers for any
 * new date rendering so the format stays consistent everywhere.
 */

type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** DD/MM/YYYY (e.g. 04/06/2026). Returns '' for invalid/empty input. */
export function formatDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** HH:mm (24h). Returns '' for invalid/empty input. */
export function formatTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

/** DD/MM/YYYY, HH:mm. Returns '' for invalid/empty input. */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return '';
  return `${formatDate(d)}, ${formatTime(d)}`;
}

const PREFIX_MAP: Record<string, string> = {
  travel: 'LTA',
  local_travel: 'LTA',
  'local-travel-auth': 'LTA',
  travel_authorization: 'LTA',
  local_travel_authorization: 'LTA',
  international_travel: 'ITA',
  international_travel_authorization: 'ITA',
  'international-travel-auth': 'ITA',
  executive_travel: 'ETA',
  executive_travel_authorization: 'ETA',
  'executive-travel-auth': 'ETA',
  hotel: 'SCB',
  hotel_booking: 'SCB',
  'hotel-booking': 'SCB',
  staff_comp: 'SCB',
  external_hotel: 'ECB',
  external_hotel_booking: 'ECB',
  'external-hotel-booking': 'ECB',
  external_comp: 'ECB',
  external_comp_booking: 'ECB',
  'external-comp-booking': 'ECB',
  voucher: 'CVR',
  voucher_request: 'CVR',
  capex: 'CPX',
  capex_request: 'CPX',
  petty_cash: 'PCV',
  petty_cash_request: 'PCV',
  'petty-cash': 'PCV',
  workflow: 'WFR',
  form_request: 'FRM',
  approval: 'APR',
  inter_unit_debit_note: 'IUDN',
  'inter-unit-debit-note': 'IUDN',
  inter_unit_credit_note: 'IUCN',
  'inter-unit-credit-note': 'IUCN',
  journal: 'JNL',
  journals: 'JNL',
  journal_entry: 'JNL',
  'journal-entry': 'JNL',
};

export function getPrefixForRequestType(requestType?: string | null): string {
  if (!requestType) return 'REQ';
  const normalized = String(requestType).toLowerCase().trim();
  return PREFIX_MAP[normalized] || 'REQ';
}

// Human-readable label for a request type, for use in notification copy and
// anywhere a friendly name is shown. Never returns a raw enum value or a
// misleading default — unknown/absent types fall back to the neutral "Request".
const LABEL_MAP: Record<string, string> = {
  travel: 'Travel Authorization',
  local_travel: 'Travel Authorization',
  travel_authorization: 'Travel Authorization',
  local_travel_authorization: 'Travel Authorization',
  international_travel: 'International Travel Authorization',
  international_travel_authorization: 'International Travel Authorization',
  executive_travel: 'Executive Travel Authorization',
  executive_travel_authorization: 'Executive Travel Authorization',
  hotel: 'Hotel Booking',
  hotel_booking: 'Hotel Booking',
  staff_comp: 'Complimentary Booking',
  external_hotel: 'External Hotel Booking',
  external_hotel_booking: 'External Hotel Booking',
  external_comp: 'External Complimentary Booking',
  external_comp_booking: 'External Complimentary Booking',
  voucher: 'Complimentary Voucher',
  voucher_request: 'Complimentary Voucher',
  capex: 'CAPEX',
  capex_request: 'CAPEX',
  petty_cash: 'Petty Cash',
  petty_cash_request: 'Petty Cash',
  workflow: 'Workflow',
  form_request: 'Form',
  approval: 'Approval',
  inter_unit_debit_note: 'Inter-Unit Debit Note',
  inter_unit_credit_note: 'Inter-Unit Credit Note',
  journal: 'Journal',
  journals: 'Journal',
  journal_entry: 'Journal',
  general: 'Request',
};

export function getRequestTypeLabel(requestType?: string | null): string {
  if (!requestType) return 'Request';
  const normalized = String(requestType).toLowerCase().trim().replace(/-/g, '_');
  return LABEL_MAP[normalized] || 'Request';
}

export function generateReferenceCode(requestType?: string | null, now: Date = new Date()): string {
  const prefix = getPrefixForRequestType(requestType);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const hh = String(now.getHours()).padStart(2, '0');
  const mn = String(now.getMinutes()).padStart(2, '0');
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2).padEnd(2, 'A');
  return `${prefix}-${dd}${mm}${yyyy}-${hh}${mn}-${rand}`;
}

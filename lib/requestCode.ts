const PREFIX_MAP: Record<string, string> = {
  travel: 'LTA',
  local_travel: 'LTA',
  'local-travel-auth': 'LTA',
  travel_authorization: 'LTA',
  local_travel_authorization: 'LTA',
  international_travel: 'ITA',
  international_travel_authorization: 'ITA',
  'international-travel-auth': 'ITA',
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
  capex: 'CEF',
  capex_request: 'CEF',
  workflow: 'WFR',
  form_request: 'FRM',
  approval: 'APR',
};

export function getPrefixForRequestType(requestType?: string | null): string {
  if (!requestType) return 'REQ';
  const normalized = String(requestType).toLowerCase().trim();
  return PREFIX_MAP[normalized] || 'REQ';
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

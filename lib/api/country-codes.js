/** ISO 3166-1 alpha-2 → alpha-3 (Midtrans requires 3-letter country_code). */
const ALPHA2_TO_ALPHA3 = {
  ID: 'IDN',
  JP: 'JPN',
  SG: 'SGP',
  MY: 'MYS',
  TH: 'THA',
  PH: 'PHL',
  VN: 'VNM',
  KR: 'KOR',
  TW: 'TWN',
  HK: 'HKG',
  CN: 'CHN',
  IN: 'IND',
  AU: 'AUS',
  NZ: 'NZL',
  US: 'USA',
  CA: 'CAN',
  GB: 'GBR',
  DE: 'DEU',
  FR: 'FRA',
  NL: 'NLD',
  OTHER: 'USA',
};

export function toMidtransCountryCode(code) {
  if (!code || typeof code !== 'string') return 'IDN';
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length === 3) return trimmed;
  return ALPHA2_TO_ALPHA3[trimmed] || 'USA';
}

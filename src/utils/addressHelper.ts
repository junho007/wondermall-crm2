/**
 * Address & Location Analysis Helper
 * Extracts Malaysian state from address string and formats address tail-truncation.
 */

export const MALAYSIAN_STATES = [
  'Kuala Lumpur',
  'Selangor',
  'Johor',
  'Pulau Pinang',
  'Penang',
  'Perak',
  'Kedah',
  'Melaka',
  'Pahang',
  'Sabah',
  'Sarawak',
  'Terengganu',
  'Kelantan',
  'Negeri Sembilan',
  'Perlis',
  'Putrajaya',
  'Labuan',
];

/**
 * Extracts the state name from a full delivery address string.
 */
export function getStateFromAddress(address: string | undefined): string {
  if (!address || typeof address !== 'string' || !address.trim()) {
    return 'Unspecified State';
  }

  const normalized = address.toLowerCase();

  for (const state of MALAYSIAN_STATES) {
    if (normalized.includes(state.toLowerCase())) {
      // Normalize 'Penang' to 'Pulau Pinang'
      if (state.toLowerCase() === 'penang') return 'Pulau Pinang';
      return state;
    }
  }

  // Fallback check based on postcode prefix if state text is missing
  const postcodeMatch = address.match(/\b(\d{5})\b/);
  if (postcodeMatch) {
    const pc = parseInt(postcodeMatch[1], 10);
    if (pc >= 50000 && pc <= 60000) return 'Kuala Lumpur';
    if (pc >= 40000 && pc <= 48300) return 'Selangor';
    if (pc >= 63000 && pc <= 64000) return 'Selangor';
    if (pc >= 79000 && pc <= 81900) return 'Johor';
    if (pc >= 10000 && pc <= 11950) return 'Pulau Pinang';
    if (pc >= 30000 && pc <= 36810) return 'Perak';
    if (pc >= 75000 && pc <= 78300) return 'Melaka';
    if (pc >= 88000 && pc <= 91308) return 'Sabah';
    if (pc >= 93000 && pc <= 98850) return 'Sarawak';
    if (pc >= 8000 && pc <= 9810) return 'Kedah';
  }

  return 'Other Location';
}

/**
 * Infer Country from address string (Malaysia, Singapore, China, Indonesia).
 */
export function inferCountryFromAddress(address: string | undefined | null): string {
  if (!address || typeof address !== 'string' || !address.trim()) {
    return 'Malaysia';
  }

  const normalized = address.toLowerCase();
  if (normalized.includes('singapore') || normalized.includes(' sg ') || normalized.includes(', sg')) {
    return 'Singapore';
  }
  if (normalized.includes('china') || normalized.includes('cn') || normalized.includes('guangdong') || normalized.includes('shenzhen')) {
    return 'China';
  }
  if (normalized.includes('indonesia') || normalized.includes(' id ') || normalized.includes('jakarta')) {
    return 'Indonesia';
  }

  return 'Malaysia';
}

/**
 * Formats address so that the tail (state/postcode) is visible, truncating the front with '...'
 * Example: '...SS 15/4D, 47500 Subang Jaya, Selangor'
 */
export function formatAddressTail(address: string | undefined, maxLength = 36): string {
  if (!address) return '-';
  const trimmed = address.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return '...' + trimmed.slice(-maxLength);
}

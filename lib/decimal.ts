/**
 * Decimal text inputs are type="text" inputMode="decimal" (type="number" turns
 * "80,5" into 805 or "" depending on the keyboard). Accepts "80", "80.5" and
 * "80,5"; blank becomes undefined so it reads as missing, not as 0.
 */
export function normalizeDecimal(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? undefined;
  const trimmed = value.trim().replace(',', '.');
  return trimmed === '' ? undefined : trimmed;
}

/** Safe int parsing for class-transformer @Transform on env vars (avoids object stringification). */
export function toOptionalInt(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

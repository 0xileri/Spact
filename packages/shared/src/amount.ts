/**
 * Exact conversion between display amounts ("12.5") and token base units (12500000n).
 * Never uses floating point. Rejects input that would need rounding.
 */

const MAX_DECIMALS = 24;
const U128_MAX = (1n << 128n) - 1n;
const DISPLAY_RE = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

export class AmountError extends Error {}

function checkDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    throw new AmountError(`decimals must be an integer in 0..=${MAX_DECIMALS}, got ${decimals}`);
  }
}

/** "12.5" with 6 decimals -> 12500000n. */
export function parseUnits(display: string, decimals: number): bigint {
  checkDecimals(decimals);
  const m = DISPLAY_RE.exec(display);
  if (!m) {
    throw new AmountError(`not a plain non-negative decimal: ${JSON.stringify(display)}`);
  }
  const whole = m[1] ?? "0";
  const frac = m[2] ?? "";
  if (frac.length > decimals) {
    throw new AmountError(`more than ${decimals} decimal places would need rounding`);
  }
  const units = BigInt(whole + frac.padEnd(decimals, "0"));
  if (units > U128_MAX) {
    throw new AmountError("amount does not fit in u128");
  }
  return units;
}

/** 12500000n with 6 decimals -> "12.5". */
export function formatUnits(units: bigint, decimals: number): string {
  checkDecimals(decimals);
  if (units < 0n || units > U128_MAX) {
    throw new AmountError("units out of u128 range");
  }
  if (decimals === 0) {
    return units.toString();
  }
  const s = units.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/** Parses a contract U128 JSON string ("12500000") into a bigint, strictly. */
export function parseU128(value: string): bigint {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new AmountError(`not a canonical u128 string: ${JSON.stringify(value)}`);
  }
  const n = BigInt(value);
  if (n > U128_MAX) {
    throw new AmountError("value does not fit in u128");
  }
  return n;
}

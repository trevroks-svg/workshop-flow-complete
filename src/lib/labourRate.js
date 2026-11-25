/**
 * Labour rate handling.
 *
 * Labour is charged INC GST. The rate stored in Business.default_labour_rate
 * (and snapshotted on PartsRequest.labour_rate_ex_gst — a legacy column name
 * kept so existing rows keep working) is the inc-GST hourly rate.
 * Default $190 inc GST (confirmed by Trevor, Nov 2026).
 *
 * NOTE: rows created before this change stored the old ex-GST rate (110) in
 * labour_rate_ex_gst. Those snapshots keep their numeric value and are now
 * read as inc GST. The business default is what new quotes use.
 */

export const DEFAULT_LABOUR_RATE_INC_GST = 190;

export function resolveLabourRate(...candidates) {
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return DEFAULT_LABOUR_RATE_INC_GST;
}

/** Labour cost inc GST for the given hours at the inc-GST hourly rate. */
export function labourCostIncGst(hours, rateIncGst) {
  const h = Number(hours);
  const rate = resolveLabourRate(rateIncGst);
  if (!Number.isFinite(h) || h <= 0) return null;
  return Math.round((h * rate + Number.EPSILON) * 100) / 100;
}

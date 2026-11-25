/**
 * Tyre replacement rule from the 24 Nov 2026 trial:
 * recommend replacement at 2mm tread, always as a set of four — never just
 * the worn tyres.
 *
 * The rule applies when the request's recorded tread depths show a road tyre
 * at or below 2mm. The spare is ignored. If no tread depths were recorded,
 * pricing is left alone and the group is flagged so the advisor can check.
 * Labour hours are unchanged — the quoted labour applies to the set.
 */

export const TYRE_REPLACEMENT_TREAD_MM = 2;
export const TYRE_SET_SIZE = 4;

const ROAD_TREAD_KEYS = ['lh_front', 'rh_front', 'lh_rear', 'rh_rear'];

export function parseTreadMm(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /below/i.test(value)) return 0.5;
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function getMinRoadTreadMm(tyreTreadDepths) {
  if (!tyreTreadDepths) return null;
  const values = ROAD_TREAD_KEYS
    .map(key => parseTreadMm(tyreTreadDepths[key]))
    .filter(value => value != null);
  return values.length ? Math.min(...values) : null;
}

export function tyresNeedReplacement(tyreTreadDepths) {
  const min = getMinRoadTreadMm(tyreTreadDepths);
  return min != null && min <= TYRE_REPLACEMENT_TREAD_MM;
}

function isTyreGroup(group) {
  const text = [group.repair_name, ...(group.parts || [])].join(' ').toLowerCase();
  return /\b(tyres?|tires?)\b/.test(text);
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Re-prices tyre groups as a set of four when the tread rule triggers.
 * Idempotent: the price is always derived from the quoted unit price, so
 * running it twice gives the same result.
 */
export function applyTyreSetOfFourRule(groups, lineItems, request) {
  const needsReplacement = tyresNeedReplacement(request?.tyre_tread_depths);
  const hasTreadData = getMinRoadTreadMm(request?.tyre_tread_depths) != null;

  return (groups || []).map(group => {
    if (!isTyreGroup(group)) return group;
    if (group.tyre_rule_applied) return group;

    if (!needsReplacement) {
      return {
        ...group,
        tyre_set_of_four: false,
        tyre_tread_data_missing: !hasTreadData,
      };
    }

    const tyreItems = (lineItems || []).filter(item => /\b(tyres?|tires?)\b/i.test(item.description || ''));
    const unitPrice = tyreItems
      .map(item => item.unit_price_ex_gst)
      .find(value => value != null && value > 0) ?? null;
    const quotedQty = tyreItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    if (unitPrice == null || quotedQty >= TYRE_SET_SIZE) {
      return { ...group, tyre_set_of_four: quotedQty >= TYRE_SET_SIZE, tyre_rule_applied: false };
    }

    return {
      ...group,
      parts_cost_ex_gst: roundCurrency(unitPrice * TYRE_SET_SIZE),
      tyre_set_of_four: true,
      tyre_rule_applied: true,
      tyre_rule_note: `Priced as a set of four tyres - tread at or below ${TYRE_REPLACEMENT_TREAD_MM}mm.`,
    };
  });
}

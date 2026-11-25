/**
 * Tyre replacement rule from the 24 Nov 2026 trial:
 * recommend replacement at 2mm tread, always as a set of four — never just
 * the worn tyres.
 *
 * The rule applies when the request's recorded tread depths show a road tyre
 * at or below 2mm. The spare is ignored. If no tread depths were recorded,
 * pricing is left alone and the group is flagged so the advisor can check.
 * Labour hours are unchanged — the quoted labour applies to the set.
 *
 * A tyre line is recognised by the word "tyre" OR by a tyre size
 * (225/65R17) — real dealer lines are usually just a size and a code, so
 * testing for the word alone misses every realistic tyres quote (break B0).
 */

import { TYRE_SIZE_RE } from './plainPartName.js';

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

// A line or group is a tyre line when it says so, carries a tyre size, or
// - for note-priced items - was tagged with the request's tyres part type.
export function isTyreText(text) {
  const value = String(text || '');
  return TYRE_SIZE_RE.test(value) || /\b(tyres?|tires?)\b/i.test(value);
}

function isTyreGroup(group) {
  if (group?.part_type === 'tyres') return true;
  const text = [group.repair_name, ...(group.parts || [])].join(' ');
  return isTyreText(text);
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Recompute the fitted quote total after the tyre rule repriced a group.
 * The parsed quote total is the pre-reprice figure (one tyre), so the
 * analyse panel would otherwise show the stale $199 instead of $986
 * (break B6). Returns null when no group was repriced. labourRate is the
 * inc-GST labour rate ($190). Labour hours come from the controller's
 * single labour line when there is exactly one group, otherwise from each
 * group's own labour hours - the same rule the draft builders use.
 */
export function recomputeQuoteTotalAfterTyreRule(groups, request, labourRate) {
  if (!Array.isArray(groups) || !groups.some((g) => g.tyre_rule_applied)) return null;
  const partsIncGst = groups.reduce((sum, g) => sum + (g.parts_cost_ex_gst || 0) * 1.1, 0);
  const labourLines = request?.labour_lines || [];
  let labourIncGst = 0;
  if (labourLines.length === 1 && groups.length === 1 && Number.isFinite(Number(labourLines[0]?.hours))) {
    labourIncGst = Number(labourLines[0].hours) * labourRate;
  } else {
    labourIncGst = groups.reduce(
      (sum, g) => sum + (g.labour_hours ?? g.estimated_labour_hours ?? 0.5) * labourRate,
      0
    );
  }
  return roundCurrency(partsIncGst + labourIncGst);
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

    const tyreItems = (lineItems || []).filter(item =>
      item?.part_type === 'tyres' || isTyreText(item.description || '')
    );
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
